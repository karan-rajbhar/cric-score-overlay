#!/usr/bin/env node
/**
 * Idempotent migration: one leaderboard document per scope
 * (`leaderboards/{scope}_{id}`, which hits Firestore's 1 MiB limit at
 * ~1,500 players) becomes LEADERBOARD_SHARDS shards per scope
 * (`leaderboards/{scope}_{id}_{k}`, players split by a hash of their id).
 * See scripts/lib/leaderboard-shards.mjs.
 *
 *   node scripts/migrate-leaderboard-shards.mjs                 # local emulator (default)
 *   node scripts/migrate-leaderboard-shards.mjs --dry-run       # print counts and cost only
 *   node scripts/migrate-leaderboard-shards.mjs --project=<id>  # real project, using the
 *                                                               # service account in .env.local
 *
 * The shards are rebuilt from player_matches and every other leaderboard
 * document is deleted. Re-running is safe: shards already up to date are
 * skipped (a second run plans 0 writes). Run it while nobody is scoring; a
 * shard changed between the read and the write is rebuilt by the next run.
 */

import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { cert, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { LEADERBOARDS_COLLECTION } from "../src/lib/firebase/stats.mjs";
import {
  planLeaderboardShards,
  SHARD_READS,
} from "./lib/leaderboard-shards.mjs";

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
 */
async function readAll(db, name) {
  const snap = await db.collection(name).get();
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
    `Leaderboard shards migration on ${target}${dryRun ? " [dry run]" : ""}`,
  );

  const read = await Promise.all(SHARD_READS.map((n) => readAll(db, n)));
  const data = Object.fromEntries(
    SHARD_READS.map((n, i) => [n, read[i] ?? []]),
  );
  // An empty query result is still billed as one read.
  const reads = read.reduce((n, docs) => n + Math.max(1, docs.length), 0);
  const plan = planLeaderboardShards(data);
  const writes = plan.sets.length + plan.deletes.length;
  console.log(`
Read  ${SHARD_READS.map((n) => `${n} ${data[n]?.length ?? 0}`).join(", ")}
Plan  ${plan.sets.length} shard docs written, ${plan.deletes.length} docs deleted
Cost  ${reads} reads, ${writes} writes/deletes`);

  if (dryRun) return;
  if (writes === 0) {
    console.log("\nNothing to do.");
    return;
  }

  const col = db.collection(LEADERBOARDS_COLLECTION);
  /** @type {Array<(batch: import("firebase-admin/firestore").WriteBatch) => void>} */
  const ops = [];
  // Shards first, then the old documents, so a run that stops part way
  // never leaves a scope with neither.
  for (const doc of plan.sets) {
    const { id, ...fields } = doc;
    ops.push((b) => b.set(col.doc(id), fields));
  }
  for (const id of plan.deletes) ops.push((b) => b.delete(col.doc(id)));
  console.log("\nApplying…");
  for (let i = 0; i < ops.length; i += BATCH_SIZE) {
    const batch = db.batch();
    for (const op of ops.slice(i, i + BATCH_SIZE)) op(batch);
    await batch.commit();
    console.log(
      `  committed ${Math.min(i + BATCH_SIZE, ops.length)}/${ops.length}`,
    );
  }
  console.log("Done. Re-run with --dry-run to confirm nothing is left.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
