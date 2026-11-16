/**
 * Word-prefix search without collection scans (schema stage 3).
 *
 * Every searchable document stores `search_prefixes` (see `derive.mjs`):
 * the 2..24-character prefixes of each word of its name (plus a user's
 * @username) and the prefixes of the whole name past its first word. A
 * query is one `array-contains` on that array, ordered by the lower-cased
 * name and limited, so it reads at most `limit` documents:
 *
 * - "jo", "john", "smi" and "john sm" all find "John Smith";
 * - "@john_s" finds the user `john_smith`;
 * - one-word queries of 3+ characters also match inside words ("ohn" and
 *   "mith" find "John Smith"): each word's trigrams are stored too. A
 *   3-character query is itself a stored token (one query). A longer one
 *   runs its prefix query first and, only if that finds nothing, a second
 *   query on its first trigram (at most 3 x limit reads), confirmed in
 *   memory. So "smit" lists word starts only; "mith" falls through to
 *   mid-word matches.
 * - several words that are not the start of the name ("rahul sharma" for
 *   "Rahul Kumar Sharma", "sharma rahul", "r sharma") have no stored key:
 *   when the phrase finds nothing, a second query on the longest word (at
 *   most 3 x limit reads), confirmed in memory, finds them. `everyMatch`
 *   runs it even when the phrase found someone (see below).
 *
 * Indexes: `search_prefixes` (array-contains) + the sort field, one per
 * collection (firestore.indexes.json).
 */

import {
  INFIX_LEN,
  isInfixQuery,
  MAX_PHRASE_PREFIX,
  MAX_WORD_PREFIX,
  matchesEveryWord,
  matchesSearch,
  MIN_PREFIX,
  normalizeText,
  SEARCH_FIELDS,
  searchKey,
  soundKeysOf,
  soundsLike,
  soundToken,
} from "./derive.mjs";
import type { QueryBuilder } from "./query-builder";
import type { TableName } from "./types";

type SearchTable = "users" | "teams" | "clubs" | "tournaments" | "matches";

/**
 * The order results come in: by name, except matches, latest first (a
 * search for "omkar" is after this weekend's games, not every "Rohan vs
 * Omkar" in title order). Each has its index with `search_prefixes`.
 */
const RESULT_ORDER: Partial<Record<SearchTable, { field: string; ascending: boolean }>> = {
  matches: { field: "scheduled_at", ascending: false },
};
const orderOf = (table: SearchTable, sort: string) =>
  RESULT_ORDER[table] ?? { field: sort, ascending: true };

interface SearchClient {
  from<T extends TableName>(table: T): QueryBuilder<T>;
}

/** Whether the stored prefixes hold `query` in full (no in-memory check). */
function storedInFull(query: string): boolean {
  const norm = normalizeText(query);
  return (
    norm.length <= (norm.includes(" ") ? MAX_PHRASE_PREFIX : MAX_WORD_PREFIX)
  );
}

/**
 * Up to `limit` documents of `table` whose name (or a word of it) starts
 * with `query`, in name order. `columns` is a select list holding `id`; the
 * search source fields are added when a long query needs an in-memory
 * check. `everyMatch`: a phrase's matches do not end a several-word search,
 * so a player "Rahul Sharma" does not hide "Rahul Kumar Sharma" (likely the
 * same person, and the reason a scorer looks before adding anyone).
 */
