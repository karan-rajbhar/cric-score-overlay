/**
 * Incremental scoring: apply one new delivery to the stored running totals.
 *
 * This mirrors exactly one iteration of the loop in `recomputeInnings`, so a
 * ball applied here produces the same rows a full recompute of the whole
 * ball log would. Recording a ball then needs only the rows the delivery
 * touches (striker, non-striker, bowler, current partnership, the balls of
 * the current over) instead of the whole innings.
 *
 * When the input does not satisfy the assumptions that make this exact (an
 * inconsistent over, `max_balls_per_over` rules, a dismissed player who is
 * not at the crease), it returns `null` and the caller falls back to the
 * full recompute, which stays the source of truth.
 */

import type {
  BattingPerformancesRow,
  BowlingPerformancesRow,
  FallOfWicketsRow,
  InningsRow,
  PartnershipsRow,
} from "../types";
import {
  addToStand,
  addToTotals,
  batterCreditOf,
  bowlerConcedes,
  creditBatter,
  creditBowler,
  dismissBatter,
  endsAfterBall,
  fallOfWicketRow,
  isLegalDelivery,
  newStandRow,
  oversFromBalls,
  resumeIfRetiredHurt,
  startsNewPartnership,
  totalsPatches,
  type BallInput,
  type BatterCredit,
  type InningsTotals,
  type RecomputeInput,
  type RecomputeOutput,
} from "./recompute";

export interface IncrementalInput {
  match: RecomputeInput["match"];
  /** The innings as stored before this ball. */
  innings: Pick<
    InningsRow,
    | "id"
    | "match_id"
    | "total_runs"
    | "total_wickets"
    | "total_balls"
    | "extras_byes"
    | "extras_leg_byes"
    | "extras_wides"
    | "extras_no_balls"
    | "extras_penalties"
    | "extras_bonuses"
  >;
  /** The new delivery (over/ball numbers already assigned). */
  ball: BallInput;
  striker: BattingPerformancesRow;
  nonStriker: BattingPerformancesRow;
  /** Null for a retirement, which is logged without a bowler. */
  bowler: BowlingPerformancesRow | null;
  /** The partnership with `is_current = true`, if any. */
  partnership: PartnershipsRow | null;
  /** Number of partnership rows in the innings; needed to start a new one. */
  partnershipCount: number | null;
  /** Balls already logged with the new ball's `over_number`. */
  overBalls: BallInput[];
  now: string;
}

export type IncrementalOutput = Omit<RecomputeOutput, "batting" | "bowling"> & {
  batting: BattingPerformancesRow[];
  bowling: BowlingPerformancesRow[];
};

function ballsPerOver(match: IncrementalInput["match"]): number {
  return match.balls_per_over && match.balls_per_over > 0
    ? match.balls_per_over
    : 6;
}

/** Retirements: logged as wickets without a bowler (not deliveries). */
export const RETIREMENT_TYPES = new Set(["retired_hurt", "retired_out"]);

/**
 * Whether `ball` is a retirement as logged at a full crease: who retired
 * (`dismissed_player_id`) and both batters, no bowler.
 */
export function isRetirementAtCrease(
  ball: Pick<
    BallInput,
    | "bowler_id"
    | "batsman_id"
    | "non_striker_id"
    | "is_wicket"
    | "dismissal_type"
  >,
): boolean {
  return (
    !ball.bowler_id &&
    Boolean(ball.batsman_id && ball.non_striker_id) &&
    Boolean(ball.is_wicket) &&
    RETIREMENT_TYPES.has(ball.dismissal_type ?? "")
  );
}

/**
 * Whether the rows given are the ones `ball` was recorded with: both
 * batters, and its bowler (a retirement has none: the recompute leaves
 * every bowler as it is).
 */
