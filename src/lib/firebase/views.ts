/**
 * Computed read models that replaced the Postgres views
 * `live_match_state` and `match_over_summaries`.
 *
 * They run on any DataSource so both the server (Admin SDK) and the browser
 * (web SDK, for the overlay control room) produce identical rows. The live
 * state reads only the rows the scoreboard shows (~15 documents), and the
 * scoring engine writes the same row to `live_state/{matchId}` (see
 * `live-state.ts`) so viewers can subscribe to one document instead.
 */

import type { DataSource, Doc } from "./datasource";
import type { Filter } from "./filters";
import { inningsLimits } from "./scoring/result";
import type { DocReader } from "./scoring/tx";
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

export interface LiveStateTeam {
  name: string | null;
  short_name: string | null;
  logo_url: string | null;
}

/** Everything `live_match_state` is derived from, already loaded. */
export interface LiveStateParts {
  match: MatchesRow;
  /** team1, team2 and the winner (when set), keyed by id. */
  teams: Map<string, LiveStateTeam>;
  tournamentName: string | null;
  /** The match's current innings, if it exists. */
  innings: InningsRow | null;
  striker: BattingPerformancesRow | null;
  nonStriker: BattingPerformancesRow | null;
  bowler: BowlingPerformancesRow | null;
  partnership: PartnershipsRow | null;
  /** Balls of the current over in `seq` order. */
  thisOver: BallByBallRow[];
  lastBall: BallByBallRow | null;
  nameOf: (id: string | null | undefined) => string | null;
}

function bySeq(a: { seq?: number | null }, b: { seq?: number | null }) {
  return (a.seq ?? 0) - (b.seq ?? 0);
}

