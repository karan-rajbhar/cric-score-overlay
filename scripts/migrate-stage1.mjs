#!/usr/bin/env node
/**
 * One-off, idempotent migration for schema stage 1 (see scripts/lib/stage1.mjs):
 *
 *   - users.email / users.phone  -> users_private/{uid}, removed from users
 *   - matches.team1_snapshot / team2_snapshot backfilled from teams
 *   - every match_events document deleted
 *
 *   node scripts/migrate-stage1.mjs                 # local emulator (default)
 *   node scripts/migrate-stage1.mjs --dry-run       # print counts and cost only
 *   node scripts/migrate-stage1.mjs --project=<id>  # real project, using the
 *                                                   # service account in .env.local
 *   node scripts/migrate-stage1.mjs --keep-user-fields
 *       # copy contact details without removing them from users (safe before
 *       # the new code is deployed); run again without it afterwards.
 *
 * Re-running is safe: documents already migrated are skipped.
 */

import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { cert, initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { planStage1, planWrites } from "./lib/stage1.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const dryRun = process.argv.includes("--dry-run");
const keepUserFields = process.argv.includes("--keep-user-fields");
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
 * @returns {Promise<import("./lib/stage1.mjs").Doc[]>}
 */
async function readAll(db, name) {
  const snap = await db.collection(name).get();
  return snap.docs.map((d) => ({ ...d.data(), id: d.id }));
}

/**
 * Runs `ops` in batches of at most BATCH_SIZE writes.
 * @param {import("firebase-admin/firestore").Firestore} db
 * @param {Array<(batch: import("firebase-admin/firestore").WriteBatch) => void>} ops
 */
async function commitInBatches(db, ops) {
  for (let i = 0; i < ops.length; i += BATCH_SIZE) {
    const batch = db.batch();
    for (const op of ops.slice(i, i + BATCH_SIZE)) op(batch);
    await batch.commit();
    console.log(
      `  committed ${Math.min(i + BATCH_SIZE, ops.length)}/${ops.length}`,
    );
  }
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
  console.log(`Stage 1 migration on ${target}${dryRun ? " [dry run]" : ""}`);

  const [users, usersPrivate, teams, matches, matchEvents] = await Promise.all([
    readAll(db, "users"),
    readAll(db, "users_private"),
    readAll(db, "teams"),
    readAll(db, "matches"),
    readAll(db, "match_events"),
  ]);
  // An empty query result is still billed as one read.
  const reads = [users, usersPrivate, teams, matches, matchEvents].reduce(
    (n, docs) => n + Math.max(1, docs.length),
    0,
  );

  const plan = planStage1(
    { users, usersPrivate, teams, matches, matchEvents },
    { keepUserFields },
  );
  const writes = planWrites(plan);

  console.log(`
Read  users ${users.length}, users_private ${usersPrivate.length}, teams ${teams.length}, matches ${matches.length}, match_events ${matchEvents.length}
Plan  users_private writes ${plan.privateWrites.length}
      users email/phone removed ${plan.userStrips.length}${keepUserFields ? " (skipped: --keep-user-fields)" : ""}
      match snapshots ${plan.matchSnapshots.length}
      match_events deletes ${plan.eventDeletes.length}
Cost  ${reads} reads, ${writes} writes/deletes`);

  if (dryRun) return;
  if (writes === 0) {
    console.log("\nNothing to do.");
    return;
  }

  /** @type {Array<(batch: import("firebase-admin/firestore").WriteBatch) => void>} */
  const ops = [];
  for (const w of plan.privateWrites) {
    ops.push((b) =>
      b.set(db.collection("users_private").doc(w.id), w.data, { merge: true }),
    );
  }
  // Strip users only after their private copy is written (earlier batches).
  for (const id of plan.userStrips) {
    ops.push((b) =>
      b.update(db.collection("users").doc(id), {
        email: FieldValue.delete(),
        phone: FieldValue.delete(),
      }),
    );
  }
  for (const m of plan.matchSnapshots) {
    ops.push((b) => b.update(db.collection("matches").doc(m.id), m.patch));
  }
  for (const id of plan.eventDeletes) {
    ops.push((b) => b.delete(db.collection("match_events").doc(id)));
  }

  console.log("\nApplying…");
  await commitInBatches(db, ops);
  console.log("Done. Re-run with --dry-run to confirm nothing is left.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
