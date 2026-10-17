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
 * - substrings inside a word ("ohn") do not match (they did with the old
 *   in-memory `ilike '%q%'` scan, which read the whole collection).
 *
 * Indexes: `search_prefixes` (array-contains) + the sort field, one per
 * collection (firestore.indexes.json).
 */

import {
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
  if (!exact) {
    rows = rows
      .filter((r) =>
        matchesSearch(
          query,
          spec.sources.map((f) => r[f]),
        ),
      )
      .slice(0, limit);
  }
  return { data: rows, error: null };
}
