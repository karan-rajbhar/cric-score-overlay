/**
 * Denormalized scoreboard document: `live_state/{matchId}`.
 *
 * It holds exactly the `live_match_state` row (see `views.ts`) plus
 * `updated_at`, a `version` that increases by one on every write, and
 * `refs`, a small cache (team / tournament ids and player names) that lets
 * the scoring engine rebuild the row inside its transaction without
 * re-reading teams, tournaments and users on every ball.
 *
 * Two more doc-only fields tell viewers what else changed, so they refetch
 * only that: `overs_changed` (ids of the `overs` documents the mutation
 * behind this version wrote or deleted) and `match_rev` (a hash of the
 * match document without its per-ball fields: settings, toss, result,
 * scorers...). `last_change` names the scorer behind the latest ball-log
 * change (record / undo / edit) so concurrent scorers can see each other.
 *
 * Writers:
 * - `record_ball` writes it inside its transaction (fast path).
 * - Other scoring mutations call {@link writeLiveState} after commit.
 * - Server code that changes what the scoreboard shows outside the scoring
 *   engine (match start / complete / abandon, team or match edits) should
 *   call {@link writeLiveState} too. It rebuilds from scratch and refreshes
 *   the cache.
 */

import type { Firestore } from "firebase-admin/firestore";
import type { DataSource } from "./datasource";
import { canonicalJson } from "./derive.mjs";
import { stageFullLiveScorecard } from "./live-scorecard-sync";
import { OVERS_COLLECTION } from "./scorecard";
import type { DocReader, ScoringTx } from "./scoring/tx";
import { runScoringTransaction } from "./scoring/tx";
import type { LiveMatchStateRow, MatchesRow } from "./types";
import {
  composeLiveMatchState,
  liveStateUserIds,
  loadLiveStateParts,
  loadMatchHeader,
  loadNames,
  nameLookup,
  type LiveStateParts,
  type LiveStateTeam,
} from "./views";

export const LIVE_STATE_COLLECTION = "live_state";

export interface LiveStateRefs {
  team1_id: string | null;
  team2_id: string | null;
  winning_team_id: string | null;
  tournament_id: string | null;
  /** Display names of players seen in this match, by user id. */
  names: Record<string, string | null>;
}

/** Who made the latest ball-log change (record / undo / edit), and when. */
export interface LiveStateLastChange {
  uid: string;
  /** Display name at the time (no extra read: from the caller's session). */
  name: string | null;
  /** ISO timestamp. */
  at: string;
}

export type LiveStateDoc = LiveMatchStateRow & {
  /** ISO timestamp of the write. */
  updated_at: string;
  /** Increases by one on every write. */
  version: number;
  refs: LiveStateRefs;
  /** `overs` doc ids written / deleted by the change behind this version. */
  overs_changed: string[];
  /** {@link matchRevOf} the match as of this version. */
  match_rev: string;
  /**
   * The scorer behind the latest `record_ball` / `undo_last_ball` /
   * `update_ball` (kept by other writes), so a scoring screen can tell when
   * someone else is scoring the same match.
   */
  last_change?: LiveStateLastChange | null;
};

/** Match fields that change with every ball (not part of `match_rev`). */
const PER_BALL_MATCH_FIELDS = new Set([
  "id",
  "updated_at",
  "current_over",
  "current_ball",
  "last_ball_seq",
  "recent_client_actions",
  "innings_summary",
]);

/**
 * Short hash of the match document without its per-ball fields: changes
 * when settings, toss, result, scorers, title... change, not on a ball.
 */
export function matchRevOf(match: object): string {
  const fields: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(match)) {
    if (PER_BALL_MATCH_FIELDS.has(k) || v === null || v === undefined) continue;
    fields[k] = v;
  }
  // FNV-1a, 32 bit.
  let h = 0x811c9dc5;
  const text = canonicalJson(fields);
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36);
}

/** Ids of the `overs` documents a transaction has staged writes for. */
export function stagedOverIds(t: ScoringTx): string[] {
  return t
    .pendingWrites()
    .filter((w) => w.table === OVERS_COLLECTION)
    .map((w) => w.id)
    .sort();
}

function refsFor(
  match: MatchesRow,
  names: Record<string, string | null>,
): LiveStateRefs {
  return {
    team1_id: match.team1_id ?? null,
    team2_id: match.team2_id ?? null,
    winning_team_id: match.winning_team_id ?? null,
    tournament_id: match.tournament_id ?? null,
    names,
  };
}

/**
 * Team / tournament fields from the previous live doc when it was built for
 * the same teams and tournament; otherwise read them.
 */
