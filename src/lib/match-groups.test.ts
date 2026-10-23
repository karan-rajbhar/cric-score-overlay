import { describe, expect, it } from "vitest";
import { matchGroupsOf } from "./match-groups";

describe("matchGroupsOf", () => {
  it("keeps abandoned and cancelled matches, apart from the results", () => {
    const m = (id: string, status: string) => ({ id, status });
    const groups = matchGroupsOf([
      m("a", "live"),
      m("b", "scheduled"),
      m("c", "completed"),
      m("d", "abandoned"),
      m("e", "cancelled"),
    ]);
    expect(groups.live.map((x) => x.id)).toEqual(["a"]);
    expect(groups.upcoming.map((x) => x.id)).toEqual(["b"]);
    expect(groups.results.map((x) => x.id)).toEqual(["c"]);
    expect(groups.noResult.map((x) => x.id)).toEqual(["d", "e"]);
  });
});
