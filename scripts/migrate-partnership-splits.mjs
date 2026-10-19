#!/usr/bin/env node
/**
 * Idempotent migration: stands recorded before the engine kept each
 * batter's share (`batsman1_runs` / `batsman1_balls` / `batsman2_runs` /
 * `batsman2_balls` in `innings.partnerships`) get them, rebuilt from the
 * innings' ball log. See scripts/lib/partnership-splits.mjs.
 *
 *   node scripts/migrate-partnership-splits.mjs                 # local emulator (default)
 *   node scripts/migrate-partnership-splits.mjs --dry-run       # print counts and cost only
 *   node scripts/migrate-partnership-splits.mjs --project=<id>  # real project, using the
 *                                                               # service account in .env.local
 *
 * Only the `partnerships` array of an innings changes, and only when the
 * log gives back its stands exactly (others are listed and left alone: the
 * scorecard shows their names and total). Safe while matches are scored:
 * each write is conditional on the innings being unchanged since it was
 * read; one that changed (a ball scored meanwhile) is skipped and the
 * engine keeps its shares from then on. Re-running is safe: a second run
 * plans 0 writes.
 */

import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { cert, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import {
  needsSplits,
  planPartnershipSplits,
} from "./lib/partnership-splits.mjs";

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
    `Partnership splits migration on ${target}${dryRun ? " [dry run]" : ""}`,
  );

  const [matches, innings] = await Promise.all([
    readFields(db.collection("matches"), [
      "wide_runs_to_batsman",
      "noball_extras_to_batsman",
      "wide_counts_as_ball_faced",
    ]),
    readFields(db.collection("innings"), ["match_id", "partnerships"]),
  ]);
  const pending = innings.filter(needsSplits);

  // The ball log of each innings that needs shares, a few at a time.
  /** @type {Array<{ id: string } & Record<string, any>>} */
  const overs = [];
  for (let i = 0; i < pending.length; i += 20) {
    const chunk = await Promise.all(
      pending
        .slice(i, i + 20)
        .map((inn) =>
          readFields(
            db.collection("overs").where("innings_id", "==", inn.id),
            ["innings_id", "over_number", "balls"],
          ),
        ),
    );
    overs.push(...chunk.flat());
  }

  const reads =
    Math.max(1, matches.length) +
    Math.max(1, innings.length) +
    Math.max(pending.length, overs.length);
  const plan = planPartnershipSplits({ matches, innings: pending, overs });
  console.log(`
Read  matches ${matches.length}, innings ${innings.length} (${pending.length} with stands to split), overs ${overs.length}
Plan  ${plan.updates.length} innings updated, ${plan.mismatched.length} left alone (log does not give back their stands)
Cost  ${reads} reads, ${plan.updates.length} writes`);
  if (plan.mismatched.length) {
    console.log(`Left alone: ${plan.mismatched.join(", ")}`);
  }

  if (dryRun) return;
  if (!plan.updates.length) {
    console.log("\nNothing to do.");
    return;
  }

  const updateTimeOf = new Map(pending.map((i) => [i.id, i._updateTime]));
  const col = db.collection("innings");
  const writer = db.bulkWriter();
  let gone = 0;
  let changed = 0;
  writer.onWriteError((err) => {
    if (err.code === 5) {
      gone += 1;
      return false; // NOT_FOUND: deleted since read (an undo across innings)
    }
    if (err.code === 9) {
      changed += 1;
      return false; // FAILED_PRECONDITION: scored since read; left as it is
    }
    return err.failedAttempts < 3;
  });
  console.log("\nApplying…");
  for (const { id, partnerships } of plan.updates) {
    void writer
      .update(
        col.doc(id),
        { partnerships },
        { lastUpdateTime: updateTimeOf.get(id) },
      )
      .catch(() => {});
  }
  await writer.close();
  console.log(
    `Done (${plan.updates.length - gone - changed} updated, ${changed} changed since read, ${gone} innings gone). Re-run with --dry-run to confirm nothing is left.`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
