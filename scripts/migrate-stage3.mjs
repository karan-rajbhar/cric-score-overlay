#!/usr/bin/env node
/**
 * One-off, idempotent migration for schema stage 3 (see scripts/lib/stage3.mjs):
 *
 *   - search keys (`name_lower` / `title_lower`, `search_prefixes`) on
 *     users, teams, clubs, tournaments and matches
 *   - `teams.roster` and `club_memberships.user_snapshot` (player display
 *     names without profile reads)
 *   - `matches.innings_summary` (match lists without innings reads)
 *   - `player_career_stats/{userId}` and `leaderboards/{scope}_{id}` rebuilt
 *     from player_matches (old randomly keyed career rows are deleted)
 *
 *   node scripts/migrate-stage3.mjs                 # local emulator (default)
 *   node scripts/migrate-stage3.mjs --dry-run       # print counts and cost only
 *   node scripts/migrate-stage3.mjs --project=<id>  # real project, using the
 *                                                   # service account in .env.local
 *
 * Run it right after deploying the stage 3 code and indexes: until then the
 * players list and search find only documents written since the deploy, and
 * leaderboards build themselves on their next innings completion. Re-running
 * is safe: documents already up to date are skipped (a second run plans 0
 * writes). Run it while nobody is scoring; a statistics document changed
 * between the read and the write is simply rebuilt again on the next run.
 */

import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { cert, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { planStage3, planWrites, STAGE3_READS } from "./lib/stage3.mjs";

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
 * @param {import("firebase-admin/firestore").Firestore} db
 * @param {string} name
 * @returns {Promise<import("./lib/stage3.mjs").Doc[]>}
 */
async function readAll(db, name) {
  const snap = await db.collection(name).get();
  return snap.docs.map((d) => ({ ...d.data(), id: d.id }));
}

/**
 * Runs `ops` in batches of at most BATCH_SIZE writes.
 * @param {import("firebase-admin/firestore").Firestore} db
 * @param {Array<(batch: import("firebase-admin/firestore").WriteBatch) => void>} ops
 * @param {string} label
 */
async function commitInBatches(db, ops, label) {
  for (let i = 0; i < ops.length; i += BATCH_SIZE) {
    const batch = db.batch();
    for (const op of ops.slice(i, i + BATCH_SIZE)) op(batch);
    await batch.commit();
    console.log(
      `  ${label}: committed ${Math.min(i + BATCH_SIZE, ops.length)}/${ops.length}`,
    );
  }
}

/** @param {Record<string, any>} doc */
function withoutId(doc) {
  const copy = { ...doc };
  delete copy.id;
  return copy;
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
  console.log(`Stage 3 migration on ${target}${dryRun ? " [dry run]" : ""}`);

  const read = await Promise.all(STAGE3_READS.map((n) => readAll(db, n)));
  /** @type {Record<string, import("./lib/stage3.mjs").Doc[]>} */
  const data = Object.fromEntries(
    STAGE3_READS.map((n, i) => [n, read[i] ?? []]),
  );
  // An empty query result is still billed as one read.
  const reads = read.reduce((n, docs) => n + Math.max(1, docs.length), 0);

  const plan = planStage3(data);
  const writes = planWrites(plan);
  const counts = Object.entries(plan.counts)
    .map(([k, v]) => `      ${k}: ${v}`)
    .join("\n");
  console.log(`
Read  ${STAGE3_READS.map((n) => `${n} ${data[n]?.length ?? 0}`).join(", ")}
Plan
${counts || "      nothing to change"}
Cost  ${reads} reads, ${writes} writes/deletes`);

  if (dryRun) return;
  if (writes === 0) {
    console.log("\nNothing to do.");
    return;
  }

  /** @type {Array<(batch: import("firebase-admin/firestore").WriteBatch) => void>} */
  const ops = [];
  for (const p of plan.patches) {
    // Merge writes: fields not named here stay as they are. (Arrays and
    // the snapshot maps are replaced whole.)
    ops.push((b) =>
      b.set(db.collection(p.table).doc(p.id), p.data, { merge: true }),
    );
  }
  for (const s of plan.sets) {
    ops.push((b) =>
      b.set(db.collection(s.table).doc(s.doc.id), withoutId(s.doc)),
    );
  }
  for (const d of plan.deletes) {
    ops.push((b) => b.delete(db.collection(d.table).doc(d.id)));
  }
  console.log("\nApplying…");
  await commitInBatches(db, ops, "stage 3");
  console.log("Done. Re-run with --dry-run to confirm nothing is left.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
