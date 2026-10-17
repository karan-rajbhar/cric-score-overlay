/**
 * Search trigrams: recompute `search_prefixes` (and the sort key) of every
 * searchable document with the current derivation, which adds the 3-letter
 * pieces of each word for mid-word search (see `searchPrefixes` in
 * src/lib/firebase/derive.mjs). Used by scripts/migrate-search-trigrams.mjs
 * and to refresh the seed; tested in src/lib/firebase/search-trigrams.test.ts.
 *
 * Idempotent: planning again after applying yields no patches.
 */

import {
  canonicalJson,
  SEARCH_FIELDS,
  searchFieldsOf,
} from "../../src/lib/firebase/derive.mjs";

/** @typedef {{ id: string } & Record<string, any>} Doc */

/** Collections the migration reads, with the fields it needs. */
export const SEARCH_KEY_TABLES = Object.keys(SEARCH_FIELDS);

/** @param {string} table */
export function searchKeyColumns(table) {
  const spec = SEARCH_FIELDS[table];
  if (!spec) return [];
  return [...new Set([...spec.sources, spec.sort, "search_prefixes"])];
}

/**
 * @param {Record<string, Doc[] | undefined>} data
 * @returns {{ table: string, id: string, data: Record<string, unknown> }[]}
 */
export function planSearchKeys(data) {
  /** @type {{ table: string, id: string, data: Record<string, unknown> }[]} */
  const patches = [];
  for (const table of SEARCH_KEY_TABLES) {
    for (const doc of data[table] ?? []) {
      /** @type {Record<string, unknown>} */
      const changed = {};
      for (const [k, v] of Object.entries(searchFieldsOf(table, doc) ?? {})) {
        if (canonicalJson(doc[k] ?? null) !== canonicalJson(v)) changed[k] = v;
      }
      if (Object.keys(changed).length) {
        patches.push({ table, id: doc.id, data: changed });
      }
    }
  }
  return patches;
}

/**
 * `data` with the patches applied (a copy; documents not patched are
 * shared).
 * @param {Record<string, Doc[] | undefined>} data
 * @param {{ table: string, id: string, data: Record<string, unknown> }[]} patches
 */
export function applySearchKeys(data, patches) {
  /** @type {Map<string, Record<string, unknown>>} */
  const byKey = new Map(patches.map((p) => [`${p.table}/${p.id}`, p.data]));
  /** @type {Record<string, Doc[] | undefined>} */
  const out = { ...data };
  for (const table of SEARCH_KEY_TABLES) {
    if (!data[table]) continue;
    out[table] = data[table].map((doc) => {
      const patch = byKey.get(`${table}/${doc.id}`);
      return patch ? { ...doc, ...patch } : doc;
    });
  }
  return out;
}
