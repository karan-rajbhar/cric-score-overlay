#!/usr/bin/env node
/**
 * One-off, idempotent migration for schema stage 2 (see scripts/lib/stage2.mjs):
 *
 *   - innings get their scorecard arrays (batting, bowling, fall_of_wickets,
 *     partnerships) and the last_ball / last_over_bowler_id caches
 *   - ball_by_ball becomes one overs/{inningsId}_{overNumber} doc per over
 *   - player_matches/{matchId}_{userId} records are built
 *   - with --delete-old, the legacy row documents (batting_performances,
 *     bowling_performances, fall_of_wickets, partnerships, ball_by_ball) are
 *     deleted afterwards
 *
 *   node scripts/migrate-stage2.mjs                 # local emulator (default)
 *   node scripts/migrate-stage2.mjs --dry-run       # print counts and cost only
 *   node scripts/migrate-stage2.mjs --project=<id>  # real project, using the
 *                                                   # service account in .env.local
 *   node scripts/migrate-stage2.mjs --delete-old    # also delete the legacy rows
 *
 * Run it right after deploying the stage 2 code, while nobody is scoring:
 * the new engine refuses to score an innings that has not been migrated.
 * Re-running is safe: documents already migrated are skipped. An innings
 * the new engine has already recorded deliveries in is left alone and
 * listed as a conflict (its legacy rows are kept).
 */

import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { cert, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { LEGACY_COLLECTIONS, planStage2, planWrites } from "./lib/stage2.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const dryRun = process.argv.includes("--dry-run");
const deleteOld = process.argv.includes("--delete-old");
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
 * @returns {Promise<import("./lib/stage2.mjs").Doc[]>}
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
  console.log(
    `Stage 2 migration on ${target}${dryRun ? " [dry run]" : ""}${deleteOld ? " [--delete-old]" : ""}`,
  );

  const names = /** @type {const} */ ([
    "matches",
    "innings",
    ...LEGACY_COLLECTIONS,
    "overs",
    "player_matches",
  ]);
  const read = await Promise.all(names.map((n) => readAll(db, n)));
  /** @type {Record<string, import("./lib/stage2.mjs").Doc[]>} */
  const data = Object.fromEntries(names.map((n, i) => [n, read[i] ?? []]));
  // An empty query result is still billed as one read.
  const reads = read.reduce((n, docs) => n + Math.max(1, docs.length), 0);

  const plan = planStage2(
    {
      matches: data.matches ?? [],
      innings: data.innings ?? [],
      battingPerformances: data.batting_performances ?? [],
      bowlingPerformances: data.bowling_performances ?? [],
      fallOfWickets: data.fall_of_wickets ?? [],
      partnerships: data.partnerships ?? [],
      balls: data.ball_by_ball ?? [],
      overs: data.overs ?? [],
      playerMatches: data.player_matches ?? [],
    },
    { deleteOld },
  );
  const writes = planWrites(plan);
  const legacyDeletes = Object.values(plan.legacyDeletes).reduce(
    (n, ids) => n + ids.length,
    0,
  );

  console.log(`
Read  ${names.map((n) => `${n} ${data[n]?.length ?? 0}`).join(", ")}
Plan  innings scorecards ${plan.inningsPatches.length}
      over docs written ${plan.overWrites.length}, deleted ${plan.overDeletes.length}
      player_matches written ${plan.playerMatchWrites.length}, deleted ${plan.playerMatchDeletes.length}
      legacy row deletes ${legacyDeletes}${deleteOld ? "" : " (pass --delete-old once the new data is verified)"}
Cost  ${reads} reads, ${writes} writes/deletes`);
  if (plan.conflicts.length) {
    console.warn(
      `\nConflicts (innings already scored on the new storage; left alone): ${plan.conflicts.join(", ")}`,
    );
  }
  if (plan.orphans.length) {
    console.warn(
      `\n${plan.orphans.length} legacy rows belong to innings that no longer exist (left alone): ${plan.orphans.slice(0, 10).join(", ")}${plan.orphans.length > 10 ? ", …" : ""}`,
    );
  }

  if (dryRun) return;
  if (writes === 0) {
    console.log("\nNothing to do.");
    return;
  }

  /** @type {Array<(batch: import("firebase-admin/firestore").WriteBatch) => void>} */
  const ops = [];
  for (const p of plan.inningsPatches) {
    ops.push((b) =>
      b.set(db.collection("innings").doc(p.id), p.data, { merge: true }),
    );
  }
  for (const o of plan.overWrites) {
    ops.push((b) => b.set(db.collection("overs").doc(o.id), withoutId(o)));
  }
  for (const id of plan.overDeletes) {
    ops.push((b) => b.delete(db.collection("overs").doc(id)));
  }
  for (const d of plan.playerMatchWrites) {
    ops.push((b) =>
      b.set(db.collection("player_matches").doc(d.id), withoutId(d)),
    );
  }
  for (const id of plan.playerMatchDeletes) {
    ops.push((b) => b.delete(db.collection("player_matches").doc(id)));
  }
  console.log("\nApplying…");
  await commitInBatches(db, ops, "new documents");

  // Legacy rows go only after every new document is committed.
  /** @type {Array<(batch: import("firebase-admin/firestore").WriteBatch) => void>} */
  const deletes = [];
  for (const [name, ids] of Object.entries(plan.legacyDeletes)) {
    for (const id of ids) {
      deletes.push((b) => b.delete(db.collection(name).doc(id)));
    }
  }
  if (deletes.length) await commitInBatches(db, deletes, "legacy deletes");
  console.log("Done. Re-run with --dry-run to confirm nothing is left.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
