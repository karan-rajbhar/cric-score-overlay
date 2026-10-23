/**
 * Connection and helpers shared by the backfill scripts
 * (scripts/migrate-club-team-counts.mjs, migrate-match-summary-totals.mjs):
 * the local emulator by default, or `--project=<id>` with the service
 * account from .env.local / FIREBASE_SERVICE_ACCOUNT_JSON; `--dry-run`
 * plans without writing.
 */

import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { cert, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const here = dirname(fileURLToPath(import.meta.url));

/** @param {string} title What the script does, for its first line. */
export async function connect(title) {
  const dryRun = process.argv.includes("--dry-run");
  const remoteProject = process.argv
    .find((arg) => arg.startsWith("--project="))
    ?.slice("--project=".length);
  const projectId =
    remoteProject ||
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ||
    "demo-cricscore";
  if (remoteProject) {
    initializeApp({ projectId, credential: remoteCredential(remoteProject) });
  } else {
    const host = process.env.FIREBASE_EMULATOR_HOST_SERVER || "127.0.0.1";
    process.env.FIRESTORE_EMULATOR_HOST ||= `${host}:8088`;
    await assertEmulator();
    initializeApp({ projectId });
  }
  const target = remoteProject
    ? `project ${projectId}`
    : `emulator ${process.env.FIRESTORE_EMULATOR_HOST} (${projectId})`;
  console.log(`${title} on ${target}${dryRun ? " [dry run]" : ""}`);
  return { db: getFirestore(), dryRun };
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

/** @param {string} project */
function remoteCredential(project) {
  try {
    process.loadEnvFile(resolve(here, "../../.env.local"));
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
  if (account.project_id !== project) {
    console.error(
      `The service account in .env.local belongs to "${account.project_id}", not "${project}".`,
    );
    process.exit(1);
  }
  return cert(account);
}

/**
 * Only the fields a plan needs (reads are billed per document either way),
 * with each document's update time for a conditional write.
 * @param {import("firebase-admin/firestore").Query} query
 * @param {string[]} fields
 */
export async function readFields(query, fields) {
  const snap = await query.select(...fields).get();
  return snap.docs.map((d) => ({
    ...d.data(),
    id: d.id,
    _updateTime: d.updateTime,
  }));
}

/**
 * Applies `patches` with a bulk writer, each conditional on the document
 * being unchanged since it was read (`updateTimes`); a document changed or
 * deleted meanwhile is skipped (the app keeps the value from then on).
 * @param {import("firebase-admin/firestore").Firestore} db
 * @param {string} collection
 * @param {Array<{ id: string, patch: Record<string, unknown> }>} patches
 * @param {Map<string, import("firebase-admin/firestore").Timestamp>} updateTimes
 */
export async function applyPatches(db, collection, patches, updateTimes) {
  const col = db.collection(collection);
  const writer = db.bulkWriter();
  let skipped = 0;
  writer.onWriteError((err) => {
    if (err.code === 5 || err.code === 9) {
      skipped += 1; // NOT_FOUND / FAILED_PRECONDITION: gone or changed since read
      return false;
    }
    return err.failedAttempts < 3;
  });
  for (const { id, patch } of patches) {
    const lastUpdateTime = updateTimes.get(id);
    void writer
      .update(col.doc(id), patch, lastUpdateTime ? { lastUpdateTime } : {})
      .catch(() => {});
  }
  await writer.close();
  return { written: patches.length - skipped, skipped };
}
