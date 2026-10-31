import { describe, expect, it } from "vitest";
import {
  DEMO_BREAK_STATE,
  DEMO_FIRST_INNINGS_STATE,
  DEMO_MATCH_DETAILS,
  DEMO_MATCH_STATE,
  DEMO_PRE_STATE,
  DEMO_RESULT_MATCH,
} from "~/app/overlay/[matchId]/demo-data";
import type { LiveMatchState } from "../../types";
import {
  avatarOf,
  ballsBowled,
  ballsRemaining,
  batterFigures,
  batterNow,
  bowlerFigures,
  bowlerNow,
  chaseLine,
  estimateOf,
  initialsOf,
  inningsBalls,
  inningsLeaders,
  monogramOf,
  overBall,
  overSlotsLeft,
  partnershipOf,
  playerTeamOf,
  projectedTotals,
  rateMeter,
  roleMark,
  shortName,
  thisOverBalls,
} from "./derive";

const live = (over: Partial<LiveMatchState> = {}): LiveMatchState => ({
  ...DEMO_MATCH_STATE,
  ...over,
});

describe("balls", () => {
  it("knows the innings' balls, bowled and left", () => {
    expect(inningsBalls(live())).toBe(120);
    expect(inningsBalls(live({ dls_overs: 15 }))).toBe(90);
    expect(inningsBalls(live({ innings_number: 3 }))).toBe(6);
    expect(inningsBalls(live({ overs_per_innings: null }))).toBeNull();
    expect(ballsBowled(live({ total_balls: 112 }))).toBe(112);
    // The chase's own figure first, else the limit less the balls bowled.
    expect(ballsRemaining(live({ balls_remaining: 8 }))).toBe(8);
    expect(ballsRemaining(live({ balls_remaining: null, total_balls: 74 }))).toBe(46);
  });
});

describe("chaseLine", () => {
  it("says what the chase needs", () => {
    const c = chaseLine(
      live({ target_runs: 157, runs_needed: 19, balls_remaining: 8, required_run_rate: 14.25, current_run_rate: 7.39 }),
    )!;
    expect(c.text).toBe("Need 19 from 8 balls");
    expect(c.short).toBe("19 from 8");
    expect(c.requiredRate).toBe(14.25);
    expect(c.currentRate).toBe(7.39);
    expect(chaseLine(live({ runs_needed: 1, balls_remaining: 1 }))!.text).toBe(
      "Need 1 from 1 ball",
    );
  });

  it("is null outside a chase in progress", () => {
    expect(chaseLine(DEMO_FIRST_INNINGS_STATE)).toBeNull();
    expect(chaseLine(DEMO_PRE_STATE)).toBeNull();
    expect(chaseLine(live({ runs_needed: 0 }))).toBeNull();
    expect(chaseLine(live({ innings_completed: true }))).toBeNull();
  });

  it("works the required rate out when the row has none", () => {
    const c = chaseLine(live({ target_runs: 100, runs_needed: 30, balls_remaining: 30, required_run_rate: null }))!;
    expect(c.requiredRate).toBe(6);
  });
});

describe("rateMeter", () => {
  const chase = (crr: number, rrr: number) =>
    live({ current_run_rate: crr, required_run_rate: rrr, runs_needed: 20, total_balls: 60 });
  it("lights a segment per run an over of difference, capped", () => {
    expect(rateMeter(chase(6, 9))).toMatchObject({ trend: "behind", lit: 3 });
    expect(rateMeter(chase(12, 9))).toMatchObject({ trend: "ahead", lit: 3 });
    expect(rateMeter(chase(9.2, 9))).toMatchObject({ trend: "level", lit: 0 });
    expect(rateMeter(chase(2, 14))!.lit).toBe(5);
  });
  it("is null outside a chase", () => {
    expect(rateMeter(DEMO_FIRST_INNINGS_STATE)).toBeNull();
    expect(rateMeter(live({ total_balls: 0 }))).toBeNull();
  });
});

describe("projectedTotals", () => {
  it("projects the first innings at its rate and at fixed rates", () => {
    // 100/2 after 10 overs of 20: 10 overs left.
    const p = projectedTotals(
      live({ innings_number: 1, total_runs: 100, total_balls: 60, target_runs: null }),
    );
    expect(p.map((x) => [x.label, x.total])).toEqual([
      ["CRR", 200],
      ["8", 180],
      // 10 an over is the current rate: left out.
      ["12", 220],
    ]);
  });
  it("is empty outside a first innings in play", () => {
    expect(projectedTotals(DEMO_MATCH_STATE)).toEqual([]);
    expect(projectedTotals(live({ innings_number: 1, total_balls: 0 }))).toEqual([]);
    expect(projectedTotals(live({ innings_number: 1, total_balls: 120 }))).toEqual([]);
  });
  it("gives the model's estimate for the row", () => {
    expect(estimateOf(DEMO_FIRST_INNINGS_STATE)?.kind).toBe("projection");
    expect(estimateOf(DEMO_MATCH_STATE)?.kind).toBe("chase");
    expect(estimateOf(DEMO_PRE_STATE)).toBeNull();
  });
});

