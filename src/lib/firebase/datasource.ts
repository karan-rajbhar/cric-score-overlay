/**
 * Minimal persistence contract the query builder runs on top of.
 *
 * Both the Admin SDK (server) and the web SDK (browser) implement this, so
 * the same query/relations/filter logic serves server actions, pages and
 * client hooks. A memory implementation backs unit tests.
 */

export type Doc = Record<string, unknown> & { id: string };

export interface NativeFilter {
  field: string;
  op: "==" | "in";
  value: unknown;
}

export interface DataSource {
  readonly kind: "admin" | "web" | "memory";
  getById(table: string, id: string): Promise<Doc | null>;
  getByIds(table: string, ids: string[]): Promise<Doc[]>;
  /**
   * Fetch documents matching simple equality / membership filters. Any
   * ordering, limiting or richer predicates are applied by the caller.
   */
  query(table: string, filters: NativeFilter[]): Promise<Doc[]>;
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

/**
 * In-memory data source for tests and local tooling. Not safe for
 * concurrent use; it is deliberately simple.
 */
export class MemoryDataSource implements DataSource {
  readonly kind = "memory" as const;
  private tables = new Map<string, Map<string, Doc>>();

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
    const doc = this.table(table).get(id);
    return doc ? structuredClone(doc) : null;
  }

  async getByIds(table: string, ids: string[]): Promise<Doc[]> {
    const map = this.table(table);
    const out: Doc[] = [];
    for (const id of ids) {
      const doc = map.get(id);
      if (doc) out.push(structuredClone(doc));
    }
    return out;
  }

  async query(table: string, filters: NativeFilter[]): Promise<Doc[]> {
    const out: Doc[] = [];
    for (const doc of this.table(table).values()) {
      const ok = filters.every((f) => {
        const actual = doc[f.field];
        if (f.op === "==") return actual === f.value;
        return Array.isArray(f.value) && f.value.includes(actual);
      });
      if (ok) out.push(structuredClone(doc));
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
