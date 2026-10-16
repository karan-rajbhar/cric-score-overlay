/**
 * Schema stage 2, as a pure plan over plain documents so it can be unit
 * tested and reused for the seed data (see src/lib/firebase/scorecard.ts for
 * the storage it produces; src/lib/firebase/stage2.test.ts checks the two
 * agree):
 *
 * 1. Each innings gets its scorecard: `batting`, `bowling`,
 *    `fall_of_wickets` and `partnerships` arrays (the rows of the former
 *    collections without `id` / `match_id` / `innings_id` / timestamps),
 *    plus `last_ball` and `last_over_bowler_id`.
 * 2. `ball_by_ball` becomes one `overs/{inningsId}_{overNumber}` document
 *    per over ({ match_id, innings_id, over_number, balls }).
 * 3. `player_matches/{matchId}_{userId}` records are built from the
 *    completed innings.
 * 4. Optionally (`deleteOld`), the legacy row documents are deleted.
 *
 * Idempotent: planning again after applying yields an empty plan. An
 * innings whose over documents hold balls the legacy log does not (the new
 * scoring engine already recorded deliveries there) is left alone and
 * reported as a conflict.
 */

/** @typedef {{ id: string } & Record<string, any>} Doc */

export const LEGACY_COLLECTIONS = /** @type {const} */ ([
  "batting_performances",
  "bowling_performances",
  "fall_of_wickets",
  "partnerships",
  "ball_by_ball",
]);

const ROW_KEYS = ["id", "match_id", "innings_id", "created_at", "updated_at"];
const BALL_KEYS = ["match_id", "innings_id", "over_number"];

/**
 * @param {Doc} row
 * @param {string[]} keys
 */
function omit(row, keys) {
  /** @type {Record<string, any>} */
  const out = {};
  for (const [k, v] of Object.entries(row)) {
    if (keys.includes(k)) continue;
    out[k] = v === undefined ? null : v;
  }
  return out;
}

/** @param {Doc} a @param {Doc} b */
const bySeq = (a, b) => (a.seq ?? 0) - (b.seq ?? 0);

/** @param {unknown} value */
export function canonical(value) {
  return JSON.stringify(value, (_k, v) => {
    if (v && typeof v === "object" && !Array.isArray(v)) {
      /** @type {Record<string, unknown>} */
      const out = {};
      for (const k of Object.keys(v).sort())
        out[k] = v[k] === undefined ? null : v[k];
      return out;
    }
    return v;
  });
}

/** @param {Doc} doc */
function withoutVolatile(doc) {
  /** @type {Record<string, any>} */
  const copy = { ...doc };
  delete copy.updated_at;
  delete copy.id;
  return copy;
}

/** Equal ignoring `id` / `updated_at` and key order. */
function sameDoc(/** @type {Doc} */ a, /** @type {Doc} */ b) {
  return canonical(withoutVolatile(a)) === canonical(withoutVolatile(b));
}

/** @param {Doc} m */
function ballsPerOver(m) {
  return m?.balls_per_over && m.balls_per_over > 0 ? m.balls_per_over : 6;
}

/**
 * Bowler of the over before the current one (see `lastOverBowlerOf` in
 * scorecard.ts).
 * @param {Doc[]} balls
 * @param {number} totalBalls
 * @param {number} bpo
 */
export function lastOverBowlerOf(balls, totalBalls, bpo) {
  const current = Math.floor(totalBalls / bpo);
  if (current <= 0) return null;
  const previous = balls.filter((b) => b.over_number === current - 1);
  const ending = previous.filter((b) => b.ball_number === bpo);
  const pool = ending.length ? ending : previous;
  if (!pool.length) return null;
  const last = [...pool].sort(bySeq)[pool.length - 1];
  return last?.bowler_id ?? null;
}

/** @param {string} id @param {string} marker */
function suffixNumber(id, marker) {
  const m = new RegExp(`${marker}(\\d+)$`).exec(String(id));
  return m ? Number(m[1]) : null;
}

/**
 * The stage 2 innings fields from legacy rows.
 * @param {Doc} innings
 * @param {Doc} match
 * @param {{ batting: Doc[], bowling: Doc[], fallOfWickets: Doc[], partnerships: Doc[], balls: Doc[] }} rows
 */
