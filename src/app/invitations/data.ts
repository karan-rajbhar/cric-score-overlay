import type { ServerClient } from "~/lib/firebase/server-client";
import type { InvitationsRow } from "~/lib/firebase/types";

/** Most invites a user sees on /invitations (newest first). */
export const SENT_INVITES_LIMIT = 50;

export interface SentInvite {
  id: string;
  email: string;
  status: InvitationsRow["status"];
  created_at: string | null;
  updated_at: string | null;
  accepted_by: {
    id: string;
    full_name: string | null;
    username: string | null;
  } | null;
  scorer_matches: { id: string; title: string | null }[];
}

/**
 * Invites `uid` sent, newest first: one indexed query (invited_by +
 * created_at desc, limited), then the accepting profiles and the scorer
 * matches by id. Reads at most limit + profiles + matches documents.
 */
export async function listSentInvitations(
  db: Pick<ServerClient, "from">,
  uid: string,
  limit = SENT_INVITES_LIMIT,
): Promise<SentInvite[]> {
  const { data, error } = await db
    .from("invitations")
    .select(
      "id, email, status, accepted_by, scorer_match_ids, created_at, updated_at",
    )
    .eq("invited_by", uid)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  const invites = (data ?? []) as InvitationsRow[];

  const userIds = [
    ...new Set(invites.map((i) => i.accepted_by).filter(Boolean)),
  ] as string[];
  const matchIds = [
    ...new Set(invites.flatMap((i) => i.scorer_match_ids ?? [])),
  ];
  const [users, matches] = await Promise.all([
    userIds.length
      ? db.from("users").select("id, full_name, username").in("id", userIds)
      : Promise.resolve({ data: [] }),
    matchIds.length
      ? db.from("matches").select("id, title").in("id", matchIds)
      : Promise.resolve({ data: [] }),
  ]);
  type UserRef = NonNullable<SentInvite["accepted_by"]>;
  const userById = new Map(
    ((users.data ?? []) as UserRef[]).map((u) => [u.id, u]),
  );
  const matchById = new Map(
    ((matches.data ?? []) as { id: string; title: string | null }[]).map(
      (m) => [m.id, m],
    ),
  );

  return invites.map((i) => ({
    id: i.id,
    email: i.email,
    status: i.status,
    created_at: i.created_at,
    updated_at: i.updated_at,
    accepted_by: i.accepted_by
      ? (userById.get(i.accepted_by) ?? {
          id: i.accepted_by,
          full_name: null,
          username: null,
        })
      : null,
    scorer_matches: (i.scorer_match_ids ?? []).map(
      (id) => matchById.get(id) ?? { id, title: null },
    ),
  }));
}
