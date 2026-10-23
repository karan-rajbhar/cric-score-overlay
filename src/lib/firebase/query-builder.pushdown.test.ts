import { describe, expect, it } from "vitest";
import {
  MemoryDataSource,
  type Doc,
  type NativeFilter,
  type QueryOptions,
} from "./datasource";
import { QueryBuilder } from "./query-builder";
import type { SourceName } from "./types";

/** MemoryDataSource that records every native call. */
class RecordingDataSource extends MemoryDataSource {
  calls: {
    kind: "query" | "count" | "getByIds";
    table: string;
    filters?: NativeFilter[];
    options?: QueryOptions;
    ids?: string[];
  }[] = [];

  override async query(
    table: string,
    filters: NativeFilter[],
    options?: QueryOptions,
  ): Promise<Doc[]> {
    this.calls.push({ kind: "query", table, filters, options });
    return super.query(table, filters, options);
  }

  override async count(table: string, filters: NativeFilter[]) {
    this.calls.push({ kind: "count", table, filters });
    return super.count(table, filters);
  }

  override async getByIds(table: string, ids: string[]) {
    this.calls.push({ kind: "getByIds", table, ids });
    return super.getByIds(table, ids);
  }
}

const pad = (n: number) => String(n).padStart(3, "0");

function seed(): Record<string, Doc[]> {
  const statuses = ["scheduled", "live", "completed"];
  const matches: Doc[] = [];
  for (let i = 0; i < 40; i++) {
    matches.push({
      id: `m${pad(i)}`,
      title: `Match ${i}`,
      status: statuses[i % 3],
      club_id: i % 2 ? "c1" : "c2",
      // Some nulls and duplicate timestamps to exercise null placement and
      // tie-breaking.
      scheduled_at:
        i % 7 === 0 ? null : `2024-0${(i % 9) + 1}-${pad(i % 4).slice(1)}`,
      created_at: `2024-01-01T00:00:${pad(i).slice(1)}Z`,
      team1_id: "t1",
      team2_id: "t2",
    });
  }
  const users: Doc[] = [];
  const names = ["alice", "Bob", "carol", "dave", null, "Eve", "frank"];
  for (let i = 0; i < 21; i++) {
    const name = names[i % names.length]!;
    users.push({
      id: `u${pad(i)}`,
      full_name: name === null ? null : `${name} ${i}`,
      full_name_lower: name === null ? null : `${name.toLowerCase()} ${i}`,
      created_at: `2024-02-01T00:00:${pad(i).slice(1)}Z`,
    });
  }
  const teams: Doc[] = [
    { id: "t1", name: "Tigers", captain_id: "u001" },
    { id: "t2", name: "Kings", captain_id: "u001" },
    { id: "t3", name: "Empty", captain_id: "u002" },
  ];
  const team_players: Doc[] = [];
  for (let i = 0; i < 10; i++) {
    team_players.push({
      id: `tp${pad(i)}`,
      team_id: i < 6 ? "t1" : "t2",
      user_id: `u${pad(i)}`,
      batting_order: i,
    });
  }
  return { matches, users, teams, team_players };
}

function clients() {
  const fast = new RecordingDataSource(seed());
  const slow = new RecordingDataSource(seed());
  return {
    fast,
    slow,
    on: (table: string): AnyBuilder => new QueryBuilder({ ds: fast }, table),
    off: (table: string): AnyBuilder =>
      new QueryBuilder({ ds: slow, pushdown: false }, table),
  };
}

type AnyBuilder = QueryBuilder<SourceName>;
type Chain = (q: AnyBuilder) => PromiseLike<unknown>;

