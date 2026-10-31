/**
 * Pure innings recomputation, ported from the former `recompute_innings`
 * Postgres function.
 *
 * Given the match rules and the ordered ball log for one innings, it derives
 * every batting / bowling performance, fall of wicket, partnership, the
 * innings totals and the live over/ball position. Scoring mutations call it
 * inside a Firestore transaction after every change to the ball log so the
 * derived data can never drift from the deliveries.
 */

import type {
  BallByBallRow,
  BattingPerformancesRow,
  BowlingPerformancesRow,
  FallOfWicketsRow,
  InningsRow,
  MatchesRow,
  PartnershipsRow,
} from "../types";

export type BallInput = Omit<BallByBallRow, "created_at"> & {
  created_at?: string | null;
};

export interface RecomputeInput {
  match: Pick<
    MatchesRow,
    | "id"
    | "balls_per_over"
    | "max_balls_per_over"
    | "wide_runs_to_batsman"
    | "noball_extras_to_batsman"
    | "wide_counts_as_ball_faced"
    | "noball_counts_as_ball_faced"
  >;
  innings: Pick<InningsRow, "id" | "match_id"> &
    Partial<Pick<InningsRow, "team_id">>;
  /** Ball log for this innings in `seq` order. */
  balls: BallInput[];
  existingBatting: BattingPerformancesRow[];
  existingBowling: BowlingPerformancesRow[];
  now: string;
}

export interface RecomputeOutput {
  inningsPatch: Partial<InningsRow>;
  matchPatch: Pick<MatchesRow, "current_over" | "current_ball">;
  batting: BattingPerformancesRow[];
  bowling: BowlingPerformancesRow[];
  fallOfWickets: FallOfWicketsRow[];
  partnerships: PartnershipsRow[];
  /** Whether the last legal ball closed an over (bowler must be re-selected). */
  overJustEnded: boolean;
}

export const NON_BOWLER_DISMISSALS = new Set([
  "run_out",
  "retired_hurt",
  "retired_out",
  "obstructing",
]);

/**
 * A batter a log entry names after they retired hurt has resumed their
 * innings (Law 25.4.2): they are no longer retired.
 */
export function resumeIfRetiredHurt(
  bp: Pick<
    BattingPerformancesRow,
    "is_out" | "dismissal_type" | "bowler_id" | "fielder_id"
  >,
): void {
  if (bp.is_out || bp.dismissal_type !== "retired_hurt") return;
  bp.dismissal_type = null;
  bp.bowler_id = null;
  bp.fielder_id = null;
}

/** Each batter's share of a stand that starts now. */
export const NEW_STAND_SPLIT = {
  batsman1_runs: 0,
  batsman1_balls: 0,
  batsman2_runs: 0,
  batsman2_balls: 0,
} as const;

/**
 * Adds a delivery to the striker's share of `stand`: the runs credited to
 * them and the ball if they faced it (the batting card's rules). A stand
 * recorded before shares were kept has none and gets none (a share of only
 * its later balls would be wrong); the next recompute fills them.
 */
export function creditStand(
  stand: PartnershipsRow,
  strikerId: string | null,
  runs: number,
  faced: boolean,
): void {
  if (stand.batsman1_runs == null || stand.batsman2_runs == null) return;
  const ball = faced ? 1 : 0;
  if (strikerId === stand.batsman1_id) {
    stand.batsman1_runs += runs;
    stand.batsman1_balls = (stand.batsman1_balls ?? 0) + ball;
  } else if (strikerId === stand.batsman2_id) {
    stand.batsman2_runs += runs;
    stand.batsman2_balls = (stand.batsman2_balls ?? 0) + ball;
  }
}

/** Postgres `ROUND(FLOOR(balls / bpo) + (balls % bpo) / 10, 1)`. */
export function oversFromBalls(balls: number, ballsPerOver: number): number {
  const bpo = ballsPerOver > 0 ? ballsPerOver : 6;
  return Math.round((Math.floor(balls / bpo) + (balls % bpo) / 10) * 10) / 10;
}