export async function prefixSearch<T extends SearchTable>(
  db: SearchClient,
  table: T,
  query: string,
  columns: string,
  limit: number,
  {
    everyMatch = false,
    soundAlikes = false,
  }: {
    everyMatch?: boolean;
    /**
     * Spelling variants even when the name was found as typed, while there
     * is room ("Akash" lists "Akashy" and "Aakash"): one query more, for the
     * boxes that add a player, where a missed one becomes a duplicate.
     */
    soundAlikes?: boolean;
  } = {},
): Promise<{ data: Record<string, unknown>[]; error: string | null }> {
  const key = searchKey(query);
  if (!key) return { data: [], error: null };
  const spec = SEARCH_FIELDS[table]!;
  const exact = storedInFull(query);
  const select = exact ? columns : `${columns}, ${spec.sources.join(", ")}`;
  const { data, error } = await db
    .from(table)
    .select(select)
    .contains("search_prefixes", [key])
    .order(orderOf(table, spec.sort).field, {
      ascending: orderOf(table, spec.sort).ascending,
      // Firestore's own null placement (undated matches last): no second
      // query to move them.
      nullsFirst: orderOf(table, spec.sort).ascending,
    })
    .limit(exact ? limit : limit * 3);
  if (error) return { data: [], error: error.message };
  let rows = (data ?? []) as Record<string, unknown>[];
  const matches = (r: Record<string, unknown>) =>
    matchesSearch(
      query,
      spec.sources.map((f) => r[f]),
    );
  if (!exact) rows = rows.filter(matches).slice(0, limit);

  const norm = normalizeText(query);
  const words = norm.split(" ");
  const roomForMore = everyMatch && words.length > 1 && rows.length < limit;

  /** Documents holding `token`, kept when `confirm` says they match. */
  const lookUp = async (
    token: string,
    confirm: (r: Record<string, unknown>) => boolean,
  ) => {
    const found = await db
      .from(table)
      .select(`${columns}, ${spec.sources.join(", ")}`)
      .contains("search_prefixes", [token])
      .order(orderOf(table, spec.sort).field, {
        ascending: orderOf(table, spec.sort).ascending,
        // Firestore's own null placement (undated matches last): no second
        // query to move them.
        nullsFirst: orderOf(table, spec.sort).ascending,
      })
      .limit(limit * 3);
    if (found.error) return { data: [], error: found.error.message };
    const data = ((found.data ?? []) as Record<string, unknown>[])
      .filter(confirm)
      .slice(0, limit);
    return { data, error: null };
  };

  /**
   * Nobody found as typed: spelling variants ("Sandip sir" finds "Sandeep
   * sir"), by the sound token of the longest name word typed, kept when
   * every name word typed sounds like one of theirs. One query more, only
   * for a search that found nobody.
   */
  const orSoundingLike = async (result: {
    data: Record<string, unknown>[];
    error: string | null;
  }) => {
    if (result.error) return result;
    const wanted =
      result.data.length === 0 ||
      (soundAlikes && result.data.length < limit);
    if (!wanted) return result;
    const keys = soundKeysOf(query);
    if (keys.length === 0) return result;
    const key = keys.reduce((a, b) => (b.length > a.length ? b : a));
    const alike = await lookUp(soundToken(key), (r) =>
      soundsLike(
        query,
        spec.sources.map((f) => r[f]),
      ),
    );
    if (alike.error) return result.data.length > 0 ? result : alike;
    const known = new Set(result.data.map((r) => r.id));
    return {
      data: [
        ...result.data,
        ...alike.data.filter((r) => !known.has(r.id)),
      ].slice(0, limit),
      error: null,
    };
  };

  if (rows.length > 0 && !roomForMore) {
    return orSoundingLike({ data: rows, error: null });
  }

  // Mid-word matches for longer one-word queries with no word-start
  // match: every word containing the query contains its first trigram.
  if (isInfixQuery(norm) && norm.length > INFIX_LEN) {
    return orSoundingLike(await lookUp(norm.slice(0, INFIX_LEN), matches));
  }
  // Words apart or out of order: the longest is the most selective.
  const longest = words.reduce((a, b) => (b.length > a.length ? b : a));
  if (words.length > 1 && longest.length >= MIN_PREFIX) {
    const apart = await lookUp(longest.slice(0, MAX_WORD_PREFIX), (r) =>
      matchesEveryWord(
        query,
        spec.sources.map((f) => r[f]),
      ),
    );
    if (apart.error) return apart;
    const known = new Set(rows.map((r) => r.id));
    const others = apart.data.filter((r) => !known.has(r.id));
    return orSoundingLike({
      data: [...rows, ...others].slice(0, limit),
      error: null,
    });
  }
  return orSoundingLike({ data: rows, error: null });
}
