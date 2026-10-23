/**
 * Pure derivations for schema stage 3, shared by the app (TypeScript
 * imports this file), the migration (scripts/migrate-stage3.mjs) and the
 * seed transform, so all three write identical documents.
 *
 * - Search keys: `name_lower` (or `title_lower`) for ordering and
 *   `search_prefixes`, an array of lower-cased word prefixes, prefixes of
 *   the whole text and 3-letter pieces (trigrams) of each word, queried
 *   with one `array-contains`.
 * - Team rosters: `teams.roster`, the team's `team_players` documents with
 *   a display snapshot of each player (`user`).
 * - Innings summaries: `matches.innings_summary`, the score line of each
 *   innings for match lists and the points table.
 */

/** @typedef {{ id: string } & Record<string, any>} Doc */

/** Shortest prefix stored (queries need at least this many characters). */
export const MIN_PREFIX = 2;
/** Longest per-word prefix stored; longer queries are checked in memory. */
export const MAX_WORD_PREFIX = 24;
/** Longest whole-text prefix stored. */
export const MAX_PHRASE_PREFIX = 48;
/**
 * Length of the in-word pieces stored for mid-word search ("ohn" finds
 * "John"). Every 3-letter window of each word (its first 24 characters) is
 * stored, so a word of n letters adds at most n - 3 tokens beyond its
 * prefixes. Longer mid-word queries look up their first trigram and are
 * confirmed in memory ({@link matchesSearch}).
 */
export const INFIX_LEN = 3;

/**
 * Lower case, accents removed, anything but letters / digits / `_`
 * becomes a single space.
 * @param {unknown} text
 * @returns {string}
 */
export function normalizeText(text) {
  if (typeof text !== "string") return "";
  return text
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, " ")
    .trim();
}

/**
 * Word prefixes (2..24 chars) of `text`, the trigrams inside each word (so
 * "ohn" finds "John"), plus prefixes of the whole text longer than its
 * first word (so "john sm" finds "John Smith").
 * @param {unknown} text
 * @param {Set<string>} out
 */
function addPrefixes(text, out) {
  const norm = normalizeText(text);
  if (!norm) return;
  const words = norm.split(" ");
  for (const word of words) {
    const max = Math.min(word.length, MAX_WORD_PREFIX);
    for (let n = MIN_PREFIX; n <= max; n += 1) out.add(word.slice(0, n));
    // Trigrams after the first (which is already the 3-letter prefix).
    for (let i = 1; i + INFIX_LEN <= max; i += 1) {
      out.add(word.slice(i, i + INFIX_LEN));
    }
  }
  if (words.length > 1) {
    const max = Math.min(norm.length, MAX_PHRASE_PREFIX);
    for (let n = (words[0] ?? "").length + 2; n <= max; n += 1) {
      const prefix = norm.slice(0, n);
      if (!prefix.endsWith(" ")) out.add(prefix);
    }
  }
}

/**
 * Sorted, de-duplicated search prefixes of the given texts.
 * @param {unknown[]} texts
 * @returns {string[]}
 */
export function searchPrefixes(texts) {
  /** @type {Set<string>} */
  const out = new Set();
  for (const t of texts) addPrefixes(t, out);
  return Array.from(out).sort();
}

/**
 * The search key a query string is matched with (`array-contains`), or
 * null when it is too short. Long queries are truncated to what is stored;
 * callers then confirm matches with {@link matchesSearch}.
 * @param {unknown} query
 * @returns {string | null}
 */
export function searchKey(query) {
  const norm = normalizeText(query);
  if (norm.length < MIN_PREFIX) return null;
  const max = norm.includes(" ") ? MAX_PHRASE_PREFIX : MAX_WORD_PREFIX;
  return norm.slice(0, max).trimEnd();
}

/**
 * Whether a query is matched inside words too (one word of at least
 * {@link INFIX_LEN} characters), not only at word starts.
 * @param {unknown} query
 */
export function isInfixQuery(query) {
  const q = normalizeText(query);
  return q.length >= INFIX_LEN && !q.includes(" ");
}

/**
 * Whether `texts` match `query` the way the stored keys do (the whole text
 * or a word starts with it, or, for a one-word query of 3+ characters, a
 * word contains it), without the length caps.
 * @param {unknown} query
 * @param {unknown[]} texts
 */
export function matchesSearch(query, texts) {
  const q = normalizeText(query);
  if (!q) return false;
  const infix = isInfixQuery(q);
  return texts.some((t) => {
    const norm = normalizeText(t);
    if (!norm) return false;
    if (norm.startsWith(q)) return true;
    if (q.includes(" ")) return false;
    return norm
      .split(" ")
      .some((w) => w.startsWith(q) || (infix && w.includes(q)));
  });
}

/**
 * Collections with search keys: the source fields and the sort field.
 * Users also match on their @username.
 * @type {Record<string, { sources: string[]; sort: string; from: string }>}
 */
export const SEARCH_FIELDS = {
  users: {
    sources: ["full_name", "username"],
    sort: "name_lower",
    from: "full_name",
  },
  teams: { sources: ["name", "short_name"], sort: "name_lower", from: "name" },
  clubs: { sources: ["name", "short_name"], sort: "name_lower", from: "name" },
  tournaments: { sources: ["name"], sort: "name_lower", from: "name" },
  matches: { sources: ["title"], sort: "title_lower", from: "title" },
};

