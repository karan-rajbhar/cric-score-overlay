/**
 * Live innings in match lists.
 *
 * Match lists embed `innings(...)` from `matches.innings_summary`, whose
 * entry for a live match's innings in progress is not rewritten on every
 * ball (see `innings-summary.ts`): it may show the score of the last
 * structural change. Two ways to show the current score:
 *
 * - live cards (`MatchCard`, `useLiveListMatch`) follow `live_state`;
 * - static pages take them from documents they read anyway: the
 *   tournament / club leaderboards read the innings of live matches
 *   (`loadScopeLeaderboard` applies {@link applyFreshInnings}), the player
 *   page their `live_scorecard` ({@link liveScorecardInnings});
 * - otherwise {@link withLiveInnings} re-reads them (team page): 1 read per
 *   live match listed.
 */

import { INNINGS_SUMMARY_FIELDS } from "./derive.mjs";
import { staleSummaryInnings } from "./innings-summary";
import { decodeLiveScorecard, type LiveScorecardDoc } from "./live-scorecard";
import type { QueryBuilder } from "./query-builder";

interface InningsClient {
  from(table: "innings"): QueryBuilder<"innings">;
}

type ListInnings = Record<string, unknown>;

const idOf = (e: ListInnings): string | null =>
  typeof e.id === "string" ? e.id : null;

interface ListMatch {
  status?: unknown;
  innings?: ListInnings[] | null;
}

/** Ids of the listed innings that may be behind (live, not completed). */
function staleIn(match: ListMatch): string[] {
  return staleSummaryInnings({
    status: match.status,
    innings_summary: match.innings,
  });
}

/** `entry` with the summary fields it carries taken from `fresh`. */
function refreshed(
  entry: ListInnings,
  fresh: Record<string, unknown>,
): ListInnings {
  const out: ListInnings = { ...entry };
  for (const f of INNINGS_SUMMARY_FIELDS) {
    if (f in entry && f in fresh) out[f] = fresh[f] ?? null;
  }
  return out;
}

/**
 * Bring the listed innings in progress of `rows` up to date from innings
 * documents read elsewhere (`docs`, any innings). In place; returns `rows`.
 */
export function applyFreshInnings<T extends object>(
  rows: readonly T[],
  docs: ReadonlyArray<{ id: string } & object>,
): readonly T[] {
  const fresh = new Map(
    docs.map((d) => [d.id, d as unknown as Record<string, unknown>]),
  );
  for (const item of rows) {
    const row = item as ListMatch;
    if (!row?.innings) continue;
    const stale = new Set(staleIn(row));
    if (!stale.size) continue;
    row.innings = row.innings.map((e) => {
      const id = idOf(e);
      const doc = id && stale.has(id) ? fresh.get(id) : undefined;
      return doc ? refreshed(e, doc) : e;
    });
  }
  return rows;
}

/**
 * `rows` with the innings in progress of their live matches re-read (one
 * query, 1 read per such innings). Rows are updated in place and returned.
 */
export async function withLiveInnings<T extends object>(
  db: InningsClient,
  rows: T[],
): Promise<T[]> {
  const ids = Array.from(
    new Set(rows.flatMap((m) => (m ? staleIn(m as ListMatch) : []))),
  );
  if (!ids.length) return rows;
  const { data } = await db
    .from("innings")
    .select(INNINGS_SUMMARY_FIELDS.join(", "))
    .in("id", ids);
  applyFreshInnings(
    rows,
    (data ?? []) as unknown as Array<{ id: string } & object>,
  );
  return rows;
}

/**
 * `match.innings` with its innings in progress taken from the match's
 * `live_scorecard` doc (no read).
 */
export function liveScorecardInnings<T extends ListMatch>(
  match: T,
  doc: LiveScorecardDoc | null | undefined,
): T {
  if (!doc || !match.innings) return match;
  const stale = new Set(staleIn(match));
  if (!stale.size) return match;
  const fresh = new Map(
    decodeLiveScorecard(doc).innings.map((i) => [
      i.id,
      i as unknown as Record<string, unknown>,
    ]),
  );
  return {
    ...match,
    innings: match.innings.map((e) => {
      const id = idOf(e);
      const doc = id && stale.has(id) ? fresh.get(id) : undefined;
      return doc ? refreshed(e, doc) : e;
    }),
  };
}
