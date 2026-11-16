import type {
  BattingPerformance,
  BowlingPerformance,
  FallOfWicket,
  Innings,
  Match,
  TeamPlayer,
} from "~/lib/match-types";
import type { LoggedBall } from "~/app/matches/[id]/score/components/FixMistakeDialog";
import type { ScoringSide } from "~/app/matches/[id]/score/scoring-views";

/*
 * A made-up chase for /design/scoring, consistent enough for the real
 * scoring screen's pieces (score card, Scorecard, Balls): Riverside
 * Warriors 168/6 in 20 overs, Hilltop Hawks 142/4 after 16.3. No database.
 */

const MATCH_ID = "preview";
const idOf = (name: string) => name.toLowerCase().replace(/[^a-z]+/g, "-");
const person = (name: string) => ({ id: idOf(name), full_name: name });

const RIVERSIDE = [
  "Ishaan Verma",
  "Tom Pereira",
  "Nikhil Das",
  "Pranav Patel",
  "Leo Fernandes",
  "Sahil Gupta",
  "Rahul Desai",
  "Yash Kale",
  "Imran Qureshi",
  "Aaron Fernandes",
  "Owen D'Souza",
];
const HILLTOP = [
  "Rohan Iyer",
  "Dev Malhotra",
  "Arjun Mehta",
  "Sameer Khan",
  "Vikram Rao",
  "Kabir Shah",
  "Aditya Nair",
  "Faisal Ali",
  "Gaurav Joshi",
  "Harsh Vora",
  "Jay Kulkarni",
];

const squad = (team: string, names: readonly string[]): TeamPlayer[] =>
  names.map((name, i) => ({
    id: `${team}-${idOf(name)}`,
    team_id: team,
    user_id: idOf(name),
    batting_order: i + 1,
    role_in_team: "player",
    user: person(name) as TeamPlayer["user"],
  }));

export const SIDES: ScoringSide[] = [
  { id: "hil", name: "Hilltop Hawks", players: squad("hil", HILLTOP) },
  { id: "riv", name: "Riverside Warriors", players: squad("riv", RIVERSIDE) },
];

const bat = (
  innings: string,
  name: string,
  position: number,
  runs: number,
  balls: number,
  fours: number,
  sixes: number,
  dismissal: string | null,
): BattingPerformance =>
  ({
    id: `${innings}-${idOf(name)}`,
    match_id: MATCH_ID,
    innings_id: innings,
    user_id: idOf(name),
    batting_position: position,
    runs_scored: runs,
    balls_faced: balls,
    fours,
    sixes,
    is_out: dismissal !== null,
    dismissal_type: dismissal,
    user: person(name),
  }) as BattingPerformance;

const bowl = (
  innings: string,
  name: string,
  balls: number,
  maidens: number,
  runs: number,
  wickets: number,
): BowlingPerformance =>
  ({
    id: `${innings}-${idOf(name)}`,
    match_id: MATCH_ID,
    innings_id: innings,
    user_id: idOf(name),
    overs_bowled: Math.floor(balls / 6) + (balls % 6) / 10,
    balls_bowled: balls,
    maidens,
    runs_conceded: runs,
    wickets_taken: wickets,
    user: person(name),
  }) as BowlingPerformance;

/** As stored: ids only (the screen names them from the squads). */
const fall = (
  innings: string,
  n: number,
  runs: number,
  overs: number,
  out: string,
  type: string,
  bowler: string | null,
  fielder: string | null = null,
): FallOfWicket => ({
  id: `${innings}-w${n}`,
  match_id: MATCH_ID,
  innings_id: innings,
  wicket_number: n,
  runs_at_fall: runs,
  overs_at_fall: overs,
  batsman_out_id: idOf(out),
  dismissal_type: type,
  bowler_id: bowler ? idOf(bowler) : null,
  fielder_id: fielder ? idOf(fielder) : null,
});

