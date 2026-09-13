/**
 * Tournament standings, Net Run Rate (NRR), and Qualification calculation engine.
 * Pure mathematical functions implementing standard ICC regulations and tournament rules.
 */

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
