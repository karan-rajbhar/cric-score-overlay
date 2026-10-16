/**
 * Computed read models that replaced the Postgres views
 * `live_match_state` and `match_over_summaries`.
 *
 * They run on any DataSource so both the server (Admin SDK) and the browser
 * (web SDK, for the overlay control room) produce identical rows.
 */

import type { DataSource, Doc } from "./datasource";
import type { Filter } from "./filters";
import { inningsLimits } from "./scoring/result";
import type {
  BallByBallRow,
  BattingPerformancesRow,
  BowlingPerformancesRow,
  InningsRow,
  LiveMatchStateRow,
  MatchOverSummariesRow,
  MatchesRow,
  PartnershipsRow,
  TeamsRow,
  TournamentsRow,
  UsersRow,
} from "./types";

function findEq(filters: Filter[], field: string): string | null {
  for (const f of filters) {
    if (f.type === "eq" && f.field === field && f.value != null)
      return String(f.value);
  }
  return null;
}

export async function resolveView(
  ds: DataSource,
  view: string,
  filters: Filter[],
): Promise<Doc[]> {
  const matchId = findEq(filters, "match_id");
  if (!matchId) return [];
  if (view === "live_match_state") {
    const row = await buildLiveMatchState(ds, matchId);
    return row ? [{ ...row, id: matchId } as unknown as Doc] : [];
  }
  if (view === "match_over_summaries") {
    const rows = await buildOverSummaries(ds, matchId);
    return rows.map(
      (r, i) =>
        ({ ...r, id: `${matchId}_${r.innings_id}_${i}` }) as unknown as Doc,
    );
  }
  return [];
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

export async function buildLiveMatchState(
  ds: DataSource,
  matchId: string,
): Promise<LiveMatchStateRow | null> {
  const match = (await ds.getById(
    "matches",
    matchId,
  )) as unknown as MatchesRow | null;
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

export async function buildOverSummaries(
  ds: DataSource,
  matchId: string,
): Promise<MatchOverSummariesRow[]> {
  const balls = (await ds.query("ball_by_ball", [
    { field: "match_id", op: "==", value: matchId },
  ])) as unknown as BallByBallRow[];
  balls.sort((a, b) => (a.seq ?? 0) - (b.seq ?? 0));

  const groups = new Map<string, MatchOverSummariesRow>();
  for (const b of balls) {
    const key = `${b.innings_id}:${b.over_number}`;
    let row = groups.get(key);
    if (!row) {
      row = {
        match_id: matchId,
        innings_id: b.innings_id ?? null,
        over_number: b.over_number,
        runs: 0,
        extras_off_bat_and_bowler: 0,
        extras_total: 0,
        wickets: 0,
        wides: 0,
        no_balls: 0,
        legal_deliveries: 0,
        bowler_id: b.bowler_id ?? null,
      };
      groups.set(key, row);
    }
    const extras = b.extras ?? 0;
    row.runs = (row.runs ?? 0) + (b.runs_scored ?? 0);
    row.extras_total = (row.extras_total ?? 0) + extras;
    if (
      !(
        b.extra_type === "bye" ||
        b.extra_type === "leg_bye" ||
        b.extra_type === "penalty"
      )
    ) {
      row.extras_off_bat_and_bowler =
        (row.extras_off_bat_and_bowler ?? 0) + extras;
    }
    if (b.is_wicket) row.wickets = (row.wickets ?? 0) + 1;
    if (b.extra_type === "wide") row.wides = (row.wides ?? 0) + 1;
    if (b.extra_type === "no_ball") row.no_balls = (row.no_balls ?? 0) + 1;
    if (
      !b.extra_type ||
      (b.extra_type !== "wide" && b.extra_type !== "no_ball")
    ) {
      row.legal_deliveries = (row.legal_deliveries ?? 0) + 1;
    }
  }
  return Array.from(groups.values());
}
