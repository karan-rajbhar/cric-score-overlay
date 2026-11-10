/**
 * Tournament standings, Net Run Rate (NRR), and Qualification calculation engine.
 * Pure mathematical functions implementing standard ICC regulations and tournament rules.
 */

import {
  inningsLimits,
  isSuperOverInnings,
} from "~/lib/firebase/scoring/result";
import type { DlsRevision, MatchesRow } from "~/lib/firebase/types";

/** What net run rate reads of a finished match. */
export interface NrrMatch {
  overs_per_innings?: number | null;
  balls_per_over?: number | null;
  wickets_per_innings?: number | null;
  dls_revision?: DlsRevision | null;
}

/** What net run rate reads of an innings (a match's `innings_summary`). */
export interface NrrInnings {
  team_id?: string | null;
  innings_number?: number | null;
  total_runs?: number | null;
  total_wickets?: number | null;
  total_balls?: number | null;
  target_runs?: number | null;
}

/** A side's runs and the overs they count against, from one innings. */
export interface NrrFigure {
  teamId: string;
  runs: number;
  overs: number;
}

/**
 * The chase's target when it was revised, as the engine sees it
 * (`advanceAfterInnings`): a target other than the first innings plus 1,
 * or a DLS revision of the chase. Null otherwise.
 */
function revisedTargetOf(
  match: NrrMatch,
  innings: readonly NrrInnings[],
): number | null {
  const first = innings.find((i) => i.innings_number === 1);
  const target = innings.find((i) => i.innings_number === 2)?.target_runs;
  if (!first || target == null) return null;
  const dlsChase = match.dls_revision?.innings_number === 2;
  return dlsChase || target !== (first.total_runs ?? 0) + 1 ? target : null;
}

/**
 * Each innings' runs and overs for net run rate (ICC playing conditions;
 * super overs left out): an innings counts the overs it faced, or its whole
 * quota when the side was all out (the revised overs for a chase cut
 * short); when the chase's target was revised (DLS, or set by hand), the
 * side batting first is credited with the target minus 1 off the overs the
 * chase was allotted.
 */
export function nrrFigures(
  match: NrrMatch,
  innings: readonly NrrInnings[],
): NrrFigure[] {
  const limits = (n: number) => inningsLimits(match as MatchesRow, n);
  const revisedTarget = revisedTargetOf(match, innings);
  return innings.flatMap((inn): NrrFigure[] => {
    const n = inn.innings_number ?? 1;
    // A super over decides the points only.
    if (!inn.team_id || isSuperOverInnings(n)) return [];
    const { maxBalls, wicketsCap, ballsPerOver } = limits(n);
    if (revisedTarget !== null && n === 1) {
      const overs = limits(2).maxBalls / ballsPerOver;
      return [{ teamId: inn.team_id, runs: revisedTarget - 1, overs }];
    }
    const allOut = (inn.total_wickets ?? 0) >= wicketsCap;
    const balls = allOut ? maxBalls : (inn.total_balls ?? 0);
    const runs = inn.total_runs ?? 0;
    return [{ teamId: inn.team_id, runs, overs: balls / ballsPerOver }];
  });
}

/** Each team's matches still to play (scheduled or live) among `matches`. */
export function remainingMatchesByTeam(
  matches: readonly {
    team1_id?: string | null;
    team2_id?: string | null;
    status: string | null;
  }[],
): Map<string, number> {
  const remaining = new Map<string, number>();
  for (const m of matches) {
    if (m.status !== "scheduled" && m.status !== "live") continue;
    for (const team of [m.team1_id, m.team2_id]) {
      if (team) remaining.set(team, (remaining.get(team) ?? 0) + 1);
    }
  }
  return remaining;
}

export interface InningsPerformance {
  runs: number;
  wickets: number;
  balls: number;
  oversQuota: number;
  wicketsCap?: number;
}

export interface TeamTournamentRecord {
  teamId: string;
  teamName: string;
  matchesPlayed: number;
  wins: number;
  losses: number;
  ties: number;
  noResults: number;
  runsScored: number;
  runsConceded: number;
  oversFaced: number;
  oversBowled: number;
  points: number;
  netRunRate: number;
  pointsAdjustment?: number;
  adjustmentReason?: string | null;
  qualificationStatus?: "qualified" | "eliminated" | "in_contention";
}

