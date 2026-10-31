/**
 * Offline Scoring Engine
 * 
 * A pure module for processing cricket deliveries locally without side effects.
 * Calculates state transitions for scores, player stats, and match progression.
 */

import type { ScoringState } from "~/app/matches/types";
import { NON_BOWLER_DISMISSALS } from "~/lib/firebase/scoring/recompute";
import type { TeamPlayer } from "~/lib/match-types";

/**
 * Context containing all state required to process a delivery.
 */
export interface LocalScoringContext {
  currentInnings: number;
  currentOver: number;
  currentBall: number; // 0-based within over
  totalRuns: number;
  totalWickets: number;
  totalBalls: number; // legal deliveries only
  strikerId: string | null;
  nonStrikerId: string | null;
  bowlerId: string | null;
  strikerRuns: number;
  strikerBalls: number;
  nonStrikerRuns: number;
  nonStrikerBalls: number;
  bowlerRunsConceded: number;
  bowlerBallsBowled: number; // legal balls only
  bowlerWickets: number;
  ballsPerOver: number;
  oversPerInnings: number;
  wicketsPerInnings: number;
  targetRuns: number | null;
  /**
   * The match's balls-faced rules (as the server's engine applies them):
   * a no-ball is faced unless switched off; a wide only when switched on.
   */
  noBallCountsAsFaced?: boolean;
  wideCountsAsFaced?: boolean;
}

/**
 * Extended context that also contains the resulting match state after the delivery.
 */
export interface DeliveryResult extends LocalScoringContext {
  overCompleted: boolean;
  needsBatsman: boolean;
  needsBowler: boolean;
  inningsCompleted: boolean;
  matchCompleted: boolean;
  resultDescription: string | null;
}

/**
 * Simplified event representing a single delivery.
 */
export interface BallInput {
  runsScored?: number;  // runs by batsman
  extras?: number;      // extra runs
  extraType?: 'wide' | 'no_ball' | 'bye' | 'leg_bye' | 'penalty' | 'bonus' | null;
  isWicket?: boolean;
  dismissalType?: string | null;
  dismissedPlayerId?: string | null;
  /** On a no-ball: the runs completed were byes / leg byes (in `extras`). */
  noBallRuns?: 'bat' | 'bye' | 'leg_bye' | null;
}

/**
 * Structure of match data expected by the helper function.
 */
export interface MatchLike {
  current_innings: number;
  current_over: number;
  current_ball: number;
  overs_per_innings: number;
  balls_per_over?: number | null;
  wickets_per_innings?: number | null;
  noball_counts_as_ball_faced?: boolean | null;
  wide_counts_as_ball_faced?: boolean | null;
  innings?: Array<{
    innings_number: number;
    total_runs: number;
    total_wickets: number;
    total_balls: number;
    target_runs?: number | null;
    batting_performances?: Array<{
      user_id: string;
      runs_scored: number;
      balls_faced: number;
    }>;
    bowling_performances?: Array<{
      user_id: string;
      runs_conceded: number;
      balls_bowled: number;
      wickets_taken: number;
    }>;
  }>;
}

/**
 * Processes a single cricket delivery and returns the next scoring context state.
 * 
 * @param ctx The current scoring context state before the delivery
 * @param ball Information about the delivery
 * @returns The resulting delivery state including match progression flags
 */
