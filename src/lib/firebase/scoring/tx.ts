/**
 * Transaction wrapper for the scoring engine.
 *
 * Reads go straight through (to a Firestore transaction on the server, or
 * to a DataSource in tests). Writes are buffered and coalesced per document,
 * then flushed when the callback returns, so:
 *
 * - reads may happen after a write is staged (Firestore requires every read
 *   before the first write; buffering keeps that true automatically);
 * - several patches to one document (e.g. the match row) become one write.
 */

import type {
  DocumentData,
  Firestore,
  Transaction,
} from "firebase-admin/firestore";
import type { DataSource, Doc, NativeFilter } from "../datasource";

export type WithId<T> = T & { id: string };

/** The read half of a DataSource; also implemented by {@link ScoringTx}. */
export interface DocReader {
  getById(table: string, id: string): Promise<Doc | null>;
  getByIds(table: string, ids: string[]): Promise<Doc[]>;
  query(table: string, filters: NativeFilter[]): Promise<Doc[]>;
}

type Clause = [string, "==" | "in", unknown];

export type PendingWrite =
  | { kind: "set"; table: string; id: string; data: Record<string, unknown> }
  | { kind: "merge"; table: string; id: string; data: Record<string, unknown> }
  | { kind: "delete"; table: string; id: string };

function stripId(data: object): Record<string, unknown> {
  const copy: Record<string, unknown> = { ...data };
  delete copy.id;
  return copy;
}

export abstract class ScoringTx implements DocReader {
  private readonly writes = new Map<string, PendingWrite>();

  abstract getById(table: string, id: string): Promise<Doc | null>;
  abstract getByIds(table: string, ids: string[]): Promise<Doc[]>;
  abstract query(table: string, filters: NativeFilter[]): Promise<Doc[]>;

  async doc<T>(table: string, id: string): Promise<WithId<T> | null> {
    return (await this.getById(table, id)) as unknown as WithId<T> | null;
  }

  async docs<T>(table: string, ids: string[]): Promise<WithId<T>[]> {
    const unique = Array.from(new Set(ids.filter(Boolean)));
    if (!unique.length) return [];
    return (await this.getByIds(table, unique)) as unknown as WithId<T>[];
  }

  async where<T>(table: string, clauses: Clause[]): Promise<WithId<T>[]> {
    return (await this.query(
      table,
      clauses.map(([field, op, value]) => ({ field, op, value })),
    )) as unknown as WithId<T>[];
  }

  /** Replace the whole document. */
  put(table: string, id: string, data: object): void {
    this.writes.set(`${table}/${id}`, {
      kind: "set",
      table,
      id,
      data: stripId(data),
    });
  }

  /** Merge fields into the document (creating it if missing). */
  patch(table: string, id: string, data: object): void {
    const key = `${table}/${id}`;
    const fields = stripId(data);
    const prev = this.writes.get(key);
    if (prev?.kind === "set" || prev?.kind === "merge") {
      this.writes.set(key, { ...prev, data: { ...prev.data, ...fields } });
    } else if (prev?.kind === "delete") {
      this.writes.set(key, { kind: "set", table, id, data: fields });
    } else {
      this.writes.set(key, { kind: "merge", table, id, data: fields });
    }
  }

  delete(table: string, id: string): void {
    this.writes.set(`${table}/${id}`, { kind: "delete", table, id });
  }

  pendingWrites(): PendingWrite[] {
    return Array.from(this.writes.values());
  }
}

/** Reads through a Firestore Admin transaction. */
export class FirestoreScoringTx extends ScoringTx {
  constructor(
    private readonly db: Firestore,
    private readonly tx: Transaction,
  ) {
    super();
  }

  async getById(table: string, id: string): Promise<Doc | null> {
    const snap = await this.tx.get(this.db.collection(table).doc(id));
    return snap.exists
      ? { ...(snap.data() as DocumentData), id: snap.id }
      : null;
  }

  async getByIds(table: string, ids: string[]): Promise<Doc[]> {
    const unique = Array.from(new Set(ids.filter(Boolean)));
    if (!unique.length) return [];
    const snaps = await this.tx.getAll(
      ...unique.map((id) => this.db.collection(table).doc(id)),
    );
    return snaps
      .filter((s) => s.exists)
      .map((s) => ({ ...(s.data() as DocumentData), id: s.id }));
  }

  async query(table: string, filters: NativeFilter[]): Promise<Doc[]> {
    let q: FirebaseFirestore.Query = this.db.collection(table);
    for (const f of filters) q = q.where(f.field, f.op, f.value);
    const snap = await this.tx.get(q);
    return snap.docs.map((d) => ({ ...d.data(), id: d.id }));
  }

  flush(): void {
    for (const w of this.pendingWrites()) {
      const ref = this.db.collection(w.table).doc(w.id);
      if (w.kind === "delete") this.tx.delete(ref);
      else if (w.kind === "set") this.tx.set(ref, w.data);
      else this.tx.set(ref, w.data, { merge: true });
    }
  }
}

/**
 * Runs against a plain DataSource (tests, local tooling). Not isolated:
 * writes are applied in sequence after the callback returns.
 */
export class DataSourceScoringTx extends ScoringTx {
  private readonly seen = new Map<string, Doc>();

  constructor(private readonly ds: DataSource) {
    super();
  }

  private remember(table: string, docs: Doc[]): Doc[] {
    for (const d of docs) this.seen.set(`${table}/${d.id}`, d);
    return docs;
  }

  async getById(table: string, id: string): Promise<Doc | null> {
    const doc = await this.ds.getById(table, id);
    if (doc) this.remember(table, [doc]);
    return doc;
  }

  async getByIds(table: string, ids: string[]): Promise<Doc[]> {
    const unique = Array.from(new Set(ids.filter(Boolean)));
    if (!unique.length) return [];
    return this.remember(table, await this.ds.getByIds(table, unique));
  }

  async query(table: string, filters: NativeFilter[]): Promise<Doc[]> {
    return this.remember(table, await this.ds.query(table, filters));
  }

  async commit(): Promise<void> {
    for (const w of this.pendingWrites()) {
      if (w.kind === "delete") {
        await this.ds.delete(w.table, w.id);
      } else if (w.kind === "set") {
        await this.ds.insert(w.table, [{ ...w.data, id: w.id }]);
      } else {
        const known = this.seen.get(`${w.table}/${w.id}`);
        if (known) {
          await this.ds.insert(w.table, [{ ...known, ...w.data, id: w.id }]);
        } else {
          await this.ds.update(w.table, w.id, w.data);
        }
      }
    }
  }
}

export interface TxContext {
  /** Admin Firestore; when absent the DataSource is used (tests). */
  db?: Firestore | null;
  ds: DataSource;
}

export async function runScoringTransaction<R>(
  ctx: TxContext,
  fn: (t: ScoringTx) => Promise<R>,
): Promise<R> {
  if (ctx.db) {
    const db = ctx.db;
    return db.runTransaction(async (tx) => {
      const t = new FirestoreScoringTx(db, tx);
      const result = await fn(t);
      t.flush();
      return result;
    });
  }
  const t = new DataSourceScoringTx(ctx.ds);
  const result = await fn(t);
  await t.commit();
  return result;
}
