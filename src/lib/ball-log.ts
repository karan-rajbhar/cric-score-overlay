/**
 * The match page's ball log (`getMatchBallLog` rows) kept current from the
 * `overs` documents a live change touched, instead of refetching it all.
 *
 * Pure helpers: the hook (`useMatchBallLogQuery`) reads the docs.
 */

import {
  ballRowsOf,
  bySeq,
  overDocId,
  type OversRow,
} from "~/lib/firebase/scorecard";
import type { BallEvent, Match, UserRef } from "~/lib/match-types";

/** Player embeds on each ball row: [alias, id field]. */
export const BALL_PLAYER_FIELDS = [
  ["batsman", "batsman_id"],
  ["bowler", "bowler_id"],
  ["non_striker", "non_striker_id"],
  ["fielder", "fielder_id"],
  ["dismissed_player", "dismissed_player_id"],
] as const;

type InningsRef = { innings_number: number; team_id: string };

export interface BallLogContext {
  /** Player embeds by id (`null`: known to have no profile). */
  players: Map<string, UserRef | null>;
  innings: Map<string, InningsRef>;
}

/** What the cached rows and the fetched match already say about names. */
export function ballLogContext(
  cached: readonly BallEvent[],
  match: Match | null | undefined,
): BallLogContext {
  const players = new Map<string, UserRef | null>();
  const innings = new Map<string, InningsRef>();
  for (const team of [match?.team1, match?.team2]) {
    for (const tp of team?.team_players ?? []) {
      if (!tp.user?.id) continue;
      // What `getMatchBallLog` embeds, not everything the roster carries.
      const { id, full_name, avatar_url } = tp.user;
      players.set(id, { id, full_name, avatar_url });
    }
  }
  for (const inn of match?.innings ?? []) {
    innings.set(inn.id, {
      innings_number: inn.innings_number,
      team_id: inn.team_id,
    });
  }
  for (const b of cached) {
    const row = b as unknown as Record<string, unknown>;
    for (const [alias, field] of BALL_PLAYER_FIELDS) {
      const id = row[field];
      if (typeof id === "string" && !players.has(id)) {
        players.set(id, (row[alias] as UserRef | null) ?? null);
      }
    }
    if (b.innings && !innings.has(b.innings_id)) {
      innings.set(b.innings_id, b.innings);
    }
  }
  return { players, innings };
}

/**
 * One over document as `getMatchBallLog` rows (innings + player embeds),
 * or null when it names a player or innings the context does not know.
 */
export function ballEventsOfOver(
  over: OversRow,
  ctx: BallLogContext,
): BallEvent[] | null {
  const inn = ctx.innings.get(over.innings_id);
  if (!inn) return null;
  const out: BallEvent[] = [];
  for (const ball of ballRowsOf(over)) {
    const row: Record<string, unknown> = {
      ...ball,
      innings: { innings_number: inn.innings_number, team_id: inn.team_id },
    };
    for (const [alias, field] of BALL_PLAYER_FIELDS) {
      const id = row[field];
      if (typeof id !== "string") {
        row[alias] = null;
        continue;
      }
      if (!ctx.players.has(id)) return null;
      row[alias] = ctx.players.get(id) ?? null;
    }
    out.push(row as unknown as BallEvent);
  }
  return out;
}

/** `cached` with the balls of the `changed` over docs replaced by `fresh`. */
export function mergeOvers(
  cached: readonly BallEvent[],
  changed: readonly string[],
  fresh: readonly BallEvent[],
): BallEvent[] {
  const ids = new Set(changed);
  return cached
    .filter((b) => !ids.has(overDocId(b.innings_id, b.over_number)))
    .concat(fresh)
    .sort(bySeq);
}