export function processDeliveryLocally(ctx: LocalScoringContext, ball: BallInput): DeliveryResult {
  // Guard: If innings or match is already completed, do not allow further deliveries
  const isAllOut = ctx.totalWickets >= ctx.wicketsPerInnings;
  const isOversExhausted =
    ctx.oversPerInnings > 0 &&
    (ctx.totalBalls >= ctx.oversPerInnings * ctx.ballsPerOver ||
      (ctx.currentOver >= ctx.oversPerInnings && ctx.currentBall === 0));
  const isTargetChased =
    ctx.targetRuns !== null && ctx.totalRuns >= ctx.targetRuns;

  if (isAllOut || isOversExhausted || isTargetChased) {
    const inningsCompleted = true;
    const matchCompleted = ctx.currentInnings >= 2;
    let resultDescription = null;
    if (matchCompleted && ctx.targetRuns !== null) {
      if (ctx.totalRuns >= ctx.targetRuns) {
        resultDescription = `Batting team won by ${ctx.wicketsPerInnings - ctx.totalWickets} wickets`;
      } else if (ctx.totalRuns === ctx.targetRuns - 1) {
        resultDescription = "Match tied";
      } else {
        resultDescription = `Bowling team won by ${ctx.targetRuns - 1 - ctx.totalRuns} runs`;
      }
    } else if (matchCompleted) {
      resultDescription = "Match completed";
    }

    return {
      ...ctx,
      overCompleted: false,
      needsBatsman: false,
      needsBowler: false,
      inningsCompleted,
      matchCompleted,
      resultDescription,
    };
  }

  const newCtx = { ...ctx };
  
  let isLegal = true;
  let runsToTotal = 0;
  let runsToBatsman = 0;
  let runsToBowler = 0;
  let ballsToBatsman = 1;
  let swapStrike = false;

  const runsScored = ball.runsScored || 0;
  const extras = ball.extras || 0;

  if (ball.extraType === 'wide') {
    isLegal = false;
    runsToTotal = extras;
    runsToBowler = extras;
    ballsToBatsman = ctx.wideCountsAsFaced ? 1 : 0;
    // The runs they ran on a wide (after the 1-run penalty) cross them
    // when odd, as the server's engine has it.
    const ran = runsScored > 0 ? runsScored : Math.max(0, extras - 1);
    if (ran % 2 !== 0) swapStrike = true;
  } else if (ball.extraType === 'no_ball') {
    isLegal = false;
    // Byes off a no-ball: in `extras` after the penalty, not the bowler's.
    const byes =
      ball.noBallRuns === 'bye' || ball.noBallRuns === 'leg_bye'
        ? Math.max(0, extras - 1)
        : 0;
    runsToTotal = extras + runsScored;
    runsToBowler = extras - byes + runsScored;
    runsToBatsman = runsScored;
    // The striker received it (unless the match leaves no-balls out).
    ballsToBatsman = ctx.noBallCountsAsFaced === false ? 0 : 1;
    if ((runsScored + byes) % 2 !== 0) swapStrike = true;
  } else if (ball.extraType === 'bye' || ball.extraType === 'leg_bye') {
    isLegal = true;
    runsToTotal = extras;
    runsToBowler = 0; // Byes and leg byes don't count against bowler
    runsToBatsman = 0;
    if (extras % 2 !== 0) swapStrike = true;
  } else if (ball.extraType === 'penalty' || ball.extraType === 'bonus') {
    isLegal = false;
    runsToTotal = extras;
    runsToBowler = 0;
    runsToBatsman = 0;
    ballsToBatsman = 0;
  } else {
    // Normal legal delivery
    isLegal = true;
    runsToTotal = runsScored;
    runsToBowler = runsScored;
    runsToBatsman = runsScored;
    if (runsScored % 2 !== 0) swapStrike = true;
  }

  // Update total scores
  newCtx.totalRuns += runsToTotal;
  
  // Update striker stats
  newCtx.strikerRuns += runsToBatsman;
  newCtx.strikerBalls += ballsToBatsman;
  
  // Update bowler stats
  newCtx.bowlerRunsConceded += runsToBowler;

  if (isLegal) {
    newCtx.totalBalls += 1;
    newCtx.currentBall += 1;
    newCtx.bowlerBallsBowled += 1;
  }

  if (ball.isWicket) {
    const isRetiredHurt = ball.dismissalType === "retired_hurt";
    if (!isRetiredHurt) {
      newCtx.totalWickets += 1;
    }

    if (!NON_BOWLER_DISMISSALS.has(ball.dismissalType ?? "")) {
      newCtx.bowlerWickets += 1;
    }
  }

  // Delivery strike rotation
  if (swapStrike) {
    const tempId = newCtx.strikerId;
    const tempRuns = newCtx.strikerRuns;
    const tempBalls = newCtx.strikerBalls;

    newCtx.strikerId = newCtx.nonStrikerId;
    newCtx.strikerRuns = newCtx.nonStrikerRuns;
    newCtx.strikerBalls = newCtx.nonStrikerBalls;

    newCtx.nonStrikerId = tempId;
    newCtx.nonStrikerRuns = tempRuns;
    newCtx.nonStrikerBalls = tempBalls;
  }

  // Clear crease for dismissed batsman
  if (ball.isWicket) {
    const dismissedId = ball.dismissedPlayerId ?? ctx.strikerId;
    if (dismissedId && dismissedId === newCtx.nonStrikerId) {
      newCtx.nonStrikerId = null;
      newCtx.nonStrikerRuns = 0;
      newCtx.nonStrikerBalls = 0;
    } else {
      newCtx.strikerId = null;
      newCtx.strikerRuns = 0;
      newCtx.strikerBalls = 0;
    }
  }

  let overCompleted = false;
  let needsBowler = false;

  // Over completion logic (only for legal deliveries)
  if (newCtx.currentBall >= newCtx.ballsPerOver) {
    overCompleted = true;
    newCtx.currentOver += 1;
    newCtx.currentBall = 0;
    needsBowler = true;
    
    // End of over strike rotation
    const tempId = newCtx.strikerId;
    const tempRuns = newCtx.strikerRuns;
    const tempBalls = newCtx.strikerBalls;

    newCtx.strikerId = newCtx.nonStrikerId;
    newCtx.strikerRuns = newCtx.nonStrikerRuns;
    newCtx.strikerBalls = newCtx.nonStrikerBalls;

    newCtx.nonStrikerId = tempId;
    newCtx.nonStrikerRuns = tempRuns;
    newCtx.nonStrikerBalls = tempBalls;
  }

  // Innings completion conditions
  let inningsCompleted = false;
  
  if (newCtx.totalWickets >= newCtx.wicketsPerInnings) {
    inningsCompleted = true; // All out
  } else if (
    newCtx.oversPerInnings > 0 &&
    (newCtx.totalBalls >= newCtx.oversPerInnings * newCtx.ballsPerOver ||
      (overCompleted && newCtx.currentOver >= newCtx.oversPerInnings))
  ) {
    inningsCompleted = true; // Overs exhausted
  } else if (newCtx.targetRuns !== null && newCtx.totalRuns >= newCtx.targetRuns) {
    inningsCompleted = true; // Target chased
  }

  let needsBatsman = false;
  if (!inningsCompleted && (ball.isWicket || newCtx.strikerId === null || newCtx.nonStrikerId === null)) {
    needsBatsman = true;
  }

  // Match completion logic
  let matchCompleted = false;
  let resultDescription = null;

  if (inningsCompleted && newCtx.currentInnings >= 2) {
    matchCompleted = true;
    if (newCtx.targetRuns !== null) {
      if (newCtx.totalRuns >= newCtx.targetRuns) {
        resultDescription = `Batting team won by ${newCtx.wicketsPerInnings - newCtx.totalWickets} wickets`;
      } else if (newCtx.totalRuns === newCtx.targetRuns - 1) {
        resultDescription = 'Match tied';
      } else {
        resultDescription = `Bowling team won by ${newCtx.targetRuns - 1 - newCtx.totalRuns} runs`;
      }
    } else {
      resultDescription = 'Match completed';
    }
  }

  return {
    ...newCtx,
    overCompleted,
    needsBatsman,
    needsBowler,
    inningsCompleted,
    matchCompleted,
    resultDescription
  };
}

