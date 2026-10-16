"use server";

import { revalidatePath } from "next/cache";
import { createServerClient } from "~/lib/firebase/server";
import type { InviteStatus } from "~/lib/firebase/rpc/access";
import { invalidateMatchCache } from "~/lib/match-cache";

function message(status: InviteStatus, name?: string | null): string {
  const who = name || "They";
  switch (status) {
    case "invited":
      return "Invite saved. Send them the message below.";
    case "already_invited":
      return "That email is already invited. You can send the message again.";
    case "already_member":
      return `${who} already ${name ? "has" : "have"} access.`;
    case "added_scorer":
      return `${who} can now score this match.`;
    case "already_scorer":
      return `${who} can already score this match.`;
  }
}

/**
 * Invites an email to CricScore. Any signed-in user may invite. With
 * `matchId`, the invitee also becomes a scorer for that match.
 */
export async function inviteToApp(email: string, matchId?: string) {
  const db = await createServerClient();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) return { error: "You must be logged in" };

  const { data, error } = await db.rpc("invite_email", {
    p_email: email,
    p_match_id: matchId ?? null,
  });
  if (error) return { error: error.message };

  const { status, name } = data as { status: InviteStatus; name?: string };
  if (matchId && status === "added_scorer") {
    invalidateMatchCache(matchId);
    revalidatePath(`/matches/${matchId}`);
    revalidatePath(`/matches/${matchId}/score`);
  }
  const needsMessage = status === "invited" || status === "already_invited";
  return {
    success: true,
    status,
    message: message(status, name),
    // Only people without access yet need a message to sign in.
    shareEmail: needsMessage ? email.trim().toLowerCase() : null,
  };
}
