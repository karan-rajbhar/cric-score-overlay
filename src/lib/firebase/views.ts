/**
 * Computed read models that replaced the Postgres views
 * `live_match_state` and `match_over_summaries`.
 *
 * They run on any DataSource so both the server (Admin SDK) and the browser
 * (web SDK, for the overlay control room) produce identical rows. The live
 * state reads the match, its current innings (which carries the scorecard
 * and the last ball) and the current over document, and the scoring engine
 * writes the same row to `live_state/{matchId}` (see `live-state.ts`) so
 * viewers can subscribe to one document instead.
 */

import { matchPositionOf } from "~/lib/match-position";
import { phaseBoundaries } from "~/lib/match-report";
import type { DataSource, Doc } from "./datasource";
import type { Filter } from "./filters";
import {
  creaseEvents,
  deliveryEvents,
  type DeliveryContext,
} from "./live-events";
import {
  ballLogOf,
  ballRowsOf,
  battingRowsOf,
  bowlingRowsOf,
  bySeq,
  lastBallRowOf,
  overDocId,
  OVERS_COLLECTION,
  partnershipRowsOf,
  type OversRow,
} from "./scorecard";
import { inningsLimits, isSuperOverInnings } from "./scoring/result";
import type { DocReader } from "./scoring/tx";
import type {
  BallByBallRow,
  BattingPerformancesRow,
  BowlingPerformancesRow,
  InningsRow,
  LiveEvent,
  LiveLastWicket,
  LiveMatchStateRow,
  LivePowerplay,
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

/** The over's deliveries; fielding-side penalty events are not shown. */
function overText(balls: BallByBallRow[]): string | null {
  const shown = balls.filter((b) => !b.penalty_team_id);
  return shown.length ? shown.map(ballText).join(" ") : null;
}

/** The runs off those deliveries (extras included). */
function overRuns(balls: BallByBallRow[]): number | null {
  const shown = balls.filter((b) => !b.penalty_team_id);
  return shown.length
    ? shown.reduce((n, b) => n + (b.runs_scored ?? 0) + (b.extras ?? 0), 0)
    : null;
}

export interface LiveStateTeam {
  name: string | null;
  short_name: string | null;
  logo_url: string | null;
  /** "#rrggbb" when the team has colours (absent on older snapshots). */
  primary_color?: string | null;
  secondary_color?: string | null;
}

/** A team's colours from its snapshot or document, when it has them. */
export function teamColoursOf(team: unknown): {
  primary_color: string | null;
  secondary_color: string | null;
} {
  const t = (team ?? {}) as Record<string, unknown>;
  const colour = (v: unknown) =>
    typeof v === "string" && /^#[0-9a-f]{6}$/i.test(v) ? v : null;
  return {
    primary_color: colour(t.primary_color),
    secondary_color: colour(t.secondary_color),
  };
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
  /**
   * What `live_state.events` reports: the delivery just recorded (with
   * the previous row), a crease / bowler change, or nothing (undo, edits
   * and rebuilds).
   */
  change?:
    | { kind: "delivery"; prev: LiveMatchStateRow | null; delivery: DeliveryContext }
    | { kind: "crease"; prev: LiveMatchStateRow | null }
    | null;
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
/** The match's own fields (header, teams, result). */
function matchFields(parts: LiveStateParts) {
  const { match, teams, innings: ci } = parts;
  const position = matchPositionOf(match, ci);
  const t1 = teams.get(match.team1_id);
  const t2 = teams.get(match.team2_id);
  const winner = match.winning_team_id
    ? teams.get(match.winning_team_id)
    : undefined;
  return {
    match_id: match.id,
    title: match.title,
    status: match.status ?? null,
    match_format: match.match_format ?? null,
    overs_per_innings: match.overs_per_innings ?? null,
    venue: match.venue ?? null,
    current_innings: match.current_innings ?? null,
    current_over: ci ? position.current_over : (match.current_over ?? null),
    current_ball: ci ? position.current_ball : (match.current_ball ?? null),
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
  };
}

/** Team colours for the overlay's team-colours theme, and the toss winner. */
function colourFields(parts: LiveStateParts) {
  const colours = (t: LiveStateTeam | undefined) =>
    t?.primary_color || t?.secondary_color
      ? {
          primary: t.primary_color ?? null,
          secondary: t.secondary_color ?? null,
        }
      : null;
  const team1 = colours(parts.teams.get(parts.match.team1_id));
  const team2 = colours(parts.teams.get(parts.match.team2_id));
  const toss = parts.match.toss_winner_team_id;
  return {
    toss_winner_name: toss ? (parts.teams.get(toss)?.name ?? null) : null,
    team_colors: team1 || team2 ? { team1, team2 } : null,
  };
}

/** The innings fields of a match with no innings yet (in the row's order). */
const NO_INNINGS_FIELDS = {
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
  striker_id: null,
  striker_fours: null,
  striker_sixes: null,
  non_striker_id: null,
  non_striker_fours: null,
  non_striker_sixes: null,
  bowler_id: null,
  bowler_maidens: null,
  last_wicket: null,
  powerplay: null,
} as const;

/** The current innings' totals and sides. */
function inningsFields(parts: LiveStateParts, ci: InningsRow) {
  const { match, teams } = parts;
  const battingTeam = teams.get(ci.team_id);
  const bowlingTeamId =
    ci.team_id === match.team1_id ? match.team2_id : match.team1_id;
  const bowlingTeam =
    match.status === "live" ? teams.get(bowlingTeamId) : undefined;
  return {
    innings_number: ci.innings_number,
    total_runs: ci.total_runs ?? 0,
    total_wickets: ci.total_wickets ?? 0,
    total_overs: ci.total_overs ?? 0,
    total_balls: ci.total_balls ?? 0,
    extras_total: ci.extras_total ?? 0,
    innings_completed: ci.is_completed ?? false,
    target_runs: ci.target_runs ?? null,
    batting_team_name: battingTeam?.name ?? null,
    batting_team_short_name: battingTeam?.short_name ?? null,
    bowling_team_name: bowlingTeam?.name ?? null,
    bowling_team_short_name: bowlingTeam?.short_name ?? null,
  };
}

/** The batters, bowler and stand in progress. */
function creaseFields(parts: LiveStateParts) {
  const { striker, nonStriker, bowler, partnership, nameOf } = parts;
  return {
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
    striker_id: striker?.user_id ?? null,
    striker_fours: striker?.fours ?? null,
    striker_sixes: striker?.sixes ?? null,
    non_striker_id: nonStriker?.user_id ?? null,
    non_striker_fours: nonStriker?.fours ?? null,
    non_striker_sixes: nonStriker?.sixes ?? null,
    bowler_id: bowler?.user_id ?? null,
    bowler_maidens: bowler?.maidens ?? null,
  };
}

/** The innings' latest dismissal, from its fall of wickets and card. */
function lastWicketOf(
  parts: LiveStateParts,
  ci: InningsRow,
): LiveLastWicket | null {
  const fall = [...(ci.fall_of_wickets ?? [])].sort(
    (a, b) => a.wicket_number - b.wicket_number,
  );
  const last = fall[fall.length - 1];
  if (!last?.batsman_out_id) return null;
  const card = battingRowsOf(ci).find((b) => b.user_id === last.batsman_out_id);
  return {
    player_id: last.batsman_out_id,
    name: parts.nameOf(last.batsman_out_id),
    runs: card?.runs_scored ?? 0,
    balls: card?.balls_faced ?? 0,
    dismissal_type: last.dismissal_type ?? null,
    bowler_name: parts.nameOf(last.bowler_id),
    wicket_number: last.wicket_number,
    score: last.runs_at_fall,
    overs: last.overs_at_fall,
  };
}

/**
 * The powerplay while it is on: overs 1 to 6 of a T20, 1 to 10 of a
 * 50-over innings, in proportion for other lengths (as the match report
 * splits phases). There is no match setting for it yet.
 */
function powerplayOf(
  parts: LiveStateParts,
  ci: InningsRow,
): LivePowerplay | null {
  if (isSuperOverInnings(ci.innings_number) || ci.is_completed) return null;
  const maxOvers = parts.match.overs_per_innings;
  if (!maxOvers) return null;
  const bounds = phaseBoundaries(maxOvers);
  if (!bounds) return null;
  const bpo = inningsLimits(parts.match, ci.innings_number).ballsPerOver;
  const over = Math.floor((ci.total_balls ?? 0) / bpo) + 1;
  return over <= bounds.ppEnd ? { end_over: bounds.ppEnd } : null;
}

/** Run rates, and the chase when there is a target. */
function rateFields(parts: LiveStateParts, ci: InningsRow) {
  const limits = inningsLimits(parts.match, ci.innings_number);
  const bpo = limits.ballsPerOver;
  const totalBalls = ci.total_balls ?? 0;
  const totalRuns = ci.total_runs ?? 0;
  const chasing =
    ci.target_runs !== null && ci.target_runs !== undefined && !ci.is_completed;
  const ballsRemaining = chasing
    ? Math.max(limits.maxBalls - totalBalls, 0)
    : null;
  const runsNeeded = chasing ? (ci.target_runs ?? 0) - totalRuns : null;
  return {
    current_run_rate:
      totalBalls > 0 ? round2((totalRuns * bpo) / totalBalls) : null,
    runs_needed: runsNeeded,
    balls_remaining: ballsRemaining,
    required_run_rate:
      ballsRemaining !== null && ballsRemaining > 0 && runsNeeded !== null
        ? round2((runsNeeded * bpo) / ballsRemaining)
        : null,
  };
}

/** The last entry of the ball log. */
function lastBallFields(parts: LiveStateParts) {
  const { lastBall, nameOf } = parts;
  if (!lastBall) {
    return {
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
  }
  return {
    last_ball_runs: lastBall.runs_scored ?? null,
    last_ball_extras: lastBall.extras ?? null,
    last_ball_extra_type: lastBall.extra_type ?? null,
    last_ball_is_wicket: lastBall.is_wicket ?? null,
    last_ball_dismissal_type: lastBall.dismissal_type ?? null,
    last_ball_dismissed_player: nameOf(
      lastBall.dismissed_player_id ?? lastBall.batsman_id,
    ),
    last_ball_fielder: nameOf(lastBall.fielder_id),
    last_ball_commentary: lastBall.commentary ?? null,
    last_ball_seq: lastBall.seq ?? null,
  };
}

/** `live_state.events` for the change described by `parts.change`. */
function eventsOf(parts: LiveStateParts, row: LiveMatchStateRow): LiveEvent[] {
  const change = parts.change;
  if (change?.kind === "delivery") {
    return deliveryEvents(change.prev, row, change.delivery, parts.nameOf);
  }
  if (change?.kind === "crease") return creaseEvents(change.prev, row);
  return [];
}

export function composeLiveMatchState(
  parts: LiveStateParts,
): LiveMatchStateRow {
  const base: LiveMatchStateRow = {
    ...matchFields(parts),
    ...NO_INNINGS_FIELDS,
    ...colourFields(parts),
  };
  const ci = parts.innings;
  const row: LiveMatchStateRow = ci
    ? {
        ...base,
        ...inningsFields(parts, ci),
        ...creaseFields(parts),
        this_over_balls: overText(parts.thisOver),
        this_over_runs: overRuns(parts.thisOver),
        ...rateFields(parts, ci),
        ...lastBallFields(parts),
        last_wicket: lastWicketOf(parts, ci),
        powerplay: powerplayOf(parts, ci),
      }
    : base;
  return { ...row, events: eventsOf(parts, row) };
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

/** The over documents of one innings (one read per over). */
export async function loadInningsOvers(
  reader: DocReader,
  inningsId: string,
): Promise<OversRow[]> {
  return (await reader.query(OVERS_COLLECTION, [
    { field: "innings_id", op: "==", value: inningsId },
  ])) as unknown as OversRow[];
}

/** Balls of one over in `seq` order (one read). */
export async function loadOverBalls(
  reader: DocReader,
  inningsId: string,
  overNumber: number,
): Promise<BallByBallRow[]> {
  const over = (await reader.getById(
    OVERS_COLLECTION,
    overDocId(inningsId, overNumber),
  )) as unknown as OversRow | null;
  return over ? ballRowsOf(over).sort(bySeq) : [];
}

/**
 * Last ball of the innings by `seq`: the innings' `last_ball` cache, or for
 * documents that predate it, the whole innings log.
 */
export async function loadLastBall(
  reader: DocReader,
  innings: InningsRow,
): Promise<BallByBallRow | null> {
  if (innings.last_ball !== undefined) return lastBallRowOf(innings);
  const balls = ballLogOf(await loadInningsOvers(reader, innings.id));
  return balls.length ? balls[balls.length - 1]! : null;
}

/** Rows flagged current in the innings scorecard (as the flag queries did). */
export function currentRowsOf(innings: InningsRow): {
  batters: BattingPerformancesRow[];
  bowlers: BowlingPerformancesRow[];
  partnerships: PartnershipsRow[];
} {
  return {
    batters: battingRowsOf(innings).filter(
      (b) => b.is_current_batsman === true,
    ),
    bowlers: bowlingRowsOf(innings).filter((b) => b.is_current_bowler === true),
    partnerships: partnershipRowsOf(innings).filter(
      (p) => p.is_current === true,
    ),
  };
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
        ...teamColoursOf(snap),
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
  // The tournament name too, from the match's snapshot when it has one.
  const tournamentSnap =
    match.tournament_snapshot?.id === match.tournament_id
      ? match.tournament_snapshot
      : null;
  const [teamDocs, tournament] = await Promise.all([
    teamIds.length
      ? (reader.getByIds("teams", teamIds) as Promise<unknown> as Promise<
          TeamsRow[]
        >)
      : Promise.resolve([] as TeamsRow[]),
    tournamentSnap
      ? Promise.resolve({ name: tournamentSnap.name } as TournamentsRow)
      : match.tournament_id
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
      ...teamColoursOf(t),
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
 * Loads only what the live scoreboard shows: the match, the current innings
 * (current batters / bowler / partnership and the last ball come from its
 * scorecard) and the current over document.
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
  const [thisOver, lastBall] = await Promise.all([
    loadOverBalls(reader, ci.id, thisOverNumber),
    loadLastBall(reader, ci),
  ]);
  const current = currentRowsOf(ci);
  parts.thisOver = thisOver;
  parts.striker = current.batters.find((b) => b.is_striker) ?? null;
  parts.nonStriker = current.batters.find((b) => !b.is_striker) ?? null;
  parts.bowler = current.bowlers[0] ?? null;
  parts.partnership = current.partnerships[0] ?? null;
  parts.lastBall = lastBall;

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
  // One read per over document instead of one per ball.
  const overs = (await ds.query(OVERS_COLLECTION, [
    { field: "match_id", op: "==", value: matchId },
  ])) as unknown as OversRow[];
  return overSummariesOf(matchId, ballLogOf(overs));
}

/** `match_over_summaries` rows of a ball log (one per innings and over). */
export function overSummariesOf(
  matchId: string,
  balls: ReadonlyArray<
    Pick<
      BallByBallRow,
      | "innings_id"
      | "over_number"
      | "bowler_id"
      | "runs_scored"
      | "extras"
      | "extra_type"
      | "is_wicket"
    >
  >,
): MatchOverSummariesRow[] {
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
