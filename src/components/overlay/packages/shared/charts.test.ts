import { describe, expect, it } from "vitest";
import { DEMO_MATCH_DETAILS, DEMO_MATCH_STATE } from "~/app/overlay/[matchId]/demo-data";
import type { BallEvent } from "~/lib/match-types";
import {
  axisMax,
  chartOvers,
  favouriteSector,
  overTable,
  phaseRates,
  runsPerOver,
  SECTORS,
  sectorTotals,
  wagonWheelShots,
  wormSeries,
  wormWickets,
} from "./charts";

const first = DEMO_MATCH_DETAILS.innings![0]!;
const second = DEMO_MATCH_DETAILS.innings![1]!;

const ball = (over: number, runs: number, extra: Partial<BallEvent> = {}): BallEvent => ({
  id: `b-${over}-${Math.random()}`,
  match_id: "m",
  innings_id: "i",
  over_number: over,
  ball_number: 1,
  batsman_id: "bat",
  runs_scored: runs,
  extras: 0,
  is_wicket: false,
  ...extra,
});

describe("over series", () => {
  // The ball log's over_number is 0-based; the series are 1-based.
  const table = overTable([ball(0, 4), ball(0, 1), ball(1, 6), ball(1, 0, { is_wicket: true }), ball(2, 2)]);

  it("adds up each over", () => {
    expect(runsPerOver(table)).toEqual([
      { over: 1, runs: 5, wickets: 0 },
      { over: 2, runs: 6, wickets: 1 },
      { over: 3, runs: 2, wickets: 0 },
    ]);
  });

  it("draws the worm from 0 with a marker where wickets fell", () => {
    const worm = wormSeries(table);
    expect(worm.map((p) => [p.over, p.runs])).toEqual([
      [0, 0],
      [1, 5],
      [2, 11],
      [3, 13],
    ]);
    expect(wormWickets(worm)).toEqual([{ over: 2, runs: 11, wickets: 1, wicketsSoFar: 1 }]);
  });

  it("matches the innings' totals on the demo match", () => {
    const t = overTable(first.ball_by_ball ?? []);
    expect(t.at(-1)!.cumulativeRuns).toBe(first.total_runs);
    expect(t.at(-1)!.cumulativeWickets).toBe(first.total_wickets);
  });

  it("splits a T20 into powerplay, middle and death overs", () => {
    const t = overTable(first.ball_by_ball ?? []);
    const phases = phaseRates(t, 20);
    expect(phases.map((p) => [p.label, p.from, p.to])).toEqual([
      ["Powerplay", 1, 6],
      ["Middle overs", 7, 15],
      ["Death overs", 16, 20],
    ]);
    expect(phases.reduce((n, p) => n + p.runs, 0)).toBe(
      t.reduce((n, o) => n + o.runs, 0),
    );
    expect(phases[0]!.runRate).toBeCloseTo(phases[0]!.runs / phases[0]!.overs);
    // A short game is one phase; a phase not reached has no rate.
    expect(phaseRates(table, 3).map((p) => p.label)).toEqual(["Innings"]);
    expect(phaseRates(table, 20)[2]!.runRate).toBeNull();
  });

  it("sizes the axes", () => {
    expect(chartOvers(20, [table])).toBe(20);
    expect(chartOvers(null, [table])).toBe(20);
    expect(chartOvers(2, [table])).toBe(3);
    expect(axisMax(23, 5)).toBe(25);
    expect(axisMax(0, 5)).toBe(5);
  });
});

describe("wagon wheel", () => {
  it("places a batter's scoring shots by zone", () => {
    const id = DEMO_MATCH_STATE.striker_id!;
    const shots = wagonWheelShots(second.ball_by_ball ?? [], id);
    expect(shots.length).toBeGreaterThan(0);
    for (const s of shots) {
      expect(s.runs).toBeGreaterThan(0);
      expect(SECTORS.some((x) => x.id === s.sectorId)).toBe(true);
      expect(s.reach).toBeGreaterThan(0);
      expect(s.reach).toBeLessThanOrEqual(1);
    }
    const totals = sectorTotals(shots);
    expect(totals).toHaveLength(SECTORS.length);
    expect(totals.reduce((n, t) => n + t.runs, 0)).toBe(shots.reduce((n, s) => n + s.runs, 0));
    expect(favouriteSector(totals)!.runs).toBe(Math.max(...totals.map((t) => t.runs)));
  });

  it("leaves out dots, shots without a zone and other batters", () => {
    const balls = [
      ball(1, 0, { shot_zone: SECTORS[0]!.id }),
      ball(1, 4, { shot_zone: null }),
      ball(1, 6, { shot_zone: SECTORS[1]!.id, batsman_id: "other" }),
      ball(1, 6, { shot_zone: SECTORS[1]!.id }),
    ];
    const shots = wagonWheelShots(balls, "bat");
    expect(shots).toHaveLength(1);
    expect(shots[0]).toMatchObject({ runs: 6, reach: 1, sectorId: SECTORS[1]!.id });
    expect(wagonWheelShots(balls, null)).toEqual([]);
    expect(favouriteSector(sectorTotals([]))).toBeNull();
  });
});