/**
 * The derived search fields of a document (`{ name_lower, search_prefixes }`
 * or `{ title_lower, search_prefixes }`), or null for other collections.
 * @param {string} table
 * @param {Record<string, any>} doc
 * @returns {Record<string, unknown> | null}
 */
export function searchFieldsOf(table, doc) {
  const spec = SEARCH_FIELDS[table];
  if (!spec) return null;
  return {
    [spec.sort]: normalizeText(doc[spec.from]),
    search_prefixes: searchPrefixes(spec.sources.map((f) => doc[f])),
  };
}

// ---------------------------------------------------------------------------
// Team rosters
// ---------------------------------------------------------------------------

/** User fields copied into roster entries (what pages select). */
export const ROSTER_USER_FIELDS = /** @type {const} */ ([
  "id",
  "full_name",
  "avatar_url",
  "username",
]);

/**
 * @param {Record<string, any> | null | undefined} user
 * @returns {Record<string, unknown> | null}
 */
export function userSnapshot(user) {
  if (!user) return null;
  /** @type {Record<string, unknown>} */
  const out = {};
  for (const f of ROSTER_USER_FIELDS) out[f] = user[f] ?? null;
  return out;
}

/**
 * `teams.roster`: the team's `team_players` documents (every field, in id
 * order) each with `user`, a snapshot of the player's public profile.
 * @param {Doc[]} teamPlayers the team's team_players documents
 * @param {Map<string, Record<string, any>>} usersById
 * @returns {Record<string, unknown>[]}
 */
export function rosterOf(teamPlayers, usersById) {
  return [...teamPlayers]
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
    .map((tp) => {
      /** @type {Record<string, unknown>} */
      const entry = {};
      for (const [k, v] of Object.entries(tp)) {
        if (k !== "user") entry[k] = v === undefined ? null : v;
      }
      entry.user = userSnapshot(
        typeof tp.user_id === "string" ? usersById.get(tp.user_id) : null,
      );
      return entry;
    });
}

// ---------------------------------------------------------------------------
// Match parent snapshots
// ---------------------------------------------------------------------------

/**
 * Display copies of a match's tournament and club stored on the match
 * (`tournament_snapshot`, `club_snapshot`).
 */
export const MATCH_PARENT_SNAPSHOTS = /** @type {const} */ ([
  {
    local: "tournament_id",
    field: "tournament_snapshot",
    table: "tournaments",
    columns: ["id", "name", "tournament_format", "venue"],
  },
  {
    local: "club_id",
    field: "club_snapshot",
    table: "clubs",
    columns: ["id", "name", "short_name"],
  },
]);

/**
 * @param {Record<string, any> | null | undefined} doc
 * @param {readonly string[]} columns
 * @returns {Record<string, unknown> | null}
 */
export function pickSnapshot(doc, columns) {
  if (!doc) return null;
  /** @type {Record<string, unknown>} */
  const out = {};
  for (const c of columns) out[c] = doc[c] ?? null;
  return out;
}

// ---------------------------------------------------------------------------
// Innings summaries
// ---------------------------------------------------------------------------

/** Innings fields copied into `matches.innings_summary`. */
export const INNINGS_SUMMARY_FIELDS = /** @type {const} */ ([
  "id",
  "team_id",
  "innings_number",
  "total_runs",
  "total_wickets",
  "total_overs",
  "total_balls",
  "extras_total",
  "is_completed",
  "target_runs",
]);

/**
 * @param {Record<string, any>} innings
 * @returns {Record<string, unknown>}
 */
export function inningsSummaryEntry(innings) {
  /** @type {Record<string, unknown>} */
  const out = {};
  for (const f of INNINGS_SUMMARY_FIELDS) out[f] = innings[f] ?? null;
  return out;
}

/**
 * A match's innings summary, ordered by innings number then id.
 * @param {Record<string, any>[]} innings
 * @returns {Record<string, unknown>[]}
 */
export function inningsSummaryOf(innings) {
  return [...innings]
    .sort(
      (a, b) =>
        (a.innings_number ?? 0) - (b.innings_number ?? 0) ||
        (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
    )
    .map(inningsSummaryEntry);
}

/**
 * Match fields derived from its innings summary, written with it, so a
 * club's milestones are aggregations (count / sum / top innings) instead
 * of reading every match: the runs and wickets of all its innings and its
 * highest innings (the first of equal ones, in innings order).
 * @param {Record<string, any>[] | null | undefined} entries
 */
export function summaryTotalsOf(entries) {
  let runs = 0;
  let wickets = 0;
  /** @type {{ runs: number, wickets: number, overs: number, team_id: string | null } | null} */
  let best = null;
  for (const e of entries ?? []) {
    const line = {
      runs: count(e.total_runs),
      wickets: count(e.total_wickets),
      overs: count(e.total_overs),
      team_id: typeof e.team_id === "string" ? e.team_id : null,
    };
    runs += line.runs;
    wickets += line.wickets;
    if (!best || line.runs > best.runs) best = line;
  }
  return {
    summary_runs: runs,
    summary_wickets: wickets,
    best_innings: best,
    best_innings_runs: best ? best.runs : null,
  };
}

/** @param {unknown} value a stored figure (0 when missing) */
function count(value) {
  return Number(value) || 0;
}

/** The fields {@link summaryTotalsOf} writes on a match. */
export const SUMMARY_TOTAL_FIELDS = /** @type {const} */ ([
  "summary_runs",
  "summary_wickets",
  "best_innings",
  "best_innings_runs",
]);

/** @param {unknown} value */
export function canonicalJson(value) {
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