const FIRST: Innings = {
  id: "inn-1",
  match_id: MATCH_ID,
  innings_number: 1,
  team_id: "riv",
  total_runs: 168,
  total_wickets: 6,
  total_balls: 120,
  total_overs: 20,
  is_completed: true,
  extras_total: 9,
  extras_byes: 1,
  extras_leg_byes: 2,
  extras_wides: 5,
  extras_no_balls: 1,
  extras_penalties: 0,
  batting_performances: [
    bat("inn-1", "Ishaan Verma", 1, 64, 45, 6, 3, "caught"),
    bat("inn-1", "Tom Pereira", 2, 22, 18, 3, 0, "bowled"),
    bat("inn-1", "Nikhil Das", 3, 41, 28, 2, 2, "caught"),
    bat("inn-1", "Pranav Patel", 4, 18, 12, 1, 1, "run_out"),
    bat("inn-1", "Leo Fernandes", 5, 5, 6, 0, 0, "lbw"),
    bat("inn-1", "Sahil Gupta", 6, 3, 4, 0, 0, "caught"),
    bat("inn-1", "Rahul Desai", 7, 4, 5, 0, 0, null),
    bat("inn-1", "Yash Kale", 8, 2, 2, 0, 0, null),
  ],
  bowling_performances: [
    bowl("inn-1", "Sameer Khan", 24, 0, 33, 1),
    bowl("inn-1", "Vikram Rao", 24, 0, 29, 1),
    bowl("inn-1", "Dev Malhotra", 24, 0, 38, 1),
    bowl("inn-1", "Kabir Shah", 24, 0, 35, 1),
    bowl("inn-1", "Rohan Iyer", 24, 0, 24, 1),
  ],
  fall_of_wickets: [
    fall("inn-1", 1, 40, 5.1, "Tom Pereira", "bowled", "Vikram Rao"),
    fall("inn-1", 2, 98, 11.2, "Ishaan Verma", "caught", "Sameer Khan", "Kabir Shah"),
    fall("inn-1", 3, 130, 15, "Nikhil Das", "caught", "Dev Malhotra", "Rohan Iyer"),
    fall("inn-1", 4, 148, 17.1, "Pranav Patel", "run_out", null, "Arjun Mehta"),
    fall("inn-1", 5, 155, 18.2, "Leo Fernandes", "lbw", "Kabir Shah"),
    fall("inn-1", 6, 160, 19, "Sahil Gupta", "caught", "Rohan Iyer", "Rohan Iyer"),
  ],
} as Innings;

export const CHASE: Innings = {
  id: "inn-2",
  match_id: MATCH_ID,
  innings_number: 2,
  team_id: "hil",
  total_runs: 142,
  total_wickets: 4,
  total_balls: 99,
  total_overs: 16.3,
  is_completed: false,
  target_runs: 169,
  extras_total: 7,
  extras_byes: 0,
  extras_leg_byes: 2,
  extras_wides: 4,
  extras_no_balls: 1,
  extras_penalties: 0,
  batting_performances: [
    bat("inn-2", "Rohan Iyer", 1, 31, 22, 4, 1, "caught"),
    bat("inn-2", "Dev Malhotra", 2, 9, 11, 1, 0, "bowled"),
    bat("inn-2", "Arjun Mehta", 3, 58, 41, 5, 2, null),
    bat("inn-2", "Sameer Khan", 4, 21, 13, 2, 1, "run_out"),
    bat("inn-2", "Vikram Rao", 5, 4, 6, 0, 0, "lbw"),
    bat("inn-2", "Kabir Shah", 6, 12, 9, 1, 0, null),
  ],
  bowling_performances: [
    bowl("inn-2", "Imran Qureshi", 15, 0, 19, 1),
    bowl("inn-2", "Aaron Fernandes", 24, 0, 31, 1),
    bowl("inn-2", "Nikhil Das", 24, 0, 36, 0),
    bowl("inn-2", "Pranav Patel", 18, 0, 27, 1),
    bowl("inn-2", "Owen D'Souza", 18, 0, 22, 0),
  ],
  fall_of_wickets: [
    fall("inn-2", 1, 38, 5.2, "Dev Malhotra", "bowled", "Aaron Fernandes"),
    fall("inn-2", 2, 71, 9.4, "Rohan Iyer", "caught", "Imran Qureshi", "Pranav Patel"),
    fall("inn-2", 3, 118, 13.6, "Sameer Khan", "run_out", null, "Nikhil Das"),
    fall("inn-2", 4, 121, 14.1, "Vikram Rao", "lbw", "Pranav Patel"),
  ],
  partnerships: [
    { batsman1_id: idOf("Arjun Mehta"), batsman2_id: idOf("Kabir Shah"), runs: 21, balls: 15, is_current: true },
  ],
} as Innings;

