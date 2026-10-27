"use server";

import { revalidatePath } from "next/cache";
import { isClubSide } from "~/lib/firebase/derive.mjs";
import { refreshLiveState } from "~/lib/firebase/live-sync";
import { canSetMatchClub, clubRoleOf } from "~/lib/firebase/permissions";
import { createServerClient } from "~/lib/firebase/server";
import type { ClubSide } from "~/lib/firebase/types";
import { invalidateMatchCache } from "~/lib/match-cache";

/**
 * Puts a match into a club (or another club, or none) after it was
 * created, with the side(s) whose players count for that club. Allowed for
 * the club's admins and for its members who score the match; leaving a
 * club needs the same of the club it leaves. A tournament match belongs to
 * its tournament's club. The write hooks move the match's player records,
 * the club leaderboards and the milestone totals with it.
 */
export async function setMatchClub(
  matchId: string,
  clubId: string | null,
  clubSide: ClubSide,
): Promise<{ error: string | null }> {
  if (!isClubSide(clubSide)) {
    return { error: "Choose whose stats count for the club" };
  }
  const db = await createServerClient();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) return { error: "You must be logged in" };

  const { data: match } = await db
    .from("matches")
    .select("id, club_id, club_side, tournament_id")
    .eq("id", matchId)
    .maybeSingle();
  if (!match) return { error: "Match not found" };
  if (match.tournament_id) {
    return { error: "A tournament match counts for the tournament's club" };
  }

  const side = clubId && clubSide !== "both" ? clubSide : null;
  const current = match.club_id ?? null;
  if (current === clubId && (match.club_side ?? null) === side) {
    return { error: null };
  }

  const { data: isAdmin } = await db.rpc<boolean>("is_match_admin", {
    p_match_id: matchId,
  });
  const clubs = [...new Set([current, clubId])].filter(
    (id): id is string => !!id,
  );
  const roles = await Promise.all(
    clubs.map((id) => clubRoleOf(db, id, user.id)),
  );
  if (!roles.every((role) => canSetMatchClub(role, isAdmin === true))) {
    return {
      error:
        "Only the club's admins, or members who score this match, can change its club",
    };
  }

  const { error } = await db
    .from("matches")
    .update({
      club_id: clubId,
      club_side: side,
      updated_at: new Date().toISOString(),
    })
    .eq("id", matchId);
  if (error) return { error: error.message };

  // Viewers of the match page follow live_state.match_rev.
  await refreshLiveState(db, matchId);
  invalidateMatchCache(matchId);
  revalidatePath(`/matches/${matchId}`);
  for (const id of clubs) revalidatePath(`/clubs/${id}`);
  return { error: null };
}
