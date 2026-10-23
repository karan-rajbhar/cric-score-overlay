/**
 * The Hundred-ball package counts balls, never overs: balls bowled and
 * balls left in the innings, the set (or over) in progress, the chase as
 * "runs from balls" and a wicket's ball number. Pure, from the live row
 * and the page's match only.
 *
 * Balls per over: the match says (`balls_per_over`); straps get no match,
 * so it is read back from the live row's position (`current_over` /
 * `current_ball` are derived from it) or the chase, else 6.
 */

import type { BallEvent, Match } from "~/lib/match-types";
import type { LiveMatchState } from "../../types";

type Position = Pick<
  LiveMatchState,
  | "total_balls"
  | "current_over"
  | "current_ball"
  | "balls_remaining"
  | "overs_per_innings"
  | "innings_number"
>;

const plausible = (n: number) => Number.isInteger(n) && n >= 1 && n <= 12;

/** Legal deliveries per over (a "set" of five in a 100-ball game). */
export function ballsPerOverFrom(
  state: Position | null | undefined,
  match?: Pick<Match, "balls_per_over"> | null,
): number {
  if (match?.balls_per_over && match.balls_per_over > 0) {
    return match.balls_per_over;
  }
  if (!state) return 6;
  const total = state.total_balls ?? 0;
  const over = state.current_over ?? 0;
  const ball = state.current_ball ?? 0;
  // current_over = floor(total / bpo), current_ball = total % bpo.
  if (over > 0 && total >= ball) {
    const bpo = (total - ball) / over;
    if (plausible(bpo) && ball < bpo) return bpo;
  }
  // A chase: bowled + left is the innings' length.
  if (
    state.balls_remaining !== null &&
    state.balls_remaining !== undefined &&
    state.overs_per_innings &&
    (state.innings_number ?? 1) < 3
  ) {
    const bpo = (total + state.balls_remaining) / state.overs_per_innings;
    if (plausible(bpo)) return bpo;
  }
  return 6;
}

/** "Set" for five-ball overs (the 100-ball game's), else "Over". */
export function setWordOf(bpo: number): "Set" | "Over" {
  return bpo === 5 ? "Set" : "Over";
}

/** The innings' length in balls, or null when it has no limit we know. */
export function inningsBallLimit(
  state: Pick<
    LiveMatchState,
    "innings_number" | "overs_per_innings" | "dls_overs"
  >,
  bpo: number,
): number | null {
  if ((state.innings_number ?? 1) >= 3) return bpo;
  const overs =
    state.dls_overs && state.dls_overs > 0
      ? state.dls_overs
      : state.overs_per_innings;
  return overs && overs > 0 ? Math.round(overs * bpo) : null;
}

export interface BallCount {
  bowled: number;
  /** Null when the innings has no known length. */
  limit: number | null;
  left: number | null;
}

/** Balls bowled and left in the innings in play. */
export function ballCountOf(
  state: LiveMatchState,
  bpo: number,
): BallCount {
  const bowled = Math.max(0, state.total_balls ?? 0);
  if (state.balls_remaining !== null && state.balls_remaining !== undefined) {
    const left = Math.max(0, state.balls_remaining);
    return { bowled, limit: bowled + left, left };
  }
  const limit = inningsBallLimit(state, bpo);
  return {
    bowled,
    limit,
    left: limit === null ? null : Math.max(0, limit - bowled),
  };
}

/** "this over" tokens from the live row. */
export function overTokensOf(
  state: Pick<LiveMatchState, "this_over_balls">,
): string[] {
  return (state.this_over_balls ?? "").split(" ").filter(Boolean);
}

/** A wide or no-ball: not one of the over's legal deliveries. */
export const isExtraBall = (token: string) => /wd|nb/.test(token);

export type TokenKind = "dot" | "run" | "four" | "six" | "wicket" | "extra";

export function tokenKind(token: string): TokenKind {
  if (token === "W") return "wicket";
  if (isExtraBall(token)) return "extra";
  if (token === "4") return "four";
  if (token === "6") return "six";
  if (token === "0") return "dot";
  return "run";
}

export interface SetView {
  /** 1-based number of the set / over the tokens belong to. */
  number: number;
  word: "Set" | "Over";
  tokens: string[];
  /** Legal balls still to come in it. */
  open: number;
}

/** The set (or over) in progress and its deliveries so far. */
export function currentSetOf(state: LiveMatchState, bpo: number): SetView {
  const tokens = overTokensOf(state);
  const legal = tokens.filter((t) => !isExtraBall(t)).length;
  const bowled = Math.max(0, state.total_balls ?? 0);
  const start = Math.max(0, bowled - legal);
  return {
    number: Math.floor(start / bpo) + 1,
    word: setWordOf(bpo),
    tokens,
    open: Math.max(0, bpo - legal),
  };
}

export interface Chase {
  runs: number;
  balls: number;
  target: number | null;
}

