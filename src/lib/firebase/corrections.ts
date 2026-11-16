/**
 * The corrections history of a match (docs/scoring-corrections.md, 2.2):
 * one `corrections/{id}` document per correction a scorer makes (Edit ball,
 * the batters' ends, an over's bowler, someone else batting from a ball,
 * Replace, swapping two players, an undo), written in the correction's own
 * transaction. Server-only (no rule: rules deny by default); read through
 * `rpc("match_corrections")` when a scorer opens the history; deleted with
 * the match.
 */

import type { CorrectedEntry, CorrectionNote } from "~/lib/scoring-correction";
import type { DataSource } from "./datasource";
import { newId } from "./query-builder";
import type { ScoringTx } from "./scoring/tx";

export const CORRECTIONS_COLLECTION = "corrections";

/** How many corrections the history lists (the latest). */
export const CORRECTIONS_LISTED = 20;

export interface CorrectionDoc {
  match_id: string;
  /** The innings whose ball log it changed (null: several, or none). */
  innings_id: string | null;
  /** ISO timestamp. */
  at: string;
  by_uid: string | null;
  by_name: string | null;
  note: CorrectionNote;
  /** The ball-log entries it changed, with each changed field before and after. */
  entries: CorrectedEntry[];
  /** Set once undone. */
  undone_at?: string | null;
  undone_by_name?: string | null;
  /** On an undo: the correction it undid. */
  undo_of?: string | null;
}

/** Stages a history document in `t`; returns its id. */
export function stageCorrection(t: ScoringTx, doc: CorrectionDoc): string {
  const id = newId();
  t.put(CORRECTIONS_COLLECTION, id, doc as unknown as Record<string, unknown>);
  return id;
}

/** The match's latest corrections, newest first (one indexed query). */
export async function listCorrections(
  ds: DataSource,
  matchId: string,
  limit = CORRECTIONS_LISTED,
): Promise<Array<CorrectionDoc & { id: string }>> {
  const rows = await ds.query(
    CORRECTIONS_COLLECTION,
    [{ field: "match_id", op: "==", value: matchId }],
    { orderBy: [{ field: "at", direction: "desc" }], limit },
  );
  return rows as unknown as Array<CorrectionDoc & { id: string }>;
}
