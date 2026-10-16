/**
 * Helpers to write only the derived rows that actually changed.
 *
 * The recompute engine stamps `updated_at` (and, for regenerated rows,
 * `created_at`) with the current time, so every row looks new. Comparing
 * with the stored document while ignoring those timestamps lets a ball that
 * touches three rows write three rows instead of the whole scorecard.
 */

const VOLATILE_FIELDS = new Set(["created_at", "updated_at"]);

function norm(value: unknown): unknown {
  return value === undefined ? null : value;
}

/** JSON with object keys sorted (Firestore does not keep map key order). */
function canonical(value: unknown): string {
  return JSON.stringify(value, (_key, v: unknown) => {
    if (v && typeof v === "object" && !Array.isArray(v)) {
      const out: Record<string, unknown> = {};
      for (const k of Object.keys(v).sort()) {
        const field = (v as Record<string, unknown>)[k];
        out[k] = field === undefined ? null : field;
      }
      return out;
    }
    return v;
  });
}

function sameValue(a: unknown, b: unknown): boolean {
  const x = norm(a);
  const y = norm(b);
  if (x === y) return true;
  if (typeof x === "object" && typeof y === "object" && x && y) {
    return canonical(x) === canonical(y);
  }
  return false;
}

/** Field-by-field equality, ignoring timestamps; missing equals undefined. */
export function sameRow(a: object, b: object): boolean {
  const ra = a as Record<string, unknown>;
  const rb = b as Record<string, unknown>;
  const keys = new Set([...Object.keys(ra), ...Object.keys(rb)]);
  for (const key of keys) {
    if (VOLATILE_FIELDS.has(key)) continue;
    const inA = key in ra && ra[key] !== undefined;
    const inB = key in rb && rb[key] !== undefined;
    // A field the stored doc lacks must be written even when null.
    if (inA !== inB) return false;
    if (!sameValue(ra[key], rb[key])) return false;
  }
  return true;
}

export interface RowDiff<T> {
  /** Rows to write (changed or new), with the stored `created_at` kept. */
  changed: T[];
  /** Every row as it will be stored after the write. */
  merged: T[];
}

export function diffRows<T extends { id: string }>(
  next: T[],
  loaded: readonly T[],
): RowDiff<T> {
  const byId = new Map(loaded.map((r) => [r.id, r]));
  const changed: T[] = [];
  const merged: T[] = [];
  for (const row of next) {
    const prev = byId.get(row.id);
    if (prev && sameRow(row, prev)) {
      merged.push(prev);
      continue;
    }
    const prevCreated = (prev as { created_at?: unknown } | undefined)
      ?.created_at;
    const out =
      prev && prevCreated !== undefined && "created_at" in row
        ? ({ ...row, created_at: prevCreated } as T)
        : row;
    changed.push(out);
    merged.push(out);
  }
  return { changed, merged };
}