export function isLegalDelivery(ball: {
  bowler_id?: string | null;
  extra_type?: string | null;
}): boolean {
  if (!ball.bowler_id) return false;
  const t = ball.extra_type;
  return !(t === "wide" || t === "no_ball" || t === "penalty" || t === "bonus");
}

/**
 * Whether a fielding-side penalty event (`penalty_team_id` set) adds runs to
 * this innings: only when that team bats it. The event is logged in that
 * team's latest innings when they have batted; otherwise in the innings in
 * progress, and starting their innings carries a copy into its ball log.
 */
export function penaltyCountsFor(
  ball: Pick<BallInput, "penalty_team_id">,
  innings: Partial<Pick<InningsRow, "team_id">>,
): boolean {
  return !!ball.penalty_team_id && ball.penalty_team_id === innings.team_id;
}

/** The no-ball penalty, in `extras` of a no-ball (the rest are its byes). */
export const NO_BALL_PENALTY = 1;

/**
 * The byes or leg byes completed off a no-ball the bat did not touch
 * (`no_ball_runs`), held in its `extras` after the penalty; null for any
 * other ball, and for a no-ball whose runs were off the bat.
 */
export function noBallByesOf(ball: {
  extra_type?: string | null;
  extras?: number | null;
  no_ball_runs?: string | null;
}): { kind: "bye" | "leg_bye"; runs: number } | null {
  if (ball.extra_type !== "no_ball") return null;
  const kind = ball.no_ball_runs;
  if (kind !== "bye" && kind !== "leg_bye") return null;
  return { kind, runs: Math.max(0, (ball.extras ?? 0) - NO_BALL_PENALTY) };
}

/** The wide penalty, in `extras` of a wide (the rest the batters ran). */
export const WIDE_PENALTY = 1;

/**
 * The runs the batters ran (or the boundary) on a wide, held in its
 * `extras` after the penalty (as the scoring screen records a wide). They
 * count as wides, but an odd number of them crosses the batters like any
 * other runs (a boundary, four, does not). A wide that carries runs in
 * `runs_scored` (older and imported balls) has its penalty alone in
 * `extras`: those runs already decide the crossing.
 */
export function wideRunsOf(ball: {
  extra_type?: string | null;
  extras?: number | null;
  runs_scored?: number | null;
}): number {
  if (ball.extra_type !== "wide" || (ball.runs_scored ?? 0) > 0) return 0;
  return Math.max(0, (ball.extras ?? 0) - WIDE_PENALTY);
}

/** What the bowler is charged for `ball` (not byes, leg byes or penalties). */
export function bowlerConcedes(ball: {
  runs_scored?: number | null;
  extras?: number | null;
  extra_type?: string | null;
  no_ball_runs?: string | null;
}): number {
  const runs = ball.runs_scored ?? 0;
  const extras = ball.extras ?? 0;
  const t = ball.extra_type;
  if (t === "bye" || t === "leg_bye" || t === "penalty" || t === "bonus")
    return runs;
  // Byes off a no-ball are not the bowler's: only the penalty is.
  const byes = noBallByesOf(ball);
  return runs + extras - (byes?.runs ?? 0);
}

// ---------------------------------------------------------------------------
// One log entry's effects, shared by the replay below and the one-ball
// engine (`incremental.ts`), so both stay one implementation.
// ---------------------------------------------------------------------------

type MatchRules = RecomputeInput["match"];

/** What `ball` gives the striker: runs credited, and whether they faced it. */
export interface BatterCredit {
  runs: number;
  faced: boolean;
}

/**
 * Whether a no-ball counts as a ball the striker faced: it does (the
 * striker receives it and may score off it; a wide they cannot), unless the
 * match switched it off (`noball_counts_as_ball_faced` false: some junior
 * and pairs formats). Null or absent: on.
 */
export function noBallCountsAsFaced(match: {
  noball_counts_as_ball_faced?: boolean | null;
}): boolean {
  return match.noball_counts_as_ball_faced !== false;
}

