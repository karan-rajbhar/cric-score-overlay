/**
 * The overlay's demo match (`/overlay/test`): two fictional sides, a full
 * first innings and a chase at 18.4 overs, built ball by ball from a fixed
 * seed so the scorecards, fall of wickets, stands, charts and wagon wheel
 * all agree. No real players or teams.
 */

import type {
  LiveMatchState,
  OverlaySnapshots,
} from "~/components/overlay/types";
import type { PlayerProfile } from "~/components/overlay/overlay-data";
import type { LiveEvent, LiveLastWicket } from "~/lib/firebase/types";
import type {
  BallEvent,
  BattingPerformance,
  BowlingPerformance,
  FallOfWicket,
  Innings,
  InningsPartnership,
  Match,
  MatchTeam,
  TeamPlayer,
} from "~/lib/match-types";
import { SECTORS } from "~/lib/wagon-wheel-utils";

const MATCH_ID = "test";
const OVERS = 20;

interface DemoTeam {
  id: string;
  name: string;
  short: string;
  players: { id: string; name: string; role: string }[];
}

const team = (
  id: string,
  name: string,
  short: string,
  names: string[],
): DemoTeam => ({
  id,
  name,
  short,
  players: names.map((n, i) => ({
    id: `${id}-p${i + 1}`,
    name: n,
    role: i < 5 ? "Batter" : i < 7 ? "All-rounder" : "Bowler",
  })),
});

const RANGERS = team("demo-rangers", "Riverside Rangers", "RIV", [
  "Arjun Mehta",
  "Sam Whitfield",
  "Leo Fernandes",
  "Nikhil Rao",
  "Tom Ashby",
  "Ravi Iyer",
  "Ben Carter",
  "Omar Siddiqui",
  "Jay Patel",
  "Max Holloway",
  "Dev Nair",
]);

const HAWKS = team("demo-hawks", "Harbour Hawks", "HAW", [
  "Ethan Brooks",
  "Kabir Shah",
  "Noah Pereira",
  "Rohan Desai",
  "Callum Price",
  "Imran Qureshi",
  "Luke Bennett",
  "Aditya Kulkarni",
  "Ryan Moss",
  "Faisal Khan",
  "Owen Hughes",
]);

/** Deterministic PRNG (mulberry32). */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Outcome = { runs: number; wide?: boolean; wicket?: string };

function outcome(r: number): Outcome {
  if (r < 0.03) return { runs: 0, wide: true };
  if (r < 0.065) return { runs: 0, wicket: r < 0.05 ? "caught" : "bowled" };
  if (r < 0.39) return { runs: 0 };
  if (r < 0.74) return { runs: 1 };
  if (r < 0.83) return { runs: 2 };
  if (r < 0.84) return { runs: 3 };
  if (r < 0.95) return { runs: 4 };
  return { runs: 6 };
}

interface SimInnings {
  innings: Innings;
  balls: BallEvent[];
  striker: string;
  nonStriker: string;
  bowler: string;
  thisOver: string[];
  partnership: { runs: number; balls: number };
  lastWicket: LiveLastWicket | null;
}

const nameOf = (id: string) =>
  [...RANGERS.players, ...HAWKS.players].find((p) => p.id === id)?.name ?? "";

