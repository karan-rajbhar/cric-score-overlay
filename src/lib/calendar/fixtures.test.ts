import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { MemoryDataSource, type Doc } from "~/lib/firebase/datasource";
import { serverClientFor } from "~/lib/firebase/server-client";
import { calendarFeed, clearFeedCache } from "./feed";
import { loadCalendarFixtures } from "./fixtures";

const seed = JSON.parse(
  readFileSync(join(process.cwd(), "firebase/seed/data.json"), "utf8"),
) as Record<string, Doc[]>;

const STRIKERS = "750e8400-e29b-41d4-a716-446655440001";
const CHAMPIONSHIP = "850e8400-e29b-41d4-a716-446655440001";
const CLUB = "650e8400-e29b-41d4-a716-446655440001";
// 30 days back reaches 2 July 2024: the seed's June match drops off.
const NOW = new Date("2024-08-01T12:00:00.000Z");
const ORIGIN = "https://cricscore.example";

let ds: MemoryDataSource;
let db: ReturnType<typeof serverClientFor>;

beforeEach(() => {
  ds = new MemoryDataSource(seed);
  db = serverClientFor({ ds, db: null, getUser: async () => null });
  clearFeedCache();
});

const idsOf = (matches: { id: string }[]) =>
  matches.map((m) => m.id.slice(-1)).sort();

describe("loadCalendarFixtures", () => {
  it("lists a team's matches on either side from 30 days back", async () => {
    const feed = await loadCalendarFixtures(db, "team", STRIKERS, NOW);
    expect(feed?.name).toBe("Metropolitan Strikers");
    // 1, 3 (as team 2), 4 and 6; not 8 (June).
    expect(idsOf(feed!.matches)).toEqual(["1", "3", "4", "6"]);
  });

  it("lists a tournament's and a club's matches", async () => {
    const tournament = await loadCalendarFixtures(
      db,
      "tournament",
      CHAMPIONSHIP,
      NOW,
    );
    expect(idsOf(tournament!.matches)).toEqual(["1", "2", "3", "6"]);
    const club = await loadCalendarFixtures(db, "club", CLUB, NOW);
    expect(idsOf(club!.matches)).toEqual(["1", "2", "3", "4", "5", "6"]);
  });

  it("returns null for an unknown id", async () => {
    expect(await loadCalendarFixtures(db, "team", "nope", NOW)).toBeNull();
  });

  it("reads the owner and the matches it lists, nothing else", async () => {
    const before = ds.billedReads;
    const feed = await loadCalendarFixtures(db, "team", STRIKERS, NOW);
    expect(ds.billedReads - before).toBe(1 + feed!.matches.length);
  });
});

describe("calendarFeed", () => {
  it("serves a repeat request from the instance cache", async () => {
    const first = await calendarFeed(db, "team", STRIKERS, ORIGIN, NOW);
    expect(first?.body).toContain("BEGIN:VCALENDAR");
    expect(first?.body).toContain(`URL:${ORIGIN}/matches/`);
    const before = ds.billedReads;
    const again = await calendarFeed(
      db,
      "team",
      STRIKERS,
      ORIGIN,
      new Date(NOW.getTime() + 10 * 60 * 1000),
    );
    expect(again?.body).toBe(first?.body);
    expect(ds.billedReads).toBe(before);
  });

  it("reads again once the cached feed is 15 minutes old", async () => {
    await calendarFeed(db, "club", CLUB, ORIGIN, NOW);
    const before = ds.billedReads;
    await calendarFeed(
      db,
      "club",
      CLUB,
      ORIGIN,
      new Date(NOW.getTime() + 16 * 60 * 1000),
    );
    expect(ds.billedReads).toBeGreaterThan(before);
  });
});