/**
 * Helper to construct a local scoring context from existing match data.
 * 
 * @param match The base match state
 * @param strikerId The active striker's ID
 * @param nonStrikerId The active non-striker's ID
 * @param bowlerId The active bowler's ID
 * @returns An initialized LocalScoringContext ready for processDeliveryLocally
 */
export function buildContextFromMatch(
  match: MatchLike,
  strikerId: string | null,
  nonStrikerId: string | null,
  bowlerId: string | null
): LocalScoringContext {
  const innings = match.innings?.find((i) => i.innings_number === match.current_innings);

  let strikerRuns = 0;
  let strikerBalls = 0;
  let nonStrikerRuns = 0;
  let nonStrikerBalls = 0;

  if (innings?.batting_performances) {
    const strikerPerf = innings.batting_performances.find(p => p.user_id === strikerId);
    if (strikerPerf) {
      strikerRuns = strikerPerf.runs_scored;
      strikerBalls = strikerPerf.balls_faced;
    }
    const nonStrikerPerf = innings.batting_performances.find(p => p.user_id === nonStrikerId);
    if (nonStrikerPerf) {
      nonStrikerRuns = nonStrikerPerf.runs_scored;
      nonStrikerBalls = nonStrikerPerf.balls_faced;
    }
  }

  let bowlerRuns = 0;
  let bowlerBalls = 0;
  let bowlerWickets = 0;

  if (innings?.bowling_performances) {
    const bowlerPerf = innings.bowling_performances.find(p => p.user_id === bowlerId);
    if (bowlerPerf) {
      bowlerRuns = bowlerPerf.runs_conceded;
      bowlerBalls = bowlerPerf.balls_bowled;
      bowlerWickets = bowlerPerf.wickets_taken;
    }
  }

  return {
    currentInnings: match.current_innings ?? 1,
    currentOver: match.current_over ?? 0,
    currentBall: match.current_ball ?? 0,
    totalRuns: innings?.total_runs || 0,
    totalWickets: innings?.total_wickets || 0,
    totalBalls: innings?.total_balls || 0,
    strikerId,
    nonStrikerId,
    bowlerId,
    strikerRuns,
    strikerBalls,
    nonStrikerRuns,
    nonStrikerBalls,
    bowlerRunsConceded: bowlerRuns,
    bowlerBallsBowled: bowlerBalls,
    bowlerWickets,
    ballsPerOver: match.balls_per_over || 6,
    oversPerInnings:
      match.current_innings && match.current_innings > 2
        ? 1
        : (match.overs_per_innings ?? 20),
    wicketsPerInnings:
      match.current_innings && match.current_innings > 2
        ? 2
        : (match.wickets_per_innings || 10),
    noBallCountsAsFaced: match.noball_counts_as_ball_faced !== false,
    wideCountsAsFaced: Boolean(match.wide_counts_as_ball_faced),
    targetRuns: innings?.target_runs || null
  };
}