const CASES: [string, string, Chain][] = [
  [
    "matches desc limit (nulls first split)",
    "matches",
    (q) =>
      q
        .select("id, scheduled_at")
        .order("scheduled_at", { ascending: false })
        .limit(9),
  ],
  [
    "matches desc limit larger than result",
    "matches",
    (q) =>
      q
        .select("id")
        .eq("status", "live")
        .order("scheduled_at", { ascending: false })
        .limit(50),
  ],
  [
    "matches eq status desc limit",
    "matches",
    (q) =>
      q
        .select("id")
        .eq("status", "completed")
        .order("scheduled_at", { ascending: false })
        .limit(6),
  ],
  [
    "matches asc limit (nulls last split)",
    "matches",
    (q) => q.select("id").order("scheduled_at").limit(38),
  ],
  [
    "matches asc nullsFirst (native placement)",
    "matches",
    (q) => q.select("id").order("scheduled_at", { nullsFirst: true }).limit(8),
  ],
  [
    "matches desc nullsLast (native placement)",
    "matches",
    (q) =>
      q
        .select("id")
        .order("scheduled_at", { ascending: false, nullsFirst: false })
        .limit(8),
  ],
  [
    "matches range offset",
    "matches",
    (q) =>
      q
        .select("id")
        .eq("club_id", "c1")
        .order("scheduled_at", { ascending: false })
        .range(3, 7),
  ],
  [
    "matches range + limit",
    "matches",
    (q) =>
      q
        .select("id")
        .order("created_at", { ascending: false })
        .range(2, 20)
        .limit(4),
  ],
  [
    "matches in filter + order + limit",
    "matches",
    (q) =>
      q
        .select("id")
        .in("status", ["live", "completed"])
        .order("created_at")
        .limit(5),
  ],
  [
    "matches maybeSingle with order",
    "matches",
    (q) =>
      q
        .select("id")
        .eq("status", "live")
        .order("scheduled_at", { ascending: false })
        .maybeSingle(),
  ],
  ["matches limit without order", "matches", (q) => q.select("id").limit(3)],
  [
    "matches eq on order column",
    "matches",
    (q) =>
      q
        .select("id")
        .eq("scheduled_at", "2024-02-01")
        .order("scheduled_at", { ascending: false })
        .limit(2),
  ],
  [
    "fallback: ilike filter",
    "matches",
    (q) =>
      q
        .select("id")
        .ilike("title", "%1%")
        .order("scheduled_at", { ascending: false })
        .limit(3),
  ],
  [
    "fallback: non-allowlisted order column",
    "matches",
    (q) => q.select("id").order("title").limit(5),
  ],
  [
    "fallback: two order columns",
    "matches",
    (q) => q.select("id").order("status").order("created_at").limit(5),
  ],
  [
    "users full_name asc limit (nulls last)",
    "users",
    (q) => q.select("id, full_name").order("full_name").limit(20),
  ],
  [
    "users startsWith + order + limit",
    "users",
    (q) =>
      q
        .select("id, full_name_lower")
        .startsWith("full_name_lower", "a")
        .order("full_name_lower")
        .limit(2),
  ],
  [
    "users startsWith unordered",
    "users",
    (q) => q.select("id").startsWith("full_name_lower", "d").limit(2),
  ],
  [
    "users gte/lt range ordered desc",
    "users",
    (q) =>
      q
        .select("id")
        .gte("created_at", "2024-02-01T00:00:05Z")
        .lt("created_at", "2024-02-01T00:00:15Z")
        .order("created_at", { ascending: false })
        .limit(4),
  ],
  [
    "count head exact",
    "matches",
    (q) => q.select("*", { count: "exact", head: true }).eq("status", "live"),
  ],
  [
    "count head exact with in + range",
    "matches",
    (q) =>
      q
        .select("*", { count: "exact", head: true })
        .in("status", ["live", "scheduled"])
        .range(2, 5),
  ],
  [
    "count head with in-memory filter",
    "matches",
    (q) => q.select("*", { count: "exact", head: true }).ilike("title", "%2%"),
  ],
  [
    "count exact with rows",
    "matches",
    (q) =>
      q
        .select("id", { count: "exact" })
        .eq("club_id", "c2")
        .order("created_at")
        .limit(3),
  ],
  [
    "relation counts",
    "teams",
    (q) => q.select("id, name, _count:team_players(count)").order("name"),
  ],
];

describe("descending keyset pages", () => {
  it("walk every row once: latest first, ties by id, nulls last", async () => {
    const { on, off, fast } = clients();
    const expected = [...seed().matches!]
      .sort((a, b) => {
        const x = a.scheduled_at as string | null;
        const y = b.scheduled_at as string | null;
        if (x !== y) {
          if (x === null) return 1;
          if (y === null) return -1;
          return x < y ? 1 : -1;
        }
        return a.id < b.id ? 1 : -1;
      })
      .map((m) => m.id);
    for (const client of [on, off]) {
      const seen: string[] = [];
      let cursor: { value: unknown; id: string } | null = null;
      for (let page = 0; page < 20; page += 1) {
        const { data } = await client("matches")
          .select("id, scheduled_at")
          .order("scheduled_at", { ascending: false })
          .keyset(cursor)
          .limit(6);
        const rows = (data ?? []) as Doc[];
        if (!rows.length) break;
        seen.push(...rows.map((r) => r.id));
        const last = rows[rows.length - 1]!;
        cursor = { value: last.scheduled_at, id: last.id };
      }
      expect(seen).toEqual(expected);
    }
    // One native page per call, each of at most 6 documents.
    expect(fast.calls.every((c) => c.options?.limit === 6)).toBe(true);
  });
});

