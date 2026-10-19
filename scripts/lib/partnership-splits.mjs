/**
 * Each batter's share of a stand, as a pure plan over plain documents (used
 * by scripts/migrate-partnership-splits.mjs and the seed; tested in
 * src/lib/firebase/partnership-splits.test.ts against the scoring engine).
 *
 * Stands (`innings.partnerships`) now keep `batsman1_runs` /
 * `batsman1_balls` / `batsman2_runs` / `batsman2_balls`: the runs credited
 * to each batter and the balls each faced in the stand, by the batting
 * card's rules. Stands recorded before have none (the scorecard shows their
 * names and total only). This rebuilds them from the innings' ball log the
 * way `recomputeInnings` (src/lib/firebase/scoring/recompute.ts) builds
 * stands, and keeps the result only when it gives back the stored stands
 * exactly (same pairs, runs and balls): an innings whose log does not is
 * left alone and reported.
 *
 * Idempotent: planning again after applying yields an empty plan.
 */

/** @typedef {{ id: string } & Record<string, any>} Doc */

export const SPLIT_FIELDS = /** @type {const} */ ([
  "batsman1_runs",
  "batsman1_balls",
  "batsman2_runs",
  "batsman2_balls",
]);

/**
 * Mirrors `isLegalDelivery` in src/lib/firebase/scoring/recompute.ts.
 * @param {Doc} ball
 */
export function isLegalDelivery(ball) {
  if (!ball.bowler_id) return false;
  const t = ball.extra_type;
  return !(t === "wide" || t === "no_ball" || t === "penalty" || t === "bonus");
}

/** @param {unknown} a @param {unknown} b */
const pairKey = (a, b) => [a ?? "", b ?? ""].sort().join("|");

/**
 * Whether an innings has a stand without both shares.
 * @param {Doc} innings
 */
export function needsSplits(innings) {
  return (
    Array.isArray(innings.partnerships) &&
    innings.partnerships.some(
      (/** @type {Doc} */ p) =>
        p.batsman1_runs == null || p.batsman2_runs == null,
    )
  );
}

/**
 * The innings' ball log from its over documents, in `seq` order (as
 * `ballLogOf` in src/lib/firebase/scorecard.ts).
 * @param {Doc[]} overs
 */
export function ballLogOfOvers(overs) {
  return [...overs]
    .sort((a, b) => (a.over_number ?? 0) - (b.over_number ?? 0))
    .flatMap((o) => (o.balls ?? []).map((/** @type {Doc} */ b) => ({ ...b })))
    .sort((a, b) => (a.seq ?? 0) - (b.seq ?? 0));
}

/**
 * `stands` with each batter's share, rebuilt from `balls` (the innings' ball
 * log in `seq` order) by the engine's rules, or null when the log does not
 * give back the stored stands exactly.
 *
 * @param {Record<string, any>} match  its crediting settings
 *   (`wide_runs_to_batsman`, `noball_extras_to_batsman`,
 *   `wide_counts_as_ball_faced`)
 * @param {Doc[]} stands
 * @param {Doc[]} balls
 * @returns {Doc[] | null}
 */
export function standsWithSplits(match, stands, balls) {
  /** @type {Array<{ a: string, b: string, runs: number, balls: number, share: Map<string, { runs: number, balls: number }> }>} */
  const rebuilt = [];
  /** @type {(typeof rebuilt)[number] | null} */
  let current = null;
  for (const ball of balls) {
    // Penalty runs: the team's, nobody's share, no effect on a stand.
    if (ball.penalty_team_id) continue;
    const legal = isLegalDelivery(ball);
    const runs = ball.runs_scored ?? 0;
    const extras = ball.extras ?? 0;
    if (ball.batsman_id && ball.non_striker_id) {
      if (
        !current ||
        pairKey(current.a, current.b) !==
          pairKey(ball.batsman_id, ball.non_striker_id)
      ) {
        current = {
          a: ball.batsman_id,
          b: ball.non_striker_id,
          runs: 0,
          balls: 0,
          share: new Map([
            [ball.batsman_id, { runs: 0, balls: 0 }],
            [ball.non_striker_id, { runs: 0, balls: 0 }],
          ]),
        };
        rebuilt.push(current);
      }
      current.runs += runs + extras;
      current.balls += legal ? 1 : 0;
      let credited = runs;
      if (ball.extra_type === "wide" && match.wide_runs_to_batsman)
        credited += extras;
      if (ball.extra_type === "no_ball" && match.noball_extras_to_batsman)
        credited += extras;
      const faced =
        legal ||
        (ball.extra_type === "wide" &&
          Boolean(match.wide_counts_as_ball_faced));
      const mine = current.share.get(ball.batsman_id);
      if (mine) {
        mine.runs += credited;
        mine.balls += faced ? 1 : 0;
      }
    }
    // Any wicket entry closes the stand (a retirement too).
    if (ball.is_wicket) current = null;
  }

  if (rebuilt.length !== stands.length) return null;
  /** @type {Doc[]} */
  const out = [];
  for (let i = 0; i < stands.length; i += 1) {
    const stored = stands[i];
    const r = rebuilt[i];
    if (!stored || !r) return null;
    if (
      pairKey(stored.batsman1_id, stored.batsman2_id) !== pairKey(r.a, r.b) ||
      (stored.runs ?? 0) !== r.runs ||
      (stored.balls ?? 0) !== r.balls
    ) {
      return null;
    }
    const one = r.share.get(stored.batsman1_id);
    const two = r.share.get(stored.batsman2_id);
    if (!one || !two) return null;
    out.push({
      ...stored,
      batsman1_runs: one.runs,
      batsman1_balls: one.balls,
      batsman2_runs: two.runs,
      batsman2_balls: two.balls,
    });
  }
  return out;
}

/**
 * @param {{ matches: Doc[], innings: Doc[], overs: Doc[] }} input  the
 *   matches' crediting settings, the innings (with `match_id` and
 *   `partnerships`) and the over documents of the innings that need shares
 * @returns {{ updates: Array<{ id: string, partnerships: Doc[] }>, mismatched: string[] }}
 */
export function planPartnershipSplits({ matches, innings, overs }) {
  const matchById = new Map(matches.map((m) => [m.id, m]));
  /** @type {Map<string, Doc[]>} */
  const oversByInnings = new Map();
  for (const o of overs) {
    const list = oversByInnings.get(o.innings_id) ?? [];
    list.push(o);
    oversByInnings.set(o.innings_id, list);
  }
  /** @type {Array<{ id: string, partnerships: Doc[] }>} */
  const updates = [];
  /** @type {string[]} */
  const mismatched = [];
  for (const inn of innings) {
    if (!needsSplits(inn)) continue;
    const match = matchById.get(inn.match_id);
    const stands = match
      ? standsWithSplits(
          match,
          inn.partnerships,
          ballLogOfOvers(oversByInnings.get(inn.id) ?? []),
        )
      : null;
    if (stands) updates.push({ id: inn.id, partnerships: stands });
    else mismatched.push(inn.id);
  }
  return { updates, mismatched };
}
