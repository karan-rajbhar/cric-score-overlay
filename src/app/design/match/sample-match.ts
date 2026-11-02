import type {
  BattingPerformance,
  BowlingPerformance,
  FallOfWicket,
  Innings,
  Match,
} from "~/lib/match-types";

/*
 * A made-up match for /design/match: the real match page on sample data, for
 * checking it in each state without a signed-in user or a database.
 */

const MATCH_ID = "preview";

const person = (id: string) => ({
  id,
  full_name: id.replace(/(^| )\w/g, (c) => c.toUpperCase()),
});

const bat = (
  innings_id: string,
  name: string,
  position: number,
  runs_scored: number,
  balls_faced: number,
  fours: number,
  sixes: number,
  dismissal_type: string | null,
): BattingPerformance => ({
  id: `${innings_id}-bat-${name}`,
  match_id: MATCH_ID,
  innings_id,
  user_id: name,
  batting_position: position,
  runs_scored,
  balls_faced,
  fours,
  sixes,
  is_out: dismissal_type !== null,
  dismissal_type,
  user: person(name),
});

const bowl = (
  innings_id: string,
  name: string,
  overs_bowled: number,
  maidens: number,
  runs_conceded: number,
  wickets_taken: number,
): BowlingPerformance => ({
  id: `${innings_id}-bowl-${name}`,
  match_id: MATCH_ID,
  innings_id,
  user_id: name,
  overs_bowled,
  balls_bowled: Math.round(overs_bowled) * 6,
  runs_conceded,
  wickets_taken,
  maidens,
  wides: 0,
  no_balls: 0,
  user: person(name),
});

const fall = (
  innings_id: string,
  wicket_number: number,
  runs_at_fall: number,
  overs_at_fall: number,
  batter: string,
  dismissal_type: string,
  bowler: string,
  fielder?: string,
): FallOfWicket => ({
  id: `${innings_id}-fow-${wicket_number}`,
  match_id: MATCH_ID,
  innings_id,
  wicket_number,
  runs_at_fall,
  overs_at_fall,
  batsman_out_id: batter,
  dismissal_type,
  bowler_id: bowler,
  fielder_id: fielder ?? null,
  batsman: person(batter),
  bowler: person(bowler),
  fielder: fielder ? person(fielder) : null,
});

const FIRST: Innings = {
  id: "first",
  match_id: MATCH_ID,
  innings_number: 1,
  team_id: "rohan",
  total_runs: 83,
  total_wickets: 6,
  total_balls: 48,
  total_overs: 8,
  is_completed: true,
  extras_total: 7,
  extras_byes: 0,
  extras_leg_byes: 0,
  extras_wides: 6,
  extras_no_balls: 1,
  extras_penalties: 0,
  batting_performances: [
    bat("first", "harsh", 1, 5, 4, 1, 0, "caught"),
    bat("first", "vinayak", 2, 11, 6, 1, 1, "caught"),
    bat("first", "rohan", 3, 36, 11, 1, 4, null),
    bat("first", "mayur", 4, 1, 2, 0, 0, "run_out"),
    bat("first", "karan rajbhar", 5, 23, 10, 2, 1, "stumped"),
  ],
  bowling_performances: [
    bowl("first", "nandu", 2, 0, 5, 2),
    bowl("first", "sanket", 2, 0, 19, 1),
    bowl("first", "omkar", 2, 0, 24, 1),
    bowl("first", "mahadev", 2, 0, 28, 2),
  ],
  fall_of_wickets: [
    fall("first", 1, 13, 1.1, "harsh", "caught", "nandu", "sanket"),
    fall("first", 2, 18, 2, "vinayak", "caught", "nandu", "omkar"),
    fall("first", 3, 40, 3.2, "mayur", "run_out", "mahadev", "akashy"),
    fall("first", 4, 42, 3.4, "karan rajbhar", "stumped", "mahadev", "ram"),
  ],
} as Innings;