function rowsMatch(input: IncrementalInput): boolean {
  const { ball } = input;
  if (!ball.batsman_id || !ball.non_striker_id) return false;
  const bowlerMatches = isRetirementAtCrease(ball)
    ? !input.bowler
    : Boolean(ball.bowler_id) && input.bowler?.user_id === ball.bowler_id;
  return (
    bowlerMatches &&
    input.striker.user_id === ball.batsman_id &&
    input.nonStriker.user_id === ball.non_striker_id
  );
}

/**
 * Whether `ball` belongs to the over in progress and the stored over agrees
 * with the totals (maiden detection looks at every ball of the over, so a
 * mismatch could disagree with a recompute).
 */
function overMatches(input: IncrementalInput): boolean {
  const bpo = ballsPerOver(input.match);
  const legalBefore = input.innings.total_balls ?? 0;
  const overNumber = Math.floor(legalBefore / bpo);
  if (input.ball.over_number !== overNumber) return false;
  const legalInOver = input.overBalls.filter(isLegalDelivery).length;
  return (
    legalInOver === legalBefore - overNumber * bpo &&
    input.overBalls.every((b) => b.over_number === overNumber)
  );
}

function totalsOf(innings: IncrementalInput["innings"]): InningsTotals {
  return {
    runs: innings.total_runs ?? 0,
    wickets: innings.total_wickets ?? 0,
    byes: innings.extras_byes ?? 0,
    legByes: innings.extras_leg_byes ?? 0,
    wides: innings.extras_wides ?? 0,
    noBalls: innings.extras_no_balls ?? 0,
    penalties: innings.extras_penalties ?? 0,
    bonuses: innings.extras_bonuses ?? 0,
  };
}

/**
 * The stands `ball` writes: the previous one, closed when the pair at the
 * crease changes, and the one it adds to (last). Null when a new stand's
 * number is not known.
 */
function standsAfter(
  input: IncrementalInput,
  legal: { before: number; after: number },
  credit: BatterCredit,
): PartnershipsRow[] | null {
  const { match, innings, ball, now } = input;
  const bpo = ballsPerOver(match);
  const stands: PartnershipsRow[] = [];
  let current = input.partnership ? { ...input.partnership } : null;
  if (startsNewPartnership(ball, current)) {
    if (input.partnershipCount === null) return null;
    if (current) {
      current.is_current = false;
      current.end_over = oversFromBalls(legal.after, bpo);
      current.updated_at = now;
      stands.push(current);
    }
    current = newStandRow({
      inningsId: innings.id,
      matchId: innings.match_id ?? match.id,
      number: input.partnershipCount + 1,
      ball,
      startOver: oversFromBalls(legal.before, bpo),
      now,
    });
  } else {
    current = { ...current!, updated_at: now };
  }
  addToStand(current, ball, credit);
  stands.push(current);
  return stands;
}

/**
 * The dismissal `ball` records on the batters given (it closes the stand);
 * null when the dismissed batter is neither of them.
 */
function applyWicket(
  input: IncrementalInput,
  state: {
    rowOf: (id: string | null) => BattingPerformancesRow | null;
    totals: InningsTotals;
    stand: PartnershipsRow;
    legal: number;
  },
): { dismissedId: string; fallOfWickets: FallOfWicketsRow[] } | null {
  const { match, innings, ball, now } = input;
  const { totals, stand, legal } = state;
  const bpo = ballsPerOver(match);
  const dismissedId = ball.dismissed_player_id ?? ball.batsman_id;
  const bp = state.rowOf(dismissedId);
  if (!bp || !dismissedId) return null;
  const fallOfWickets: FallOfWicketsRow[] = [];
  if (ball.dismissal_type !== "retired_hurt") {
    totals.wickets += 1;
    fallOfWickets.push(
      fallOfWicketRow({
        inningsId: innings.id,
        matchId: innings.match_id ?? match.id,
        wicket: totals.wickets,
        runsAtFall: totals.runs,
        oversAtFall: oversFromBalls(legal, bpo),
        batterId: dismissedId,
        ball,
        now,
      }),
    );
  }
  dismissBatter(bp, ball);
  stand.is_current = false;
  stand.end_over = oversFromBalls(legal, bpo);
  stand.wicket_number = totals.wickets;
  return { dismissedId, fallOfWickets };
}

