/**
 * Player statistics accumulators (schema stage 3), shared by the app, the
 * migration and the seed transform.
 *
 * An accumulator is a pure function of a set of `player_matches` documents
 * (one player's completed innings in some scope). It holds sums, which add
 * and subtract exactly, plus the best innings / best spell and how many
 * records tie it exactly, so a record can be removed without re-reading
 * the others unless it was the only best one (then the caller rebuilds the
 * accumulator from the player's records).
 *
 * Stored in:
 * - `player_career_stats/{userId}`: `acc` (all of the player's records)
 *   plus the legacy summary columns derived from it;
 * - `leaderboards/{scope}_{scopeId}` (`tournament_<id>`, `club_<id>`):
 *   `players: { [userId]: acc + name + avatar_url }` for every player with
 *   a record in that tournament / club.
 *
 * `leaderboard.ts` turns accumulators into the leaderboard rows, so pages
 * and these documents share one definition of every figure.
 */

/** @typedef {{ r: number, no: boolean, b: number, f4: number, f6: number, n: number }} BestInnings */
/** @typedef {{ w: number, r: number, b: number, n: number }} BestSpell */
/**
 * @typedef {{
 *   m: number,
 *   bi: number, no: number, r: number, b: number, f4: number, f6: number,
 *   c100: number, c50: number, bp: number, hs: BestInnings | null,
 *   wi: number, wb: number, md: number, rc: number, w: number,
 *   w3: number, w5: number, wp: number, bb: BestSpell | null,
 *   ct: number, st: number, ro: number,
 * }} StatsAcc
 */
/** @typedef {{ r: number, no: boolean, b: number, f4: number, f6: number }} BatLine */
/** @typedef {{ w: number, r: number, b: number, md: number }} BowlLine */
/**
 * @typedef {{
 *   id?: string, user_id: string, match_id?: string,
 *   tournament_id?: string | null, club_id?: string | null,
 *   batting?: Record<string, any>[] | null,
 *   bowling?: Record<string, any>[] | null,
 *   fielding?: { catches?: number, stumpings?: number, run_outs?: number } | null,
 * }} PlayerMatchLike
 */

/** @returns {StatsAcc} */
export function emptyAcc() {
  return {
    m: 0,
    bi: 0,
    no: 0,
    r: 0,
    b: 0,
    f4: 0,
    f6: 0,
    c100: 0,
    c50: 0,
    bp: 0,
    hs: null,
    wi: 0,
    wb: 0,
    md: 0,
    rc: 0,
    w: 0,
    w3: 0,
    w5: 0,
    wp: 0,
    bb: null,
    ct: 0,
    st: 0,
    ro: 0,
  };
}

/** @param {unknown} v */
const num = (v) => (typeof v === "number" && Number.isFinite(v) ? v : 0);

/**
 * Legal deliveries from balls, else from overs notation (3.4 = 22).
 * @param {unknown} balls
 * @param {unknown} overs
 */
export function legalDeliveries(balls, overs) {
  const b = num(balls);
  if (b > 0) return b;
  const o = num(overs);
  if (o > 0) {
    const full = Math.floor(o);
    return full * 6 + Math.round((o - full) * 10);
  }
  return 0;
}

/**
 * @param {Record<string, any>} e a batting entry / row
 * @returns {BatLine}
 */
export function batLine(e) {
  return {
    r: num(e.runs_scored),
    no: !e.is_out,
    b: num(e.balls_faced),
    f4: num(e.fours),
    f6: num(e.sixes),
  };
}

/**
 * @param {Record<string, any>} e a bowling entry / row
 * @returns {BowlLine}
 */
export function bowlLine(e) {
  return {
    w: num(e.wickets_taken),
    r: num(e.runs_conceded),
    b: legalDeliveries(e.balls_bowled, e.overs_bowled),
    md: num(e.maidens),
  };
}

/** MVP points for one innings. @param {BatLine} l */
export function battingPoints(l) {
  let pts = l.r + l.f4 + l.f6 * 2;
  if (l.r >= 100) pts += 30;
  else if (l.r >= 50) pts += 15;
  else if (l.r >= 30) pts += 5;
  if (l.b >= 10) {
    const sr = (l.r / l.b) * 100;
    if (sr >= 200) pts += 12;
    else if (sr >= 150) pts += 6;
    else if (sr < 80) pts -= 4;
  }
  if (l.no && l.r >= 20) pts += 5;
  return pts;
}

