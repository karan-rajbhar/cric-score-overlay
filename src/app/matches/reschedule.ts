"use server";

import { revalidatePath } from "next/cache";
import { createServerClient } from "~/lib/firebase/server";
import { refreshLiveState } from "~/lib/firebase/live-sync";
import { invalidateMatchCache } from "~/lib/match-cache";

export interface RescheduleInput {
  /** The new start, an ISO timestamp (the browser converts local time). */
  scheduledAt: string;
  venue?: string | null;
  umpire1Name?: string | null;
  umpire2Name?: string | null;
}

const clean = (v?: string | null) => (v ?? "").trim() || null;

/**
 * Moves a match that has not started: its date and time, venue and
 * umpires. Allowed for the match's organisers, the same people who may
 * delete it (its creator, an admin of its club, its tournament's
 * organisers); co-scorers may not.
 */
export async function rescheduleMatch(
  matchId: string,
  input: RescheduleInput,
): Promise<{ error: string | null }> {
  const db = await createServerClient();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) return { error: "You must be logged in" };

  const when = new Date(input.scheduledAt);
  if (!input.scheduledAt || Number.isNaN(when.getTime())) {
    return { error: "Pick a date and time" };
  }

  const { data: match } = await db
    .from("matches")
    .select("id, status, tournament_id, club_id")
    .eq("id", matchId)
    .maybeSingle();
  if (!match) return { error: "Match not found" };

  const { data: allowed } = await db.rpc("can_delete_match", {
    p_match_id: matchId,
  });
  if (!allowed) {
    return {
      error:
        "Only the match's creator, its club's admins or its tournament's organisers can reschedule it",
    };
  }
  if (match.status !== "scheduled") {
    return { error: "Only a match that has not started can be rescheduled" };
  }

  const { error } = await db
    .from("matches")
    .update({
      scheduled_at: when.toISOString(),
      venue: clean(input.venue),
      umpire1_name: clean(input.umpire1Name),
      umpire2_name: clean(input.umpire2Name),
      updated_at: new Date().toISOString(),
    })
    .eq("id", matchId);
  if (error) return { error: error.message };

  // Viewers of the match page follow live_state.match_rev.
  await refreshLiveState(db, matchId);
  invalidateMatchCache(matchId);
  revalidatePath(`/matches/${matchId}`);
  revalidatePath("/matches");
  if (match.tournament_id) revalidatePath(`/tournaments/${match.tournament_id}`);
  if (match.club_id) revalidatePath(`/clubs/${match.club_id}`);
  return { error: null };
}
