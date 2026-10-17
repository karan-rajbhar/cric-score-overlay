/**
 * Word-prefix search, keyset pages and snapshot-served relations (schema
 * stage 3) on the seed data, checking both results and documents read.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { MemoryDataSource, type Doc } from "./datasource";
import {
  matchesSearch,
  normalizeText,
  searchKey,
  searchPrefixes,
} from "./derive.mjs";
import { QueryBuilder } from "./query-builder";
import { prefixSearch } from "./search";
import { builderContextFor } from "./server-client";
import type { TableName } from "./types";

const seed = JSON.parse(
  readFileSync(join(process.cwd(), "firebase/seed/data.json"), "utf8"),
) as Record<string, Doc[]>;

function setup(pushdown = true) {
  const ds = new MemoryDataSource(seed);
  const { ctx } = builderContextFor(ds, null);
  ctx.pushdown = pushdown;
  const db = {
    from: <T extends TableName>(table: T) => new QueryBuilder<T>(ctx, table),
  };
  return { ds, db };
}

async function reads(ds: MemoryDataSource, run: () => Promise<unknown>) {
  const before = ds.billedReads;
  await run();
  return ds.billedReads - before;
}

/** What the old `ilike '%q%'` scan matched, restricted to word starts. */
function expected(table: string, fields: string[], q: string, limit: number) {
  return seed[table]!.filter((d) =>
    matchesSearch(
      q,
      fields.map((f) => d[f]),
    ),
  )
    .sort((a, b) =>
      String(a.name_lower ?? a.title_lower) <
      String(b.name_lower ?? b.title_lower)
        ? -1
        : String(a.name_lower ?? a.title_lower) >
            String(b.name_lower ?? b.title_lower)
          ? 1
          : a.id < b.id
            ? -1
            : 1,
    )
    .slice(0, limit)
    .map((d) => d.id);
}

describe("search keys", () => {
  it("normalizes and caps queries", () => {
    expect(normalizeText("  José   O'Neil ")).toBe("jose o neil");
    expect(searchKey("j")).toBeNull();
    expect(searchKey("@John_S")).toBe("john_s");
    expect(searchKey("x".repeat(40))).toHaveLength(24);
    expect(matchesSearch("smi", ["John Smith"])).toBe(true);
    expect(matchesSearch("john sm", ["John Smith"])).toBe(true);
    // Mid-word: one word of 3+ characters.
    expect(matchesSearch("ohn", ["John Smith"])).toBe(true);
    expect(matchesSearch("mith", ["John Smith"])).toBe(true);
    expect(matchesSearch("oh", ["John Smith"])).toBe(false);
    expect(matchesSearch("n sm", ["John Smith"])).toBe(false);
    expect(matchesSearch("smith jo", ["John Smith"])).toBe(false);
  });
});

describe("prefixSearch", () => {
  for (const q of ["jo", "smi", "john sm", "@john_s", "a", "zzz"]) {
    it(`users "${q}" reads at most the results`, async () => {
      const { ds, db } = setup();
      let rows: Record<string, unknown>[] = [];
      const n = await reads(ds, async () => {
        rows = (await prefixSearch(db, "users", q, "id, full_name", 5)).data;
      });
      const want = searchKey(q)
        ? expected("users", ["full_name", "username"], q, 5)
        : [];
      expect(rows.map((r) => r.id)).toEqual(want);
      expect(n).toBeLessThanOrEqual(Math.max(1, want.length));
    });
  }

  it("long queries are confirmed in memory", async () => {
    const { db } = setup();
    const user = seed.users!.find((u) => String(u.full_name).includes(" "))!;
    const q = `${user.full_name} ${"x".repeat(60)}`;
    const { data } = await prefixSearch(db, "users", q, "id", 5);
    expect(data).toEqual([]);
    const exact = await prefixSearch(
      db,
      "users",
      String(user.full_name),
      "id",
      5,
    );
    expect(exact.data.map((r) => r.id)).toContain(user.id);
  });

  it("teams, clubs, tournaments and matches", async () => {
    const { ds, db } = setup();
    for (const [table, fields, col] of [
      ["teams", ["name", "short_name"], "name"],
      ["clubs", ["name", "short_name"], "name"],
      ["tournaments", ["name"], "name"],
      ["matches", ["title"], "title"],
    ] as const) {
      const first = String(seed[table]![0]![col]).split(" ")[0]!.slice(0, 3);
      let rows: Record<string, unknown>[] = [];
      const n = await reads(ds, async () => {
        rows = (await prefixSearch(db, table, first, "id", 5)).data;
      });
      expect(
        rows.map((r) => r.id),
        table,
      ).toEqual(expected(table, [...fields], first, 5));
      expect(rows.length).toBeGreaterThan(0);
      expect(n).toBe(rows.length);
    }
  });
});

