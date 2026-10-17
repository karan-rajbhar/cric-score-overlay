/**
 * Leaderboard sharding, as a pure plan over plain documents (used by
 * scripts/migrate-leaderboard-shards.mjs; tested in
 * src/lib/firebase/leaderboard-shards.test.ts).
 *
 * Rebuilds every `leaderboards/{scope}_{id}_{k}` shard from player_matches
 * (`rebuildStats`, the same definition the app maintains incrementally)
 * and deletes every other document in the collection, including the old
 * one-per-scope `leaderboards/{scope}_{id}` documents.
 *
 * Idempotent: planning again after applying yields an empty plan.
 */

import { canonicalJson } from "../../src/lib/firebase/derive.mjs";
import {
  LEADERBOARDS_COLLECTION,
  rebuildStats,
} from "../../src/lib/firebase/stats.mjs";

/** @typedef {{ id: string } & Record<string, any>} Doc */

/** Collections the migration reads. */
export const SHARD_READS = /** @type {const} */ ([
  "users",
  "player_matches",
  LEADERBOARDS_COLLECTION,
]);

/** @param {Record<string, any>} doc */
function comparable(doc) {
  const copy = { ...doc };
  delete copy.id;
  delete copy.updated_at;
  return canonicalJson(copy);
}

/**
 * @param {Record<string, Doc[] | undefined>} data
 * @param {{ now?: string }} [options]
 * @returns {{ sets: Doc[], deletes: string[] }}
 */
export function planLeaderboardShards(data, options = {}) {
  const now = options.now ?? new Date().toISOString();
  const users = new Map((data.users ?? []).map((u) => [u.id, u]));
  const { leaderboards } = rebuildStats(
    /** @type {any[]} */ (data.player_matches ?? []),
    users,
    now,
  );
  const stored = new Map(
    (data[LEADERBOARDS_COLLECTION] ?? []).map((d) => [d.id, d]),
  );
  /** @type {Doc[]} */
  const sets = [];
  for (const doc of leaderboards) {
    const prev = stored.get(doc.id);
    stored.delete(doc.id);
    if (prev && comparable(prev) === comparable(doc)) continue;
    sets.push(/** @type {Doc} */ (doc));
  }
  return { sets, deletes: [...stored.keys()] };
}
