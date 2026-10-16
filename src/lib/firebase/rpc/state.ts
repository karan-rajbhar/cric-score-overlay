/**
 * `record_state`: the JSON snapshot every scoring mutation returns.
 *
 * `composeScoringState` is the pure projection; `record_ball` feeds it the
 * rows it already holds inside its transaction, and `recordState` loads
 * only the rows it needs (current batters / bowler by flag, the last ball by
 * `seq`) for the other mutations.
 */

import type { ScoringState } from "~/app/matches/types";
import { DbQueryError } from "../query-builder";
import type { DocReader } from "../scoring/tx";
import type {
  BallByBallRow,
  BattingPerformancesRow,
  BowlingPerformancesRow,
  InningsRow,
  MatchesRow,
} from "../types";
import {
  loadCurrentInnings,
  loadLastBall,
  loadNames,
  nameLookup,
} from "../views";

export interface ScoringStateParts {
  match: MatchesRow;
  innings: InningsRow;
  striker: BattingPerformancesRow | null;
  nonStriker: BattingPerformancesRow | null;
  /** Number of batting rows flagged `is_current_batsman`. */
  currentBatsmen: number;
  bowler: BowlingPerformancesRow | null;
  lastBall: BallByBallRow | null;
  lastBowlerPerf: BowlingPerformancesRow | null;
  lastOverBowlerId: string | null;
  nameOf: (id: string | null | undefined) => string | null;
}

export function scoringStateUserIds(
  p: Pick<ScoringStateParts, "striker" | "nonStriker" | "bowler" | "lastBall">,
): string[] {
  return Array.from(
    new Set(
      [
        p.striker?.user_id,
        p.nonStriker?.user_id,
        p.bowler?.user_id,
        p.lastBall?.bowler_id,
      ].filter((x): x is string => !!x),
    ),
  );
}

export function composeScoringState(p: ScoringStateParts): ScoringState {
  const { match, innings, striker, nonStriker, bowler, lastBall, nameOf } = p;
  const lastBowlerPerf = p.lastBowlerPerf;
  const bpo =
    match.balls_per_over && match.balls_per_over > 0 ? match.balls_per_over : 6;
  const totalBalls = innings.total_balls ?? 0;
  const live = match.status === "live";
  const completed = innings.is_completed ?? false;
  const atOverBoundary = totalBalls > 0 && totalBalls % bpo === 0;

  return {
    ok: true,
    status: match.status ?? "scheduled",
    current_innings: match.current_innings ?? 1,
    current_over: match.current_over ?? 0,
    current_ball: match.current_ball ?? 0,
    total_runs: innings.total_runs ?? 0,
    total_wickets: innings.total_wickets ?? 0,
    total_balls: totalBalls,
    target_runs: innings.target_runs ?? null,
    is_completed: completed,
    striker_id: striker?.user_id ?? null,
    non_striker_id: nonStriker?.user_id ?? null,
    striker_name: nameOf(striker?.user_id),
    non_striker_name: nameOf(nonStriker?.user_id),
    striker_runs: striker?.runs_scored ?? null,
    striker_balls: striker?.balls_faced ?? null,
    non_striker_runs: nonStriker?.runs_scored ?? null,
    non_striker_balls: nonStriker?.balls_faced ?? null,
    bowler_id: bowler?.user_id ?? null,
    bowler_name: nameOf(bowler?.user_id),
    bowler_overs: bowler?.overs_bowled ?? null,
    bowler_maidens: bowler?.maidens ?? null,
    bowler_runs: bowler?.runs_conceded ?? null,
    bowler_wickets: bowler?.wickets_taken ?? null,
    last_bowler_id: lastBall?.bowler_id ?? null,
    last_bowler_name: nameOf(lastBall?.bowler_id),
    last_bowler_overs: lastBowlerPerf?.overs_bowled ?? null,
    last_bowler_maidens: lastBowlerPerf?.maidens ?? null,
    last_bowler_runs: lastBowlerPerf?.runs_conceded ?? null,
    last_bowler_wickets: lastBowlerPerf?.wickets_taken ?? null,
    over_completed: atOverBoundary && !completed && live,
    last_over_bowler_id: p.lastOverBowlerId,
    needs_batsman: p.currentBatsmen < 2 && !completed && live,
    needs_bowler: !bowler && !completed && live,
    innings_completed: completed,
    match_completed: match.status === "completed",
    result_description: match.result_description ?? null,
  };
}

