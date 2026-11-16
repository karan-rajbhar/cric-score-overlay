/**
 * What a correction of who batted or bowled changes, worked out on the
 * phone before it is saved (docs/scoring-corrections.md, "Show the result
 * before saving"): the engine's own `recomputeInnings` runs over the
 * innings' ball log as it is and as it would be, so the figures shown are
 * the ones the server will store.
 */

import {
  oversFromBalls,
  recomputeInnings,
  type BallInput,
  type RecomputeInput,
} from "~/lib/firebase/scoring/recompute";

/** The match settings the figures depend on (absent: the defaults). */
export interface PreviewRules {
  id: string;
  balls_per_over?: number | null;
  max_balls_per_over?: number | null;
  wide_runs_to_batsman?: boolean | null;
  noball_extras_to_batsman?: boolean | null;
  wide_counts_as_ball_faced?: boolean | null;
  noball_counts_as_ball_faced?: boolean | null;
}

function matchOf(rules: PreviewRules): RecomputeInput["match"] {
  return {
    id: rules.id,
    balls_per_over: rules.balls_per_over ?? null,
    max_balls_per_over: rules.max_balls_per_over ?? null,
    wide_runs_to_batsman: rules.wide_runs_to_batsman ?? null,
    noball_extras_to_batsman: rules.noball_extras_to_batsman ?? null,
    wide_counts_as_ball_faced: rules.wide_counts_as_ball_faced ?? null,
    noball_counts_as_ball_faced: rules.noball_counts_as_ball_faced ?? null,
  } as RecomputeInput["match"];
}

/** One player's line before and after (null: no line then). */
export interface FigureChange {
  playerId: string;
  role: "batting" | "bowling";
  before: string | null;
  after: string | null;
}

/** Dismissal types in words, for a batting line ("15 (9), caught"). */
function howOut(type: string | null | undefined): string {
  return type ? type.replace(/_/g, " ") : "out";
}

interface Lines {
  batting: Map<string, string>;
  bowling: Map<string, string>;
  /** "71/5". */
  total: string;
}

function linesOf(
  rules: PreviewRules,
  innings: { id: string; team_id?: string | null },
  balls: readonly unknown[],
): Lines | null {
  try {
    const out = recomputeInnings({
      match: matchOf(rules),
      innings: {
        id: innings.id,
        match_id: rules.id,
        team_id: innings.team_id ?? undefined,
      },
      balls: balls as BallInput[],
      existingBatting: [],
      existingBowling: [],
      now: "",
    });
    const batting = new Map<string, string>();
    for (const b of out.batting) {
      const figures = `${b.runs_scored ?? 0}${b.is_out ? "" : "*"} (${b.balls_faced ?? 0})`;
      batting.set(
        b.user_id,
        b.is_out ? `${figures}, ${howOut(b.dismissal_type)}` : figures,
      );
    }
    const bowling = new Map<string, string>();
    const bpo = rules.balls_per_over ?? 6;
    for (const w of out.bowling) {
      const overs = oversFromBalls(w.balls_bowled ?? 0, bpo);
      bowling.set(
        w.user_id,
        `${overs}-${w.maidens ?? 0}-${w.runs_conceded ?? 0}-${w.wickets_taken ?? 0}`,
      );
    }
    const total = `${out.inningsPatch.total_runs ?? 0}/${out.inningsPatch.total_wickets ?? 0}`;
    return { batting, bowling, total };
  } catch {
    return null;
  }
}

/**
 * The lines of `playerIds` that differ between `before` and `after` (one
 * innings' ball log each, in `seq` order). Null when the figures cannot be
 * worked out on the phone (the server still checks the correction).
 */
export function previewChanges(
  rules: PreviewRules,
  innings: { id: string; team_id?: string | null },
  before: readonly unknown[],
  after: readonly unknown[],
  /** The players to compare; null: everyone with a line either way. */
  playerIds: readonly string[] | null,
): FigureChange[] | null {
  return previewOf(rules, innings, before, after, playerIds)?.changes ?? null;
}

/**
 * {@link previewChanges} with the innings total before and after (null
 * when it does not move).
 */
export function previewOf(
  rules: PreviewRules,
  innings: { id: string; team_id?: string | null },
  before: readonly unknown[],
  after: readonly unknown[],
  playerIds: readonly string[] | null,
): { changes: FigureChange[]; total: { before: string; after: string } | null } | null {
  const was = linesOf(rules, innings, before);
  const will = linesOf(rules, innings, after);
  if (!was || !will) return null;
  const ids =
    playerIds ??
    [
      ...new Set([
        ...was.batting.keys(),
        ...was.bowling.keys(),
        ...will.batting.keys(),
        ...will.bowling.keys(),
      ]),
    ];
  const changes: FigureChange[] = [];
  for (const playerId of ids) {
    for (const role of ["batting", "bowling"] as const) {
      const b = was[role].get(playerId) ?? null;
      const a = will[role].get(playerId) ?? null;
      if (b !== a) changes.push({ playerId, role, before: b, after: a });
    }
  }
  const total =
    was.total === will.total ? null : { before: was.total, after: will.total };
  return { changes, total };
}