function simulate(
  number: number,
  bat: DemoTeam,
  bowl: DemoTeam,
  seed: number,
  maxLegal: number,
  seqStart: number,
): SimInnings {
  const rand = rng(seed);
  const inningsId = `demo-inn-${number}`;
  const batting = new Map<string, BattingPerformance>();
  const bowling = new Map<string, BowlingPerformance>();
  const fow: FallOfWicket[] = [];
  const stands: InningsPartnership[] = [];
  const balls: BallEvent[] = [];
  const batter = (id: string, pos: number): BattingPerformance => {
    const row = batting.get(id) ?? {
      id: `${inningsId}-bat-${id}`,
      match_id: MATCH_ID,
      innings_id: inningsId,
      user_id: id,
      batting_position: pos,
      runs_scored: 0,
      balls_faced: 0,
      fours: 0,
      sixes: 0,
      is_out: false,
      dismissal_type: null,
      user: { id, full_name: nameOf(id) },
    };
    batting.set(id, row);
    return row;
  };
  const bowlerRow = (id: string): BowlingPerformance => {
    const row = bowling.get(id) ?? {
      id: `${inningsId}-bowl-${id}`,
      match_id: MATCH_ID,
      innings_id: inningsId,
      user_id: id,
      overs_bowled: 0,
      balls_bowled: 0,
      runs_conceded: 0,
      wickets_taken: 0,
      maidens: 0,
      wides: 0,
      no_balls: 0,
      user: { id, full_name: nameOf(id) },
    };
    bowling.set(id, row);
    return row;
  };
  const attack = bowl.players.slice(6).map((p) => p.id);
  let next = 2;
  let striker = bat.players[0]!.id;
  let nonStriker = bat.players[1]!.id;
  batter(striker, 1);
  batter(nonStriker, 2);
  let legal = 0;
  let runs = 0;
  let wickets = 0;
  let extras = 0;
  let wides = 0;
  let seq = seqStart;
  let thisOver: string[] = [];
  let overRuns = 0;
  let stand = { runs: 0, balls: 0, b1: striker, b2: nonStriker, r1: 0, r2: 0, f1: 0, f2: 0 };
  let lastWicket: LiveLastWicket | null = null;
  let bowler = attack[0]!;

  while (legal < maxLegal && wickets < 10) {
    const over = Math.floor(legal / 6);
    bowler = attack[over % attack.length]!;
    const o = outcome(rand());
    seq += 1;
    const b = bowlerRow(bowler);
    const zone =
      o.runs > 0 ? SECTORS[Math.floor(rand() * SECTORS.length)]!.id : null;
    balls.push({
      id: `${inningsId}-b${seq}`,
      match_id: MATCH_ID,
      innings_id: inningsId,
      innings: { innings_number: number, team_id: bat.id },
      over_number: over,
      ball_number: (legal % 6) + 1,
      batsman_id: striker,
      non_striker_id: nonStriker,
      bowler_id: bowler,
      runs_scored: o.wide ? 0 : o.runs,
      extras: o.wide ? 1 : 0,
      extra_type: o.wide ? "wide" : null,
      is_wicket: !!o.wicket,
      dismissal_type: o.wicket ?? null,
      dismissed_player_id: o.wicket ? striker : null,
      shot_zone: zone,
      seq,
    });
    if (o.wide) {
      runs += 1;
      extras += 1;
      wides += 1;
      overRuns += 1;
      b.runs_conceded += 1;
      b.wides += 1;
      stand.runs += 1;
      thisOver.push("wd");
      continue;
    }
    legal += 1;
    b.balls_bowled += 1;
    const s = batter(striker, 0);
    s.balls_faced += 1;
    stand.balls += 1;
    if (stand.b1 === striker) stand.f1 += 1;
    else stand.f2 += 1;
    if (o.wicket) {
      wickets += 1;
      b.wickets_taken += 1;
      s.is_out = true;
      s.dismissal_type = o.wicket;
      thisOver.push("W");
      fow.push({
        id: `${inningsId}-fow-${wickets}`,
        match_id: MATCH_ID,
        innings_id: inningsId,
        wicket_number: wickets,
        runs_at_fall: runs,
        overs_at_fall: Number(`${Math.floor(legal / 6)}.${legal % 6}`),
        batsman_out_id: striker,
        dismissal_type: o.wicket,
        bowler_id: bowler,
        batsman: { id: striker, full_name: nameOf(striker) },
      });
      lastWicket = {
        player_id: striker,
        name: nameOf(striker),
        runs: s.runs_scored,
        balls: s.balls_faced,
        dismissal_type: o.wicket,
        bowler_name: nameOf(bowler),
        wicket_number: wickets,
        score: runs,
        overs: Number(`${Math.floor(legal / 6)}.${legal % 6}`),
      };
      stands.push({
        batsman1_id: stand.b1,
        batsman2_id: stand.b2,
        wicket_number: wickets,
        runs: stand.runs,
        balls: stand.balls,
        batsman1_runs: stand.r1,
        batsman1_balls: stand.f1,
        batsman2_runs: stand.r2,
        batsman2_balls: stand.f2,
      });
      if (wickets < 10) {
        striker = bat.players[next]!.id;
        batter(striker, next + 1);
        next += 1;
        stand = { runs: 0, balls: 0, b1: nonStriker, b2: striker, r1: 0, r2: 0, f1: 0, f2: 0 };
      }
    } else {
      runs += o.runs;
      overRuns += o.runs;
      s.runs_scored += o.runs;
      if (o.runs === 4) s.fours += 1;
      if (o.runs === 6) s.sixes += 1;
      b.runs_conceded += o.runs;
      stand.runs += o.runs;
      if (stand.b1 === striker) stand.r1 += o.runs;
      else stand.r2 += o.runs;
      thisOver.push(String(o.runs));
      if (o.runs % 2 === 1) [striker, nonStriker] = [nonStriker, striker];
    }
    if (legal % 6 === 0) {
      if (overRuns === 0) b.maidens += 1;
      b.overs_bowled = Math.floor(b.balls_bowled / 6);
      [striker, nonStriker] = [nonStriker, striker];
      if (legal < maxLegal) thisOver = [];
      overRuns = 0;
    }
  }
  for (const b of bowling.values()) {
    b.overs_bowled = Number(`${Math.floor(b.balls_bowled / 6)}.${b.balls_bowled % 6}`);
  }
  const completed = legal >= OVERS * 6 || wickets >= 10;
  if (!completed) {
    stands.push({
      batsman1_id: stand.b1,
      batsman2_id: stand.b2,
      runs: stand.runs,
      balls: stand.balls,
      batsman1_runs: stand.r1,
      batsman1_balls: stand.f1,
      batsman2_runs: stand.r2,
      batsman2_balls: stand.f2,
      is_current: true,
    });
  }
  for (const id of [striker, nonStriker]) {
    const row = batting.get(id);
    if (row && !completed) {
      row.is_current_batsman = true;
      row.is_striker = id === striker;
    }
  }
  const current = bowling.get(bowler);
  if (current && !completed) current.is_current_bowler = true;
  return {
    innings: {
      id: inningsId,
      match_id: MATCH_ID,
      innings_number: number,
      team_id: bat.id,
      total_runs: runs,
      total_wickets: wickets,
      total_balls: legal,
      total_overs: Math.floor(legal / 6),
      is_completed: completed,
      extras_total: extras,
      extras_byes: 0,
      extras_leg_byes: 0,
      extras_wides: wides,
      extras_no_balls: 0,
      extras_penalties: 0,
      batting_performances: [...batting.values()].sort(
        (a, b) => (a.batting_position ?? 0) - (b.batting_position ?? 0),
      ),
      bowling_performances: [...bowling.values()],
      fall_of_wickets: fow,
      partnerships: stands,
      ball_by_ball: balls,
    },
    balls,
    striker,
    nonStriker,
    bowler,
    thisOver,
    partnership: { runs: stand.runs, balls: stand.balls },
    lastWicket,
  };
}

