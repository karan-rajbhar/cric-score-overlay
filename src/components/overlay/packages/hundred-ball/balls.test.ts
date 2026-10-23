import { describe, expect, it } from "vitest";
import { DEMO_MATCH_STATE } from "~/app/overlay/[matchId]/demo-data";
import type { LiveMatchState } from "../../types";
import {
  ballCountOf,
  ballOfOvers,
  ballsPerOverFrom,
  chaseOf,
  chaseStatement,
  currentSetOf,
  inningsBallLimit,
  numberedBalls,
  per100,
  phaseTotalOf,
  setTotalsOf,
  setWordOf,
  surnameOf,
  tokenKind,
  wormOf,
} from "./balls";

/** A 100-ball game: 20 sets of 5. */
const hundred = (over: Partial<LiveMatchState> = {}): LiveMatchState => ({
  ...DEMO_MATCH_STATE,
  overs_per_innings: 20,
  innings_number: 2,
  total_balls: 62,
  current_over: 12,
  current_ball: 2,
  balls_remaining: 38,
  runs_needed: 41,
  target_runs: 150,
  innings_completed: false,
  this_over_balls: "4 wd 1",
  dls_overs: undefined,
  ...over,
});

describe("balls per over", () => {
  it("takes the match's setting first", () => {
    expect(ballsPerOverFrom(hundred(), { balls_per_over: 5 })).toBe(5);
    expect(ballsPerOverFrom(hundred(), { balls_per_over: 6 })).toBe(6);
  });

  it("reads it back from the live row's position without a match (straps)", () => {
    // 62 balls = 12 sets of 5 and 2 balls.
    expect(ballsPerOverFrom(hundred(), null)).toBe(5);
    // 74 balls = 12 overs of 6 and 2 balls.
    expect(
      ballsPerOverFrom(hundred({ total_balls: 74, current_over: 12, current_ball: 2 }), null),
    ).toBe(6);
  });

  it("falls back on the chase, then on 6", () => {
    const early = hundred({ total_balls: 3, current_over: 0, current_ball: 3, balls_remaining: 97 });
    expect(ballsPerOverFrom(early, null)).toBe(5);
    expect(
      ballsPerOverFrom(hundred({ total_balls: 3, current_over: 0, current_ball: 3, balls_remaining: null }), null),
    ).toBe(6);
    expect(ballsPerOverFrom(null)).toBe(6);
  });

  it("calls five-ball overs sets", () => {
    expect(setWordOf(5)).toBe("Set");
    expect(setWordOf(6)).toBe("Over");
  });
});

describe("balls in the innings", () => {
  it("is the overs times the balls per over, one over in a super over, the DLS overs when revised", () => {
    expect(inningsBallLimit({ innings_number: 1, overs_per_innings: 20 }, 5)).toBe(100);
    expect(inningsBallLimit({ innings_number: 3, overs_per_innings: 20 }, 6)).toBe(6);
    expect(
      inningsBallLimit({ innings_number: 2, overs_per_innings: 20, dls_overs: 16 }, 6),
    ).toBe(96);
    expect(inningsBallLimit({ innings_number: 1, overs_per_innings: null }, 6)).toBeNull();
  });

  it("counts balls left from the chase, else from the innings' length", () => {
    expect(ballCountOf(hundred(), 5)).toEqual({ bowled: 62, limit: 100, left: 38 });
    expect(
      ballCountOf(hundred({ innings_number: 1, balls_remaining: null }), 5),
    ).toEqual({ bowled: 62, limit: 100, left: 38 });
    expect(
      ballCountOf(hundred({ overs_per_innings: null, balls_remaining: null }), 5),
    ).toEqual({ bowled: 62, limit: null, left: null });
  });

  it("finds the set in progress, extras not counted as its balls", () => {
    // "4 wd 1": two legal balls of set 13 (balls 61 and 62).
    expect(currentSetOf(hundred(), 5)).toEqual({
      number: 13,
      word: "Set",
      tokens: ["4", "wd", "1"],
      open: 3,
    });
    expect(currentSetOf(hundred({ this_over_balls: null, total_balls: 60 }), 5).number).toBe(13);
  });

  it("colours deliveries by what happened", () => {
    expect(["0", "1", "4", "6", "W", "1+wd", "nb+2lb"].map(tokenKind)).toEqual([
      "dot",
      "run",
      "four",
      "six",
      "wicket",
      "extra",
      "extra",
    ]);
  });
});

describe("the chase", () => {
  it("is one statement while it is on", () => {
    const chase = chaseOf(hundred());
    expect(chase).toEqual({ runs: 41, balls: 38, target: 150 });
    expect(chaseStatement(chase!)).toBe("Needs 41 from 38 balls");
    expect(chaseStatement({ runs: 2, balls: 1, target: null })).toBe("Needs 2 from 1 ball");
  });

  it("is over once the runs are got or the innings is done", () => {
    expect(chaseOf(hundred({ runs_needed: 0 }))).toBeNull();
    expect(chaseOf(hundred({ innings_completed: true }))).toBeNull();
    expect(chaseOf(hundred({ runs_needed: null, balls_remaining: null }))).toBeNull();
  });
});

describe("small helpers", () => {
  it("turns stored overs into a ball number", () => {
    expect(ballOfOvers(11.2, 6)).toBe(68);
    expect(ballOfOvers(11.2, 5)).toBe(57);
    expect(ballOfOvers(0.1, 5)).toBe(1);
  });

  it("takes a surname, single names as they are", () => {
    expect(surnameOf("Arjun Mehta")).toBe("Mehta");
    expect(surnameOf("Imran")).toBe("Imran");
    expect(surnameOf(null)).toBe("");
  });

  it("gives a scoring rate per 100 balls", () => {
    expect(per100(47, 36)).toBe("131");
    expect(per100(10, 0)).toBeNull();
  });
});

describe("the ball log", () => {
  const ball = (over: number, runs: number, extra?: string, wicket = false) => ({
    over_number: over,
    runs_scored: extra ? 0 : runs,
    extras: extra ? runs : 0,
    extra_type: extra ?? null,
    is_wicket: wicket,
  });
  const log = [
    ball(0, 4),
    ball(0, 1, "wide"),
    ball(0, 0, undefined, true),
    ball(0, 6),
    ball(1, 1),
    ball(1, 2, "no_ball"),
    ball(1, 1),
  ];

  it("numbers each delivery by the legal ball it belongs to", () => {
    expect(numberedBalls(log).map((x) => x.ball)).toEqual([1, 2, 2, 3, 4, 5, 5]);
  });

  it("draws the worm in balls, wickets where they fell", () => {
    const worm = wormOf(log);
    expect(worm.points.at(-1)).toEqual({ ball: 5, runs: 15 });
    expect(worm.wickets).toEqual([{ ball: 2, runs: 5 }]);
  });

  it("totals each set", () => {
    expect(setTotalsOf(log)).toEqual([
      { number: 1, runs: 11, wickets: 1 },
      { number: 2, runs: 4, wickets: 0 },
    ]);
  });

  it("totals a phase by ball numbers", () => {
    expect(phaseTotalOf(log, 1, 2)).toEqual({ balls: 2, runs: 5, wickets: 1 });
    expect(phaseTotalOf(log, 3, 5)).toEqual({ balls: 3, runs: 10, wickets: 0 });
    expect(phaseTotalOf(log, 50, 60)).toBeNull();
  });
});
