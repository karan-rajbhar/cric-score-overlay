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

/**
 * Cricket overs notation from a ball count: 12 -> "2.0", 8 -> "1.2".
 * Guaranteed integer math — immune to floating point drift or two-dot strings.
 */
export const oversFromBalls = (balls: number | null | undefined): string => {
  if (balls == null || isNaN(balls)) return "0.0";
  const safeBalls = Math.max(0, Math.round(balls));
  return `${Math.floor(safeBalls / 6)}.${safeBalls % 6}`;
};

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

/** Format bowler overs notation from either balls_bowled or overs_bowled. */
export const formatBowlerOvers = (
  b: Pick<BowlingPerformance, "balls_bowled" | "overs_bowled">,
): string => oversFromBalls(bowlerBalls(b));

/** Compute bowler economy rate from either balls_bowled or overs_bowled. */
export const bowlerEconomy = (
  b: Pick<
    BowlingPerformance,
    "balls_bowled" | "overs_bowled" | "runs_conceded"
  >,
): string => economyRate(b.runs_conceded, bowlerBalls(b));

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

/** Standard Cricket Run Rate (runs per 6 legal balls). */
export const runRate = (
  runs: number | null | undefined,
  balls: number | null | undefined,
): string =>
  balls && balls > 0 ? (((runs ?? 0) * 6) / balls).toFixed(2) : "0.00";

/** Total balls bowled in an innings, resolving total_balls or decimal total_overs. */
export const inningsBalls = (
  inn: Pick<Innings, "total_balls" | "total_overs"> | null | undefined,
): number => {
  if (!inn) return 0;
  if (inn.total_balls != null && inn.total_balls > 0) return inn.total_balls;
  if (inn.total_overs != null && inn.total_overs > 0)
    return ballsFromOvers(inn.total_overs);
  return 0;
};

/** Legal balls remaining in a limited-overs innings (always an integer). */
export const ballsRemaining = (
  oversPerInnings: number,
  ballsBowled: number,
): number => Math.max(0, Math.round(oversPerInnings * 6) - ballsBowled);

/** Required run rate (runs needed per 6 remaining balls). */
export const requiredRunRate = (
  runsNeeded: number,
  ballsRem: number,
): string => (ballsRem > 0 ? ((runsNeeded * 6) / ballsRem).toFixed(2) : "—");

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
/** Detailed dismissal string when bowler/fielder names are directly provided. */
export function formatHowOut(
  isOut: boolean | null | undefined,
  dismissalType?: string | null,
  bowlerName?: string | null,
  fielderName?: string | null,
): string {
  if (!isOut) return "not out";
  const type = dismissalType ?? "bowled";

  switch (type) {
    case "bowled":
      return bowlerName ? `b ${bowlerName}` : "b";
    case "hit_wicket":
      return bowlerName ? `hw b ${bowlerName}` : "hit wicket";
    case "lbw":
      return bowlerName ? `lbw b ${bowlerName}` : "lbw";
    case "caught":
      if (fielderName && bowlerName) {
        if (fielderName === bowlerName) {
          return `c & b ${bowlerName}`;
        }
        return `c ${fielderName} b ${bowlerName}`;
      }
      if (fielderName) return `c ${fielderName}`;
      if (bowlerName) return `c & b ${bowlerName}`;
      return "caught";
    case "stumped":
      if (fielderName && bowlerName) return `st ${fielderName} b ${bowlerName}`;
      if (fielderName) return `st ${fielderName}`;
      if (bowlerName) return `st b ${bowlerName}`;
      return "stumped";
    case "run_out":
      return `run out${fielderName ? ` (${fielderName})` : ""}`;
    default:
      return (DISMISSAL_SHORT[type] ?? type).replace(/_/g, " ");
  }
}

/** Full dismissal text, e.g. "c Sharma b Patel", "b Jones", "run out (Kumar)". */
export function dismissalText(
  batter: Pick<BattingPerformance, "user_id" | "is_out" | "dismissal_type">,
  fow: FallOfWicket[],
): string {
  if (!batter.is_out) return "not out";
  const entry = fow.find((f) => f.batsman_out_id === batter.user_id);
  const type = batter.dismissal_type ?? entry?.dismissal_type ?? "bowled";
  const bowlerName = entry?.bowler?.full_name;
  const fielderName = entry?.fielder?.full_name;
  if (fielderName && bowlerName && entry?.fielder_id === entry?.bowler_id) {
    return `c & b ${bowlerName}`;
  }
  return formatHowOut(batter.is_out, type, bowlerName, fielderName);
}

