/**
 * Figures a broadcast package shows, worked out from an element's props
 * (the live row, the page's match): never invented, never read from
 * anywhere else. Pure (no React), shared by every package; each package
 * draws them its own way.
 *
 * Re-exports the overlay's small formatters too, so a package needs one
 * import for its data.
 */

import {
  deliveryLabelKind,
  isLegalDeliveryLabel,
  type DeliveryLabelKind,
} from "~/lib/cricket";
import type { Innings, Match } from "~/lib/match-types";
import { winPredictorFromLive, type WinEstimate } from "~/lib/win-predictor";
import type { LiveMatchState } from "../../types";

export {
  economyText,
  overTokens,
  oversText,
  strikeRateText,
  teamCode,
} from "../../overlay-kit";
export {
  ballsPerOverOf,
  overlayPhaseOf,
  sidesOf,
  tossLineOf,
  type OverlayPhase,
  type Side,
} from "../../score-bug";
export { strapText, type StrapText } from "../../strap-views";

// ---- balls and overs ----------------------------------------------------------

/** Legal balls in the innings (one over in a super over, DLS overs when revised); null when unknown. */
export function inningsBalls(
  state: Pick<LiveMatchState, "innings_number" | "overs_per_innings" | "dls_overs">,
  ballsPerOver = 6,
): number | null {
  if ((state.innings_number ?? 1) >= 3) return ballsPerOver;
  const overs = state.dls_overs ?? state.overs_per_innings;
  return overs && overs > 0 ? Math.round(overs * ballsPerOver) : null;
}

/** Legal balls bowled in the innings so far. */
export function ballsBowled(state: Pick<LiveMatchState, "total_balls">): number {
  return Math.max(0, state.total_balls ?? 0);
}

/**
 * Legal balls left in the innings: the chase's own figure when the row
 * has it, else the innings' limit less the balls bowled; null without a
 * limit.
 */
export function ballsRemaining(
  state: Pick<
    LiveMatchState,
    "balls_remaining" | "total_balls" | "innings_number" | "overs_per_innings" | "dls_overs"
  >,
  ballsPerOver = 6,
): number | null {
  if (state.balls_remaining !== null && state.balls_remaining !== undefined) {
    return Math.max(0, state.balls_remaining);
  }
  const limit = inningsBalls(state, ballsPerOver);
  return limit === null ? null : Math.max(0, limit - ballsBowled(state));
}

// ---- the chase ------------------------------------------------------------------

export interface ChaseLine {
  target: number;
  runsNeeded: number;
  ballsRemaining: number;
  /** Runs an over needed; null when no balls are left. */
  requiredRate: number | null;
  currentRate: number | null;
  /** "Need 19 from 8 balls". */
  text: string;
  /** "19 from 8". */
  short: string;
}

/** The chase in progress (target set, runs still needed); null otherwise. */
export function chaseLine(state: LiveMatchState, ballsPerOver = 6): ChaseLine | null {
  if (state.target_runs === null || state.target_runs === undefined) return null;
  if (state.innings_completed) return null;
  const runsNeeded =
    state.runs_needed ?? state.target_runs - (state.total_runs ?? 0);
  const left = ballsRemaining(state, ballsPerOver);
  if (runsNeeded <= 0 || left === null) return null;
  const requiredRate =
    state.required_run_rate ?? (left > 0 ? (runsNeeded * ballsPerOver) / left : null);
  const balls = left === 1 ? "ball" : "balls";
  return {
    target: state.target_runs,
    runsNeeded,
    ballsRemaining: left,
    requiredRate,
    currentRate: state.current_run_rate ?? null,
    text: `Need ${runsNeeded} from ${left} ${balls}`,
    short: `${runsNeeded} from ${left}`,
  };
}

export interface RateMeter {
  /** Behind the required rate, level with it, or ahead. */
  trend: "behind" | "level" | "ahead";
  /** Segments lit on that side, 0 to `segments`. */
  lit: number;
  segments: number;
  /** Current minus required rate. */
  gap: number;
}

/**
 * A chase's rate meter (behind / level / ahead of the required rate):
 * one segment per run an over of difference, up to `segments`; level
 * within half a run. Null outside a chase in play.
 */