/**
 * Whether the striker faced `ball`: a legal delivery or a no-ball (unless
 * the match leaves no-balls out), a wide only when the match counts them.
 * Events between balls (no bowler) never.
 */
export function ballFaced(
  match: {
    noball_counts_as_ball_faced?: boolean | null;
    wide_counts_as_ball_faced?: boolean | null;
  },
  ball: { bowler_id?: string | null; extra_type?: string | null },
): boolean {
  if (!ball.bowler_id) return false;
  if (ball.extra_type === "no_ball") return noBallCountsAsFaced(match);
  if (ball.extra_type === "wide") return Boolean(match.wide_counts_as_ball_faced);
  return isLegalDelivery(ball);
}

export function batterCreditOf(
  match: MatchRules,
  ball: BallInput,
): BatterCredit {
  const extrasToBatter =
    (ball.extra_type === "wide" && match.wide_runs_to_batsman) ||
    (ball.extra_type === "no_ball" && match.noball_extras_to_batsman);
  // Byes off a no-ball are never the striker's runs.
  const byes = noBallByesOf(ball);
  return {
    runs:
      (ball.runs_scored ?? 0) +
      (extrasToBatter ? (ball.extras ?? 0) - (byes?.runs ?? 0) : 0),
    faced: ballFaced(match, ball),
  };
}

/** Adds `ball` to the striker's figures. */
export function creditBatter(
  bp: BattingPerformancesRow,
  ball: BallInput,
  credit: BatterCredit,
): void {
  bp.runs_scored = (bp.runs_scored ?? 0) + credit.runs;
  bp.balls_faced = (bp.balls_faced ?? 0) + (credit.faced ? 1 : 0);
  if (ball.runs_scored === 4) bp.fours = (bp.fours ?? 0) + 1;
  if (ball.runs_scored === 6) bp.sixes = (bp.sixes ?? 0) + 1;
}

/** Adds `ball` to the bowler's figures (a maiden needs the whole over). */
export function creditBowler(
  bw: BowlingPerformancesRow,
  ball: BallInput,
): void {
  bw.balls_bowled = (bw.balls_bowled ?? 0) + (isLegalDelivery(ball) ? 1 : 0);
  bw.runs_conceded = (bw.runs_conceded ?? 0) + bowlerConcedes(ball);
  if (ball.extra_type === "wide") bw.wides = (bw.wides ?? 0) + 1;
  if (ball.extra_type === "no_ball") bw.no_balls = (bw.no_balls ?? 0) + 1;
  if (ball.is_wicket && !NON_BOWLER_DISMISSALS.has(ball.dismissal_type ?? "")) {
    bw.wickets_taken = (bw.wickets_taken ?? 0) + 1;
  }
}

/** An innings' running totals (its `total_*` / `extras_*` fields). */
export interface InningsTotals {
  runs: number;
  wickets: number;
  byes: number;
  legByes: number;
  wides: number;
  noBalls: number;
  penalties: number;
  bonuses: number;
}

const EXTRAS_FIELD = new Map<string, keyof InningsTotals>([
  ["bye", "byes"],
  ["leg_bye", "legByes"],
  ["wide", "wides"],
  ["no_ball", "noBalls"],
  ["penalty", "penalties"],
  ["bonus", "bonuses"],
]);

/** Adds `ball`'s runs and extras (a wicket is counted with the dismissal). */
export function addToTotals(totals: InningsTotals, ball: BallInput): void {
  const extras = ball.extras ?? 0;
  totals.runs += (ball.runs_scored ?? 0) + extras;
  const byes = noBallByesOf(ball);
  if (byes) {
    // The penalty is a no-ball extra; the runs completed are byes.
    totals.noBalls += extras - byes.runs;
    totals[byes.kind === "bye" ? "byes" : "legByes"] += byes.runs;
    return;
  }
  const field = EXTRAS_FIELD.get(ball.extra_type ?? "");
  if (field) totals[field] += extras;
}

