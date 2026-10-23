/**
 * `delete_match`: remove a match and everything it owns, and take it out
 * of every statistic built from it.
 *
 * Order (the match document goes last, so it marks an unfinished delete
 * and a retry redoes every step; each step is idempotent):
 *
 * 1. Permission and typed-name checks ({@link canDeleteMatch}, stricter
 *    than scoring: co-scorers in `match_admins` may not delete).
 * 2. Tournament points table recomputed without the match.
 * 3. Owned documents: every `overs` doc, the `innings` docs, the match's
 *    Stream Deck tokens (`producer_tokens`), and the id removed from
 *    `invitations.scorer_match_ids` / `streamer_match_ids` (invites stay)
 *    and from the stream channels showing it (`stream_channels.match_id`,
 *    off air). Equality / array-contains queries on one field: as many
 *    reads as documents found. Deleted in batches of at most
 *    {@link BATCH_LIMIT}, without write hooks.
 * 4. One transaction: `player_matches` removed and the statistics moved
 *    with them (`syncMatchRecords` with no match: career stats and the
 *    club / tournament leaderboard shards change by exactly those records),
 *    `live_state`, `live_scorecard` and `overlay_state` deleted, then the
 *    match document.
 *
 * Running it for a match that is already gone
 * clears any leftovers (steps 3-4) and reports `already_deleted`.
 */

import type { Firestore } from "firebase-admin/firestore";
import { confirmsMatchDelete } from "../../match-delete";
import { OVERLAY_STATE_COLLECTION } from "../../overlay-state";
import type { DataSource } from "../datasource";
import { LIVE_SCORECARD_COLLECTION } from "../live-scorecard";
import { DbQueryError } from "../query-builder";
import { OVERS_COLLECTION } from "../scorecard";
import { firestoreOf, runScoringTransaction } from "../scoring/tx";
import { syncMatchRecords } from "../stats-sync";
import type { MatchesRow } from "../types";
import { canDeleteMatch } from "./auth-helpers";
import { recalculateTournamentStandings } from "./standings";
import { chunk, IN_CHUNK_SIZE } from "../datasource";

const LIVE_STATE_COLLECTION = "live_state";
/** Mirrors `PRODUCER_TOKENS` / `STREAM_CHANNELS` in `~/lib/overlay`. */
const PRODUCER_TOKENS = "producer_tokens";
const STREAM_CHANNELS = "stream_channels";

/** Writes per batch (Firestore allows 500; leave headroom). */
export const BATCH_LIMIT = 400;

export interface DeleteMatchContext {
  ds: DataSource;
  db?: Firestore | null;
  uid: string | null;
}

export interface DeleteMatchResult {
  match_id: string;
  already_deleted: boolean;
  tournament_id: string | null;
  club_id: string | null;
  removed: {
    innings: number;
    overs: number;
    player_matches: number;
    invitations_updated: number;
  };
}

interface DocRef {
  table: string;
  id: string;
}

/** Delete documents in batches of at most {@link BATCH_LIMIT}, no hooks. */
async function deleteInBatches(
  ds: DataSource,
  db: Firestore | null,
  refs: DocRef[],
): Promise<void> {
  for (const group of chunk(refs, BATCH_LIMIT)) {
    if (db) {
      const batch = db.batch();
      for (const r of group) batch.delete(db.collection(r.table).doc(r.id));
      await batch.commit();
    } else {
      for (const r of group) await ds.delete(r.table, r.id);
    }
  }
}

