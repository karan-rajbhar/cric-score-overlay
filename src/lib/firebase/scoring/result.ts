/**
 * Innings / match completion rules, ported from `_advance_after_innings`
 * and `complete_innings`; two-innings matches (a Test) follow
 * `~/lib/multi-innings`.
 */

import type { InningsRow, MatchesRow } from "../types";
import {
  isTwoInningsMatch,
  lastMainInningsOf,
  leadOf,
  nextAfterInnings,
  oversLimitOf,
  type MultiInningsMatch,
} from "../../multi-innings";

export interface AdvanceInput {
  match: MatchesRow;
  completed: InningsRow;
  /** Every innings of the match (for chase comparisons). */
  allInnings: InningsRow[];
  teamNames: Record<string, string | undefined>;
  now: string;
  /**
   * Players in the chasing side's squad, when known: a side of 8 that wins
   * 3 down has 4 wickets in hand, not 7 (the match's limit of 10).
   */
  chaseSquadSize?: number | null;
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

/**
 * Super overs come after the match proper: innings 3+ in a limited-overs
 * match (3 & 4 form the first super over). A two-innings match has none:
 * its innings 3 and 4 are each side's second innings.
 */
export function isSuperOverInnings(
  match: MultiInningsMatch | null | undefined,
  inningsNumber: number,
): boolean {
  return inningsNumber > lastMainInningsOf(match);
}

/**
 * Whether innings `inningsNumber` decides the match when it ends (the last
 * innings of the match proper, or a super over's second): its end gives
 * the result rather than opening another innings.
 */
export function isDecidingInnings(
  match: MultiInningsMatch | null | undefined,
  inningsNumber: number,
): boolean {
  if (isSuperOverInnings(match, inningsNumber)) return inningsNumber % 2 === 0;
  return inningsNumber === lastMainInningsOf(match);
}

/**
 * The target the chase in `inningsNumber` follows from the innings before
 * it (penalty runs included): the other side's total plus one, or in a
 * two-innings match's fourth innings, the lead to pass plus one.
 */
export function expectedTarget(
  match: MultiInningsMatch,
  allInnings: readonly InningsRow[],
  chase: Pick<InningsRow, "innings_number" | "team_id">,
): number {
  if (isTwoInningsMatch(match) && chase.innings_number === 4) {
    return Math.max(1, -leadOf(allInnings, chase.team_id, 3) + 1);
  }
  const before = allInnings.find(
    (i) => i.innings_number === chase.innings_number - 1,
  );
  return (before?.total_runs ?? 0) + 1;
}

function newInningsRow(
  match: MatchesRow,
  id: string,
  inningsNumber: number,
  teamId: string,
  target: number | null,
  now: string,
): InningsRow {
  return {
    id,
    match_id: match.id,
    team_id: teamId,
    innings_number: inningsNumber,
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
    target_runs: target,
    created_at: now,
    updated_at: now,
  };
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
  const superOver = isSuperOverInnings(match, inningsNumber);

  const completedInningsPatch: Partial<InningsRow> = {
    is_completed: true,
    updated_at: now,
  };
  const open = (teamId: string, target: number | null): AdvanceOutput => ({
    completedInningsPatch,
    matchPatch: {
      current_innings: inningsNumber + 1,
      current_over: 0,
      current_ball: 0,
      updated_at: now,
    },
    nextInnings: newInningsRow(
      match,
      newInningsId,
      inningsNumber + 1,
      teamId,
      target,
      now,
    ),
  });
  const finish = (patch: Partial<MatchesRow>): AdvanceOutput => ({
    completedInningsPatch,
    matchPatch: {
      status: "completed",
      actual_end_time: now,
      updated_at: now,
      ...patch,
    },
    nextInnings: null,
  });

  // A two-innings match before its last innings: the next innings, or a
  // win by an innings after the third.
  if (!superOver && isTwoInningsMatch(match) && inningsNumber < 4) {
    const next = nextAfterInnings(completed, allInnings, (id) =>
      otherTeam(match, id),
    );
    if (next.kind === "next") return open(next.teamId, next.target);
    if (next.kind === "innings_win") {
      const name = teamNames[next.winnerId] ?? "Team";
      return finish({
        result_type: "win",
        winning_team_id: next.winnerId,
        win_margin_type: "innings",
        win_margin: next.margin,
        result_description: `${name} won by an innings and ${next.margin} ${pluralise(next.margin, "run", "runs")}`,
      });
    }
  }

  // First innings of a limited-overs match or of a super over: the chase.
  if (inningsNumber === 1 || (superOver && inningsNumber % 2 === 1)) {
    return open(otherTeam(match, completed.team_id), runs + 1);
  }

  // Chase finished: compare with the innings that set the target.
  const firstOfPair = allInnings.find(
    (i) => i.innings_number === inningsNumber - 1,
  );
  const firstTeam = superOver
    ? (firstOfPair?.team_id ?? otherTeam(match, completed.team_id))
    : otherTeam(match, completed.team_id);

  let resultType = "win";
  let winner: string | null = null;
  let marginType: string | null = null;
  let margin: number | null = null;
  let description: string;

  // The chase is against its target, which follows the innings before it
  // (penalty runs included) unless it was revised (DLS, reduced overs):
  // reaching it wins, falling one short ties.
  const expected = expectedTarget(match, allInnings, completed);
  const target =
    completed.target_runs !== null && completed.target_runs !== undefined
      ? completed.target_runs
      : expected;
  const revised = target !== expected;

  if (runs >= target) {
    winner = completed.team_id;
    marginType = "wickets";
    // Wickets in hand: the side can lose at most one fewer than it has
    // players (all of them with last man stands).
    const squad = input.chaseSquadSize ?? null;
    const cap =
      !superOver && squad !== null && squad >= 2
        ? Math.min(wicketsCap, match.last_man_stands ? squad : squad - 1)
        : wicketsCap;
    margin = Math.max(cap - wickets, 0);
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

  if (superOver && resultType === "win") {
    description = `${description} (Super Over)`;
  } else if (revised && resultType === "win") {
    description = `${description} (revised target)`;
  }

  return finish({
    result_type: resultType,
    winning_team_id: winner,
    win_margin_type: marginType,
    win_margin: margin,
    result_description: description,
  });
}

/** The match fields {@link inningsLimits} reads. */
export type LimitsMatch = Pick<
  MatchesRow,
  "balls_per_over" | "overs_per_innings" | "wickets_per_innings" | "dls_revision"
> &
  Partial<Pick<MatchesRow, "innings_per_side" | "match_format">>;

/**
 * Over / wicket limits for an innings (super overs are 1 over, 2 wickets).
 * `maxBalls` is Infinity when the innings has no overs limit (a Test).
 */
export function inningsLimits(match: LimitsMatch, inningsNumber: number) {
  const bpo =
    match.balls_per_over && match.balls_per_over > 0 ? match.balls_per_over : 6;
  if (isSuperOverInnings(match, inningsNumber)) {
    return { maxBalls: bpo, wicketsCap: 2, ballsPerOver: bpo };
  }
  // A chase cut short by DLS has the revised overs.
  const dls = match.dls_revision;
  const overs =
    dls && dls.innings_number === inningsNumber && dls.overs > 0
      ? dls.overs
      : oversLimitOf(match);
  return {
    maxBalls: overs ? overs * bpo : Number.POSITIVE_INFINITY,
    wicketsCap: match.wickets_per_innings ?? 10,
    ballsPerOver: bpo,
  };
}
