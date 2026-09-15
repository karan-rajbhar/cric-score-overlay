import type { Match } from "~/lib/match-types";

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
