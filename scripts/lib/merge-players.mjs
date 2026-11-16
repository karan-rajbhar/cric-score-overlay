/**
 * Merges duplicate players into one (scripts/migrate-merge-players.mjs).
 *
 * Every record that names a duplicate (ball log, scorecards, squads, caches)
 * is rewritten to name the survivor, the duplicate's own documents are
 * removed, and the derived copies (career stats, leaderboard shards, rosters,
 * innings summaries) are rebuilt from the rewritten source records by the
 * stage 3 planner, so the survivor's figures are what the records add up to,
 * never a sum of two stored totals.
 *
 * The plan refuses (conflicts) rather than guessing when a pair cannot be
 * merged without double counting, and a final scan fails the plan when any
 * document still mentions a duplicate id.
 */

import { canonicalJson } from "../../src/lib/firebase/derive.mjs";
import { applyStage3, planStage3 } from "./stage3.mjs";

/** @typedef {{ id: string } & Record<string, any>} Doc */

/** Collections a duplicate's own id is the document id of: removed. */
const OWN_DOCS = ["users", "users_private", "player_career_stats"];
/** Documents that may hold both players of a pair only if they never played together. */
const TOGETHER = ["innings", "overs", "player_matches"];

/** @param {unknown} v */
function isPlain(v) {
  const proto = Object.getPrototypeOf(v);
  return proto === Object.prototype || proto === null;
}

/**
 * Replaces ids in values and keys, preserving everything else. Throws on a
 * value that is not plain JSON (a Firestore Timestamp would not survive).
 * @param {any} value
 * @param {Map<string, string>} map
 * @param {{ changed: boolean, keyClash: string | null }} state
 * @returns {any}
 */
function rewrite(value, map, state) {
  if (typeof value === "string") {
    const to = map.get(value);
    if (to === undefined) return value;
    state.changed = true;
    return to;
  }
  if (Array.isArray(value)) return value.map((v) => rewrite(v, map, state));
  if (value && typeof value === "object") {
    if (!isPlain(value)) {
      throw new Error(
        `Unsupported value (${value.constructor?.name}) in a document; this script only handles plain JSON.`,
      );
    }
    /** @type {Record<string, any>} */
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      const key = map.get(k) ?? k;
      if (key !== k) state.changed = true;
      const next = rewrite(v, map, state);
      // Two entries of one id-keyed map (names, refs) merge when they agree.
      if (key in out && canonicalJson(out[key]) !== canonicalJson(next)) {
        state.keyClash = key;
      }
      out[key] = next;
    }
    return out;
  }
  return value;
}

/**
 * Two records of one player in one match -> one, with every innings line.
 * @param {Doc} a
 * @param {Doc} b
 * @param {string[]} conflicts
 * @returns {Doc}
 */
function mergePlayerMatch(a, b, conflicts) {
  /** @param {any} x @param {any} y @param {string} side */
  const lines = (x, y, side) => {
    const all = [...(x[side] ?? []), ...(y[side] ?? [])];
    const innings = all.map((/** @type {any} */ l) => l.innings_id);
    if (new Set(innings).size !== innings.length) {
      conflicts.push(`player_matches/${a.id}.${side}: the same innings twice`);
    }
    return all.sort(
      (/** @type {any} */ l, /** @type {any} */ m) =>
        (l.innings_number ?? 0) - (m.innings_number ?? 0),
    );
  };
  /** @type {Record<string, number>} */
  const fielding = {};
  for (const f of [a.fielding, b.fielding]) {
    for (const [k, v] of Object.entries(f ?? {})) {
      fielding[k] = (fielding[k] ?? 0) + (typeof v === "number" ? v : 0);
    }
  }
  return {
    ...a,
    batting: lines(a, b, "batting"),
    bowling: lines(a, b, "bowling"),
    fielding,
  };
}

/** @param {Record<string, Doc[] | undefined>} data @param {string} table */
const docs = (data, table) => data[table] ?? [];

/**
 * @param {Record<string, Doc[] | undefined>} data every collection
 * @param {Record<string, string>} mapping duplicate id -> surviving id
 * @param {{ now?: string, remove?: string[] }} [options] `remove`: placeholder
 *   players with no records at all, deleted with their squad rows
 */