describe("mid-word search (trigrams)", () => {
  it("stores each word's trigrams next to its prefixes", () => {
    expect(searchPrefixes(["John Smith"])).toEqual(
      expect.arrayContaining(["ohn", "mit", "ith", "smi", "john sm"]),
    );
    // Words shorter than 3 letters add none; long words stop at 24 letters.
    expect(searchPrefixes(["Al"])).toEqual(["al"]);
    const long = "a".repeat(23) + "xyz";
    expect(searchPrefixes([long])).not.toContain("xyz");
  });

  it('3 letters: "ohn" finds every name containing it in one query', async () => {
    const { ds, db } = setup();
    let rows: Record<string, unknown>[] = [];
    const n = await reads(ds, async () => {
      rows = (await prefixSearch(db, "users", "ohn", "id, full_name", 5)).data;
    });
    expect(rows.map((r) => r.full_name)).toEqual(
      expected("users", ["full_name", "username"], "ohn", 5).map(
        (id) => seed.users!.find((u) => u.id === id)!.full_name,
      ),
    );
    expect(rows.map((r) => r.full_name)).toEqual(
      expect.arrayContaining(["John Smith", "Sarah Johnson"]),
    );
    expect(n).toBe(rows.length);
  });

  it('longer: "mith" falls back to its first trigram, confirmed in memory', async () => {
    const { ds, db } = setup();
    let rows: Record<string, unknown>[] = [];
    const n = await reads(ds, async () => {
      rows = (await prefixSearch(db, "users", "mith", "id, full_name", 5)).data;
    });
    expect(rows.map((r) => r.full_name)).toEqual(["John Smith"]);
    // The empty prefix query (1) plus the trigram query (<= 3 x limit).
    expect(n).toBeLessThanOrEqual(1 + 15);

    const teams = await prefixSearch(db, "teams", "rike", "id, name", 5);
    expect(teams.data.map((r) => r.name)).toEqual(["Metropolitan Strikers"]);
  });

  it("word-start matches skip the fallback", async () => {
    const { ds, db } = setup();
    let rows: Record<string, unknown>[] = [];
    const n = await reads(ds, async () => {
      rows = (await prefixSearch(db, "users", "wils", "id, full_name", 5)).data;
    });
    expect(rows.map((r) => r.full_name)).toEqual(["Mike Wilson"]);
    expect(n).toBe(1);
  });
});

describe("keyset pages", () => {
  it("walk every user once, in name order, reading one page each", async () => {
    for (const pushdown of [true, false]) {
      const { ds, db } = setup(pushdown);
      const seen: string[] = [];
      let cursor: { name: string; id: string } | null = null;
      for (let page = 0; page < 20; page += 1) {
        let rows: Doc[] = [];
        const n = await reads(ds, async () => {
          let q = db.from("users").select("id, name_lower").order("name_lower");
          if (cursor) q = q.after(cursor.name, cursor.id);
          rows = ((await q.limit(7)).data ?? []) as Doc[];
        });
        if (pushdown) expect(n).toBe(Math.max(1, rows.length));
        if (!rows.length) break;
        seen.push(...rows.map((r) => r.id));
        const last = rows[rows.length - 1]!;
        cursor = { name: String(last.name_lower), id: last.id };
      }
      const all = [...seed.users!]
        .sort((a, b) =>
          a.name_lower === b.name_lower
            ? a.id < b.id
              ? -1
              : 1
            : String(a.name_lower) < String(b.name_lower)
              ? -1
              : 1,
        )
        .map((u) => u.id);
      expect(seen).toEqual(all);
    }
  });
});

describe("relations served from snapshots", () => {
  it("rosters answer team_players and their users without profile reads", async () => {
    const { ds, db } = setup();
    const team = seed.teams![0]!;
    let data: Doc | null = null;
    const n = await reads(ds, async () => {
      data = (
        await db
          .from("teams")
          .select(
            "*, team_players(*, user:users!team_players_user_id_fkey(id, full_name, avatar_url))",
          )
          .eq("id", team.id)
          .single()
      ).data as Doc;
    });
    expect(n).toBe(1);
    const row = data as unknown as Doc;
    expect(row.roster).toBeUndefined();
    expect(row.search_prefixes).toBeUndefined();
    // Same rows as reading team_players and users (pushdown off reads them).
    const plain = new QueryBuilder(
      { ds: new MemoryDataSource(seed) },
      "team_players",
    );
    const { data: direct } = await plain
      .select(
        "*, user:users!team_players_user_id_fkey(id, full_name, avatar_url)",
      )
      .eq("team_id", team.id)
      .order("batting_order")
      .order("created_at");
    expect(row.team_players).toEqual(direct);
  });

  it("memberships answer their users from user_snapshot", async () => {
    const { ds, db } = setup();
    const clubId = seed.clubs![0]!.id;
    let rows: Doc[] = [];
    const n = await reads(ds, async () => {
      rows = (
        await db
          .from("club_memberships")
          .select("id, role, user:users(id, full_name, avatar_url)")
          .eq("club_id", clubId)
      ).data as Doc[];
    });
    expect(rows.length).toBeGreaterThan(0);
    expect(n).toBe(rows.length);
    const users = new Map(seed.users!.map((u) => [u.id, u]));
    for (const r of rows) {
      const m = seed.club_memberships!.find((x) => x.id === r.id)!;
      const u = users.get(String(m.user_id));
      expect(r.user).toEqual(
        u
          ? { id: u.id, full_name: u.full_name, avatar_url: u.avatar_url }
          : null,
      );
      expect(r.user_snapshot).toBeUndefined();
    }
  });

  it("match lists embed innings from the summary", async () => {
    const { ds, db } = setup();
    let rows: Doc[] = [];
    const n = await reads(ds, async () => {
      rows = (
        await db
          .from("matches")
          .select(
            "id, innings(id, team_id, innings_number, total_runs, is_completed)",
          )
          .order("scheduled_at", { ascending: false })
          .limit(50)
      ).data as Doc[];
    });
    expect(n).toBe(seed.matches!.length);
    const memory = new MemoryDataSource(seed);
    for (const m of rows) {
      const { data } = await new QueryBuilder({ ds: memory }, "innings")
        .select("id, team_id, innings_number, total_runs, is_completed")
        .eq("match_id", m.id)
        .order("innings_number");
      expect(m.innings, m.id).toEqual(data);
    }
  });
});
