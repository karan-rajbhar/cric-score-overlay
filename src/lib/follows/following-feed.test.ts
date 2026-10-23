import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { MemoryDataSource, type Doc } from "~/lib/firebase/datasource";
import { serverClientFor } from "~/lib/firebase/server-client";
import { followingFeed, isFollowedMatch } from "./following-feed";

const seed = JSON.parse(
  readFileSync(join(process.cwd(), "firebase/seed/data.json"), "utf8"),
) as Record<string, Doc[]>;

const team = (n: number) => `750e8400-e29b-41d4-a716-44665544000${n}`;
const match = (n: number) => `950e8400-e29b-41d4-a716-44665544000${n}`;
const TOURNAMENT_2 = "850e8400-e29b-41d4-a716-446655440002";
// A Strikers (team 1) player in the seed.
const STRIKERS_PLAYER = "550e8400-e29b-41d4-a716-446655440003";
// Before the seed's scheduled fixtures (10 Aug, 5 Sep 2024).
const NOW = new Date("2024-08-01T12:00:00.000Z");

let ds: MemoryDataSource;
let db: ReturnType<typeof serverClientFor>;

beforeEach(() => {
  ds = new MemoryDataSource(seed);
  db = serverClientFor({ ds, db: null, getUser: async () => null });
});

describe("followingFeed", () => {
  it("lists upcoming fixtures of followed teams, soonest first, with team names", async () => {
    const feed = await followingFeed(db, [`team:${team(1)}`], NOW);
    expect(feed.upcoming.map((m) => m.id)).toEqual([match(6)]);
    expect(feed.upcoming[0]).toMatchObject({
      status: "scheduled",
      team1: { name: "Metropolitan Strikers" },
    });
    expect(feed.teamIds).toEqual([team(1)]);
  });

  it("adds followed tournaments, matches and the teams of followed players", async () => {
    const feed = await followingFeed(
      db,
      [
        `tournament:${TOURNAMENT_2}`,
        `match:${match(3)}`,
        `player:${STRIKERS_PLAYER}`,
      ],
      NOW,
    );
    // Match 7 (tournament 2), match 6 (Strikers); match 3 is live, not upcoming.
    expect(feed.upcoming.map((m) => m.id)).toEqual([match(6), match(7)]);
    expect(feed.teamIds).toContain(team(1));
    expect(feed.matchIds).toEqual([match(3)]);
    expect(feed.tournamentIds).toEqual([TOURNAMENT_2]);
  });

  it("drops fixtures that started more than 3 hours ago", async () => {
    const feed = await followingFeed(
      db,
      [`team:${team(1)}`],
      new Date("2024-08-10T18:00:00.000Z"),
    );
    expect(feed.upcoming).toEqual([]);
  });

  it("reads only the matches it lists, bounded per query", async () => {
    const before = ds.billedReads;
    await followingFeed(
      db,
      [`team:${team(1)}`, `team:${team(2)}`, `tournament:${TOURNAMENT_2}`],
      NOW,
    );
    // Two side queries for the teams + one for the tournament: matches 6
    // (both teams), 7 (team 2 and the tournament), at least 1 per query.
    expect(ds.billedReads - before).toBeLessThanOrEqual(6);
  });
});

describe("isFollowedMatch", () => {
  const ids = { matchIds: ["m"], teamIds: ["t1"], tournamentIds: ["r"] };
  it("matches by match, either team or tournament", () => {
    expect(isFollowedMatch({ id: "m" }, ids)).toBe(true);
    expect(isFollowedMatch({ id: "x", team2_id: "t1" }, ids)).toBe(true);
    expect(isFollowedMatch({ id: "x", tournament_id: "r" }, ids)).toBe(true);
    expect(isFollowedMatch({ id: "x", team1_id: "t9" }, ids)).toBe(false);
  });
});