/** Seeds whose chase ends up close at 18.4 overs (a few to choose from). */
function buildDemo() {
  for (let seed = 7; seed < 400; seed += 1) {
    const first = simulate(1, HAWKS, RANGERS, seed, OVERS * 6, 0);
    const target = first.innings.total_runs + 1;
    const second = simulate(2, RANGERS, HAWKS, seed * 31 + 3, 112, first.balls.length);
    const need = target - second.innings.total_runs;
    if (
      first.innings.total_runs >= 150 &&
      second.innings.total_wickets <= 6 &&
      need >= 12 &&
      need <= 24
    ) {
      second.innings.target_runs = target;
      return { first, second, target, seed };
    }
  }
  throw new Error("demo: no seed gives a close chase");
}

const {
  first: FIRST,
  second: SECOND,
  target: TARGET,
  seed: SEED,
} = buildDemo();

const squad = (t: DemoTeam): TeamPlayer[] =>
  t.players.map((p, i) => ({
    id: `${t.id}-tp${i + 1}`,
    team_id: t.id,
    user_id: p.id,
    batting_order: i + 1,
    is_playing_xi: true,
    role_in_team: p.role,
    user: { id: p.id, full_name: p.name },
  }));

const matchTeam = (t: DemoTeam): MatchTeam => ({
  id: t.id,
  name: t.name,
  short_name: t.short,
  logo_url: null,
  team_players: squad(t),
});

