/**
 * Schema stage 3, as a pure plan over plain documents (used by
 * scripts/migrate-stage3.mjs and to regenerate the seed; tested in
 * src/lib/firebase/stage3.test.ts). The derivations themselves live in
 * src/lib/firebase/derive.mjs and stats.mjs, which the app uses too.
 *
 * 1. Search keys on users, teams, clubs, tournaments (`name_lower`,
 *    `search_prefixes`) and matches (`title_lower`, `search_prefixes`).
 * 2. `teams.roster`: team_players with a snapshot of each player's profile,
 *    and `club_memberships.user_snapshot`.
 * 3. `matches.innings_summary`: the score line of each innings, and the
 *    match's `tournament_snapshot` / `club_snapshot`.
 * 4. `player_career_stats/{userId}` and `leaderboards/{scope}_{id}` rebuilt
 *    from player_matches; documents that no longer belong are deleted
 *    (including the old randomly keyed career rows).
 *
 * Idempotent: planning again after applying yields an empty plan.
 */

import {
  canonicalJson,
  inningsSummaryOf,
  MATCH_PARENT_SNAPSHOTS,
  pickSnapshot,
  rosterOf,
  SEARCH_FIELDS,
  searchFieldsOf,
  userSnapshot,
} from "../../src/lib/firebase/derive.mjs";
import {
  CAREER_COLLECTION,
  LEADERBOARDS_COLLECTION,
  rebuildStats,
} from "../../src/lib/firebase/stats.mjs";

/** @typedef {{ id: string } & Record<string, any>} Doc */

/** Collections the migration reads. */
export const STAGE3_READS = /** @type {const} */ ([
  "users",
  "teams",
  "team_players",
  "club_memberships",
  "clubs",
  "tournaments",
  "matches",
  "innings",
  "player_matches",
  CAREER_COLLECTION,
  LEADERBOARDS_COLLECTION,
]);

const STAMPS = ["updated_at", "last_updated"];

/** @param {Record<string, any>} doc */
function withoutStamps(doc) {
  /** @type {Record<string, any>} */
  const copy = { ...doc };
  for (const k of STAMPS) delete copy[k];
  delete copy.id;
  return copy;
}

/**
 * @typedef {{
 *   patches: { table: string, id: string, data: Record<string, unknown> }[],
 *   sets: { table: string, doc: Doc }[],
 *   deletes: { table: string, id: string }[],
 *   counts: Record<string, number>,
 * }} Stage3Plan
 */

/**
 * @param {Record<string, Doc[] | undefined>} data
 * @param {{ now?: string }} [options]
 * @returns {Stage3Plan}
 */
