import type {
  BattingPerformance,
  BowlingPerformance,
  FallOfWicket,
  Innings,
  Match,
} from "./match-types";

/**
 * Shared cricket math and formatting — one implementation for the whole app.
 */

/** Cricket overs notation from a ball count: 12 -> "2.0", 8 -> "1.2". */
export const oversFromBalls = (balls: number): string =>
  `${Math.floor(balls / 6)}.${balls % 6}`;

/** Decimal overs (engine's 1.2-style) back to a ball count. */
export const ballsFromOvers = (overs: number): number =>
  Math.floor(overs) * 6 + Math.round((overs - Math.floor(overs)) * 10);

/** Balls bowled by a bowler row, tolerating either engine column. */
export const bowlerBalls = (
  b: Pick<BowlingPerformance, "balls_bowled" | "overs_bowled">,
): number =>
  (b.balls_bowled ?? 0) > 0
    ? b.balls_bowled
    : ballsFromOvers(b.overs_bowled ?? 0);

export const hasBowled = (
  b: Pick<BowlingPerformance, "balls_bowled" | "overs_bowled">,
): boolean => (b.balls_bowled ?? 0) > 0 || (b.overs_bowled ?? 0) > 0;

export const strikeRate = (
  runs: number | null | undefined,
  balls: number | null | undefined,
): string =>
  balls && balls > 0 ? (((runs ?? 0) / balls) * 100).toFixed(1) : "—";

export const economyRate = (
  runs: number | null | undefined,
  balls: number | null | undefined,
): string =>
  balls && balls > 0 ? ((runs ?? 0) / (balls / 6)).toFixed(2) : "—";

/** "4 1 W wd 6" style label for one delivery. */
export function deliveryLabel(b: {
  runs_scored: number | null | undefined;
  extras: number | null | undefined;
  extra_type: string | null | undefined;
  is_wicket: boolean | null | undefined;
}): string {
  if (b.is_wicket) return "W";
  switch (b.extra_type) {
    case "wide":
      return `wd${(b.extras ?? 0) > 1 ? `+${(b.extras ?? 0) - 1}` : ""}`;
    case "no_ball":
      return `nb${(b.extras ?? 0) > 1 ? `+${(b.extras ?? 0) - 1}` : ""}`;
    case "bye":
      return `b${b.extras ?? 0}`;
    case "leg_bye":
      return `lb${b.extras ?? 0}`;
    case "penalty":
      return `p${b.extras ?? 0}`;
    default:
      return String(b.runs_scored ?? 0);
  }
}

const DISMISSAL_SHORT: Record<string, string> = {
  bowled: "b",
  caught: "c",
  lbw: "lbw b",
  stumped: "st",
  run_out: "run out",
  hit_wicket: "hw b",
  obstructing: "obstr",
  timed_out: "timed out",
  handled_ball: "handled ball",
  retired_hurt: "retired hurt",
  retired_out: "retired out",
};

/** Full dismissal text, e.g. "c Sharma b Patel", "b Jones", "run out (Kumar)". */
export function dismissalText(
  batter: Pick<BattingPerformance, "user_id" | "is_out" | "dismissal_type">,
  fow: FallOfWicket[],
): string {
  if (!batter.is_out) return "not out";
  const type = batter.dismissal_type ?? "bowled";
  const entry = fow.find((f) => f.batsman_out_id === batter.user_id);
  const bowlerName = entry?.bowler?.full_name;
  const fielderName = entry?.fielder?.full_name;

  switch (type) {
    case "bowled":
    case "lbw":
    case "hit_wicket":
      return `${DISMISSAL_SHORT[type] ?? type}${bowlerName ? ` ${bowlerName}` : ""}`;
    case "caught":
      return `c ${fielderName ?? "fielder"}${bowlerName ? ` b ${bowlerName}` : ""}`;
    case "stumped":
      return `st ${fielderName ?? "keeper"}${bowlerName ? ` b ${bowlerName}` : ""}`;
    case "run_out":
      return `run out${fielderName ? ` (${fielderName})` : ""}`;
    default:
      return DISMISSAL_SHORT[type] ?? type;
  }
}

/** Innings in which a team batted. */
export const inningsForTeam = (
  match: Match,
  teamId: string,
): Innings | undefined => match.innings?.find((i) => i.team_id === teamId);

/** Innings in which a team bowled (i.e. the opponent's innings). */
export const bowlingInningsForTeam = (
  match: Match,
  teamId: string,
): Innings | undefined => match.innings?.find((i) => i.team_id !== teamId);

/** Top batters of a team, best first. */
export function topBatters(
  innings: Innings | undefined,
  limit = 3,
): BattingPerformance[] {
  return (innings?.batting_performances ?? [])
    .filter(
      (b) => (b.balls_faced ?? 0) > 0 || b.is_out || (b.runs_scored ?? 0) > 0,
    )
    .sort((a, b) => (b.runs_scored ?? 0) - (a.runs_scored ?? 0))
    .slice(0, limit);
}

/** Top bowlers who bowled AGAINST the given team (i.e. the opponent's innings). */
export function topBowlers(
  match: Match,
  teamId: string,
  limit = 3,
): BowlingPerformance[] {
  return (bowlingInningsForTeam(match, teamId)?.bowling_performances ?? [])
    .filter(hasBowled)
    .sort(
      (a, b) =>
        (b.wickets_taken ?? 0) - (a.wickets_taken ?? 0) ||
        (a.runs_conceded ?? 0) - (b.runs_conceded ?? 0),
    )
    .slice(0, limit);
}

/** "36/1 (6.0)" style score line for a team's innings. */
export function scoreLine(innings: Innings | undefined): string {
  if (!innings) return "Yet to bat";
  return `${innings.total_runs}/${innings.total_wickets} (${oversFromBalls(innings.total_balls ?? 0)})`;
}

/** Resolve team name from match — replaces 6× duplicated ternaries. */
export const teamName = (match: Match, teamId: string): string =>
  teamId === match.team1_id ? match.team1.name : match.team2.name;

/** Format decimal overs (10.2) as "10.2" — canonical, replaces 5× formatOvers copies. */
export const formatDecimalOvers = (overs: number): string => {
  const full = Math.floor(overs);
  const balls = Math.round((overs - full) * 10);
  return `${full}.${balls}`;
};
