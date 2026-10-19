/**
 * Innings / match completion rules, ported from `_advance_after_innings`
 * and `complete_innings`.
 */

import type { InningsRow, MatchesRow } from "../types";

export interface AdvanceInput {
  match: MatchesRow;
  completed: InningsRow;
  /** Every innings of the match (for chase comparisons). */
  allInnings: InningsRow[];
  teamNames: Record<string, string | undefined>;
  now: string;
}

export interface AdvanceOutput {
  completedInningsPatch: Partial<InningsRow>;
  matchPatch: Partial<MatchesRow>;
  /** Innings to create for the next batting side, if any. */
  nextInnings: InningsRow | null;
}

function pluralise(n: number, singular: string, plural: string): string {
  return n === 1 ? singular : plural;
}

function otherTeam(match: MatchesRow, teamId: string): string {
  return teamId === match.team1_id ? match.team2_id : match.team1_id;
}

/** Super overs are innings 3+ (3 & 4 form the first super over). */
export function isSuperOverInnings(inningsNumber: number): boolean {
  return inningsNumber >= 3;
}

export function advanceAfterInnings(
  input: AdvanceInput,
  newInningsId: string,
): AdvanceOutput {
  const { match, completed, allInnings, teamNames, now } = input;
  const inningsNumber = completed.innings_number;
  const runs = completed.total_runs ?? 0;
  const wickets = completed.total_wickets ?? 0;
  const wicketsCap = match.wickets_per_innings ?? 10;

  const completedInningsPatch: Partial<InningsRow> = {
    is_completed: true,
    updated_at: now,
  };

  // First innings of a match or of a super over: set up the chase.
  if (
    inningsNumber === 1 ||
    (isSuperOverInnings(inningsNumber) && inningsNumber % 2 === 1)
  ) {
    const nextInnings: InningsRow = {
      id: newInningsId,
      match_id: match.id,
      team_id: otherTeam(match, completed.team_id),
      innings_number: inningsNumber + 1,
      total_runs: 0,
      total_wickets: 0,
      total_overs: 0,
      total_balls: 0,
      extras_total: 0,
      extras_byes: 0,
      extras_leg_byes: 0,
      extras_wides: 0,
      extras_no_balls: 0,
      extras_penalties: 0,
      extras_bonuses: 0,
      is_completed: false,
      target_runs: runs + 1,
      created_at: now,
      updated_at: now,
    };
    return {
      completedInningsPatch,
      matchPatch: {
        current_innings: inningsNumber + 1,
        current_over: 0,
        current_ball: 0,
        updated_at: now,
      },
      nextInnings,
    };
  }

  // Chase finished: compare with the innings that set the target.
  const firstOfPair = allInnings.find(
    (i) => i.innings_number === inningsNumber - 1,
  );
  const firstRuns = firstOfPair?.total_runs ?? 0;
  const firstTeam = firstOfPair?.team_id ?? otherTeam(match, completed.team_id);

  let resultType = "win";
  let winner: string | null = null;
  let marginType: string | null = null;
  let margin: number | null = null;
  let description: string;

  // The chase is against its target, which follows the first innings
  // (penalty runs included) unless it was revised (DLS, reduced overs):
  // reaching it wins, falling one short ties.
  const target =
    completed.target_runs !== null && completed.target_runs !== undefined
      ? completed.target_runs
      : firstRuns + 1;
  const revised = target !== firstRuns + 1;

  if (runs >= target) {
    winner = completed.team_id;
    marginType = "wickets";
    margin = Math.max(wicketsCap - wickets, 0);
    description = `${teamNames[winner] ?? "Team"} won by ${margin} ${pluralise(margin, "wicket", "wickets")}`;
  } else if (runs < target - 1) {
    winner = firstTeam;
    marginType = "runs";
    margin = target - 1 - runs;
    description = `${teamNames[winner] ?? "Team"} won by ${margin} ${pluralise(margin, "run", "runs")}`;
  } else {
    resultType = "tie";
    description = "Match tied";
  }

  if (isSuperOverInnings(inningsNumber) && resultType === "win") {
    description = `${description} (Super Over)`;
  } else if (revised && resultType === "win") {
    description = `${description} (revised target)`;
  }

  return {
    completedInningsPatch,
    matchPatch: {
      status: "completed",
      actual_end_time: now,
      result_type: resultType,
      winning_team_id: winner,
      win_margin_type: marginType,
      win_margin: margin,
      result_description: description,
      updated_at: now,
    },
    nextInnings: null,
  };
}

/** Over / wicket limits for an innings (super overs are 1 over, 2 wickets). */
export function inningsLimits(match: MatchesRow, inningsNumber: number) {
  const bpo =
    match.balls_per_over && match.balls_per_over > 0 ? match.balls_per_over : 6;
  if (isSuperOverInnings(inningsNumber)) {
    return { maxBalls: bpo, wicketsCap: 2, ballsPerOver: bpo };
  }
  return {
    maxBalls: (match.overs_per_innings ?? 20) * bpo,
    wicketsCap: match.wickets_per_innings ?? 10,
    ballsPerOver: bpo,
  };
}
