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
 *
 * Indexes: `search_prefixes` (array-contains) + the sort field, one per
 * collection (firestore.indexes.json).
 */

import {
  INFIX_LEN,
  isInfixQuery,
  MAX_PHRASE_PREFIX,
  MAX_WORD_PREFIX,
  matchesSearch,
  normalizeText,
  SEARCH_FIELDS,
  searchKey,
} from "./derive.mjs";
import type { QueryBuilder } from "./query-builder";
import type { TableName } from "./types";

type SearchTable = "users" | "teams" | "clubs" | "tournaments" | "matches";

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
 * with `query`, in name order. `columns` is a select list; the search
 * source fields are added when a long query needs an in-memory check.
 */
export async function prefixSearch<T extends SearchTable>(
  db: SearchClient,
  table: T,
  query: string,
  columns: string,
  limit: number,
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
    .order(spec.sort)
    .limit(exact ? limit : limit * 3);
  if (error) return { data: [], error: error.message };
  let rows = (data ?? []) as Record<string, unknown>[];
  const matches = (r: Record<string, unknown>) =>
    matchesSearch(
      query,
      spec.sources.map((f) => r[f]),
    );
  if (!exact) rows = rows.filter(matches).slice(0, limit);

  // Mid-word matches for longer one-word queries with no word-start
  // match: every word containing the query contains its first trigram.
  const norm = normalizeText(query);
  if (rows.length === 0 && isInfixQuery(norm) && norm.length > INFIX_LEN) {
    const infix = await db
      .from(table)
      .select(`${columns}, ${spec.sources.join(", ")}`)
      .contains("search_prefixes", [norm.slice(0, INFIX_LEN)])
      .order(spec.sort)
      .limit(limit * 3);
    if (infix.error) return { data: [], error: infix.error.message };
    rows = ((infix.data ?? []) as Record<string, unknown>[])
      .filter(matches)
      .slice(0, limit);
  }
  return { data: rows, error: null };
}
