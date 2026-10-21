/**
 * Test fixtures: the previous (full-read) implementations of the live
 * scoreboard view and `record_state`, kept verbatim as the reference the
 * cheaper versions are compared against, plus a read/write counter.
 *
 * One change: they read the match through {@link readLogicalMatch}, i.e.
 * with `current_over` / `current_ball` / `last_ball_seq` as the engine kept
 * them on the match before those moved to the current innings (see
 * `logicalMatch` in golden.ts).
 */

import type { ScoringState } from "~/app/matches/types";
import type { DataSource, Doc } from "../../datasource";
import { DbQueryError } from "../../query-builder";
import type {
  BallByBallRow,
  BattingPerformancesRow,
  BowlingPerformancesRow,
  InningsRow,
  LiveMatchStateRow,
  MatchesRow,
  PartnershipsRow,
  TeamsRow,
  TournamentsRow,
  UsersRow,
} from "../../types";
import { inningsLimits } from "../result";
import { matchPositionOf } from "~/lib/match-position";
import { seqCounterOf } from "../../scorecard";

/**
 * The match row as the engine before the per-ball fields moved stored it:
 * `current_over` / `current_ball` are the current innings' position, and
 * `last_ball_seq` the match's seq counter, now held by the current innings
 * (the larger of the legacy field and the innings' counters, which is
 * exactly the last seq the match assigned: the counter never goes back).
 * The match is no longer written per ball, so its stored copies may be
 * behind; every other field is compared as stored.
 */
export function logicalMatch(match: Doc, innings: readonly Doc[]): Doc {
  const m = match as unknown as MatchesRow;
  const list = innings as unknown as InningsRow[];
  const current =
    list.find((i) => i.innings_number === (m.current_innings ?? 1)) ?? null;
  const counter = seqCounterOf(m, ...list);
  return {
    ...match,
    ...(current ? matchPositionOf(m, current) : {}),
    last_ball_seq: counter === null ? (m.last_ball_seq ?? null) : counter,
  };
}