const inn2 = SECOND.innings;
const strikerRow = inn2.batting_performances!.find(
  (b) => b.user_id === SECOND.striker,
)!;
const nonStrikerRow = inn2.batting_performances!.find(
  (b) => b.user_id === SECOND.nonStriker,
)!;
const bowlerRow = inn2.bowling_performances!.find(
  (b) => b.user_id === SECOND.bowler,
)!;
const lastBall = SECOND.balls[SECOND.balls.length - 1]!;
const ballsLeft = OVERS * 6 - inn2.total_balls;
const needed = TARGET - inn2.total_runs;
const round2 = (n: number) => Math.round(n * 100) / 100;

export const DEMO_MATCH_STATE: LiveMatchState = {
  match_id: MATCH_ID,
  title: "Metro T20 League · Final",
  tournament_name: "Metro T20 League",
  status: "live",
  match_format: "T20",
  overs_per_innings: OVERS,
  venue: "Victoria Park, Northfield",
  current_innings: 2,
  current_over: Math.floor(inn2.total_balls / 6),
  current_ball: inn2.total_balls % 6,
  result_type: null,
  result_description: null,
  toss_winner_team_id: HAWKS.id,
  toss_decision: "bat",
  umpire1_name: "Peter Lane",
  umpire2_name: "Suresh Menon",
  team1_name: RANGERS.name,
  team1_short_name: RANGERS.short,
  team1_logo_url: null,
  team2_name: HAWKS.name,
  team2_short_name: HAWKS.short,
  team2_logo_url: null,
  winning_team_name: null,
  innings_number: 2,
  total_runs: inn2.total_runs,
  total_wickets: inn2.total_wickets,
  total_overs: inn2.total_overs,
  total_balls: inn2.total_balls,
  extras_total: inn2.extras_total,
  innings_completed: false,
  target_runs: TARGET,
  batting_team_name: RANGERS.name,
  batting_team_short_name: RANGERS.short,
  bowling_team_name: HAWKS.name,
  bowling_team_short_name: HAWKS.short,
  striker_name: nameOf(SECOND.striker),
  striker_runs: strikerRow.runs_scored,
  striker_balls: strikerRow.balls_faced,
  non_striker_name: nameOf(SECOND.nonStriker),
  non_striker_runs: nonStrikerRow.runs_scored,
  non_striker_balls: nonStrikerRow.balls_faced,
  current_bowler_name: nameOf(SECOND.bowler),
  bowler_balls: bowlerRow.balls_bowled,
  bowler_runs: bowlerRow.runs_conceded,
  bowler_wickets: bowlerRow.wickets_taken,
  partnership_runs: SECOND.partnership.runs,
  partnership_balls: SECOND.partnership.balls,
  this_over_balls: SECOND.thisOver.join(" "),
  this_over_runs: SECOND.thisOver.reduce(
    (n, t) => n + (t === "wd" ? 1 : t === "W" ? 0 : Number(t)),
    0,
  ),
  current_run_rate: round2((inn2.total_runs * 6) / inn2.total_balls),
  runs_needed: needed,
  balls_remaining: ballsLeft,
  required_run_rate: round2((needed * 6) / ballsLeft),
  last_ball_runs: lastBall.runs_scored,
  last_ball_extras: lastBall.extras,
  last_ball_extra_type: lastBall.extra_type ?? null,
  last_ball_is_wicket: lastBall.is_wicket,
  last_ball_dismissal_type: lastBall.dismissal_type ?? null,
  last_ball_dismissed_player: null,
  last_ball_fielder: null,
  last_ball_commentary: "Worked into the leg side and they come back for two.",
  last_ball_seq: lastBall.seq ?? null,
  striker_id: SECOND.striker,
  striker_fours: strikerRow.fours,
  striker_sixes: strikerRow.sixes,
  non_striker_id: SECOND.nonStriker,
  non_striker_fours: nonStrikerRow.fours,
  non_striker_sixes: nonStrikerRow.sixes,
  bowler_id: SECOND.bowler,
  bowler_maidens: bowlerRow.maidens,
  last_wicket: SECOND.lastWicket,
  powerplay: null,
  team_colors: {
    team1: { primary: "#0f766e", secondary: "#f8fafc" },
    team2: { primary: "#b91c1c", secondary: "#fde68a" },
  },
  events: [] as LiveEvent[],
};

