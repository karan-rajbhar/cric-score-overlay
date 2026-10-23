/**
 * Win predictor: an estimate, always labelled as one.
 *
 * Built on the DLS resource table the app already uses (`~/lib/dls`):
 * R(u, w) is the share of an innings' run-scoring resources left with u
 * overs to go and w wickets down.
 *
 * Chase: the first innings sets the scoring level. Team 1 made T1 runs
 * with R(N, 0) resources (a full innings of N overs; an innings all out or
 * complete leaves none), so the chasing side is expected to add
 *   E = T1 × R(u, w) / R(N, 0)
 * from what it has left. Its remaining runs X are taken as normal around
 * E with variance 2E: runs off a single limited-overs ball have a variance
 * about twice their mean (a typical T20 ball: 0 with p 0.38, 1 with 0.37,
 * 2 with 0.08, 4 with 0.12, 6 with 0.05 gives mean 1.33 and variance 2.7),
 * and balls add up independently. The batting side wins when X reaches
 * the runs needed: P = Φ((E − need + ½) / √(2E)). That ignores wickets
 * clustering, so the tails are a little narrow; the point is a fair,
 * explainable figure, not a betting line.
 *
 * First innings: no probability (nothing to chase yet). A projected range
 * instead: runs so far plus the same kind of estimate, with the scoring
 * level taken from this innings' own rate per resource used, ±1.28 sd
 * (an 80% range). Shown from the third over on.
 *
 * Super overs and innings beyond the second are excluded.
 */

import { getDlsResourcePercentage } from "./dls";

export interface WinPredictorInput {
  /** 1 or 2 (anything else: no estimate). */
  inningsNumber: number;
  oversPerInnings: number;
  ballsPerOver?: number;
  /** Wickets an innings has (10 unless the match says otherwise). */
  wicketsPerInnings?: number;
  runs: number;
  wickets: number;
  /** Legal balls bowled in this innings. */
  balls: number;
  /** The chase target (innings 2). */
  target?: number | null;
}

export interface ChaseEstimate {
  kind: "chase";
  /** Chance the batting side wins, 0-100 (whole numbers). */
  battingPct: number;
  bowlingPct: number;
  runsNeeded: number;
  ballsLeft: number;
  /** Runs the batting side is expected to add from what it has left. */
  expectedRuns: number;
  label: "Estimate";
}

export interface ProjectionEstimate {
  kind: "projection";
  low: number;
  high: number;
  mid: number;
  label: "Estimate";
}

export type WinEstimate = ChaseEstimate | ProjectionEstimate;

