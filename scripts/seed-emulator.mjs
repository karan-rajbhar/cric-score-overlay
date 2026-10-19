#!/usr/bin/env node
/**
 * Loads firebase/seed/data.json into the running Firebase emulators (or a
 * real dev project). No Auth accounts are created: sign-in is Google-only,
 * and the first Google sign-in with a seeded email takes over that profile.
 *
 *   npm run seed            # wipe emulator data, then seed
 *   npm run seed -- --keep  # seed without wiping first
 *   npm run seed -- --if-empty  # skip when the emulator already has data
 *   npm run seed -- --project=<id>  # seed a real project using the service
 *                                   # account in .env.local; never wipes, and
 *                                   # stops if it has data (unless --keep)
 *
 * Never seed production: anyone owning a seeded email could claim its profile.
 */

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { cert, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { applyStage3, planStage3, planWrites } from "./lib/stage3.mjs";
import { planPartnershipSplits } from "./lib/partnership-splits.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const keep = process.argv.includes("--keep");
const ifEmpty = process.argv.includes("--if-empty");
const remoteProject = process.argv
  .find((arg) => arg.startsWith("--project="))
  ?.slice("--project=".length);

// Demo data must never reach production (it starts empty: only invited
// Google accounts). Production project ids contain "prod".
if (remoteProject && /prod/i.test(remoteProject)) {
  console.error(
    `Refusing to seed "${remoteProject}": demo data is for dev and emulator projects only.`,
  );
  process.exit(1);
}

const PROJECT_ID =
  remoteProject ||
  process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ||
  "demo-cricscore";
const HOST = process.env.FIREBASE_EMULATOR_HOST_SERVER || "127.0.0.1";

if (!remoteProject) {
  process.env.FIRESTORE_EMULATOR_HOST ||= `${HOST}:8088`;
  process.env.FIREBASE_AUTH_EMULATOR_HOST ||= `${HOST}:9099`;
}
const raw = JSON.parse(
  readFileSync(resolve(here, "../firebase/seed/data.json"), "utf8"),
);
// data.json is stored in the stage 3 shape (search keys, rosters, innings
// summaries, statistics). If it was edited by hand, derive those again so
// the seeded documents agree with what the app maintains.
const stage3 = planStage3(raw, { now: "2024-06-01T00:00:00.000Z" });
if (planWrites(stage3) > 0) {
  console.log(
    `data.json is missing ${planWrites(stage3)} derived stage 3 fields; deriving them.`,
  );
}
const data = applyStage3(raw, stage3);
// data.json's stands predate each batter's share; give them the shares the
// engine keeps now (scripts/migrate-partnership-splits.mjs does the same).
{
  const splits = planPartnershipSplits({
    matches: data.matches ?? [],
    innings: data.innings ?? [],
    overs: data.overs ?? [],
  });
  const byId = new Map(splits.updates.map((u) => [u.id, u.partnerships]));
  data.innings = (data.innings ?? []).map((inn) =>
    byId.has(inn.id) ? { ...inn, partnerships: byId.get(inn.id) } : inn,
  );
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

async function wipe() {
  await fetch(
    `http://${process.env.FIRESTORE_EMULATOR_HOST}/emulator/v1/projects/${PROJECT_ID}/databases/(default)/documents`,
    { method: "DELETE" },
  );
  await fetch(
    `http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}/emulator/v1/projects/${PROJECT_ID}/accounts`,
    { method: "DELETE" },
  );
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

async function main() {
  if (remoteProject) {
    initializeApp({ projectId: PROJECT_ID, credential: remoteCredential() });
  } else {
    await assertEmulator();
    initializeApp({ projectId: PROJECT_ID });
  }
  const db = getFirestore();

  const hasData = !(await db.collection("users").limit(1).get()).empty;
  if (ifEmpty && hasData) {
    console.log("Emulator already has data; skipping seed.");
    return;
  }
  if (remoteProject && hasData && !keep) {
    console.error(
      `Project ${PROJECT_ID} already has data. Re-run with --keep to seed on top of it.`,
    );
    process.exit(1);
  }

  if (remoteProject) {
    console.log(`Seeding project ${PROJECT_ID}…`);
  } else if (!keep) {
    console.log("Clearing emulator data…");
    await wipe();
  }

  let total = 0;
  for (const [collection, docs] of Object.entries(data)) {
    for (let i = 0; i < docs.length; i += 400) {
      const batch = db.batch();
      for (const doc of docs.slice(i, i + 400)) {
        const { id, ...rest } = doc;
        batch.set(db.collection(collection).doc(id), rest);
      }
      await batch.commit();
    }
    total += docs.length;
    console.log(`  ${collection.padEnd(26)} ${docs.length}`);
  }

  console.log(`\nSeeded ${total} documents.`);
  console.log(
    'Sign in with Google. In the emulator, choose "Add new account" and use a seeded email (e.g. john.smith@email.com) to act as that user.',
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
