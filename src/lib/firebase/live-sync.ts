/**
 * Server-action helpers that keep `live_state/{matchId}` in step with edits
 * made outside the scoring engine. Overlays, the control room and match
 * pages listen to that one document (its `version` is their change signal),
 * so any action that changes what they show should call one of these.
 *
 * Best effort: a failed refresh is logged and never fails the action.
 */

import type { ServerClient } from "./server";

/** Rebuild `live_state/{matchId}` (~15 reads, 1 write). */
export async function refreshLiveState(
  db: ServerClient,
  matchId: string,
): Promise<void> {
  if (typeof db.rpc !== "function") return;
  try {
    const { error } = await db.rpc("refresh_live_state", {
      p_match_id: matchId,
    });
    if (error) console.error("refresh_live_state failed:", error);
  } catch (err) {
    console.error("refresh_live_state failed:", err);
  }
}

/**
 * Refresh every live match that shows the given team or tournament (team
 * logo, tournament name). Usually zero or one match.
 */
export async function refreshLiveMatchesFor(
  db: ServerClient,
  ref: { teamId?: string; tournamentId?: string },
): Promise<void> {
  try {
    const fields: Array<["team1_id" | "team2_id" | "tournament_id", string]> =
      [];
    if (ref.teamId) {
      fields.push(["team1_id", ref.teamId], ["team2_id", ref.teamId]);
    }
    if (ref.tournamentId) fields.push(["tournament_id", ref.tournamentId]);
    const ids = new Set<string>();
    for (const [field, value] of fields) {
      const { data } = await db
        .from("matches")
        .select("id")
        .eq("status", "live")
        .eq(field, value);
      for (const row of (data ?? []) as Array<{ id: string }>) ids.add(row.id);
    }
    for (const id of ids) await refreshLiveState(db, id);
  } catch (err) {
    console.error("refreshLiveMatchesFor failed:", err);
  }
}
