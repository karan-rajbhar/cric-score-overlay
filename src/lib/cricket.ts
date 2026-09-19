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
      // Scorer payload: runs_scored = bat runs, extras = 1 (the no-ball).
      return `nb${(b.runs_scored ?? 0) > 0 ? `+${b.runs_scored}` : ""}`;
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
  const balls =
    innings.total_balls != null && innings.total_balls > 0
      ? innings.total_balls
      : ballsFromOvers(innings.total_overs ?? 0);
  return `${innings.total_runs}/${innings.total_wickets} (${oversFromBalls(balls)})`;
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

export interface PlayerImpactScore {
  playerId: string;
  playerName: string;
  teamId: string;
  teamName: string;
  avatarUrl?: string | null;
  totalPoints: number;
  breakdown: {
    batting: number;
    bowling: number;
    fielding: number;
    winBonus: number;
  };
  stats: {
    runs: number;
    balls: number;
    fours: number;
    sixes: number;
    isOut: boolean;
    wickets: number;
    runsConceded: number;
    overs: number;
    catches: number;
    stumpings: number;
    runOuts: number;
  };
  summary: string;
}

/**
 * Calculates impact scores for all players in a match using standard cricket MVP analytics:
 * - Batting: Runs + boundary bonus + milestones (50/100) + strike rate impact + not out bonus
 * - Bowling: Wickets (25 pts each) + 3w/5w hauls + maidens + economy control
 * - Fielding: Catches (10 pts), Stumpings (15 pts), Run Outs (15 pts)
 * - Winning Impact: 15% bonus + 5 pts for players on the winning team
 */