/** The chase while it is on (runs still needed, balls left). */
export function chaseOf(state: LiveMatchState): Chase | null {
  if (
    state.runs_needed === null ||
    state.runs_needed === undefined ||
    state.balls_remaining === null ||
    state.balls_remaining === undefined ||
    state.innings_completed ||
    state.runs_needed <= 0
  ) {
    return null;
  }
  return {
    runs: state.runs_needed,
    balls: state.balls_remaining,
    target: state.target_runs ?? null,
  };
}

const plural = (n: number, one: string, many: string) =>
  n === 1 ? one : many;

/** "Needs 24 from 15 balls". */
export function chaseStatement(chase: Chase): string {
  return `Needs ${chase.runs} from ${chase.balls} ${plural(chase.balls, "ball", "balls")}`;
}

/** "ball" / "balls" after a count. */
export const ballsWord = (n: number) => plural(n, "ball", "balls");

/** "11.2" overs (as stored) to the ball it fell on: 11 * bpo + 2. */
export function ballOfOvers(overs: number, bpo: number): number {
  const whole = Math.floor(overs + 1e-9);
  const part = Math.round((overs - whole) * 10);
  return whole * bpo + part;
}

/** "Arjun Mehta" → "Mehta" (single names stay as they are). */
export function surnameOf(name: string | null | undefined): string {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  return parts.length ? parts[parts.length - 1]! : "";
}

/** A bowler's figures: "1-18". */
export const figuresOf = (
  wickets: number | null | undefined,
  runs: number | null | undefined,
) => `${wickets ?? 0}-${runs ?? 0}`;

/** Initials for a crest without a logo: "Riverside Rangers" → "RR". */
export function initialsOf(name: string | null | undefined): string {
  return (name ?? "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
}

// ---- the ball log (charts) ------------------------------------------------------

type LogBall = Pick<
  BallEvent,
  "over_number" | "runs_scored" | "extras" | "extra_type" | "is_wicket"
>;

const isLegal = (b: LogBall) =>
  b.extra_type !== "wide" && b.extra_type !== "no_ball";

const runsOf = (b: LogBall) => (b.runs_scored ?? 0) + (b.extras ?? 0);

/**
 * Each delivery with the legal ball it belongs to (a wide or no-ball
 * counts towards the next legal ball), in log order.
 */
export function numberedBalls<B extends LogBall>(
  balls: readonly B[],
): Array<{ ball: number; b: B }> {
  let legal = 0;
  return balls.map((b) => {
    const ball = legal + 1;
    if (isLegal(b)) legal += 1;
    return { ball, b };
  });
}

export interface WormPoint {
  /** Legal balls bowled when it happened. */
  ball: number;
  runs: number;
}

/** Runs by ball: the innings' climb, and where each wicket fell. */
export function wormOf(balls: readonly LogBall[]): {
  points: WormPoint[];
  wickets: WormPoint[];
} {
  const points: WormPoint[] = [{ ball: 0, runs: 0 }];
  const wickets: WormPoint[] = [];
  let legal = 0;
  let runs = 0;
  for (const b of balls) {
    if (isLegal(b)) legal += 1;
    runs += runsOf(b);
    points.push({ ball: legal, runs });
    if (b.is_wicket) wickets.push({ ball: legal, runs });
  }
  return { points, wickets };
}

export interface SetTotal {
  /** 1-based set (over) number. */
  number: number;
  runs: number;
  wickets: number;
}

/** Runs and wickets in each set (over) of the log. */
export function setTotalsOf(balls: readonly LogBall[]): SetTotal[] {
  const sets = new Map<number, SetTotal>();
  for (const b of balls) {
    const n = (b.over_number ?? 0) + 1;
    const s = sets.get(n) ?? { number: n, runs: 0, wickets: 0 };
    s.runs += runsOf(b);
    if (b.is_wicket) s.wickets += 1;
    sets.set(n, s);
  }
  return [...sets.values()].sort((a, b) => a.number - b.number);
}

export interface PhaseTotal {
  /** Legal balls bowled in the phase so far. */
  balls: number;
  runs: number;
  wickets: number;
}

/** Runs and wickets between two legal ball numbers (inclusive). */
export function phaseTotalOf(
  balls: readonly LogBall[],
  from: number,
  to: number,
): PhaseTotal | null {
  const inside = numberedBalls(balls).filter((x) => x.ball >= from && x.ball <= to);
  if (!inside.length) return null;
  return {
    balls: inside.filter((x) => isLegal(x.b)).length,
    runs: inside.reduce((n, x) => n + runsOf(x.b), 0),
    wickets: inside.filter((x) => x.b.is_wicket).length,
  };
}

/** Runs per 100 balls (a scoring rate that needs no overs). */
export function per100(runs: number, balls: number): string | null {
  return balls > 0 ? ((runs * 100) / balls).toFixed(0) : null;
}
