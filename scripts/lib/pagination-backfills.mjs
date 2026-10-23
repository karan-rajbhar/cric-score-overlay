/**
 * Backfill plans for the stored values the paginated pages read instead of
 * whole collections (scripts/migrate-club-team-counts.mjs and
 * scripts/migrate-match-summary-totals.mjs; tested in
 * src/lib/firebase/pagination-backfills.test.ts). Pure: plain documents in,
 * the writes out. Idempotent: planning again after applying yields nothing.
 */

import {
  canonicalJson,
  SUMMARY_TOTAL_FIELDS,
  summaryTotalsOf,
} from "../../src/lib/firebase/derive.mjs";

/** @typedef {{ id: string } & Record<string, any>} Doc */

/**
 * `clubs.team_count` for every club whose stored count is missing or wrong
 * (`src/lib/firebase/club-team-count.ts` keeps it from then on).
 * @param {{ clubs: Doc[], teams: Doc[] }} input
 * @returns {{ updates: Array<{ id: string, team_count: number }> }}
 */
export function planClubTeamCounts({ clubs, teams }) {
  /** @type {Map<string, number>} */
  const counts = new Map();
  for (const t of teams) {
    if (typeof t.club_id === "string" && t.club_id) {
      counts.set(t.club_id, (counts.get(t.club_id) ?? 0) + 1);
    }
  }
  const updates = [];
  for (const c of clubs) {
    const team_count = counts.get(c.id) ?? 0;
    if (c.team_count !== team_count) updates.push({ id: c.id, team_count });
  }
  return { updates };
}

/**
 * The innings-summary totals (`summaryTotalsOf`) of every match whose
 * stored ones are missing or behind its summary (the scoring engine writes
 * them with each summary from then on).
 * @param {Doc[]} matches
 * @returns {{ updates: Array<{ id: string, patch: Record<string, unknown> }> }}
 */
export function planMatchSummaryTotals(matches) {
  const updates = [];
  for (const m of matches) {
    /** @type {Record<string, unknown>} */
    const totals = summaryTotalsOf(m.innings_summary ?? []);
    const same = SUMMARY_TOTAL_FIELDS.every(
      (f) => canonicalJson(m[f] ?? null) === canonicalJson(totals[f]),
    );
    if (!same) updates.push({ id: m.id, patch: totals });
  }
  return { updates };
}