export function planMergePlayers(data, mapping, options = {}) {
  const now = options.now ?? new Date().toISOString();
  const removeIds = new Set(options.remove ?? []);
  const map = new Map(Object.entries(mapping));
  /** @type {string[]} */
  const conflicts = [];
  const users = new Map(docs(data, "users").map((u) => [u.id, u]));

  // 1. The mapping itself.
  for (const [dup, keep] of map) {
    if (dup === keep) conflicts.push(`${dup} is mapped to itself`);
    if (!users.has(dup)) conflicts.push(`duplicate ${dup} is not a user`);
    if (!users.has(keep)) conflicts.push(`survivor ${keep} is not a user`);
    if (map.has(keep))
      conflicts.push(`${keep} is both a survivor and a duplicate`);
  }

  const privates = new Map(docs(data, "users_private").map((u) => [u.id, u]));
  for (const id of removeIds) {
    if (!users.has(id)) conflicts.push(`removal ${id} is not a user`);
    if (map.has(id) || [...map.values()].includes(id)) {
      conflicts.push(`${id} is both merged and removed`);
    }
    // Real accounts (a sign-in address) are never removed.
    const email = String(privates.get(id)?.email ?? "");
    if (!email.endsWith("@players.local")) {
      conflicts.push(
        `${id} is a real account (${email || "no placeholder address"}), not removed`,
      );
    }
    // Only players nothing was scored for: no scorecard, ball or record.
    for (const table of Object.keys(data)) {
      if (["users", "users_private", "team_players", "teams"].includes(table))
        continue;
      for (const doc of docs(data, table)) {
        if (JSON.stringify(doc).includes(id)) {
          conflicts.push(`${id} is in ${table}/${doc.id}, so is not removed`);
        }
      }
    }
  }

  // 2. Two players of one pair on the same match, innings or ball.
  /** @type {Map<string, string[]>} */
  const groups = new Map();
  for (const [dup, keep] of map)
    groups.set(keep, [...(groups.get(keep) ?? [keep]), dup]);
  for (const [keep, ids] of groups) {
    for (const table of TOGETHER) {
      for (const doc of docs(data, table)) {
        const text = JSON.stringify(doc);
        const present = ids.filter((id) => text.includes(id));
        if (present.length > 1) {
          conflicts.push(
            `${table}/${doc.id} names more than one of ${ids.join(", ")} (survivor ${keep}): they played together`,
          );
        }
      }
    }
  }

  /** @type {Map<string, Map<string, Doc>>} */
  const tables = new Map();
  /** @type {Map<string, Set<string>>} */
  const touched = new Map();
  /** @type {{ table: string, id: string }[]} */
  const deletes = [];
  /** @type {string[]} */
  const notes = [];
  const touch = (/** @type {string} */ table, /** @type {string} */ id) => {
    const set = touched.get(table) ?? new Set();
    set.add(id);
    touched.set(table, set);
  };

  // 3. Rewrite every document.
  for (const [table, list] of Object.entries(data)) {
    const out = new Map();
    tables.set(table, out);
    for (const doc of list ?? []) {
      const own =
        OWN_DOCS.includes(table) && (map.has(doc.id) || removeIds.has(doc.id));
      if (own || (table === "team_players" && removeIds.has(doc.user_id))) {
        deletes.push({ table, id: doc.id });
        continue;
      }
      const state = {
        changed: false,
        keyClash: /** @type {string | null} */ (null),
      };
      /** @type {Doc} */
      const next = rewrite(doc, map, state);
      let id = doc.id;
      // `{matchId}_{userId}` style ids carry the user id as a suffix.
      for (const dup of map.keys()) {
        if (id.endsWith(`_${dup}`)) {
          id = `${id.slice(0, -dup.length)}${map.get(dup)}`;
          next.id = id;
          state.changed = true;
        }
      }
      if (state.keyClash)
        conflicts.push(
          `${table}/${doc.id}: key ${state.keyClash} would hold two values`,
        );
      // A squad lists a player once: when both are in a team, keep the survivor's row.
      if (table === "team_players" && state.changed) {
        const clash = list?.find(
          (o) =>
            o.team_id === doc.team_id && o.user_id === map.get(doc.user_id),
        );
        if (clash) {
          deletes.push({ table, id: doc.id });
          notes.push(
            `team_players/${doc.id}: ${doc.user_id} dropped, ${clash.user_id} is already in team ${doc.team_id}`,
          );
          continue;
        }
      }
      if (out.has(id)) {
        if (table !== "player_matches") {
          conflicts.push(`${table}/${id} would be written twice (${doc.id})`);
          continue;
        }
        // One person on both sides of a match (a common player): the app
        // keeps one record per player and match, holding a line per innings.
        out.set(id, mergePlayerMatch(out.get(id), next, conflicts));
        touch(table, id);
        notes.push(
          `player_matches/${id}: ${doc.id} joined (played for both sides)`,
        );
        deletes.push({ table, id: doc.id });
        continue;
      }
      out.set(id, next);
      if (id !== doc.id) deletes.push({ table, id: doc.id });
      if (state.changed) touch(table, id);
    }
  }

  // 4. One row per player in a scorecard.
  for (const inn of tables.get("innings")?.values() ?? []) {
    for (const side of ["batting", "bowling"]) {
      const rows = Array.isArray(inn[side]) ? inn[side] : [];
      const ids = rows.map((/** @type {any} */ r) => r.user_id);
      if (new Set(ids).size !== ids.length)
        conflicts.push(`innings/${inn.id}.${side} would list a player twice`);
    }
  }

  // 6. Rebuild everything derived from the rewritten records.
  /** @type {Record<string, Doc[]>} */
  const merged = Object.fromEntries(
    [...tables].map(([t, rows]) => [t, [...rows.values()]]),
  );
  const stage3 = planStage3(merged, { now });
  const final = applyStage3(merged, stage3);

  // Nothing may still mention a duplicate or a removed player.
  for (const [table, rows] of Object.entries(final)) {
    for (const doc of rows) {
      const text = JSON.stringify(doc);
      for (const gone of [...map.keys(), ...removeIds]) {
        if (text.includes(gone)) {
          conflicts.push(`${table}/${doc.id} still mentions ${gone}`);
        }
      }
    }
  }
  for (const p of stage3.patches) touch(p.table, p.id);
  for (const s of stage3.sets) touch(s.table, s.doc.id);
  for (const d of stage3.deletes) deletes.push(d);

  const finalById = new Map(
    Object.entries(final).map(([t, rows]) => [
      t,
      new Map(rows.map((d) => [d.id, d])),
    ]),
  );
  /** @type {{ table: string, doc: Doc }[]} */
  const writes = [];
  for (const [table, ids] of touched) {
    for (const id of ids) {
      const doc = finalById.get(table)?.get(id);
      if (doc) writes.push({ table, doc });
    }
  }
  const writeKeys = new Set(writes.map((w) => `${w.table}/${w.doc.id}`));
  const finalDeletes = deletes.filter(
    (d, i) =>
      !writeKeys.has(`${d.table}/${d.id}`) &&
      deletes.findIndex((x) => x.table === d.table && x.id === d.id) === i,
  );

  return {
    conflicts,
    notes,
    writes,
    deletes: finalDeletes,
    before: data,
    after: final,
    stage3,
  };
}