/** Human-friendly label for dismissal types, e.g. "run_out" -> "Run Out", "bowled" -> "Bowled", "lbw" -> "LBW". */
export function formatDismissalType(type?: string | null): string {
  if (!type) return "Out";
  const map: Record<string, string> = {
    bowled: "Bowled",
    caught: "Caught",
    lbw: "LBW",
    run_out: "Run Out",
    stumped: "Stumped",
    hit_wicket: "Hit Wicket",
    obstructing: "Obstructing the Field",
    timed_out: "Timed Out",
    handled_ball: "Handled Ball",
    retired_hurt: "Retired Hurt",
    retired_out: "Retired Out",
  };
  return (
    map[type] ??
    type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
  );
}

/** Human-friendly label for extra types, e.g. "no_ball" -> "No Ball", "leg_bye" -> "Leg Bye". */
export function formatExtraType(type?: string | null): string {
  if (!type) return "";
  const map: Record<string, string> = {
    wide: "Wide",
    no_ball: "No Ball",
    bye: "Bye",
    leg_bye: "Leg Bye",
    penalty: "Penalty",
  };
  return (
    map[type] ??
    type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
  );
}

/** Human-friendly label for match, tournament, and membership statuses. */
export function formatStatus(status?: string | null): string {
  if (!status) return "";
  const map: Record<string, string> = {
    scheduled: "Scheduled",
    live: "Live",
    completed: "Completed",
    abandoned: "Abandoned",
    cancelled: "Cancelled",
    registration_open: "Registration Open",
    in_contention: "In Contention",
    innings_break: "Innings Break",
    ongoing: "Ongoing",
    upcoming: "Upcoming",
    pending: "Pending",
    confirmed: "Confirmed",
    rejected: "Rejected",
    withdrawn: "Withdrawn",
    active: "Active",
    inactive: "Inactive",
    banned: "Banned",
  };
  return (
    map[status] ??
    status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
  );
}

/** Human-friendly label for tournament formats. */
export function formatTournamentFormat(format?: string | null): string {
  if (!format) return "League";
  const map: Record<string, string> = {
    round_robin: "Round Robin",
    league: "League",
    knockout: "Knockout",
    mixed: "Mixed",
  };
  return (
    map[format] ??
    format.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
  );
}

/** Human-friendly label for player team roles. */
export function formatPlayerRole(role?: string | null): string {
  if (!role) return "Player";
  const map: Record<string, string> = {
    captain: "Captain",
    vice_captain: "Vice Captain",
    wicket_keeper: "Wicket-keeper",
    all_rounder: "All-rounder",
    batsman: "Batter",
    bowler: "Bowler",
    player: "Player",
  };
  return (
    map[role] ??
    role.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
  );
}

/** Human-friendly label for club types. */
export function formatClubType(type?: string | null): string {
  if (!type) return "Community";
  const map: Record<string, string> = {
    community: "Community",
    corporate: "Corporate",
    school: "School",
    professional: "Professional",
  };
  return (
    map[type] ??
    type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
  );
}

/** Human-friendly label for team types. */
export function formatTeamType(type?: string | null): string {
  if (!type) return "Club";
  const map: Record<string, string> = {
    club: "Club",
    match: "Match",
    tournament: "Tournament",
  };
  return (
    map[type] ??
    type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
  );
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

/**
 * Format decimal overs (10.2) as "10.2" — canonical, replaces all formatOvers copies.
 * Safely normalizes floats, nulls, undefined, and handles overflow (e.g. 10.6 -> 11.0).
 */
export const formatDecimalOvers = (
  overs: number | null | undefined,
): string => {
  if (overs == null || isNaN(overs)) return "0.0";
  const safe = Math.max(0, overs);
  const full = Math.floor(safe);
  const decimalPart = Math.round((safe - full) * 10);
  if (decimalPart >= 6) {
    const extraOvers = Math.floor(decimalPart / 6);
    const remBalls = decimalPart % 6;
    return `${full + extraOvers}.${remBalls}`;
  }
  return `${full}.${decimalPart}`;
};

/** Format Fall of Wicket overs notation (e.g., 2.5 -> "2.5"). */
export const formatFowOvers = (overs: number | null | undefined): string =>
  formatDecimalOvers(overs);