export function rankPlayersByImpact(match: Match): PlayerImpactScore[] {
  const playerMap = new Map<
    string,
    {
      playerId: string;
      playerName: string;
      teamId: string;
      avatarUrl?: string | null;
      battingPoints: number;
      bowlingPoints: number;
      fieldingPoints: number;
      runs: number;
      balls: number;
      fours: number;
      sixes: number;
      isOut: boolean;
      wickets: number;
      runsConceded: number;
      overs: number;
      maidens: number;
      catches: number;
      stumpings: number;
      runOuts: number;
    }
  >();

  const getOrCreate = (
    id: string,
    name: string,
    teamId: string,
    avatarUrl?: string | null,
  ) => {
    let entry = playerMap.get(id);
    if (!entry) {
      entry = {
        playerId: id,
        playerName: name,
        teamId,
        avatarUrl,
        battingPoints: 0,
        bowlingPoints: 0,
        fieldingPoints: 0,
        runs: 0,
        balls: 0,
        fours: 0,
        sixes: 0,
        isOut: true,
        wickets: 0,
        runsConceded: 0,
        overs: 0,
        maidens: 0,
        catches: 0,
        stumpings: 0,
        runOuts: 0,
      };
      playerMap.set(id, entry);
    }
    return entry;
  };

  for (const inn of match.innings ?? []) {
    const battingTeamId = inn.team_id;
    const bowlingTeamId =
      battingTeamId === match.team1_id ? match.team2_id : match.team1_id;

    // 1. Batting
    for (const bp of inn.batting_performances ?? []) {
      if (!bp.user_id) continue;
      const name = bp.user?.full_name ?? "Player";
      const p = getOrCreate(
        bp.user_id,
        name,
        battingTeamId,
        bp.user?.avatar_url,
      );
      p.runs += bp.runs_scored ?? 0;
      p.balls += bp.balls_faced ?? 0;
      p.fours += bp.fours ?? 0;
      p.sixes += bp.sixes ?? 0;
      p.isOut = bp.is_out;

      let batPts = bp.runs_scored ?? 0;
      batPts += (bp.fours ?? 0) * 1 + (bp.sixes ?? 0) * 2;

      // Milestones
      if (bp.runs_scored >= 100) batPts += 30;
      else if (bp.runs_scored >= 50) batPts += 15;
      else if (bp.runs_scored >= 30) batPts += 5;

      // Strike Rate
      if (bp.balls_faced >= 10) {
        const sr = (bp.runs_scored / bp.balls_faced) * 100;
        if (sr >= 200) batPts += 12;
        else if (sr >= 150) batPts += 6;
        else if (sr < 80) batPts -= 6;
      }

      // Not out bonus if substantial score
      if (!bp.is_out && bp.runs_scored >= 20) {
        batPts += 5;
      }

      p.battingPoints += batPts;
    }

    // 2. Bowling
    for (const bowl of inn.bowling_performances ?? []) {
      if (!bowl.user_id) continue;
      const name = bowl.user?.full_name ?? "Player";
      const p = getOrCreate(
        bowl.user_id,
        name,
        bowlingTeamId,
        bowl.user?.avatar_url,
      );
      p.wickets += bowl.wickets_taken ?? 0;
      p.runsConceded += bowl.runs_conceded ?? 0;
      p.overs += bowl.overs_bowled ?? 0;
      p.maidens += bowl.maidens ?? 0;

      let bowlPts = (bowl.wickets_taken ?? 0) * 25;
      if (bowl.wickets_taken >= 5) bowlPts += 30;
      else if (bowl.wickets_taken >= 3) bowlPts += 15;

      bowlPts += (bowl.maidens ?? 0) * 12;

      if (bowlerBalls(bowl) >= 12) {
        // overs_bowled is cricket notation (3.5 = 3 ov + 5 balls = 23
        // balls), never a true decimal — divide by balls, not by notation.
        const econ = (bowl.runs_conceded ?? 0) / (bowlerBalls(bowl) / 6);
        if (econ < 5.0) bowlPts += 15;
        else if (econ < 6.5) bowlPts += 8;
        else if (econ > 10.0) bowlPts -= 8;
      }

      p.bowlingPoints += bowlPts;
    }

    // 3. Fielding (Fall of Wickets)
    for (const fow of inn.fall_of_wickets ?? []) {
      if (fow.fielder_id) {
        const name = fow.fielder?.full_name ?? "Fielder";
        const p = getOrCreate(
          fow.fielder_id,
          name,
          bowlingTeamId,
          fow.fielder?.avatar_url,
        );
        const dtype = (fow.dismissal_type ?? "").toLowerCase();
        if (dtype.includes("stump")) {
          p.stumpings += 1;
          p.fieldingPoints += 15;
        } else if (dtype.includes("run")) {
          p.runOuts += 1;
          p.fieldingPoints += 15;
        } else {
          p.catches += 1;
          p.fieldingPoints += 10;
        }
      }
    }

    // 4. Fielding (Ball by Ball) if fall_of_wickets is empty
    if (!inn.fall_of_wickets || inn.fall_of_wickets.length === 0) {
      for (const ball of inn.ball_by_ball ?? []) {
        if (ball.is_wicket && ball.fielder_id) {
          const name = ball.fielder?.full_name ?? "Fielder";
          const p = getOrCreate(
            ball.fielder_id,
            name,
            bowlingTeamId,
            ball.fielder?.avatar_url,
          );
          const dtype = (ball.dismissal_type ?? "").toLowerCase();
          if (dtype.includes("stump")) {
            p.stumpings += 1;
            p.fieldingPoints += 15;
          } else if (dtype.includes("run")) {
            p.runOuts += 1;
            p.fieldingPoints += 15;
          } else {
            p.catches += 1;
            p.fieldingPoints += 10;
          }
        }
      }
    }
  }

  const results: PlayerImpactScore[] = [];

  for (const p of playerMap.values()) {
    const hasParticipated =
      p.runs > 0 ||
      p.balls > 0 ||
      p.wickets > 0 ||
      p.overs > 0 ||
      p.catches > 0 ||
      p.stumpings > 0 ||
      p.runOuts > 0;

    if (!hasParticipated) continue;

    const basePoints = p.battingPoints + p.bowlingPoints + p.fieldingPoints;
    let winBonus = 0;
    if (
      match.winning_team_id &&
      match.winning_team_id === p.teamId &&
      basePoints > 0
    ) {
      winBonus = Math.round(basePoints * 0.15) + 5;
    }

    const totalPoints = basePoints + winBonus;
    const tName =
      p.teamId === match.team1_id ? match.team1.name : match.team2.name;

    // Generate concise summary
    const parts: string[] = [];
    if (p.runs > 0 || p.balls > 0) {
      parts.push(`${p.runs}${!p.isOut ? "*" : ""} (${p.balls}b)`);
    }
    if (p.wickets > 0 || p.overs > 0) {
      parts.push(
        `${p.wickets}/${p.runsConceded} (${formatDecimalOvers(p.overs)} ov)`,
      );
    }
    if (p.catches > 0) {
      parts.push(`${p.catches} ct`);
    }
    if (p.stumpings > 0) {
      parts.push(`${p.stumpings} st`);
    }
    if (p.runOuts > 0) {
      parts.push(`${p.runOuts} ro`);
    }

    const summary = parts.length > 0 ? parts.join(" & ") : "Played fixture";

    results.push({
      playerId: p.playerId,
      playerName: p.playerName,
      teamId: p.teamId,
      teamName: tName,
      avatarUrl: p.avatarUrl,
      totalPoints,
      breakdown: {
        batting: p.battingPoints,
        bowling: p.bowlingPoints,
        fielding: p.fieldingPoints,
        winBonus,
      },
      stats: {
        runs: p.runs,
        balls: p.balls,
        fours: p.fours,
        sixes: p.sixes,
        isOut: p.isOut,
        wickets: p.wickets,
        runsConceded: p.runsConceded,
        overs: p.overs,
        catches: p.catches,
        stumpings: p.stumpings,
        runOuts: p.runOuts,
      },
      summary,
    });
  }

  return results.sort((a, b) => b.totalPoints - a.totalPoints);
}