/** MVP points for one spell. @param {BowlLine} l */
export function bowlingPoints(l) {
  let pts = l.w * 25;
  if (l.w >= 5) pts += 30;
  else if (l.w >= 3) pts += 15;
  pts += l.md * 12;
  if (l.b >= 12) {
    const econ = (l.r / l.b) * 6;
    if (econ < 5.0) pts += 15;
    else if (econ < 6.5) pts += 8;
    else if (econ > 10.0) pts -= 6;
  }
  return pts;
}

/** Fielding MVP points. @param {{ ct: number, st: number, ro: number }} a */
export function fieldingPoints(a) {
  return a.ct * 10 + (a.st + a.ro) * 15;
}

/**
 * Orders innings: more runs, then not out, then fewer balls (0 balls
 * last), then more fours, more sixes. 0 means identical.
 * @param {Omit<BestInnings, "n">} a
 * @param {Omit<BestInnings, "n">} b
 * @returns {number} > 0 when `a` is better
 */
export function compareInnings(a, b) {
  if (a.r !== b.r) return a.r - b.r;
  if (a.no !== b.no) return a.no ? 1 : -1;
  const ab = a.b > 0 ? a.b : Infinity;
  const bb = b.b > 0 ? b.b : Infinity;
  if (ab !== bb) return ab < bb ? 1 : -1;
  if (a.f4 !== b.f4) return a.f4 - b.f4;
  return a.f6 - b.f6;
}

/**
 * Orders spells: more wickets, then fewer runs, then fewer balls.
 * @param {Omit<BestSpell, "n">} a
 * @param {Omit<BestSpell, "n">} b
 * @returns {number} > 0 when `a` is better
 */
export function compareSpells(a, b) {
  if (a.w !== b.w) return a.w - b.w;
  if (a.r !== b.r) return b.r - a.r;
  return b.b - a.b;
}

/**
 * Adds (sign 1) or removes (sign -1) one innings. Returns false when the
 * removed innings was the only best one: the accumulator must then be
 * rebuilt from the player's records.
 * @param {StatsAcc} acc
 * @param {BatLine} l
 * @param {1 | -1} sign
 */
export function applyBatting(acc, l, sign) {
  acc.bi += sign;
  acc.no += sign * (l.no ? 1 : 0);
  acc.r += sign * l.r;
  acc.b += sign * l.b;
  acc.f4 += sign * l.f4;
  acc.f6 += sign * l.f6;
  if (l.r >= 100) acc.c100 += sign;
  else if (l.r >= 50) acc.c50 += sign;
  acc.bp += sign * battingPoints(l);
  const line = { r: l.r, no: l.no, b: l.b, f4: l.f4, f6: l.f6 };
  if (sign > 0) {
    const c = acc.hs ? compareInnings(line, acc.hs) : 1;
    if (c > 0) acc.hs = { ...line, n: 1 };
    else if (c === 0 && acc.hs) acc.hs.n += 1;
    return true;
  }
  if (acc.hs && compareInnings(line, acc.hs) === 0) {
    acc.hs.n -= 1;
    if (acc.hs.n <= 0) {
      acc.hs = null;
      return acc.bi === 0;
    }
  }
  return true;
}

/**
 * Bowling counterpart of {@link applyBatting}.
 * @param {StatsAcc} acc
 * @param {BowlLine} l
 * @param {1 | -1} sign
 */
export function applyBowling(acc, l, sign) {
  acc.wi += sign;
  acc.wb += sign * l.b;
  acc.md += sign * l.md;
  acc.rc += sign * l.r;
  acc.w += sign * l.w;
  if (l.w >= 5) acc.w5 += sign;
  else if (l.w >= 3) acc.w3 += sign;
  acc.wp += sign * bowlingPoints(l);
  const spell = { w: l.w, r: l.r, b: l.b };
  if (sign > 0) {
    const c = acc.bb ? compareSpells(spell, acc.bb) : 1;
    if (c > 0) acc.bb = { ...spell, n: 1 };
    else if (c === 0 && acc.bb) acc.bb.n += 1;
    return true;
  }
  if (acc.bb && compareSpells(spell, acc.bb) === 0) {
    acc.bb.n -= 1;
    if (acc.bb.n <= 0) {
      acc.bb = null;
      return acc.wi === 0;
    }
  }
  return true;
}

