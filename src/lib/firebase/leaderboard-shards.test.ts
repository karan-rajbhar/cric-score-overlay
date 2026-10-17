/**
 * Leaderboard shards (`leaderboards/{scope}_{id}_{k}`): the hash spreads
 * players evenly, a large scope stays well under Firestore's 1 MiB
 * document limit, an update touches only the changed players' shards and
 * still equals a rebuild (also with shards missing), the page reads the
 * shards back as one leaderboard, and the migration from one document
 * per scope is exact and idempotent.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { planLeaderboardShards } from "../../../scripts/lib/leaderboard-shards.mjs";
import { leaderboardFromPlayers, type LeaderboardPlayer } from "../leaderboard";
import { MemoryDataSource, type Doc } from "./datasource";
import { canonicalJson } from "./derive.mjs";
import { loadScopeLeaderboard } from "./leaderboards";
import { QueryBuilder } from "./query-builder";
import { DataSourceScoringTx } from "./scoring/tx";
import { builderContextFor } from "./server-client";
import { applyStatsChanges } from "./stats-sync";
import {
  boardKeysOf,
  LEADERBOARD_SHARDS,
  leaderboardShardIds,
  parseBoardId,
  rebuildStats,
  shardOf,
} from "./stats.mjs";
import type { PlayerMatchesRow } from "./types";

const seed = JSON.parse(
  readFileSync(join(process.cwd(), "firebase/seed/data.json"), "utf8"),
) as Record<string, Doc[]>;

function record(
  matchId: string,
  userId: string,
  runs: number,
  tournament = "T",
): PlayerMatchesRow {
  return {
    id: `${matchId}_${userId}`,
    user_id: userId,
    match_id: matchId,
    tournament_id: tournament,
    club_id: "C",
    season_id: null,
    match_date: null,
    batting: [
      {
        innings_id: `${matchId}_i1`,
        runs_scored: runs,
        balls_faced: runs + 3,
        fours: 2,
        sixes: 1,
        is_out: runs % 2 === 0,
      },
    ] as never,
    bowling: [
      {
        innings_id: `${matchId}_i2`,
        wickets_taken: runs % 4,
        runs_conceded: 30,
        balls_bowled: 24,
        maidens: 0,
      },
    ] as never,
    fielding: { catches: 1, stumpings: 0, run_outs: 0 },
    updated_at: null,
  } as unknown as PlayerMatchesRow;
}

const dump = (docs: object[]) =>
  docs
    .map((d) => {
      const c: Record<string, unknown> = { ...d };
      delete c.updated_at;
      delete c.last_updated;
      return canonicalJson(c);
    })
    .sort();

function expectRebuild(ds: MemoryDataSource) {
  const rebuilt = rebuildStats(
    ds.all("player_matches") as unknown as PlayerMatchesRow[],
    new Map(ds.all("users").map((u) => [u.id, u])),
    "x",
  );
  expect(dump(ds.all("leaderboards"))).toEqual(dump(rebuilt.leaderboards));
}

describe("leaderboard shards", () => {
  it("hash players evenly into the fixed shards", () => {
    const counts = new Array(LEADERBOARD_SHARDS).fill(0);
    for (let i = 0; i < 4000; i += 1) {
      const k = shardOf(
        `550e8400-e29b-41d4-a716-${String(i).padStart(12, "0")}`,
      );
      expect(Number.isInteger(k) && k >= 0 && k < LEADERBOARD_SHARDS).toBe(
        true,
      );
      counts[k] += 1;
    }
    for (const c of counts) expect(c).toBeGreaterThan(400); // 500 expected
    expect(shardOf("u1")).toBe(shardOf("u1"));
    expect(parseBoardId("tournament_a_b_7")).toEqual({
      scope: "tournament",
      scope_id: "a_b",
      shard: 7,
    });
  });

  it("keep a 5,000-player scope in 8 documents well under 1 MiB each", () => {
    const users = Array.from({ length: 5000 }, (_, i) => ({
      id: `user-${i}-${"x".repeat(20)}`,
      full_name: `Player number ${i} with a long display name`,
      avatar_url: `https://example.com/avatars/${i}.png?v=${"y".repeat(40)}`,
    }));
    const { leaderboards } = rebuildStats(
      users.map((u, i) => record(`m${i % 50}`, u.id, i % 120)),
      new Map(users.map((u) => [u.id, u])),
      "x",
    );
    const club = leaderboards.filter((d) => d.scope === "club");
    expect(club).toHaveLength(LEADERBOARD_SHARDS);
    let players = 0;
    for (const doc of club) {
      players += Object.keys(doc.players).length;
      expect(Buffer.byteLength(JSON.stringify(doc))).toBeLessThan(600_000);
    }
    expect(players).toBe(5000);
  });

  it("an update writes only the changed player's shard and equals a rebuild", async () => {
    const users = Array.from({ length: 40 }, (_, i) => ({
      id: `u${i}`,
      full_name: `Player ${i}`,
      avatar_url: null,
    }));
    const pms = users.map((u, i) => record(`m${i % 4}`, u.id, i));
    const built = rebuildStats(pms, new Map(users.map((u) => [u.id, u])), "x");
    const ds = new MemoryDataSource({ users });
    await ds.insert("player_matches", pms as unknown as Doc[]);
    await ds.insert("leaderboards", built.leaderboards as unknown as Doc[]);
    await ds.insert("player_career_stats", built.careers as unknown as Doc[]);

    const before = (await ds.getById(
      "player_matches",
      "m0_u0",
    )) as unknown as PlayerMatchesRow;
    const after = record("m0", "u0", 77);
    const t = new DataSourceScoringTx(ds);
    t.put("player_matches", after.id, after as unknown as Doc);
    await applyStatsChanges(t, [{ before, after }], "later");
    await t.commit();

    const touched = ds
      .all("leaderboards")
      .filter((d) => d.updated_at === "later")
      .map((d) => d.id)
      .sort();
    expect(touched).toEqual([...boardKeysOf(after)].sort());
    expectRebuild(ds);
  });

  it("missing shards are rebuilt from the scope's records", async () => {
    const users = Array.from({ length: 30 }, (_, i) => ({
      id: `p${i}`,
      full_name: `Player ${i}`,
      avatar_url: null,
    }));
    const pms = users.map((u, i) => record(`m${i % 3}`, u.id, i));
    const built = rebuildStats(pms, new Map(users.map((u) => [u.id, u])), "x");
    const ds = new MemoryDataSource({ users });
    await ds.insert("player_matches", pms as unknown as Doc[]);
    // Only the club's shards exist; the tournament's are missing.
    await ds.insert(
      "leaderboards",
      built.leaderboards.filter((d) => d.scope === "club") as unknown as Doc[],
    );
    for (const u of users.slice(0, 10)) {
      const t = new DataSourceScoringTx(ds);
      const next = record("m9", u.id, 50);
      t.put("player_matches", next.id, next as unknown as Doc);
      await applyStatsChanges(t, [{ before: null, after: next }], "now");
      await t.commit();
    }
    // Every shard touched is now complete for all its players.
    const rebuilt = rebuildStats(
      ds.all("player_matches") as unknown as PlayerMatchesRow[],
      new Map(users.map((u) => [u.id, u])),
      "x",
    );
    const stored = new Map(ds.all("leaderboards").map((d) => [d.id, d]));
    for (const doc of rebuilt.leaderboards) {
      const got = stored.get(doc.id);
      if (!got) continue; // a tournament shard no change has touched yet
      expect(dump([got])).toEqual(dump([doc]));
    }
    const touched = new Set(
      users.slice(0, 10).flatMap((u) => boardKeysOf(record("m9", u.id, 50))),
    );
    for (const id of touched) expect(stored.has(id)).toBe(true);
  });

  it("the page reads every shard back as one leaderboard", async () => {
    const memory = new MemoryDataSource(structuredClone(seed));
    const { ctx } = builderContextFor(memory, null);
    const from = (t: string) => new QueryBuilder(ctx, t as "matches");
    const club = String(seed.clubs![0]!.id);
    const before = memory.billedReads;
    const data = await loadScopeLeaderboard(
      { from } as never,
      "club",
      club,
      [],
    );
    expect(memory.billedReads - before).toBe(LEADERBOARD_SHARDS);
    const players: Record<string, LeaderboardPlayer> = {};
    for (const id of leaderboardShardIds("club", club)) {
      const doc = await memory.getById("leaderboards", id);
      Object.assign(players, doc?.players ?? {});
    }
    expect(Object.keys(players).length).toBeGreaterThan(20);
    expect(data).toEqual(leaderboardFromPlayers(players));
  });
});

describe("migration to leaderboard shards", () => {
  it("replaces one document per scope with its shards, idempotently", () => {
    // The seed as it was stored before sharding.
    const shards = seed.leaderboards!;
    const merged = new Map<string, Doc>();
    for (const doc of shards) {
      const id = `${doc.scope}_${doc.scope_id}`;
      const prev = merged.get(id);
      merged.set(id, {
        id,
        scope: doc.scope,
        scope_id: doc.scope_id,
        players: { ...(prev?.players as object), ...(doc.players as object) },
        updated_at: doc.updated_at,
      });
    }
    const old = { ...seed, leaderboards: [...merged.values()] };

    const plan = planLeaderboardShards(old, {
      now: "2024-06-01T00:00:00.000Z",
    });
    expect(plan.deletes.sort()).toEqual([...merged.keys()].sort());
    expect(dump(plan.sets)).toEqual(dump(shards));

    // Applying it gives the sharded seed; planning again does nothing.
    const again = planLeaderboardShards({ ...seed });
    expect(again).toEqual({ sets: [], deletes: [] });
  });
});
