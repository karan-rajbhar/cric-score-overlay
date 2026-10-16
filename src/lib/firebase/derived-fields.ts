/**
 * Server-side DataSource wrapper that keeps derived fields in step with
 * every write, whichever path makes it (query builder, RPC code, profile
 * re-mapping):
 *
 * - search keys (`name_lower` / `title_lower`, `search_prefixes`, see
 *   `derive.mjs`) on users, teams, clubs, tournaments and matches;
 * - `teams.roster` when team_players change;
 * - `club_memberships.user_snapshot` when a membership's user changes;
 * - roster entries, membership snapshots and leaderboard names when a
 *   profile's name, avatar or username changes.
 *
 * Reads pass straight through. Updates that touch a search source field
 * read the document first (renames are rare) so the keys are computed from
 * the whole document.
 */

import type { DataSource, Doc, NativeFilter, QueryOptions } from "./datasource";
import { refreshPlayerIdentity, refreshRoster } from "./denorm";
import { SEARCH_FIELDS, searchFieldsOf, userSnapshot } from "./derive.mjs";

const IDENTITY_FIELDS = ["full_name", "avatar_url", "username"] as const;

function touches(patch: Record<string, unknown>, fields: readonly string[]) {
  return fields.some((f) => f in patch);
}

export class DerivedFieldsDataSource implements DataSource {
  readonly kind: DataSource["kind"];

  constructor(readonly inner: DataSource) {
    this.kind = inner.kind;
  }

  getById(table: string, id: string) {
    return this.inner.getById(table, id);
  }

  getByIds(table: string, ids: string[]) {
    return this.inner.getByIds(table, ids);
  }

  query(table: string, filters: NativeFilter[], options?: QueryOptions) {
    return this.inner.query(table, filters, options);
  }

  count(table: string, filters: NativeFilter[]) {
    return this.inner.count(table, filters);
  }

  /** Profile snapshots for the given user ids (one batched read). */
  private async snapshots(ids: unknown[]): Promise<Map<string, Doc>> {
    const wanted = Array.from(
      new Set(ids.filter((id): id is string => typeof id === "string" && !!id)),
    );
    const users = wanted.length
      ? await this.inner.getByIds("users", wanted)
      : [];
    return new Map(users.map((u) => [u.id, u]));
  }

  async insert(table: string, docs: Doc[]): Promise<void> {
    let out = docs.map((doc) => {
      const derived = searchFieldsOf(table, doc);
      return derived ? { ...doc, ...derived } : doc;
    });
    if (table === "club_memberships") {
      const users = await this.snapshots(out.map((d) => d.user_id));
      out = out.map((d) => ({
        ...d,
        user_snapshot: userSnapshot(users.get(String(d.user_id))),
      }));
    }
    await this.inner.insert(table, out);
    if (table === "team_players") {
      const teams = new Set(
        out
          .map((d) => d.team_id)
          .filter((id): id is string => typeof id === "string"),
      );
      for (const teamId of teams) await refreshRoster(this.inner, teamId);
    } else if (table === "users") {
      for (const doc of out) await refreshPlayerIdentity(this.inner, doc.id);
    }
  }

  async update(
    table: string,
    id: string,
    patch: Record<string, unknown>,
  ): Promise<void> {
    const spec = SEARCH_FIELDS[table];
    const needsSearch = !!spec && touches(patch, spec.sources);
    const watchIdentity = table === "users" && touches(patch, IDENTITY_FIELDS);
    const before =
      needsSearch || watchIdentity || table === "team_players"
        ? await this.inner.getById(table, id)
        : null;
    let data = patch;
    if (needsSearch) {
      const merged = { ...(before ?? {}), ...patch };
      data = { ...patch, ...searchFieldsOf(table, merged) };
    }
    if (table === "club_memberships" && "user_id" in patch) {
      const users = await this.snapshots([patch.user_id]);
      data = {
        ...data,
        user_snapshot: userSnapshot(users.get(String(patch.user_id))),
      };
    }
    await this.inner.update(table, id, data);

    if (table === "team_players") {
      const teams = new Set(
        [before?.team_id, patch.team_id].filter(
          (t): t is string => typeof t === "string",
        ),
      );
      for (const teamId of teams) await refreshRoster(this.inner, teamId);
    } else if (
      watchIdentity &&
      IDENTITY_FIELDS.some(
        (f) => f in patch && (before?.[f] ?? null) !== (patch[f] ?? null),
      )
    ) {
      await refreshPlayerIdentity(this.inner, id);
    }
  }

  async delete(table: string, id: string): Promise<void> {
    const before =
      table === "team_players" ? await this.inner.getById(table, id) : null;
    await this.inner.delete(table, id);
    if (typeof before?.team_id === "string") {
      await refreshRoster(this.inner, before.team_id);
    }
  }
}

export function derivedFieldsDataSource(inner: DataSource): DataSource {
  return inner instanceof DerivedFieldsDataSource
    ? inner
    : new DerivedFieldsDataSource(inner);
}
