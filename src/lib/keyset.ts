/**
 * Keyset pages for the directory lists (players, teams, clubs,
 * tournaments): rows in `name_lower` order, read `PAGE_SIZE + 1` at a time
 * with the query builder's `after()` cursor, so a page costs at most 31
 * reads however many documents there are. The cursor in the URL is the
 * last row's sort key and id (`<value>~<id>`).
 */

export const PAGE_SIZE = 30;

export interface KeysetCursor {
  value: string;
  id: string;
}

/** The `after` URL parameter as a cursor, or null. */
export function parseCursor(
  raw: string | undefined | null,
): KeysetCursor | null {
  if (!raw) return null;
  const cut = raw.lastIndexOf("~");
  if (cut < 0) return null;
  return { value: raw.slice(0, cut), id: raw.slice(cut + 1) };
}

/**
 * The first `size` rows of a `size + 1` read, and the cursor of the next
 * page when there is one.
 */
export function keysetPage<T extends { id: string }>(
  rows: readonly T[],
  sortKey: (row: T) => string,
  size = PAGE_SIZE,
): { rows: T[]; next: string | null } {
  const page = rows.slice(0, size);
  const last = page[page.length - 1];
  return {
    rows: page,
    next: rows.length > size && last ? `${sortKey(last)}~${last.id}` : null,
  };
}
