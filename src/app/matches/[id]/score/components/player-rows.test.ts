import { describe, expect, it } from "vitest";
import type { BattingPerformance, BowlingPerformance } from "~/lib/match-types";
import {
  bowlerQuota,
  buildBatterRows,
  buildBowlerRows,
  buildFielderRows,
} from "./player-rows";

const p = (id: string, extra: Record<string, unknown> = {}) => ({
  user_id: id,
  user: { full_name: id.toUpperCase() },
  ...extra,
});

const bat = (
  id: string,
  extra: Partial<BattingPerformance> = {},
): BattingPerformance => ({
  id: `bp-${id}`,
  match_id: "m",
  innings_id: "i",
  user_id: id,
  runs_scored: 0,
  balls_faced: 0,
  fours: 0,
  sixes: 0,
  is_out: false,
  ...extra,
});

const bowl = (
  id: string,
  extra: Partial<BowlingPerformance> = {},
): BowlingPerformance => ({
  id: `bw-${id}`,
  match_id: "m",
  innings_id: "i",
  user_id: id,
  overs_bowled: 0,
  balls_bowled: 0,
  runs_conceded: 0,
  wickets_taken: 0,
  maidens: 0,
  wides: 0,
  no_balls: 0,
  ...extra,
});

describe("buildBatterRows", () => {
  it("orders yet-to-bat by batting order, then retired hurt, the crease, and the dismissed", () => {
    const { rows, nextInId } = buildBatterRows({
      players: [
        p("a"),
        p("b", { batting_order: 5 }),
        p("c", { batting_order: 3, role_in_team: "wicket_keeper" }),
        p("d"),
        p("e"),
        p("f"),
        p("opp"),
      ],
      performances: [
        bat("d", {
          runs_scored: 30,
          balls_faced: 20,
          is_out: true,
          batting_position: 1,
        }),
        bat("e", {
          runs_scored: 8,
          balls_faced: 5,
          dismissal_type: "retired_hurt",
        }),
        bat("f", { runs_scored: 4, balls_faced: 2 }),
        bat("a", {
          is_out: true,
          dismissal_type: "retired_out",
          batting_position: 2,
        }),
      ],
      excludeIds: new Set(["opp"]),
      strikerId: "f",
      nonStrikerId: null,
    });
    expect(rows.map((r) => r.id)).toEqual(["c", "b", "e", "f", "d", "a"]);
    expect(nextInId).toBe("c");
    expect(rows[0]).toMatchObject({ tag: "Next in", role: "(wk)" });
    expect(rows.find((r) => r.id === "e")).toMatchObject({
      note: "Retired hurt",
      detail: "8 (5)",
    });
    expect(rows.find((r) => r.id === "f")?.tag).toBe("Striker");
    expect(rows.find((r) => r.id === "d")?.disabledReason).toBe("Out");
    expect(rows.find((r) => r.id === "a")?.disabledReason).toBe("Retired out");
  });

  it("dedupes players and leaves out the current bowler", () => {
    const { rows } = buildBatterRows({
      players: [p("a"), p("a"), p("bowler")],
      bowlerId: "bowler",
    });
    expect(rows.map((r) => r.id)).toEqual(["a"]);
  });
});

describe("buildBowlerRows", () => {
  it("lists the attack by overs, then fresh bowlers, then quota used, then last over's bowler", () => {
    const { rows, onlyEligibleId } = buildBowlerRows({
      players: [
        p("fresh"),
        p("one"),
        p("three"),
        p("last"),
        p("capped"),
        p("bat"),
      ],
      performances: [
        bowl("one", { overs_bowled: 1, runs_conceded: 6 }),
        bowl("three", {
          overs_bowled: 3,
          maidens: 1,
          runs_conceded: 12,
          wickets_taken: 2,
        }),
        bowl("last", { overs_bowled: 2 }),
        bowl("capped", { overs_bowled: 4 }),
      ],
      batterIds: ["bat"],
      lastOverBowlerId: "last",
      oversPerInnings: 20,
    });
    expect(rows.map((r) => r.id)).toEqual([
      "three",
      "one",
      "fresh",
      "capped",
      "last",
    ]);
    expect(rows[0]?.detail).toBe("3-1-12-2 · 1 left");
    expect(rows.find((r) => r.id === "capped")?.note).toBe("Quota used");
    expect(rows.find((r) => r.id === "last")?.disabledReason).toBe(
      "Bowled last over",
    );
    expect(onlyEligibleId).toBeNull();
  });

  it("reports the only eligible bowler", () => {
    const { onlyEligibleId } = buildBowlerRows({
      players: [p("x"), p("y")],
      lastOverBowlerId: "x",
    });
    expect(onlyEligibleId).toBe("y");
  });

  it("has no quota for short games", () => {
    expect(bowlerQuota(4)).toBeNull();
    expect(bowlerQuota(10)).toBe(2);
    expect(bowlerQuota(50)).toBe(10);
  });
});

describe("buildFielderRows", () => {
  it("puts the keeper first for a stumping and tags the bowler", () => {
    const rows = buildFielderRows({
      players: [p("a"), p("k", { role_in_team: "wicket_keeper" }), p("bw")],
      bowlerId: "bw",
      keeperFirst: true,
    });
    expect(rows.map((r) => r.id)).toEqual(["k", "a", "bw"]);
    expect(rows[2]?.tag).toBe("Bowler");
  });
});
