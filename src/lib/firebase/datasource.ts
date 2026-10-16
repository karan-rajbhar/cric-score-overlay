/**
 * Minimal persistence contract the query builder runs on top of.
 *
 * Both the Admin SDK (server) and the web SDK (browser) implement this, so
 * the same query/relations/filter logic serves server actions, pages and
 * client hooks. A memory implementation backs unit tests.
 */

export type Doc = Record<string, unknown> & { id: string };

export type NativeOp = "==" | "!=" | "in" | "<" | "<=" | ">" | ">=";

export interface NativeFilter {
  field: string;
  op: NativeOp;
  value: unknown;
}

export interface NativeOrder {
  field: string;
  direction: "asc" | "desc";
}

/**
 * Optional server-side ordering / limiting. Follows Firestore semantics:
 * ordering by a field excludes documents where it is missing, nulls sort
 * first ascending, ties break on document id in the last order's direction,
 * and a range / `!=` filter without an explicit order sorts by that field.
 */
export interface QueryOptions {
  orderBy?: NativeOrder[];
  limit?: number;
}

export interface DataSource {
  readonly kind: "admin" | "web" | "memory";
  getById(table: string, id: string): Promise<Doc | null>;
  getByIds(table: string, ids: string[]): Promise<Doc[]>;
  /**
   * Fetch documents matching native filters, optionally ordered and limited
   * by Firestore. Richer predicates are applied by the caller.
   */
  query(
    table: string,
    filters: NativeFilter[],
    options?: QueryOptions,
  ): Promise<Doc[]>;
  /** Count matching documents (Firestore `count()` aggregation). */
  count(table: string, filters: NativeFilter[]): Promise<number>;
  insert(table: string, docs: Doc[]): Promise<void>;
  update(
    table: string,
    id: string,
    patch: Record<string, unknown>,
  ): Promise<void>;
  delete(table: string, id: string): Promise<void>;
}

/** Firestore limits `in` filters to 30 values. */
export const IN_CHUNK_SIZE = 30;

export function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size));
  }
  return out;
}

/** Firestore's cross-type value ordering (null < bool < number < string < array < map). */
function typeRank(value: unknown): number {
  if (value === null) return 0;
  if (typeof value === "boolean") return 1;
  if (typeof value === "number") return 2;
  if (typeof value === "string") return 4;
  if (Array.isArray(value)) return 8;
  return 9;
}

export function firestoreCompare(a: unknown, b: unknown): number {
  const ra = typeRank(a);
  const rb = typeRank(b);
  if (ra !== rb) return ra - rb;
  if (ra === 1 || ra === 2 || ra === 4) {
    const x = a as number | string | boolean;
    const y = b as number | string | boolean;
    return x < y ? -1 : x > y ? 1 : 0;
  }
  if (ra === 0) return 0;
  const sa = JSON.stringify(a);
  const sb = JSON.stringify(b);
  return sa < sb ? -1 : sa > sb ? 1 : 0;
}

/** Evaluates a native filter with Firestore semantics (strict, type-aware). */
export function memoryMatches(doc: Doc, f: NativeFilter): boolean {
  const actual = doc[f.field];
  switch (f.op) {
    case "==":
      return actual !== undefined && actual === f.value;
    case "in":
      return (
        actual !== undefined &&
        Array.isArray(f.value) &&
        f.value.includes(actual)
      );
    case "!=":
      return actual !== undefined && actual !== null && actual !== f.value;
    default: {
      // Range filters only match values of the same type.
      if (actual === undefined || actual === null) return false;
      if (typeRank(actual) !== typeRank(f.value)) return false;
      const c = firestoreCompare(actual, f.value);
      if (f.op === "<") return c < 0;
      if (f.op === "<=") return c <= 0;
      if (f.op === ">") return c > 0;
      return c >= 0;
    }
  }
}

/**
 * Applies Firestore ordering / limit semantics to already-filtered documents
 * (the order of `docs` is used as the stable document-id order).
 */
