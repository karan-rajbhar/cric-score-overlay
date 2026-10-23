/**
 * The seed grown to production-like size, for read-costs.test.ts: the seed
 * hides every unbounded list (8 matches, 4 teams, 2 clubs). Deterministic.
 *
 * - 120 public clubs; the first ("big club") has 10 teams, 300 members and
 *   250 matches (one live), 200 of them played by its first team;
 * - 400 teams (3 per club, 40 without one), 150 tournaments;
 * - 1,000 matches in all, with innings summaries and their totals;
 * - a player in 3 teams of the big club with 40 match records;
 * - an organiser who owns the big club and created every tournament.
 */

import {
  rosterOf,
  searchFieldsOf,
  summaryTotalsOf,
  userSnapshot,
} from "../derive.mjs";
import type { Doc } from "../datasource";

const uuid = (prefix: string, n: number) =>
  `${prefix}-0000-4000-8000-${n.toString(16).padStart(12, "0")}`;

export const SCALE = {
  clubs: 120,
  teams: 400,
  tournaments: 150,
  matches: 1000,
  bigClubMatches: 250,
  bigClubMembers: 300,
  bigTeamMatches: 200,
};

export interface ScaleIds {
  bigClub: string;
  bigTeam: string;
  player: string;
  organiser: string;
  tournament: string;
}

function withSearch(table: string, doc: Doc): Doc {
  return { ...doc, ...(searchFieldsOf(table, doc) ?? {}) };
}

const day = (n: number) =>
  new Date(Date.UTC(2023, 0, 1) + n * 86_400_000).toISOString();

