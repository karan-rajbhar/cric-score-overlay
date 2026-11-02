/**
 * Server-action helpers that keep `live_state/{matchId}` in step with edits
 * made outside the scoring engine. Overlays, the control room and match
 * pages listen to that one document (its `version` is their change signal),
 * so any action that changes what they show should call one of these.
 *
 * Best effort: a failed refresh is logged and never fails the action.
 */

import type { ServerClient } from "./server";

/** Rebuild `live_state/{matchId}` (~25 reads a live match, 2 writes). */
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

/** The live matches that show the given team or tournament. */
async function liveMatchIdsFor(
  db: ServerClient,
  ref: { teamId?: string; tournamentId?: string },
): Promise<Set<string>> {
  const fields: Array<["team1_id" | "team2_id" | "tournament_id", string]> = [];
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
  return ids;
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
    for (const id of await liveMatchIdsFor(db, ref)) {
      await refreshLiveState(db, id);
    }
  } catch (err) {
    console.error("refreshLiveMatchesFor failed:", err);
  }
}

/**
 * A team's squad changed: tell the viewers of its live matches. The
 * scoreboard shows no squad, so nothing is rebuilt (`bumpLiveState`).
 * `matchId`: changed from that match's scoring screen, so it needs no
 * looking up; a squad changes there as players arrive, often many times in a
 * match.
 */
export async function notifySquadChanged(
  db: ServerClient,
  ref: { teamId: string; matchId?: string | null },
): Promise<void> {
  try {
    const ids = ref.matchId
      ? [ref.matchId]
      : await liveMatchIdsFor(db, { teamId: ref.teamId });
    for (const id of ids) {
      const { error } = await db.rpc("bump_live_state", { p_match_id: id });
      if (error) console.error("bump_live_state failed:", error);
    }
  } catch (err) {
    console.error("notifySquadChanged failed:", err);
  }
}
