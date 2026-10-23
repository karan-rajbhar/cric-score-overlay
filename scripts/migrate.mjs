#!/usr/bin/env node
/**
 * Runs pending data migrations, in order, exactly once per project.
 *
 * Applied migrations are recorded in the `_migrations` collection (no rule
 * allows clients to read or write it). Each migration is an idempotent
 * script taking `--project=<id>` (and `--dry-run`); a failure stops the run
 * with a non-zero exit, so a CI deploy halts before the new app ships.
 *
 *   node scripts/migrate.mjs                    # local emulator
 *   node scripts/migrate.mjs --project=<id>     # real project (service
 *                                               # account from .env.local or
 *                                               # FIREBASE_SERVICE_ACCOUNT_JSON)
 *   node scripts/migrate.mjs --project=<id> --dry-run   # list what would run
 *
 * To add a migration: write scripts/migrate-<name>.mjs (idempotent, same
 * flags as the existing ones) and append its name to MIGRATIONS.
 */

import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { cert, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

/** Run order matters; never reorder or remove applied entries. */
const MIGRATIONS = [
  "stage1",
  "stage2",
  "stage3",
  "search-trigrams",
  "leaderboard-shards",
  "per-ball-fields",
  "partnership-splits",
  "placeholder-flag",
];
// Not listed: migrate-storage-cache-headers.mjs (Storage metadata) needs the
// CI service account to update Storage objects; run it by hand once.

const here = dirname(fileURLToPath(import.meta.url));
const dryRun = process.argv.includes("--dry-run");
const project = process.argv
  .find((arg) => arg.startsWith("--project="))
  ?.slice("--project=".length);
const PROJECT_ID =
  project || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "demo-cricscore";

if (!project) {
  process.env.FIRESTORE_EMULATOR_HOST ||= `${process.env.FIREBASE_EMULATOR_HOST_SERVER || "127.0.0.1"}:8088`;
}

function credential() {
  try {
    process.loadEnvFile(resolve(here, "../.env.local"));
  } catch {
    // CI passes FIREBASE_SERVICE_ACCOUNT_JSON in the environment instead.
  }
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim();
  if (!raw) {
    console.error("FIREBASE_SERVICE_ACCOUNT_JSON is not set.");
    process.exit(1);
  }
  const account = JSON.parse(
    raw.startsWith("{") ? raw : Buffer.from(raw, "base64").toString("utf8"),
  );
  if (account.project_id !== project) {
    console.error(
      `The service account belongs to "${account.project_id}", not "${project}".`,
    );
    process.exit(1);
  }
  return cert(account);
}

initializeApp(
  project
    ? { projectId: PROJECT_ID, credential: credential() }
    : { projectId: PROJECT_ID },
);
const ledger = getFirestore().collection("_migrations");

const applied = new Set((await ledger.get()).docs.map((d) => d.id));
const pending = MIGRATIONS.filter((name) => !applied.has(name));
console.log(
  `Migrations on ${PROJECT_ID}: ${applied.size} applied, ${pending.length} pending${pending.length ? ` (${pending.join(", ")})` : ""}.`,
);

for (const name of pending) {
  const args = [resolve(here, `migrate-${name}.mjs`)];
  if (project) args.push(`--project=${project}`);
  if (dryRun) args.push("--dry-run");
  console.log(`\n▶ ${name}${dryRun ? " (dry run)" : ""}`);
  const run = spawnSync(process.execPath, args, { stdio: "inherit" });
  if (run.status !== 0) {
    console.error(`\nMigration ${name} failed (exit ${run.status}); stopping.`);
    process.exit(1);
  }
  if (!dryRun) {
    await ledger.doc(name).set({
      applied_at: new Date().toISOString(),
      commit: process.env.GITHUB_SHA ?? null,
    });
    console.log(`✓ ${name} recorded as applied`);
  }
}
