/**
 * Read-side compatibility for the row collections schema stage 2 removed
 * (`batting_performances`, `bowling_performances`, `fall_of_wickets`,
 * `partnerships`, `ball_by_ball`).
 *
 * {@link LegacyRowsDataSource} wraps a DataSource and answers queries on
 * those names from the documents that now hold the data, so
 * `from("batting_performances").in("match_id", ids)` keeps working while
 * reading far fewer documents:
 *
 * | filter                         | reads                                   |
 * | ------------------------------ | --------------------------------------- |
 * | `innings_id` (== / in)         | the innings documents                   |
 * | `match_id` (== / in)           | the match's innings (~2 per match)      |
 * | `user_id ==` (batting/bowling) | `player_matches` (completed innings)    |
 * | ball log by `innings_id` and `over_number` | that over document          |
 * | ball log by `innings_id` / `match_id` | the over documents (~1 per over) |
 *
 * Any other shape throws rather than scanning a collection. Other filters,
 * ordering and limits are applied in memory with Firestore semantics.
 * Identical underlying reads issued concurrently (e.g. a page loading
 * batting, bowling and fall of wickets for the same matches) share one
 * request. Writes to these names are rejected: the scoring engine owns them.
 *
 * {@link expandEmbedded} serves embedded relations such as
 * `innings(*, batting_performances(*))` straight from the parent innings
 * documents, at no extra read.
 */

import {
  applyQueryOptions,
  memoryMatches,
  type DataSource,
  type Doc,
  type NativeFilter,
  type QueryOptions,
} from "./datasource";
import { DbQueryError, type EmbeddedRows } from "./query-builder";
import type { Selection } from "./select-parser";
import { INNINGS_SUMMARY_FIELDS, ROSTER_USER_FIELDS } from "./derive.mjs";
import {
  ballRowsOf,
  battingRowsOf,
  battingRowsOfPlayerMatch,
  bowlingRowsOf,
  bowlingRowsOfPlayerMatch,
  fallOfWicketRowsOf,
  overDocId,
  OVERS_COLLECTION,
  partnershipRowsOf,
  PLAYER_MATCHES_COLLECTION,
  type OversRow,
  type PlayerMatchesRow,
} from "./scorecard";
import type { InningsRow } from "./types";

type InningsExpander = (inn: InningsRow) => object[];

const FROM_INNINGS: Record<string, { field: string; expand: InningsExpander }> =
  {
    batting_performances: { field: "batting", expand: battingRowsOf },
    bowling_performances: { field: "bowling", expand: bowlingRowsOf },
    fall_of_wickets: { field: "fall_of_wickets", expand: fallOfWicketRowsOf },
    partnerships: { field: "partnerships", expand: partnershipRowsOf },
  };

const FROM_PLAYER_MATCHES: Record<string, (doc: PlayerMatchesRow) => object[]> =
  {
    batting_performances: battingRowsOfPlayerMatch,
    bowling_performances: bowlingRowsOfPlayerMatch,
  };

const BALL_LOG = "ball_by_ball";

export function isLegacyRowTable(table: string): boolean {
  return table in FROM_INNINGS || table === BALL_LOG;
}

function asDocs(rows: object[]): Doc[] {
  return rows as unknown as Doc[];
}

function findFilter(
  filters: NativeFilter[],
  field: string,
): NativeFilter | undefined {
  return filters.find(
    (f) => f.field === field && (f.op === "==" || f.op === "in"),
  );
}

function valuesOf(f: NativeFilter): unknown[] {
  return f.op === "in" ? (f.value as unknown[]) : [f.value];
}

function unsupported(table: string, what: string): DbQueryError {
  return new DbQueryError(
    `${table} is derived from innings / over documents; ${what} is not supported`,
    "0A000",
  );
}

const byDocId = (a: Doc, b: Doc) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

/** Columns a selection reads (null for `*`). */
function selectedColumns(selection: Selection | undefined): string[] | null {
  if (!selection || selection.star) return null;
  return selection.columns;
}

