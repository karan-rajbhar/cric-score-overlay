import { describe, expect, it } from "vitest";
import {
  closeOfPlayOf,
  dayLine,
  daysOf,
  followOnLeadFor,
  followOnOf,
  fourthInningsTarget,
  inningsHeading,
  inningsMarks,
  inningsScoreText,
  isTwoInningsMatch,
  leadOf,
  nextAfterInnings,
  oversLimitOf,
  sideScoreText,
  standingLine,
  type InningsLine,
} from "./multi-innings";

const TEST = { innings_per_side: 2, match_format: "Test", days: 5 };
const other = (id: string) => (id === "A" ? "B" : "A");
const inn = (
  n: number,
  team: string,
  runs: number,
  extra: Partial<InningsLine> = {},
): InningsLine => ({
  innings_number: n,
  team_id: team,
  total_runs: runs,
  total_wickets: 10,
  total_balls: 300,
  is_completed: true,
  ...extra,
});

describe("two-innings matches", () => {
  it("are the matches with two innings a side", () => {
    expect(isTwoInningsMatch(TEST)).toBe(true);
    expect(isTwoInningsMatch({ match_format: "T20" })).toBe(false);
    expect(isTwoInningsMatch(null)).toBe(false);
  });

  it("have no overs limit unless they set one; limited overs keep 20 as before", () => {
    expect(oversLimitOf({ ...TEST, overs_per_innings: null })).toBeNull();
    expect(oversLimitOf({ ...TEST, overs_per_innings: 80 })).toBe(80);
    expect(oversLimitOf({ overs_per_innings: null })).toBe(20);
    expect(oversLimitOf({ overs_per_innings: 8 })).toBe(8);
  });

  it("know their days: a Test without them is five, any other two-innings match one", () => {
    expect(daysOf({ ...TEST, days: 2 })).toBe(2);
    expect(daysOf({ innings_per_side: 2, match_format: "Test" })).toBe(5);
    expect(daysOf({ innings_per_side: 2, match_format: "Custom" })).toBe(1);
    expect(daysOf({ match_format: "T20" })).toBeNull();
  });
});

describe("the follow-on (Law 14.1.1)", () => {
  it("needs 200 over five days, 150 over three or four, 100 over two, 75 in one", () => {
    expect([5, 4, 3, 2, 1].map(followOnLeadFor)).toEqual([200, 150, 150, 100, 75]);
  });

  it("is offered to the side batting first when it leads by enough, before a ball of the third innings", () => {
    const innings = [
      inn(1, "A", 400),
      inn(2, "B", 150),
      inn(3, "A", 0, { is_completed: false }),
    ];
    expect(followOnOf(TEST, innings, false)).toEqual({
      leaderId: "A",
      trailerId: "B",
      lead: 250,
      needed: 200,
      enforced: false,
    });
    // Once the third innings has a ball, it is decided.
    expect(followOnOf(TEST, innings, true)).toBeNull();
    // Enforced: the third innings is the trailer's.
    expect(
      followOnOf(TEST, [innings[0]!, innings[1]!, { ...innings[2]!, team_id: "B" }], false)
        ?.enforced,
    ).toBe(true);
  });

  it("is not offered short of the lead, nor in a limited-overs match", () => {
    const innings = [
      inn(1, "A", 300),
      inn(2, "B", 150),
      inn(3, "A", 0, { is_completed: false }),
    ];
    expect(followOnOf(TEST, innings, false)).toBeNull();
    expect(followOnOf({ ...TEST, days: 2 }, innings, false)?.needed).toBe(100);
    expect(followOnOf({ match_format: "T20" }, innings, false)).toBeNull();
  });
});

describe("what follows an innings", () => {
  it("opens the second innings with no target, then the side that batted first", () => {
    expect(nextAfterInnings(inn(1, "A", 300), [], other)).toEqual({
      kind: "next",
      teamId: "B",
      target: null,
    });
    expect(
      nextAfterInnings(inn(2, "B", 250), [inn(1, "A", 300)], other),
    ).toEqual({ kind: "next", teamId: "A", target: null });
  });

  it("sets the chase after the third innings: the lead plus one", () => {
    const before = [inn(1, "A", 300), inn(2, "B", 250)];
    expect(nextAfterInnings(inn(3, "A", 150), before, other)).toEqual({
      kind: "next",
      teamId: "B",
      target: 201,
    });
    // Level after three innings: one run wins it.
    expect(nextAfterInnings(inn(3, "A", 0), [inn(1, "A", 250), inn(2, "B", 250)], other)).toEqual({
      kind: "next",
      teamId: "B",
      target: 1,
    });
  });

  it("ends in a win by an innings when the side batting twice is still behind", () => {
    // B followed on and fell short again.
    const before = [inn(1, "A", 400), inn(2, "B", 150)];
    expect(nextAfterInnings(inn(3, "B", 200), before, other)).toEqual({
      kind: "innings_win",
      winnerId: "A",
      margin: 50,
    });
    // A batted again (no follow-on) and could not catch B's one innings.
    expect(
      nextAfterInnings(inn(3, "A", 100), [inn(1, "A", 150), inn(2, "B", 400)], other),
    ).toEqual({ kind: "innings_win", winnerId: "B", margin: 150 });
  });

  it("leaves the fourth innings to the chase", () => {
    expect(nextAfterInnings(inn(4, "B", 100), [], other)).toEqual({
      kind: "decided",
    });
  });

  it("works out the fourth innings' target from the first three", () => {
    const innings = [inn(1, "A", 300), inn(2, "B", 250), inn(3, "A", 150)];
    expect(fourthInningsTarget(innings, "B")).toBe(201);
    expect(fourthInningsTarget(innings.slice(0, 2), "B")).toBeNull();
  });
});