/** The innings and match patches of `totals` after `legal` legal balls. */
export function totalsPatches(
  totals: InningsTotals,
  legal: number,
  bpo: number,
  now: string,
): Pick<RecomputeOutput, "inningsPatch" | "matchPatch"> {
  return {
    inningsPatch: {
      total_runs: totals.runs,
      total_wickets: totals.wickets,
      total_balls: legal,
      total_overs: oversFromBalls(legal, bpo),
      extras_total:
        totals.byes +
        totals.legByes +
        totals.wides +
        totals.noBalls +
        totals.penalties +
        totals.bonuses,
      extras_byes: totals.byes,
      extras_leg_byes: totals.legByes,
      extras_wides: totals.wides,
      extras_no_balls: totals.noBalls,
      extras_penalties: totals.penalties,
      extras_bonuses: totals.bonuses,
      updated_at: now,
    },
    matchPatch: {
      current_over: Math.floor(legal / bpo),
      current_ball: legal % bpo,
    },
  };
}

/** Whether recording `ball` starts a new partnership row. */
export function startsNewPartnership(
  ball: Pick<BallInput, "batsman_id" | "non_striker_id">,
  current: Pick<PartnershipsRow, "batsman1_id" | "batsman2_id"> | null,
): boolean {
  if (!current) return true;
  const a = current.batsman1_id;
  const b = current.batsman2_id;
  return !(
    (ball.batsman_id === a && ball.non_striker_id === b) ||
    (ball.batsman_id === b && ball.non_striker_id === a)
  );
}

/** The stand `ball`'s pair starts, the `number`th of the innings. */
export function newStandRow(args: {
  inningsId: string;
  matchId: string;
  number: number;
  ball: BallInput;
  startOver: number;
  now: string;
}): PartnershipsRow {
  return {
    id: `${args.inningsId}_p${args.number}`,
    match_id: args.matchId,
    innings_id: args.inningsId,
    batsman1_id: args.ball.batsman_id!,
    batsman2_id: args.ball.non_striker_id!,
    wicket_number: null,
    runs: 0,
    balls: 0,
    ...NEW_STAND_SPLIT,
    start_over: args.startOver,
    end_over: null,
    is_current: true,
    created_at: args.now,
    updated_at: args.now,
  };
}

/** Adds `ball` to the stand of the pair at the crease. */
export function addToStand(
  stand: PartnershipsRow,
  ball: BallInput,
  credit: BatterCredit,
): void {
  stand.runs = (stand.runs ?? 0) + (ball.runs_scored ?? 0) + (ball.extras ?? 0);
  // The balls the pair faced (as their shares count them).
  stand.balls = (stand.balls ?? 0) + (credit.faced ? 1 : 0);
  creditStand(stand, ball.batsman_id, credit.runs, credit.faced);
}

/** `bp` dismissed by `ball` (retired hurt is not out). */
export function dismissBatter(
  bp: BattingPerformancesRow,
  ball: BallInput,
): void {
  const hurt = ball.dismissal_type === "retired_hurt";
  bp.is_out = !hurt;
  bp.dismissal_type = hurt ? "retired_hurt" : (ball.dismissal_type ?? null);
  bp.bowler_id = ball.bowler_id ?? null;
  bp.fielder_id = ball.fielder_id ?? null;
}

/** The fall of the `wicket`th wicket, taken by `ball`. */
export function fallOfWicketRow(args: {
  inningsId: string;
  matchId: string;
  wicket: number;
  runsAtFall: number;
  oversAtFall: number;
  batterId: string;
  ball: BallInput;
  now: string;
}): FallOfWicketsRow {
  return {
    id: `${args.inningsId}_w${args.wicket}`,
    match_id: args.matchId,
    innings_id: args.inningsId,
    wicket_number: args.wicket,
    runs_at_fall: args.runsAtFall,
    overs_at_fall: args.oversAtFall,
    batsman_out_id: args.batterId,
    dismissal_type: args.ball.dismissal_type ?? "bowled",
    bowler_id: args.ball.bowler_id ?? null,
    fielder_id: args.ball.fielder_id ?? null,
    created_at: args.now,
  };
}