export function inningsScorecard(innings, match, rows) {
  const balls = [...rows.balls].sort(bySeq);
  const last = balls.length ? balls[balls.length - 1] : null;
  const batting = [...rows.batting].sort(
    (a, b) =>
      (a.batting_position ?? 0) - (b.batting_position ?? 0) ||
      String(a.user_id).localeCompare(String(b.user_id)),
  );
  const bowling = [...rows.bowling].sort(
    (a, b) =>
      String(a.created_at ?? "").localeCompare(String(b.created_at ?? "")) ||
      String(a.id).localeCompare(String(b.id)),
  );
  const fow = [...rows.fallOfWickets].sort(
    (a, b) => (a.wicket_number ?? 0) - (b.wicket_number ?? 0),
  );
  // Partnership ids are `${inningsId}_p${n}` in creation order; the array
  // index must keep that order.
  const partnerships = [...rows.partnerships].sort((a, b) => {
    const na = suffixNumber(a.id, "_p");
    const nb = suffixNumber(b.id, "_p");
    if (na !== null && nb !== null) return na - nb;
    return (
      (a.start_over ?? 0) - (b.start_over ?? 0) ||
      Number(Boolean(a.is_current)) - Number(Boolean(b.is_current)) ||
      String(a.created_at ?? "").localeCompare(String(b.created_at ?? ""))
    );
  });
  return {
    batting: batting.map((r) => omit(r, ROW_KEYS)),
    bowling: bowling.map((r) => omit(r, ROW_KEYS)),
    fall_of_wickets: fow.map((r) => omit(r, ROW_KEYS)),
    partnerships: partnerships.map((r) => omit(r, ROW_KEYS)),
    last_ball: last
      ? { ...omit(last, BALL_KEYS), over_number: last.over_number }
      : null,
    last_over_bowler_id: lastOverBowlerOf(
      balls,
      innings.total_balls ?? 0,
      ballsPerOver(match),
    ),
  };
}

/**
 * Over documents for one innings' legacy balls.
 * @param {Doc} innings
 * @param {Doc[]} balls
 * @param {string} now
 * @returns {Doc[]}
 */
export function oversOf(innings, balls, now) {
  /** @type {Map<number, Doc[]>} */
  const byOver = new Map();
  for (const b of balls) {
    const list = byOver.get(b.over_number) ?? [];
    list.push(b);
    byOver.set(b.over_number, list);
  }
  return [...byOver.entries()]
    .sort(([a], [b]) => a - b)
    .map(([overNumber, list]) => ({
      id: `${innings.id}_${overNumber}`,
      match_id: innings.match_id,
      innings_id: innings.id,
      over_number: overNumber,
      balls: [...list].sort(bySeq).map((b) => omit(b, BALL_KEYS)),
      updated_at: now,
    }));
}

/**
 * `player_matches` documents for a match (see `playerMatchDocs` in
 * scorecard.ts).
 * @param {Doc} match
 * @param {Doc[]} innings innings with their stage 2 fields
 * @param {string} now
 * @returns {Doc[]}
 */
export function playerMatchDocs(match, innings, now) {
  /** @type {Map<string, Doc>} */
  const docs = new Map();
  /** @param {string} userId */
  const docOf = (userId) => {
    let doc = docs.get(userId);
    if (!doc) {
      doc = {
        id: `${match.id}_${userId}`,
        user_id: userId,
        match_id: match.id,
        tournament_id: match.tournament_id ?? null,
        club_id: match.club_id ?? null,
        season_id: match.season_id ?? null,
        match_date: match.scheduled_at ?? match.created_at ?? null,
        batting: [],
        bowling: [],
        fielding: { catches: 0, stumpings: 0, run_outs: 0 },
        updated_at: now,
      };
      docs.set(userId, doc);
    }
    return doc;
  };
  const completed = innings
    .filter((i) => i.is_completed)
    .sort((a, b) => a.innings_number - b.innings_number);
  for (const inn of completed) {
    const tag = { innings_id: inn.id, innings_number: inn.innings_number };
    for (const e of inn.batting ?? [])
      docOf(e.user_id).batting.push({ ...e, ...tag });
    for (const e of inn.bowling ?? [])
      docOf(e.user_id).bowling.push({ ...e, ...tag });
    for (const f of inn.fall_of_wickets ?? []) {
      if (!f.fielder_id) continue;
      const key =
        f.dismissal_type === "caught"
          ? "catches"
          : f.dismissal_type === "stumped"
            ? "stumpings"
            : f.dismissal_type === "run_out"
              ? "run_outs"
              : null;
      if (key) docOf(f.fielder_id).fielding[key] += 1;
    }
  }
  return [...docs.values()];
}

/**
 * @typedef {object} Stage2Input
 * @property {Doc[]} matches
 * @property {Doc[]} innings
 * @property {Doc[]} battingPerformances
 * @property {Doc[]} bowlingPerformances
 * @property {Doc[]} fallOfWickets
 * @property {Doc[]} partnerships
 * @property {Doc[]} balls ball_by_ball documents
 * @property {Doc[]} overs existing over documents
 * @property {Doc[]} playerMatches existing player_matches documents
 */