describe("where a side stands", () => {
  const innings = [inn(1, "A", 300), inn(2, "B", 180, { is_completed: false, total_wickets: 4 })];

  it("leads or trails over the innings so far", () => {
    expect(leadOf(innings, "B", 2)).toBe(-120);
    expect(standingLine(innings, innings[1]!, "Bravo")).toBe("Bravo trail by 120 runs");
    expect(standingLine(innings, { ...innings[1]!, total_runs: 301 }, "Bravo")).toBe(
      "Bravo lead by 1 run",
    );
    expect(standingLine(innings, { ...innings[1]!, total_runs: 300 }, "Bravo")).toBe(
      "Scores level",
    );
    expect(standingLine(innings, innings[1]!)).toBe("Trail by 120 runs");
  });

  it("needs runs to win in the fourth innings, and says nothing in the first", () => {
    const chase = inn(4, "B", 100, { target_runs: 230, is_completed: false });
    expect(standingLine([], chase, "Bravo")).toBe("Bravo need 130 runs to win");
    expect(standingLine([], inn(1, "A", 50))).toBeNull();
  });
});

describe("scorecard wording", () => {
  it("writes all out as runs alone, a declaration with d, a forfeit by name", () => {
    expect(inningsScoreText(inn(1, "A", 245))).toBe("245");
    expect(
      inningsScoreText(inn(1, "A", 450, { total_wickets: 7, declared: true })),
    ).toBe("450/7d");
    expect(
      inningsScoreText(inn(1, "A", 180, { total_wickets: 4, is_completed: false })),
    ).toBe("180/4");
    expect(
      inningsScoreText(
        inn(3, "A", 0, { total_wickets: 0, total_balls: 0, declared: true }),
      ),
    ).toBe("forfeited");
  });

  it("joins a side's innings with &", () => {
    const innings = [
      inn(1, "A", 245),
      inn(2, "B", 300),
      inn(3, "A", 180, { total_wickets: 4, is_completed: false }),
    ];
    expect(sideScoreText(TEST, innings, "A")).toBe("245 & 180/4");
    expect(sideScoreText(TEST, innings, "B")).toBe("300");
  });

  it("marks a follow-on and a declaration", () => {
    expect(inningsMarks(inn(3, "B", 200, { follow_on: true }))).toEqual(["f/o"]);
    expect(inningsMarks(inn(1, "A", 450, { declared: true }))).toEqual(["dec"]);
    expect(inningsMarks(inn(1, "A", 450))).toEqual([]);
  });

  it("names each side's innings, and super overs only after a limited-overs match", () => {
    expect(inningsHeading(TEST, { innings_number: 3 })).toBe("2nd innings");
    expect(inningsHeading(TEST, { innings_number: 3, follow_on: true })).toBe(
      "2nd innings (f/o)",
    );
    expect(inningsHeading(TEST, { innings_number: 2 })).toBe("1st innings");
    expect(inningsHeading({ match_format: "T20" }, { innings_number: 2 })).toBe(
      "2nd innings",
    );
    expect(inningsHeading({ match_format: "T20" }, { innings_number: 3 })).toBe(
      "Super over",
    );
  });
});

describe("days of play", () => {
  it("say the day and any break while the match is live", () => {
    expect(dayLine({ ...TEST, status: "live", current_day: 2 })).toBe("Day 2");
    expect(
      dayLine({ ...TEST, status: "live", current_day: 1, play_break: "stumps" }),
    ).toBe("Stumps, day 1");
    expect(dayLine({ ...TEST, status: "live", play_break: "lunch" })).toBe(
      "Lunch, day 1",
    );
    expect(dayLine({ ...TEST, status: "completed" })).toBeNull();
    expect(dayLine({ match_format: "T20", status: "live" })).toBeNull();
  });

  it("keep the score at the close of play", () => {
    expect(
      closeOfPlayOf(1, {
        innings_number: 2,
        team_id: "B",
        total_runs: 180,
        total_wickets: 4,
        total_balls: 312,
      }),
    ).toEqual({
      day: 1,
      innings_number: 2,
      team_id: "B",
      runs: 180,
      wickets: 4,
      balls: 312,
    });
  });
});
