/**
 * Chart data for broadcast packages: runs per over, the worm with its
 * wicket markers, run rates by phase and wagon-wheel shots, from an
 * innings' ball log. Series and geometry only (pure, no React); each
 * package draws its own. `use-chart-data.ts` reads the ball log the way
 * the Standard cards do.
 */

import { buildOverTable, type OverPoint } from "~/lib/match-charts";
import { phaseBoundaries } from "~/lib/match-report";
import type { BallEvent } from "~/lib/match-types";
import { SECTORS } from "~/lib/wagon-wheel-utils";

export type { OverPoint };
export {
  describeDonutSegment,
  polarToCartesian,
  SECTORS,
} from "~/lib/wagon-wheel-utils";

/** Per-over runs and wickets with running totals, from an innings' balls. */
export function overTable(balls: readonly BallEvent[]): OverPoint[] {
  return buildOverTable([...balls]);
}

export interface OverBar {
  /** 1-based. */
  over: number;
  runs: number;
  wickets: number;
}

/** Runs per over (a Manhattan's bars), wickets in each. */
export function runsPerOver(table: readonly OverPoint[]): OverBar[] {
  return table.map((o) => ({ over: o.overNumber, runs: o.runs, wickets: o.wickets }));
}

export interface WormPoint {
  /** Overs completed: 0 at the start. */
  over: number;
  /** Runs at the end of that over. */
  runs: number;
  /** Wickets that fell in that over (a marker each). */
  wickets: number;
  wicketsSoFar: number;
}

/** The worm: running totals from 0, one point per over. */
export function wormSeries(table: readonly OverPoint[]): WormPoint[] {
  return [
    { over: 0, runs: 0, wickets: 0, wicketsSoFar: 0 },
    ...table.map((o) => ({
      over: o.overNumber,
      runs: o.cumulativeRuns,
      wickets: o.wickets,
      wicketsSoFar: o.cumulativeWickets,
    })),
  ];
}

/** The worm's wicket markers: where on the line each over's wickets fell. */
export function wormWickets(points: readonly WormPoint[]): WormPoint[] {
  return points.filter((p) => p.wickets > 0);
}

export interface PhaseRate {
  label: "Powerplay" | "Middle overs" | "Death overs" | "Innings";
  /** First and last over (1-based). */
  from: number;
  to: number;
  /** Overs of it bowled so far. */
  overs: number;
  runs: number;
  wickets: number;
  /** Runs an over; null before its first over. */
  runRate: number | null;
}

/**
 * Run rates by phase (powerplay, middle, death; one phase for short
 * games), over the overs bowled so far.
 */
export function phaseRates(table: readonly OverPoint[], maxOvers: number): PhaseRate[] {
  const bounds = phaseBoundaries(maxOvers);
  const phases: Array<Pick<PhaseRate, "label" | "from" | "to">> = bounds
    ? [
        { label: "Powerplay", from: 1, to: bounds.ppEnd },
        { label: "Middle overs", from: bounds.ppEnd + 1, to: bounds.midEnd },
        { label: "Death overs", from: bounds.midEnd + 1, to: maxOvers },
      ]
    : [{ label: "Innings", from: 1, to: maxOvers }];
  return phases.map((p) => {
    const overs = table.filter((o) => o.overNumber >= p.from && o.overNumber <= p.to);
    const runs = overs.reduce((n, o) => n + o.runs, 0);
    const wickets = overs.reduce((n, o) => n + o.wickets, 0);
    return {
      ...p,
      overs: overs.length,
      runs,
      wickets,
      runRate: overs.length ? runs / overs.length : null,
    };
  });
}

/** The overs axis: the innings' limit, or more if more were bowled. */
export function chartOvers(
  oversPerInnings: number | null | undefined,
  tables: ReadonlyArray<readonly OverPoint[]>,
): number {
  return Math.max(oversPerInnings ?? 20, ...tables.map((t) => t.length), 1);
}

/** A round axis top: `value` up to the next multiple of `step`. */
export function axisMax(value: number, step: number): number {
  return Math.max(step, Math.ceil(value / step) * step);
}

export interface Shot {
  key: string;
  runs: number;
  sectorId: string;
  sectorLabel: string;
  /** Degrees, 0 straight down the ground, clockwise (`SECTORS`' scale). */
  angle: number;
  /** How far it went, 0 to 1 of the boundary (by runs: a six reaches it). */
  reach: number;
  wicket: boolean;
}

const REACH: Record<number, number> = { 1: 0.46, 2: 0.62, 3: 0.76, 4: 0.94, 5: 0.94, 6: 1 };

/**
 * A batter's scoring shots with a recorded direction, spread a little
 * within their sector so shots to the same zone do not overlap. Runs off
 * the bat only (dots, wides, byes and shots without a zone are left out).
 */
export function wagonWheelShots(balls: readonly BallEvent[], batterId: string | null): Shot[] {
  if (!batterId) return [];
  return balls
    .filter((b) => b.batsman_id === batterId)
    .flatMap((b, i) => {
      const sector = SECTORS.find((s) => s.id === b.shot_zone);
      const runs = b.runs_scored ?? 0;
      if (!sector || runs <= 0) return [];
      const spread = ((i * 17) % 28) - 14;
      return [
        {
          key: b.id,
          runs,
          sectorId: sector.id,
          sectorLabel: sector.label,
          angle: (sector.midAngle + spread + 360) % 360,
          reach: REACH[runs] ?? 0.46,
          wicket: !!b.is_wicket,
        },
      ];
    });
}

export interface SectorTotal {
  id: string;
  label: string;
  runs: number;
  shots: number;
  angleStart: number;
  angleEnd: number;
  midAngle: number;
}

/** Runs into each sector (every sector, 0 where none), in `SECTORS` order. */
export function sectorTotals(shots: readonly Shot[]): SectorTotal[] {
  return SECTORS.map((s) => {
    const mine = shots.filter((x) => x.sectorId === s.id);
    return {
      id: s.id,
      label: s.label,
      runs: mine.reduce((n, x) => n + x.runs, 0),
      shots: mine.length,
      angleStart: s.angleStart,
      angleEnd: s.angleEnd,
      midAngle: s.midAngle,
    };
  });
}

/** The sector with the most runs (null without a scoring shot). */
export function favouriteSector(totals: readonly SectorTotal[]): SectorTotal | null {
  const best = [...totals].sort((a, b) => b.runs - a.runs)[0];
  return best && best.runs > 0 ? best : null;
}