/**
 * @typedef {object} Stage2Plan
 * @property {Array<{ id: string, data: Record<string, any> }>} inningsPatches merge into innings
 * @property {Doc[]} overWrites over documents to set
 * @property {string[]} overDeletes
 * @property {Doc[]} playerMatchWrites
 * @property {string[]} playerMatchDeletes
 * @property {Record<string, string[]>} legacyDeletes ids per legacy collection
 * @property {string[]} conflicts innings left alone (already scored on the new storage)
 * @property {string[]} orphans legacy rows whose innings does not exist ("collection/id")
 */

/**
 * @param {Stage2Input} input
 * @param {{ now?: string, deleteOld?: boolean }} [options]
 * @returns {Stage2Plan}
 */
export function planStage2(input, options = {}) {
  const now = options.now ?? new Date().toISOString();
  /** @type {Stage2Plan} */
  const plan = {
    inningsPatches: [],
    overWrites: [],
    overDeletes: [],
    playerMatchWrites: [],
    playerMatchDeletes: [],
    legacyDeletes: Object.fromEntries(LEGACY_COLLECTIONS.map((c) => [c, []])),
    conflicts: [],
    orphans: [],
  };
  const matchesById = new Map(input.matches.map((m) => [m.id, m]));
  const inningsById = new Map(input.innings.map((i) => [i.id, i]));

  /** @param {Doc[]} docs @param {string} field */
  const groupBy = (docs, field) => {
    /** @type {Map<string, Doc[]>} */
    const out = new Map();
    for (const d of docs) {
      const key = d[field];
      const list = out.get(key) ?? [];
      list.push(d);
      out.set(key, list);
    }
    return out;
  };
  const legacy = {
    batting_performances: groupBy(input.battingPerformances, "innings_id"),
    bowling_performances: groupBy(input.bowlingPerformances, "innings_id"),
    fall_of_wickets: groupBy(input.fallOfWickets, "innings_id"),
    partnerships: groupBy(input.partnerships, "innings_id"),
    ball_by_ball: groupBy(input.balls, "innings_id"),
  };
  const oversByInnings = groupBy(input.overs, "innings_id");

  // Orphans: legacy rows of innings that no longer exist.
  for (const name of LEGACY_COLLECTIONS) {
    for (const [inningsId, rows] of legacy[name]) {
      if (inningsById.has(inningsId)) continue;
      for (const r of rows) plan.orphans.push(`${name}/${r.id}`);
    }
  }

  /** innings as they will be stored, for player_matches */
  /** @type {Map<string, Doc>} */
  const finalInnings = new Map();
  const skipped = new Set();

  for (const inn of input.innings) {
    const rows = {
      batting: legacy.batting_performances.get(inn.id) ?? [],
      bowling: legacy.bowling_performances.get(inn.id) ?? [],
      fallOfWickets: legacy.fall_of_wickets.get(inn.id) ?? [],
      partnerships: legacy.partnerships.get(inn.id) ?? [],
      balls: legacy.ball_by_ball.get(inn.id) ?? [],
    };
    const hasLegacy =
      rows.batting.length +
        rows.bowling.length +
        rows.fallOfWickets.length +
        rows.partnerships.length +
        rows.balls.length >
      0;
    const migrated = Array.isArray(inn.batting);
    const storedOvers = oversByInnings.get(inn.id) ?? [];
    if (!hasLegacy && migrated) {
      finalInnings.set(inn.id, inn);
      continue;
    }
    const legacyBallIds = new Set(rows.balls.map((b) => b.id));
    const newerBalls = storedOvers.some((o) =>
      (o.balls ?? []).some((/** @type {Doc} */ b) => !legacyBallIds.has(b.id)),
    );
    if (newerBalls) {
      plan.conflicts.push(inn.id);
      skipped.add(inn.id);
      finalInnings.set(inn.id, inn);
      continue;
    }

    const wanted = oversOf(inn, rows.balls, now);
    const stored = new Map(storedOvers.map((o) => [o.id, o]));
    // Already migrated and the ball log has not moved on since: keep the
    // stored scorecard (it may hold newer crease / bowler selections).
    const sameLog =
      wanted.length === storedOvers.length &&
      wanted.every((o) => {
        const prev = stored.get(o.id);
        return !!prev && sameDoc(prev, o);
      });
    if (migrated && sameLog) {
      finalInnings.set(inn.id, inn);
      continue;
    }

    const match = matchesById.get(inn.match_id) ?? { id: inn.match_id };
    const fields = inningsScorecard(inn, match, rows);
    const current = Object.fromEntries(
      Object.keys(fields).map((k) => [k, inn[k]]),
    );
    if (!migrated || canonical(current) !== canonical(fields)) {
      plan.inningsPatches.push({ id: inn.id, data: fields });
    }
    finalInnings.set(inn.id, { ...inn, ...fields });

    for (const over of wanted) {
      const prev = stored.get(over.id);
      stored.delete(over.id);
      if (!prev || !sameDoc(prev, over)) plan.overWrites.push(over);
    }
    // Over documents the legacy log no longer has balls for are stale.
    for (const id of stored.keys()) plan.overDeletes.push(id);
  }

  // player_matches for every match whose innings we know.
  const existingByMatch = groupBy(input.playerMatches, "match_id");
  const inningsByMatch = groupBy([...finalInnings.values()], "match_id");
  for (const [matchId, list] of inningsByMatch) {
    const match = matchesById.get(matchId);
    if (!match) continue;
    if (list.some((i) => skipped.has(i.id))) continue;
    const existing = new Map(
      (existingByMatch.get(matchId) ?? []).map((d) => [d.id, d]),
    );
    for (const doc of playerMatchDocs(match, list, now)) {
      const prev = existing.get(doc.id);
      existing.delete(doc.id);
      if (!prev || !sameDoc(prev, doc)) plan.playerMatchWrites.push(doc);
    }
    for (const id of existing.keys()) plan.playerMatchDeletes.push(id);
  }

  if (options.deleteOld) {
    for (const name of LEGACY_COLLECTIONS) {
      for (const [inningsId, rows] of legacy[name]) {
        if (skipped.has(inningsId)) continue;
        for (const r of rows) plan.legacyDeletes[name]?.push(r.id);
      }
    }
  }
  return plan;
}