/** Marks who is at each end after `ball` (swapped when it ended the over). */
function markCrease(
  input: IncrementalInput,
  rows: {
    striker: BattingPerformancesRow;
    nonStriker: BattingPerformancesRow;
    rowOf: (id: string | null) => BattingPerformancesRow | null;
  },
  dismissedId: string | null,
  overJustEnded: boolean,
): void {
  const after = endsAfterBall(input.ball, dismissedId);
  const ends = overJustEnded
    ? { striker: after.nonStriker, nonStriker: after.striker }
    : after;
  const atStrike = rows.rowOf(ends.striker);
  const atOtherEnd = rows.rowOf(ends.nonStriker);
  for (const bp of [rows.striker, rows.nonStriker]) {
    bp.is_current_batsman = bp === atStrike || bp === atOtherEnd;
    bp.is_striker = bp === atStrike;
  }
}

/** The bowler's overs, and the maiden when `ball` ended a scoreless over. */
function finishBowler(
  input: IncrementalInput,
  bowler: BowlingPerformancesRow,
  overJustEnded: boolean,
): void {
  if (overJustEnded) {
    const overTotal = input.overBalls.reduce(
      (sum, b) => sum + bowlerConcedes(b),
      bowlerConcedes(input.ball),
    );
    if (overTotal === 0) bowler.maidens = (bowler.maidens ?? 0) + 1;
  }
  bowler.overs_bowled = oversFromBalls(
    bowler.balls_bowled ?? 0,
    ballsPerOver(input.match),
  );
  bowler.is_current_bowler = !overJustEnded;
}

export function applyBallIncrementally(
  input: IncrementalInput,
): IncrementalOutput | null {
  const { match, innings, ball, now } = input;
  if (
    match.max_balls_per_over !== null &&
    match.max_balls_per_over !== undefined
  )
    return null;
  if (!rowsMatch(input) || !overMatches(input)) return null;

  const bpo = ballsPerOver(match);
  const legalBall = isLegalDelivery(ball);
  const legalBefore = innings.total_balls ?? 0;
  const legal = legalBefore + (legalBall ? 1 : 0);

  const striker: BattingPerformancesRow = { ...input.striker, updated_at: now };
  const nonStriker: BattingPerformancesRow = {
    ...input.nonStriker,
    updated_at: now,
  };
  const bowler: BowlingPerformancesRow | null = input.bowler
    ? { ...input.bowler, updated_at: now }
    : null;
  const rowOf = (id: string | null) =>
    id === striker.user_id
      ? striker
      : id === nonStriker.user_id
        ? nonStriker
        : null;
  resumeIfRetiredHurt(striker);
  resumeIfRetiredHurt(nonStriker);

  const credit = batterCreditOf(match, ball);
  creditBatter(striker, ball, credit);
  if (bowler) creditBowler(bowler, ball);
  const totals = totalsOf(innings);
  addToTotals(totals, ball);
  const partnerships = standsAfter(
    input,
    { before: legalBefore, after: legal },
    credit,
  );
  if (!partnerships) return null;
  const stand = partnerships.at(-1)!;

  // ---- wickets (retired hurt is not out and not a wicket) ----
  const wicket = ball.is_wicket
    ? applyWicket(input, { rowOf, totals, stand, legal })
    : { dismissedId: null, fallOfWickets: [] };
  if (!wicket) return null;
  const { dismissedId, fallOfWickets } = wicket;

  const overJustEnded = legalBall && legal % bpo === 0;
  markCrease(input, { striker, nonStriker, rowOf }, dismissedId, overJustEnded);
  if (bowler) finishBowler(input, bowler, overJustEnded);

  return {
    ...totalsPatches(totals, legal, bpo, now),
    batting: [striker, nonStriker],
    bowling: bowler ? [bowler] : [],
    fallOfWickets,
    partnerships,
    overJustEnded,
  };
}
