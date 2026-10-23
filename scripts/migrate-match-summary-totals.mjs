#!/usr/bin/env node
/**
 * Idempotent migration: every match gets the totals of its innings summary
 * (`summary_runs`, `summary_wickets`, `best_innings`, `best_innings_runs`;
 * `summaryTotalsOf` in src/lib/firebase/derive.mjs), which a club page
 * with many matches aggregates (sum / top innings) instead of reading every
 * match. The scoring engine writes them with each summary from then on.
 * See scripts/lib/pagination-backfills.mjs.
 *
 *   node scripts/migrate-match-summary-totals.mjs                 # local emulator (default)
 *   node scripts/migrate-match-summary-totals.mjs --dry-run       # print counts and cost only
 *   node scripts/migrate-match-summary-totals.mjs --project=<id>  # real project, using the
 *                                                                 # service account in .env.local
 *
 * Only those four fields are written, where missing or behind; each write
 * is conditional on the match being unchanged since it was read (a match
 * scored meanwhile is skipped: its next summary write brings them). They
 * are not part of `match_rev`, so live viewers do not refetch. Re-running
 * is safe: a second run plans 0 writes.
 */

import { applyPatches, connect, readFields } from "./lib/firestore-script.mjs";
import { planMatchSummaryTotals } from "./lib/pagination-backfills.mjs";
import { SUMMARY_TOTAL_FIELDS } from "../src/lib/firebase/derive.mjs";

async function main() {
  const { db, dryRun } = await connect("Match summary totals migration");
  const matches = await readFields(db.collection("matches"), [
    "innings_summary",
    ...SUMMARY_TOTAL_FIELDS,
  ]);
  const { updates } = planMatchSummaryTotals(matches);
  console.log(`
Read  matches ${matches.length}
Plan  ${updates.length} matches get their summary totals
Cost  ${Math.max(1, matches.length)} reads, ${updates.length} writes`);
  if (dryRun) return;
  if (!updates.length) {
    console.log("\nNothing to do.");
    return;
  }
  console.log("\nApplying…");
  const { written, skipped } = await applyPatches(
    db,
    "matches",
    updates,
    new Map(matches.map((m) => [m.id, m._updateTime])),
  );
  console.log(
    `Done (${written} updated, ${skipped} changed or gone since read). Re-run with --dry-run to confirm nothing is left.`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
