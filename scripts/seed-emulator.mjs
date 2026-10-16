#!/usr/bin/env node
/**
 * Loads firebase/seed/data.json into the running Firebase emulators and
 * creates a matching Auth account for every seeded user.
 *
 *   npm run seed            # wipe emulator data, then seed
 *   npm run seed -- --keep  # seed without wiping first
 *
 * Every seeded account signs in with the password below.
 */

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

const SEED_PASSWORD = "password123";
const PROJECT_ID =
  process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "demo-cricscore";
const HOST = process.env.FIREBASE_EMULATOR_HOST_SERVER || "127.0.0.1";

process.env.FIRESTORE_EMULATOR_HOST ||= `${HOST}:8088`;
process.env.FIREBASE_AUTH_EMULATOR_HOST ||= `${HOST}:9099`;

const keep = process.argv.includes("--keep");
const here = dirname(fileURLToPath(import.meta.url));
const data = JSON.parse(
  readFileSync(resolve(here, "../firebase/seed/data.json"), "utf8"),
);

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

async function main() {
  await assertEmulator();
  initializeApp({ projectId: PROJECT_ID });
  const db = getFirestore();
  const auth = getAuth();

  if (!keep) {
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

  let accounts = 0;
  for (const user of data.users ?? []) {
    if (!user.email || user.email.endsWith("@players.local")) continue;
    try {
      await auth.createUser({
        uid: user.id,
        email: user.email,
        emailVerified: true,
        password: SEED_PASSWORD,
        displayName: user.full_name,
      });
      accounts += 1;
    } catch (err) {
      if (
        !/already exists|uid-already-exists|email-already-exists/i.test(
          String(err),
        )
      )
        throw err;
    }
  }

  console.log(`\nSeeded ${total} documents and ${accounts} auth accounts.`);
  console.log(
    `Sign in with any seeded email (e.g. john.smith@email.com) and password "${SEED_PASSWORD}".`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
