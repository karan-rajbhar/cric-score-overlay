/**
 * The Hundred-ball package counts balls, never overs. The figures come
 * from the shared derive helpers (`packages/shared`); this module adds
 * what the look needs on top: the set (or over) in progress as squares,
 * a wicket's ball number, the chase worded "Needs 24 from 15 balls", and
 * balls per over for straps, which get no match.
 */

import type { Match } from "~/lib/match-types";
import type { LiveMatchState } from "../../types";
import {
  ballsBowled,
  ballsPerOverOf,
  ballsRemaining,
  chaseLine,
  inningsBalls,
  overSlotsLeft,
  thisOverBalls,
  type OverBall,
} from "../shared";

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

/**
 * Legal deliveries per over (a "set" of five in a 100-ball game): the
 * match's setting; without a match (straps) read back from the live row's
 * position (`current_over` / `current_ball` derive from it) or the chase,
 * else 6.
 */
export function ballsPerOverFrom(
  state: Position | null | undefined,
  match?: Pick<Match, "balls_per_over"> | null,
): number {
  if (match?.balls_per_over && match.balls_per_over > 0) {
    return ballsPerOverOf(match as Match);
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

export interface BallCount {
  bowled: number;
  /** Null when the innings has no known length. */
  limit: number | null;
  left: number | null;
}

/** Balls bowled and left in the innings in play. */
export function ballCountOf(state: LiveMatchState, bpo: number): BallCount {
  const bowled = ballsBowled(state);
  const left = ballsRemaining(state, bpo);
  const chasing = state.balls_remaining !== null && state.balls_remaining !== undefined;
  return {
    bowled,
    limit: chasing && left !== null ? bowled + left : inningsBalls(state, bpo),
    left,
  };
}

export interface SetView {
  /** 1-based number of the set / over the deliveries belong to. */
  number: number;
  word: "Set" | "Over";
  balls: OverBall[];
  /** Legal balls still to come in it. */
  open: number;
}

/** The set (or over) in progress and its deliveries so far. */
export function currentSetOf(state: LiveMatchState, bpo: number): SetView {
  const balls = thisOverBalls(state);
  const legal = balls.filter((b) => b.legal).length;
  const start = Math.max(0, ballsBowled(state) - legal);
  return {
    number: Math.floor(start / bpo) + 1,
    word: setWordOf(bpo),
    balls,
    open: overSlotsLeft(balls, bpo),
  };
}

export interface Chase {
  runs: number;
  balls: number;
  target: number | null;
}

/** The chase while it is on (the shared chase line, in runs and balls). */
export function chaseOf(state: LiveMatchState, bpo = 6): Chase | null {
  const c = chaseLine(state, bpo);
  return c ? { runs: c.runsNeeded, balls: c.ballsRemaining, target: c.target } : null;
}

/** "ball" / "balls" after a count. */
export const ballsWord = (n: number) => (n === 1 ? "ball" : "balls");

/** "Needs 24 from 15 balls". */
export function chaseStatement(chase: Pick<Chase, "runs" | "balls">): string {
  return `Needs ${chase.runs} from ${chase.balls} ${ballsWord(chase.balls)}`;
}

/** "11.2" overs (as stored) to the ball it fell on: 11 * bpo + 2. */
export function ballOfOvers(overs: number, bpo: number): number {
  const whole = Math.floor(overs + 1e-9);
  const part = Math.round((overs - whole) * 10);
  return whole * bpo + part;
}

/** "Arjun Mehta" → "Mehta" (single names stay as they are): the bug's strip. */
export function surnameOf(name: string | null | undefined): string {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  return parts.length ? parts[parts.length - 1]! : "";
}

/**
 * Legal balls bowled in a phase that runs from ball `from` to ball `to`
 * (phases run on from the first ball, so it is the innings' balls past
 * the phase's start, up to its length).
 */
export function ballsInPhase(totalBalls: number, from: number, to: number): number {
  return Math.min(Math.max(0, totalBalls - (from - 1)), Math.max(0, to - from + 1));
}

/** Runs per 100 balls (a scoring rate that needs no overs). */
export function per100(runs: number, balls: number): string | null {
  return balls > 0 ? ((runs * 100) / balls).toFixed(0) : null;
}
