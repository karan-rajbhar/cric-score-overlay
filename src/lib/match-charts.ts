import type { BallEvent, Innings } from "./match-types";

/** Report-parity palette — teal vs amber distinguishes innings at a glance. */
export const CHART_TEAM1 = "#0f766e";
export const CHART_TEAM2 = "#d97706";
export const CHART_WICKET = "#e11d48";
export const CHART_GRID = "#e2e8f0";
export const CHART_MUTED = "#94a3b8";

export interface OverPoint {
  overNumber: number;
  runs: number;
  wickets: number;
  cumulativeRuns: number;
  cumulativeWickets: number;
}

/** Group balls by over_number → per-over + cumulative totals. */
export function buildOverTable(balls: BallEvent[]): OverPoint[] {
  const byOver = new Map<number, BallEvent[]>();
  for (const b of balls) {
    const ov = b.over_number ?? 0;
    const list = byOver.get(ov) ?? [];
    list.push(b);
    byOver.set(ov, list);
  }
  const sorted = [...byOver.keys()].sort((a, b) => a - b);
  let cumRuns = 0;
  let cumWkts = 0;
  return sorted.map((ov) => {
    const list = byOver.get(ov) ?? [];
    const runs = list.reduce(
      (s, d) => s + (d.runs_scored ?? 0) + (d.extras ?? 0),
      0,
    );
    const wickets = list.filter((d) => d.is_wicket).length;
    cumRuns += runs;
    cumWkts += wickets;
    return {
      // over_number is 0-based in the engine → display 1-based
      overNumber: ov + 1,
      runs,
      wickets,
      cumulativeRuns: cumRuns,
      cumulativeWickets: cumWkts,
    };
  });
}

/** Prefer embedded ball_by_ball, fall back to fetched ball log. */
export function inningsBalls(
  innings: Innings | undefined,
  ballLog: BallEvent[] | null | undefined,
): BallEvent[] {
  if (!innings) return [];
  if (innings.ball_by_ball && innings.ball_by_ball.length > 0) {
    return innings.ball_by_ball;
  }
  if (ballLog && ballLog.length > 0) {
    return ballLog.filter((b) => b.innings_id === innings.id);
  }
  return [];
}

/** Safe boundary-run share; 0 when nothing scored yet. */
export function boundaryPct(
  fours: number,
  sixes: number,
  totalRuns: number,
): number {
  if (!totalRuns || totalRuns <= 0) return 0;
  const pct = ((fours * 4 + sixes * 6) / totalRuns) * 100;
  return Math.min(100, Math.max(0, pct));
}

export interface PhaseSplit {
  label: string;
  overs: string;
  runs: number;
  wickets: number;
  balls: number;
}

/** Powerplay / middle / death split scaled to the match length. */
export function phaseSplits(
  balls: BallEvent[],
  totalOvers: number,
): PhaseSplit[] {
  const safeTotal = Math.max(1, totalOvers || 20);
  // Partition 1..safeTotal with no overlaps or gaps, even for short games:
  // powerplay takes ~first 30% (capped at 6), death the last ~25%, middle
  // gets the rest (possibly empty, labelled "—").
  const ppEnd = Math.min(6, Math.max(1, Math.floor(safeTotal * 0.3)));
  const deathLen = Math.min(5, Math.max(1, Math.floor(safeTotal * 0.25)));
  const deathBegin = Math.max(ppEnd + 1, safeTotal - deathLen + 1);
  const midBegin = ppEnd + 1;
  const midEnd = deathBegin - 1;

  const inRange = (over1Based: number, from: number, to: number) =>
    from <= to && over1Based >= from && over1Based <= to;

  const rangeLabel = (from: number, to: number) =>
    from > to ? "—" : from === to ? `${from}` : `${from}–${to}`;

  const summarize = (label: string, overs: string, from: number, to: number) => {
    const slice = balls.filter((b) =>
      inRange((b.over_number ?? 0) + 1, from, to),
    );
    return {
      label,
      overs,
      runs: slice.reduce(
        (s, d) => s + (d.runs_scored ?? 0) + (d.extras ?? 0),
        0,
      ),
      wickets: slice.filter((d) => d.is_wicket).length,
      balls: slice.length,
    };
  };

  return [
    summarize("Powerplay", rangeLabel(1, ppEnd), 1, ppEnd),
    summarize("Middle", rangeLabel(midBegin, midEnd), midBegin, midEnd),
    summarize("Death", rangeLabel(deathBegin, safeTotal), deathBegin, safeTotal),
  ];
}

export interface ExtrasSplit {
  wides: number;
  noBalls: number;
  byes: number;
  legByes: number;
  penalties: number;
  total: number;
}

export function extrasSplit(innings: Innings | undefined): ExtrasSplit {
  const wides = innings?.extras_wides ?? 0;
  const noBalls = innings?.extras_no_balls ?? 0;
  const byes = innings?.extras_byes ?? 0;
  const legByes = innings?.extras_leg_byes ?? 0;
  const penalties = innings?.extras_penalties ?? 0;
  return {
    wides,
    noBalls,
    byes,
    legByes,
    penalties,
    total: innings?.extras_total ?? wides + noBalls + byes + legByes + penalties,
  };
}

/** Best (highest-run) over from a table; null when empty. */
export function bestOver(
  table: OverPoint[],
): { over: number; runs: number; wickets: number } | null {
  if (table.length === 0) return null;
  let best = table[0]!;
  for (const o of table) {
    if (o.runs > best.runs) best = o;
  }
  return { over: best.overNumber, runs: best.runs, wickets: best.wickets };
}

/** Runs + wickets in the last N overs (momentum). */
export function lastNOvers(
  table: OverPoint[],
  n = 5,
): { runs: number; wickets: number } {
  const slice = table.slice(-n);
  return {
    runs: slice.reduce((s, o) => s + o.runs, 0),
    wickets: slice.reduce((s, o) => s + o.wickets, 0),
  };
}