/** Who is at each end. */
export interface Ends {
  striker: string | null;
  nonStriker: string | null;
}

/**
 * The ends after `ball` (by its batter `ball.batsman_id`), before an over's
 * end swaps them; `dismissedId` left the crease (null: that end is empty).
 */
export function endsAfterBall(
  ball: BallInput,
  dismissedId: string | null,
): Ends {
  // Runs the batters ran that are not off the bat: byes and leg byes
  // (off a no-ball too) and the runs on a wide.
  const byeRuns =
    ball.extra_type === "bye" || ball.extra_type === "leg_bye"
      ? (ball.extras ?? 0)
      : (noBallByesOf(ball)?.runs ?? 0) + wideRunsOf(ball);
  const swap = ((ball.runs_scored ?? 0) + byeRuns) % 2 === 1;
  const batter = ball.batsman_id;
  const partner = ball.non_striker_id ?? null;
  if (!ball.is_wicket) {
    return swap
      ? { striker: partner, nonStriker: batter }
      : { striker: batter, nonStriker: partner };
  }
  if (dismissedId === ball.non_striker_id) {
    return swap
      ? { striker: null, nonStriker: batter }
      : { striker: batter, nonStriker: null };
  }
  if (ball.dismissal_type === "run_out" && swap) {
    return { striker: partner, nonStriker: null };
  }
  return { striker: null, nonStriker: partner };
}

// ---------------------------------------------------------------------------
// The replay
// ---------------------------------------------------------------------------

/** A replay of one innings' ball log: its rows and running figures. */
interface Replay {
  match: MatchRules;
  innings: RecomputeInput["innings"];
  inningsId: string;
  matchId: string;
  bpo: number;
  now: string;
  batting: Map<string, BattingPerformancesRow>;
  bowling: Map<string, BowlingPerformancesRow>;
  maxPosition: number;
  fallOfWickets: FallOfWicketsRow[];
  partnerships: PartnershipsRow[];
  /** The stand in progress (none before the first ball or after a wicket). */
  stand: PartnershipsRow | null;
  totals: InningsTotals;
  legal: number;
  /** What each over conceded, over the whole log (maidens, as SQL did). */
  overTotals: Map<number, number>;
  ends: Ends;
  lastBowler: string | null;
  overNumber: number;
  ballsInOver: number;
  overJustEnded: boolean;
  /** The bowler of the over the last ball ended (not allowed the next one). */
  endedOverBowler: string | null;
  /** Who the log's last entry retired hurt (not to be put back at the crease). */
  retiredByLast: string | null;
}

/** The replay's start: the stored rows with their figures cleared. */
function startReplay(input: RecomputeInput): Replay {
  const { match, innings, now } = input;
  const r: Replay = {
    match,
    innings,
    inningsId: innings.id,
    matchId: innings.match_id ?? match.id,
    bpo:
      match.balls_per_over && match.balls_per_over > 0
        ? match.balls_per_over
        : 6,
    now,
    batting: new Map(),
    bowling: new Map(),
    maxPosition: 0,
    fallOfWickets: [],
    partnerships: [],
    stand: null,
    totals: {
      runs: 0,
      wickets: 0,
      byes: 0,
      legByes: 0,
      wides: 0,
      noBalls: 0,
      penalties: 0,
      bonuses: 0,
    },
    legal: 0,
    overTotals: new Map(),
    ends: { striker: null, nonStriker: null },
    lastBowler: null,
    overNumber: 0,
    ballsInOver: 0,
    overJustEnded: false,
    endedOverBowler: null,
    retiredByLast: null,
  };
  // Reset existing performance rows (keeping ids and batting positions).
  for (const bp of input.existingBatting) {
    r.batting.set(bp.user_id, {
      ...bp,
      runs_scored: 0,
      balls_faced: 0,
      fours: 0,
      sixes: 0,
      is_out: false,
      dismissal_type: null,
      bowler_id: null,
      fielder_id: null,
      is_current_batsman: false,
      is_striker: false,
      updated_at: now,
    });
    r.maxPosition = Math.max(r.maxPosition, bp.batting_position ?? 0);
  }
  for (const bw of input.existingBowling) {
    r.bowling.set(bw.user_id, {
      ...bw,
      balls_bowled: 0,
      runs_conceded: 0,
      wickets_taken: 0,
      maidens: 0,
      wides: 0,
      no_balls: 0,
      overs_bowled: 0,
      is_current_bowler: false,
      updated_at: now,
    });
  }
  for (const ball of input.balls) {
    const conceded = r.overTotals.get(ball.over_number) ?? 0;
    r.overTotals.set(ball.over_number, conceded + bowlerConcedes(ball));
  }
  return r;
}