export function applyQueryOptions(
  docs: Doc[],
  filters: NativeFilter[],
  options?: QueryOptions,
): Doc[] {
  let out = docs;
  let orders = options?.orderBy ?? [];
  if (orders.length === 0) {
    // Firestore orders by the inequality field when no order is given.
    const inequality = filters.find((f) => f.op !== "==" && f.op !== "in");
    if (inequality) orders = [{ field: inequality.field, direction: "asc" }];
  }
  if (orders.length > 0) {
    out = out.filter((doc) => orders.every((o) => doc[o.field] !== undefined));
    const tieDirection =
      orders[orders.length - 1]!.direction === "desc" ? -1 : 1;
    out = [...out].sort((a, b) => {
      for (const o of orders) {
        const c = firestoreCompare(a[o.field], b[o.field]);
        if (c !== 0) return o.direction === "desc" ? -c : c;
      }
      return tieDirection * (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
    });
  }
  if (options?.limit !== undefined) out = out.slice(0, options.limit);
  return out;
}

/**
 * In-memory data source for tests and local tooling. Not safe for
 * concurrent use; it is deliberately simple.
 */
export class MemoryDataSource implements DataSource {
  readonly kind = "memory" as const;
  private tables = new Map<string, Map<string, Doc>>();
  /** Read counters (tests / measurement): documents returned and calls made. */
  docsRead = 0;
  queryCount = 0;
  countQueries = 0;

  constructor(seed?: Record<string, Doc[]>) {
    if (seed) {
      for (const [table, docs] of Object.entries(seed)) {
        const map = new Map<string, Doc>();
        for (const doc of docs) map.set(doc.id, structuredClone(doc));
        this.tables.set(table, map);
      }
    }
  }

  private table(name: string): Map<string, Doc> {
    let map = this.tables.get(name);
    if (!map) {
      map = new Map();
      this.tables.set(name, map);
    }
    return map;
  }

  async getById(table: string, id: string): Promise<Doc | null> {
    this.queryCount++;
    const doc = this.table(table).get(id);
    this.docsRead++;
    return doc ? structuredClone(doc) : null;
  }

  async getByIds(table: string, ids: string[]): Promise<Doc[]> {
    this.queryCount++;
    this.docsRead += new Set(ids).size;
    const map = this.table(table);
    const out: Doc[] = [];
    for (const id of ids) {
      const doc = map.get(id);
      if (doc) out.push(structuredClone(doc));
    }
    return out;
  }

  async query(
    table: string,
    filters: NativeFilter[],
    options?: QueryOptions,
  ): Promise<Doc[]> {
    this.queryCount++;
    const out = applyQueryOptions(this.match(table, filters), filters, options);
    this.docsRead += out.length;
    return out.map((doc) => structuredClone(doc));
  }

  async count(table: string, filters: NativeFilter[]): Promise<number> {
    this.queryCount++;
    this.countQueries++;
    return this.match(table, filters).length;
  }

  private match(table: string, filters: NativeFilter[]): Doc[] {
    const out: Doc[] = [];
    for (const doc of this.table(table).values()) {
      if (filters.every((f) => memoryMatches(doc, f))) out.push(doc);
    }
    return out;
  }

  async insert(table: string, docs: Doc[]): Promise<void> {
    const map = this.table(table);
    for (const doc of docs) map.set(doc.id, structuredClone(doc));
  }

  async update(
    table: string,
    id: string,
    patch: Record<string, unknown>,
  ): Promise<void> {
    const map = this.table(table);
    const existing = map.get(id);
    if (!existing) return;
    map.set(id, { ...existing, ...structuredClone(patch), id });
  }

  async delete(table: string, id: string): Promise<void> {
    this.table(table).delete(id);
  }

  /** Test helper: dump a collection. */
  all(table: string): Doc[] {
    return Array.from(this.table(table).values()).map((d) =>
      structuredClone(d),
    );
  }
}