/** Steps 3 and 4 (everything after the checks and the points table). */
async function purge(
  ctx: DeleteMatchContext,
  matchId: string,
  matchExists: boolean,
): Promise<DeleteMatchResult["removed"]> {
  const { ds } = ctx;
  const db = ctx.db ?? firestoreOf(ds);

  const innings = await ds.query("innings", [
    { field: "match_id", op: "==", value: matchId },
  ]);
  const overIds = new Set(
    (
      await ds.query(OVERS_COLLECTION, [
        { field: "match_id", op: "==", value: matchId },
      ])
    ).map((o) => o.id),
  );
  // Over docs keyed by innings only (older writes) are found by innings id.
  for (const ids of chunk(
    innings.map((i) => i.id),
    IN_CHUNK_SIZE,
  )) {
    const docs = await ds.query(OVERS_COLLECTION, [
      { field: "innings_id", op: "in", value: ids },
    ]);
    for (const o of docs) overIds.add(o.id);
  }
  const tokens = await ds.query(PRODUCER_TOKENS, [
    { field: "match_id", op: "==", value: matchId },
  ]);
  await deleteInBatches(ds, db, [
    ...[...overIds].map((id) => ({ table: OVERS_COLLECTION, id })),
    ...innings.map((i) => ({ table: "innings", id: i.id })),
    ...tokens.map((t) => ({ table: PRODUCER_TOKENS, id: t.id })),
  ]);

  let invitationsUpdated = 0;
  for (const field of ["scorer_match_ids", "streamer_match_ids"] as const) {
    const invites = await ds.query("invitations", [
      { field, op: "array-contains", value: matchId },
    ]);
    for (const invite of invites) {
      const ids = Array.isArray(invite[field])
        ? (invite[field] as unknown[])
        : [];
      await ds.update("invitations", invite.id, {
        [field]: ids.filter((id) => id !== matchId),
      });
      invitationsUpdated += 1;
    }
  }

  // Channels showing the match go off air (their overlay goes blank).
  const channels = await ds.query(STREAM_CHANNELS, [
    { field: "match_id", op: "==", value: matchId },
  ]);
  for (const channel of channels) {
    await ds.update(STREAM_CHANNELS, channel.id, {
      match_id: null,
      updated_at: new Date().toISOString(),
    });
  }

  const now = new Date().toISOString();
  const records = await runScoringTransaction({ ds, db }, async (t) => {
    const out = await syncMatchRecords(t, matchId, null, [], now);
    t.delete(LIVE_STATE_COLLECTION, matchId);
    t.delete(LIVE_SCORECARD_COLLECTION, matchId);
    t.delete(OVERLAY_STATE_COLLECTION, matchId);
    if (matchExists) t.delete("matches", matchId);
    return out;
  });

  return {
    innings: innings.length,
    overs: overIds.size,
    player_matches: records.deleted,
    invitations_updated: invitationsUpdated,
  };
}

export async function deleteMatch(
  ctx: DeleteMatchContext,
  matchId: string,
  confirmTitle: string,
): Promise<DeleteMatchResult> {
  if (!ctx.uid) throw new DbQueryError("not_authorized", "42501");
  const match = (await ctx.ds.getById(
    "matches",
    matchId,
  )) as unknown as MatchesRow | null;

  if (!match) {
    // Already deleted (or never existed): clear anything a run that was
    // cut short left behind. Nothing here belongs to a live match.
    const removed = await purge(ctx, matchId, false);
    return {
      match_id: matchId,
      already_deleted: true,
      tournament_id: null,
      club_id: null,
      removed,
    };
  }

  if (!(await canDeleteMatch(ctx.ds, matchId, ctx.uid, match))) {
    throw new DbQueryError("not_authorized", "42501");
  }
  if (!confirmsMatchDelete(confirmTitle, match.title)) {
    throw new DbQueryError("confirm_title_mismatch", "22000");
  }

  if (match.tournament_id) {
    await recalculateTournamentStandings(ctx.ds, match.tournament_id, {
      excludeMatchId: matchId,
    });
  }
  const removed = await purge(ctx, matchId, true);
  return {
    match_id: matchId,
    already_deleted: false,
    tournament_id: match.tournament_id ?? null,
    club_id: match.club_id ?? null,
    removed,
  };
}