function ensureBatter(r: Replay, userId: string | null | undefined): void {
  if (!userId || r.batting.has(userId)) return;
  r.maxPosition += 1;
  r.batting.set(userId, {
    id: `${r.inningsId}_${userId}`,
    match_id: r.matchId,
    innings_id: r.inningsId,
    user_id: userId,
    batting_position: r.maxPosition,
    runs_scored: 0,
    balls_faced: 0,
    minutes_batted: 0,
    fours: 0,
    sixes: 0,
    is_out: false,
    dismissal_type: null,
    bowler_id: null,
    fielder_id: null,
    is_current_batsman: false,
    is_striker: false,
    created_at: r.now,
    updated_at: r.now,
  });
}

function ensureBowler(r: Replay, userId: string | null | undefined): void {
  if (!userId || r.bowling.has(userId)) return;
  r.bowling.set(userId, {
    id: `${r.inningsId}_${userId}`,
    match_id: r.matchId,
    innings_id: r.inningsId,
    user_id: userId,
    overs_bowled: 0,
    balls_bowled: 0,
    runs_conceded: 0,
    wickets_taken: 0,
    maidens: 0,
    wides: 0,
    no_balls: 0,
    is_current_bowler: false,
    created_at: r.now,
    updated_at: r.now,
  });
}

/**
 * Penalty runs awarded to a fielding side (see `penaltyCountsFor`): only
 * runs for the team that bats this innings; no effect on the crease, the
 * over or the bowler.
 */
function replayFieldingPenalty(r: Replay, ball: BallInput): void {
  if (!penaltyCountsFor(ball, r.innings)) return;
  r.totals.runs += (ball.runs_scored ?? 0) + (ball.extras ?? 0);
  if (ball.extra_type === "bonus") r.totals.bonuses += ball.extras ?? 0;
  else r.totals.penalties += ball.extras ?? 0;
}

/** The stand `ball` adds to, started when the pair at the crease changes. */
function replayStand(r: Replay, ball: BallInput, credit: BatterCredit): void {
  if (!r.stand || startsNewPartnership(ball, r.stand)) {
    if (r.stand) {
      r.stand.is_current = false;
      r.stand.end_over = oversFromBalls(r.legal, r.bpo);
    }
    const legalBefore = r.legal - (isLegalDelivery(ball) ? 1 : 0);
    r.stand = newStandRow({
      inningsId: r.inningsId,
      matchId: r.matchId,
      number: r.partnerships.length + 1,
      ball,
      startOver: oversFromBalls(legalBefore, r.bpo),
      now: r.now,
    });
    r.partnerships.push(r.stand);
  }
  addToStand(r.stand, ball, credit);
}

/**
 * The dismissal `ball` records (retired hurt is not out and not a wicket);
 * returns who left the crease.
 */
