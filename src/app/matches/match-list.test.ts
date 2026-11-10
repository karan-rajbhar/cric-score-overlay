import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { MemoryDataSource, type Doc } from "~/lib/firebase/datasource";
import { serverClientFor } from "~/lib/firebase/server-client";
import { fetchMatchList } from "./match-list";

const NOW = new Date("2026-11-10T08:00:00.000Z");
const snap = (id: string) => ({ id, name: id, short_name: id, logo_url: null });

function match(id: string, status: string, scheduledAt: string): Doc {
  return {
    id,
    title: id,
    status,
    scheduled_at: scheduledAt,
    team1_id: "A",
    team2_id: "B",
    team1_snapshot: snap("A"),
    team2_snapshot: snap("B"),
  };
}

/** Fixtures on the 11th to the 20th, at 10:00. */
const fixtures = Array.from({ length: 10 }, (_, i) =>
  match(`sched-${11 + i}`, "scheduled", `2026-11-${11 + i}T10:00:00.000Z`),
);

function client(matches: Doc[]) {
  const ds = new MemoryDataSource({ matches });
  return serverClientFor({ ds, db: null, getUser: async () => null });
}

const ids = (rows: unknown[]) => (rows as { id: string }[]).map((m) => m.id);

describe("fetchMatchList", () => {
  it("lists the soonest fixtures first", async () => {
    const rows = await fetchMatchList(
      client(fixtures),
      { status: "scheduled", limit: 6 },
      NOW,
    );
    expect(ids(rows)).toEqual([
      "sched-11",
      "sched-12",
      "sched-13",
      "sched-14",
      "sched-15",
      "sched-16",
    ]);
  });

  it("leaves out fixtures that were due long ago and never started", async () => {
    const rows = await fetchMatchList(
      client([
        match("stale", "scheduled", "2026-10-01T10:00:00.000Z"),
        match("due-now", "scheduled", "2026-11-10T07:30:00.000Z"),
        ...fixtures,
      ]),
      { status: "scheduled", limit: 2 },
      NOW,
    );
    expect(ids(rows)).toEqual(["due-now", "sched-11"]);
  });

  it("keeps live matches and recent results in All however many fixtures there are", async () => {
    const many = Array.from({ length: 60 }, (_, i) =>
      match(`f-${i}`, "scheduled", new Date(NOW.getTime() + (i + 1) * 3.6e6).toISOString()),
    );
    const rows = await fetchMatchList(
      client([
        ...many,
        match("live-1", "live", "2026-11-10T06:00:00.000Z"),
        match("done-1", "completed", "2026-11-09T10:00:00.000Z"),
        match("rained-off", "abandoned", "2026-11-08T10:00:00.000Z"),
      ]),
      {},
      NOW,
    );
    const listed = ids(rows);
    expect(listed).toEqual(
      expect.arrayContaining(["live-1", "done-1", "rained-off", "f-0"]),
    );
    expect(listed.length).toBeLessThanOrEqual(50 + 1);
  });

  it("lists results latest first", async () => {
    const rows = await fetchMatchList(
      client([
        match("older", "completed", "2026-11-01T10:00:00.000Z"),
        match("newer", "completed", "2026-11-09T10:00:00.000Z"),
      ]),
      { status: "completed" },
      NOW,
    );
    expect(ids(rows)).toEqual(["newer", "older"]);
  });
});