export const MATCH: Match = {
  id: MATCH_ID,
  title: "Summer League · Match 12",
  match_format: "T20",
  overs_per_innings: 20,
  balls_per_over: 6,
  status: "live",
  current_innings: 2,
  current_over: 16,
  current_ball: 3,
  team1_id: "riv",
  team2_id: "hil",
  team1: { id: "riv", name: "Riverside Warriors", short_name: "RIV" },
  team2: { id: "hil", name: "Hilltop Hawks", short_name: "HIL" },
  innings: [FIRST, CHASE],
} as Match;

export const STRIKER = { id: idOf("Arjun Mehta"), name: "Arjun Mehta", runs: 58, balls: 41, fours: 5, sixes: 2, isStriker: true };
export const NON_STRIKER = { id: idOf("Kabir Shah"), name: "Kabir Shah", runs: 12, balls: 9, fours: 1, sixes: 0, isStriker: false };
export const BOWLER = { id: idOf("Imran Qureshi"), name: "Imran Qureshi", overs: 2.3, maidens: 0, runs: 19, wickets: 1 };
export const LAST_BALLS = ["1", "0", "4"];

/** The batting side's squad, for the opening batters dialog. */
export const HILLTOP_SQUAD = SIDES[0]!.players;

/** The chase's ball log: its last four overs (enough for the Balls view). */
type Spec = [label: string, bowler: string, extra?: Partial<LoggedBall>];
const OVERS: Array<[over: number, bowler: string, balls: Spec[]]> = [
  [13, "Nikhil Das", [["4", "Nikhil Das"], ["4", "Nikhil Das"], ["1", "Nikhil Das"], ["0", "Nikhil Das"], ["lb1", "Nikhil Das", { runs_scored: 0, extras: 1, extra_type: "leg_bye" }], ["1", "Nikhil Das"]]],
  [14, "Pranav Patel", [["W", "Pranav Patel", { runs_scored: 0, is_wicket: true, dismissal_type: "lbw", dismissed_player_id: idOf("Vikram Rao"), batsman_id: idOf("Vikram Rao") }], ["1", "Pranav Patel"], ["0", "Pranav Patel"], ["4", "Pranav Patel"], ["1", "Pranav Patel"], ["2", "Pranav Patel"]]],
  [15, "Owen D'Souza", [["1", "Owen D'Souza"], ["wd", "Owen D'Souza", { runs_scored: 0, extras: 1, extra_type: "wide" }], ["2", "Owen D'Souza"], ["6", "Owen D'Souza"], ["0", "Owen D'Souza"], ["1", "Owen D'Souza"], ["1", "Owen D'Souza"]]],
  [16, "Imran Qureshi", [["1", "Imran Qureshi"], ["0", "Imran Qureshi"], ["4", "Imran Qureshi"]]],
];

export const BALL_LOG: LoggedBall[] = OVERS.flatMap(([over, , balls]) => {
  let legal = 0;
  return balls.map(([label, bowler, extra = {}], i) => {
    const wide = extra.extra_type === "wide";
    if (!wide) legal += 1;
    return {
      id: `b${over}.${i}`,
      innings_id: CHASE.id,
      over_number: over,
      ball_number: wide ? legal + 1 : legal,
      seq: over * 10 + i,
      runs_scored: /^\d+$/.test(label) ? Number(label) : 0,
      extras: 0,
      extra_type: null,
      is_wicket: false,
      dismissal_type: null,
      dismissed_player_id: null,
      fielder_id: null,
      bowler_id: idOf(bowler),
      batsman_id: idOf("Arjun Mehta"),
      non_striker_id: idOf("Kabir Shah"),
      ...extra,
    } as LoggedBall;
  });
});
