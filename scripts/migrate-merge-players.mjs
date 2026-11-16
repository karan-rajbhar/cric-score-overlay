#!/usr/bin/env node
/**
 * One-time merge of duplicate players (see scripts/lib/merge-players.mjs):
 * every record naming a duplicate is rewritten to name the survivor, the
 * duplicate's profile and statistics are removed, and career stats,
 * leaderboards, rosters and innings summaries are rebuilt from the records.
 * Not part of scripts/migrate.mjs: it needs a mapping you approved.
 *
 *   node scripts/migrate-merge-players.mjs --map=merge.json --dry-run
 *   node scripts/migrate-merge-players.mjs --map=merge.json                 # local emulator
 *   node scripts/migrate-merge-players.mjs --map=merge.json --project=<id> --confirm=<id>
 *
 * merge.json: { "merge": { "<duplicate user id>": "<surviving user id>", ... },
 *                "remove": ["<placeholder with no records>", ...] }
 * (a bare { duplicate: survivor } object also works). A removed player must
 * be a placeholder (no sign-in address) named by no scorecard, ball or record.
 *
 * Refuses (writes nothing) when a pair played the same match, when a plan
 * has conflicts, or when the merged career figures differ from the sum of
 * the parts. Take a backup first and run it while nobody is scoring.
 * Re-running after a completed run plans nothing (the duplicates are gone).
 */

import { readFileSync } from "node:fs";
import { connect } from "./lib/firestore-script.mjs";
import { planMergePlayers, verifyStats } from "./lib/merge-players.mjs";

/** @param {string} name */
const arg = (name) =>
  process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const BATCH = 400;

const mapFile = arg("map");
if (!mapFile) {
  console.error("Pass --map=<file> ({ duplicateId: survivorId }).");
  process.exit(1);
}
const project = arg("project");
if (project && arg("confirm") !== project) {
  console.error(`Writing to ${project} needs --confirm=${project}.`);
  process.exit(1);
}
const plain = JSON.parse(readFileSync(mapFile, "utf8"));
/** @type {Record<string, string>} */
const mapping = plain.merge ?? plain;
/** @type {string[]} */
const remove = plain.merge ? (plain.remove ?? []) : [];

const { db, dryRun } = await connect("Merge duplicate players");

const names = (await db.listCollections()).map((c) => c.id);
/** @type {Record<string, any[]>} */
const data = {};
for (const name of names) {
  const snap = await db.collection(name).get();
  data[name] = snap.docs.map((d) => ({ ...d.data(), id: d.id }));
}
console.log(
  `Read ${names.map((n) => `${n} ${data[n]?.length ?? 0}`).join(", ")}`,
);

const present = [...Object.keys(mapping), ...remove].filter((id) =>
  (data.users ?? []).some((u) => u.id === id),
);
if (present.length === 0) {
  console.log("None of the duplicates exist any more. Nothing to do.");
  process.exit(0);
}

const plan = planMergePlayers(data, mapping, { remove });
/** @param {{ table: string }[]} list */
const count = (list) =>
  Object.entries(
    list.reduce(
      (/** @type {Record<string, number>} */ m, x) => (
        (m[x.table] = (m[x.table] ?? 0) + 1),
        m
      ),
      {},
    ),
  )
    .map(([t, n]) => `${t} ${n}`)
    .join(", ");
console.log(`Writes   ${count(plan.writes)}\nDeletes  ${count(plan.deletes)}`);
for (const n of plan.notes) console.log(`Note     ${n}`);

const problems = [...plan.conflicts, ...verifyStats(data, plan.after, mapping)];
if (problems.length) {
  console.error("\nRefusing to write:");
  for (const p of problems) console.error(`  ${p}`);
  process.exit(1);
}
console.log(
  "Check    career figures of every survivor equal the sum of their group",
);
if (dryRun) process.exit(0);

/** @type {Array<(b: import("firebase-admin/firestore").WriteBatch) => void>} */
const ops = [];
for (const { table, doc } of plan.writes) {
  const { id, ...fields } = doc;
  ops.push((b) => b.set(db.collection(table).doc(id), fields));
}
// Removals last, so an interrupted run leaves every record readable.
for (const { table, id } of plan.deletes) {
  ops.push((b) => b.delete(db.collection(table).doc(id)));
}
for (let i = 0; i < ops.length; i += BATCH) {
  const batch = db.batch();
  for (const op of ops.slice(i, i + BATCH)) op(batch);
  await batch.commit();
  console.log(`  committed ${Math.min(i + BATCH, ops.length)}/${ops.length}`);
}
console.log("Done. Re-run with --dry-run to confirm nothing is left.");