function replayWicket(r: Replay, ball: BallInput): string | null {
  const dismissedId = ball.dismissed_player_id ?? ball.batsman_id ?? null;
  if (dismissedId) ensureBatter(r, dismissedId);
  if (ball.dismissal_type === "retired_hurt") {
    r.retiredByLast = dismissedId;
  } else {
    r.totals.wickets += 1;
    if (dismissedId) {
      r.fallOfWickets.push(
        fallOfWicketRow({
          inningsId: r.inningsId,
          matchId: r.matchId,
          wicket: r.totals.wickets,
          runsAtFall: r.totals.runs,
          oversAtFall: oversFromBalls(r.legal, r.bpo),
          batterId: dismissedId,
          ball,
          now: r.now,
        }),
      );
    }
  }
  const bp = dismissedId ? r.batting.get(dismissedId) : undefined;
  if (bp) {
    dismissBatter(bp, ball);
    bp.is_current_batsman = false;
    bp.is_striker = false;
  }
  if (r.stand) {
    r.stand.is_current = false;
    r.stand.end_over = oversFromBalls(r.legal, r.bpo);
    r.stand.wicket_number = r.totals.wickets;
    r.stand = null;
  }
  return dismissedId;
}

/** An over that `ball` ends: the ends swap, the bowler may get a maiden. */
function replayOverEnd(r: Replay, ball: BallInput): void {
  const max = r.match.max_balls_per_over;
  r.overJustEnded =
    (isLegalDelivery(ball) && r.legal % r.bpo === 0) ||
    (max !== null && max !== undefined && r.ballsInOver >= max);
  if (!r.overJustEnded) return;
  r.ends = { striker: r.ends.nonStriker, nonStriker: r.ends.striker };
  if (ball.bowler_id && (r.overTotals.get(ball.over_number) ?? 0) === 0) {
    const bw = r.bowling.get(ball.bowler_id)!;
    bw.maidens = (bw.maidens ?? 0) + 1;
  }
  r.endedOverBowler = ball.bowler_id ?? null;
  r.lastBowler = null;
}

/** One log entry applied to the replay. */
function replayEntry(r: Replay, ball: BallInput): void {
  if (ball.penalty_team_id) {
    replayFieldingPenalty(r, ball);
    return;
  }
  if (ball.bowler_id) r.lastBowler = ball.bowler_id;
  if (ball.over_number !== r.overNumber) {
    r.overNumber = ball.over_number;
    r.ballsInOver = 1;
  } else {
    r.ballsInOver += 1;
  }

  ensureBatter(r, ball.batsman_id);
  ensureBatter(r, ball.non_striker_id);
  ensureBowler(r, ball.bowler_id);
  r.retiredByLast = null;
  for (const id of [ball.batsman_id, ball.non_striker_id]) {
    if (id) resumeIfRetiredHurt(r.batting.get(id)!);
  }

  const credit = batterCreditOf(r.match, ball);
  if (ball.batsman_id)
    creditBatter(r.batting.get(ball.batsman_id)!, ball, credit);
  if (ball.bowler_id) creditBowler(r.bowling.get(ball.bowler_id)!, ball);
  r.legal += isLegalDelivery(ball) ? 1 : 0;
  addToTotals(r.totals, ball);
  if (ball.batsman_id && ball.non_striker_id) replayStand(r, ball, credit);
  const dismissedId = ball.is_wicket ? replayWicket(r, ball) : null;
  if (ball.batsman_id) r.ends = endsAfterBall(ball, dismissedId);
  replayOverEnd(r, ball);
}

/**
 * An end the log leaves empty (after a wicket, an over, or before the
 * first ball) keeps whom the scorer has put there since the last ball:
 * `set_current_batsmen` choices the log cannot hold yet. Without this,
 * undoing or editing a ball would lose them.
 */
