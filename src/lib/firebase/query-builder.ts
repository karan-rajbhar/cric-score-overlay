/**
 * Chainable query builder over Firestore with the same surface the app
 * already uses (`from().select().eq().order().single()`, `insert`, `update`,
 * `delete`, embedded relations, `or()` expressions).
 *
 * Equality / `in` / single-field range predicates are executed natively;
 * everything else is evaluated in memory on the fetched documents. When a
 * select's filters are all native, `order()` + `limit()`/`range()` are pushed
 * to Firestore too (see `pushdownSpec`), and `count: "exact", head: true` /
 * `relation(count)` use the `count()` aggregation. Relations are resolved with
 * batched, per-query memoised lookups. Inserts apply schema defaults, unique
 * constraints and cascading deletes that Postgres used to enforce.
 */

import {
  chunk,
  firestoreCompare,
  IN_CHUNK_SIZE,
  type DataSource,
  type Doc,
  type NativeFilter,
  type NativeOrder,
} from "./datasource";
import {
  coerceLiteral,
  matchesFilter,
  parseOrExpression,
  sortRows,
  type Filter,
  type OrderSpec,
} from "./filters";
import { isNonNull, isOrderable } from "./pushdown";
import { defaultChildOrder, resolveRelation } from "./relations";
import {
  CARRIED_SNAPSHOTS,
  CASCADE_RULES,
  HIDDEN_COLUMNS,
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

/**
 * Partial copies of documents carried by other documents (e.g. the player
 * snapshots in a team roster). A relation whose selection only names
 * `columns` is answered from them instead of reading the documents.
 */
export interface SnapshotDocs {
  table: string;
  columns: readonly string[];
  docs: Doc[];
}

export interface EmbeddedRows {
  rows: Doc[];
  /**
   * Set when the rows carry only these columns (a summary), so they must
   * not stand in for the full documents elsewhere in the query.
   */
  partial?: readonly string[];
  snapshots?: SnapshotDocs[];
}

export interface BuilderContext {
  ds: DataSource;
  /** Computes rows for a virtual view (`live_match_state`, ...). */
  resolveView?: (view: string, filters: Filter[]) => Promise<Doc[]>;
  /**
   * Children of an embedded one-to-many relation already held by the parent
   * documents (innings scorecard arrays, team rosters, innings summaries),
   * or null to query them.
   */
  expandEmbedded?: (
    source: string,
    target: string,
    parents: Doc[],
    selection: Selection,
  ) => Doc[] | EmbeddedRows | null;
  /** Called after each successful row write (server-side triggers). */
  afterWrite?: (event: WriteEvent) => Promise<void>;
  now?: () => string;
  /**
   * Set to false to disable order/limit/count pushdown and fetch every
   * matching document (the pre-pushdown behaviour). Used by tests to prove
   * both paths return the same rows.
   */
  pushdown?: boolean;
}

/** Native part of a select's filter set. */
interface NativePlan {
  /** Native filters, excluding the (chunked) `in` filter. */
  filters: NativeFilter[];
  inFilter: { field: string; values: unknown[] } | null;
  /** True when every builder filter is represented natively. */
  exact: boolean;
  /** Field carrying the pushed-down range filters, if any. */
  rangeField: string | null;
}

/** How a select is pushed down to Firestore. */
interface PushdownSpec {
  orderBy: NativeOrder[];
  limit: number;
  startAfter?: unknown[];
  /**
   * Postgres null placement differs from Firestore's (nulls lowest). When
   * the ordered page is full, a second `== null` (descending) or `!= null`
   * (ascending) query supplies the rows Postgres would place first.
   */
  splitNulls: "first" | "last" | null;
  /** A keyset page: rows stay in Firestore's order (see `keyset()`). */
  keyset?: boolean;
}

const RANGE_OPS = { gt: ">", gte: ">=", lt: "<", lte: "<=" } as const;

function isPushableRangeValue(value: unknown): boolean {
  return (
    typeof value === "string" ||
    (typeof value === "number" && Number.isFinite(value))
  );
}

function byId(a: Doc, b: Doc): number {
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

/** Firestore's order on one field (nulls lowest, ties by id alike). */
function keysetOrder(rows: Doc[], field: string, ascending: boolean): Doc[] {
  const dir = ascending ? 1 : -1;
  return rows
    .filter((row) => row[field] !== undefined)
    .sort((a, b) => dir * (firestoreCompare(a[field], b[field]) || byId(a, b)));
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

function projectRow(row: Doc, selection: Selection, table?: string): Doc {
  if (selection.star) {
    const hidden = table ? HIDDEN_COLUMNS[table as TableName] : undefined;
    if (!hidden?.some((c) => c in row)) return row;
    const out: Doc = { ...row };
    for (const c of hidden) {
      if (!selection.columns.includes(c)) delete out[c];
    }
    return out;
  }
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
  private cursor: { value: unknown; id: string } | null = null;
  private keysetMode = false;
  /** Per-execution memo of id lookups made while hydrating relations. */
  private docCache = new Map<string, Map<string, Doc | null>>();
  /** Per-execution partial documents (see {@link SnapshotDocs}). */
  private snapshotCache = new Map<
    string,
    Map<string, { doc: Doc; columns: ReadonlySet<string> }>
  >();

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

  /**
   * Prefix match on a string column, executed natively as
   * `field >= prefix AND field <= prefix + "\uf8ff"` (case-sensitive; use a
   * lower-cased column for typeahead). Combine with `.order(field)` and
   * `.limit(n)` to read at most `n` documents.
   */
  startsWith(field: string, prefix: string): this {
    this.filters.push({ type: "gte", field, value: prefix });
    this.filters.push({ type: "lte", field, value: `${prefix}\uf8ff` });
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

  /**
   * Keyset pagination: rows strictly after (`value`, `id`) in the single
   * `order()` column (ties broken by document id), e.g. the last row of the
   * previous page. Pushed to Firestore with the order + limit.
   */
  after(value: unknown, id: string): this {
    return this.keyset({ value, id });
  }

  /**
   * A keyset page (`cursor`: the previous page's last row, or null for the
   * first page), in Firestore's order on the single `order()` column:
   * nulls lowest (first ascending, last descending), ties by document id in
   * the same direction, so every page continues exactly where the previous
   * one stopped. A descending column may hold nulls.
   */
  keyset(cursor: { value: unknown; id: string } | null): this {
    this.keysetMode = true;
    this.cursor = cursor;
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
    this.docCache = new Map();
    this.snapshotCache = new Map();
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

  private get pushdownEnabled(): boolean {
    return this.ctx.pushdown !== false;
  }

  private idFilter(): Extract<Filter, { type: "eq" | "in" }> | undefined {
    return this.filters.find(
      (f): f is Extract<Filter, { type: "eq" | "in" }> =>
        (f.type === "eq" || f.type === "in") && f.field === "id",
    );
  }

  /** Splits the filter set into what Firestore can evaluate natively. */
  private planNative(): NativePlan {
    const filters: NativeFilter[] = [];
    let inFilter: NativePlan["inFilter"] = null;
    let exact = true;
    const rangeFields = new Set(
      this.filters
        .filter(
          (f) =>
            (f.type === "gt" ||
              f.type === "gte" ||
              f.type === "lt" ||
              f.type === "lte") &&
            isPushableRangeValue(f.value),
        )
        .map((f) => (f as { field: string }).field),
    );
    // Firestore needs a composite index per extra inequality field; keep
    // ranges in memory unless they all target one field.
    const rangeField =
      this.pushdownEnabled && rangeFields.size === 1
        ? [...rangeFields][0]!
        : null;
    let arrayContains = false;
    for (const f of this.filters) {
      if (f.type === "eq" && f.value !== undefined) {
        filters.push({ field: f.field, op: "==", value: f.value });
      } else if (
        f.type === "contains" &&
        f.values.length === 1 &&
        typeof f.values[0] === "string" &&
        !arrayContains
      ) {
        // Firestore allows one array-contains per query.
        arrayContains = true;
        filters.push({
          field: f.field,
          op: "array-contains",
          value: f.values[0],
        });
      } else if (f.type === "in" && !inFilter) {
        inFilter = { field: f.field, values: f.values };
      } else if (
        (f.type === "gt" ||
          f.type === "gte" ||
          f.type === "lt" ||
          f.type === "lte") &&
        f.field === rangeField &&
        isPushableRangeValue(f.value)
      ) {
        filters.push({ field: f.field, op: RANGE_OPS[f.type], value: f.value });
      } else {
        exact = false;
      }
    }
    return { filters, inFilter, exact, rangeField };
  }

  /** Rows a select needs after ordering, or null when unbounded. */
  private effectiveLimit(): number | null {
    let n: number | null = null;
    if (this.rangeBounds) n = this.rangeBounds.to + 1;
    if (this.limitCount !== null) {
      const fromLimit = (this.rangeBounds?.from ?? 0) + this.limitCount;
      n = n === null ? fromLimit : Math.min(n, fromLimit);
    }
    if (n === null && this.mode === "maybeSingle" && !this.countMode) n = 1;
    return n === null ? null : Math.max(0, n);
  }

  /**
   * Decides whether order + limit can run in Firestore with results
   * identical to fetching everything and sorting in memory:
   * - a limit (or range / maybeSingle) is present,
   * - every filter is native and the `in` list fits one query,
   * - at most one order column, which is either the range-filter column or
   *   listed in `pushdown.ts` as present on every document.
   */
  private pushdownSpec(table: string, plan: NativePlan): PushdownSpec | null {
    if (!this.pushdownEnabled || !plan.exact) return null;
    const limit = this.effectiveLimit();
    if (limit === null) return null;
    if (this.keysetMode) {
      // Keyset pages keep the native order (nulls lowest, ties by id in the
      // order's direction): no null splitting, no re-sort.
      const order = this.orders[0];
      if (
        this.orders.length !== 1 ||
        plan.inFilter ||
        (plan.rangeField && plan.rangeField !== order!.field) ||
        (!plan.rangeField &&
          !(
            isOrderable(table, order!.field) &&
            (!order!.ascending || isNonNull(table, order!.field))
          ))
      ) {
        return null;
      }
      return {
        orderBy: [
          { field: order!.field, direction: order!.ascending ? "asc" : "desc" },
        ],
        limit,
        splitNulls: null,
        keyset: true,
        ...(this.cursor
          ? { startAfter: [this.cursor.value, this.cursor.id] }
          : {}),
      };
    }
    if (plan.inFilter && plan.inFilter.values.length > IN_CHUNK_SIZE) {
      return null;
    }
    if (this.orders.length === 0) {
      // A native range makes Firestore order by that field, but unordered
      // selects return rows in id order; only a full fetch preserves that.
      if (plan.rangeField) return null;
      return { orderBy: [], limit, splitNulls: null };
    }
    if (this.orders.length > 1) return null;
    const order = this.orders[0]!;
    const orderBy: NativeOrder[] = [
      { field: order.field, direction: order.ascending ? "asc" : "desc" },
    ];
    if (plan.rangeField) {
      if (plan.rangeField !== order.field) return null;
      return { orderBy, limit, splitNulls: null };
    }
    if (plan.inFilter?.field === order.field) return null;
    if (plan.filters.some((f) => f.field === order.field)) {
      // Equality on the order column: every row ties, so the in-memory sort
      // keeps Firestore's default (id) order.
      return { orderBy: [], limit, splitNulls: null };
    }
    if (!isOrderable(table, order.field)) return null;
    // Firestore sorts nulls lowest: first ascending, last descending.
    const nativeNullsFirst = order.ascending;
    if (
      order.nullsFirst === nativeNullsFirst ||
      isNonNull(table, order.field)
    ) {
      return { orderBy, limit, splitNulls: null };
    }
    return { orderBy, limit, splitNulls: order.nullsFirst ? "first" : "last" };
  }

  private async runPushdown(
    table: string,
    filters: NativeFilter[],
    spec: PushdownSpec,
  ): Promise<Doc[]> {
    if (spec.limit === 0) return [];
    const ds = this.ctx.ds;
    let rows: Doc[];
    if (!spec.splitNulls) {
      rows = await ds.query(table, filters, {
        orderBy: spec.orderBy,
        limit: spec.limit,
        ...(spec.startAfter ? { startAfter: spec.startAfter } : {}),
      });
    } else {
      const field = spec.orderBy[0]!.field;
      const isNull = (doc: Doc) => doc[field] === null;
      // A short page already holds every match; sortRows fixes null order.
      const ordered = await ds.query(table, filters, {
        orderBy: spec.orderBy,
        limit: spec.limit,
      });
      if (ordered.length < spec.limit) {
        rows = ordered;
      } else if (spec.splitNulls === "first") {
        // Descending: Firestore sorts nulls last, Postgres first.
        const nulls = await ds.query(
          table,
          [...filters, { field, op: "==", value: null }],
          { limit: spec.limit },
        );
        rows = [...nulls, ...ordered.filter((doc) => !isNull(doc))];
      } else if (!isNull(ordered[0]!)) {
        // Ascending with no nulls at the front: there are none at all.
        rows = ordered;
      } else {
        // Ascending: Firestore sorts nulls first, Postgres last.
        const nonNull = await ds.query(
          table,
          [...filters, { field, op: "!=", value: null }],
          { orderBy: spec.orderBy, limit: spec.limit },
        );
        rows = [...nonNull, ...ordered.filter(isNull)];
      }
    }
    // The fallback path sees documents in id order before its stable sort;
    // match that so ties come out the same way.
    if (spec.keyset) return rows;
    return spec.orderBy.length ? rows.sort(byId) : rows;
  }

  /** Native pushdown + in-memory evaluation of the current filter set. */
  private async fetchRows(allowPushdown = false): Promise<Doc[]> {
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
    const idFilter = this.idFilter();

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
      const plan = this.planNative();
      const inFilter = plan.inFilter;
      const spec = allowPushdown ? this.pushdownSpec(table, plan) : null;
      if (inFilter && inFilter.values.length === 0) {
        candidates = [];
      } else if (spec) {
        const filters = inFilter
          ? [
              ...plan.filters,
              {
                field: inFilter.field,
                op: "in" as const,
                value: inFilter.values,
              },
            ]
          : plan.filters;
        candidates = await this.runPushdown(table, filters, spec);
      } else if (inFilter) {
        const batches = await Promise.all(
          chunk(inFilter.values, IN_CHUNK_SIZE).map((values) =>
            this.ctx.ds.query(table, [
              ...plan.filters,
              { field: inFilter.field, op: "in", value: values },
            ]),
          ),
        );
        candidates = batches.flat();
      } else {
        candidates = await this.ctx.ds.query(table, plan.filters);
      }
      // Native ranges come back ordered by the range field; restore the
      // id order unfiltered queries have.
      if (plan.rangeField && !spec) candidates.sort(byId);
    }

    return candidates.filter((row) =>
      this.filters.every((f) => matchesFilter(row, f)),
    );
  }

  /**
   * `count: "exact", head: true` via Firestore's count() aggregation when
   * every filter is native; null means "fetch and count rows instead".
   */
  private async nativeCount(): Promise<number | null> {
    if (!this.pushdownEnabled || isViewName(this.table)) return null;
    if (!isTableName(this.table) || this.idFilter()) return null;
    const plan = this.planNative();
    if (!plan.exact) return null;
    let total: number;
    if (plan.inFilter) {
      const values = Array.from(new Set(plan.inFilter.values));
      const field = plan.inFilter.field;
      const counts = await Promise.all(
        chunk(values, IN_CHUNK_SIZE).map((group) =>
          this.ctx.ds.count(this.table, [
            ...plan.filters,
            { field, op: "in", value: group },
          ]),
        ),
      );
      total = counts.reduce((a, b) => a + b, 0);
    } else {
      total = await this.ctx.ds.count(this.table, plan.filters);
    }
    // Mirror applyOrderAndLimit on a list of `total` rows.
    if (this.rangeBounds) {
      total = Math.max(
        0,
        Math.min(total, this.rangeBounds.to + 1) - this.rangeBounds.from,
      );
    }
    if (this.limitCount !== null) total = Math.min(total, this.limitCount);
    return total;
  }

  /** Batched id lookup, memoised for the duration of one execution. */
  private async getManyCached(table: string, ids: string[]): Promise<Doc[]> {
    let cache = this.docCache.get(table);
    if (!cache) {
      cache = new Map();
      this.docCache.set(table, cache);
    }
    const missing = ids.filter((id) => !cache.has(id));
    if (missing.length) {
      const docs = await this.ctx.ds.getByIds(table, missing);
      for (const id of missing) cache.set(id, null);
      for (const doc of docs) cache.set(doc.id, structuredClone(doc));
    }
    const out: Doc[] = [];
    for (const id of ids) {
      const doc = cache.get(id);
      if (doc) out.push(structuredClone(doc));
    }
    return out;
  }

  private remember(table: string, docs: Doc[]): void {
    let cache = this.docCache.get(table);
    if (!cache) {
      cache = new Map();
      this.docCache.set(table, cache);
    }
    for (const doc of docs) {
      if (!cache.has(doc.id)) cache.set(doc.id, structuredClone(doc));
    }
  }

  private rememberSnapshots(snapshots: readonly SnapshotDocs[]): void {
    for (const snap of snapshots) {
      let cache = this.snapshotCache.get(snap.table);
      if (!cache) {
        cache = new Map();
        this.snapshotCache.set(snap.table, cache);
      }
      const columns = new Set(snap.columns);
      for (const doc of snap.docs) {
        if (!cache.has(doc.id)) cache.set(doc.id, { doc, columns });
      }
    }
  }

  /** Partial documents that cover every column `selection` asks for. */
  private fromSnapshots(
    table: string,
    ids: string[],
    selection: Selection,
  ): Map<string, Doc> {
    const out = new Map<string, Doc>();
    const cache = this.snapshotCache.get(table);
    if (!cache || selection.star || selection.relations.length) return out;
    for (const id of ids) {
      const hit = cache.get(id);
      if (hit && selection.columns.every((c) => hit.columns.has(c))) {
        out.set(id, structuredClone(hit.doc));
      }
    }
    return out;
  }

  private applyOrderAndLimit(rows: Doc[]): Doc[] {
    const order = this.orders[0];
    let out =
      this.keysetMode && order
        ? keysetOrder(rows, order.field, order.ascending)
        : sortRows(rows, this.orders);
    const cursor = this.cursor;
    if (cursor && order) {
      // Same rows as the native keyset page.
      const dir = order.ascending ? 1 : -1;
      const after = (row: Doc) => {
        const v = row[order.field];
        if (v === undefined) return false;
        const c = firestoreCompare(v, cursor.value);
        if (c !== 0) return c * dir > 0;
        return (row.id > cursor.id ? 1 : row.id < cursor.id ? -1 : 0) * dir > 0;
      };
      out = out.filter(after);
    }
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
    if (this.countMode && this.headOnly) {
      const count = await this.nativeCount();
      if (count !== null) return { data: [], error: null, count };
    }
    const rows = this.applyOrderAndLimit(await this.fetchRows(true));
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
        const carried =
          CARRIED_SNAPSHOTS[source as TableName]?.[strategy.localField];
        if (carried && carried.table === rel.target) {
          const docs = rows
            .map((row) => row[carried.field] as Doc | null | undefined)
            .filter(
              (d): d is Doc =>
                !!d && typeof d === "object" && typeof d.id === "string",
            )
            .filter((d) =>
              rows.some((row) => row[strategy.localField] === d.id),
            );
          this.rememberSnapshots([
            { table: carried.table, columns: carried.columns, docs },
          ]);
        }
        const covered = this.fromSnapshots(rel.target, ids, rel.selection);
        const rest = ids.filter((id) => !covered.has(id));
        const related = [
          ...covered.values(),
          ...(rest.length ? await this.getManyCached(rel.target, rest) : []),
        ];
        const hydratedRelated = await this.hydrate(
          related,
          rel.target,
          rel.selection,
        );
        // By position: projection drops `id` when the selection omits it.
        const byId = new Map(
          related.map((doc, i) => [doc.id, hydratedRelated[i]!]),
        );
        for (const row of rows) {
          const key = row[strategy.localField];
          const doc = typeof key === "string" ? byId.get(key) : undefined;
          row[rel.alias] = doc
            ? projectRow(doc, rel.selection, rel.target)
            : null;
        }
        continue;
      }

      const parentIds = Array.from(new Set(rows.map((row) => row.id)));
      const expansion =
        this.ctx.expandEmbedded?.(source, rel.target, rows, rel.selection) ??
        null;
      const embedded = Array.isArray(expansion)
        ? expansion
        : (expansion?.rows ?? null);
      if (expansion && !Array.isArray(expansion)) {
        this.rememberSnapshots(expansion.snapshots ?? []);
      }
      const partial =
        expansion && !Array.isArray(expansion) ? expansion.partial : undefined;
      if (rel.countOnly && this.pushdownEnabled && !embedded) {
        // One count() aggregation per parent (1 billed read each) instead
        // of reading every child document.
        const counts = await Promise.all(
          parentIds.map(
            async (id) =>
              [
                id,
                await this.ctx.ds.count(rel.target, [
                  { field: strategy.foreignField, op: "==", value: id },
                ]),
              ] as const,
          ),
        );
        const byParent = new Map(counts);
        for (const row of rows) {
          row[rel.alias] = [{ count: byParent.get(row.id) ?? 0 }];
        }
        continue;
      }
      const children =
        embedded ??
        (
          await Promise.all(
            chunk(parentIds, IN_CHUNK_SIZE).map((ids) =>
              this.ctx.ds.query(rel.target, [
                { field: strategy.foreignField, op: "in", value: ids },
              ]),
            ),
          )
        ).flat();
      if (partial) {
        this.rememberSnapshots([
          { table: rel.target, columns: partial, docs: children },
        ]);
      } else {
        this.remember(rel.target, children);
      }
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
        children.map((doc, i) => [doc.id, hydratedChildren[i]!]),
      );
      for (const row of rows) {
        const list = (grouped.get(row.id) ?? [])
          .map((child) => hydratedById.get(child.id) ?? child)
          .map((child) => projectRow(child, rel.selection, rel.target));
        row[rel.alias] = sortRows(list, orders);
      }
    }

    return rows.map((row) => projectRow(row, selection, source));
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
          // Hooks see the unlink like any other update (e.g. a match that
          // leaves a deleted club moves its player records).
          await this.ctx.afterWrite?.({
            table: rule.table,
            op: "update",
            before: child,
            after: { ...child, [rule.column]: null },
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