/** The match as the engine stored it before the per-ball fields moved. */
async function readLogicalMatch(
  ds: DataSource,
  matchId: string,
): Promise<MatchesRow | null> {
  const match = await ds.getById("matches", matchId);
  if (!match) return null;
  const innings = await ds.query("innings", [
    { field: "match_id", op: "==", value: matchId },
  ]);
  return logicalMatch(match, innings) as unknown as MatchesRow;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function ballText(b: BallByBallRow): string {
  const runs = b.runs_scored ?? 0;
  if (b.is_wicket) return "W";
  if (b.extra_type === "wide") return runs ? `${runs}+wd` : "wd";
  if (b.extra_type === "no_ball") return runs ? `${runs}+nb` : "nb";
  return String(runs);
}

export async function legacyBuildLiveMatchState(
  ds: DataSource,
  matchId: string,
): Promise<LiveMatchStateRow | null> {
  const match = await readLogicalMatch(ds, matchId);
  if (!match) return null;

  const teamIds = Array.from(
    new Set(
      [match.team1_id, match.team2_id, match.winning_team_id].filter(
        (x): x is string => !!x,
      ),
    ),
  );
  const [teamDocs, tournament, inningsDocs] = await Promise.all([
    ds.getByIds("teams", teamIds) as Promise<unknown> as Promise<TeamsRow[]>,
    match.tournament_id
      ? (ds.getById(
          "tournaments",
          match.tournament_id,
        ) as Promise<unknown> as Promise<TournamentsRow | null>)
      : Promise.resolve(null),
    ds.query("innings", [
      { field: "match_id", op: "==", value: matchId },
    ]) as Promise<unknown> as Promise<InningsRow[]>,
  ]);
  const teams = new Map(teamDocs.map((t) => [t.id, t]));
  const t1 = teams.get(match.team1_id);
  const t2 = teams.get(match.team2_id);
  const winner = match.winning_team_id
    ? teams.get(match.winning_team_id)
    : undefined;

  const ci =
    inningsDocs.find(
      (i) => i.innings_number === (match.current_innings ?? 1),
    ) ?? null;

  const base: LiveMatchStateRow = {
    match_id: match.id,
    title: match.title,
    status: match.status ?? null,
    match_format: match.match_format ?? null,
    overs_per_innings: match.overs_per_innings ?? null,
    venue: match.venue ?? null,
    current_innings: match.current_innings ?? null,
    current_over: match.current_over ?? null,
    current_ball: match.current_ball ?? null,
    result_type: match.result_type ?? null,
    result_description: match.result_description ?? null,
    toss_winner_team_id: match.toss_winner_team_id ?? null,
    toss_decision: match.toss_decision ?? null,
    umpire1_name: match.umpire1_name ?? null,
    umpire2_name: match.umpire2_name ?? null,
    tournament_name: tournament?.name ?? null,
    team1_name: t1?.name ?? null,
    team1_short_name: t1?.short_name ?? null,
    team1_logo_url: t1?.logo_url ?? null,
    team2_name: t2?.name ?? null,
    team2_short_name: t2?.short_name ?? null,
    team2_logo_url: t2?.logo_url ?? null,
    winning_team_name: winner?.name ?? null,
    innings_number: null,
    total_runs: null,
    total_wickets: null,
    total_overs: null,
    total_balls: null,
    extras_total: null,
    innings_completed: null,
    target_runs: null,
    batting_team_name: null,
    batting_team_short_name: null,
    bowling_team_name: null,
    bowling_team_short_name: null,
    striker_name: null,
    striker_runs: null,
    striker_balls: null,
    non_striker_name: null,
    non_striker_runs: null,
    non_striker_balls: null,
    current_bowler_name: null,
    bowler_balls: null,
    bowler_runs: null,
    bowler_wickets: null,
    partnership_runs: null,
    partnership_balls: null,
    this_over_balls: null,
    this_over_runs: null,
    current_run_rate: null,
    runs_needed: null,
    balls_remaining: null,
    required_run_rate: null,
    last_ball_runs: null,
    last_ball_extras: null,
    last_ball_extra_type: null,
    last_ball_is_wicket: null,
    last_ball_dismissal_type: null,
    last_ball_dismissed_player: null,
    last_ball_fielder: null,
    last_ball_commentary: null,
    last_ball_seq: null,
  };

  if (!ci) return base;

  const [battingDocs, bowlingDocs, partnershipDocs, ballDocs] =
    await Promise.all([
      ds.query("batting_performances", [
        { field: "innings_id", op: "==", value: ci.id },
      ]) as Promise<unknown> as Promise<BattingPerformancesRow[]>,
      ds.query("bowling_performances", [
        { field: "innings_id", op: "==", value: ci.id },
      ]) as Promise<unknown> as Promise<BowlingPerformancesRow[]>,
      ds.query("partnerships", [
        { field: "innings_id", op: "==", value: ci.id },
      ]) as Promise<unknown> as Promise<PartnershipsRow[]>,
      ds.query("ball_by_ball", [
        { field: "innings_id", op: "==", value: ci.id },
      ]) as Promise<unknown> as Promise<BallByBallRow[]>,
    ]);

  const balls = [...ballDocs].sort((a, b) => (a.seq ?? 0) - (b.seq ?? 0));
  const striker =
    battingDocs.find((b) => b.is_current_batsman && b.is_striker) ?? null;
  const nonStriker =
    battingDocs.find((b) => b.is_current_batsman && !b.is_striker) ?? null;
  const bowler = bowlingDocs.find((b) => b.is_current_bowler) ?? null;
  const partnership = partnershipDocs.find((p) => p.is_current) ?? null;
  const lastBall = balls.length ? balls[balls.length - 1]! : null;

  const userIds = Array.from(
    new Set(
      [
        striker?.user_id,
        nonStriker?.user_id,
        bowler?.user_id,
        lastBall ? (lastBall.dismissed_player_id ?? lastBall.batsman_id) : null,
        lastBall?.fielder_id,
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

  const limits = inningsLimits(match, ci.innings_number);
  const bpo = limits.ballsPerOver;
  const totalBalls = ci.total_balls ?? 0;
  const totalRuns = ci.total_runs ?? 0;
  const battingTeam = teams.get(ci.team_id);
  const bowlingTeamId =
    ci.team_id === match.team1_id ? match.team2_id : match.team1_id;
  const bowlingTeam =
    match.status === "live" ? teams.get(bowlingTeamId) : undefined;

  const thisOverNumber = Math.floor(totalBalls / bpo);
  const thisOver = balls.filter((b) => b.over_number === thisOverNumber);

  const chasing =
    ci.target_runs !== null && ci.target_runs !== undefined && !ci.is_completed;
  const ballsRemaining = chasing
    ? Math.max(limits.maxBalls - totalBalls, 0)
    : null;
  const runsNeeded = chasing ? (ci.target_runs ?? 0) - totalRuns : null;

  return {
    ...base,
    innings_number: ci.innings_number,
    total_runs: totalRuns,
    total_wickets: ci.total_wickets ?? 0,
    total_overs: ci.total_overs ?? 0,
    total_balls: totalBalls,
    extras_total: ci.extras_total ?? 0,
    innings_completed: ci.is_completed ?? false,
    target_runs: ci.target_runs ?? null,
    batting_team_name: battingTeam?.name ?? null,
    batting_team_short_name: battingTeam?.short_name ?? null,
    bowling_team_name: bowlingTeam?.name ?? null,
    bowling_team_short_name: bowlingTeam?.short_name ?? null,
    striker_name: nameOf(striker?.user_id),
    striker_runs: striker?.runs_scored ?? null,
    striker_balls: striker?.balls_faced ?? null,
    non_striker_name: nameOf(nonStriker?.user_id),
    non_striker_runs: nonStriker?.runs_scored ?? null,
    non_striker_balls: nonStriker?.balls_faced ?? null,
    current_bowler_name: nameOf(bowler?.user_id),
    bowler_balls: bowler?.balls_bowled ?? null,
    bowler_runs: bowler?.runs_conceded ?? null,
    bowler_wickets: bowler?.wickets_taken ?? null,
    partnership_runs: partnership?.runs ?? null,
    partnership_balls: partnership?.balls ?? null,
    this_over_balls: thisOver.length ? thisOver.map(ballText).join(" ") : null,
    this_over_runs: thisOver.length
      ? thisOver.reduce(
          (n, b) => n + (b.runs_scored ?? 0) + (b.extras ?? 0),
          0,
        )
      : null,
    current_run_rate:
      totalBalls > 0 ? round2((totalRuns * bpo) / totalBalls) : null,
    runs_needed: runsNeeded,
    balls_remaining: ballsRemaining,
    required_run_rate:
      chasing &&
      ballsRemaining !== null &&
      ballsRemaining > 0 &&
      runsNeeded !== null
        ? round2((runsNeeded * bpo) / ballsRemaining)
        : null,
    last_ball_runs: lastBall?.runs_scored ?? null,
    last_ball_extras: lastBall?.extras ?? null,
    last_ball_extra_type: lastBall?.extra_type ?? null,
    last_ball_is_wicket: lastBall?.is_wicket ?? null,
    last_ball_dismissal_type: lastBall?.dismissal_type ?? null,
    last_ball_dismissed_player: lastBall
      ? nameOf(lastBall.dismissed_player_id ?? lastBall.batsman_id)
      : null,
    last_ball_fielder: lastBall ? nameOf(lastBall.fielder_id) : null,
    last_ball_commentary: lastBall?.commentary ?? null,
    last_ball_seq: lastBall?.seq ?? null,
  };
}

export async function legacyRecordState(
  ds: DataSource,
  matchId: string,
): Promise<ScoringState> {
  const match = await readLogicalMatch(ds, matchId);
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

export interface IoStats {
  reads: number;
  writes: number;
}

/**
 * Wrap a DataSource so every document read / written is counted the way
 * Firestore bills it: one read per document returned (an empty query still
 * costs one), one write per document set, updated or deleted.
 */
export function countingDataSource<T extends DataSource>(
  inner: T,
): { ds: T; stats: IoStats } {
  const stats: IoStats = { reads: 0, writes: 0 };
  const ds = new Proxy(inner, {
    get(target, prop) {
      const value = Reflect.get(target, prop, target) as unknown;
      if (typeof value !== "function") return value;
      const fn = value as (...args: unknown[]) => unknown;
      switch (prop) {
        case "getById":
          return async (...args: unknown[]) => {
            stats.reads += 1;
            return fn.apply(target, args);
          };
        case "getByIds":
          return async (...args: unknown[]) => {
            stats.reads += new Set(args[1] as string[]).size;
            return fn.apply(target, args);
          };
        case "query":
          return async (...args: unknown[]) => {
            const rows = (await fn.apply(target, args)) as unknown[];
            stats.reads += Math.max(1, rows.length);
            return rows;
          };
        case "count":
          return async (...args: unknown[]) => {
            stats.reads += 1;
            return fn.apply(target, args);
          };
        case "insert":
          return async (...args: unknown[]) => {
            stats.writes += (args[1] as unknown[]).length;
            return fn.apply(target, args);
          };
        case "update":
        case "delete":
          return async (...args: unknown[]) => {
            stats.writes += 1;
            return fn.apply(target, args);
          };
        default:
          return fn.bind(target);
      }
    },
  });
  return { ds, stats };
}
