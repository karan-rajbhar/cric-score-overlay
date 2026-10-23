/**
 * What the match wizard reads (browser Firestore client; the read-cost test
 * runs it on the server client): only the teams, tournaments and clubs it
 * can offer, by indexed queries, instead of every team, tournament and club.
 *
 * - {@link fetchWizardBase}: the user's own teams (created, captain, vice
 *   captain, squad, clubs they run), tournaments they organise (created or
 *   of a club they run) and the clubs they run;
 * - {@link fetchWizardScope}: what the current picks add: the selected
 *   tournament's confirmed teams, the selected club's teams, and the
 *   tournament / clubs named by the link or by the picked teams.
 *
 * Together they hold every team, tournament and club `teamGroups`,
 * `selectableTournaments` and `selectableClubs` can show.
 */

import { sortRows } from "~/lib/firebase/filters";
import type { QueryBuilder } from "~/lib/firebase/query-builder";
import type { SourceName } from "~/lib/firebase/types";

export interface WizardTeam {
  id: string;
  name: string;
  short_name?: string | null;
  club_id?: string | null;
  created_by?: string | null;
  captain_id?: string | null;
  vice_captain_id?: string | null;
  /** Squad size from the team's roster copy; null when it has none. */
  player_count?: number | null;
}

export interface WizardTournament {
  id: string;
  name: string;
  match_format: string;
  overs_per_innings?: number | null;
  wickets_per_innings?: number | null;
  custom_overs?: number | null;
  created_by?: string | null;
  club_id?: string | null;
}

export interface WizardClub {
  id: string;
  name: string;
  short_name?: string | null;
  owner_id?: string | null;
}

export interface MatchWizardData {
  teams: WizardTeam[];
  tournaments: WizardTournament[];
  clubs: WizardClub[];
  playerTeamIds: string[];
  clubAdminIds: string[];
  error: string | null;
}

interface WizardClient {
  from<T extends SourceName>(table: T): QueryBuilder<T>;
}

const TEAM_COLUMNS =
  "id, name, short_name, club_id, created_by, captain_id, vice_captain_id, roster";
const TOURNAMENT_COLUMNS =
  "id, name, match_format, overs_per_innings, wickets_per_innings, custom_overs, created_by, club_id, created_at";
const CLUB_COLUMNS = "id, name, short_name, owner_id";

type Row = Record<string, unknown> & { id: string };
type Result = { data: unknown; error: { message: string } | null };

const none = (): Promise<Result> => Promise.resolve({ data: [], error: null });

/** Rows of several results, each id once, and the first error. */
function merged(results: Result[]): { rows: Row[]; error: string | null } {
  const byId = new Map<string, Row>();
  let error: string | null = null;
  for (const r of results) {
    if (r.error && !error) error = r.error.message;
    for (const row of (r.data ?? []) as Row[]) byId.set(row.id, row);
  }
  // Id order first, so ties sort as the single query did.
  const rows = [...byId.values()].sort((a, b) =>
    a.id < b.id ? -1 : a.id > b.id ? 1 : 0,
  );
  return { rows, error };
}

const ids = (rows: unknown, field: string): string[] => [
  ...new Set(
    ((rows ?? []) as Record<string, unknown>[])
      .map((r) => r[field])
      .filter((v): v is string => typeof v === "string" && v.length > 0),
  ),
];

/** Squad size from `roster`, on the team document already read. */
function teamsOf(rows: Row[]): WizardTeam[] {
  return sortRows(rows, [
    { field: "name", ascending: true, nullsFirst: false },
  ]).map((row) => {
    const { roster, ...team } = row as unknown as WizardTeam & {
      roster?: unknown;
    };
    return {
      ...team,
      player_count: Array.isArray(roster) ? roster.length : null,
    };
  });
}

function tournamentsOf(rows: Row[]): WizardTournament[] {
  return sortRows(rows, [
    { field: "created_at", ascending: false, nullsFirst: true },
  ]).map((row) => {
    const { created_at: _created, ...t } = row;
    void _created;
    return t as unknown as WizardTournament;
  });
}

const clubsOf = (rows: Row[]): WizardClub[] =>
  sortRows(rows, [
    { field: "name", ascending: true, nullsFirst: false },
  ]) as unknown as WizardClub[];