export function rateMeter(
  state: Pick<
    LiveMatchState,
    | "current_run_rate"
    | "required_run_rate"
    | "target_runs"
    | "runs_needed"
    | "innings_completed"
    | "total_balls"
  >,
  segments = 5,
): RateMeter | null {
  if (
    state.target_runs === null ||
    state.target_runs === undefined ||
    state.innings_completed ||
    (state.runs_needed ?? 0) <= 0 ||
    state.current_run_rate === null ||
    state.required_run_rate === null ||
    !state.total_balls
  ) {
    return null;
  }
  const gap = state.current_run_rate - state.required_run_rate;
  if (Math.abs(gap) < 0.5) return { trend: "level", lit: 0, segments, gap };
  return {
    trend: gap > 0 ? "ahead" : "behind",
    lit: Math.min(segments, Math.max(1, Math.round(Math.abs(gap)))),
    segments,
    gap,
  };
}

// ---- projections ----------------------------------------------------------------

export interface Projection {
  /** "CRR" or the rate itself ("8"). */
  label: string;
  rate: number;
  total: number;
  /** The current scoring rate's row. */
  current: boolean;
}

/**
 * Where the batting side would finish scoring at its current rate and at
 * fixed rates (8, 10, 12 an over) from here: first innings in play only,
 * once a ball has been bowled, with balls left. A fixed rate within 0.05
 * of the current one is left out (it says the same).
 */
export function projectedTotals(
  state: LiveMatchState,
  ballsPerOver = 6,
  rates: readonly number[] = [8, 10, 12],
): Projection[] {
  if ((state.innings_number ?? 0) !== 1 || state.innings_completed) return [];
  const limit = inningsBalls(state, ballsPerOver);
  const balls = ballsBowled(state);
  if (!limit || balls <= 0 || balls >= limit) return [];
  const runs = state.total_runs ?? 0;
  const oversLeft = (limit - balls) / ballsPerOver;
  const crr = (runs * ballsPerOver) / balls;
  const at = (rate: number) => Math.round(runs + rate * oversLeft);
  const out: Projection[] = [
    { label: "CRR", rate: Math.round(crr * 100) / 100, total: at(crr), current: true },
  ];
  for (const r of rates) {
    if (Math.abs(r - crr) < 0.05) continue;
    out.push({ label: String(r), rate: r, total: at(r), current: false });
  }
  return out;
}

/**
 * The model's estimate for this row (`~/lib/win-predictor`): a projected
 * range in a first innings, each side's chance in a chase; null when no
 * innings is in play. Always shown as an estimate.
 */
export function estimateOf(state: LiveMatchState): WinEstimate | null {
  return winPredictorFromLive(state);
}

// ---- partnership ----------------------------------------------------------------

export interface PartnerShare {
  id: string | null;
  name: string | null;
  /** Their runs and balls in this stand (null when the innings has no split). */
  runs: number | null;
  balls: number | null;
}

export interface Partnership {
  runs: number;
  balls: number;
  /** Runs an over; null before a ball. */
  runRate: number | null;
  /** Striker first. */
  batters: [PartnerShare, PartnerShare];
  /** Both shares known (the innings' current stand names both batters). */
  split: boolean;
}

/** The innings with number `n`. */
export function inningsNo(innings: readonly Innings[], n: number): Innings | undefined {
  return innings.find((i) => i.innings_number === n);
}

/**
 * The current stand: its runs and balls from the live row, each batter's
 * share from the innings' partnerships when the match carries them.
 * Null without two batters at the crease.
 */
export function partnershipOf(
  state: LiveMatchState,
  innings: readonly Innings[] = [],
): Partnership | null {
  if (!state.striker_name || !state.non_striker_name) return null;
  const current = inningsNo(innings, state.innings_number ?? 0);
  const stand = current?.partnerships?.find((p) => p.is_current);
  const share = (id: string | null | undefined, name: string | null): PartnerShare => {
    const base = { id: id ?? null, name };
    if (!stand || !id) return { ...base, runs: null, balls: null };
    if (stand.batsman1_id === id) {
      return { ...base, runs: stand.batsman1_runs ?? null, balls: stand.batsman1_balls ?? null };
    }
    if (stand.batsman2_id === id) {
      return { ...base, runs: stand.batsman2_runs ?? null, balls: stand.batsman2_balls ?? null };
    }
    return { ...base, runs: null, balls: null };
  };
  const batters: [PartnerShare, PartnerShare] = [
    share(state.striker_id, state.striker_name),
    share(state.non_striker_id, state.non_striker_name),
  ];
  const runs = state.partnership_runs ?? 0;
  const balls = state.partnership_balls ?? 0;
  return {
    runs,
    balls,
    runRate: balls > 0 ? (runs * 6) / balls : null,
    batters,
    split: batters.every((b) => b.runs !== null),
  };
}