/**
 * Embedded one-to-many relations served from the parent documents at no
 * extra read, when every parent carries the copy:
 *
 * - `innings(*, batting_performances(*))` etc. from the innings arrays;
 * - `teams(team_players(*, user:users(...)))` from `teams.roster`, whose
 *   player snapshots also answer the nested `users` lookups;
 * - `matches(innings(<summary columns>))` from `matches.innings_summary`
 *   (only when the selection names summary columns and no relations).
 *
 * Returns null when the parents do not carry them (callers then query).
 */
export function expandEmbedded(
  source: string,
  target: string,
  parents: Doc[],
  selection?: Selection,
): Doc[] | EmbeddedRows | null {
  if (source === "teams" && target === "team_players") {
    if (!parents.every((p) => Array.isArray(p.roster))) return null;
    const rows: Doc[] = [];
    const users: Doc[] = [];
    for (const team of parents) {
      for (const entry of team.roster as Doc[]) {
        const { user, ...row } = entry as Doc & { user?: Doc | null };
        rows.push({ ...row, team_id: row.team_id ?? team.id } as Doc);
        if (user && typeof user.id === "string") users.push(user);
      }
    }
    return {
      rows: rows.sort(byDocId),
      snapshots: [{ table: "users", columns: ROSTER_USER_FIELDS, docs: users }],
    };
  }
  if (source === "matches" && target === "innings") {
    const columns = selectedColumns(selection);
    if (
      !columns ||
      selection!.relations.length ||
      !columns.every(
        (c) => c === "match_id" || INNINGS_SUMMARY_FIELDS.includes(c as never),
      )
    ) {
      return null;
    }
    if (!parents.every((p) => Array.isArray(p.innings_summary))) return null;
    const rows = parents.flatMap((m) =>
      (m.innings_summary as Doc[]).map(
        (e) => ({ ...e, match_id: m.id }) as Doc,
      ),
    );
    return {
      rows: rows.sort(byDocId),
      partial: [...INNINGS_SUMMARY_FIELDS, "match_id"],
    };
  }
  if (source !== "innings") return null;
  const spec = FROM_INNINGS[target];
  if (!spec) return null;
  if (!parents.every((p) => Array.isArray(p[spec.field]))) return null;
  return asDocs(
    parents.flatMap((p) => spec.expand(p as unknown as InningsRow)),
  );
}

export class LegacyRowsDataSource implements DataSource {
  readonly kind: DataSource["kind"];
  private readonly inflight = new Map<string, Promise<Doc[]>>();

  constructor(readonly inner: DataSource) {
    this.kind = inner.kind;
  }

  /** One request for identical concurrent reads. */
  private shared(key: string, load: () => Promise<Doc[]>): Promise<Doc[]> {
    let pending = this.inflight.get(key);
    if (!pending) {
      pending = load().finally(() => this.inflight.delete(key));
      this.inflight.set(key, pending);
    }
    return pending;
  }

  private readInnings(filters: NativeFilter[], table: string): Promise<Doc[]> {
    const byId = findFilter(filters, "innings_id");
    if (byId) {
      const ids = Array.from(new Set(valuesOf(byId).map(String)));
      return this.shared(`innings:id:${JSON.stringify(ids)}`, () =>
        ids.length === 1
          ? this.inner.getById("innings", ids[0]!).then((d) => (d ? [d] : []))
          : this.inner.getByIds("innings", ids),
      );
    }
    const byMatch = findFilter(filters, "match_id");
    if (byMatch) {
      const filter: NativeFilter = {
        field: "match_id",
        op: byMatch.op,
        value: byMatch.value,
      };
      return this.shared(`innings:q:${JSON.stringify(filter)}`, () =>
        this.inner.query("innings", [filter]),
      );
    }
    throw unsupported(table, "a query without innings_id / match_id");
  }

