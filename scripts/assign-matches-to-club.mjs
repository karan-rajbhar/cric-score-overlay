#!/usr/bin/env node
/**
 * One-time: move matches into a club, through the app's own write path.
 *
 * Each match gets `club_id` via the server client, so the same write hooks
 * that run when the app changes a match's club run here: the match's
 * `club_snapshot`, its player records (`club_id`), and the career and club
 * leaderboard documents are produced by the app's code, not copied by this
 * script. The change is first replayed in memory against a copy of the
 * data and checked; only then (without --dry-run) written for real.
 *
 *   node scripts/assign-matches-to-club.mjs --club=<clubId> --dry-run
 *   node scripts/assign-matches-to-club.mjs --club=<clubId> [--matches=id,id]
 *   node scripts/assign-matches-to-club.mjs --club=<id> --project=<id> --confirm=<id> [--adc]
 *
 * Without --matches: every match that has no club yet. A match that already
 * belongs to another club is refused. Take a backup first.
 */

import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import createJiti from "jiti";
import { connect } from "./lib/firestore-script.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const jiti = createJiti(fileURLToPath(import.meta.url), {
  alias: {
    "~": resolve(here, "../src"),
    "server-only": resolve(here, "lib/server-only-stub.mjs"),
  },
  interopDefault: true,
});
const { MemoryDataSource } = jiti(
  resolve(here, "../src/lib/firebase/datasource.ts"),
);
const { AdminDataSource } = jiti(
  resolve(here, "../src/lib/firebase/datasource-admin.ts"),
);
const { serverClientFor } = jiti(
  resolve(here, "../src/lib/firebase/server-client.ts"),
);
const { canonicalJson } = jiti(resolve(here, "../src/lib/firebase/derive.mjs"));

/** @param {string} name */
const arg = (name) =>
  process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);

const clubId = arg("club");
if (!clubId) {
  console.error("Pass --club=<club id>.");
  process.exit(1);
}
const project = arg("project");
if (project && arg("confirm") !== project) {
  console.error(`Writing to ${project} needs --confirm=${project}.`);
  process.exit(1);
}
const STAMPS = ["updated_at", "last_updated"];
/** @param {Record<string, any>} d */
const plain = (d) => {
  const c = { ...d };
  for (const k of STAMPS) delete c[k];
  return canonicalJson(c);
};

const { db, dryRun } = await connect("Move matches into a club");

/** @type {Record<string, any[]>} */
const before = {};
for (const col of await db.listCollections()) {
  const snap = await col.get();
  before[col.id] = snap.docs.map((d) => ({ ...d.data(), id: d.id }));
}
const club = (before.clubs ?? []).find((c) => c.id === clubId);
if (!club) {
  console.error(`Club ${clubId} does not exist.`);
  process.exit(1);
}
const wanted =
  arg("matches")?.split(",") ??
  (before.matches ?? []).filter((m) => !m.club_id).map((m) => m.id);
for (const id of wanted) {
  const m = (before.matches ?? []).find((x) => x.id === id);
  if (!m) {
    console.error(`Match ${id} does not exist.`);
    process.exit(1);
  }
  if (m.club_id && m.club_id !== clubId) {
    console.error(`Match ${id} already belongs to club ${m.club_id}.`);
    process.exit(1);
  }
}
console.log(
  `Club ${club.name}; ${wanted.length} matches: ${wanted.map((i) => i.slice(0, 8)).join(", ")}`,
);

/**
 * The write itself, on any data source: the app's client with its write
 * hooks.
 * @param {any} ds
 * @param {any} firestore transaction handle (null in memory)
 */
async function assign(ds, firestore) {
  const client = serverClientFor({
    ds,
    db: firestore,
    getUser: async () => null,
  });
  for (const id of wanted) {
    const { error } = await client
      .from("matches")
      .update({ club_id: clubId })
      .eq("id", id);
    if (error) throw new Error(`match ${id}: ${error.message}`);
  }
}

// 1. Replay in memory and check what the app produced.
const memory = new MemoryDataSource(structuredClone(before));
await assign(memory, null);
/** @type {Record<string, any[]>} */
const after = {};
for (const table of Object.keys(before)) after[table] = memory.all(table);
for (const table of memory.tables.keys()) after[table] ??= memory.all(table);

/** @type {{ table: string, id: string }[]} */
const changed = [];
/** @type {{ table: string, id: string }[]} */
const removed = [];
for (const table of new Set([...Object.keys(before), ...Object.keys(after)])) {
  const was = new Map((before[table] ?? []).map((d) => [d.id, d]));
  const now = new Map((after[table] ?? []).map((d) => [d.id, d]));
  for (const [id, d] of now) {
    if (!was.has(id) || plain(was.get(id)) !== plain(d))
      changed.push({ table, id });
  }
  for (const id of was.keys()) if (!now.has(id)) removed.push({ table, id });
}
const by = (/** @type {{ table: string }[]} */ l) =>
  Object.entries(
    l.reduce(
      (/** @type {Record<string, number>} */ m, x) => (
        (m[x.table] = (m[x.table] ?? 0) + 1),
        m
      ),
      {},
    ),
  )
    .map(([t, n]) => `${t} ${n}`)
    .join(", ");
console.log(`Writes   ${by(changed)}\nDeletes  ${by(removed) || "none"}`);

/** @type {string[]} */
const problems = [];
const allowed = new Set([
  "matches",
  "player_matches",
  "leaderboards",
  "player_career_stats",
  "clubs",
  "teams",
]);
for (const c of changed)
  if (!allowed.has(c.table))
    problems.push(`unexpected write to ${c.table}/${c.id}`);
if (removed.length) problems.push("unexpected deletions");
for (const id of wanted) {
  const m = (after.matches ?? []).find((x) => x.id === id);
  if (m?.club_id !== clubId) problems.push(`match ${id} has no club_id`);
  if (m?.club_snapshot?.id !== clubId)
    problems.push(`match ${id} has no club_snapshot`);
  const rec = (after.player_matches ?? []).filter((p) => p.match_id === id);
  if (rec.some((p) => p.club_id !== clubId))
    problems.push(`match ${id}: a player record has no club_id`);
}
const total = (/** @type {any} */ s) =>
  canonicalJson(
    (s.player_career_stats ?? [])
      .map((/** @type {any} */ c) => [c.id, c.acc])
      .sort(),
  );
if (total(before) !== total(after)) problems.push("career figures changed");
const boards = (after.leaderboards ?? []).filter((l) =>
  l.id.startsWith(`club_${clubId}`),
);
const boardPlayers = new Set(
  boards.flatMap((b) => Object.keys(b.players ?? {})),
);
const clubPlayers = new Set(
  (after.player_matches ?? [])
    .filter((p) => p.club_id === clubId)
    .map((p) => p.user_id),
);
for (const u of clubPlayers)
  if (!boardPlayers.has(u))
    problems.push(`club leaderboard misses player ${u}`);
console.log(
  `Check    club leaderboard has ${boardPlayers.size} of ${clubPlayers.size} players; career figures unchanged`,
);
if (problems.length) {
  console.error("\nRefusing to write:");
  for (const p of problems) console.error(`  ${p}`);
  process.exit(1);
}
if (dryRun) process.exit(0);

// 2. The same code, for real.
await assign(new AdminDataSource(db), db);
console.log("Written. Re-run with --dry-run to confirm nothing is left.");
