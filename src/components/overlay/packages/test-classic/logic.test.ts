import { describe, expect, it } from "vitest";
import {
  DEMO_MATCH_DETAILS,
  DEMO_MATCH_STATE,
} from "~/app/overlay/[matchId]/demo-data";
import type { FallOfWicket, Innings, Match } from "~/lib/match-types";
import type { LiveMatchState } from "../../types";
import {
  bowlingFigures,
  earlierInningsOf,
  fallOfWickets,
  howOut,
  inningsTitle,
  isMultiInnings,
  matchYear,
  milestoneHeading,
  ordinal,
  oversLimitOf,
  partnershipRows,
  playerNames,
  scoreText,
  standingOf,
  surname,
  yetToBat,
} from "./logic";
import { teamStripe } from "./index";

/** A Test: RIV 325 all out, HAW 412 all out, RIV batting again. */
function testMatch(third: number, fourth?: { runs: number; wkts: number }) {
  const [i1, i2] = DEMO_MATCH_DETAILS.innings!;
  const inn = (n: number, team: string, runs: number, wkts: number, done: boolean, from: Innings): Innings => ({
    ...from,
    id: `t-${n}`,
    innings_number: n,
    team_id: team,
    total_runs: runs,
    total_wickets: wkts,
    is_completed: done,
  });
  const innings = [
    inn(1, DEMO_MATCH_DETAILS.team1_id, 325, 10, true, i1!),
    inn(2, DEMO_MATCH_DETAILS.team2_id, 412, 10, true, i2!),
    inn(3, DEMO_MATCH_DETAILS.team1_id, third, fourth ? 10 : 2, !!fourth, i1!),
  ];
  if (fourth) innings.push(inn(4, DEMO_MATCH_DETAILS.team2_id, fourth.runs, fourth.wkts, false, i2!));
  const match: Match = { ...DEMO_MATCH_DETAILS, match_format: "Test", innings };
  const riv: LiveMatchState = {
    ...DEMO_MATCH_STATE,
    match_format: "Test",
    overs_per_innings: null,
    innings_number: fourth ? 4 : 3,
    total_runs: fourth ? fourth.runs : third,
    total_wickets: fourth ? fourth.wkts : 2,
    batting_team_name: fourth ? DEMO_MATCH_STATE.team2_name : DEMO_MATCH_STATE.team1_name,
    bowling_team_name: fourth ? DEMO_MATCH_STATE.team1_name : DEMO_MATCH_STATE.team2_name,
    target_runs: null,
    runs_needed: null,
    balls_remaining: null,
    required_run_rate: null,
  };
  return { match, state: riv };
}

describe("figures in the long-form style", () => {
  it("writes ordinals, scores and bowling figures", () => {
    expect([1, 2, 3, 4, 11, 12, 13, 21, 22, 101].map(ordinal)).toEqual([
      "1st", "2nd", "3rd", "4th", "11th", "12th", "13th", "21st", "22nd", "101st",
    ]);
    expect(scoreText(138, 5)).toBe("138-5");
    expect(scoreText(212, 10)).toBe("212");
    expect(scoreText(null, null)).toBe("0-0");
    expect(bowlingFigures(112, 3, 42, 2)).toBe("18.4-3-42-2");
    expect(surname("Leo Fernandes")).toBe("Fernandes");
  });

  it("knows a multi-innings format and names its innings per side", () => {
    expect(isMultiInnings("Test")).toBe(true);
    expect(isMultiInnings("First-class")).toBe(true);
    expect(isMultiInnings("4-day")).toBe(true);
    expect(isMultiInnings("T20")).toBe(false);
    expect(isMultiInnings("ODI")).toBe(false);
    expect(isMultiInnings(null)).toBe(false);
    expect(inningsTitle(3, "Test")).toBe("2nd innings");
    expect(inningsTitle(2, "Test")).toBe("1st innings");
    expect(inningsTitle(3, "T20")).toBe("Super over");
    expect(inningsTitle(2, "T20")).toBe("2nd innings");
    expect(oversLimitOf(DEMO_MATCH_STATE)).toBe(20);
    expect(oversLimitOf({ ...DEMO_MATCH_STATE, match_format: "Test" })).toBeNull();
  });
});

describe("standingOf", () => {
  it("is the chase in a limited-overs second innings", () => {
    const s = standingOf(DEMO_MATCH_STATE, DEMO_MATCH_DETAILS);
    expect(s?.kind).toBe("chase");
    expect(s?.text).toBe(
      `Need ${DEMO_MATCH_STATE.runs_needed} from ${DEMO_MATCH_STATE.balls_remaining} balls`,
    );
  });

  it("is nothing in a first innings or once the target is reached", () => {
    expect(
      standingOf({ ...DEMO_MATCH_STATE, innings_number: 1, target_runs: null, runs_needed: null }, DEMO_MATCH_DETAILS),
    ).toBeNull();
    expect(standingOf({ ...DEMO_MATCH_STATE, runs_needed: 0 }, DEMO_MATCH_DETAILS)).toBeNull();
  });

  it("is the lead or the deficit from the innings totals in a Test", () => {
    const trail = testMatch(60);
    expect(standingOf(trail.state, trail.match)).toEqual({ kind: "trail", runs: 27, text: "Trail by 27" });
    const lead = testMatch(160);
    expect(standingOf(lead.state, lead.match)).toEqual({ kind: "lead", runs: 73, text: "Lead by 73" });
    const level = testMatch(87);
    expect(standingOf(level.state, level.match)?.kind).toBe("level");
    // The live row is fresher than the stored innings in play.
    expect(standingOf({ ...trail.state, total_runs: 90 }, trail.match)?.text).toBe("Lead by 3");
    // A strap has no match: nothing rather than a guess.
    expect(standingOf(trail.state, null)).toBeNull();
  });

  it("is a target with no ball limit in a Test's fourth innings", () => {
    const t = testMatch(191, { runs: 36, wkts: 1 });
    const s = standingOf({ ...t.state, target_runs: 105, runs_needed: 69 }, t.match);
    expect(s).toMatchObject({ kind: "chase", need: 69, balls: null, text: "Need 69 to win" });
  });

  it("finds the side's earlier innings for '325 & 112-2'", () => {
    const t = testMatch(112);
    expect(earlierInningsOf(t.state, t.match)?.total_runs).toBe(325);
    expect(earlierInningsOf(DEMO_MATCH_STATE, DEMO_MATCH_DETAILS)).toBeNull();
  });
});