// ---- this over --------------------------------------------------------------------

export type DeliveryKind = DeliveryLabelKind;

export interface OverBall {
  /** As the live row has it: "4", "W", "W+3", "wd", "nb+2b", "lb1", "rh"... */
  token: string;
  kind: DeliveryKind;
  /** What to print: the token itself ("nb+2b" stays as it is). */
  label: string;
  /** A legal delivery (wides, no-balls and events between balls are not). */
  legal: boolean;
}

/** One entry of `this_over_balls`, classified. */
export function overBall(token: string): OverBall {
  const t = token.trim();
  return {
    token: t,
    kind: deliveryLabelKind(t),
    label: t,
    legal: isLegalDeliveryLabel(t),
  };
}

/** This over's entries, classified (`live_state.this_over_balls`). */
export function thisOverBalls(state: Pick<LiveMatchState, "this_over_balls">): OverBall[] {
  return (state.this_over_balls ?? "")
    .split(" ")
    .filter(Boolean)
    .map(overBall);
}

/** Empty slots left in the over: balls per over less the legal ones bowled. */
export function overSlotsLeft(balls: readonly OverBall[], ballsPerOver = 6): number {
  return Math.max(0, ballsPerOver - balls.filter((b) => b.legal).length);
}

// ---- figures -------------------------------------------------------------------------

/** "34 (28)", "34* (28)" when not out. */
export function batterFigures(
  runs: number | null | undefined,
  balls: number | null | undefined,
  notOut = false,
): string {
  return `${runs ?? 0}${notOut ? "*" : ""} (${balls ?? 0})`;
}

/** "2-26": wickets then runs. */
export function bowlerFigures(
  wickets: number | null | undefined,
  runs: number | null | undefined,
): string {
  return `${wickets ?? 0}-${runs ?? 0}`;
}

export interface BatterNow {
  id: string | null;
  name: string;
  runs: number;
  balls: number;
  fours: number | null;
  sixes: number | null;
  /** One decimal; null before a ball. */
  strikeRate: string | null;
  striker: boolean;
  /** "34 (28)". */
  figures: string;
}

/** The striker or non-striker from the live row; null when nobody is there. */
export function batterNow(
  state: LiveMatchState,
  slot: "striker" | "non_striker",
): BatterNow | null {
  const s = slot === "striker";
  const name = s ? state.striker_name : state.non_striker_name;
  if (!name) return null;
  const runs = (s ? state.striker_runs : state.non_striker_runs) ?? 0;
  const balls = (s ? state.striker_balls : state.non_striker_balls) ?? 0;
  return {
    id: (s ? state.striker_id : state.non_striker_id) ?? null,
    name,
    runs,
    balls,
    fours: (s ? state.striker_fours : state.non_striker_fours) ?? null,
    sixes: (s ? state.striker_sixes : state.non_striker_sixes) ?? null,
    strikeRate: balls > 0 ? ((runs * 100) / balls).toFixed(1) : null,
    striker: s,
    figures: batterFigures(runs, balls),
  };
}

export interface BowlerNow {
  id: string | null;
  name: string;
  wickets: number;
  runs: number;
  balls: number;
  /** "3.4". */
  overs: string;
  maidens: number | null;
  /** Two decimals; null before a ball. */
  economy: string | null;
  /** "2-26". */
  figures: string;
  /** "2-26 (3.4)". */
  line: string;
}

/** The bowler from the live row; null when nobody is bowling. */
export function bowlerNow(state: LiveMatchState, ballsPerOver = 6): BowlerNow | null {
  const name = state.current_bowler_name;
  if (!name) return null;
  const balls = state.bowler_balls ?? 0;
  const runs = state.bowler_runs ?? 0;
  const wickets = state.bowler_wickets ?? 0;
  const overs = `${Math.floor(balls / ballsPerOver)}.${balls % ballsPerOver}`;
  return {
    id: state.bowler_id ?? null,
    name,
    wickets,
    runs,
    balls,
    overs,
    maidens: state.bowler_maidens ?? null,
    economy: balls > 0 ? ((runs * 6) / balls).toFixed(2) : null,
    figures: bowlerFigures(wickets, runs),
    line: `${bowlerFigures(wickets, runs)} (${overs})`,
  };
}