  private async expand(table: string, filters: NativeFilter[]): Promise<Doc[]> {
    if (table === BALL_LOG) return this.expandBalls(filters);
    const byUser = findFilter(filters, "user_id");
    const playerExpand = FROM_PLAYER_MATCHES[table];
    if (
      byUser &&
      byUser.op === "==" &&
      playerExpand &&
      !findFilter(filters, "innings_id") &&
      !findFilter(filters, "match_id")
    ) {
      // Career history: completed innings only (see scorecard.ts).
      const filter: NativeFilter = {
        field: "user_id",
        op: "==",
        value: byUser.value,
      };
      const docs = await this.shared(
        `player_matches:${JSON.stringify(filter)}`,
        () => this.inner.query(PLAYER_MATCHES_COLLECTION, [filter]),
      );
      return asDocs(
        docs.flatMap((d) => playerExpand(d as unknown as PlayerMatchesRow)),
      );
    }
    const spec = FROM_INNINGS[table]!;
    const innings = await this.readInnings(filters, table);
    return asDocs(
      innings.flatMap((d) => spec.expand(d as unknown as InningsRow)),
    );
  }

  private async expandBalls(filters: NativeFilter[]): Promise<Doc[]> {
    const byInnings = findFilter(filters, "innings_id");
    const byOver = findFilter(filters, "over_number");
    let overs: Doc[];
    if (byInnings && byOver) {
      const ids = valuesOf(byInnings).flatMap((inn) =>
        valuesOf(byOver).map((n) => overDocId(String(inn), Number(n))),
      );
      const unique = Array.from(new Set(ids));
      overs = await this.shared(`overs:id:${JSON.stringify(unique)}`, () =>
        unique.length === 1
          ? this.inner
              .getById(OVERS_COLLECTION, unique[0]!)
              .then((d) => (d ? [d] : []))
          : this.inner.getByIds(OVERS_COLLECTION, unique),
      );
    } else {
      const by = byInnings ?? findFilter(filters, "match_id");
      if (!by) {
        throw unsupported(BALL_LOG, "a query without innings_id / match_id");
      }
      const filter: NativeFilter = {
        field: by.field,
        op: by.op,
        value: by.value,
      };
      overs = await this.shared(`overs:q:${JSON.stringify(filter)}`, () =>
        this.inner.query(OVERS_COLLECTION, [filter]),
      );
    }
    return asDocs(overs.flatMap((o) => ballRowsOf(o as unknown as OversRow)));
  }

  async getById(table: string, id: string): Promise<Doc | null> {
    if (isLegacyRowTable(table)) throw unsupported(table, "lookup by id");
    return this.inner.getById(table, id);
  }

  async getByIds(table: string, ids: string[]): Promise<Doc[]> {
    if (isLegacyRowTable(table)) throw unsupported(table, "lookup by id");
    return this.inner.getByIds(table, ids);
  }

  async query(
    table: string,
    filters: NativeFilter[],
    options?: QueryOptions,
  ): Promise<Doc[]> {
    if (!isLegacyRowTable(table)) {
      return this.inner.query(table, filters, options);
    }
    const rows = (await this.expand(table, filters))
      .filter((row) => filters.every((f) => memoryMatches(row, f)))
      .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    return applyQueryOptions(rows, filters, options);
  }

  async count(table: string, filters: NativeFilter[]): Promise<number> {
    if (!isLegacyRowTable(table)) return this.inner.count(table, filters);
    return (await this.query(table, filters)).length;
  }

  async insert(table: string, docs: Doc[]): Promise<void> {
    if (isLegacyRowTable(table)) throw unsupported(table, "writing");
    return this.inner.insert(table, docs);
  }

  async update(
    table: string,
    id: string,
    patch: Record<string, unknown>,
  ): Promise<void> {
    if (isLegacyRowTable(table)) throw unsupported(table, "writing");
    return this.inner.update(table, id, patch);
  }

  async delete(table: string, id: string): Promise<void> {
    if (isLegacyRowTable(table)) throw unsupported(table, "writing");
    return this.inner.delete(table, id);
  }
}

export function legacyRowsDataSource(inner: DataSource): LegacyRowsDataSource {
  return inner instanceof LegacyRowsDataSource
    ? inner
    : new LegacyRowsDataSource(inner);
}
