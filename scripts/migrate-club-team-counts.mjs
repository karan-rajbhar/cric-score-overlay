#!/usr/bin/env node
/**
 * Idempotent migration: every club gets `team_count` (its number of
 * teams), which the clubs list reads instead of counting each club's
 * teams. The teams write hook keeps it from then on
 * (src/lib/firebase/club-team-count.ts). See scripts/lib/pagination-backfills.mjs.
 *
 *   node scripts/migrate-club-team-counts.mjs                 # local emulator (default)
 *   node scripts/migrate-club-team-counts.mjs --dry-run       # print counts and cost only
 *   node scripts/migrate-club-team-counts.mjs --project=<id>  # real project, using the
 *                                                             # service account in .env.local
 *
 * Only `clubs.team_count` is written, and only where it is missing or
 * wrong; each write is conditional on the club being unchanged since it was
 * read. Re-running is safe: a second run plans 0 writes. Until it has run,
 * the clubs list counts the teams of a club that has no count.
 */

import { applyPatches, connect, readFields } from "./lib/firestore-script.mjs";
import { planClubTeamCounts } from "./lib/pagination-backfills.mjs";

async function main() {
  const { db, dryRun } = await connect("Club team count migration");
  const [clubs, teams] = await Promise.all([
    readFields(db.collection("clubs"), ["team_count"]),
    readFields(db.collection("teams"), ["club_id"]),
  ]);
  const { updates } = planClubTeamCounts({ clubs, teams });
  console.log(`
Read  clubs ${clubs.length}, teams ${teams.length}
Plan  ${updates.length} clubs get their team count
Cost  ${Math.max(1, clubs.length) + Math.max(1, teams.length)} reads, ${updates.length} writes`);
  if (dryRun) return;
  if (!updates.length) {
    console.log("\nNothing to do.");
    return;
  }
  console.log("\nApplying…");
  const { written, skipped } = await applyPatches(
    db,
    "clubs",
    updates.map(({ id, team_count }) => ({ id, patch: { team_count } })),
    new Map(clubs.map((c) => [c.id, c._updateTime])),
  );
  console.log(
    `Done (${written} updated, ${skipped} changed or gone since read). Re-run with --dry-run to confirm nothing is left.`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
