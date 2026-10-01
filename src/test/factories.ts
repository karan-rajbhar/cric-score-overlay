import type { Innings, Match } from "~/lib/match-types";

/**
 * Canonical Match fixture factory for tests — fills required canonical
 * fields with sensible defaults; override anything per-test.
 */
export function makeMatch(overrides: Partial<Match> = {}): Match {
  return {
    id: "m1",
    title: "Tigers vs Kings",
    match_format: "T20",
    overs_per_innings: 20,
    status: "live",
    current_innings: 1,
    current_over: 0,
    current_ball: 0,
    team1_id: "t1",
    team2_id: "t2",
    team1: { id: "t1", name: "Royal Tigers", short_name: "RTG" },
    team2: { id: "t2", name: "Coastal Kings", short_name: "CKS" },
    innings: [],
    ...overrides,
  };
}

/**
 * Canonical Innings fixture factory for tests.
 */
export function makeInnings(overrides: Partial<Innings> = {}): Innings {
  return {
    id: "inn-1",
    match_id: "m1",
    innings_number: 1,
    team_id: "t1",
    total_runs: 0,
    total_wickets: 0,
    total_overs: 0,
    total_balls: 0,
    is_completed: false,
    target_runs: null,
    extras_total: 0,
    extras_byes: 0,
    extras_leg_byes: 0,
    extras_wides: 0,
    extras_no_balls: 0,
    extras_penalties: 0,
    ...overrides,
  };
}
