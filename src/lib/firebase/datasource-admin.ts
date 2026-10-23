/**
 * DataSource implementation over the Firebase Admin SDK (server only).
 */

import "server-only";
import {
  AggregateField,
  FieldPath,
  type DocumentData,
  type Firestore,
  type Query,
} from "firebase-admin/firestore";
import {
  chunk,
  type DataSource,
  type Doc,
  type NativeFilter,
  type QueryOptions,
} from "./datasource";

const BATCH_LIMIT = 400;

function toDoc(id: string, data: DocumentData | undefined): Doc {
  return { ...(data ?? {}), id };
}

export class AdminDataSource implements DataSource {
  readonly kind = "admin" as const;

  constructor(private readonly db: Firestore) {}

  /** The Firestore behind this source (for transactions). */
  get firestore(): Firestore {
    return this.db;
  }

  async getById(table: string, id: string): Promise<Doc | null> {
    const snap = await this.db.collection(table).doc(id).get();
    return snap.exists ? toDoc(snap.id, snap.data()) : null;
  }

  async getByIds(table: string, ids: string[]): Promise<Doc[]> {
    const unique = Array.from(new Set(ids.filter(Boolean)));
    if (unique.length === 0) return [];
    const out: Doc[] = [];
    for (const group of chunk(unique, 100)) {
      const refs = group.map((id) => this.db.collection(table).doc(id));
      const snaps = await this.db.getAll(...refs);
      for (const snap of snaps) {
        if (snap.exists) out.push(toDoc(snap.id, snap.data()));
      }
    }
    return out;
  }

  private build(table: string, filters: NativeFilter[]): Query {
    let q: Query = this.db.collection(table);
    for (const f of filters) {
      q = q.where(f.field, f.op, f.value);
    }
    return q;
  }

  async query(
    table: string,
    filters: NativeFilter[],
    options?: QueryOptions,
  ): Promise<Doc[]> {
    let q = this.build(table, filters);
    for (const o of options?.orderBy ?? []) q = q.orderBy(o.field, o.direction);
    if (options?.startAfter && options.orderBy?.length) {
      // Ties by document id in the last order's direction (Firestore's own).
      const last = options.orderBy[options.orderBy.length - 1]!;
      q = q
        .orderBy(FieldPath.documentId(), last.direction)
        .startAfter(...options.startAfter);
    }
    if (options?.limit !== undefined) q = q.limit(options.limit);
    const snap = await q.get();
    return snap.docs.map((d) => toDoc(d.id, d.data()));
  }

  async count(table: string, filters: NativeFilter[]): Promise<number> {
    const snap = await this.build(table, filters).count().get();
    return snap.data().count;
  }

  async sum(
    table: string,
    filters: NativeFilter[],
    field: string,
  ): Promise<number> {
    const snap = await this.build(table, filters)
      .aggregate({ total: AggregateField.sum(field) })
      .get();
    return snap.data().total ?? 0;
  }

  async insert(table: string, docs: Doc[]): Promise<void> {
    for (const group of chunk(docs, BATCH_LIMIT)) {
      const batch = this.db.batch();
      for (const doc of group) {
        const { id, ...data } = doc;
        batch.set(this.db.collection(table).doc(id), data);
      }
      await batch.commit();
    }
  }

  async update(
    table: string,
    id: string,
    patch: Record<string, unknown>,
  ): Promise<void> {
    const data = { ...patch };
    delete data.id;
    await this.db.collection(table).doc(id).set(data, { merge: true });
  }

  async delete(table: string, id: string): Promise<void> {
    await this.db.collection(table).doc(id).delete();
  }
}
