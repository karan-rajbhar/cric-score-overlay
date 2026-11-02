import { describe, expect, it } from "vitest";
import { matchTabFrom, matchTabsOf } from "./match-tabs";

const names = (m: Parameters<typeof matchTabsOf>[0]) =>
  matchTabsOf(m).map((t) => t.label);

describe("matchTabsOf", () => {
  it("offers only what has something in it before the start", () => {
    expect(names({ status: "scheduled", innings: [] })).toEqual([
      "Summary",
      "Squads",
    ]);
    expect(names({ status: "abandoned" })).toEqual(["Summary", "Squads"]);
  });

  it("offers everything once there is an innings, most used first", () => {
    expect(names({ status: "completed", innings: [{}] })).toEqual([
      "Summary",
      "Scorecard",
      "Balls",
      "Stats",
      "Squads",
    ]);
  });

  it("calls Summary Live while the match is on", () => {
    expect(names({ status: "live", innings: [{}] })[0]).toBe("Live");
    expect(names({ status: "innings_break", innings: [{}] })[0]).toBe("Live");
  });
});

describe("matchTabFrom", () => {
  it("reads a tab from the URL", () => {
    expect(matchTabFrom("scorecard")).toBe("scorecard");
  });

  it("falls back to Summary", () => {
    expect(matchTabFrom(null)).toBe("summary");
    expect(matchTabFrom("nonsense")).toBe("summary");
  });

  it("keeps older links working after the tabs were merged", () => {
    expect(matchTabFrom("superstars")).toBe("stats");
    expect(matchTabFrom("info")).toBe("summary");
  });
});