function keepChosenCrease(r: Replay, existing: BattingPerformancesRow[]): void {
  if (r.ends.striker !== null && r.ends.nonStriker !== null) return;
  // Never someone the log has sent off: out, or retired by its last
  // entry. A batter who retired hurt before that may have been brought
  // back, and stays until they bat again.
  const chosen = existing.filter((b) => {
    const now = r.batting.get(b.user_id);
    return (
      b.is_current_batsman &&
      now &&
      !now.is_out &&
      (!now.dismissal_type ||
        (now.dismissal_type === "retired_hurt" &&
          b.user_id !== r.retiredByLast))
    );
  });
  const striker = chosen.find((b) => b.is_striker);
  const nonStriker = chosen.find((b) => !b.is_striker);
  const stillIn = [r.ends.striker, r.ends.nonStriker].filter(
    (id): id is string => id !== null,
  );
  if (
    striker &&
    nonStriker &&
    stillIn.every((id) => id === striker.user_id || id === nonStriker.user_id)
  ) {
    r.ends = { striker: striker.user_id, nonStriker: nonStriker.user_id };
  }
}

/**
 * Marks the crease and the current bowler. With no bowler in the over yet,
 * the one the scorer chose since the last ball stays (`set_current_bowler`),
 * unless they bowled the over just ended.
 */
function markCurrent(r: Replay, existing: BowlingPerformancesRow[]): void {
  const chosenBowler =
    r.lastBowler === null
      ? (existing.find(
          (b) => b.is_current_bowler && b.user_id !== r.endedOverBowler,
        )?.user_id ?? null)
      : null;

  const striker = r.ends.striker ? r.batting.get(r.ends.striker) : undefined;
  if (striker) {
    striker.is_current_batsman = true;
    striker.is_striker = true;
  }
  const nonStriker = r.ends.nonStriker
    ? r.batting.get(r.ends.nonStriker)
    : undefined;
  if (nonStriker) {
    nonStriker.is_current_batsman = true;
    nonStriker.is_striker = false;
  }

  for (const bw of r.bowling.values()) {
    bw.overs_bowled = oversFromBalls(bw.balls_bowled ?? 0, r.bpo);
    if (chosenBowler) {
      bw.is_current_bowler = bw.user_id === chosenBowler;
    } else if (r.overJustEnded) {
      bw.is_current_bowler = false;
    } else if (r.lastBowler) {
      bw.is_current_bowler = bw.user_id === r.lastBowler;
    }
  }
}

/** Players the ball log names (their rows stay, whatever their figures). */
function namedPlayers(balls: BallInput[]): Set<string> {
  const named = new Set<string>();
  for (const ball of balls) {
    for (const id of [
      ball.batsman_id,
      ball.non_striker_id,
      ball.bowler_id,
      ball.dismissed_player_id,
    ]) {
      if (id) named.add(id);
    }
  }
  return named;
}

export function recomputeInnings(input: RecomputeInput): RecomputeOutput {
  const r = startReplay(input);
  for (const ball of input.balls) replayEntry(r, ball);
  keepChosenCrease(r, input.existingBatting);
  markCurrent(r, input.existingBowling);

  // A batter or bowler the log does not name, with nothing recorded and
  // no longer at the crease or bowling (brought in after a ball since
  // undone or edited away), has no place on the scorecard.
  const named = namedPlayers(input.balls);
  return {
    ...totalsPatches(r.totals, r.legal, r.bpo, r.now),
    batting: Array.from(r.batting.values()).filter(
      (b) =>
        named.has(b.user_id) ||
        b.is_current_batsman ||
        b.is_out ||
        Boolean(b.dismissal_type) ||
        (b.balls_faced ?? 0) > 0 ||
        (b.runs_scored ?? 0) > 0,
    ),
    bowling: Array.from(r.bowling.values()).filter(
      (b) =>
        named.has(b.user_id) ||
        b.is_current_bowler ||
        (b.balls_bowled ?? 0) > 0 ||
        (b.runs_conceded ?? 0) > 0 ||
        (b.wickets_taken ?? 0) > 0 ||
        (b.wides ?? 0) > 0 ||
        (b.no_balls ?? 0) > 0,
    ),
    fallOfWickets: r.fallOfWickets,
    partnerships: r.partnerships,
    overJustEnded: r.overJustEnded,
  };
}