/**
 * Automatically determines the standout Player of the Match based on MVP impact points.
 */
export function calculatePlayerOfTheMatch(
  match: Match,
): PlayerImpactScore | null {
  const ranked = rankPlayersByImpact(match);
  return ranked[0] ?? null;
}

export type SuperstarRole = "WK" | "BAT" | "AR" | "BOWL";

export interface SuperstarPlayer extends PlayerImpactScore {
  rank: number; // 1 to 11
  isCaptain: boolean; // Rank 1
  isViceCaptain: boolean; // Rank 2
  role: SuperstarRole;
}

export interface SuperstarTeam {
  superstars: SuperstarPlayer[];
  captain: SuperstarPlayer | null;
  viceCaptain: SuperstarPlayer | null;
  team1Count: number;
  team2Count: number;
  totalPoints: number;
  byRole: {
    wk: SuperstarPlayer[];
    bat: SuperstarPlayer[];
    ar: SuperstarPlayer[];
    bowl: SuperstarPlayer[];
  };
}

/**
 * Classifies a player's primary match role based on their performance metrics.
 */
export function determinePlayerRole(p: PlayerImpactScore): SuperstarRole {
  // If player performed stumpings or had 2+ catches with no overs bowled, classify as WK
  if (p.stats.stumpings > 0) {
    return "WK";
  }

  // An all-rounder contributes significantly in both batting and bowling
  const hasBatting = p.stats.runs >= 15 || p.breakdown.batting >= 20;
  const hasBowling =
    p.stats.overs >= 1 || p.stats.wickets > 0 || p.breakdown.bowling >= 20;

  if (hasBatting && hasBowling) {
    return "AR";
  }

  // Primary bowler: more bowling points than batting points, and actually bowled
  if (p.breakdown.bowling > p.breakdown.batting && p.stats.overs > 0) {
    return "BOWL";
  }

  // Primary batter
  return "BAT";
}

/**
 * Calculates the Superstars Top 11 best players across both teams combined.
 * Selects the top 11 players by overall performance impact score, designating
 * Rank 1 as Captain (C) and Rank 2 as Vice-Captain (VC), categorizing their roles.
 */
