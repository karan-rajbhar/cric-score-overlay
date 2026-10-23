/**
 * Ball-log archive: `ball_logs/{inningsId}` holds every over of a completed
 * innings in one document, so the ball log of a finished match (Balls /
 * Stats tabs, the report) costs a read per innings instead of one per over
 * (~45 reads for a T20 before, ~7 now).
 *
 * - Built only by the server: `matchBallLog` (`match-ball-log.ts`, the
 *   `match_ball_log` rpc
 *      behind `getMatchBallLog`) archives a completed innings the first time
 *   its log is read, in a transaction over the innings and its overs, so a
 *   concurrent edit cannot leave a stale copy. Never from the browser.
 * - Dropped by every scoring transaction that writes an over of an innings
 *   that was already completed (undo, ball edits, retirements, penalties,
 *   replace-batter, recompute: `stageBallLogInvalidations`, run last before
 *   commit) or deletes the innings, and by `delete_match`. Live innings are
 *   never archived, so a delivery costs nothing more.
 * - Checked on read against the innings (`ballLogStamp`): an archive whose
 *   innings changed since (a script that rewrote it, say) is rebuilt.
 *   Anything that rewrites a completed innings' overs outside a scoring
 *   transaction should delete `ball_logs/{inningsId}` too.
 */

import { canonicalJson } from "./derive.mjs";
import type { Doc } from "./datasource";
import { OVERS_COLLECTION, type OversRow } from "./scorecard";
import type { ScoringTx } from "./scoring/tx";

export const BALL_LOGS_COLLECTION = "ball_logs";

export interface BallLogDoc {
  match_id: string;
  innings_id: string;
  /** {@link ballLogStamp} of the innings it was built from. */
  stamp: string;
  /** The innings' over documents (number and balls), in over order. */
  overs: Array<Pick<OversRow, "over_number" | "balls">>;
  built_at: string;
}

export type InningsDoc = Doc & {
  match_id?: string | null;
  innings_number?: number | null;
  team_id?: string | null;
  is_completed?: boolean | null;
};

/** What an archive must still match on its innings to be used. */
export function ballLogStamp(innings: Record<string, unknown>): string {
  return canonicalJson({
    is_completed: innings.is_completed ?? null,
    total_balls: innings.total_balls ?? null,
    total_runs: innings.total_runs ?? null,
    total_wickets: innings.total_wickets ?? null,
    extras_total: innings.extras_total ?? null,
    last_ball_seq: innings.last_ball_seq ?? null,
    updated_at: innings.updated_at ?? null,
  });
}

/** The innings id an over document belongs to. */
function inningsOfOver(id: string, data?: Record<string, unknown>): string {
  if (data && typeof data.innings_id === "string") return data.innings_id;
  const cut = id.lastIndexOf("_");
  return cut > 0 ? id.slice(0, cut) : id;
}

/**
 * Drop the archive of every innings whose ball log this transaction
 * changes once it is completed: an over written while the innings (as
 * stored) was completed, or not read here, or the innings deleted. Blind
 * deletes (no read).
 */
export function stageBallLogInvalidations(t: ScoringTx): void {
  const stale = new Set<string>();
  for (const w of t.pendingWrites()) {
    if (w.table === "innings" && w.kind === "delete") stale.add(w.id);
    if (w.table !== OVERS_COLLECTION) continue;
    const inningsId = inningsOfOver(
      w.id,
      w.kind === "delete" ? undefined : (w.data as Record<string, unknown>),
    );
    const stored = t.known<InningsDoc>("innings", inningsId);
    if (!stored || stored.is_completed === true) stale.add(inningsId);
  }
  for (const id of stale) t.delete(BALL_LOGS_COLLECTION, id);
}