export const DEMO_MATCH_DETAILS: Match = {
  id: MATCH_ID,
  title: DEMO_MATCH_STATE.title ?? "",
  match_format: "T20",
  overs_per_innings: OVERS,
  status: "live",
  current_innings: 2,
  current_over: DEMO_MATCH_STATE.current_over ?? 0,
  current_ball: DEMO_MATCH_STATE.current_ball ?? 0,
  venue: DEMO_MATCH_STATE.venue,
  scheduled_at: new Date().toISOString(),
  toss_winner_team_id: HAWKS.id,
  toss_decision: "bat",
  umpire1_name: DEMO_MATCH_STATE.umpire1_name,
  umpire2_name: DEMO_MATCH_STATE.umpire2_name,
  team1_id: RANGERS.id,
  team2_id: HAWKS.id,
  player_of_the_match: null,
  team1: matchTeam(RANGERS),
  team2: matchTeam(HAWKS),
  innings: [FIRST.innings, SECOND.innings],
  tournament: { id: "demo-league", name: "Metro T20 League" },
};

// ---- other moments of the demo match (the overlay gallery) ----------------

const FIRST_LIVE = simulate(1, HAWKS, RANGERS, SEED, 74, 0);

/** The first innings in progress (12.2 overs): a projection, a powerplay over. */
export const DEMO_FIRST_INNINGS_STATE: LiveMatchState = (() => {
  const inn = FIRST_LIVE.innings;
  const striker = inn.batting_performances!.find(
    (b) => b.user_id === FIRST_LIVE.striker,
  )!;
  const non = inn.batting_performances!.find(
    (b) => b.user_id === FIRST_LIVE.nonStriker,
  )!;
  const bowler = inn.bowling_performances!.find(
    (b) => b.user_id === FIRST_LIVE.bowler,
  )!;
  return {
    ...DEMO_MATCH_STATE,
    current_innings: 1,
    innings_number: 1,
    current_over: Math.floor(inn.total_balls / 6),
    current_ball: inn.total_balls % 6,
    total_runs: inn.total_runs,
    total_wickets: inn.total_wickets,
    total_overs: inn.total_overs,
    total_balls: inn.total_balls,
    extras_total: inn.extras_total,
    target_runs: null,
    runs_needed: null,
    balls_remaining: null,
    required_run_rate: null,
    batting_team_name: HAWKS.name,
    batting_team_short_name: HAWKS.short,
    bowling_team_name: RANGERS.name,
    bowling_team_short_name: RANGERS.short,
    striker_name: nameOf(FIRST_LIVE.striker),
    striker_id: FIRST_LIVE.striker,
    striker_runs: striker.runs_scored,
    striker_balls: striker.balls_faced,
    striker_fours: striker.fours,
    striker_sixes: striker.sixes,
    non_striker_name: nameOf(FIRST_LIVE.nonStriker),
    non_striker_id: FIRST_LIVE.nonStriker,
    non_striker_runs: non.runs_scored,
    non_striker_balls: non.balls_faced,
    non_striker_fours: non.fours,
    non_striker_sixes: non.sixes,
    current_bowler_name: nameOf(FIRST_LIVE.bowler),
    bowler_id: FIRST_LIVE.bowler,
    bowler_balls: bowler.balls_bowled,
    bowler_runs: bowler.runs_conceded,
    bowler_wickets: bowler.wickets_taken,
    bowler_maidens: bowler.maidens,
    partnership_runs: FIRST_LIVE.partnership.runs,
    partnership_balls: FIRST_LIVE.partnership.balls,
    this_over_balls: FIRST_LIVE.thisOver.join(" "),
    current_run_rate:
      Math.round(((inn.total_runs * 6) / inn.total_balls) * 100) / 100,
    last_wicket: FIRST_LIVE.lastWicket,
    powerplay: null,
  };
})();