export async function headerFromCache(
  reader: DocReader,
  match: MatchesRow,
  prev: LiveStateDoc | null,
): Promise<{
  teams: Map<string, LiveStateTeam>;
  tournamentName: string | null;
}> {
  const refs = prev?.refs;
  const winner = match.winning_team_id ?? null;
  const cacheOk =
    !!refs &&
    refs.team1_id === match.team1_id &&
    refs.team2_id === match.team2_id &&
    refs.tournament_id === (match.tournament_id ?? null) &&
    (winner === null || winner === match.team1_id || winner === match.team2_id);
  if (!cacheOk || !prev) return loadMatchHeader(reader, match);

  const teams = new Map<string, LiveStateTeam>();
  // A team missing from the previous doc rendered as nulls; keep that.
  teams.set(match.team1_id, {
    name: prev.team1_name ?? null,
    short_name: prev.team1_short_name ?? null,
    logo_url: prev.team1_logo_url ?? null,
  });
  teams.set(match.team2_id, {
    name: prev.team2_name ?? null,
    short_name: prev.team2_short_name ?? null,
    logo_url: prev.team2_logo_url ?? null,
  });
  return { teams, tournamentName: prev.tournament_name ?? null };
}

/**
 * Compose the live row from parts computed inside a scoring transaction and
 * stage the `live_state` write on it. Reads at most the previous live doc
 * plus any player names / team fields not in its cache.
 */
export async function stageLiveState(
  t: ScoringTx,
  parts: Omit<LiveStateParts, "nameOf" | "teams" | "tournamentName">,
  prev: LiveStateDoc | null,
  now: string,
  header?: { teams: Map<string, LiveStateTeam>; tournamentName: string | null },
  preloadedNames?: Record<string, string | null>,
  lastChange?: LiveStateLastChange | null,
): Promise<LiveStateDoc> {
  const head = header ?? (await headerFromCache(t, parts.match, prev));
  const known = prev?.refs?.names ?? {};
  const names =
    preloadedNames ?? (await loadNames(t, liveStateUserIds(parts), known));
  const row = composeLiveMatchState({
    ...parts,
    teams: head.teams,
    tournamentName: head.tournamentName,
    nameOf: nameLookup(names),
  });
  const doc: LiveStateDoc = {
    ...row,
    updated_at: now,
    version: (prev?.version ?? 0) + 1,
    refs: refsFor(parts.match, { ...known, ...names }),
    overs_changed: stagedOverIds(t),
    match_rev: matchRevOf(parts.match),
    last_change: lastChange ?? prev?.last_change ?? null,
  };
  t.put(LIVE_STATE_COLLECTION, parts.match.id, doc);
  return doc;
}

/**
 * Rebuild `live_state/{matchId}` from the stored rows (~15 reads) and write
 * it with the next version. Pass the Admin Firestore to bump the version in
 * a transaction; without it the read-then-write is not isolated.
 *
 * `oversChanged` names the `overs` documents the change being published
 * wrote (scoring mutations pass theirs; nothing else writes overs). The
 * live scorecard is rebuilt from the stored innings in the same
 * transaction (written only when it differs).
 */
export async function writeLiveState(
  ds: DataSource,
  matchId: string,
  db?: Firestore | null,
  oversChanged: string[] = [],
  lastChange?: LiveStateLastChange | null,
): Promise<LiveStateDoc | null> {
  const loaded = await loadLiveStateParts(ds, matchId);
  if (!loaded) return null;
  const row = composeLiveMatchState(loaded.parts);
  const now = new Date().toISOString();
  return runScoringTransaction({ db, ds }, async (t) => {
    const prev = await t.doc<LiveStateDoc>(LIVE_STATE_COLLECTION, matchId);
    const doc: LiveStateDoc = {
      ...row,
      updated_at: now,
      version: (prev?.version ?? 0) + 1,
      refs: refsFor(loaded.parts.match, {
        ...(prev?.refs?.names ?? {}),
        ...loaded.names,
      }),
      overs_changed: [...oversChanged].sort(),
      match_rev: matchRevOf(loaded.parts.match),
      last_change: lastChange ?? prev?.last_change ?? null,
    };
    t.put(LIVE_STATE_COLLECTION, matchId, doc);
    await stageFullLiveScorecard(t, matchId);
    return doc;
  });
}

/**
 * The stored `live_state/{matchId}` (1 read), created on first use for
 * matches that predate it. Returns null when the match does not exist.
 */
export async function ensureLiveState(
  ds: DataSource,
  matchId: string,
  db?: Firestore | null,
): Promise<LiveStateDoc | null> {
  const existing = (await ds.getById(
    LIVE_STATE_COLLECTION,
    matchId,
  )) as unknown as LiveStateDoc | null;
  if (existing) return existing;
  return writeLiveState(ds, matchId, db);
}

/** Strip the doc-only fields to get the `live_match_state` row back. */
export function liveRowOf(doc: LiveStateDoc): LiveMatchStateRow {
  const row: Record<string, unknown> = { ...doc };
  delete row.updated_at;
  delete row.version;
  delete row.refs;
  delete row.overs_changed;
  delete row.match_rev;
  delete row.last_change;
  delete row.id;
  return row as unknown as LiveMatchStateRow;
}
