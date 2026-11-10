#!/usr/bin/env node
/**
 * Idempotent migration: recomputes the search keys (`name_lower` /
 * `title_lower`, `search_prefixes`) of users, teams, clubs, tournaments and
 * matches now that `normalizeText` keeps letters of every script. Names in
 * Devanagari, Cyrillic, Arabic and so on had an empty sort key and no
 * prefixes, so no search found them; Latin names keep the keys they have.
 * The plan is `planSearchKeys` (scripts/lib/search-trigrams.mjs), the app's
 * own derivation; new and edited documents get the keys from the app.
 *
 *   node scripts/migrate-search-keys-scripts.mjs                 # local emulator (default)
 *   node scripts/migrate-search-keys-scripts.mjs --dry-run       # print counts and cost only
 *   node scripts/migrate-search-keys-scripts.mjs --project=<id>  # real project, using the
 *                                                                # service account in .env.local
 *
 * Only the search fields are written, and only where they differ; each
 * write is conditional on the document being unchanged since it was read.
 * Re-running is safe: a second run plans 0 writes. Cost: one read per
 * searchable document and one write per document that changes.
 */

import { applyPatches, connect, readFields } from "./lib/firestore-script.mjs";
import {
  planSearchKeys,
  SEARCH_KEY_TABLES,
  searchKeyColumns,
} from "./lib/search-trigrams.mjs";

async function main() {
  const { db, dryRun } = await connect("Search keys for every script");
  const read = await Promise.all(
    SEARCH_KEY_TABLES.map((table) =>
      readFields(db.collection(table), searchKeyColumns(table)),
    ),
  );
  const data = Object.fromEntries(
    SEARCH_KEY_TABLES.map((table, i) => [table, read[i] ?? []]),
  );
  const patches = planSearchKeys(data);
  const reads = read.reduce((n, docs) => n + Math.max(1, docs.length), 0);
  console.log(`
Read  ${SEARCH_KEY_TABLES.map((t) => `${t} ${data[t]?.length ?? 0}`).join(", ")}
Plan  ${patches.length} documents get new search keys
Cost  ${reads} reads, ${patches.length} writes`);
  if (dryRun) return;
  if (!patches.length) {
    console.log("\nNothing to do.");
    return;
  }
  console.log("\nApplying…");
  let written = 0;
  let skipped = 0;
  for (const table of SEARCH_KEY_TABLES) {
    const mine = patches.filter((p) => p.table === table);
    if (!mine.length) continue;
    const done = await applyPatches(
      db,
      table,
      mine.map((p) => ({ id: p.id, patch: p.data })),
      new Map((data[table] ?? []).map((d) => [d.id, d._updateTime])),
    );
    written += done.written;
    skipped += done.skipped;
  }
  console.log(
    `Done (${written} updated, ${skipped} changed or gone since read). Re-run with --dry-run to confirm nothing is left.`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
