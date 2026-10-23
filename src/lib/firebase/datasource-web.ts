/**
 * DataSource implementation over the Firebase web SDK (browser only).
 *
 * Reads are governed by `firestore.rules`; the browser never writes domain
 * data directly (all mutations go through server actions).
 */

import "client-only";
import {
  collection,
  deleteDoc,
  doc,
  documentId,
  getDoc,
  getCountFromServer,
  getDocs,
  limit,
  orderBy,
  query,
  setDoc,
  startAfter,
  where,
  writeBatch,
  type Firestore,
  type DocumentData,
  type QueryConstraint,
} from "firebase/firestore";
import {
  chunk,
  type DataSource,
  type Doc,
  type NativeFilter,
  type QueryOptions,
} from "./datasource";

function toDoc(id: string, data: DocumentData | undefined): Doc {
  return { ...(data ?? {}), id };
}

export class WebDataSource implements DataSource {
  readonly kind = "web" as const;

  constructor(private readonly db: Firestore) {}

  async getById(table: string, id: string): Promise<Doc | null> {
    const snap = await getDoc(doc(this.db, table, id));
    return snap.exists() ? toDoc(snap.id, snap.data()) : null;
  }

  async getByIds(table: string, ids: string[]): Promise<Doc[]> {
    const unique = Array.from(new Set(ids.filter(Boolean)));
    if (unique.length === 0) return [];
    const out: Doc[] = [];
    for (const group of chunk(unique, 30)) {
      const snap = await getDocs(
        query(collection(this.db, table), where(documentId(), "in", group)),
      );
      for (const d of snap.docs) out.push(toDoc(d.id, d.data()));
    }
    return out;
  }

  async query(
    table: string,
    filters: NativeFilter[],
    options?: QueryOptions,
  ): Promise<Doc[]> {
    const constraints: QueryConstraint[] = filters.map((f) =>
      where(f.field, f.op, f.value),
    );
    for (const o of options?.orderBy ?? []) {
      constraints.push(orderBy(o.field, o.direction));
    }
    if (options?.startAfter && options.orderBy?.length) {
      // Ties by document id in the last order's direction (Firestore's own).
      const last = options.orderBy[options.orderBy.length - 1]!;
      constraints.push(
        orderBy(documentId(), last.direction),
        startAfter(...options.startAfter),
      );
    }
    if (options?.limit !== undefined) constraints.push(limit(options.limit));
    const snap = await getDocs(
      query(collection(this.db, table), ...constraints),
    );
    return snap.docs.map((d) => toDoc(d.id, d.data()));
  }

  async count(table: string, filters: NativeFilter[]): Promise<number> {
    const constraints = filters.map((f) => where(f.field, f.op, f.value));
    const snap = await getCountFromServer(
      query(collection(this.db, table), ...constraints),
    );
    return snap.data().count;
  }

  async insert(table: string, docs: Doc[]): Promise<void> {
    for (const group of chunk(docs, 400)) {
      const batch = writeBatch(this.db);
      for (const item of group) {
        const { id, ...data } = item;
        batch.set(doc(this.db, table, id), data);
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
    await setDoc(doc(this.db, table, id), data, { merge: true });
  }

  async delete(table: string, id: string): Promise<void> {
    await deleteDoc(doc(this.db, table, id));
  }
}
