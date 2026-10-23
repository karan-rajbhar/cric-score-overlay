"use server";

import { createServerClient } from "~/lib/firebase/server";
import type { StreamerInviteStatus } from "~/lib/firebase/rpc/streamers";
import { invalidateMatchCache } from "~/lib/match-cache";
import type { MatchScorerUser } from "./mutations";

/**
 * Streamers of a match (`matches.match_streamers`): they run the overlay
 * graphics but cannot score. Match admins add and remove them; the match
 * scorers dialog's Streamers section calls these.
 */

const USER_FIELDS = "id, full_name, avatar_url";

type Db = Awaited<ReturnType<typeof createServerClient>>;

async function signedInAdmin(
  db: Db,
  matchId: string,
): Promise<{ userId: string } | { error: string }> {
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) return { error: "You must be logged in" };
  const { data: isAdmin } = await db.rpc<boolean>("is_match_admin", {
    p_match_id: matchId,
    p_user_id: user.id,
  });
  if (!isAdmin) {
    return { error: "Only this match's scorers can manage its streamers" };
  }
  return { userId: user.id };
}

async function streamerIdsOf(db: Db, matchId: string): Promise<string[] | null> {
  const { data: match } = await db
    .from("matches")
    .select("match_streamers")
    .eq("id", matchId)
    .maybeSingle();
  if (!match) return null;
  return (match.match_streamers ?? []) as string[];
}

async function saveStreamers(db: Db, matchId: string, ids: string[]) {
  const { error } = await db
    .from("matches")
    .update({ match_streamers: ids, updated_at: new Date().toISOString() })
    .eq("id", matchId);
  if (!error) invalidateMatchCache(matchId);
  return error?.message ?? null;
}

export async function getMatchStreamers(
  matchId: string,
): Promise<{ data: MatchScorerUser[]; error: string | null }> {
  try {
    const db = await createServerClient();
    const ids = await streamerIdsOf(db, matchId);
    if (ids === null) return { data: [], error: "Match not found" };
    if (ids.length === 0) return { data: [], error: null };
    const { data: users, error } = await db
      .from("users")
      .select(USER_FIELDS)
      .in("id", ids);
    if (error) return { data: [], error: error.message };
    const byId = new Map(
      (users ?? []).map((u: MatchScorerUser) => [u.id, u]),
    );
    return {
      data: ids
        .map((id) => byId.get(id))
        .filter((u): u is MatchScorerUser => Boolean(u)),
      error: null,
    };
  } catch (err) {
    console.error("getMatchStreamers error:", err);
    return { data: [], error: "Failed to load streamers" };
  }
}

/** Adds a registered user (picked from the search) as a streamer. */
export async function addMatchStreamer(
  matchId: string,
  userId: string,
): Promise<{ success: boolean; error: string | null }> {
  try {
    const db = await createServerClient();
    const auth = await signedInAdmin(db, matchId);
    if ("error" in auth) return { success: false, error: auth.error };

    const { data: target } = await db
      .from("users")
      .select("id, full_name")
      .eq("id", userId)
      .maybeSingle();
    if (!target) return { success: false, error: "Player not found" };

    const { data: match } = await db
      .from("matches")
      .select("created_by, match_admins, match_streamers")
      .eq("id", matchId)
      .maybeSingle();
    if (!match) return { success: false, error: "Match not found" };
    const streamers = (match.match_streamers ?? []) as string[];
    if (
      match.created_by === userId ||
      (match.match_admins ?? []).includes(userId) ||
      streamers.includes(userId)
    ) {
      return {
        success: false,
        error: `${target.full_name} can already run the graphics for this match`,
      };
    }
    const error = await saveStreamers(db, matchId, [...streamers, userId]);
    return { success: !error, error };
  } catch (err) {
    console.error("addMatchStreamer error:", err);
    return { success: false, error: "Failed to add streamer" };
  }
}

export async function removeMatchStreamer(
  matchId: string,
  userId: string,
): Promise<{ success: boolean; error: string | null }> {
  try {
    const db = await createServerClient();
    const auth = await signedInAdmin(db, matchId);
    if ("error" in auth) return { success: false, error: auth.error };
    const ids = await streamerIdsOf(db, matchId);
    if (ids === null) return { success: false, error: "Match not found" };
    if (!ids.includes(userId)) return { success: true, error: null };
    const error = await saveStreamers(
      db,
      matchId,
      ids.filter((id) => id !== userId),
    );
    return { success: !error, error };
  } catch (err) {
    console.error("removeMatchStreamer error:", err);
    return { success: false, error: "Failed to remove streamer" };
  }
}

function inviteMessageFor(status: StreamerInviteStatus, name?: string | null) {
  const who = name || "They";
  switch (status) {
    case "invited":
      return "Invite saved. Send them the message below.";
    case "already_invited":
      return "That email is already invited. You can send the message again.";
    case "added_streamer":
      return `${who} can now run the graphics for this match.`;
    case "already_streamer":
      return `${who} can already run the graphics for this match.`;
  }
}

/**
 * Invites an email to stream the match: an existing user is added at once,
 * anyone else gets a sign-in invite (shared by the caller, no email sent).
 */
export async function inviteMatchStreamer(email: string, matchId: string) {
  const db = await createServerClient();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) return { error: "You must be logged in" };

  const { data, error } = await db.rpc<{
    status: StreamerInviteStatus;
    name?: string | null;
  }>("invite_streamer", { p_email: email, p_match_id: matchId });
  if (error || !data) return { error: error?.message ?? "Invite failed" };

  if (data.status === "added_streamer") invalidateMatchCache(matchId);
  const needsMessage =
    data.status === "invited" || data.status === "already_invited";
  return {
    success: true as const,
    status: data.status,
    message: inviteMessageFor(data.status, data.name),
    shareEmail: needsMessage ? email.trim().toLowerCase() : null,
  };
}
