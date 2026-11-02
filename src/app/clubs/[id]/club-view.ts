import "server-only";
import { notFound } from "next/navigation";
import { cache } from "react";
import { createServerClient } from "~/lib/firebase/server";

/**
 * What the club page's layout and its tabs share. The layout does not run
 * again when a tab opens, so the access check lives here, called by both:
 * the tabs never rely on the layout having passed it.
 */

const CLUB_ID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const isClubId = (id: string) => CLUB_ID.test(id);

export interface TeamRow {
  id: string;
  name: string;
  short_name: string | null;
  logo_url?: string | null;
  team_type: string | null;
  captain?: { full_name: string } | null;
  team_players?: { count: number }[];
}

export interface TournamentRow {
  id: string;
  name: string;
  description: string | null;
  status: string | null;
  tournament_format: string | null;
  match_format: string | null;
  start_date: string | null;
  end_date: string | null;
  venue: string | null;
  season_id: string | null;
  overs_per_innings?: number | null;
}

export interface MatchRow {
  id: string;
  title: string;
  match_format: string | null;
  overs_per_innings: number | null;
  status: string;
  venue: string | null;
  scheduled_at: string | null;
  result_type: string | null;
  win_margin: number | null;
  win_margin_type: string | null;
  result_description: string | null;
  season_id: string | null;
  team1: { id: string; name: string; short_name: string | null } | null;
  team2: { id: string; name: string; short_name: string | null } | null;
  innings?: Array<{
    id: string;
    team_id: string;
    innings_number: number;
    total_runs: number | null;
    total_wickets: number | null;
    total_balls: number | null;
    total_overs: number | null;
  }>;
}

export interface MemberRow {
  id: string;
  role: string;
  status: string;
  joined_at: string;
  user: {
    id: string;
    full_name: string;
    avatar_url: string | null;
  } | null;
}

export interface SeasonRow {
  id: string;
  name: string;
  start_date: string | null;
  end_date: string | null;
  is_current: boolean | null;
}

export interface HallOfFameRow {
  id: string;
  category: string;
  title: string;
  description: string | null;
  season_or_year: string | null;
  record_metric: string | null;
  inducted_at: string | null;
  player: {
    id: string;
    full_name: string;
    avatar_url: string | null;
  } | null;
}

export const MEMBER_COLUMNS =
  "id, role, status, joined_at, user:users(id, full_name, avatar_url)";

/** Matches / members listed at first; "Show more" adds as many again. */
export const MATCH_PAGE = 50;
export const MEMBER_PAGE = 100;
/** Most a "Show more" link can grow a list to. */
const MAX_SHOWN = 1000;

export function shownCount(raw: string | undefined, page: number): number {
  const n = Number(raw);
  return Number.isInteger(n) && n > page ? Math.min(n, MAX_SHOWN) : page;
}

/** The club document: read once per request, by the page and its title. */
export const loadClub = cache(async (id: string) => {
  const db = await createServerClient();
  return db.from("clubs").select("*").eq("id", id).single();
});

/**
 * The club and who is looking at it, once per request. Not found for a bad
 * id, a missing club, or a private club seen by anyone but its owner and
 * members.
 */
export const loadClubViewer = cache(async (id: string) => {
  if (!isClubId(id)) notFound();
  const db = await createServerClient();
  const {
    data: { user },
  } = await db.auth.getUser();
  const [{ data: club }, { data: ownMemberships }] = await Promise.all([
    loadClub(id),
    user
      ? db
          .from("club_memberships")
          .select(MEMBER_COLUMNS)
          .eq("club_id", id)
          .eq("user_id", user.id)
      : Promise.resolve({ data: [] }),
  ]);
  if (!club) notFound();
  const isOwner = user?.id === club.owner_id;
  // The viewer's own membership (the first, as the full list had it).
  const myMembership = (
    (ownMemberships ?? []) as unknown as MemberRow[]
  ).sort((a, b) => (a.joined_at < b.joined_at ? -1 : 1))[0];
  const isAdmin = isOwner || myMembership?.role === "admin";
  const isMember = !!myMembership;
  // Private clubs are only visible to their owner and members.
  if (club.is_public === false && !isOwner && !isMember) notFound();
  return { db, user, club, isOwner, isAdmin, isMember };
});

export type ClubViewer = Awaited<ReturnType<typeof loadClubViewer>>;

type Profile = NonNullable<MemberRow["user"]>;

/**
 * Hall of fame entries with their player. Players are usually members,
 * whose profiles the members' snapshots carry: only the others are read
 * (as `users!club_hall_of_fame_player_id_fkey(...)` read each one).
 */
export async function withHallOfFamePlayers(
  db: Awaited<ReturnType<typeof createServerClient>>,
  rows: Array<Record<string, unknown> & { player_id?: string | null }>,
  members: MemberRow[],
): Promise<HallOfFameRow[]> {
  const profiles = new Map<string, Profile>();
  for (const m of members) if (m.user) profiles.set(m.user.id, m.user);
  const unknown = [
    ...new Set(
      rows
        .map((h) => h.player_id)
        .filter((pid): pid is string => !!pid && !profiles.has(pid)),
    ),
  ];
  if (unknown.length) {
    const { data } = await db
      .from("users")
      .select("id, full_name, avatar_url")
      .in("id", unknown);
    for (const p of (data ?? []) as Profile[]) profiles.set(p.id, p);
  }
  return rows.map(({ player_id, ...entry }) => ({
    ...(entry as unknown as Omit<HallOfFameRow, "player">),
    player: (player_id && profiles.get(player_id)) || null,
  }));
}