/** @param {Stage2Plan} plan */
export function planWrites(plan) {
  return (
    plan.inningsPatches.length +
    plan.overWrites.length +
    plan.overDeletes.length +
    plan.playerMatchWrites.length +
    plan.playerMatchDeletes.length +
    Object.values(plan.legacyDeletes).reduce((n, ids) => n + ids.length, 0)
  );
}

/**
 * Applies a plan to in-memory collections ({ innings: Doc[], ... }),
 * returning new collections. Used for the seed data and tests.
 *
 * @param {Record<string, Doc[]>} data
 * @param {Stage2Plan} plan
 * @returns {Record<string, Doc[]>}
 */
export function applyStage2(data, plan) {
  /** @type {Record<string, Doc[]>} */
  const out = {};
  for (const [name, docs] of Object.entries(data)) {
    out[name] = docs.map((d) => ({ ...d }));
  }
  const patches = new Map(plan.inningsPatches.map((p) => [p.id, p.data]));
  out.innings = (out.innings ?? []).map((i) =>
    patches.has(i.id) ? { ...i, ...patches.get(i.id) } : i,
  );

  /** @param {string} name @param {Doc[]} writes @param {string[]} deletes */
  const upsert = (name, writes, deletes) => {
    const byId = new Map((out[name] ?? []).map((d) => [d.id, d]));
    for (const w of writes) byId.set(w.id, w);
    for (const id of deletes) byId.delete(id);
    out[name] = [...byId.values()];
  };
  upsert("overs", plan.overWrites, plan.overDeletes);
  upsert("player_matches", plan.playerMatchWrites, plan.playerMatchDeletes);

  for (const name of LEGACY_COLLECTIONS) {
    const drop = new Set(plan.legacyDeletes[name]);
    if (!drop.size) continue;
    const remaining = (out[name] ?? []).filter((d) => !drop.has(d.id));
    if (remaining.length) out[name] = remaining;
    else delete out[name];
  }
  return out;
}

/**
 * Convenience for in-memory collections keyed by collection name.
 * @param {Record<string, Doc[]>} data
 * @param {{ now?: string, deleteOld?: boolean }} [options]
 */
export function planStage2For(data, options) {
  return planStage2(
    {
      matches: data.matches ?? [],
      innings: data.innings ?? [],
      battingPerformances: data.batting_performances ?? [],
      bowlingPerformances: data.bowling_performances ?? [],
      fallOfWickets: data.fall_of_wickets ?? [],
      partnerships: data.partnerships ?? [],
      balls: data.ball_by_ball ?? [],
      overs: data.overs ?? [],
      playerMatches: data.player_matches ?? [],
    },
    options,
  );
}