/**
 * Figures that must add up: for every survivor, the career accumulators of
 * the group before equal the survivor's after (counts summed; best figures
 * the best of the group).
 * @param {Record<string, Doc[] | undefined>} before
 * @param {Record<string, Doc[]>} after
 * @param {Record<string, string>} mapping
 * @returns {string[]} what differs
 */
export function verifyStats(before, after, mapping) {
  const SUM = [
    "m",
    "bi",
    "no",
    "r",
    "b",
    "f4",
    "f6",
    "c100",
    "c50",
    "bp",
    "wi",
    "wb",
    "md",
    "rc",
    "w",
    "w3",
    "w5",
    "wp",
    "ct",
    "st",
    "ro",
  ];
  const careerBefore = new Map(
    docs(before, "player_career_stats").map((d) => [d.id, d.acc ?? {}]),
  );
  const careerAfter = new Map(
    (after.player_career_stats ?? []).map((d) => [d.id, d.acc ?? {}]),
  );
  /** @type {Map<string, string[]>} */
  const groups = new Map();
  for (const [dup, keep] of Object.entries(mapping)) {
    groups.set(keep, [...(groups.get(keep) ?? [keep]), dup]);
  }
  /** @type {string[]} */
  const problems = [];
  for (const [keep, ids] of groups) {
    const got = careerAfter.get(keep) ?? {};
    // A match two of them played (for both sides) is still one match.
    const matches = new Set(
      docs(before, "player_matches")
        .filter((p) => ids.includes(p.user_id))
        .map((p) => p.match_id),
    ).size;
    for (const k of SUM) {
      const want =
        k === "m"
          ? matches
          : ids.reduce((n, id) => n + (careerBefore.get(id)?.[k] ?? 0), 0);
      if ((got[k] ?? 0) !== want)
        problems.push(`${keep}: ${k} is ${got[k] ?? 0}, the group had ${want}`);
    }
    const bestBat = Math.max(
      0,
      ...ids.map((id) => careerBefore.get(id)?.hs?.r ?? 0),
    );
    if ((got.hs?.r ?? 0) !== bestBat)
      problems.push(
        `${keep}: highest score ${got.hs?.r ?? 0}, the group's best ${bestBat}`,
      );
    const bestWk = Math.max(
      0,
      ...ids.map((id) => careerBefore.get(id)?.bb?.w ?? 0),
    );
    if ((got.bb?.w ?? 0) !== bestWk)
      problems.push(
        `${keep}: best spell wickets ${got.bb?.w ?? 0}, the group's best ${bestWk}`,
      );
  }
  return problems;
}

export { canonicalJson };