const SECOND: Innings = {
  id: "second",
  match_id: MATCH_ID,
  innings_number: 2,
  team_id: "omkar",
  total_runs: 68,
  total_wickets: 6,
  total_balls: 48,
  total_overs: 8,
  is_completed: true,
  target_runs: 84,
  extras_total: 6,
  extras_byes: 0,
  extras_leg_byes: 0,
  extras_wides: 5,
  extras_no_balls: 1,
  extras_penalties: 0,
  batting_performances: [
    bat("second", "kumar", 1, 16, 10, 2, 0, "caught"),
    bat("second", "sanket", 2, 9, 5, 2, 0, "caught"),
    bat("second", "omkar", 3, 12, 8, 0, 1, "caught"),
    bat("second", "akashy", 4, 14, 7, 2, 1, null),
  ],
  bowling_performances: [
    bowl("second", "karan rajbhar", 2, 0, 15, 1),
    bowl("second", "mayur", 2, 0, 24, 2),
    bowl("second", "rohan", 1, 1, 0, 0),
    bowl("second", "vinayak", 3, 0, 29, 3),
  ],
  fall_of_wickets: [
    fall("second", 1, 17, 1.4, "sanket", "caught", "mayur", "nitesh"),
    fall("second", 2, 45, 4.5, "omkar", "caught", "vinayak", "karan rajbhar"),
    fall("second", 3, 52, 6, "kumar", "caught", "mayur", "vinayak"),
  ],
} as Innings;

const squad = (team: string, names: readonly string[]) =>
  names.map((name, i) => ({
    id: `${team}-${name}`,
    team_id: team,
    user_id: name,
    batting_order: i + 1,
    role_in_team: i === 0 ? "captain" : "player",
    user: person(name),
  }));

const BASE = {
  id: MATCH_ID,
  title: "Rohan vs Omkar",
  match_format: "Custom",
  overs_per_innings: 8,
  balls_per_over: 6,
  current_over: 0,
  current_ball: 0,
  scheduled_at: "2026-11-01T09:48:00.000Z",
  team1_id: "rohan",
  team2_id: "omkar",
  team1: {
    id: "rohan",
    name: "Rohan",
    short_name: "ROH",
    team_players: squad("rohan", ["rohan", "harsh", "vinayak", "mayur"]),
  },
  team2: {
    id: "omkar",
    name: "Omkar",
    short_name: "OMK",
    team_players: squad("omkar", ["omkar", "kumar", "sanket", "akashy"]),
  },
  club_id: "club",
  club: { id: "club", name: "Unity Cricket Club" },
  toss_winner_team_id: "rohan",
  toss_decision: "bat",
};

export type MatchState = "finished" | "live" | "upcoming" | "break";

/** The same match before, during and after. */
export const SAMPLE_MATCH = {
  finished: {
    ...BASE,
    status: "completed",
    current_innings: 2,
    winning_team_id: "rohan",
    result_description: "Rohan won by 15 runs",
    player_of_the_match_id: "rohan",
    player_of_the_match: person("rohan"),
    actual_start_time: "2026-11-01T09:48:00.000Z",
    innings: [FIRST, SECOND],
  },
  live: {
    ...BASE,
    status: "live",
    current_innings: 2,
    innings: [
      FIRST,
      {
        ...SECOND,
        total_runs: 52,
        total_wickets: 3,
        total_balls: 36,
        total_overs: 6,
        is_completed: false,
      },
    ],
  },
  /** Between the innings: the chase has not begun. */
  break: {
    ...BASE,
    status: "live",
    current_innings: 1,
    innings: [FIRST],
  },
  upcoming: {
    ...BASE,
    status: "scheduled",
    current_innings: 0,
    toss_winner_team_id: null,
    toss_decision: null,
    innings: [],
  },
} as unknown as Record<MatchState, Match>;