/** Between the innings: the chase set, nobody in yet. */
export const DEMO_BREAK_STATE: LiveMatchState = {
  ...DEMO_MATCH_STATE,
  total_runs: 0,
  total_wickets: 0,
  total_overs: 0,
  total_balls: 0,
  extras_total: 0,
  current_over: 0,
  current_ball: 0,
  striker_name: null,
  striker_id: null,
  striker_runs: null,
  striker_balls: null,
  non_striker_name: null,
  non_striker_id: null,
  non_striker_runs: null,
  non_striker_balls: null,
  current_bowler_name: null,
  bowler_id: null,
  bowler_balls: null,
  bowler_runs: null,
  bowler_wickets: null,
  partnership_runs: null,
  partnership_balls: null,
  this_over_balls: null,
  this_over_runs: null,
  current_run_rate: null,
  runs_needed: TARGET,
  balls_remaining: OVERS * 6,
  required_run_rate: Math.round(((TARGET * 6) / (OVERS * 6)) * 100) / 100,
  last_wicket: null,
  last_ball_seq: FIRST.balls.length,
};

/** After the match. */
export const DEMO_RESULT_STATE: LiveMatchState = {
  ...DEMO_MATCH_STATE,
  status: "completed",
  innings_completed: true,
  result_type: "win",
  result_description: `${HAWKS.name} won by ${Math.max(1, (DEMO_MATCH_STATE.runs_needed ?? 1) - 1)} runs`,
  winning_team_name: HAWKS.name,
  runs_needed: null,
  balls_remaining: null,
  required_run_rate: null,
  bowling_team_name: null,
  bowling_team_short_name: null,
};

/** Before the first ball, toss done. */
export const DEMO_PRE_STATE: LiveMatchState = {
  ...DEMO_MATCH_STATE,
  status: "scheduled",
  current_innings: null,
  innings_number: null,
  total_runs: null,
  total_wickets: null,
  total_overs: null,
  total_balls: null,
  batting_team_name: null,
  batting_team_short_name: null,
  bowling_team_name: null,
  bowling_team_short_name: null,
  striker_name: null,
  striker_id: null,
  non_striker_name: null,
  non_striker_id: null,
  current_bowler_name: null,
  bowler_id: null,
  this_over_balls: null,
  runs_needed: null,
  balls_remaining: null,
  required_run_rate: null,
  target_runs: null,
  current_run_rate: null,
  partnership_runs: null,
  partnership_balls: null,
  last_wicket: null,
  last_ball_seq: null,
};