export function planStage3(data, options = {}) {
  const now = options.now ?? new Date().toISOString();
  /** @type {Stage3Plan} */
  const plan = { patches: [], sets: [], deletes: [], counts: {} };
  const count = (/** @type {string} */ key) => {
    plan.counts[key] = (plan.counts[key] ?? 0) + 1;
  };

  /** @type {Map<string, Record<string, unknown>>} */
  const patchById = new Map();
  /**
   * @param {string} table
   * @param {Doc} doc
   * @param {Record<string, unknown>} fields
   * @param {string} label
   */
  const patchIfChanged = (table, doc, fields, label) => {
    /** @type {Record<string, unknown>} */
    const changed = {};
    for (const [k, v] of Object.entries(fields)) {
      if (canonicalJson(doc[k] ?? null) !== canonicalJson(v)) changed[k] = v;
    }
    if (!Object.keys(changed).length) return;
    const key = `${table}/${doc.id}`;
    const existing = patchById.get(key);
    if (existing) Object.assign(existing, changed);
    else {
      patchById.set(key, changed);
      plan.patches.push({ table, id: doc.id, data: changed });
    }
    count(label);
  };

  // 1. search keys
  for (const table of Object.keys(SEARCH_FIELDS)) {
    for (const doc of data[table] ?? []) {
      patchIfChanged(
        table,
        doc,
        searchFieldsOf(table, doc) ?? {},
        `${table} search keys`,
      );
    }
  }

  // 2. rosters
  const users = new Map((data.users ?? []).map((u) => [u.id, u]));
  /** @type {Map<string, Doc[]>} */
  const playersByTeam = new Map();
  for (const tp of data.team_players ?? []) {
    if (typeof tp.team_id !== "string") continue;
    const list = playersByTeam.get(tp.team_id) ?? [];
    list.push(tp);
    playersByTeam.set(tp.team_id, list);
  }
  for (const team of data.teams ?? []) {
    patchIfChanged(
      "teams",
      team,
      { roster: rosterOf(playersByTeam.get(team.id) ?? [], users) },
      "team rosters",
    );
  }

  for (const m of data.club_memberships ?? []) {
    patchIfChanged(
      "club_memberships",
      m,
      {
        user_snapshot: userSnapshot(
          typeof m.user_id === "string" ? users.get(m.user_id) : null,
        ),
      },
      "membership snapshots",
    );
  }

  // 3. innings summaries
  /** @type {Map<string, Doc[]>} */
  const inningsByMatch = new Map();
  for (const inn of data.innings ?? []) {
    if (typeof inn.match_id !== "string") continue;
    const list = inningsByMatch.get(inn.match_id) ?? [];
    list.push(inn);
    inningsByMatch.set(inn.match_id, list);
  }
  for (const match of data.matches ?? []) {
    patchIfChanged(
      "matches",
      match,
      { innings_summary: inningsSummaryOf(inningsByMatch.get(match.id) ?? []) },
      "match innings summaries",
    );
  }
  for (const spec of MATCH_PARENT_SNAPSHOTS) {
    const parents = new Map((data[spec.table] ?? []).map((d) => [d.id, d]));
    for (const match of data.matches ?? []) {
      const id = match[spec.local];
      patchIfChanged(
        "matches",
        match,
        {
          [spec.field]: pickSnapshot(
            typeof id === "string" ? parents.get(id) : null,
            spec.columns,
          ),
        },
        `match ${spec.field}s`,
      );
    }
  }

  // 4. statistics
  const { careers, leaderboards } = rebuildStats(
    /** @type {any[]} */ (data.player_matches ?? []),
    users,
    now,
  );
  for (const [table, wanted, label] of /** @type {const} */ ([
    [CAREER_COLLECTION, careers, "career docs"],
    [LEADERBOARDS_COLLECTION, leaderboards, "leaderboard docs"],
  ])) {
    const stored = new Map((data[table] ?? []).map((d) => [d.id, d]));
    for (const doc of wanted) {
      const prev = stored.get(doc.id);
      stored.delete(doc.id);
      if (
        prev &&
        canonicalJson(withoutStamps(prev)) === canonicalJson(withoutStamps(doc))
      ) {
        continue;
      }
      plan.sets.push({ table, doc: /** @type {Doc} */ (doc) });
      count(`${label} written`);
    }
    for (const id of stored.keys()) {
      plan.deletes.push({ table, id });
      count(`${label} deleted`);
    }
  }
  return plan;
}

/** @param {Stage3Plan} plan */
export function planWrites(plan) {
  return plan.patches.length + plan.sets.length + plan.deletes.length;
}

/**
 * The data after applying `plan` (tests, seed regeneration).
 * @param {Record<string, Doc[] | undefined>} data
 * @param {Stage3Plan} plan
 * @returns {Record<string, Doc[]>}
 */
export function applyStage3(data, plan) {
  /** @type {Record<string, Map<string, Doc>>} */
  const tables = {};
  for (const [name, docs] of Object.entries(data)) {
    tables[name] = new Map((docs ?? []).map((d) => [d.id, structuredClone(d)]));
  }
  const table = (/** @type {string} */ name) => (tables[name] ??= new Map());
  for (const p of plan.patches) {
    const t = table(p.table);
    const doc = t.get(p.id);
    if (doc) t.set(p.id, { ...doc, ...structuredClone(p.data) });
  }
  for (const s of plan.sets)
    table(s.table).set(s.doc.id, structuredClone(s.doc));
  for (const d of plan.deletes) table(d.table).delete(d.id);
  /** @type {Record<string, Doc[]>} */
  const out = {};
  for (const [name, map] of Object.entries(tables))
    out[name] = [...map.values()];
  return out;
}