// ---- names ----------------------------------------------------------------------------

/** "RI" from "Ravi Iyer"; "" without a name. */
export function initialsOf(name: string | null | undefined): string {
  return (name ?? "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
}

/**
 * A crest's monogram: the initials of a team's name ("Riverside Rangers"
 * RR, "Quarry Lane Kites" QLK), else its code.
 */
export function monogramOf(name: string | null | undefined, code: string): string {
  const words = (name ?? "").split(/\s+/).filter((w) => /^[A-Za-z0-9]/.test(w));
  if (words.length < 2) return code;
  return words
    .slice(0, 3)
    .map((w) => w[0]!.toUpperCase())
    .join("");
}

/**
 * A long name shortened to fit `max` characters: first names become
 * initials ("Venkatanarasimha Raghavan" "V. Raghavan"), then the last
 * name alone, then the last name cut with an ellipsis. Short names stay.
 */
export function shortName(name: string | null | undefined, max = 18): string {
  const full = (name ?? "").trim().replace(/\s+/g, " ");
  if (full.length <= max) return full;
  const parts = full.split(" ");
  const last = parts[parts.length - 1]!;
  if (parts.length > 1) {
    const initials = parts
      .slice(0, -1)
      .map((p) => `${p[0]!.toUpperCase()}.`)
      .join(" ");
    const withInitials = `${initials} ${last}`;
    if (withInitials.length <= max) return withInitials;
    const one = `${parts[0]![0]!.toUpperCase()}. ${last}`;
    if (one.length <= max) return one;
  }
  if (last.length <= max) return last;
  return `${last.slice(0, Math.max(1, max - 1))}…`;
}

/** "(c)" / "(wk)" after a name, from a squad role. */
export function roleMark(role: string | null | undefined): string {
  if (role === "captain") return " (c)";
  if (role === "wicket_keeper") return " (wk)";
  return "";
}

// ---- players and innings ------------------------------------------------------------------

/**
 * A player's photo from what the match already carries (player of the
 * match, squads, innings figures): no reads. Null when none has one.
 */
export function avatarOf(
  match: Match | null | undefined,
  userId: string | null | undefined,
): string | null {
  if (!match || !userId) return null;
  if (match.player_of_the_match?.id === userId && match.player_of_the_match.avatar_url) {
    return match.player_of_the_match.avatar_url;
  }
  for (const team of [match.team1, match.team2]) {
    const p = team?.team_players?.find((tp) => tp.user_id === userId);
    if (p?.user?.avatar_url) return p.user.avatar_url;
  }
  for (const inn of match.innings ?? []) {
    const row =
      inn.batting_performances?.find((b) => b.user_id === userId)?.user ??
      inn.bowling_performances?.find((b) => b.user_id === userId)?.user;
    if (row?.avatar_url) return row.avatar_url;
  }
  return null;
}

/** Which side (1 / 2) a player is in, from the squads or the innings; null when unknown. */
export function playerTeamOf(
  match: Match | null | undefined,
  userId: string | null | undefined,
): 1 | 2 | null {
  if (!match || !userId) return null;
  if (match.team1?.team_players?.some((tp) => tp.user_id === userId)) return 1;
  if (match.team2?.team_players?.some((tp) => tp.user_id === userId)) return 2;
  for (const inn of match.innings ?? []) {
    const batted = inn.batting_performances?.some((b) => b.user_id === userId);
    const bowled = inn.bowling_performances?.some((b) => b.user_id === userId);
    if (!batted && !bowled) continue;
    const battingSide = inn.team_id === match.team1_id ? 1 : 2;
    if (batted) return battingSide;
    return battingSide === 1 ? 2 : 1;
  }
  return null;
}

/** Best batters (by runs, then fewer balls) and bowlers (by wickets, then fewer runs) of an innings. */
export function inningsLeaders(innings: Innings, bat = 3, bowl = 2) {
  return {
    batters: [...(innings.batting_performances ?? [])]
      .filter((b) => b.balls_faced > 0)
      .sort((a, b) => b.runs_scored - a.runs_scored || a.balls_faced - b.balls_faced)
      .slice(0, bat),
    bowlers: [...(innings.bowling_performances ?? [])]
      .filter((b) => b.balls_bowled > 0)
      .sort((a, b) => b.wickets_taken - a.wickets_taken || a.runs_conceded - b.runs_conceded)
      .slice(0, bowl),
  };
}