/** The match with its player of the match named (the result's cards). */
export const DEMO_RESULT_MATCH: Match = {
  ...DEMO_MATCH_DETAILS,
  status: "completed",
  player_of_the_match: {
    id: FIRST.innings.bowling_performances![0]!.user_id,
    full_name: nameOf(FIRST.innings.bowling_performances![0]!.user_id),
  },
};

const LEAGUE_TEAMS = [
  ["Harbour Hawks", "HAW", 5, 4, 1, 8, 0.912],
  ["Riverside Rangers", "RIV", 5, 3, 2, 6, 0.244],
  ["Hillside Comets", "HIL", 5, 3, 2, 6, -0.118],
  ["Eastgate Owls", "EAS", 5, 2, 3, 4, -0.305],
  ["Millbrook Foxes", "MIL", 5, 2, 3, 4, -0.402],
  ["Quarry Lane Kites", "QUA", 5, 1, 4, 2, -0.296],
] as const;

/** What the control room would load for a tournament match. */
export const DEMO_SNAPSHOTS: OverlaySnapshots = {
  pointsTable: {
    title: "Metro T20 League",
    rows: LEAGUE_TEAMS.map(([team, short, played, won, lost, points, nrr]) => ({
      team,
      short,
      played,
      won,
      lost,
      points,
      nrr,
      highlight: team === RANGERS.name || team === HAWKS.name,
    })),
  },
  leaderboard: {
    title: "Most runs",
    metric: "Runs",
    rows: [
      { name: "Arjun Mehta", team: RANGERS.name, value: 246, detail: "5 inns · SR 141.4" },
      { name: "Ethan Brooks", team: HAWKS.name, value: 231, detail: "5 inns · SR 133.5" },
      { name: "Callum Price", team: "Hillside Comets", value: 198, detail: "5 inns · SR 152.3" },
      { name: "Nikhil Rao", team: RANGERS.name, value: 176, detail: "5 inns · SR 128.5" },
      { name: "Kabir Shah", team: HAWKS.name, value: 160, detail: "4 inns · SR 145.4" },
    ],
  },
  nextFixture: {
    title: "Next match",
    team1: "Hillside Comets",
    team1Short: "HIL",
    team2: "Eastgate Owls",
    team2Short: "EAS",
    startsAt: "2026-11-01T09:30:00Z",
    venue: "Hillside Recreation Ground",
    round: "Round 6",
  },
  series: Object.fromEntries(
    [SECOND.striker, SECOND.nonStriker, SECOND.bowler].map((id, i) => [
      id,
      i === 2
        ? { matches: 5, wickets: 9, economy: 7.1, best: "3-18" }
        : { matches: 5, runs: 150 + i * 40, highest: "61", average: 32.5, strikeRate: 136.2 },
    ]),
  ),
};

/** A career record for the gallery's profile cards (no reads). */
export const DEMO_CAREER: PlayerProfile = {
  avatarUrl: null,
  career: {
    id: "demo-career",
    user_id: SECOND.striker,
    total_matches: 42,
    total_innings_batted: 39,
    total_runs: 1184,
    total_balls_faced: 902,
    total_fours: 121,
    total_sixes: 37,
    highest_score: 88,
    not_outs: 6,
    centuries: 0,
    half_centuries: 7,
    total_innings_bowled: 12,
    total_overs_bowled: 31,
    total_balls_bowled: 186,
    total_runs_conceded: 251,
    total_wickets: 11,
    best_bowling_figures: "3-21",
    five_wicket_hauls: 0,
    total_catches: 14,
    total_stumpings: 0,
    total_run_outs: 3,
    batting_average: 35.9,
    strike_rate: 131.3,
    bowling_average: 22.8,
    economy_rate: 8.1,
    last_updated: null,
  },
};