/**
 * Converts a DeliveryResult from the local scoring engine into a DB-shaped ScoringState
 * compatible with the UI optimistically updating state.
 */
export function deliveryResultToScoringState(
  res: LocalScoringContext & Partial<DeliveryResult>,
  prevBowlerId: string | null,
  battingPlayers: TeamPlayer[],
  bowlingPlayers: TeamPlayer[],
  ball?: BallInput,
): ScoringState {
  const striker = battingPlayers.find((p) => p.user_id === res.strikerId);
  const nonStriker = battingPlayers.find((p) => p.user_id === res.nonStrikerId);
  const bowler = bowlingPlayers.find(
    (p) => p.user_id === (res.bowlerId ?? prevBowlerId),
  );

  const bowlerOvers =
    Math.floor(res.bowlerBallsBowled / res.ballsPerOver) +
    (res.bowlerBallsBowled % res.ballsPerOver) / 10;

  const isCompleted = res.matchCompleted ?? false;
  const inningsCompleted = res.inningsCompleted ?? false;
  const needsBowler = !inningsCompleted && (res.needsBowler ?? false);
  const needsBatsman =
    !inningsCompleted &&
    ((res.needsBatsman ?? false) || res.strikerId === null || res.nonStrikerId === null);
  const overCompleted = res.overCompleted ?? false;

  return {
    ok: true,
    status: isCompleted ? "completed" : "live",
    current_innings: res.currentInnings,
    current_over: res.currentOver,
    current_ball: res.currentBall,
    total_runs: res.totalRuns,
    total_wickets: res.totalWickets,
    total_balls: res.totalBalls,
    target_runs: res.targetRuns,
    is_completed: isCompleted,
    striker_id: res.strikerId,
    non_striker_id: res.nonStrikerId,
    striker_name: striker?.user?.full_name ?? (res.strikerId ? "Striker" : null),
    non_striker_name: nonStriker?.user?.full_name ?? (res.nonStrikerId ? "Non-Striker" : null),
    striker_runs: res.strikerId ? res.strikerRuns : null,
    striker_balls: res.strikerId ? res.strikerBalls : null,
    non_striker_runs: res.nonStrikerId ? res.nonStrikerRuns : null,
    non_striker_balls: res.nonStrikerId ? res.nonStrikerBalls : null,
    needs_batsman: needsBatsman,
    needs_bowler: needsBowler,
    bowler_id: needsBowler ? null : res.bowlerId,
    bowler_name: bowler?.user?.full_name ?? "Bowler",
    bowler_overs: bowlerOvers,
    bowler_maidens: 0,
    bowler_runs: res.bowlerRunsConceded,
    bowler_wickets: res.bowlerWickets,
    last_bowler_id: needsBowler ? prevBowlerId : undefined,
    last_bowler_name: bowler?.user?.full_name ?? "Bowler",
    last_bowler_overs: bowlerOvers,
    last_bowler_maidens: 0,
    last_bowler_runs: res.bowlerRunsConceded,
    last_bowler_wickets: res.bowlerWickets,
    over_completed: overCompleted,
    last_over_bowler_id: overCompleted ? prevBowlerId : undefined,
    innings_completed: inningsCompleted,
    match_completed: isCompleted,
    result_description: res.resultDescription ?? null,
    innings_break: inningsCompleted && !isCompleted,
    runs_scored: ball ? (ball.runsScored ?? 0) : null,
    extras: ball ? (ball.extras ?? 0) : null,
    extra_type: ball?.extraType ?? null,
    is_wicket: ball?.isWicket ?? null,
    dismissal_type: ball?.dismissalType ?? null,
  };
}
