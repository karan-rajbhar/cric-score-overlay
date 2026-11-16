"use server";

import { revalidatePath } from "next/cache";
import { createServerClient } from "~/lib/firebase/server";
import { canManageTeam, isClubAdminOf } from "~/lib/firebase/permissions";

/** A team a club admin may bring into the club. */
export interface ClubTeamCandidate {
  id: string;
  name: string;
  short_name: string | null;
  logo_url: string | null;
  /** It played one of the club's recent matches. */
  playedForClub: boolean;
  /** It is in another club now (adding it moves it). */
  inOtherClub: boolean;
  /** The user has a say over the team (creator, captain, vice-captain, or an admin of its club). */
  canAdd: boolean;
}

type TeamDoc = {
  id: string;
  name: string;
  short_name: string | null;
  logo_url: string | null;
  club_id: string | null;
  created_by: string | null;
  captain_id: string | null;
  vice_captain_id: string | null;
};

const TEAM_FIELDS =
  "id, name, short_name, logo_url, club_id, created_by, captain_id, vice_captain_id";
/** The club's latest matches whose teams are suggested. */
const RECENT_MATCHES = 50;

/**
 * Teams a club admin may add to the club: those in its latest matches
 * first (a club whose teams were never added still has its matches), then
 * the teams the admin created; never one already in the club.
 */
export async function getTeamsForClub(
  clubId: string,
): Promise<{ teams: ClubTeamCandidate[]; error: string | null }> {
  const db = await createServerClient();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) return { teams: [], error: "You must be logged in" };
  if (!(await isClubAdminOf(db, clubId, user.id))) {
    return { teams: [], error: "Only the club's admins can add its teams" };
  }

  const [{ data: matches }, { data: mine }] = await Promise.all([
    db
      .from("matches")
      .select("team1_id, team2_id")
      .eq("club_id", clubId)
      .order("scheduled_at", { ascending: false })
      .limit(RECENT_MATCHES),
    db.from("teams").select(TEAM_FIELDS).eq("created_by", user.id).limit(50),
  ]);

  const played = new Set<string>();
  for (const m of (matches ?? []) as Array<{ team1_id?: string; team2_id?: string }>) {
    if (m.team1_id) played.add(m.team1_id);
    if (m.team2_id) played.add(m.team2_id);
  }
  const byId = new Map<string, TeamDoc>();
  for (const t of (mine ?? []) as TeamDoc[]) byId.set(t.id, t);
  const missing = [...played].filter((id) => !byId.has(id));
  for (let i = 0; i < missing.length; i += 30) {
    const { data } = await db
      .from("teams")
      .select(TEAM_FIELDS)
      .in("id", missing.slice(i, i + 30));
    for (const t of (data ?? []) as TeamDoc[]) byId.set(t.id, t);
  }

  // A say over a team in another club can come from being its admin.
  const otherClubs = [
    ...new Set(
      [...byId.values()]
        .map((t) => t.club_id)
        .filter((id): id is string => Boolean(id) && id !== clubId),
    ),
  ];
  const adminOf = new Set<string>();
  await Promise.all(
    otherClubs.map(async (id) => {
      if (await isClubAdminOf(db, id, user.id)) adminOf.add(id);
    }),
  );

  const teams = [...byId.values()]
    .filter((t) => t.club_id !== clubId)
    .map((t) => ({
      id: t.id,
      name: t.name,
      short_name: t.short_name ?? null,
      logo_url: t.logo_url ?? null,
      playedForClub: played.has(t.id),
      inOtherClub: Boolean(t.club_id),
      canAdd:
        t.created_by === user.id ||
        t.captain_id === user.id ||
        t.vice_captain_id === user.id ||
        (Boolean(t.club_id) && adminOf.has(t.club_id!)),
    }))
    .sort(
      (a, b) =>
        Number(b.playedForClub) - Number(a.playedForClub) ||
        a.name.localeCompare(b.name),
    );
  return { teams, error: null };
}

/**
 * Puts a team in a club (or, with null, takes it out). Joining needs a say
 * over the team (`canManageTeam`) and an admin of the club; leaving needs a
 * say over the team. Its past matches stay where they are (a match joins a
 * club through "Add to club"); `clubs.team_count` follows (write hook).
 */
export async function setTeamClub(
  teamId: string,
  clubId: string | null,
): Promise<{ error: string | null }> {
  const db = await createServerClient();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) return { error: "You must be logged in" };

  const { data: team } = await db
    .from("teams")
    .select("id, club_id")
    .eq("id", teamId)
    .maybeSingle();
  if (!team) return { error: "Team no longer exists" };
  const before = (team as { club_id?: string | null }).club_id ?? null;
  if (before === clubId) return { error: null };

  if (!(await canManageTeam(db, teamId, user.id))) {
    return {
      error:
        "Only the team's creator, captain, vice-captain or a club admin can move it",
    };
  }
  if (clubId && !(await isClubAdminOf(db, clubId, user.id))) {
    return { error: "Only the club's admins can add teams to it" };
  }

  const { error } = await db
    .from("teams")
    .update({ club_id: clubId, updated_at: new Date().toISOString() })
    .eq("id", teamId);
  if (error) {
    console.error("Error moving team:", error);
    return { error: error.message };
  }

  revalidatePath(`/teams/${teamId}`);
  revalidatePath("/teams");
  if (before) revalidatePath(`/clubs/${before}`);
  if (clubId) revalidatePath(`/clubs/${clubId}`);
  return { error: null };
}
