/**
 * Which `order()` columns the query builder may hand to Firestore.
 *
 * Firestore's `orderBy` silently drops documents that lack the field, while
 * the in-memory sort keeps them. Ordering is therefore pushed down only for
 * columns listed here, i.e. columns every writer (builder inserts, RPC
 * inserts, seed data) always sets, even if only to `null`. Keep the list
 * conservative: add a column only after checking all of its writers.
 *
 * An order column that also carries a range filter (`gte`/`lt`/`startsWith`)
 * needs no entry: both paths already exclude missing and null values.
 */

/** Columns present (possibly null) on every document of the collection. */
const ORDERABLE: Record<string, readonly string[]> = {
  matches: ["scheduled_at", "created_at"],
  users: ["full_name", "created_at"],
  ball_by_ball: ["seq", "over_number", "created_at"],
};

/**
 * Subset of ORDERABLE that is never null, so no separate null query is
 * needed to reproduce Postgres null placement.
 */
const NON_NULL: Record<string, readonly string[]> = {
  matches: ["created_at"],
  users: ["created_at"],
  ball_by_ball: ["seq", "created_at"],
};

export function isOrderable(table: string, field: string): boolean {
  return ORDERABLE[table]?.includes(field) ?? false;
}

export function isNonNull(table: string, field: string): boolean {
  return NON_NULL[table]?.includes(field) ?? false;
}