describe("partnershipOf", () => {
  it("splits the stand between the batters from the innings", () => {
    const p = partnershipOf(DEMO_MATCH_STATE, DEMO_MATCH_DETAILS.innings)!;
    expect(p.runs).toBe(DEMO_MATCH_STATE.partnership_runs);
    expect(p.batters[0].name).toBe(DEMO_MATCH_STATE.striker_name);
    expect(p.split).toBe(true);
    expect((p.batters[0].runs ?? 0) + (p.batters[1].runs ?? 0)).toBeLessThanOrEqual(p.runs);
  });
  it("has no split without the innings, and nothing without two batters", () => {
    const p = partnershipOf(DEMO_MATCH_STATE)!;
    expect(p.split).toBe(false);
    expect(p.batters[1].runs).toBeNull();
    expect(partnershipOf(DEMO_BREAK_STATE)).toBeNull();
  });
});

describe("this over", () => {
  it("classifies each entry and keeps its label", () => {
    expect(overBall("nb+2b")).toEqual({ token: "nb+2b", kind: "extra", label: "nb+2b", legal: false });
    expect(overBall("wd+1")).toMatchObject({ kind: "extra", legal: false });
    expect(overBall("lb1")).toMatchObject({ kind: "extra", legal: true });
    expect(overBall("W")).toMatchObject({ kind: "wicket", legal: true });
    expect(overBall("W+3")).toEqual({ token: "W+3", kind: "wicket", label: "W+3", legal: true });
    expect(overBall("W+wd")).toMatchObject({ kind: "wicket", legal: false });
    expect(overBall("rh")).toMatchObject({ kind: "event", legal: false });
    expect(overBall("p5")).toMatchObject({ kind: "event", legal: false });
    expect(overBall("4").kind).toBe("four");
    expect(overBall("6").kind).toBe("six");
    expect(overBall("0").kind).toBe("dot");
    expect(overBall("2").kind).toBe("run");
  });
  it("counts the slots left by legal balls only", () => {
    const balls = thisOverBalls({ this_over_balls: "1 wd 4 nb+2b W" });
    expect(balls.map((b) => b.label)).toEqual(["1", "wd", "4", "nb+2b", "W"]);
    expect(overSlotsLeft(balls)).toBe(3);
    expect(thisOverBalls({ this_over_balls: null })).toEqual([]);
  });
});

describe("figures", () => {
  it("formats batter and bowler figures", () => {
    expect(batterFigures(34, 28)).toBe("34 (28)");
    expect(batterFigures(34, 28, true)).toBe("34* (28)");
    expect(bowlerFigures(2, 26)).toBe("2-26");
  });
  it("reads the batters and bowler from the live row", () => {
    const s = batterNow(DEMO_MATCH_STATE, "striker")!;
    expect(s.name).toBe(DEMO_MATCH_STATE.striker_name);
    expect(s.figures).toBe(
      `${DEMO_MATCH_STATE.striker_runs} (${DEMO_MATCH_STATE.striker_balls})`,
    );
    expect(s.striker).toBe(true);
    expect(batterNow(DEMO_BREAK_STATE, "striker")).toBeNull();
    const b = bowlerNow(live({ bowler_balls: 22, bowler_runs: 26, bowler_wickets: 2 }))!;
    expect(b.overs).toBe("3.4");
    expect(b.line).toBe("2-26 (3.4)");
    expect(b.economy).toBe("7.09");
    expect(bowlerNow(DEMO_BREAK_STATE)).toBeNull();
  });
});

describe("names", () => {
  it("shortens long names to fit", () => {
    expect(shortName("Ravi Iyer", 18)).toBe("Ravi Iyer");
    expect(shortName("Venkatanarasimha Raghavan", 18)).toBe("V. Raghavan");
    expect(shortName("Mohammed Abdul Rahman Khan", 12)).toBe("M. Khan");
    expect(shortName("Wolfeschlegelsteinhausen", 10)).toBe("Wolfeschl…");
    expect(shortName(null)).toBe("");
  });
  it("makes initials and monograms", () => {
    expect(initialsOf("Ravi Iyer")).toBe("RI");
    expect(initialsOf("")).toBe("");
    expect(monogramOf("Riverside Rangers", "RIV")).toBe("RR");
    expect(monogramOf("Quarry Lane Kites", "QUA")).toBe("QLK");
    expect(monogramOf("Hawks", "HAW")).toBe("HAW");
    expect(roleMark("captain")).toBe(" (c)");
    expect(roleMark("wicket_keeper")).toBe(" (wk)");
    expect(roleMark("Batter")).toBe("");
  });
});

describe("players", () => {
  it("finds a player's photo and side in what the match carries", () => {
    const id = DEMO_RESULT_MATCH.player_of_the_match!.id;
    expect(avatarOf(DEMO_RESULT_MATCH, id)).toBeNull();
    const withPhoto = {
      ...DEMO_RESULT_MATCH,
      player_of_the_match: { ...DEMO_RESULT_MATCH.player_of_the_match!, avatar_url: "https://x/p.png" },
    };
    expect(avatarOf(withPhoto, id)).toBe("https://x/p.png");
    expect(playerTeamOf(DEMO_MATCH_DETAILS, DEMO_MATCH_DETAILS.team2.team_players![0]!.user_id)).toBe(2);
    expect(playerTeamOf(DEMO_MATCH_DETAILS, "nobody")).toBeNull();
  });
  it("ranks an innings' leaders", () => {
    const inn = DEMO_MATCH_DETAILS.innings![0]!;
    const { batters, bowlers } = inningsLeaders(inn, 3, 2);
    expect(batters).toHaveLength(3);
    expect(batters[0]!.runs_scored).toBeGreaterThanOrEqual(batters[1]!.runs_scored);
    expect(bowlers[0]!.wickets_taken).toBeGreaterThanOrEqual(bowlers[1]!.wickets_taken);
  });
});
