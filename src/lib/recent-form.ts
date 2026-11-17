/** A player's latest innings, newest first, for the profile's form strip. */

/**
 * Which game an entry is: the day it was played, from the player's own
 * record (no read), on every entry alike; the match's title only for a
 * record without a date. Titles where the page had them and dates elsewhere
 * mixed in one strip. Never a bare "Match" (P3). The day is left as a
 * timestamp: the page shows it in the viewer's time zone (`LocalDate`).
 */
const whichGame = (row: {
  match?: { title: string } | null;
  created_at?: string | null;
}) =>
  row.created_at && !Number.isNaN(new Date(row.created_at).getTime())
    ? { playedAt: row.created_at, matchTitle: null }
    : { playedAt: null, matchTitle: row.match?.title ?? null };

export interface FormBatting {
  match_id: string;
  runs_scored: number;
  balls_faced: number;
  is_out: boolean;
  created_at?: string | null;
  match?: { title: string } | null;
}

export interface FormBowling {
  match_id: string;
  balls_bowled: number;
  runs_conceded: number;
  wickets_taken: number;
  created_at?: string | null;
  match?: { title: string } | null;
}

export interface FormEntry {
  matchId: string;
  /** When it was played (ISO); else `matchTitle` names the game. */
  playedAt: string | null;
  matchTitle: string | null;
  /** "47", "12*" (not out), "2/24". */
  figure: string;
  detail: string;
  /** Worth highlighting: 50+ or a 3-wicket haul. */
  notable: boolean;
}

const newestFirst = <T extends { created_at?: string | null }>(rows: T[]) =>
  [...rows].sort((a, b) => (b.created_at ?? "").localeCompare(a.created_at ?? ""));

export function recentBatting(rows: readonly FormBatting[], n = 5): FormEntry[] {
  return newestFirst([...rows])
    .slice(0, n)
    .map((b) => ({
      matchId: b.match_id,
      ...whichGame(b),
      figure: `${b.runs_scored}${b.is_out ? "" : "*"}`,
      detail: `${b.balls_faced} ${b.balls_faced === 1 ? "ball" : "balls"}`,
      notable: b.runs_scored >= 50,
    }));
}

export function recentBowling(rows: readonly FormBowling[], n = 5): FormEntry[] {
  return newestFirst([...rows])
    .filter((b) => b.balls_bowled > 0)
    .slice(0, n)
    .map((b) => ({
      matchId: b.match_id,
      ...whichGame(b),
      figure: `${b.wickets_taken}/${b.runs_conceded}`,
      detail: `${Math.floor(b.balls_bowled / 6)}.${b.balls_bowled % 6} overs`,
      notable: b.wickets_taken >= 3,
    }));
}
