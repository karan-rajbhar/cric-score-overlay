/**
 * Upcoming fixtures for what a user follows, for the dashboard's
 * "Following" list. Live matches are not read here: the dashboard already
 * holds every live match (`getMatches({ status: "live" })`), and the list
 * picks the followed ones out of it with {@link isFollowedMatch} (no reads).
 *
 * Reads: the followed players' team memberships (1 per membership, at most
 * MAX_PLAYERS players), then per 10 teams one query per side, per 10
 * tournaments one query, each at most PER_QUERY matches (indexed:
 * `<field> in`, `scheduled_at >=`, ordered by `scheduled_at`), plus the
 * followed matches themselves (at most MAX_MATCHES).
 */

import { chunk } from "~/lib/firebase/datasource";
import type { ServerClient } from "~/lib/firebase/server-client";
import { attachMatchTeams } from "~/lib/firebase/team-snapshot";
import { idsOfKind } from "./store";

const MAX_TEAMS = 30;
const MAX_PLAYERS = 10;
const MAX_TOURNAMENTS = 10;
const MAX_MATCHES = 10;
const IN_GROUP = 10;
const PER_QUERY = 8;
/** Fixtures listed at most. */
export const MAX_UPCOMING = 8;
/** A fixture stays listed this long after its start time. */
const GRACE_MS = 3 * 60 * 60 * 1000;

const COLUMNS = `
  *,
  innings(id, team_id, innings_number, total_runs, total_wickets, total_overs, is_completed)
`;

type Row = Record<string, unknown> & { id: string };

export interface FollowedIds {
  matchIds: string[];
  /** Followed teams plus the teams of followed players. */
  teamIds: string[];
  tournamentIds: string[];
}

export interface FollowingFeed extends FollowedIds {
  targets: string[];
  /** Scheduled fixtures, soonest first. */
  upcoming: Row[];
}

/** Whether a match (live list row) involves something the user follows. */
export function isFollowedMatch(
  match: {
    id: string;
    team1_id?: string | null;
    team2_id?: string | null;
    tournament_id?: string | null;
  },
  ids: FollowedIds,
): boolean {
  return (
    ids.matchIds.includes(match.id) ||
    (!!match.team1_id && ids.teamIds.includes(match.team1_id)) ||
    (!!match.team2_id && ids.teamIds.includes(match.team2_id)) ||
    (!!match.tournament_id && ids.tournamentIds.includes(match.tournament_id))
  );
}

function unique(ids: Iterable<string>): string[] {
  return Array.from(new Set(ids));
}

export async function followingFeed(
  db: Pick<ServerClient, "from">,
  targets: string[],
  now: Date,
): Promise<FollowingFeed> {
  const matchIds = idsOfKind(targets, "match").slice(-MAX_MATCHES);
  const players = idsOfKind(targets, "player").slice(-MAX_PLAYERS);
  const tournamentIds = idsOfKind(targets, "tournament").slice(
    -MAX_TOURNAMENTS,
  );
  const teamIds = idsOfKind(targets, "team");
  if (players.length > 0) {
    const { data } = await db
      .from("team_players")
      .select("team_id")
      .in("user_id", players);
    for (const row of (data ?? []) as Array<{ team_id?: string | null }>) {
      if (row.team_id) teamIds.push(row.team_id);
    }
  }
  const teams = unique(teamIds).slice(-MAX_TEAMS);
  const since = new Date(now.getTime() - GRACE_MS).toISOString();

  const upcomingFor = (field: string, ids: string[]) =>
    db
      .from("matches")
      .select(COLUMNS)
      .in(field, ids)
      .gte("scheduled_at", since)
      .order("scheduled_at", { ascending: true })
      .limit(PER_QUERY);

  const queries = [
    ...chunk(teams, IN_GROUP).flatMap((group) => [
      upcomingFor("team1_id", group),
      upcomingFor("team2_id", group),
    ]),
    ...chunk(tournamentIds, IN_GROUP).map((group) =>
      upcomingFor("tournament_id", group),
    ),
    ...(matchIds.length
      ? [db.from("matches").select(COLUMNS).in("id", matchIds)]
      : []),
  ];
  const results = await Promise.all(queries);
  const byId = new Map<string, Row>();
  for (const { data, error } of results) {
    if (error) throw new Error(error.message);
    for (const row of (data ?? []) as unknown as Row[]) byId.set(row.id, row);
  }
  const upcoming = [...byId.values()]
    .filter(
      (m) =>
        m.status === "scheduled" &&
        typeof m.scheduled_at === "string" &&
        m.scheduled_at >= since,
    )
    .sort((a, b) =>
      String(a.scheduled_at).localeCompare(String(b.scheduled_at)),
    )
    .slice(0, MAX_UPCOMING);
  await attachMatchTeams(db, upcoming as never[]);
  return { targets, matchIds, teamIds: teams, tournamentIds, upcoming };
}
