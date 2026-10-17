/**
 * Maintenance of the derived scorecard documents outside the scoring
 * engine's own transactions (server only):
 *
 * - {@link rebuildPlayerMatches}: re-derive a match's `player_matches`
 *   records from its innings. The engine keeps them in step itself; this
 *   covers innings completed by other writes (abandoning a match) and
 *   matches whose tournament / club / season / date changed.
 * - {@link remapScorecardUserId}: rewrite a user id inside innings
 *   scorecards, over documents and player records when an auth account
 *   takes over an existing profile.
 */

import type { DataSource } from "./datasource";
import type { WriteEvent } from "./query-builder";
import {
  OVERS_COLLECTION,
  PLAYER_MATCHES_COLLECTION,
  SCORECARD_FIELDS,
} from "./scorecard";
import { runScoringTransaction } from "./scoring/tx";
import { syncMatchRecords } from "./stats-sync";
import { chunk, IN_CHUNK_SIZE } from "./datasource";
import type { InningsRow, MatchesRow } from "./types";

/**
 * Re-derive `player_matches` for one match (and move the statistics with
 * them) in one transaction; writes only what differs. A deleted match
 * loses its records.
 */
export async function rebuildPlayerMatches(
  ds: DataSource,
  matchId: string,
): Promise<{ written: number; deleted: number }> {
  const now = new Date().toISOString();
  return runScoringTransaction({ ds }, async (t) => {
    const [match, innings] = await Promise.all([
      t.doc<MatchesRow>("matches", matchId),
      t.where<InningsRow>("innings", [["match_id", "==", matchId]]),
    ]);
    return syncMatchRecords(t, matchId, match, innings, now);
  });
}

const PLAYER_MATCH_MATCH_FIELDS = [
  "tournament_id",
  "club_id",
  "season_id",
  "scheduled_at",
] as const;

/**
 * Server write hook: rebuild a match's player records when a builder write
 * completes / reopens one of its innings or changes the match fields they
 * copy.
 */
export async function syncPlayerMatchesAfterWrite(
  ds: DataSource,
  event: WriteEvent,
): Promise<void> {
  if (event.table === "matches" && event.op === "delete" && event.before) {
    await rebuildPlayerMatches(ds, event.before.id);
    return;
  }
  if (event.op !== "update" || !event.before || !event.after) return;
  if (event.table === "innings") {
    if (
      Boolean(event.before.is_completed) !==
        Boolean(event.after.is_completed) &&
      typeof event.after.match_id === "string"
    ) {
      await rebuildPlayerMatches(ds, event.after.match_id);
    }
  } else if (event.table === "matches") {
    const before = event.before;
    const after = event.after;
    if (
      PLAYER_MATCH_MATCH_FIELDS.some(
        (f) => (before[f] ?? null) !== (after[f] ?? null),
      )
    ) {
      await rebuildPlayerMatches(ds, after.id);
    }
  }
}

function replaceDeep(value: unknown, oldId: string, newId: string): unknown {
  if (value === oldId) return newId;
  if (Array.isArray(value))
    return value.map((v) => replaceDeep(v, oldId, newId));
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value))
      out[k] = replaceDeep(v, oldId, newId);
    return out;
  }
  return value;
}

/**
 * Rewrites `oldId` to `newId` inside the scorecards of every match the
 * player has a record in or whose teams they belong to. Run before the
 * top-level references (team_players) move.
 */
export async function remapScorecardUserId(
  ds: DataSource,
  oldId: string,
  newId: string,
): Promise<void> {
  if (oldId === newId) return;
  const [records, memberships] = await Promise.all([
    ds.query(PLAYER_MATCHES_COLLECTION, [
      { field: "user_id", op: "==", value: oldId },
    ]),
    ds.query("team_players", [{ field: "user_id", op: "==", value: oldId }]),
  ]);
  const matchIds = new Set(records.map((r) => String(r.match_id)));
  const teamIds = Array.from(
    new Set(
      memberships
        .map((m) => m.team_id)
        .filter((t): t is string => typeof t === "string"),
    ),
  );
  for (const group of chunk(teamIds, IN_CHUNK_SIZE)) {
    for (const field of ["team1_id", "team2_id"]) {
      const matches = await ds.query("matches", [
        { field, op: "in", value: group },
      ]);
      for (const m of matches) matchIds.add(m.id);
    }
  }

  for (const matchId of matchIds) {
    const [innings, overs] = await Promise.all([
      ds.query("innings", [{ field: "match_id", op: "==", value: matchId }]),
      ds.query(OVERS_COLLECTION, [
        { field: "match_id", op: "==", value: matchId },
      ]),
    ]);
    let touched = false;
    for (const inn of innings) {
      const patch: Record<string, unknown> = {};
      for (const field of SCORECARD_FIELDS) {
        if (!(field in inn)) continue;
        const next = replaceDeep(inn[field], oldId, newId);
        if (JSON.stringify(next) !== JSON.stringify(inn[field]))
          patch[field] = next;
      }
      if (Object.keys(patch).length) {
        await ds.update("innings", inn.id, patch);
        touched = true;
      }
    }
    for (const over of overs) {
      const balls = replaceDeep(over.balls, oldId, newId);
      if (JSON.stringify(balls) !== JSON.stringify(over.balls)) {
        await ds.update(OVERS_COLLECTION, over.id, { balls });
      }
    }
    if (touched || records.some((r) => r.match_id === matchId)) {
      await rebuildPlayerMatches(ds, matchId);
    }
  }
}