export function calculateSuperstars(match: Match): SuperstarTeam {
  const ranked = rankPlayersByImpact(match);
  const top11 = ranked.slice(0, 11);

  // Classify roles
  const superstars: SuperstarPlayer[] = top11.map((p, index) => {
    const rank = index + 1;
    const role = determinePlayerRole(p);
    return {
      ...p,
      rank,
      isCaptain: rank === 1,
      isViceCaptain: rank === 2,
      role,
    };
  });

  // Ensure at least one WK is recognized if anyone has fielding dismissals behind stumps
  const hasWk = superstars.some((p) => p.role === "WK");
  if (!hasWk && superstars.length > 0) {
    const potentialKeeper = superstars.find(
      (p) =>
        (p.stats.catches > 0 || p.stats.stumpings > 0) && p.stats.overs === 0,
    );
    if (potentialKeeper) {
      potentialKeeper.role = "WK";
    }
  }

  const captain = superstars.find((p) => p.isCaptain) ?? null;
  const viceCaptain = superstars.find((p) => p.isViceCaptain) ?? null;

  const team1Count = superstars.filter(
    (p) => p.teamId === match.team1_id,
  ).length;
  const team2Count = superstars.filter(
    (p) => p.teamId === match.team2_id,
  ).length;
  const totalPoints = superstars.reduce((sum, p) => sum + p.totalPoints, 0);

  const byRole = {
    wk: superstars.filter((p) => p.role === "WK"),
    bat: superstars.filter((p) => p.role === "BAT"),
    ar: superstars.filter((p) => p.role === "AR"),
    bowl: superstars.filter((p) => p.role === "BOWL"),
  };

  return {
    superstars,
    captain,
    viceCaptain,
    team1Count,
    team2Count,
    totalPoints,
    byRole,
  };
}

export interface MatchResultContext {
  result_description?: string | null;
  status?: string | null;
  winning_team_id?: string | null;
  win_margin?: number | null;
  win_margin_type?: string | null;
  team1_id?: string;
  team2_id?: string;
  team1?: { id?: string; name: string; short_name?: string | null } | null;
  team2?: { id?: string; name: string; short_name?: string | null } | null;
  innings?: Array<{
    team_id?: string;
    total_runs?: number | null;
    total_wickets?: number | null;
    is_completed?: boolean | null;
  }> | null;
}

/**
 * Returns a human-friendly match result string ensuring the winning team name is explicitly present.
 * Solves the issue where legacy or engine results only stored "Won by 9 wickets" without the winning team.
 */
export function formatMatchResult(match: MatchResultContext): string {
  const desc = match.result_description?.trim();

  if (!desc) {
    if (match.status === "completed") return "Match completed";
    return "";
  }

  // If desc already includes team name, or is a tie/abandoned, return as is
  if (!/^won by\s+/i.test(desc)) {
    return desc;
  }

  // Desc is "Won by ..." without a team name!
  let winnerName: string | null = null;
  const t1Id = match.team1?.id ?? match.team1_id;
  const t2Id = match.team2?.id ?? match.team2_id;

  if (match.winning_team_id) {
    if (match.winning_team_id === t1Id) {
      winnerName = match.team1?.name ?? null;
    } else if (match.winning_team_id === t2Id) {
      winnerName = match.team2?.name ?? null;
    }
  }

  // If winner wasn't resolved by winning_team_id, deduce from innings
  if (!winnerName && match.innings && match.innings.length >= 2) {
    const inn1 = match.innings.find((i) => i.team_id === t1Id) ?? match.innings[0];
    const inn2 = match.innings.find((i) => i.team_id === t2Id) ?? match.innings[1];
    const r1 = inn1?.total_runs ?? 0;
    const r2 = inn2?.total_runs ?? 0;
    if (r2 > r1) {
      winnerName = inn2?.team_id === t1Id ? match.team1?.name ?? null : match.team2?.name ?? null;
    } else if (r1 > r2) {
      winnerName = inn1?.team_id === t1Id ? match.team1?.name ?? null : match.team2?.name ?? null;
    }
  }

  if (winnerName) {
    const suffix = desc.charAt(0).toLowerCase() + desc.slice(1);
    return `${winnerName} ${suffix}`;
  }

  return desc;
}