export async function fetchWizardBase(
  db: WizardClient,
  userId: string | null | undefined,
): Promise<MatchWizardData> {
  if (!userId) {
    return {
      teams: [],
      tournaments: [],
      clubs: [],
      playerTeamIds: [],
      clubAdminIds: [],
      error: null,
    };
  }
  const [playerRes, adminRes, ownedRes] = (await Promise.all([
    db.from("team_players").select("team_id").eq("user_id", userId),
    db
      .from("club_memberships")
      .select("club_id")
      .eq("user_id", userId)
      .in("role", ["owner", "admin"])
      .eq("status", "active"),
    db.from("clubs").select(CLUB_COLUMNS).eq("owner_id", userId),
  ])) as Result[];
  const playerTeamIds = ids(playerRes!.data, "team_id");
  const clubAdminIds = [
    ...new Set([
      ...ids(adminRes!.data, "club_id"),
      ...ids(ownedRes!.data, "id"),
    ]),
  ];

  const [teams, tournaments, clubs] = await Promise.all([
    Promise.all([
      db.from("teams").select(TEAM_COLUMNS).eq("created_by", userId),
      db.from("teams").select(TEAM_COLUMNS).eq("captain_id", userId),
      db.from("teams").select(TEAM_COLUMNS).eq("vice_captain_id", userId),
      playerTeamIds.length
        ? db.from("teams").select(TEAM_COLUMNS).in("id", playerTeamIds)
        : none(),
      clubAdminIds.length
        ? db.from("teams").select(TEAM_COLUMNS).in("club_id", clubAdminIds)
        : none(),
    ] as Promise<Result>[]),
    Promise.all([
      db
        .from("tournaments")
        .select(TOURNAMENT_COLUMNS)
        .eq("created_by", userId),
      clubAdminIds.length
        ? db
            .from("tournaments")
            .select(TOURNAMENT_COLUMNS)
            .in("club_id", clubAdminIds)
        : none(),
    ] as Promise<Result>[]),
    Promise.all([
      Promise.resolve(ownedRes!),
      clubAdminIds.length
        ? db.from("clubs").select(CLUB_COLUMNS).in("id", clubAdminIds)
        : none(),
    ] as Promise<Result>[]),
  ]);
  const t = merged(teams);
  const tr = merged(tournaments);
  const c = merged(clubs);
  return {
    teams: teamsOf(t.rows),
    tournaments: tournamentsOf(tr.rows),
    clubs: clubsOf(c.rows),
    playerTeamIds,
    clubAdminIds,
    error: t.error,
  };
}

export interface WizardScope {
  tournamentId?: string | null;
  clubId?: string | null;
  /** The selected tournament's confirmed teams. */
  tournamentTeamIds?: readonly string[];
  /** Clubs named by the picked teams (offered as the match's club). */
  clubIds?: readonly string[];
}

/** The teams, tournament and clubs the current picks add to the base. */
export async function fetchWizardScope(
  db: WizardClient,
  scope: WizardScope,
): Promise<Pick<MatchWizardData, "teams" | "tournaments" | "clubs">> {
  const clubIds = [...new Set([scope.clubId, ...(scope.clubIds ?? [])])].filter(
    (id): id is string => !!id,
  );
  const teamIds = [...new Set(scope.tournamentTeamIds ?? [])];
  const [teams, tournaments, clubs] = await Promise.all([
    Promise.all([
      teamIds.length
        ? db.from("teams").select(TEAM_COLUMNS).in("id", teamIds)
        : none(),
      scope.clubId
        ? db.from("teams").select(TEAM_COLUMNS).eq("club_id", scope.clubId)
        : none(),
    ] as Promise<Result>[]),
    scope.tournamentId
      ? (db
          .from("tournaments")
          .select(TOURNAMENT_COLUMNS)
          .eq("id", scope.tournamentId) as unknown as Promise<Result>)
      : none(),
    clubIds.length
      ? (db
          .from("clubs")
          .select(CLUB_COLUMNS)
          .in("id", clubIds) as unknown as Promise<Result>)
      : none(),
  ]);
  return {
    teams: teamsOf(merged(teams).rows),
    tournaments: tournamentsOf(merged([tournaments]).rows),
    clubs: clubsOf(merged([clubs]).rows),
  };
}