describe("query pushdown", () => {
  it.each(CASES)(
    "%s returns the same result as the fallback",
    async (_n, table, chain) => {
      const { on, off } = clients();
      const fast = await chain(on(table));
      const slow = await chain(off(table));
      expect(fast).toEqual(slow);
      expect((fast as { error: unknown }).error).toBeNull();
    },
  );

  it("pushes order + limit for an all-native chain and reads fewer documents", async () => {
    const { on, off, fast, slow } = clients();
    const chain = (q: AnyBuilder) =>
      q
        .select("id")
        .eq("status", "completed")
        .order("scheduled_at", { ascending: false })
        .limit(3);
    await chain(on("matches"));
    await chain(off("matches"));
    // Postgres puts nulls first on DESC: the ordered page is full, so a
    // second query fetches the nulls.
    expect(fast.calls.map((c) => c.options)).toEqual([
      { orderBy: [{ field: "scheduled_at", direction: "desc" }], limit: 3 },
      { limit: 3 },
    ]);
    expect(fast.calls[1]!.filters).toContainEqual({
      field: "scheduled_at",
      op: "==",
      value: null,
    });
    expect(fast.docsRead).toBe(5);
    expect(slow.docsRead).toBe(13);
  });

  it("asks for non-null rows when ascending order meets leading nulls", async () => {
    const { on, fast } = clients();
    await on("users").select("id").order("full_name").limit(5);
    expect(fast.calls.map((c) => c.filters)).toEqual([
      [],
      [{ field: "full_name", op: "!=", value: null }],
    ]);
  });

  it("uses a single query when the order column is never null", async () => {
    const { on, fast } = clients();
    await on("matches")
      .select("id")
      .order("created_at", { ascending: false })
      .limit(4);
    expect(fast.calls).toHaveLength(1);
    expect(fast.calls[0]!.options).toEqual({
      orderBy: [{ field: "created_at", direction: "desc" }],
      limit: 4,
    });
  });

  it("pushes startsWith natively as a bounded range", async () => {
    const { on, fast } = clients();
    const { data } = await on("users")
      .select("id, full_name_lower")
      .startsWith("full_name_lower", "car")
      .order("full_name_lower")
      .limit(10);
    expect(data).toEqual([
      { id: "u016", full_name_lower: "carol 16" },
      { id: "u002", full_name_lower: "carol 2" },
      { id: "u009", full_name_lower: "carol 9" },
    ]);
    expect(fast.calls).toEqual([
      {
        kind: "query",
        table: "users",
        filters: [
          { field: "full_name_lower", op: ">=", value: "car" },
          { field: "full_name_lower", op: "<=", value: "car" },
        ],
        options: {
          orderBy: [{ field: "full_name_lower", direction: "asc" }],
          limit: 10,
        },
      },
    ]);
  });

  it("falls back to a full fetch when a filter is evaluated in memory", async () => {
    const { on, fast } = clients();
    await on("matches")
      .select("id")
      .or("status.eq.live,status.eq.completed")
      .order("scheduled_at", { ascending: false })
      .limit(2);
    expect(fast.calls).toHaveLength(1);
    expect(fast.calls[0]!.options).toBeUndefined();
    expect(fast.docsRead).toBe(40);
  });

  it("does not push order/limit for update or delete", async () => {
    const { on, fast } = clients();
    await on("matches").update({ title: "x" }).eq("status", "live");
    expect(fast.calls.every((c) => c.options === undefined)).toBe(true);
  });

  it("counts with the count() aggregation", async () => {
    const { on, fast } = clients();
    const res = await on("matches")
      .select("*", { count: "exact", head: true })
      .eq("club_id", "c1");
    expect(res.count).toBe(20);
    expect(fast.calls.map((c) => c.kind)).toEqual(["count"]);
    expect(fast.docsRead).toBe(0);

    fast.calls = [];
    const teams = await on("teams").select("id, team_players(count)");
    expect(teams.data).toEqual([
      { id: "t1", team_players: [{ count: 6 }] },
      { id: "t2", team_players: [{ count: 4 }] },
      { id: "t3", team_players: [{ count: 0 }] },
    ]);
    expect(fast.calls.filter((c) => c.kind === "count")).toHaveLength(3);
    expect(
      fast.calls.some((c) => c.table === "team_players" && c.kind === "query"),
    ).toBe(false);
  });

  it("memoises id lookups across relations within one query", async () => {
    const { on, fast } = clients();
    const { data } = await on("teams")
      .select(
        "id, captain:users!teams_captain_id_fkey(id), team_players(id, user:users(id, full_name))",
      )
      .eq("id", "t1")
      .single();
    expect((data as { captain: { id: string } }).captain.id).toBe("u001");
    const userLookups = fast.calls.filter(
      (c) => c.kind === "getByIds" && c.table === "users",
    );
    // u001 is fetched for the captain, then reused for the team player.
    expect(userLookups.map((c) => c.ids)).toEqual([
      ["u001"],
      ["u000", "u002", "u003", "u004", "u005"],
    ]);
  });
});