/** Player ids whose names the live state shows. */
export function liveStateUserIds(
  parts: Pick<LiveStateParts, "striker" | "nonStriker" | "bowler" | "lastBall">,
): string[] {
  const { striker, nonStriker, bowler, lastBall } = parts;
  return Array.from(
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
}

/** Pure projection of the loaded parts into a `live_match_state` row. */
export function composeLiveMatchState(
  parts: LiveStateParts,
): LiveMatchStateRow {
  const { match, teams, innings: ci, nameOf } = parts;
  const t1 = teams.get(match.team1_id);
  const t2 = teams.get(match.team2_id);
  const winner = match.winning_team_id
    ? teams.get(match.winning_team_id)
    : undefined;

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
    tournament_name: parts.tournamentName ?? null,
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

  const { striker, nonStriker, bowler, partnership, lastBall, thisOver } =
    parts;
  const limits = inningsLimits(match, ci.innings_number);
  const bpo = limits.ballsPerOver;
  const totalBalls = ci.total_balls ?? 0;
  const totalRuns = ci.total_runs ?? 0;
  const battingTeam = teams.get(ci.team_id);
  const bowlingTeamId =
    ci.team_id === match.team1_id ? match.team2_id : match.team1_id;
  const bowlingTeam =
    match.status === "live" ? teams.get(bowlingTeamId) : undefined;

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

/** The match's current innings via an equality query (one document). */
export async function loadCurrentInnings(
  reader: DocReader,
  match: Pick<MatchesRow, "id" | "current_innings">,
): Promise<InningsRow | null> {
  const docs = (await reader.query("innings", [
    { field: "match_id", op: "==", value: match.id },
    { field: "innings_number", op: "==", value: match.current_innings ?? 1 },
  ])) as unknown as InningsRow[];
  return docs[0] ?? null;
}

/**
 * Last ball of the innings by `seq`. `matches.last_ball_seq` points at it
 * directly; after an undo (or for a fresh innings) the whole innings log is
 * read instead.
 */
export async function loadLastBall(
  reader: DocReader,
  inningsId: string,
  lastBallSeq: number | null | undefined,
  known: BallByBallRow[] = [],
): Promise<BallByBallRow | null> {
  let candidates: BallByBallRow[] = [];
  if (lastBallSeq !== null && lastBallSeq !== undefined) {
    candidates = (await reader.query("ball_by_ball", [
      { field: "innings_id", op: "==", value: inningsId },
      { field: "seq", op: "==", value: lastBallSeq },
    ])) as unknown as BallByBallRow[];
  }
  if (!candidates.length) {
    candidates = (await reader.query("ball_by_ball", [
      { field: "innings_id", op: "==", value: inningsId },
    ])) as unknown as BallByBallRow[];
  } else {
    candidates = [...candidates, ...known];
  }
  if (!candidates.length) return null;
  const sorted = [...candidates].sort(bySeq);
  return sorted[sorted.length - 1]!;
}

/** Team / tournament display fields for a match. */
export async function loadMatchHeader(
  reader: DocReader,
  match: MatchesRow,
): Promise<{
  teams: Map<string, LiveStateTeam>;
  tournamentName: string | null;
}> {
  // Team fields come from the match's snapshots when present (no reads).
  const teams = new Map<string, LiveStateTeam>();
  for (const snap of [match.team1_snapshot, match.team2_snapshot]) {
    if (snap?.id) {
      teams.set(snap.id, {
        name: snap.name ?? null,
        short_name: snap.short_name ?? null,
        logo_url: snap.logo_url ?? null,
      });
    }
  }
  const teamIds = Array.from(
    new Set(
      [match.team1_id, match.team2_id, match.winning_team_id].filter(
        (x): x is string => !!x && !teams.has(x),
      ),
    ),
  );
  const [teamDocs, tournament] = await Promise.all([
    teamIds.length
      ? (reader.getByIds("teams", teamIds) as Promise<unknown> as Promise<
          TeamsRow[]
        >)
      : Promise.resolve([] as TeamsRow[]),
    match.tournament_id
      ? (reader.getById(
          "tournaments",
          match.tournament_id,
        ) as Promise<unknown> as Promise<TournamentsRow | null>)
      : Promise.resolve(null),
  ]);
  for (const t of teamDocs) {
    teams.set(t.id, {
      name: t.name ?? null,
      short_name: t.short_name ?? null,
      logo_url: t.logo_url ?? null,
    });
  }
  return { teams, tournamentName: tournament?.name ?? null };
}

export async function loadNames(
  reader: DocReader,
  ids: string[],
  known: Record<string, string | null> = {},
): Promise<Record<string, string | null>> {
  const out: Record<string, string | null> = {};
  const missing: string[] = [];
  for (const id of ids) {
    if (Object.prototype.hasOwnProperty.call(known, id))
      out[id] = known[id] ?? null;
    else missing.push(id);
  }
  if (missing.length) {
    const docs = (await reader.getByIds(
      "users",
      missing,
    )) as unknown as UsersRow[];
    for (const id of missing) out[id] = null;
    for (const u of docs) out[u.id] = u.full_name ?? null;
  }
  return out;
}

export function nameLookup(names: Record<string, string | null>) {
  return (id: string | null | undefined) => (id ? (names[id] ?? null) : null);
}

/**
 * Loads only what the live scoreboard shows: the current innings, its
 * current batters / bowler / partnership (equality queries on the flags),
 * the balls of the current over and the last ball.
 */
export async function loadLiveStateParts(
  reader: DocReader,
  matchId: string,
): Promise<{
  parts: LiveStateParts;
  names: Record<string, string | null>;
} | null> {
  const match = (await reader.getById(
    "matches",
    matchId,
  )) as unknown as MatchesRow | null;
  if (!match) return null;

  const [header, ci] = await Promise.all([
    loadMatchHeader(reader, match),
    loadCurrentInnings(reader, match),
  ]);

  const parts: LiveStateParts = {
    match,
    teams: header.teams,
    tournamentName: header.tournamentName,
    innings: ci,
    striker: null,
    nonStriker: null,
    bowler: null,
    partnership: null,
    thisOver: [],
    lastBall: null,
    nameOf: () => null,
  };
  if (!ci) return { parts, names: {} };

  const bpo = inningsLimits(match, ci.innings_number).ballsPerOver;
  const thisOverNumber = Math.floor((ci.total_balls ?? 0) / bpo);
  const [battingDocs, bowlingDocs, partnershipDocs, overDocs] =
    await Promise.all([
      reader.query("batting_performances", [
        { field: "innings_id", op: "==", value: ci.id },
        { field: "is_current_batsman", op: "==", value: true },
      ]) as Promise<unknown> as Promise<BattingPerformancesRow[]>,
      reader.query("bowling_performances", [
        { field: "innings_id", op: "==", value: ci.id },
        { field: "is_current_bowler", op: "==", value: true },
      ]) as Promise<unknown> as Promise<BowlingPerformancesRow[]>,
      reader.query("partnerships", [
        { field: "innings_id", op: "==", value: ci.id },
        { field: "is_current", op: "==", value: true },
      ]) as Promise<unknown> as Promise<PartnershipsRow[]>,
      reader.query("ball_by_ball", [
        { field: "innings_id", op: "==", value: ci.id },
        { field: "over_number", op: "==", value: thisOverNumber },
      ]) as Promise<unknown> as Promise<BallByBallRow[]>,
    ]);
  const thisOver = [...overDocs].sort(bySeq);
  parts.thisOver = thisOver;
  parts.striker = battingDocs.find((b) => b.is_striker) ?? null;
  parts.nonStriker = battingDocs.find((b) => !b.is_striker) ?? null;
  parts.bowler = bowlingDocs[0] ?? null;
  parts.partnership = partnershipDocs[0] ?? null;
  parts.lastBall = await loadLastBall(
    reader,
    ci.id,
    match.last_ball_seq,
    thisOver,
  );

  const names = await loadNames(reader, liveStateUserIds(parts));
  parts.nameOf = nameLookup(names);
  return { parts, names };
}

export async function buildLiveMatchState(
  ds: DocReader,
  matchId: string,
): Promise<LiveMatchStateRow | null> {
  const loaded = await loadLiveStateParts(ds, matchId);
  return loaded ? composeLiveMatchState(loaded.parts) : null;
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
