import { describe, expect, it } from "vitest";
import type { LeaderboardData } from "~/lib/leaderboard";
import {
  leaderboardSnapshot,
  nextFixtureSnapshot,
  overlaySnapshots,
  pointsTableSnapshot,
  seriesSnapshot,
  SNAPSHOT_LIMITS,
} from "./snapshots";

const teams = new Map([
  ["t1", { id: "t1", name: "Riverside Rangers", short_name: "RIV" }],
  ["t2", { id: "t2", name: "Harbour Hawks", short_name: "HAW" }],
]);

const standing = (team_id: string, points: number) => ({
  team_id,
  matches_played: 4,
  wins: points / 2,
  losses: 4 - points / 2,
  ties: 0,
  no_results: 0,
  points,
  net_run_rate: 0.5,
});

const board = {
  batting: [
    { userId: "p1", name: "Arjun Mehta", runs: 210, innings: 5, matches: 5, strikeRateDisplay: "141.2", strikeRate: 141.2, average: 52.5, highestScoreDisplay: "78*" },
    { userId: "p2", name: "Leo Fernandes", runs: 0, innings: 1, matches: 1, strikeRateDisplay: "0.0", strikeRate: 0, average: null, highestScoreDisplay: "0" },
  ],
  bowling: [
    { userId: "p3", name: "Faisal Khan", wickets: 9, matches: 5, balls: 120, economy: 6.9, economyDisplay: "6.90", bestBowling: { wickets: 3, runs: 14, display: "3-14" } },
  ],
  fielding: [],
  mvp: [],
  highlights: {},
} as unknown as LeaderboardData;

describe("overlay snapshots", () => {
  it("builds the points table, marking this match's teams", () => {
    const table = pointsTableSnapshot(
      "Metro T20 League",
      [standing("t2", 6), standing("t1", 4), standing("gone", 2)],
      teams,
      ["t1"],
    )!;
    expect(table.rows.map((r) => [r.team, r.points, r.highlight])).toEqual([
      ["Harbour Hawks", 6, false],
      ["Riverside Rangers", 4, true],
    ]);
    expect(pointsTableSnapshot("x", [], teams, [])).toBeNull();
  });

  it("lists leaders with something to their name", () => {
    expect(leaderboardSnapshot(board, "runs")?.rows).toEqual([
      { name: "Arjun Mehta", value: 210, detail: "5 inns · SR 141.2", playerId: "p1" },
    ]);
    expect(leaderboardSnapshot(board, "wickets")).toMatchObject({
      title: "Most wickets",
      rows: [{ name: "Faisal Khan", value: 9 }],
    });
  });

  it("gives the tournament figures of this match's players only", () => {
    const series = seriesSnapshot(board, ["p1", "p3", "nobody"])!;
    expect(series.p1).toMatchObject({ matches: 5, runs: 210, highest: "78*", average: 52.5 });
    expect(series.p3).toMatchObject({ wickets: 9, best: "3-14" });
    expect(series.nobody).toBeUndefined();
    const many = Array.from({ length: 50 }, () => "p1");
    expect(Object.keys(seriesSnapshot(board, many) ?? {}).length).toBeLessThanOrEqual(
      SNAPSHOT_LIMITS.series,
    );
  });

  it("finds the next scheduled match after now, not this one", () => {
    const now = new Date("2026-10-23T10:00:00Z");
    const snap = (id: string, at: string, status = "scheduled") => ({
      id,
      status,
      scheduled_at: at,
      venue: "Victoria Park",
      team1_snapshot: { id: "t1", name: "Riverside Rangers", short_name: "RIV" },
      team2_snapshot: { id: "t2", name: "Harbour Hawks", short_name: "HAW" },
    });
    expect(
      nextFixtureSnapshot(
        [
          snap("this", "2026-10-23T11:00:00Z"),
          snap("live", "2026-10-23T12:00:00Z", "live"),
          snap("next", "2026-10-25T09:00:00Z"),
        ],
        "this",
        now,
      ),
    ).toMatchObject({ team1: "Riverside Rangers", startsAt: "2026-10-25T09:00:00Z" });
    expect(nextFixtureSnapshot([], "this", now)).toBeNull();
  });

  it("leaves out what has no data", () => {
    expect(
      overlaySnapshots({ pointsTable: null, leaderboard: null, nextFixture: null, series: null }),
    ).toEqual({});
  });
});
