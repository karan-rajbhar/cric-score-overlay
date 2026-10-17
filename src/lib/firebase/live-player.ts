/**
 * A player's figures in the innings still in progress of a live match,
 * from its `live_scorecard` doc. Career pages read completed innings from
 * `player_matches`, which the scoring engine writes when an innings
 * closes; this fills the gap while one is being played.
 */

import { oversFromBalls } from "../cricket";
import { decodeLiveScorecard, type LiveScorecardDoc } from "./live-scorecard";

export interface LiveBatting {
  inningsId: string;
  runs: number;
  balls: number;
  fours: number;
  sixes: number;
  isOut: boolean;
  dismissal: string | null;
  /** At the crease now. */
  atCrease: boolean;
}

export interface LiveBowling {
  inningsId: string;
  /** "3.2" */
  overs: string;
  runs: number;
  wickets: number;
  maidens: number;
  /** Bowling the current over. */
  current: boolean;
}

export interface LivePerformance {
  matchId: string;
  batting: LiveBatting[];
  bowling: LiveBowling[];
}

const num = (v: unknown) => (typeof v === "number" ? v : Number(v ?? 0) || 0);

/**
 * The player's rows in the innings of `doc` that are not completed, or
 * null when they have none (not batted / bowled yet in this innings).
 */
export function livePerformanceOf(
  doc: LiveScorecardDoc,
  userId: string,
  ballsPerOver = 6,
): LivePerformance | null {
  if (!(doc.players ?? []).includes(userId)) return null;
  const { innings } = decodeLiveScorecard(doc);
  const batting: LiveBatting[] = [];
  const bowling: LiveBowling[] = [];
  for (const inn of innings) {
    if (inn.is_completed) continue;
    for (const b of inn.batting ?? []) {
      if (b.user_id !== userId) continue;
      batting.push({
        inningsId: inn.id,
        runs: num(b.runs_scored),
        balls: num(b.balls_faced),
        fours: num(b.fours),
        sixes: num(b.sixes),
        isOut: Boolean(b.is_out),
        dismissal: b.dismissal_type ?? null,
        atCrease: Boolean(b.is_current_batsman) && !b.is_out,
      });
    }
    for (const b of inn.bowling ?? []) {
      if (b.user_id !== userId) continue;
      const balls =
        b.balls_bowled != null
          ? num(b.balls_bowled)
          : Math.floor(num(b.overs_bowled)) * ballsPerOver +
            Math.round((num(b.overs_bowled) % 1) * 10);
      bowling.push({
        inningsId: inn.id,
        overs: oversFromBalls(balls, ballsPerOver),
        runs: num(b.runs_conceded),
        wickets: num(b.wickets_taken),
        maidens: num(b.maidens),
        current: Boolean(b.is_current_bowler),
      });
    }
  }
  if (!batting.length && !bowling.length) return null;
  return { matchId: doc.match_id, batting, bowling };
}
