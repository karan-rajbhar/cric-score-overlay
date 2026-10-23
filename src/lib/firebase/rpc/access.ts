/**
 * Invite-only access. A Google account may get a session when it already has
 * a profile, its email is on the ALLOWED_EMAILS bootstrap list, or someone
 * invited that email (app invite or a pending club invite). Only pending
 * invites count: accepted ones are used up and revoked ones are withdrawn.
 */

import type { AppUser } from "../auth-types";
import type { DataSource, Doc } from "../datasource";
import { DbQueryError, newId } from "../query-builder";
import { derivedFieldsDataSource } from "../derived-fields";
import type {
  ClubInvitationsRow,
  ClubMembershipsRow,
  InvitationsRow,
  MatchesRow,
  UsersRow,
} from "../types";
import { normaliseEmail, userIdsByEmail } from "../user-private";
import { isMatchAdmin } from "./auth-helpers";
import { addStreamerToMatch } from "./streamers";

/** Comma-separated emails that may always sign in (the first admins). */
export function allowedEmails(): Set<string> {
  return new Set(
    (process.env.ALLOWED_EMAILS ?? "")
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean),
  );
}

/**
 * `emailVerified` must be true for email-based matches, so an unverified
 * address cannot claim someone else's invite or profile. `profile` is the
 * account's `users` document when the caller has read it already.
 */
export async function canSignIn(
  ds: DataSource,
  user: AppUser,
  emailVerified: boolean,
  profile?: Doc | null,
): Promise<boolean> {
  const own =
    profile === undefined ? await ds.getById("users", user.id) : profile;
  if (own) return true;

  const email = emailVerified ? normaliseEmail(user.email) : null;
  if (!email) return false;
  if (allowedEmails().has(email)) return true;

  // A profile created ahead of sign-up (seeded, placeholder) with this email.
  if ((await userIdsByEmail(ds, email)).length > 0) return true;

  const byEmail = [{ field: "email", op: "==" as const, value: email }];
  const invites = (await ds.query(
    "invitations",
    byEmail,
  )) as unknown as InvitationsRow[];
  if (invites.some((i) => i.status === "pending")) return true;

  const clubInvites = (await ds.query(
    "club_invitations",
    byEmail,
  )) as unknown as ClubInvitationsRow[];
  return clubInvites.some((i) => isOpenClubInvite(i));
}

/** Adds `userId` to a match's scorers (no-op if already one). */
async function addScorer(
  ds: DataSource,
  matchId: string,
  userId: string,
): Promise<void> {
  const match = (await ds.getById(
    "matches",
    matchId,
  )) as unknown as MatchesRow | null;
  if (!match) return;
  const admins = match.match_admins ?? [];
  if (match.created_by === userId || admins.includes(userId)) return;
  await ds.update("matches", matchId, {
    match_admins: [...admins, userId],
    updated_at: new Date().toISOString(),
  });
}

/** A club invite that still lets its email in: pending and not expired. */
export function isOpenClubInvite(
  invite: Pick<ClubInvitationsRow, "status" | "expires_at">,
  now = Date.now(),
): boolean {
  return (
    invite.status === "pending" &&
    (!invite.expires_at || new Date(invite.expires_at).getTime() > now)
  );
}

/**
 * Makes `uid` an active member of every club whose open invite names this
 * email, and marks those invites accepted. A membership the user already
 * has keeps its role (a left one is reactivated).
 */
async function acceptClubInvitations(
  ds: DataSource,
  email: string,
  uid: string,
): Promise<void> {
  const invites = (await ds.query("club_invitations", [
    { field: "email", op: "==", value: email },
  ])) as unknown as ClubInvitationsRow[];
  const open = invites.filter((i) => isOpenClubInvite(i) && i.club_id);
  if (open.length === 0) return;
  // Memberships carry the member's name snapshot (derived on write).
  const dds = derivedFieldsDataSource(ds);
  const now = new Date().toISOString();
  for (const invite of open) {
    const [existing] = (await ds.query("club_memberships", [
      { field: "club_id", op: "==", value: invite.club_id },
      { field: "user_id", op: "==", value: uid },
    ])) as unknown as ClubMembershipsRow[];
    if (!existing) {
      await dds.insert("club_memberships", [
        {
          id: newId(),
          club_id: invite.club_id,
          user_id: uid,
          role: "member",
          status: "active",
          joined_at: now,
          updated_at: now,
        },
      ]);
    } else if (existing.status !== "active") {
      await dds.update("club_memberships", existing.id, {
        status: "active",
        updated_at: now,
      });
    }
    await ds.update("club_invitations", invite.id, {
      status: "accepted",
      user_id: uid,
      updated_at: now,
    });
  }
}

/**
 * Marks the email's pending app invites as used by `uid`, makes them a
 * scorer for any matches they were invited to score (and a streamer for any
 * they were invited to stream), and a member of any club that invited them.
 */