export function scaleSeed(seed: Record<string, Doc[]>): {
  data: Record<string, Doc[]>;
  ids: ScaleIds;
} {
  const data = structuredClone(seed);
  const organiser = uuid("e1000000", 0);
  const users: Doc[] = [
    withSearch("users", {
      id: organiser,
      full_name: "Olive Organiser",
      username: "olive_org",
      avatar_url: null,
      is_active: true,
      created_at: day(0),
    }),
  ];
  for (let i = 0; i < SCALE.bigClubMembers; i += 1) {
    users.push(
      withSearch("users", {
        id: uuid("e2000000", i),
        full_name: `Player ${i}`,
        username: `player_${i}`,
        avatar_url: null,
        is_active: true,
        created_at: day(i % 365),
      }),
    );
  }
  const usersById = new Map(users.map((u) => [u.id, u]));
  const player = users[1]!.id;

  const clubs: Doc[] = [];
  for (let c = 0; c < SCALE.clubs; c += 1) {
    clubs.push(
      withSearch("clubs", {
        id: uuid("e3000000", c),
        name: `Club ${String(c).padStart(3, "0")}`,
        short_name: `C${c}`,
        owner_id: c === 0 ? organiser : uuid("e2000000", c),
        is_public: true,
        club_type: "community",
        location: null,
        logo_url: null,
        social_links: {},
        created_at: day(c),
      }),
    );
  }
  const bigClub = clubs[0]!.id;

  const teams: Doc[] = [];
  const teamPlayers: Doc[] = [];
  for (let t = 0; t < SCALE.teams; t += 1) {
    const clubIndex =
      t < 10 ? 0 : t < 370 ? 1 + ((t - 10) % (SCALE.clubs - 1)) : -1;
    const team: Doc = withSearch("teams", {
      id: uuid("e4000000", t),
      name: `Team ${String(t).padStart(3, "0")}`,
      short_name: `T${t}`,
      club_id: clubIndex >= 0 ? clubs[clubIndex]!.id : null,
      created_by: clubIndex === 0 ? organiser : uuid("e2000000", t % 300),
      captain_id: null,
      vice_captain_id: null,
      team_type: "club",
      is_template: false,
      logo_url: null,
      created_at: day(t),
    });
    // The player is in the big club's first three squads.
    const squad = t < 3 ? [player, uuid("e2000000", 10 + t)] : [];
    for (const [k, userId] of squad.entries()) {
      teamPlayers.push({
        id: uuid("e5000000", t * 10 + k),
        team_id: team.id,
        user_id: userId,
        batting_order: k + 1,
        jersey_number: k + 1,
        is_playing_xi: true,
        role_in_team: "player",
        created_at: day(t),
      });
    }
    team.roster = rosterOf(
      teamPlayers.filter((tp) => tp.team_id === team.id),
      usersById,
    );
    teams.push(team);
  }
  for (const club of clubs) {
    club.team_count = teams.filter((t) => t.club_id === club.id).length;
  }
  const bigTeam = teams[0]!.id;

  const tournaments: Doc[] = [];
  for (let i = 0; i < SCALE.tournaments; i += 1) {
    tournaments.push(
      withSearch("tournaments", {
        id: uuid("e6000000", i),
        name: `Tournament ${String(i).padStart(3, "0")}`,
        club_id: clubs[i % SCALE.clubs]!.id,
        created_by: organiser,
        tournament_format: "league",
        match_format: "T20",
        status: "upcoming",
        start_date: day(i).slice(0, 10),
        is_public: true,
        created_at: day(i),
      }),
    );
  }

  const snapshot = (t: Doc) => ({
    id: t.id,
    name: t.name,
    short_name: t.short_name,
    logo_url: null,
  });
  const matches: Doc[] = [];
  const records: Doc[] = [];
  for (let i = 0; i < SCALE.matches; i += 1) {
    const inBigClub = i < SCALE.bigClubMatches;
    const a = inBigClub
      ? i < SCALE.bigTeamMatches
        ? teams[0]!
        : teams[1 + (i % 9)]!
      : teams[10 + (i % 390)]!;
    const b = inBigClub
      ? teams[1 + ((i + 1) % 9)]!
      : teams[10 + ((i * 7 + 3) % 390)]!;
    const status =
      i === 5
        ? "live"
        : inBigClub && i % 17 === 0
          ? "scheduled"
          : inBigClub && i % 61 === 0
            ? "abandoned"
            : "completed";
    const id = uuid("e7000000", i);
    const innings =
      status === "scheduled"
        ? []
        : [
            {
              id: uuid("e8000000", i * 2),
              team_id: a.id,
              innings_number: 1,
              total_runs: 100 + (i % 97),
              total_wickets: i % 10,
              total_overs: 20,
              total_balls: 120,
              extras_total: 5,
              is_completed: status !== "live",
              target_runs: null,
            },
            ...(status === "live"
              ? []
              : [
                  {
                    id: uuid("e8000000", i * 2 + 1),
                    team_id: b.id,
                    innings_number: 2,
                    total_runs: 90 + (i % 83),
                    total_wickets: (i * 3) % 10,
                    total_overs: 19.2,
                    total_balls: 116,
                    extras_total: 7,
                    is_completed: true,
                    target_runs: 101 + (i % 97),
                  },
                ]),
          ];
    const match: Doc = withSearch("matches", {
      id,
      title: `${a.short_name} vs ${b.short_name} #${i}`,
      match_format: "T20",
      overs_per_innings: 20,
      balls_per_over: 6,
      status,
      scheduled_at: day(400 - (i % 400)),
      club_id: inBigClub ? bigClub : a.club_id,
      tournament_id: null,
      team1_id: a.id,
      team2_id: b.id,
      team1_snapshot: snapshot(a),
      team2_snapshot: snapshot(b),
      winning_team_id: status === "completed" ? (i % 3 ? a.id : b.id) : null,
      result_description: null,
      current_innings: status === "live" ? 1 : 2,
      match_admins: [],
      created_by: organiser,
      innings_summary: innings,
      ...summaryTotalsOf(innings),
      created_at: day(i % 400),
    });
    matches.push(match);
    // The player batted in 40 of the first team's completed matches.
    if (a.id === bigTeam && status === "completed" && records.length < 40) {
      records.push({
        id: `${id}_${player}`,
        user_id: player,
        match_id: id,
        club_id: bigClub,
        tournament_id: null,
        match_date: match.scheduled_at,
        batting: [
          {
            user_id: player,
            innings_id: innings[0]!.id,
            innings_number: 1,
            batting_position: 1,
            runs_scored: 20 + (i % 60),
            balls_faced: 25,
            fours: 2,
            sixes: 1,
            is_out: true,
            dismissal_type: "bowled",
            bowler_id: uuid("e2000000", 20),
            fielder_id: null,
          },
        ],
        bowling: [],
        fielding: { catches: 0, stumpings: 0, run_outs: 0 },
        updated_at: match.scheduled_at,
      });
    }
  }

  const memberships: Doc[] = users.slice(1).map((u, i) => ({
    id: uuid("e9000000", i),
    club_id: bigClub,
    user_id: u.id,
    role: "member",
    status: "active",
    joined_at: day(i),
    updated_at: day(i),
    user_snapshot: userSnapshot(u),
  }));

  data.users = [...data.users!, ...users];
  data.clubs = [...data.clubs!, ...clubs];
  data.teams = [...data.teams!, ...teams];
  data.team_players = [...(data.team_players ?? []), ...teamPlayers];
  data.tournaments = [...data.tournaments!, ...tournaments];
  data.matches = [...data.matches!, ...matches];
  data.player_matches = [...(data.player_matches ?? []), ...records];
  data.club_memberships = [...(data.club_memberships ?? []), ...memberships];
  return {
    data,
    ids: {
      bigClub,
      bigTeam,
      player,
      organiser,
      tournament: tournaments[0]!.id,
    },
  };
}
