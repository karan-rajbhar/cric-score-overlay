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
  isLegalDelivery,
  NON_BOWLER_DISMISSALS,
  oversFromBalls,
  type BallInput,
  type RecomputeInput,
  type RecomputeOutput,
  creditStand,
  NEW_STAND_SPLIT,
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
  bowler: BowlingPerformancesRow;
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

function bowlerConcedes(ball: BallInput): number {
  const runs = ball.runs_scored ?? 0;
  const extras = ball.extras ?? 0;
  const t = ball.extra_type;
  if (t === "bye" || t === "leg_bye" || t === "penalty" || t === "bonus")
    return runs;
  return runs + extras;
}

function ballsPerOver(match: IncrementalInput["match"]): number {
  return match.balls_per_over && match.balls_per_over > 0
    ? match.balls_per_over
    : 6;
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

export function applyBallIncrementally(
  input: IncrementalInput,
): IncrementalOutput | null {
  const { match, innings, ball, now } = input;
  const bpo = ballsPerOver(match);
  if (
    match.max_balls_per_over !== null &&
    match.max_balls_per_over !== undefined
  )
    return null;
  if (!ball.batsman_id || !ball.non_striker_id || !ball.bowler_id) return null;
  if (input.striker.user_id !== ball.batsman_id) return null;
  if (input.nonStriker.user_id !== ball.non_striker_id) return null;
  if (input.bowler.user_id !== ball.bowler_id) return null;

  const legalBefore = innings.total_balls ?? 0;
  const overNumber = Math.floor(legalBefore / bpo);
  if (ball.over_number !== overNumber) return null;
  // The stored over must agree with the totals, otherwise maiden detection
  // (which looks at every ball of the over) could disagree with a recompute.
  const legalInOver = input.overBalls.filter(isLegalDelivery).length;
  if (legalInOver !== legalBefore - overNumber * bpo) return null;
  if (input.overBalls.some((b) => b.over_number !== overNumber)) return null;

  const inningsId = innings.id;
  const matchId = innings.match_id ?? match.id;
  const legalBall = isLegalDelivery(ball);
  const runs = ball.runs_scored ?? 0;
  const extras = ball.extras ?? 0;
  const teamRuns = runs + extras;
  const concedes = bowlerConcedes(ball);
  const legal = legalBefore + (legalBall ? 1 : 0);

  const striker: BattingPerformancesRow = { ...input.striker, updated_at: now };
  const nonStriker: BattingPerformancesRow = {
    ...input.nonStriker,
    updated_at: now,
  };
  const bowler: BowlingPerformancesRow = { ...input.bowler, updated_at: now };
  const rowOf = (id: string | null) =>
    id === striker.user_id
      ? striker
      : id === nonStriker.user_id
        ? nonStriker
        : null;

  // ---- batting stats ----
  let creditedRuns = runs;
  if (ball.extra_type === "wide" && match.wide_runs_to_batsman)
    creditedRuns += extras;
  if (ball.extra_type === "no_ball" && match.noball_extras_to_batsman)
    creditedRuns += extras;
  striker.runs_scored = (striker.runs_scored ?? 0) + creditedRuns;
  const faced =
    legalBall ||
    (ball.extra_type === "wide" && Boolean(match.wide_counts_as_ball_faced));
  striker.balls_faced = (striker.balls_faced ?? 0) + (faced ? 1 : 0);
  if (runs === 4) striker.fours = (striker.fours ?? 0) + 1;
  if (runs === 6) striker.sixes = (striker.sixes ?? 0) + 1;

  // ---- bowling stats ----
  bowler.balls_bowled = (bowler.balls_bowled ?? 0) + (legalBall ? 1 : 0);
  bowler.runs_conceded = (bowler.runs_conceded ?? 0) + concedes;
  if (ball.extra_type === "wide") bowler.wides = (bowler.wides ?? 0) + 1;
  if (ball.extra_type === "no_ball")
    bowler.no_balls = (bowler.no_balls ?? 0) + 1;
  if (ball.is_wicket && !NON_BOWLER_DISMISSALS.has(ball.dismissal_type ?? "")) {
    bowler.wickets_taken = (bowler.wickets_taken ?? 0) + 1;
  }

  // ---- innings totals ----
  const totals = {
    runs: (innings.total_runs ?? 0) + teamRuns,
    wickets: innings.total_wickets ?? 0,
    byes: innings.extras_byes ?? 0,
    legByes: innings.extras_leg_byes ?? 0,
    wides: innings.extras_wides ?? 0,
    noBalls: innings.extras_no_balls ?? 0,
    penalties: innings.extras_penalties ?? 0,
    bonuses: innings.extras_bonuses ?? 0,
  };
  switch (ball.extra_type) {
    case "bye":
      totals.byes += extras;
      break;
    case "leg_bye":
      totals.legByes += extras;
      break;
    case "wide":
      totals.wides += extras;
      break;
    case "no_ball":
      totals.noBalls += extras;
      break;
    case "penalty":
      totals.penalties += extras;
      break;
    case "bonus":
      totals.bonuses += extras;
      break;
  }

  // ---- partnerships ----
  const partnerships: PartnershipsRow[] = [];
  let current: PartnershipsRow | null = input.partnership
    ? { ...input.partnership }
    : null;
  if (startsNewPartnership(ball, current)) {
    if (input.partnershipCount === null) return null;
    if (current) {
      current.is_current = false;
      current.end_over = oversFromBalls(legal, bpo);
      current.updated_at = now;
      partnerships.push(current);
    }
    current = {
      id: `${inningsId}_p${input.partnershipCount + 1}`,
      match_id: matchId,
      innings_id: inningsId,
      batsman1_id: ball.batsman_id,
      batsman2_id: ball.non_striker_id,
      wicket_number: null,
      runs: 0,
      balls: 0,
      ...NEW_STAND_SPLIT,
      start_over: oversFromBalls(legalBefore, bpo),
      end_over: null,
      is_current: true,
      created_at: now,
      updated_at: now,
    };
  } else {
    current = { ...current!, updated_at: now };
  }
  current.runs = (current.runs ?? 0) + teamRuns;
  current.balls = (current.balls ?? 0) + (legalBall ? 1 : 0);
  creditStand(current, ball.batsman_id, creditedRuns, faced);
  partnerships.push(current);

  // ---- wickets (retired hurt is not out and not a wicket) ----
  const fallOfWickets: FallOfWicketsRow[] = [];
  let dismissedId: string | null = null;
  if (ball.is_wicket) {
    dismissedId = ball.dismissed_player_id ?? ball.batsman_id;
    const bp = rowOf(dismissedId);
    if (!bp) return null;
    if ((ball.dismissal_type ?? "") === "retired_hurt") {
      bp.is_out = false;
      bp.dismissal_type = "retired_hurt";
    } else {
      totals.wickets += 1;
      fallOfWickets.push({
        id: `${inningsId}_w${totals.wickets}`,
        match_id: matchId,
        innings_id: inningsId,
        wicket_number: totals.wickets,
        runs_at_fall: totals.runs,
        overs_at_fall: oversFromBalls(legal, bpo),
        batsman_out_id: dismissedId,
        dismissal_type: ball.dismissal_type ?? "bowled",
        bowler_id: ball.bowler_id ?? null,
        fielder_id: ball.fielder_id ?? null,
        created_at: now,
      });
      bp.is_out = true;
      bp.dismissal_type = ball.dismissal_type ?? null;
    }
    bp.bowler_id = ball.bowler_id ?? null;
    bp.fielder_id = ball.fielder_id ?? null;

    current.is_current = false;
    current.end_over = oversFromBalls(legal, bpo);
    current.wicket_number = totals.wickets;
  }

  // ---- strike rotation ----
  const byeRuns =
    ball.extra_type === "bye" || ball.extra_type === "leg_bye" ? extras : 0;
  const strikeSwap = (runs + byeRuns) % 2 === 1;
  let finalStriker: string | null;
  let finalNonStriker: string | null;
  if (ball.is_wicket) {
    if (dismissedId === ball.non_striker_id) {
      if (strikeSwap) {
        finalStriker = null;
        finalNonStriker = ball.batsman_id;
      } else {
        finalStriker = ball.batsman_id;
        finalNonStriker = null;
      }
    } else if ((ball.dismissal_type ?? "") === "run_out" && strikeSwap) {
      finalStriker = ball.non_striker_id;
      finalNonStriker = null;
    } else {
      finalStriker = null;
      finalNonStriker = ball.non_striker_id;
    }
  } else if (strikeSwap) {
    finalStriker = ball.non_striker_id;
    finalNonStriker = ball.batsman_id;
  } else {
    finalStriker = ball.batsman_id;
    finalNonStriker = ball.non_striker_id;
  }

  // ---- over boundary ----
  const overJustEnded = legalBall && legal % bpo === 0;
  if (overJustEnded) {
    const tmp = finalStriker;
    finalStriker = finalNonStriker;
    finalNonStriker = tmp;
    const overTotal =
      input.overBalls.reduce((sum, b) => sum + bowlerConcedes(b), 0) + concedes;
    if (overTotal === 0) bowler.maidens = (bowler.maidens ?? 0) + 1;
  }

  for (const bp of [striker, nonStriker]) {
    bp.is_current_batsman = false;
    bp.is_striker = false;
  }
  const s = rowOf(finalStriker);
  if (s) {
    s.is_current_batsman = true;
    s.is_striker = true;
  }
  const ns = rowOf(finalNonStriker);
  if (ns) {
    ns.is_current_batsman = true;
    ns.is_striker = false;
  }

  bowler.overs_bowled = oversFromBalls(bowler.balls_bowled ?? 0, bpo);
  bowler.is_current_bowler = !overJustEnded;

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
    batting: [striker, nonStriker],
    bowling: [bowler],
    fallOfWickets,
    partnerships,
    overJustEnded,
  };
}