export async function acceptInvitations(
  ds: DataSource,
  email: string | null,
  uid: string,
): Promise<void> {
  const clean = normaliseEmail(email);
  if (!clean) return;
  await acceptClubInvitations(ds, clean, uid);
  const invites = (await ds.query("invitations", [
    { field: "email", op: "==", value: clean },
  ])) as unknown as InvitationsRow[];
  const now = new Date().toISOString();
  for (const invite of invites.filter((i) => i.status === "pending")) {
    for (const matchId of invite.scorer_match_ids ?? []) {
      await addScorer(ds, matchId, uid);
    }
    // Streamer invites (overlay graphics only, see ./streamers).
    for (const matchId of invite.streamer_match_ids ?? []) {
      await addStreamerToMatch(ds, matchId, uid);
    }
    await ds.update("invitations", invite.id, {
      status: "accepted",
      accepted_by: uid,
      updated_at: now,
    });
  }
}

export type InviteStatus =
  | "invited"
  | "already_invited"
  | "already_member"
  | "added_scorer"
  | "already_scorer";

/**
 * Lets an existing user invite an email. Idempotent: inviting the same
 * email twice keeps one pending invite.
 *
 * With `matchId` the caller must be able to score that match, and the
 * invitee becomes a scorer: immediately if they already have access,
 * otherwise on their first sign-in.
 */
export async function inviteEmail(
  ds: DataSource,
  callerId: string | null,
  rawEmail: string,
  matchId?: string | null,
): Promise<{ status: InviteStatus; name?: string | null }> {
  if (!callerId || !(await ds.getById("users", callerId))) {
    throw new DbQueryError("Authentication required", "42501");
  }
  const email = normaliseEmail(rawEmail);
  if (!email) throw new DbQueryError("Enter a valid email address", "22023");
  if (matchId && !(await isMatchAdmin(ds, matchId, callerId))) {
    throw new DbQueryError(
      "Only this match's scorers can invite scorers",
      "42501",
    );
  }

  const byEmail = [{ field: "email", op: "==" as const, value: email }];
  const [memberId] = await userIdsByEmail(ds, email);
  const member = memberId
    ? ((await ds.getById("users", memberId)) as unknown as UsersRow | null)
    : null;
  if (member) {
    if (!matchId) return { status: "already_member", name: member.full_name };
    const match = (await ds.getById(
      "matches",
      matchId,
    )) as unknown as MatchesRow | null;
    const already =
      match?.created_by === member.id ||
      (match?.match_admins ?? []).includes(member.id);
    if (!already) await addScorer(ds, matchId, member.id);
    return {
      status: already ? "already_scorer" : "added_scorer",
      name: member.full_name,
    };
  }

  const now = new Date().toISOString();
  const pending = (
    (await ds.query("invitations", byEmail)) as unknown as InvitationsRow[]
  ).find((i) => i.status === "pending");
  if (pending) {
    const matchIds = pending.scorer_match_ids ?? [];
    if (matchId && !matchIds.includes(matchId)) {
      await ds.update("invitations", pending.id, {
        scorer_match_ids: [...matchIds, matchId],
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
      scorer_match_ids: matchId ? [matchId] : [],
      created_at: now,
      updated_at: now,
    },
  ]);
  return { status: "invited" };
}

/**
 * Withdraws a pending app invite so its email can no longer sign in with it
 * (`canSignIn` and `acceptInvitations` only honour pending invites). The
 * inviter may revoke it; so may a scorer of every match the invite would
 * make the invitee a scorer of. Accepted invites cannot be revoked: the
 * person already has a profile.
 */
export async function revokeInvitation(
  ds: DataSource,
  callerId: string | null,
  inviteId: string,
): Promise<{ status: "revoked" | "already_revoked" }> {
  if (!callerId) throw new DbQueryError("Authentication required", "42501");
  const invite = (await ds.getById(
    "invitations",
    inviteId,
  )) as unknown as InvitationsRow | null;
  if (!invite) throw new DbQueryError("Invite not found", "P0002");

  let allowed = invite.invited_by === callerId;
  const matchIds = [
    ...(invite.scorer_match_ids ?? []),
    ...(invite.streamer_match_ids ?? []),
  ];
  if (!allowed && matchIds.length > 0) {
    allowed = true;
    for (const matchId of matchIds) {
      if (!(await isMatchAdmin(ds, matchId, callerId))) {
        allowed = false;
        break;
      }
    }
  }
  if (!allowed) {
    throw new DbQueryError(
      "Only the person who sent this invite can revoke it",
      "42501",
    );
  }
  if (invite.status === "revoked") return { status: "already_revoked" };
  if (invite.status !== "pending") {
    throw new DbQueryError("This invite was already accepted", "22023");
  }
  await ds.update("invitations", invite.id, {
    status: "revoked",
    updated_at: new Date().toISOString(),
  });
  return { status: "revoked" };
}
