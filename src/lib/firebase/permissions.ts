import type { ServerClient } from "./server-client";

/**
 * Permission checks for server actions, over the query builder. (The rpc
 * procedures have the same predicates over a DataSource in
 * `rpc/auth-helpers.ts`.) One copy each, so a fix reaches every caller.
 */

/** The club's owner, or an active owner / admin member. */
export async function isClubAdminOf(
  db: ServerClient,
  clubId: string | null | undefined,
  userId: string,
): Promise<boolean> {
  if (!clubId) return false;
  const { data: club } = await db
    .from("clubs")
    .select("owner_id")
    .eq("id", clubId)
    .single();
  if (club?.owner_id === userId) return true;

  const { data: mem } = await db
    .from("club_memberships")
    .select("id")
    .eq("club_id", clubId)
    .eq("user_id", userId)
    .in("role", ["owner", "admin"])
    .eq("status", "active")
    .maybeSingle();
  return Boolean(mem);
}

/**
 * Who may manage a team or act for it (its squad, details, tournament
 * entries): its creator, captain or vice-captain, or an admin of its club.
 */
export async function canManageTeam(
  db: ServerClient,
  teamId: string,
  userId: string,
): Promise<boolean> {
  const { data: team } = await db
    .from("teams")
    .select("created_by, captain_id, vice_captain_id, club_id")
    .eq("id", teamId)
    .single();
  if (!team) return false;
  if (
    team.created_by === userId ||
    team.captain_id === userId ||
    team.vice_captain_id === userId
  ) {
    return true;
  }
  return isClubAdminOf(db, team.club_id, userId);
}
