/**
 * DataSource implementation over the Firebase Admin SDK (server only).
 */

import "server-only";
import type { Firestore, Query, DocumentData } from "firebase-admin/firestore";
import {
  chunk,
  type DataSource,
  type Doc,
  type NativeFilter,
} from "./datasource";

const BATCH_LIMIT = 400;

function toDoc(id: string, data: DocumentData | undefined): Doc {
  return { ...(data ?? {}), id };
}

export class AdminDataSource implements DataSource {
  readonly kind = "admin" as const;

  constructor(private readonly db: Firestore) {}

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

  async query(table: string, filters: NativeFilter[]): Promise<Doc[]> {
    let q: Query = this.db.collection(table);
    for (const f of filters) {
      q = q.where(f.field, f.op, f.value);
    }
    const snap = await q.get();
    return snap.docs.map((d) => toDoc(d.id, d.data()));
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
