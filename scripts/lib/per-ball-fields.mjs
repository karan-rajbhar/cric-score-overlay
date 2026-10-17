/**
 * Per-ball match fields move to the current innings, as a pure plan over
 * plain documents (used by scripts/migrate-per-ball-fields.mjs; tested in
 * src/lib/firebase/per-ball-fields.test.ts).
 *
 * A delivery no longer writes the match document. What used to change on
 * it with every ball now lives on the match's current innings:
 *
 * - `matches.last_ball_seq` (the ball `seq` counter) ->
 *   `innings.last_ball_seq` of the current innings (the larger value wins,
 *   so a run after the app has moved on changes nothing);
 * - `matches.recent_client_actions` (offline replay memory) -> merged into
 *   `innings.recent_client_actions` of the current innings (the engine
 *   checks both, newest last, at most CLIENT_ACTION_MEMORY);
 * - `current_over` / `current_ball` need no copy: they are derived from the
 *   current innings' `total_balls` (`src/lib/match-position.ts`);
 * - `innings_summary` stays on the match (refreshed on structural changes).
 *
 * The old match fields are left in place (readers take both shapes while an
 * older app version may still write them). Idempotent: planning again after
 * applying yields an empty plan.
 */

/** @typedef {{ id: string } & Record<string, any>} Doc */

/** Mirrors CLIENT_ACTION_MEMORY in src/lib/firebase/rpc/scoring.ts. */
export const CLIENT_ACTION_MEMORY = 20;

/**
 * Ids in order, each once (at its last place), the newest kept (mirrors
 * `mergeActionIds` in src/lib/firebase/rpc/scoring.ts).
 * @param {...(string[] | null | undefined)} lists
 * @returns {string[]}
 */
export function mergeActionIds(...lists) {
  const all = lists.flatMap((l) => (Array.isArray(l) ? l : []));
  const seen = new Set();
  /** @type {string[]} */
  const out = [];
  for (let i = all.length - 1; i >= 0; i -= 1) {
    const id = all[i];
    if (typeof id !== "string" || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out.reverse().slice(-CLIENT_ACTION_MEMORY);
}

/**
 * @param {unknown} a
 * @param {unknown} b
 */
function sameIds(a, b) {
  return (
    Array.isArray(a) &&
    Array.isArray(b) &&
    a.length === b.length &&
    a.every((x, i) => x === b[i])
  );
}

/**
 * @param {{ matches?: Doc[], innings?: Doc[] }} data
 * @returns {{ updates: Array<{ id: string, data: Record<string, unknown> }>, matchesWithoutInnings: number }}
 */
export function planPerBallFields(data) {
  /** @type {Map<string, Doc[]>} */
  const inningsByMatch = new Map();
  for (const inn of data.innings ?? []) {
    if (typeof inn.match_id !== "string") continue;
    const list = inningsByMatch.get(inn.match_id) ?? [];
    list.push(inn);
    inningsByMatch.set(inn.match_id, list);
  }
  /** @type {Array<{ id: string, data: Record<string, unknown> }>} */
  const updates = [];
  let matchesWithoutInnings = 0;
  for (const match of data.matches ?? []) {
    const seq =
      typeof match.last_ball_seq === "number" ? match.last_ball_seq : null;
    const ids = Array.isArray(match.recent_client_actions)
      ? match.recent_client_actions
      : [];
    if (seq === null && !ids.length) continue;
    const current = (inningsByMatch.get(match.id) ?? []).find(
      (i) => i.innings_number === (match.current_innings ?? 1),
    );
    if (!current) {
      matchesWithoutInnings += 1;
      continue;
    }
    /** @type {Record<string, unknown>} */
    const patch = {};
    const held =
      typeof current.last_ball_seq === "number" ? current.last_ball_seq : null;
    if (seq !== null && (held === null || held < seq)) {
      patch.last_ball_seq = seq;
    }
    if (ids.length) {
      const merged = mergeActionIds(ids, current.recent_client_actions);
      if (!sameIds(merged, current.recent_client_actions ?? [])) {
        patch.recent_client_actions = merged;
      }
    }
    if (Object.keys(patch).length)
      updates.push({ id: current.id, data: patch });
  }
  return { updates, matchesWithoutInnings };
}
