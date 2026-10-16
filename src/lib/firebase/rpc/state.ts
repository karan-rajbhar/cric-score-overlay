/**
 * `record_state`: the JSON snapshot every scoring mutation returns.
 */

import type { ScoringState } from "~/app/matches/types";
import type { DataSource } from "../datasource";
import type {
  BallByBallRow,
  BattingPerformancesRow,
  BowlingPerformancesRow,
  InningsRow,
  MatchesRow,
  UsersRow,
} from "../types";
import { DbQueryError } from "../query-builder";

export async function recordState(
  ds: DataSource,
  matchId: string,
): Promise<ScoringState> {
  const match = (await ds.getById(
    "matches",
    matchId,
  )) as unknown as MatchesRow | null;
  if (!match) throw new DbQueryError("match_not_found", "22000");

  const inningsDocs = (await ds.query("innings", [
    { field: "match_id", op: "==", value: matchId },
  ])) as unknown as InningsRow[];
  const innings = inningsDocs.find(
    (i) => i.innings_number === (match.current_innings ?? 1),
  );
  if (!innings) throw new DbQueryError("no_open_innings", "22000");

  const [battingDocs, bowlingDocs, ballDocs] = await Promise.all([
    ds.query("batting_performances", [
      { field: "innings_id", op: "==", value: innings.id },
    ]) as Promise<unknown> as Promise<BattingPerformancesRow[]>,
    ds.query("bowling_performances", [
      { field: "innings_id", op: "==", value: innings.id },
    ]) as Promise<unknown> as Promise<BowlingPerformancesRow[]>,
    ds.query("ball_by_ball", [
      { field: "innings_id", op: "==", value: innings.id },
    ]) as Promise<unknown> as Promise<BallByBallRow[]>,
  ]);
  const balls = [...ballDocs].sort((a, b) => (a.seq ?? 0) - (b.seq ?? 0));

  const striker =
    battingDocs.find((b) => b.is_current_batsman && b.is_striker) ?? null;
  const nonStriker =
    battingDocs.find((b) => b.is_current_batsman && !b.is_striker) ?? null;
  const bowler = bowlingDocs.find((b) => b.is_current_bowler) ?? null;
  const lastBall = balls.length ? balls[balls.length - 1]! : null;
  const lastBowlerPerf = lastBall?.bowler_id
    ? (bowlingDocs.find((b) => b.user_id === lastBall.bowler_id) ?? null)
    : null;

  const userIds = Array.from(
    new Set(
      [
        striker?.user_id,
        nonStriker?.user_id,
        bowler?.user_id,
        lastBall?.bowler_id,
      ].filter((x): x is string => !!x),
    ),
  );
  const userDocs = (await ds.getByIds(
    "users",
    userIds,
  )) as unknown as UsersRow[];
  const users = new Map(userDocs.map((u) => [u.id, u]));
  const nameOf = (id: string | null | undefined) =>
    id ? (users.get(id)?.full_name ?? null) : null;

  const bpo =
    match.balls_per_over && match.balls_per_over > 0 ? match.balls_per_over : 6;
  const totalBalls = innings.total_balls ?? 0;
  const live = match.status === "live";
  const completed = innings.is_completed ?? false;
  const atOverBoundary = totalBalls > 0 && totalBalls % bpo === 0;

  let lastOverBowlerId: string | null = null;
  if (atOverBoundary) {
    lastOverBowlerId = lastBall?.bowler_id ?? null;
  } else if (Math.floor(totalBalls / bpo) > 0) {
    const previousOver = Math.floor((totalBalls - 1) / bpo) - 1;
    const candidates = balls.filter((b) => b.over_number === previousOver);
    lastOverBowlerId = candidates.length
      ? (candidates[candidates.length - 1]!.bowler_id ?? null)
      : null;
  }

  const currentBatsmen = battingDocs.filter((b) => b.is_current_batsman).length;

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
    last_over_bowler_id: lastOverBowlerId,
    needs_batsman: currentBatsmen < 2 && !completed && live,
    needs_bowler: !bowler && !completed && live,
    innings_completed: completed,
    match_completed: match.status === "completed",
    result_description: match.result_description ?? null,
  };
}
