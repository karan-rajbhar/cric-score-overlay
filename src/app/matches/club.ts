"use server";

import { revalidatePath } from "next/cache";
import { isClubSide } from "~/lib/firebase/derive.mjs";
import { refreshLiveState } from "~/lib/firebase/live-sync";
import { canSetMatchClub, clubRoleOf } from "~/lib/firebase/permissions";
import { createServerClient } from "~/lib/firebase/server";
import type { ServerClient } from "~/lib/firebase/server-client";
import type { ClubSide } from "~/lib/firebase/types";
import { invalidateMatchCache } from "~/lib/match-cache";

/** Why the user may not move the match from `current` to `clubId`, or null. */
async function refusalOf(
  db: ServerClient,
  matchId: string,
  userId: string,
  current: string | null,
  clubId: string | null,
): Promise<string | null> {
  const { data: canDelete } = await db.rpc<boolean>("can_delete_match", {
    p_match_id: matchId,
  });
  if (canDelete !== true) {
    return "Only the match's creator or its club's admins can change its club";
  }
  const joining =
    clubId && clubId !== current
      ? await clubRoleOf(db, clubId, userId)
      : undefined;
  return canSetMatchClub(true, joining)
    ? null
    : "You can move a match only into a club you belong to";
}

/**
 * Puts a match into a club (or another club, or none) after it was
 * created, with the side(s) whose players count for that club. Being in a
 * club lets its admins score and delete the match, so this needs the right
 * to delete it already (its creator, or an admin of the club it is in) and,
 * to move it into a club, a place in that club (`canSetMatchClub`). A
 * tournament match belongs to its tournament's club. The write hooks move
 * the match's player records, the club leaderboards and the milestone
 * totals with it.
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

  const refused = await refusalOf(db, matchId, user.id, current, clubId);
  if (refused) return { error: refused };
  const clubs = [...new Set([current, clubId])].filter(
    (id): id is string => !!id,
  );

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
