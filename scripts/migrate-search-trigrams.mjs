#!/usr/bin/env node
/**
 * Idempotent migration: adds mid-word search tokens (trigrams) to
 * `search_prefixes` on users, teams, clubs, tournaments and matches (see
 * scripts/lib/search-trigrams.mjs). New and edited documents get them from
 * the app's derived-fields data source; this backfills the rest.
 *
 *   node scripts/migrate-search-trigrams.mjs                 # local emulator
 *   node scripts/migrate-search-trigrams.mjs --dry-run       # counts and cost only
 *   node scripts/migrate-search-trigrams.mjs --project=<id>  # real project, using
 *                                                            # the service account
 *                                                            # in .env.local
 *
 * Until it has run, mid-word queries simply find fewer documents (prefix
 * search is unchanged). Re-running is safe: documents already up to date are
 * skipped (a second run plans 0 writes). Cost: one read per searchable
 * document and one write per document that changes.
 */

import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { cert, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import {
  planSearchKeys,
  SEARCH_KEY_TABLES,
  searchKeyColumns,
} from "./lib/search-trigrams.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const dryRun = process.argv.includes("--dry-run");
const remoteProject = process.argv
  .find((arg) => arg.startsWith("--project="))
  ?.slice("--project=".length);

const PROJECT_ID =
  remoteProject ||
  process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ||
  "demo-cricscore";
const HOST = process.env.FIREBASE_EMULATOR_HOST_SERVER || "127.0.0.1";
const BATCH_SIZE = 400;

if (!remoteProject) {
  process.env.FIRESTORE_EMULATOR_HOST ||= `${HOST}:8088`;
}

async function assertEmulator() {
  try {
    const res = await fetch(`http://${process.env.FIRESTORE_EMULATOR_HOST}/`);
    if (!res.ok) throw new Error(String(res.status));
  } catch {
    console.error(
      `Firestore emulator not reachable at ${process.env.FIRESTORE_EMULATOR_HOST}.\n` +
        "Start it first with: npm run emulators",
    );
    process.exit(1);
  }
}

function remoteCredential() {
  try {
    process.loadEnvFile(resolve(here, "../.env.local"));
  } catch {
    // Fall back to whatever is already in the environment.
  }
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim();
  if (!raw) {
    console.error("FIREBASE_SERVICE_ACCOUNT_JSON is not set in .env.local.");
    process.exit(1);
  }
  const account = JSON.parse(
    raw.startsWith("{") ? raw : Buffer.from(raw, "base64").toString("utf8"),
  );
  if (account.project_id !== remoteProject) {
    console.error(
      `The service account in .env.local belongs to "${account.project_id}", not "${remoteProject}".`,
    );
    process.exit(1);
  }
  return cert(account);
}

/**
 * Only the fields the derivation needs (reads are billed per document
 * either way; this keeps the transfer small).
 * @param {import("firebase-admin/firestore").Firestore} db
 * @param {string} name
 */
async function readAll(db, name) {
  const snap = await db
    .collection(name)
    .select(...searchKeyColumns(name))
    .get();
  return snap.docs.map((d) => ({ ...d.data(), id: d.id }));
}

async function main() {
  if (remoteProject) {
    initializeApp({ projectId: PROJECT_ID, credential: remoteCredential() });
  } else {
    await assertEmulator();
    initializeApp({ projectId: PROJECT_ID });
  }
  const db = getFirestore();
  const target = remoteProject
    ? `project ${PROJECT_ID}`
    : `emulator ${process.env.FIRESTORE_EMULATOR_HOST} (${PROJECT_ID})`;
  console.log(
    `Search trigrams migration on ${target}${dryRun ? " [dry run]" : ""}`,
  );

  const read = await Promise.all(SEARCH_KEY_TABLES.map((n) => readAll(db, n)));
  const data = Object.fromEntries(
    SEARCH_KEY_TABLES.map((n, i) => [n, read[i] ?? []]),
  );
  // An empty query result is still billed as one read.
  const reads = read.reduce((n, docs) => n + Math.max(1, docs.length), 0);
  const patches = planSearchKeys(data);
  /** @type {Record<string, number>} */
  const counts = {};
  for (const p of patches) counts[p.table] = (counts[p.table] ?? 0) + 1;
  console.log(`
Read  ${SEARCH_KEY_TABLES.map((n) => `${n} ${data[n]?.length ?? 0}`).join(", ")}
Plan  ${
    Object.entries(counts)
      .map(([k, v]) => `${k} ${v}`)
      .join(", ") || "nothing to change"
  }
Cost  ${reads} reads, ${patches.length} writes`);

  if (dryRun) return;
  if (patches.length === 0) {
    console.log("\nNothing to do.");
    return;
  }

  console.log("\nApplying…");
  for (let i = 0; i < patches.length; i += BATCH_SIZE) {
    const batch = db.batch();
    for (const p of patches.slice(i, i + BATCH_SIZE)) {
      // Merge: only the search fields change (the array is replaced whole).
      batch.set(db.collection(p.table).doc(p.id), p.data, { merge: true });
    }
    await batch.commit();
    console.log(
      `  committed ${Math.min(i + BATCH_SIZE, patches.length)}/${patches.length}`,
    );
  }
  console.log("Done. Re-run with --dry-run to confirm nothing is left.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
