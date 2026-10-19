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

export function isLegalDelivery(
  ball: Pick<BallInput, "bowler_id" | "extra_type">,
): boolean {
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

function bowlerConcedes(ball: BallInput): number {
  const runs = ball.runs_scored ?? 0;
  const extras = ball.extras ?? 0;
  const t = ball.extra_type;
  if (t === "bye" || t === "leg_bye" || t === "penalty" || t === "bonus")
    return runs;
  return runs + extras;
}

export function recomputeInnings(input: RecomputeInput): RecomputeOutput {
  const { match, innings, balls, now } = input;
  const bpo =
    match.balls_per_over && match.balls_per_over > 0 ? match.balls_per_over : 6;
  const inningsId = innings.id;
  const matchId = innings.match_id ?? match.id;

  // Reset existing performance rows (keeping ids and batting positions).
  const batting = new Map<string, BattingPerformancesRow>();
  let maxPosition = 0;
  for (const bp of input.existingBatting) {
    batting.set(bp.user_id, {
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
    maxPosition = Math.max(maxPosition, bp.batting_position ?? 0);
  }
  const bowling = new Map<string, BowlingPerformancesRow>();
  for (const bw of input.existingBowling) {
    bowling.set(bw.user_id, {
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

  const ensureBatter = (userId: string | null | undefined) => {
    if (!userId) return;
    if (batting.has(userId)) return;
    maxPosition += 1;
    batting.set(userId, {
      id: `${inningsId}_${userId}`,
      match_id: matchId,
      innings_id: inningsId,
      user_id: userId,
      batting_position: maxPosition,
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
      created_at: now,
      updated_at: now,
    });
  };

  const ensureBowler = (userId: string | null | undefined) => {
    if (!userId) return;
    if (bowling.has(userId)) return;
    bowling.set(userId, {
      id: `${inningsId}_${userId}`,
      match_id: matchId,
      innings_id: inningsId,
      user_id: userId,
      overs_bowled: 0,
      balls_bowled: 0,
      runs_conceded: 0,
      wickets_taken: 0,
      maidens: 0,
      wides: 0,
      no_balls: 0,
      is_current_bowler: false,
      created_at: now,
      updated_at: now,
    });
  };

  const fallOfWickets: FallOfWicketsRow[] = [];
  const partnerships: PartnershipsRow[] = [];

  let legal = 0;
  let totalRuns = 0;
  let totalWickets = 0;
  let wicketNo = 0;
  let extrasByes = 0;
  let extrasLegByes = 0;
  let extrasWides = 0;
  let extrasNoBalls = 0;
  let extrasPenalties = 0;
  let extrasBonuses = 0;
  let finalStriker: string | null = null;
  let finalNonStriker: string | null = null;
  let lastBowler: string | null = null;
  let currentPartnership: PartnershipsRow | null = null;
  let partnerA: string | null = null;
  let partnerB: string | null = null;
  let ballsInCurrentOver = 0;
  let currentOverNum = 0;
  let overJustEnded = false;
  /** The bowler of the over the last ball ended (not allowed the next one). */
  let endedOverBowler: string | null = null;
  /** Players the ball log names (their rows stay, whatever their figures). */
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

  // Pre-compute per-over totals for maiden detection (all balls, as SQL did).
  const overTotals = new Map<number, number>();
  for (const ball of balls) {
    const current = overTotals.get(ball.over_number) ?? 0;
    overTotals.set(ball.over_number, current + bowlerConcedes(ball));
  }

  for (const ball of balls) {
    // Penalty runs awarded to a fielding side (see `penaltyCountsFor`): only
    // runs for the team that bats this innings; no effect on the crease,
    // the over or the bowler.
    if (ball.penalty_team_id) {
      if (penaltyCountsFor(ball, innings)) {
        totalRuns += (ball.runs_scored ?? 0) + (ball.extras ?? 0);
        if (ball.extra_type === "bonus") extrasBonuses += ball.extras ?? 0;
        else extrasPenalties += ball.extras ?? 0;
      }
      continue;
    }
    const legalBall = isLegalDelivery(ball);
    const runs = ball.runs_scored ?? 0;
    const extras = ball.extras ?? 0;
    const teamRuns = runs + extras;
    const concedes = bowlerConcedes(ball);

    if (ball.bowler_id) lastBowler = ball.bowler_id;

    if (ball.over_number !== currentOverNum) {
      currentOverNum = ball.over_number;
      ballsInCurrentOver = 1;
    } else {
      ballsInCurrentOver += 1;
    }

    ensureBatter(ball.batsman_id);
    ensureBatter(ball.non_striker_id);
    ensureBowler(ball.bowler_id);

    // ---- batting stats ----
    let creditedRuns = 0;
    let faced = false;
    if (ball.batsman_id) {
      const bp = batting.get(ball.batsman_id)!;
      creditedRuns = runs;
      if (ball.extra_type === "wide" && match.wide_runs_to_batsman)
        creditedRuns += extras;
      if (ball.extra_type === "no_ball" && match.noball_extras_to_batsman)
        creditedRuns += extras;
      bp.runs_scored = (bp.runs_scored ?? 0) + creditedRuns;
      faced =
        legalBall ||
        (ball.extra_type === "wide" &&
          Boolean(match.wide_counts_as_ball_faced));
      bp.balls_faced = (bp.balls_faced ?? 0) + (faced ? 1 : 0);
      if (runs === 4) bp.fours = (bp.fours ?? 0) + 1;
      if (runs === 6) bp.sixes = (bp.sixes ?? 0) + 1;
    }

    // ---- bowling stats ----
    if (ball.bowler_id) {
      const bw = bowling.get(ball.bowler_id)!;
      bw.balls_bowled = (bw.balls_bowled ?? 0) + (legalBall ? 1 : 0);
      bw.runs_conceded = (bw.runs_conceded ?? 0) + concedes;
      if (ball.extra_type === "wide") bw.wides = (bw.wides ?? 0) + 1;
      if (ball.extra_type === "no_ball") bw.no_balls = (bw.no_balls ?? 0) + 1;
      if (
        ball.is_wicket &&
        !NON_BOWLER_DISMISSALS.has(ball.dismissal_type ?? "")
      ) {
        bw.wickets_taken = (bw.wickets_taken ?? 0) + 1;
      }
    }

    // ---- innings totals ----
    legal += legalBall ? 1 : 0;
    totalRuns += teamRuns;
    switch (ball.extra_type) {
      case "bye":
        extrasByes += extras;
        break;
      case "leg_bye":
        extrasLegByes += extras;
        break;
      case "wide":
        extrasWides += extras;
        break;
      case "no_ball":
        extrasNoBalls += extras;
        break;
      case "penalty":
        extrasPenalties += extras;
        break;
      case "bonus":
        extrasBonuses += extras;
        break;
    }

    // ---- partnerships ----
    if (ball.batsman_id && ball.non_striker_id) {
      const samePair =
        partnerA !== null &&
        ((ball.batsman_id === partnerA && ball.non_striker_id === partnerB) ||
          (ball.batsman_id === partnerB && ball.non_striker_id === partnerA));
      if (partnerA === null || !samePair) {
        if (currentPartnership) {
          currentPartnership.is_current = false;
          currentPartnership.end_over = oversFromBalls(legal, bpo);
        }
        const legalBefore = legal - (legalBall ? 1 : 0);
        currentPartnership = {
          id: `${inningsId}_p${partnerships.length + 1}`,
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
        partnerships.push(currentPartnership);
        partnerA = ball.batsman_id;
        partnerB = ball.non_striker_id;
      }
      currentPartnership!.runs = (currentPartnership!.runs ?? 0) + teamRuns;
      currentPartnership!.balls =
        (currentPartnership!.balls ?? 0) + (legalBall ? 1 : 0);
      creditStand(currentPartnership!, ball.batsman_id, creditedRuns, faced);
    }

    // ---- wickets (retired hurt is not out and not a wicket) ----
    let dismissedId: string | null = null;
    if (ball.is_wicket) {
      dismissedId = ball.dismissed_player_id ?? ball.batsman_id ?? null;
      if (dismissedId) ensureBatter(dismissedId);
      const bp = dismissedId ? batting.get(dismissedId) : undefined;
      if ((ball.dismissal_type ?? "") === "retired_hurt") {
        if (bp) {
          bp.is_out = false;
          bp.dismissal_type = "retired_hurt";
          bp.bowler_id = ball.bowler_id ?? null;
          bp.fielder_id = ball.fielder_id ?? null;
          bp.is_current_batsman = false;
          bp.is_striker = false;
        }
      } else {
        wicketNo += 1;
        totalWickets += 1;
        if (dismissedId) {
          fallOfWickets.push({
            id: `${inningsId}_w${wicketNo}`,
            match_id: matchId,
            innings_id: inningsId,
            wicket_number: wicketNo,
            runs_at_fall: totalRuns,
            overs_at_fall: oversFromBalls(legal, bpo),
            batsman_out_id: dismissedId,
            dismissal_type: ball.dismissal_type ?? "bowled",
            bowler_id: ball.bowler_id ?? null,
            fielder_id: ball.fielder_id ?? null,
            created_at: now,
          });
        }
        if (bp) {
          bp.is_out = true;
          bp.dismissal_type = ball.dismissal_type ?? null;
          bp.bowler_id = ball.bowler_id ?? null;
          bp.fielder_id = ball.fielder_id ?? null;
          bp.is_current_batsman = false;
          bp.is_striker = false;
        }
      }

      if (currentPartnership) {
        currentPartnership.is_current = false;
        currentPartnership.end_over = oversFromBalls(legal, bpo);
        currentPartnership.wicket_number = wicketNo;
        currentPartnership = null;
        partnerA = null;
        partnerB = null;
      }
    }

    // ---- strike rotation ----
    const byeRuns =
      ball.extra_type === "bye" || ball.extra_type === "leg_bye" ? extras : 0;
    const strikeSwap = (runs + byeRuns) % 2 === 1;

    if (ball.batsman_id) {
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
          finalStriker = ball.non_striker_id ?? null;
          finalNonStriker = null;
        } else {
          finalStriker = null;
          finalNonStriker = ball.non_striker_id ?? null;
        }
      } else if (strikeSwap) {
        finalStriker = ball.non_striker_id ?? null;
        finalNonStriker = ball.batsman_id;
      } else {
        finalStriker = ball.batsman_id;
        finalNonStriker = ball.non_striker_id ?? null;
      }
    }

    // ---- over boundary ----
    overJustEnded =
      (legalBall && legal % bpo === 0) ||
      (match.max_balls_per_over !== null &&
        match.max_balls_per_over !== undefined &&
        ballsInCurrentOver >= match.max_balls_per_over);

    if (overJustEnded) {
      const tmp: string | null = finalStriker;
      finalStriker = finalNonStriker;
      finalNonStriker = tmp;
      if (ball.bowler_id) {
        const bw = bowling.get(ball.bowler_id)!;
        if ((overTotals.get(ball.over_number) ?? 0) === 0) {
          bw.maidens = (bw.maidens ?? 0) + 1;
        }
      }
      endedOverBowler = ball.bowler_id ?? null;
      lastBowler = null;
    }
  }

  // An end the log leaves empty (after a wicket, an over, or before the
  // first ball) keeps whom the scorer has put there since the last ball:
  // `set_current_batsmen` / `set_current_bowler` choices the log cannot
  // hold yet. Without this, undoing or editing a ball would lose them
  // (e.g. undoing an over's first ball would leave no bowler).
  if (finalStriker === null || finalNonStriker === null) {
    // Never someone the log has sent off (out, or retired since).
    const chosen = input.existingBatting.filter((b) => {
      const now = batting.get(b.user_id);
      return (
        b.is_current_batsman && now && !now.is_out && !now.dismissal_type
      );
    });
    const striker = chosen.find((b) => b.is_striker);
    const nonStriker = chosen.find((b) => !b.is_striker);
    const stillIn = [finalStriker, finalNonStriker].filter(
      (id): id is string => id !== null,
    );
    if (
      striker &&
      nonStriker &&
      stillIn.every((id) => id === striker.user_id || id === nonStriker.user_id)
    ) {
      finalStriker = striker.user_id;
      finalNonStriker = nonStriker.user_id;
    }
  }
  const chosenBowler =
    lastBowler === null
      ? (input.existingBowling.find(
          (b) => b.is_current_bowler && b.user_id !== endedOverBowler,
        )?.user_id ?? null)
      : null;

  if (finalStriker && batting.has(finalStriker)) {
    const bp = batting.get(finalStriker)!;
    bp.is_current_batsman = true;
    bp.is_striker = true;
  }
  if (finalNonStriker && batting.has(finalNonStriker)) {
    const bp = batting.get(finalNonStriker)!;
    bp.is_current_batsman = true;
    bp.is_striker = false;
  }

  for (const bw of bowling.values()) {
    bw.overs_bowled = oversFromBalls(bw.balls_bowled ?? 0, bpo);
    if (chosenBowler) {
      bw.is_current_bowler = bw.user_id === chosenBowler;
    } else if (overJustEnded) {
      bw.is_current_bowler = false;
    } else if (lastBowler) {
      bw.is_current_bowler = bw.user_id === lastBowler;
    }
  }

  return {
    inningsPatch: {
      total_runs: totalRuns,
      total_wickets: totalWickets,
      total_balls: legal,
      total_overs: oversFromBalls(legal, bpo),
      extras_total:
        extrasByes +
        extrasLegByes +
        extrasWides +
        extrasNoBalls +
        extrasPenalties +
        extrasBonuses,
      extras_byes: extrasByes,
      extras_leg_byes: extrasLegByes,
      extras_wides: extrasWides,
      extras_no_balls: extrasNoBalls,
      extras_penalties: extrasPenalties,
      extras_bonuses: extrasBonuses,
      updated_at: now,
    },
    matchPatch: {
      current_over: Math.floor(legal / bpo),
      current_ball: legal % bpo,
    },
    // A batter or bowler the log does not name, with nothing recorded and
    // no longer at the crease or bowling (brought in after a ball since
    // undone or edited away), has no place on the scorecard.
    batting: Array.from(batting.values()).filter(
      (b) =>
        named.has(b.user_id) ||
        b.is_current_batsman ||
        b.is_out ||
        Boolean(b.dismissal_type) ||
        (b.balls_faced ?? 0) > 0 ||
        (b.runs_scored ?? 0) > 0,
    ),
    bowling: Array.from(bowling.values()).filter(
      (b) =>
        named.has(b.user_id) ||
        b.is_current_bowler ||
        (b.balls_bowled ?? 0) > 0 ||
        (b.runs_conceded ?? 0) > 0 ||
        (b.wickets_taken ?? 0) > 0 ||
        (b.wides ?? 0) > 0 ||
        (b.no_balls ?? 0) > 0,
    ),
    fallOfWickets,
    partnerships,
    overJustEnded,
  };
}
