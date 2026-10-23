/**
 * Rebuilds of the match's derived copies from its stored innings, each in a
 * scoring transaction so it cannot interleave with scoring: for builder
 * writes to innings (the write hook) and documents that predate a copy.
 *
 * Kept apart from `innings-summary.ts` and `live-scorecard-sync.ts`, which
 * the scoring transaction (`scoring/tx.ts`) itself imports: these import
 * the transaction, so living there made an import cycle.
 */

import type { Firestore } from "firebase-admin/firestore";
import type { DataSource } from "./datasource";
import { inningsSummaryOf } from "./derive.mjs";
import { inningsSummaryPatch } from "./innings-summary";
import {
  LIVE_SCORECARD_COLLECTION,
  type LiveScorecardDoc,
} from "./live-scorecard";
import { stageFullLiveScorecard } from "./live-scorecard-sync";
import { runScoringTransaction } from "./scoring/tx";

/** Rebuild one match's `innings_summary` from its innings. */
export async function refreshInningsSummary(
  ds: DataSource,
  matchId: string,
): Promise<void> {
  await runScoringTransaction({ ds }, async (t) => {
    const [match, innings] = await Promise.all([
      t.getById("matches", matchId),
      t.query("innings", [{ field: "match_id", op: "==", value: matchId }]),
    ]);
    if (!match) return;
    const patch = inningsSummaryPatch(match, inningsSummaryOf(innings));
    if (patch) t.patch("matches", matchId, patch);
  });
}

/**
 * Rebuild `live_scorecard/{matchId}` from the stored innings (after builder
 * writes to innings, or to create it for a match that predates it).
 */
export async function refreshLiveScorecard(
  ds: DataSource,
  matchId: string,
  db?: Firestore | null,
): Promise<void> {
  await runScoringTransaction({ ds, db }, (t) =>
    stageFullLiveScorecard(t, matchId),
  );
}

/**
 * The stored doc (1 read), created on first use for live matches that
 * predate it. Null when the match has no innings yet.
 */
export async function ensureLiveScorecard(
  ds: DataSource,
  matchId: string,
  db?: Firestore | null,
): Promise<LiveScorecardDoc | null> {
  const read = async () =>
    (await ds.getById(
      LIVE_SCORECARD_COLLECTION,
      matchId,
    )) as unknown as LiveScorecardDoc | null;
  const existing = await read();
  if (existing) return existing;
  await refreshLiveScorecard(ds, matchId, db);
  return read();
}
