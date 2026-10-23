/**
 * Streamers: people who run a match's overlay graphics (control room,
 * Stream Deck, stream channels) but cannot score. They are listed in
 * `matches.match_streamers` and checked by `canProduceOverlay`; they are
 * never match admins.
 *
 * Someone not on CricScore yet is invited like a scorer: a pending app
 * invite whose `streamer_match_ids` make them a streamer on first sign-in
 * (`acceptInvitations`).
 */

import type { DataSource } from "../datasource";
import { DbQueryError, newId } from "../query-builder";
import type { InvitationsRow, MatchesRow, UsersRow } from "../types";
import { normaliseEmail, userIdsByEmail } from "../user-private";
import { isMatchAdmin } from "./auth-helpers";

export type StreamerInviteStatus =
  | "invited"
  | "already_invited"
  | "added_streamer"
  | "already_streamer";

/** Whether `userId` may already run this match's graphics. */
function producesAlready(match: MatchesRow, userId: string): boolean {
  return (
    match.created_by === userId ||
    (match.match_admins ?? []).includes(userId) ||
    (match.match_streamers ?? []).includes(userId)
  );
}

/**
 * Adds `userId` to a match's streamers (no-op for its creator, scorers and
 * existing streamers). No permission check: callers check the inviter.
 */
export async function addStreamerToMatch(
  ds: DataSource,
  matchId: string,
  userId: string,
): Promise<"added" | "already" | "missing"> {
  const match = (await ds.getById(
    "matches",
    matchId,
  )) as unknown as MatchesRow | null;
  if (!match) return "missing";
  if (producesAlready(match, userId)) return "already";
  await ds.update("matches", matchId, {
    match_streamers: [...(match.match_streamers ?? []), userId],
    updated_at: new Date().toISOString(),
  });
  return "added";
}

/**
 * Invites an email to stream a match. The caller must be an admin of the
 * match. An existing user becomes a streamer at once; anyone else gets a
 * pending app invite (or their pending one gains the match) and becomes a
 * streamer when they first sign in.
 */
export async function inviteStreamerEmail(
  ds: DataSource,
  callerId: string | null,
  rawEmail: string,
  matchId: string,
): Promise<{ status: StreamerInviteStatus; name?: string | null }> {
  if (!callerId || !(await ds.getById("users", callerId))) {
    throw new DbQueryError("Authentication required", "42501");
  }
  const email = normaliseEmail(rawEmail);
  if (!email) throw new DbQueryError("Enter a valid email address", "22023");
  if (!(await isMatchAdmin(ds, matchId, callerId))) {
    throw new DbQueryError(
      "Only this match's scorers can invite streamers",
      "42501",
    );
  }

  const [memberId] = await userIdsByEmail(ds, email);
  const member = memberId
    ? ((await ds.getById("users", memberId)) as unknown as UsersRow | null)
    : null;
  if (member) {
    const result = await addStreamerToMatch(ds, matchId, member.id);
    return {
      status: result === "added" ? "added_streamer" : "already_streamer",
      name: member.full_name,
    };
  }

  const now = new Date().toISOString();
  const pending = (
    (await ds.query("invitations", [
      { field: "email", op: "==", value: email },
    ])) as unknown as InvitationsRow[]
  ).find((i) => i.status === "pending");
  if (pending) {
    const matchIds = pending.streamer_match_ids ?? [];
    if (!matchIds.includes(matchId)) {
      await ds.update("invitations", pending.id, {
        streamer_match_ids: [...matchIds, matchId],
        updated_at: now,
      });
    }
    return { status: "already_invited" };
  }

  await ds.insert("invitations", [
    {
      id: newId(),
      email,
      invited_by: callerId,
      status: "pending",
      accepted_by: null,
      scorer_match_ids: [],
      streamer_match_ids: [matchId],
      created_at: now,
      updated_at: now,
    },
  ]);
  return { status: "invited" };
}
