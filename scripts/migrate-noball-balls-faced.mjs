#!/usr/bin/env node
/**
 * Idempotent migration: a no-ball now counts as a ball the striker faced
 * (unless the match sets `noball_counts_as_ball_faced` to false). Figures
 * stored before are brought in line with the engine's own code
 * (`planNoBallFaced` in src/lib/firebase/noball-faced.ts, loaded with
 * jiti): for every innings holding a no-ball, its batters' balls faced and
 * its stands' balls from a recompute of its ball log; then, as the engine
 * derives them, `live_scorecard`, `player_matches`, `player_career_stats`
 * and the leaderboard shards of the players whose records change.
 *
 *   node scripts/migrate-noball-balls-faced.mjs                 # local emulator (default)
 *   node scripts/migrate-noball-balls-faced.mjs --dry-run       # print what would change
 *   node scripts/migrate-noball-balls-faced.mjs --project=<id>  # real project, using the
 *                                                               # service account in .env.local
 *
 * Reads every innings once (no-balls are found from its extras), then per
 * affected match its document, the over documents of its innings with a
 * no-ball and the records the engine reads. Writes only documents whose
 * values change, never the ball log. Each write is a transaction that
 * re-reads the document and skips it when it changed since it was read (a
 * ball scored meanwhile: the engine has it right from then on). A second
 * run plans nothing.
 */

import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { cert, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import createJiti from "jiti";

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

// The engine's TypeScript, as the app runs it (path alias and the
// server-only marker resolved for plain Node).
const jiti = createJiti(fileURLToPath(import.meta.url), {
  alias: {
    "~": resolve(here, "../src"),
    "server-only": resolve(here, "lib/server-only-stub.mjs"),
  },
  interopDefault: true,
});
const { planNoBallFaced } = jiti(
  resolve(here, "../src/lib/firebase/noball-faced.ts"),
);
const { AdminDataSource } = jiti(
  resolve(here, "../src/lib/firebase/datasource-admin.ts"),
);
const { sameRow } = jiti(resolve(here, "../src/lib/firebase/scoring/rows.ts"));

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

/** @param {Record<string, any>} doc */
function withoutId(doc) {
  const { id: _id, ...rest } = doc;
  void _id;
  return rest;
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
    `No-ball balls-faced migration on ${target}${dryRun ? " [dry run]" : ""}`,
  );

  const plan = await planNoBallFaced(new AdminDataSource(db), {
    now: new Date().toISOString(),
  });
  console.log(`
Read  ${plan.inningsChecked} innings with a no-ball, in ${plan.matches} matches with figures to change
Plan  ${plan.inningsChanged} innings, ${plan.writes.length} writes: ${
    Object.entries(plan.byTable)
      .map(([t, n]) => `${t} ${n}`)
      .join(", ") || "none"
  }`);
  /** @param {unknown} rows @returns {Array<Record<string, any>>} */
  const battingOf = (rows) => (Array.isArray(rows) ? rows : []);
  for (const w of plan.writes) {
    if (w.table !== "innings") continue;
    const before = new Map(
      battingOf(w.before?.batting).map((b) => [b.user_id, b.balls_faced ?? 0]),
    );
    const moved = battingOf(w.after?.batting)
      .filter((b) => (b.balls_faced ?? 0) !== before.get(b.user_id))
      .map((b) => `${b.user_id} ${before.get(b.user_id) ?? 0}->${b.balls_faced}`);
    console.log(`  innings ${w.id}: ${moved.join(", ")}`);
  }

  if (dryRun) return;
  if (!plan.writes.length) {
    console.log("\nNothing to do.");
    return;
  }

  console.log("\nApplying…");
  let written = 0;
  let skipped = 0;
  for (const w of plan.writes) {
    const ref = db.collection(w.table).doc(w.id);
    const done = await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      const now = snap.exists ? { ...snap.data(), id: snap.id } : null;
      // Changed since the plan read it: left to the engine.
      const unchanged =
        now && w.before ? sameRow(now, w.before) : !now && !w.before;
      if (!unchanged) return false;
      if (w.after) tx.set(ref, withoutId(w.after));
      else tx.delete(ref);
      return true;
    });
    if (done) written += 1;
    else skipped += 1;
  }
  console.log(
    `Done (${written} written, ${skipped} changed since read). Re-run with --dry-run to confirm nothing is left.`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