/** Standard normal CDF (Abramowitz and Stegun 26.2.17, error < 7.5e-8). */
export function normalCdf(z: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const d = 0.3989422804014327 * Math.exp((-z * z) / 2);
  const p =
    d *
    t *
    (0.31938153 +
      t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
  return z >= 0 ? 1 - p : p;
}

/** Wickets down on the DLS scale (10 wickets) for a side with `cap`. */
function dlsWickets(wickets: number, cap: number): number {
  if (cap <= 0) return 10;
  return Math.min(10, Math.max(0, (wickets * 10) / cap));
}

/** DLS resources (%) with fractional wickets (interpolated). */
function resources(oversLeft: number, wicketsDown: number): number {
  const lo = Math.floor(wicketsDown);
  const hi = Math.min(10, lo + 1);
  const f = wicketsDown - lo;
  const a = getDlsResourcePercentage(oversLeft, lo);
  const b = getDlsResourcePercentage(oversLeft, hi);
  return a + (b - a) * f;
}

/** Overs left (fractional) from balls bowled. */
function oversLeftOf(input: WinPredictorInput): number {
  const bpo = input.ballsPerOver && input.ballsPerOver > 0 ? input.ballsPerOver : 6;
  const maxBalls = input.oversPerInnings * bpo;
  return Math.max(0, maxBalls - input.balls) / bpo;
}

function chase(input: WinPredictorInput): ChaseEstimate | null {
  const target = input.target;
  if (target === null || target === undefined || target <= 0) return null;
  const bpo = input.ballsPerOver && input.ballsPerOver > 0 ? input.ballsPerOver : 6;
  const cap = input.wicketsPerInnings ?? 10;
  const need = target - input.runs;
  const ballsLeft = Math.max(0, input.oversPerInnings * bpo - input.balls);
  const base = { runsNeeded: Math.max(0, need), ballsLeft, label: "Estimate" as const };
  if (need <= 0) {
    return { kind: "chase", battingPct: 100, bowlingPct: 0, expectedRuns: 0, ...base };
  }
  if (ballsLeft === 0 || input.wickets >= cap) {
    return { kind: "chase", battingPct: 0, bowlingPct: 100, expectedRuns: 0, ...base };
  }
  const full = getDlsResourcePercentage(input.oversPerInnings, 0);
  const left = resources(oversLeftOf(input), dlsWickets(input.wickets, cap));
  const firstInnings = target - 1;
  const expected = full > 0 ? (firstInnings * left) / full : 0;
  const p =
    expected > 0 ? normalCdf((expected - need + 0.5) / Math.sqrt(2 * expected)) : 0;
  // Keep a live chase off 0 / 100: only the result settles it.
  const battingPct = Math.min(99, Math.max(1, Math.round(p * 100)));
  return {
    kind: "chase",
    battingPct,
    bowlingPct: 100 - battingPct,
    expectedRuns: Math.round(expected),
    ...base,
  };
}

/** Balls before a first-innings projection is offered. */
export const PROJECTION_MIN_BALLS = 12;

function projection(input: WinPredictorInput): ProjectionEstimate | null {
  if (input.balls < PROJECTION_MIN_BALLS) return null;
  const cap = input.wicketsPerInnings ?? 10;
  const full = getDlsResourcePercentage(input.oversPerInnings, 0);
  const left = resources(oversLeftOf(input), dlsWickets(input.wickets, cap));
  const used = full - left;
  if (used <= 0 || input.wickets >= cap || left <= 0) {
    const r = Math.round(input.runs);
    return { kind: "projection", low: r, high: r, mid: r, label: "Estimate" };
  }
  const expected = (input.runs / used) * left;
  const sd = Math.sqrt(2 * expected);
  const mid = Math.round(input.runs + expected);
  return {
    kind: "projection",
    low: Math.max(input.runs, Math.round(input.runs + expected - 1.28 * sd)),
    high: Math.round(input.runs + expected + 1.28 * sd),
    mid,
    label: "Estimate",
  };
}

/** The estimate for the innings in play, or null when there is none. */
export function winPredictor(input: WinPredictorInput): WinEstimate | null {
  if (input.oversPerInnings <= 0) return null;
  if (input.inningsNumber === 2) return chase(input);
  if (input.inningsNumber === 1) return projection(input);
  return null;
}

/** The fields of a `live_state` row it needs. */
export interface WinPredictorLiveRow {
  status?: string | null;
  innings_number?: number | null;
  innings_completed?: boolean | null;
  overs_per_innings?: number | null;
  total_runs?: number | null;
  total_wickets?: number | null;
  total_balls?: number | null;
  target_runs?: number | null;
}

/**
 * {@link winPredictor} for a live scoreboard row (the overlay, the match
 * page's live panel): only while an innings is in play.
 */
export function winPredictorFromLive(
  row: WinPredictorLiveRow,
  options: { ballsPerOver?: number; wicketsPerInnings?: number } = {},
): WinEstimate | null {
  if (row.status !== "live" || row.innings_completed) return null;
  if (!row.innings_number || !row.overs_per_innings) return null;
  return winPredictor({
    inningsNumber: row.innings_number,
    oversPerInnings: row.overs_per_innings,
    ballsPerOver: options.ballsPerOver,
    wicketsPerInnings: options.wicketsPerInnings,
    runs: row.total_runs ?? 0,
    wickets: row.total_wickets ?? 0,
    balls: row.total_balls ?? 0,
    target: row.target_runs,
  });
}
