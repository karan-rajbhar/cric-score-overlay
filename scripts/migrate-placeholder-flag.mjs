#!/usr/bin/env node
/**
 * Idempotent migration: squad players created before `users.is_placeholder`
 * existed (profiles whose server-only address is a `...@players.local` one)
 * get `is_placeholder: true`, so the scorer search leaves them out like new
 * ones. See scripts/lib/placeholder-flag.mjs.
 *
 *   node scripts/migrate-placeholder-flag.mjs                 # local emulator (default)
 *   node scripts/migrate-placeholder-flag.mjs --dry-run       # print counts and cost only
 *   node scripts/migrate-placeholder-flag.mjs --project=<id>  # real project, using the
 *                                                             # service account in .env.local
 *
 * Only `users.is_placeholder` is written, on profiles that have no flag yet;
 * nothing derives from it. Re-running is safe: a second run plans 0 writes.
 */

import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { cert, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { planPlaceholderFlags } from "./lib/placeholder-flag.mjs";

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
 * Only the fields the plan needs (reads are billed per document either
 * way), with each document's update time for the conditional write.
 * @param {import("firebase-admin/firestore").Query} query
 * @param {string[]} fields
 */
async function readFields(query, fields) {
  const snap = await query.select(...fields).get();
  return snap.docs.map((d) => ({
    ...d.data(),
    id: d.id,
    _updateTime: d.updateTime,
  }));
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
    `Placeholder flag migration on ${target}${dryRun ? " [dry run]" : ""}`,
  );

  const [users, usersPrivate] = await Promise.all([
    readFields(db.collection("users"), ["is_placeholder"]),
    readFields(db.collection("users_private"), ["email"]),
  ]);
  const plan = planPlaceholderFlags({ users, usersPrivate });
  const reads = Math.max(1, users.length) + Math.max(1, usersPrivate.length);
  console.log(`
Read  users ${users.length}, users_private ${usersPrivate.length}
Plan  ${plan.updates.length} profiles flagged as placeholders
Cost  ${reads} reads, ${plan.updates.length} writes`);

  if (dryRun) return;
  if (!plan.updates.length) {
    console.log("\nNothing to do.");
    return;
  }

  const col = db.collection("users");
  const writer = db.bulkWriter();
  let gone = 0;
  writer.onWriteError((err) => {
    if (err.code === 5) {
      gone += 1;
      return false; // NOT_FOUND: re-mapped onto an account since read
    }
    return err.failedAttempts < 3;
  });
  console.log("\nApplying…");
  for (const id of plan.updates) {
    void writer.update(col.doc(id), { is_placeholder: true }).catch(() => {});
  }
  await writer.close();
  console.log(
    `Done (${plan.updates.length - gone} flagged, ${gone} profiles gone). Re-run with --dry-run to confirm nothing is left.`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