/**
 * @param {StatsAcc} acc
 * @param {PlayerMatchLike["fielding"]} f
 * @param {1 | -1} sign
 */
export function applyFielding(acc, f, sign) {
  acc.ct += sign * num(f?.catches);
  acc.st += sign * num(f?.stumpings);
  acc.ro += sign * num(f?.run_outs);
}

/**
 * Adds or removes a whole player_matches document. Returns false when the
 * accumulator must be rebuilt.
 * @param {StatsAcc} acc
 * @param {PlayerMatchLike} pm
 * @param {1 | -1} sign
 */
export function applyPlayerMatch(acc, pm, sign) {
  let ok = true;
  acc.m += sign;
  for (const e of pm.batting ?? [])
    ok = applyBatting(acc, batLine(e), sign) && ok;
  for (const e of pm.bowling ?? [])
    ok = applyBowling(acc, bowlLine(e), sign) && ok;
  applyFielding(acc, pm.fielding, sign);
  return ok;
}

/** @param {Record<string, any>} e */
const lineKey = (e) => String(e.innings_id ?? "");

/**
 * Replaces `before` with `after` (either may be null) in `acc`, touching
 * only the innings that differ. Returns false when a rebuild is needed.
 * @param {StatsAcc} acc
 * @param {PlayerMatchLike | null} before
 * @param {PlayerMatchLike | null} after
 */
export function replacePlayerMatch(acc, before, after) {
  if (before && !after) return applyPlayerMatch(acc, before, -1);
  if (!before && after) return applyPlayerMatch(acc, after, 1);
  if (!before || !after) return true;
  let ok = true;
  /**
   * @template L
   * @param {Record<string, any>[]} prev
   * @param {Record<string, any>[]} next
   * @param {(e: Record<string, any>) => L} toLine
   * @param {(acc: StatsAcc, l: L, sign: 1 | -1) => boolean} apply
   */
  const diff = (prev, next, toLine, apply) => {
    const was = new Map(
      prev.map((e) => [lineKey(e), JSON.stringify(toLine(e))]),
    );
    const now = new Map(
      next.map((e) => [lineKey(e), JSON.stringify(toLine(e))]),
    );
    for (const e of prev) {
      if (now.get(lineKey(e)) !== was.get(lineKey(e)))
        ok = apply(acc, toLine(e), -1) && ok;
    }
    for (const e of next) {
      if (was.get(lineKey(e)) !== now.get(lineKey(e)))
        ok = apply(acc, toLine(e), 1) && ok;
    }
  };
  diff(before.batting ?? [], after.batting ?? [], batLine, applyBatting);
  diff(before.bowling ?? [], after.bowling ?? [], bowlLine, applyBowling);
  applyFielding(acc, before.fielding, -1);
  applyFielding(acc, after.fielding, 1);
  return ok;
}

/**
 * The accumulator of a set of documents (the rebuild).
 * @param {PlayerMatchLike[]} pms
 * @returns {StatsAcc}
 */
export function accOf(pms) {
  const acc = emptyAcc();
  for (const pm of pms) applyPlayerMatch(acc, pm, 1);
  return acc;
}

// ---------------------------------------------------------------------------
// Scopes and documents
// ---------------------------------------------------------------------------

export const CAREER_COLLECTION = "player_career_stats";
export const LEADERBOARDS_COLLECTION = "leaderboards";

/** Scope fields of player_matches with a leaderboard, in key order. */
export const SCOPES = /** @type {const} */ ([
  ["tournament", "tournament_id"],
  ["club", "club_id"],
]);

/** @param {string} scope @param {string} scopeId */
export function leaderboardId(scope, scopeId) {
  return `${scope}_${scopeId}`;
}

/**
 * Leaderboard ids a document counts towards.
 * @param {PlayerMatchLike | null | undefined} pm
 * @returns {string[]}
 */
export function scopeKeysOf(pm) {
  if (!pm) return [];
  /** @type {string[]} */
  const out = [];
  for (const [scope, field] of SCOPES) {
    const id = pm[field];
    if (typeof id === "string" && id) out.push(leaderboardId(scope, id));
  }
  return out;
}

