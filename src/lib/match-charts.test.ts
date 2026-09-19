import { describe, it, expect } from "vitest";
import {
  boundaryPct,
  buildOverTable,
  phaseSplits,
} from "./match-charts";
import type { BallEvent } from "./match-types";

function ball(over: number, runs = 0, extra?: { type: string; runs: number }): BallEvent {
  return {
    id: `b-${over}-${Math.random()}`,
    match_id: "m1",
    innings_id: "inn1",
    over_number: over,
    ball_number: 1,
    batsman_id: "bat1",
    runs_scored: runs,
    extras: extra?.runs ?? 0,
    extra_type: extra?.type ?? null,
    is_wicket: false,
  };
}

describe("match-charts", () => {
  describe("buildOverTable", () => {
    it("sums runs + extras and tracks cumulative totals with wickets", () => {
      const table = buildOverTable([
        ball(0, 4),
        ball(0, 0, { type: "wide", runs: 1 }),
        { ...ball(1, 0), is_wicket: true },
      ]);
      expect(table).toHaveLength(2);
      expect(table[0]).toMatchObject({
        overNumber: 1,
        runs: 5,
        wickets: 0,
        cumulativeRuns: 5,
      });
      expect(table[1]).toMatchObject({
        overNumber: 2,
        runs: 0,
        wickets: 1,
        cumulativeRuns: 5,
        cumulativeWickets: 1,
      });
    });
  });

  describe("phaseSplits", () => {
    it("partitions a full T20 without overlaps (6 / 7-15 / 16-20)", () => {
      const balls = Array.from({ length: 20 }, (_, ov) => ball(ov, 1));
      const [pp, mid, death] = phaseSplits(balls, 20);
      expect(pp?.overs).toBe("1–6");
      expect(mid?.overs).toBe("7–15");
      expect(death?.overs).toBe("16–20");
      const total = (pp?.runs ?? 0) + (mid?.runs ?? 0) + (death?.runs ?? 0);
      expect(total).toBe(20);
    });

    it("never double-counts overs in short matches", () => {
      const balls = Array.from({ length: 5 }, (_, ov) => ball(ov, 2));
      const splits = phaseSplits(balls, 5);
      const total = splits.reduce((s, p) => s + p.runs, 0);
      // 5 overs x 2 runs = 10; overlap would exceed it
      expect(total).toBe(10);
    });

    it("labels an empty middle phase as — in tiny matches", () => {
      const balls = Array.from({ length: 2 }, (_, ov) => ball(ov, 1));
      const splits = phaseSplits(balls, 2);
      expect(splits.find((p) => p.label === "Middle")?.overs).toBe("—");
      const total = splits.reduce((s, p) => s + p.runs, 0);
      expect(total).toBe(2);
    });
  });

  describe("boundaryPct", () => {
    it("returns 0 when nothing has been scored", () => {
      expect(boundaryPct(0, 0, 0)).toBe(0);
    });

    it("computes boundary-run share", () => {
      expect(boundaryPct(2, 1, 20)).toBeCloseTo(70);
    });
  });
});