describe("scorecard lines", () => {
  const fow = (over: Partial<FallOfWicket>): FallOfWicket[] => [
    {
      id: "f",
      match_id: "m",
      innings_id: "i",
      wicket_number: 1,
      runs_at_fall: 23,
      overs_at_fall: 4.2,
      batsman_out_id: "b1",
      ...over,
    },
  ];
  const out = (type: string) => ({ user_id: "b1", is_out: true, dismissal_type: type });

  it("names how a batter was out without guessing the fielder", () => {
    const names = new Map([
      ["bw", "Khan"],
      ["fd", "Shah"],
    ]);
    expect(howOut({ user_id: "b1", is_out: false, dismissal_type: null }, [])).toBe("not out");
    expect(howOut(out("caught"), fow({ bowler_id: "bw", fielder_id: "fd" }), names)).toBe("c Shah b Khan");
    expect(howOut(out("caught"), fow({ bowler_id: "bw", fielder_id: "bw" }), names)).toBe("c & b Khan");
    expect(howOut(out("caught"), fow({ bowler_id: "bw" }), names)).toBe("caught b Khan");
    expect(howOut(out("bowled"), fow({ bowler_id: "bw" }), names)).toBe("b Khan");
    expect(howOut(out("lbw"), fow({ bowler: { id: "bw", full_name: "Starc" } }))).toBe("lbw b Starc");
    expect(howOut(out("run_out"), fow({ fielder_id: "fd" }), names)).toBe("run out (Shah)");
    expect(howOut(out("run_out"), fow({}))).toBe("run out");
    expect(howOut(out("stumped"), fow({ bowler_id: "bw", fielder_id: "fd" }), names)).toBe("st Shah b Khan");
  });

  it("lists the fall of wickets with the stand each one broke", () => {
    const inn = DEMO_MATCH_DETAILS.innings![0]!;
    const list = fallOfWickets(inn);
    expect(list.length).toBe(inn.fall_of_wickets!.length);
    expect(list[0]!.wicket).toBe(1);
    expect(list[0]!.batter).toBeTruthy();
    const stand = inn.partnerships!.find((p) => p.wicket_number === 1)!;
    expect(list[0]!.stand).toBe(stand.runs);
  });

  it("labels each stand and the one at the crease", () => {
    const inn = DEMO_MATCH_DETAILS.innings![1]!;
    const rows = partnershipRows(inn);
    expect(rows[0]!.label).toBe("1st wkt");
    expect(rows.at(-1)!.current || rows.at(-1)!.wicket !== null).toBe(true);
    expect(rows.every((r) => r.a.name && r.b.name)).toBe(true);
  });

  it("lists who is yet to bat from the squad", () => {
    const inn = DEMO_MATCH_DETAILS.innings![1]!;
    const names = yetToBat(inn, DEMO_MATCH_DETAILS);
    const batted = new Set(inn.batting_performances!.filter((b) => b.balls_faced > 0 || b.is_out).map((b) => b.user?.full_name));
    expect(names.length).toBeGreaterThan(0);
    expect(names.some((n) => batted.has(n))).toBe(false);
    expect(yetToBat(inn, null)).toEqual([]);
  });

  it("resolves player names from the scorecards and squads", () => {
    const inn = DEMO_MATCH_DETAILS.innings![0]!;
    const names = playerNames(inn, DEMO_MATCH_DETAILS);
    const bowler = inn.bowling_performances![0]!;
    expect(names.get(bowler.user_id)).toBe(bowler.user?.full_name);
  });
});

describe("milestones and colours", () => {
  it("heads an honours board per milestone", () => {
    expect(milestoneHeading("hundred")).toBe("Century");
    expect(milestoneHeading("fifty")).toBe("Half-century");
    expect(milestoneHeading("five_for")).toBe("Five-wicket haul");
    expect(milestoneHeading("four")).toBeNull();
    expect(matchYear({ ...DEMO_MATCH_DETAILS, scheduled_at: "2026-07-10T10:00:00Z" })).toBe("2026");
    expect(matchYear({ ...DEMO_MATCH_DETAILS, scheduled_at: null })).toBeNull();
  });

  it("keeps a team stripe visible on the navy bar", () => {
    expect(teamStripe({ primary: "#b91c1c", secondary: null }, "#fff")).toBe("#b91c1c");
    // Navy on navy: the secondary, else the fallback.
    expect(teamStripe({ primary: "#10254a", secondary: "#f8fafc" }, "#fff")).toBe("#f8fafc");
    expect(teamStripe({ primary: "#0b1a33", secondary: null }, "#c9a24c")).toBe("#c9a24c");
    expect(teamStripe(null, "#c9a24c")).toBe("#c9a24c");
  });
});