/** @param {number} n */
const round2 = (n) => Math.round(n * 100) / 100;

/**
 * `player_career_stats/{userId}`: the accumulator plus the summary columns
 * the player page reads.
 * @param {string} userId
 * @param {StatsAcc} acc
 * @param {string} now
 */
export function careerDocOf(userId, acc, now) {
  const outs = acc.bi - acc.no;
  return {
    id: userId,
    user_id: userId,
    total_matches: acc.m,
    total_innings_batted: acc.bi,
    total_runs: acc.r,
    total_balls_faced: acc.b,
    total_fours: acc.f4,
    total_sixes: acc.f6,
    highest_score: acc.hs ? acc.hs.r : 0,
    not_outs: acc.no,
    centuries: acc.c100,
    half_centuries: acc.c50,
    total_innings_bowled: acc.wi,
    total_overs_bowled: Math.floor(acc.wb / 6) + (acc.wb % 6) / 10,
    total_balls_bowled: acc.wb,
    total_runs_conceded: acc.rc,
    total_wickets: acc.w,
    best_bowling_figures: acc.bb ? `${acc.bb.w}/${acc.bb.r}` : null,
    five_wicket_hauls: acc.w5,
    total_catches: acc.ct,
    total_stumpings: acc.st,
    total_run_outs: acc.ro,
    batting_average: outs > 0 ? round2(acc.r / outs) : null,
    strike_rate: acc.b > 0 ? round2((acc.r / acc.b) * 100) : null,
    bowling_average: acc.w > 0 ? round2(acc.rc / acc.w) : null,
    economy_rate: acc.wb > 0 ? round2(acc.rc / (acc.wb / 6)) : null,
    acc,
    last_updated: now,
  };
}

/**
 * @typedef {StatsAcc & { name: string | null, avatar_url: string | null }} BoardPlayer
 */

/**
 * `leaderboards/{id}` for a scope.
 * @param {string} id
 * @param {Record<string, BoardPlayer>} players
 * @param {string} now
 */
export function leaderboardDocOf(id, players, now) {
  const cut = id.indexOf("_");
  return {
    id,
    scope: id.slice(0, cut),
    scope_id: id.slice(cut + 1),
    players,
    updated_at: now,
  };
}

/**
 * @param {Record<string, any> | null | undefined} user
 * @returns {{ name: string | null, avatar_url: string | null }}
 */
export function boardIdentity(user) {
  return {
    name: typeof user?.full_name === "string" ? user.full_name : null,
    avatar_url: typeof user?.avatar_url === "string" ? user.avatar_url : null,
  };
}

/**
 * Every career and leaderboard document, built from scratch.
 * @param {PlayerMatchLike[]} playerMatches
 * @param {Map<string, Record<string, any>>} usersById
 * @param {string} now
 */
export function rebuildStats(playerMatches, usersById, now) {
  /** @type {Map<string, PlayerMatchLike[]>} */
  const byUser = new Map();
  /** @type {Map<string, Map<string, PlayerMatchLike[]>>} */
  const byScope = new Map();
  for (const pm of playerMatches) {
    const list = byUser.get(pm.user_id) ?? [];
    list.push(pm);
    byUser.set(pm.user_id, list);
    for (const key of scopeKeysOf(pm)) {
      const players = byScope.get(key) ?? new Map();
      const own = players.get(pm.user_id) ?? [];
      own.push(pm);
      players.set(pm.user_id, own);
      byScope.set(key, players);
    }
  }
  /** @type {ReturnType<typeof careerDocOf>[]} */
  const careers = [];
  for (const [userId, pms] of byUser)
    careers.push(careerDocOf(userId, accOf(pms), now));
  /** @type {ReturnType<typeof leaderboardDocOf>[]} */
  const leaderboards = [];
  for (const [key, players] of byScope) {
    /** @type {Record<string, BoardPlayer>} */
    const out = {};
    for (const [userId, pms] of players) {
      out[userId] = { ...accOf(pms), ...boardIdentity(usersById.get(userId)) };
    }
    leaderboards.push(leaderboardDocOf(key, out, now));
  }
  return { careers, leaderboards };
}
