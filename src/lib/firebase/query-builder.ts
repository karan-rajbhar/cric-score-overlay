/**
 * Chainable query builder over Firestore with the same surface the app
 * already uses (`from().select().eq().order().single()`, `insert`, `update`,
 * `delete`, embedded relations, `or()` expressions).
 *
 * Equality / `in` predicates are executed natively; everything else is
 * evaluated in memory on the fetched documents. Relations are resolved with
 * batched lookups. Inserts apply schema defaults, unique constraints and
 * cascading deletes that Postgres used to enforce.
 */

import { chunk, IN_CHUNK_SIZE, type DataSource, type Doc } from "./datasource";
import {
  coerceLiteral,
  matchesFilter,
  parseOrExpression,
  sortRows,
  type Filter,
  type OrderSpec,
} from "./filters";
import { defaultChildOrder, resolveRelation } from "./relations";
import {
  CASCADE_RULES,
  TABLE_COLUMNS,
  TABLE_DEFAULTS,
  TIMESTAMP_DEFAULTS,
  UNIQUE_CONSTRAINTS,
  hasColumn,
  isTableName,
  isViewName,
} from "./schema";
import { parseSelect, STAR_SELECTION, type Selection } from "./select-parser";
import type {
  DbError,
  DbResult,
  InsertRow,
  ResultRow,
  SourceName,
  TableName,
  UpdateRow,
} from "./types";

export interface WriteEvent {
  table: TableName;
  op: "insert" | "update" | "delete";
  before: Doc | null;
  after: Doc | null;
}

export interface BuilderContext {
  ds: DataSource;
  /** Computes rows for a virtual view (`live_match_state`, ...). */
  resolveView?: (view: string, filters: Filter[]) => Promise<Doc[]>;
  /** Called after each successful row write (server-side triggers). */
  afterWrite?: (event: WriteEvent) => Promise<void>;
  now?: () => string;
}

export class DbQueryError extends Error implements DbError {
  code?: string;
  details?: string;
  constructor(message: string, code?: string, details?: string) {
    super(message);
    this.name = "DbQueryError";
    this.code = code;
    this.details = details;
  }
}

type Mode = "many" | "single" | "maybeSingle";
type Op = "select" | "insert" | "update" | "delete" | "upsert";

export function newId(): string {
  return crypto.randomUUID();
}

function toError(err: unknown): DbError {
  if (err instanceof DbQueryError) {
    return { message: err.message, code: err.code, details: err.details };
  }
  if (err instanceof Error) return { message: err.message };
  return { message: String(err) };
}

function projectRow(row: Doc, selection: Selection): Doc {
  if (selection.star) return row;
  const out: Doc = { id: row.id };
  for (const col of selection.columns) {
    out[col] = row[col] ?? null;
  }
  for (const rel of selection.relations) {
    out[rel.alias] = row[rel.alias] ?? null;
  }
  if (!selection.columns.includes("id") && !selection.star) {
    // PostgREST omits unselected columns; keep `id` out unless requested so
    // callers that spread rows into inserts don't accidentally reuse ids.
    delete (out as Record<string, unknown>).id;
  }
  return out;
}