/**
 * Calculates effective overs faced according to cricket rules:
 * If a team is all out (>= wicketsCap, default 10), they are deemed to have faced
 * the full overs quota allocated for the match (e.g. 20.0 for T20, 50.0 for ODI).
 * Otherwise, actual balls faced are converted to decimal overs.
 */
export function calculateEffectiveOvers(
  ballsFaced: number,
  wicketsLost: number,
  oversQuota: number,
  wicketsCap: number = 10,
): number {
  if (wicketsLost >= wicketsCap) {
    return oversQuota;
  }
  const completedOvers = Math.floor(ballsFaced / 6);
  const extraBalls = ballsFaced % 6;
  return completedOvers + extraBalls / 6.0;
}

/**
 * Calculates Net Run Rate (NRR):
 * NRR = (Total Runs Scored / Total Overs Faced) - (Total Runs Conceded / Total Overs Bowled)
 * Rounded to 2 decimal places.
 */
export function calculateNetRunRate(
  runsScored: number,
  effectiveOversFaced: number,
  runsConceded: number,
  effectiveOversBowled: number,
): number {
  if (effectiveOversFaced <= 0 || effectiveOversBowled <= 0) {
    return 0.0;
  }
  const runRateFor = runsScored / effectiveOversFaced;
  const runRateAgainst = runsConceded / effectiveOversBowled;
  return Math.round((runRateFor - runRateAgainst) * 100) / 100;
}

/**
 * Computes points for a tournament:
 * Win = 2 points
 * Tie = 1 point
 * No Result / Abandoned = 1 point
 * Loss = 0 points
 * Plus optional manual points adjustment (penalties, bonuses, decimals)
 */
export function calculatePoints(
  wins: number,
  ties: number = 0,
  noResults: number = 0,
  pointsAdjustment: number = 0,
): number {
  return (
    Math.round((wins * 2 + ties * 1 + noResults * 1 + pointsAdjustment) * 100) /
    100
  );
}

/**
 * Sorts tournament standings according to standard league rules:
 * 1. Points (Descending)
 * 2. Net Run Rate (Descending)
 * 3. Wins (Descending)
 * 4. Team Name (Alphabetical)
 */
export function sortStandings<
  T extends {
    points: number;
    netRunRate: number;
    wins?: number;
    teamName?: string;
  },
>(standings: T[]): T[] {
  return [...standings].sort((a, b) => {
    if (b.points !== a.points) {
      return b.points - a.points;
    }
    if (b.netRunRate !== a.netRunRate) {
      return b.netRunRate - a.netRunRate;
    }
    if ((b.wins ?? 0) !== (a.wins ?? 0)) {
      return (b.wins ?? 0) - (a.wins ?? 0);
    }
    return (a.teamName ?? "").localeCompare(b.teamName ?? "");
  });
}

/**
 * Analyzes qualification mathematical scenarios:
 * Computes which teams are guaranteed qualified ("Q") or eliminated ("E").
 */
export function evaluateQualification(
  teams: Array<{
    teamId: string;
    points: number;
    remainingMatches: number;
  }>,
  qualificationSpots: number = 2,
): Map<string, "qualified" | "eliminated" | "in_contention"> {
  const results = new Map<
    string,
    "qualified" | "eliminated" | "in_contention"
  >();
  if (teams.length <= qualificationSpots) {
    teams.forEach((t) => results.set(t.teamId, "qualified"));
    return results;
  }

  // Sort by current points desc
  const sorted = [...teams].sort((a, b) => b.points - a.points);
  const cutoffTeam = sorted[qualificationSpots - 1];
  const cutoffTeamCurrentPoints = cutoffTeam ? cutoffTeam.points : 0;

  sorted.forEach((team) => {
    const maxPoints = team.points + team.remainingMatches * 2;

    // Eliminated: Even with all wins, cannot match cutoff team's current points
    if (maxPoints < cutoffTeamCurrentPoints) {
      results.set(team.teamId, "eliminated");
      return;
    }

    // Check if team is guaranteed qualified:
    // Count how many other teams can mathematically reach or exceed this team's current points
    let teamsCanSurpass = 0;
    sorted.forEach((other) => {
      if (other.teamId !== team.teamId) {
        const otherMax = other.points + other.remainingMatches * 2;
        if (otherMax >= team.points) {
          teamsCanSurpass++;
        }
      }
    });

    if (teamsCanSurpass < qualificationSpots && team.points > 0) {
      results.set(team.teamId, "qualified");
    } else {
      results.set(team.teamId, "in_contention");
    }
  });

  return results;
}
