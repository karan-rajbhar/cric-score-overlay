/**
 * A player's figures for one season (a calendar year, in UTC), from the
 * per-match batting and bowling records the profile already holds. Same
 * formulas as the career figures (`stats.mjs`). Fielding is kept for the
 * whole career only, so a season has none.
 */

interface Dated {
  /** The match date (player_matches.match_date). */
  created_at?: string | null;
  match?: { scheduled_at?: string | null } | null;
}

export interface SeasonBatting extends Dated {
  match_id: string;
  runs_scored: number;
  balls_faced: number;
  fours?: number;
  sixes?: number;
  is_out: boolean;
}

export interface SeasonBowling extends Dated {
  match_id: string;
  balls_bowled: number;
  runs_conceded: number;
  wickets_taken: number;
}

export function seasonOf(row: Dated): number | null {
  const iso = row.created_at ?? row.match?.scheduled_at ?? null;
  if (!iso) return null;
  const year = new Date(iso).getUTCFullYear();
  return Number.isNaN(year) ? null : year;
}

/** Seasons with a record, newest first. */
export function seasonsOf(
  batting: readonly Dated[],
  bowling: readonly Dated[],
): number[] {
  const years = new Set<number>();
  for (const row of [...batting, ...bowling]) {
    const y = seasonOf(row);
    if (y !== null) years.add(y);
  }
  return [...years].sort((a, b) => b - a);
}

export function inSeason<T extends Dated>(
  rows: readonly T[],
  season: number,
): T[] {
  return rows.filter((r) => seasonOf(r) === season);
}

const round2 = (n: number) => Math.round(n * 100) / 100;

export interface SeasonFigures {
  matches: number;
  runs: number;
  wickets: number;
  /** Innings batted (one record each), and those not out. */
  innings: number;
  notOuts: number;
  /** "47*" (not out) or "47"; null without an innings. */
  highest: string | null;
  balls: number;
  fours: number;
  sixes: number;
  average: number | null;
  strikeRate: number | null;
  halfCenturies: number;
  centuries: number;
  /** "3.4" (balls in overs); best figures "3/12" (most wickets, fewest runs). */
  overs: string;
  best: string | null;
  bowlingAverage: number | null;
  economy: number | null;
  threeWickets: number;
  fiveWickets: number;
}

export function seasonFigures(
  batting: readonly SeasonBatting[],
  bowling: readonly SeasonBowling[],
): SeasonFigures {
  const runs = batting.reduce((n, b) => n + b.runs_scored, 0);
  const balls = batting.reduce((n, b) => n + b.balls_faced, 0);
  const outs = batting.filter((b) => b.is_out).length;
  const wickets = bowling.reduce((n, b) => n + b.wickets_taken, 0);
  const conceded = bowling.reduce((n, b) => n + b.runs_conceded, 0);
  const bowled = bowling.reduce((n, b) => n + b.balls_bowled, 0);
  return {
    matches: new Set([
      ...batting.map((b) => b.match_id),
      ...bowling.map((b) => b.match_id),
    ]).size,
    runs,
    wickets,
    average: outs > 0 ? round2(runs / outs) : null,
    strikeRate: balls > 0 ? round2((runs / balls) * 100) : null,
    halfCenturies: batting.filter((b) => b.runs_scored >= 50 && b.runs_scored < 100)
      .length,
    centuries: batting.filter((b) => b.runs_scored >= 100).length,
    innings: batting.length,
    notOuts: batting.filter((b) => !b.is_out).length,
    highest: highestOf(batting),
    balls,
    fours: batting.reduce((n, b) => n + (b.fours ?? 0), 0),
    sixes: batting.reduce((n, b) => n + (b.sixes ?? 0), 0),
    overs: `${Math.floor(bowled / 6)}.${bowled % 6}`,
    best: bestOf(bowling),
    bowlingAverage: wickets > 0 ? round2(conceded / wickets) : null,
    economy: bowled > 0 ? round2(conceded / (bowled / 6)) : null,
    threeWickets: bowling.filter((b) => b.wickets_taken >= 3).length,
    fiveWickets: bowling.filter((b) => b.wickets_taken >= 5).length,
  };
}

/** The highest score, "47*" when not out (a not-out ties above an out). */
function highestOf(batting: readonly SeasonBatting[]): string | null {
  let top: SeasonBatting | null = null;
  for (const b of batting) {
    if (
      !top ||
      b.runs_scored > top.runs_scored ||
      (b.runs_scored === top.runs_scored && !b.is_out && top.is_out)
    ) {
      top = b;
    }
  }
  return top ? `${top.runs_scored}${top.is_out ? "" : "*"}` : null;
}

/** Best bowling figures: most wickets, then fewest runs; "3/12". */
function bestOf(bowling: readonly SeasonBowling[]): string | null {
  let top: SeasonBowling | null = null;
  for (const b of bowling) {
    if (b.balls_bowled === 0) continue;
    if (
      !top ||
      b.wickets_taken > top.wickets_taken ||
      (b.wickets_taken === top.wickets_taken && b.runs_conceded < top.runs_conceded)
    ) {
      top = b;
    }
  }
  return top ? `${top.wickets_taken}/${top.runs_conceded}` : null;
}
