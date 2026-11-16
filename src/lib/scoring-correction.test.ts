import { describe, expect, it } from "vitest";
import {
  battingAfterOut,
  correctionNoteOf,
  describeCorrection,
  overBowlerFixes,
  swapBattersFixes,
  withFixes,
} from "./scoring-correction";

const b = (id: string, over: number, ball: number, rest: Record<string, unknown> = {}) => ({
  id,
  over_number: over,
  ball_number: ball,
  batsman_id: "a",
  non_striker_id: "b",
  bowler_id: "w",
  ...rest,
});

describe("swapBattersFixes", () => {
  const log = [
    b("1", 0, 1),
    b("2", 0, 2, { batsman_id: "b", non_striker_id: "a" }),
    b("3", 0, 3, { batsman_id: "b", non_striker_id: "a", is_wicket: true, dismissal_type: "caught" }),
    b("4", 0, 4, { batsman_id: "c", non_striker_id: "a" }),
  ];

  it("swaps the two batters on every entry of the range, the wicket with them", () => {
    const r = swapBattersFixes(log, "3", null)!;
    expect(r.a).toBe("b");
    expect(r.b).toBe("a");
    expect(r.last).toBeNull();
    const after = withFixes(log, r.fixes);
    expect(after.slice(2).map((x) => [x.batsman_id, x.non_striker_id])).toEqual([
      ["a", "b"],
      ["c", "b"],
    ]);
    // The first two are outside the range.
    expect(after.slice(0, 2)).toEqual(log.slice(0, 2));
  });

  it("is null for a range that is not one", () => {
    expect(swapBattersFixes(log, "x", null)).toBeNull();
    expect(swapBattersFixes(log, "3", "1")).toBeNull();
    expect(swapBattersFixes([b("1", 0, 1, { non_striker_id: null })], "1", null)).toBeNull();
  });

  it("flags a batter left at the crease after being out", () => {
    // Swapping only up to the wicket leaves "a" out at 0.3, then batting at 0.4.
    const r = swapBattersFixes(log, "1", "3")!;
    const after = withFixes(log, r.fixes);
    expect([...battingAfterOut(after)]).toEqual(["4:a"]);
    expect(battingAfterOut(log).size).toBe(0);
  });
});

describe("overBowlerFixes", () => {
  it("moves the over's balls, leaves events and other overs", () => {
    const log = [b("1", 0, 1), b("2", 1, 1), b("e", 1, 1, { bowler_id: null }), b("3", 1, 2)];
    expect(overBowlerFixes(log, 1, "k")).toEqual({
      from: "w",
      fixes: [
        { ball_id: "2", bowler_id: "k" },
        { ball_id: "3", bowler_id: "k" },
      ],
    });
    expect(overBowlerFixes(log, 5, "k")).toBeNull();
  });
});

describe("correction notes", () => {
  it("reads a stored note and refuses anything else", () => {
    expect(correctionNoteOf({ kind: "over_bowler", over: 3, to_id: "k", junk: 1 })).toEqual({
      kind: "over_bowler",
      innings_number: null,
      over: 3,
      ball: null,
      to_over: null,
      to_ball: null,
      from_id: null,
      to_id: "k",
    });
    expect(correctionNoteOf({ kind: "drop_table" })).toBeNull();
    expect(correctionNoteOf(null)).toBeNull();
  });

  it("puts each correction in words", () => {
    const names: Record<string, string> = { a: "Sandeep sir", b: "Vinayak", k: "Karan Rajbhar" };
    const nameOf = (id: string) => names[id];
    expect(describeCorrection({ kind: "over_bowler", over: 3, to_id: "k" }, nameOf)).toBe(
      "changed the bowler of over 4 to Karan Rajbhar",
    );
    expect(
      describeCorrection(
        { kind: "swap_batters", over: 2, ball: 3, to_over: 2, to_ball: 6, from_id: "a", to_id: "b" },
        nameOf,
      ),
    ).toBe("swapped Sandeep sir and Vinayak from 2.3 to 2.6");
    expect(describeCorrection({ kind: "replace_player", from_id: "x", to_id: "b" }, nameOf)).toBe(
      "replaced a player with Vinayak for the whole match",
    );
    expect(describeCorrection({ kind: "edit_ball", over: 0, ball: 1 }, nameOf)).toBe(
      "corrected ball 0.1",
    );
  });
});