export class QueryBuilder<T extends SourceName, R = ResultRow<T>[]>
  implements PromiseLike<DbResult<R>>
{
  private op: Op = "select";
  private selection: Selection = STAR_SELECTION;
  private filters: Filter[] = [];
  private orders: OrderSpec[] = [];
  private limitCount: number | null = null;
  private rangeBounds: { from: number; to: number } | null = null;
  private mode: Mode = "many";
  private payload: Record<string, unknown> | Record<string, unknown>[] | null =
    null;
  private returning = false;
  private countMode: "exact" | null = null;
  private headOnly = false;
  private upsertConflict: string[] | null = null;

  constructor(
    private readonly ctx: BuilderContext,
    readonly table: string,
  ) {}

  // ---------------------------------------------------------------------
  // Operations
  // ---------------------------------------------------------------------

  select(
    columns?: string,
    options?: { count?: "exact"; head?: boolean },
  ): this {
    this.selection = parseSelect(columns);
    if (this.op !== "select") this.returning = true;
    if (options?.count) this.countMode = options.count;
    if (options?.head) this.headOnly = true;
    return this;
  }

  insert(
    values:
      | InsertRow<Extract<T, TableName>>
      | InsertRow<Extract<T, TableName>>[],
  ): this {
    this.op = "insert";
    this.payload = values as
      | Record<string, unknown>
      | Record<string, unknown>[];
    return this;
  }

  upsert(
    values:
      | InsertRow<Extract<T, TableName>>
      | InsertRow<Extract<T, TableName>>[],
    options?: { onConflict?: string },
  ): this {
    this.op = "upsert";
    this.payload = values as
      | Record<string, unknown>
      | Record<string, unknown>[];
    this.upsertConflict = options?.onConflict
      ? options.onConflict.split(",").map((c) => c.trim())
      : ["id"];
    return this;
  }

  update(values: UpdateRow<Extract<T, TableName>>): this {
    this.op = "update";
    this.payload = values as Record<string, unknown>;
    return this;
  }

  delete(): this {
    this.op = "delete";
    return this;
  }

  // ---------------------------------------------------------------------
  // Filters
  // ---------------------------------------------------------------------

  eq(field: string, value: unknown): this {
    this.filters.push({ type: "eq", field, value });
    return this;
  }

  neq(field: string, value: unknown): this {
    this.filters.push({ type: "neq", field, value });
    return this;
  }

  in(field: string, values: readonly unknown[]): this {
    this.filters.push({ type: "in", field, values: [...values] });
    return this;
  }

  ilike(field: string, pattern: string): this {
    this.filters.push({ type: "like", field, pattern, caseInsensitive: true });
    return this;
  }

  like(field: string, pattern: string): this {
    this.filters.push({ type: "like", field, pattern, caseInsensitive: false });
    return this;
  }

  is(field: string, value: null | boolean): this {
    this.filters.push({ type: "is", field, value });
    return this;
  }

  gt(field: string, value: unknown): this {
    this.filters.push({ type: "gt", field, value });
    return this;
  }

  gte(field: string, value: unknown): this {
    this.filters.push({ type: "gte", field, value });
    return this;
  }

  lt(field: string, value: unknown): this {
    this.filters.push({ type: "lt", field, value });
    return this;
  }

  lte(field: string, value: unknown): this {
    this.filters.push({ type: "lte", field, value });
    return this;
  }

  contains(field: string, values: readonly unknown[]): this {
    this.filters.push({ type: "contains", field, values: [...values] });
    return this;
  }

  /** PostgREST `or` expression, e.g. `"a.eq.1,b.ilike.%x%,and(c.eq.1,d.eq.2)"`. */
  or(expression: string): this {
    this.filters.push(parseOrExpression(expression));
    return this;
  }

  not(field: string, operator: string, value: unknown): this {
    const inner = parseOrExpression(`${field}.${operator}.${String(value)}`);
    this.filters.push({ type: "not", filter: inner });
    return this;
  }

  filter(field: string, operator: string, value: unknown): this {
    this.filters.push(
      parseOrExpression(
        `${field}.${operator}.${typeof value === "string" ? value : JSON.stringify(value)}`,
      ),
    );
    return this;
  }

  // ---------------------------------------------------------------------
  // Modifiers
  // ---------------------------------------------------------------------

  order(
    field: string,
    options?: { ascending?: boolean; nullsFirst?: boolean },
  ): this {
    const ascending = options?.ascending ?? true;
    this.orders.push({
      field,
      ascending,
      // Postgres: ASC => NULLS LAST, DESC => NULLS FIRST
      nullsFirst: options?.nullsFirst ?? !ascending,
    });
    return this;
  }

  limit(count: number): this {
    this.limitCount = count;
    return this;
  }

  range(from: number, to: number): this {
    this.rangeBounds = { from, to };
    return this;
  }

  single(): QueryBuilder<T, ResultRow<T>> {
    this.mode = "single";
    return this as unknown as QueryBuilder<T, ResultRow<T>>;
  }

  maybeSingle(): QueryBuilder<T, ResultRow<T> | null> {
    this.mode = "maybeSingle";
    return this as unknown as QueryBuilder<T, ResultRow<T> | null>;
  }

  // ---------------------------------------------------------------------
  // Execution
  // ---------------------------------------------------------------------

  then<TResult1 = DbResult<R>, TResult2 = never>(
    onfulfilled?:
      | ((value: DbResult<R>) => TResult1 | PromiseLike<TResult1>)
      | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2> {
    return this.execute().then(onfulfilled, onrejected);
  }

  async execute(): Promise<DbResult<R>> {
    try {
      switch (this.op) {
        case "select":
          return (await this.runSelect()) as DbResult<R>;
        case "insert":
          return (await this.runInsert()) as DbResult<R>;
        case "upsert":
          return (await this.runUpsert()) as DbResult<R>;
        case "update":
          return (await this.runUpdate()) as DbResult<R>;
        case "delete":
          return (await this.runDelete()) as DbResult<R>;
      }
    } catch (err) {
      return { data: null, error: toError(err) };
    }
  }

  private now(): string {
    return this.ctx.now ? this.ctx.now() : new Date().toISOString();
  }

  private requireTable(): TableName {
    if (!isTableName(this.table)) {
      throw new DbQueryError(`Cannot write to "${this.table}"`, "42P01");
    }
    return this.table;
  }

  /** Native pushdown + in-memory evaluation of the current filter set. */
  private async fetchRows(): Promise<Doc[]> {
    if (isViewName(this.table)) {
      if (!this.ctx.resolveView) {
        throw new DbQueryError(`View "${this.table}" is not available here`);
      }
      const rows = await this.ctx.resolveView(this.table, this.filters);
      return rows.filter((row) =>
        this.filters.every((f) => matchesFilter(row, f)),
      );
    }

    const table = this.requireTable();
    const idFilter = this.filters.find(
      (f): f is Extract<Filter, { type: "eq" | "in" }> =>
        (f.type === "eq" || f.type === "in") && f.field === "id",
    );

    let candidates: Doc[];
    if (idFilter) {
      if (idFilter.type === "eq") {
        const doc = await this.ctx.ds.getById(table, String(idFilter.value));
        candidates = doc ? [doc] : [];
      } else {
        const ids = idFilter.values.map(String);
        candidates = ids.length ? await this.ctx.ds.getByIds(table, ids) : [];
      }
    } else {
      const native: { field: string; op: "==" | "in"; value: unknown }[] = [];
      let inFilter: Extract<Filter, { type: "in" }> | null = null;
      for (const f of this.filters) {
        if (f.type === "eq" && f.value !== undefined) {
          native.push({ field: f.field, op: "==", value: f.value });
        } else if (f.type === "in" && !inFilter) {
          inFilter = f;
        }
      }
      if (inFilter) {
        if (inFilter.values.length === 0) {
          candidates = [];
        } else {
          const batches = await Promise.all(
            chunk(inFilter.values, IN_CHUNK_SIZE).map((values) =>
              this.ctx.ds.query(table, [
                ...native,
                { field: inFilter!.field, op: "in", value: values },
              ]),
            ),
          );
          candidates = batches.flat();
        }
      } else {
        candidates = await this.ctx.ds.query(table, native);
      }
    }

    return candidates.filter((row) =>
      this.filters.every((f) => matchesFilter(row, f)),
    );
  }

  private applyOrderAndLimit(rows: Doc[]): Doc[] {
    let out = sortRows(rows, this.orders);
    if (this.rangeBounds) {
      out = out.slice(this.rangeBounds.from, this.rangeBounds.to + 1);
    }
    if (this.limitCount !== null) {
      out = out.slice(0, this.limitCount);
    }
    return out;
  }

  private finalize(rows: Doc[]): DbResult<unknown> {
    if (this.mode === "single") {
      if (rows.length === 1) return { data: rows[0]!, error: null };
      return {
        data: null,
        error: {
          code: "PGRST116",
          message:
            rows.length === 0
              ? "JSON object requested, multiple (or no) rows returned"
              : `JSON object requested, multiple (or no) rows returned (${rows.length} rows)`,
        },
      };
    }
    if (this.mode === "maybeSingle") {
      return { data: rows[0] ?? null, error: null };
    }
    return { data: rows, error: null };
  }

  private async runSelect(): Promise<DbResult<unknown>> {
    const rows = this.applyOrderAndLimit(await this.fetchRows());
    if (this.countMode && this.headOnly) {
      return { data: [], error: null, count: rows.length };
    }
    const hydrated = await this.hydrate(rows, this.table, this.selection);
    const result = this.finalize(hydrated);
    if (this.countMode) result.count = rows.length;
    return result;
  }

  /** Attaches embedded relations and projects columns. */
  private async hydrate(
    rows: Doc[],
    source: string,
    selection: Selection,
  ): Promise<Doc[]> {
    if (rows.length === 0) return rows;
    for (const rel of selection.relations) {
      const strategy = resolveRelation(source, rel.target, rel.hint);
      if (!strategy) {
        for (const row of rows)
          row[rel.alias] = rel.countOnly ? [{ count: 0 }] : null;
        continue;
      }

      if (strategy.kind === "many-to-one") {
        const ids = Array.from(
          new Set(
            rows
              .map((row) => row[strategy.localField])
              .filter(
                (v): v is string => typeof v === "string" && v.length > 0,
              ),
          ),
        );
        const related = ids.length
          ? await this.ctx.ds.getByIds(rel.target, ids)
          : [];
        const hydratedRelated = await this.hydrate(
          related,
          rel.target,
          rel.selection,
        );
        const byId = new Map(hydratedRelated.map((doc) => [doc.id, doc]));
        for (const row of rows) {
          const key = row[strategy.localField];
          const doc = typeof key === "string" ? byId.get(key) : undefined;
          row[rel.alias] = doc ? projectRow(doc, rel.selection) : null;
        }
        continue;
      }

      const parentIds = Array.from(new Set(rows.map((row) => row.id)));
      const batches = await Promise.all(
        chunk(parentIds, IN_CHUNK_SIZE).map((ids) =>
          this.ctx.ds.query(rel.target, [
            { field: strategy.foreignField, op: "in", value: ids },
          ]),
        ),
      );
      const children = batches.flat();
      const grouped = new Map<string, Doc[]>();
      for (const child of children) {
        const key = child[strategy.foreignField];
        if (typeof key !== "string") continue;
        const list = grouped.get(key) ?? [];
        list.push(child);
        grouped.set(key, list);
      }

      if (rel.countOnly) {
        for (const row of rows) {
          row[rel.alias] = [{ count: grouped.get(row.id)?.length ?? 0 }];
        }
        continue;
      }

      const orderFields = defaultChildOrder(rel.target);
      const orders: OrderSpec[] = orderFields.map((field) => ({
        field,
        ascending: true,
        nullsFirst: false,
      }));
      const hydratedChildren = await this.hydrate(
        children,
        rel.target,
        rel.selection,
      );
      const hydratedById = new Map(
        hydratedChildren.map((doc) => [doc.id, doc]),
      );
      for (const row of rows) {
        const list = (grouped.get(row.id) ?? [])
          .map((child) => hydratedById.get(child.id) ?? child)
          .map((child) => projectRow(child, rel.selection));
        row[rel.alias] = sortRows(list, orders);
      }
    }

    return rows.map((row) => projectRow(row, selection));
  }

  // ---------------------------------------------------------------------
  // Writes
  // ---------------------------------------------------------------------

  private normalizeInsert(
    table: TableName,
    values: Record<string, unknown>,
  ): Doc {
    const doc: Doc = {
      id: typeof values.id === "string" && values.id ? values.id : newId(),
    };
    const defaults = TABLE_DEFAULTS[table] ?? {};
    const timestamps = TIMESTAMP_DEFAULTS[table] ?? [];
    const now = this.now();
    for (const col of TABLE_COLUMNS[table]) {
      if (col === "id") continue;
      if (col in values && values[col] !== undefined) {
        doc[col] = values[col];
      } else if (timestamps.includes(col)) {
        doc[col] = now;
      } else if (col in defaults) {
        const d = defaults[col];
        doc[col] = d && typeof d === "object" ? structuredClone(d) : d;
      } else {
        doc[col] = null;
      }
    }
    for (const [key, value] of Object.entries(values)) {
      if (!(key in doc) && value !== undefined) doc[key] = value;
    }
    return doc;
  }

  private async assertUnique(
    table: TableName,
    doc: Doc,
    excludeId?: string,
  ): Promise<void> {
    const constraints = UNIQUE_CONSTRAINTS[table] ?? [];
    for (const constraint of constraints) {
      const values = constraint.columns.map((c) => doc[c]);
      if (values.some((v) => v === null || v === undefined)) continue;
      const [firstColumn] = constraint.columns;
      const firstValue = constraint.caseInsensitive
        ? String(values[0]).toLowerCase()
        : values[0];
      const candidates = await this.ctx.ds.query(table, [
        { field: firstColumn!, op: "==", value: firstValue },
      ]);
      const clash = candidates.find((existing) => {
        if (existing.id === doc.id || existing.id === excludeId) return false;
        return constraint.columns.every((col, i) => {
          const a = existing[col];
          const b = values[i];
          if (constraint.caseInsensitive) {
            return String(a).toLowerCase() === String(b).toLowerCase();
          }
          return a === b;
        });
      });
      if (clash) {
        throw new DbQueryError(
          `duplicate key value violates unique constraint "${constraint.name}"`,
          "23505",
        );
      }
    }
  }

  private async assignBallSequence(doc: Doc): Promise<void> {
    if (typeof doc.seq === "number") return;
    const matchId = doc.match_id;
    if (typeof matchId !== "string") {
      doc.seq = Date.now();
      return;
    }
    const match = await this.ctx.ds.getById("matches", matchId);
    const next =
      (typeof match?.last_ball_seq === "number" ? match.last_ball_seq : 0) + 1;
    doc.seq = next;
    if (match)
      await this.ctx.ds.update("matches", matchId, { last_ball_seq: next });
  }

  private async runInsert(): Promise<DbResult<unknown>> {
    const table = this.requireTable();
    const list = Array.isArray(this.payload)
      ? this.payload
      : this.payload
        ? [this.payload]
        : [];
    const docs: Doc[] = [];
    for (const values of list) {
      const doc = this.normalizeInsert(table, values);
      if (table === "ball_by_ball") await this.assignBallSequence(doc);
      await this.assertUnique(table, doc);
      docs.push(doc);
    }
    if (docs.length) await this.ctx.ds.insert(table, docs);
    if (this.ctx.afterWrite) {
      for (const doc of docs) {
        await this.ctx.afterWrite({
          table,
          op: "insert",
          before: null,
          after: doc,
        });
      }
    }
    if (!this.returning) return { data: null, error: null };
    const hydrated = await this.hydrate(
      structuredClone(docs),
      table,
      this.selection,
    );
    return this.finalize(hydrated);
  }

  private async runUpsert(): Promise<DbResult<unknown>> {
    const table = this.requireTable();
    const list = Array.isArray(this.payload)
      ? this.payload
      : this.payload
        ? [this.payload]
        : [];
    const conflict = this.upsertConflict ?? ["id"];
    const written: Doc[] = [];
    for (const values of list) {
      let existing: Doc | null = null;
      if (
        conflict.length === 1 &&
        conflict[0] === "id" &&
        typeof values.id === "string"
      ) {
        existing = await this.ctx.ds.getById(table, values.id);
      } else if (
        conflict.every((c) => values[c] !== undefined && values[c] !== null)
      ) {
        const [first, ...rest] = conflict;
        const candidates = await this.ctx.ds.query(table, [
          { field: first!, op: "==", value: values[first!] },
        ]);
        existing =
          candidates.find((c) => rest.every((col) => c[col] === values[col])) ??
          null;
      }
      if (existing) {
        const patch: Record<string, unknown> = { ...values };
        delete patch.id;
        if (hasColumn(table, "updated_at") && patch.updated_at === undefined) {
          patch.updated_at = this.now();
        }
        await this.ctx.ds.update(table, existing.id, patch);
        const after = { ...existing, ...patch, id: existing.id };
        written.push(after);
        if (this.ctx.afterWrite) {
          await this.ctx.afterWrite({
            table,
            op: "update",
            before: existing,
            after,
          });
        }
      } else {
        const doc = this.normalizeInsert(table, values);
        await this.assertUnique(table, doc);
        await this.ctx.ds.insert(table, [doc]);
        written.push(doc);
        if (this.ctx.afterWrite) {
          await this.ctx.afterWrite({
            table,
            op: "insert",
            before: null,
            after: doc,
          });
        }
      }
    }
    if (!this.returning) return { data: null, error: null };
    const hydrated = await this.hydrate(
      structuredClone(written),
      table,
      this.selection,
    );
    return this.finalize(hydrated);
  }

  private async runUpdate(): Promise<DbResult<unknown>> {
    const table = this.requireTable();
    const patch: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(this.payload ?? {})) {
      if (value !== undefined) patch[key] = value;
    }
    if (hasColumn(table, "updated_at") && patch.updated_at === undefined) {
      patch.updated_at = this.now();
    }
    const targets = await this.fetchRows();
    const updated: Doc[] = [];
    for (const before of targets) {
      const after: Doc = { ...before, ...patch, id: before.id };
      if (
        "id" in patch &&
        typeof patch.id === "string" &&
        patch.id !== before.id
      ) {
        // Primary-key rewrite: move the document to the new id.
        after.id = patch.id;
        await this.assertUnique(table, after, before.id);
        await this.ctx.ds.insert(table, [after]);
        await this.ctx.ds.delete(table, before.id);
      } else {
        await this.assertUnique(table, after, before.id);
        await this.ctx.ds.update(table, before.id, patch);
      }
      updated.push(after);
      if (this.ctx.afterWrite) {
        await this.ctx.afterWrite({ table, op: "update", before, after });
      }
    }
    if (!this.returning) return { data: null, error: null };
    const hydrated = await this.hydrate(
      structuredClone(updated),
      table,
      this.selection,
    );
    return this.finalize(hydrated);
  }

  private async runDelete(): Promise<DbResult<unknown>> {
    const table = this.requireTable();
    const targets = await this.fetchRows();
    for (const doc of targets) {
      await this.cascadeDelete(table, doc);
    }
    if (!this.returning) return { data: null, error: null };
    return this.finalize(structuredClone(targets));
  }

  private async cascadeDelete(table: TableName, doc: Doc): Promise<void> {
    const rules = CASCADE_RULES[table] ?? [];
    for (const rule of rules) {
      const children = await this.ctx.ds.query(rule.table, [
        { field: rule.column, op: "==", value: doc.id },
      ]);
      for (const child of children) {
        if (rule.action === "cascade") {
          await this.cascadeDelete(rule.table, child);
        } else {
          await this.ctx.ds.update(rule.table, child.id, {
            [rule.column]: null,
          });
        }
      }
    }
    await this.ctx.ds.delete(table, doc.id);
    if (this.ctx.afterWrite) {
      await this.ctx.afterWrite({
        table,
        op: "delete",
        before: doc,
        after: null,
      });
    }
  }
}

/** Convenience used by RPC code to read a literal the way filters do. */
export { coerceLiteral };
