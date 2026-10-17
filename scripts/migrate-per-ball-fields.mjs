#!/usr/bin/env node
/**
 * Idempotent migration: the match fields that changed with every ball move
 * to the match's current innings, so a delivery no longer writes the match
 * document (`last_ball_seq` -> `innings.last_ball_seq`,
 * `recent_client_actions` -> `innings.recent_client_actions`; the position
 * is derived from the innings). See scripts/lib/per-ball-fields.mjs.
 *
 *   node scripts/migrate-per-ball-fields.mjs                 # local emulator (default)
 *   node scripts/migrate-per-ball-fields.mjs --dry-run       # print counts and cost only
 *   node scripts/migrate-per-ball-fields.mjs --project=<id>  # real project, using the
 *                                                            # service account in .env.local
 *
 * Copies only (the match keeps its old fields; the app reads both, taking
 * the larger counter and both id lists), so it is safe while an older app
 * version still scores: whatever that version writes to the match is still
 * read. Re-running is safe: a second run plans 0 writes.
 */

import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { cert, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { planPerBallFields } from "./lib/per-ball-fields.mjs";

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
 * Only the fields the plan needs (reads are billed per document either way).
 * @param {import("firebase-admin/firestore").Firestore} db
 * @param {string} name
 * @param {string[]} fields
 */
async function readFields(db, name, fields) {
  const snap = await db
    .collection(name)
    .select(...fields)
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
    `Per-ball fields migration on ${target}${dryRun ? " [dry run]" : ""}`,
  );

  const [matches, innings] = await Promise.all([
    readFields(db, "matches", [
      "current_innings",
      "last_ball_seq",
      "recent_client_actions",
    ]),
    readFields(db, "innings", [
      "match_id",
      "innings_number",
      "last_ball_seq",
      "recent_client_actions",
    ]),
  ]);
  const reads = Math.max(1, matches.length) + Math.max(1, innings.length);
  const plan = planPerBallFields({ matches, innings });
  console.log(`
Read  matches ${matches.length}, innings ${innings.length}
Plan  ${plan.updates.length} innings updated (${plan.matchesWithoutInnings} matches with a counter but no current innings, skipped)
Cost  ${reads} reads, ${plan.updates.length} writes`);

  if (dryRun) return;
  if (!plan.updates.length) {
    console.log("\nNothing to do.");
    return;
  }

  // `update`, not a merge: an innings deleted since it was read (an undo
  // across an innings break) must not come back as a stub.
  const col = db.collection("innings");
  const writer = db.bulkWriter();
  let gone = 0;
  writer.onWriteError((err) => {
    if (err.code === 5) {
      gone += 1;
      return false; // NOT_FOUND: nothing to carry over
    }
    return err.failedAttempts < 3;
  });
  console.log("\nApplying…");
  for (const { id, data } of plan.updates) {
    const fields = /** @type {Record<string, any>} */ (data);
    void writer.update(col.doc(id), fields).catch(() => {});
  }
  await writer.close();
  console.log(
    `Done (${plan.updates.length - gone} updated, ${gone} innings gone since read). Re-run with --dry-run to confirm nothing is left.`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