/**
 * Bowler of the previous completed over. At an over boundary that is the
 * last ball's bowler; mid-over it is the bowler of the over-ending ball of
 * the previous over (its `ball_number` equals balls-per-over), falling back
 * to the whole over's balls if that lookup finds nothing.
 */
export async function findLastOverBowler(
  reader: DocReader,
  inningsId: string,
  totalBalls: number,
  ballsPerOver: number,
  lastBall: BallByBallRow | null,
): Promise<string | null> {
  const bpo = ballsPerOver > 0 ? ballsPerOver : 6;
  if (totalBalls > 0 && totalBalls % bpo === 0) {
    return lastBall?.bowler_id ?? null;
  }
  if (Math.floor(totalBalls / bpo) <= 0) return null;
  const previousOver = Math.floor((totalBalls - 1) / bpo) - 1;
  let candidates = (await reader.query("ball_by_ball", [
    { field: "innings_id", op: "==", value: inningsId },
    { field: "over_number", op: "==", value: previousOver },
    { field: "ball_number", op: "==", value: bpo },
  ])) as unknown as BallByBallRow[];
  if (!candidates.length) {
    candidates = (await reader.query("ball_by_ball", [
      { field: "innings_id", op: "==", value: inningsId },
      { field: "over_number", op: "==", value: previousOver },
    ])) as unknown as BallByBallRow[];
  }
  if (!candidates.length) return null;
  const last = [...candidates].sort((a, b) => (a.seq ?? 0) - (b.seq ?? 0))[
    candidates.length - 1
  ]!;
  return last.bowler_id ?? null;
}

export async function recordState(
  ds: DocReader,
  matchId: string,
  loadedMatch?: MatchesRow | null,
): Promise<ScoringState> {
  const match =
    loadedMatch ??
    ((await ds.getById("matches", matchId)) as unknown as MatchesRow | null);
  if (!match) throw new DbQueryError("match_not_found", "22000");

  const innings = await loadCurrentInnings(ds, match);
  if (!innings) throw new DbQueryError("no_open_innings", "22000");

  const [battingDocs, bowlingDocs] = await Promise.all([
    ds.query("batting_performances", [
      { field: "innings_id", op: "==", value: innings.id },
      { field: "is_current_batsman", op: "==", value: true },
    ]) as Promise<unknown> as Promise<BattingPerformancesRow[]>,
    ds.query("bowling_performances", [
      { field: "innings_id", op: "==", value: innings.id },
      { field: "is_current_bowler", op: "==", value: true },
    ]) as Promise<unknown> as Promise<BowlingPerformancesRow[]>,
  ]);
  const striker = battingDocs.find((b) => b.is_striker) ?? null;
  const nonStriker = battingDocs.find((b) => !b.is_striker) ?? null;
  const bowler = bowlingDocs[0] ?? null;
  const lastBall = await loadLastBall(ds, innings.id, match.last_ball_seq);

  let lastBowlerPerf: BowlingPerformancesRow | null = null;
  if (lastBall?.bowler_id) {
    lastBowlerPerf =
      bowler?.user_id === lastBall.bowler_id
        ? bowler
        : ((
            (await ds.query("bowling_performances", [
              { field: "innings_id", op: "==", value: innings.id },
              { field: "user_id", op: "==", value: lastBall.bowler_id },
            ])) as unknown as BowlingPerformancesRow[]
          )[0] ?? null);
  }

  const bpo =
    match.balls_per_over && match.balls_per_over > 0 ? match.balls_per_over : 6;
  const parts = {
    striker,
    nonStriker,
    bowler,
    lastBall,
  };
  const [lastOverBowlerId, names] = await Promise.all([
    findLastOverBowler(ds, innings.id, innings.total_balls ?? 0, bpo, lastBall),
    loadNames(ds, scoringStateUserIds(parts)),
  ]);

  return composeScoringState({
    ...parts,
    match,
    innings,
    currentBatsmen: battingDocs.length,
    lastBowlerPerf,
    lastOverBowlerId,
    nameOf: nameLookup(names),
  });
}
