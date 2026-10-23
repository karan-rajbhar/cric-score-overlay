import { describe, expect, it } from "vitest";
import {
  normalCdf,
  PROJECTION_MIN_BALLS,
  winPredictor,
  winPredictorFromLive,
  type ChaseEstimate,
  type WinPredictorInput,
} from "./win-predictor";

const t20Chase = (over: Partial<WinPredictorInput> = {}): WinPredictorInput => ({
  inningsNumber: 2,
  oversPerInnings: 20,
  runs: 100,
  wickets: 3,
  balls: 90,
  target: 161,
  ...over,
});

const pct = (input: WinPredictorInput) =>
  (winPredictor(input) as ChaseEstimate).battingPct;

describe("normalCdf", () => {
  it("matches known values", () => {
    expect(normalCdf(0)).toBeCloseTo(0.5, 6);
    expect(normalCdf(1.96)).toBeCloseTo(0.975, 3);
    expect(normalCdf(-1.28)).toBeCloseTo(0.1003, 3);
  });
});

describe("winPredictor: chase", () => {
  it("is 100% once nothing is needed", () => {
    expect(winPredictor(t20Chase({ runs: 161 }))).toMatchObject({
      kind: "chase",
      battingPct: 100,
      bowlingPct: 0,
      runsNeeded: 0,
    });
  });

  it("is 0% all out short, or out of balls short", () => {
    expect(pct(t20Chase({ wickets: 10 }))).toBe(0);
    expect(pct(t20Chase({ balls: 120 }))).toBe(0);
    expect(pct(t20Chase({ wickets: 6, wicketsPerInnings: 6 }))).toBe(0);
  });

  it("keeps a live chase between 1 and 99", () => {
    expect(pct(t20Chase({ runs: 0, wickets: 9, balls: 119 }))).toBe(1);
    expect(pct(t20Chase({ runs: 160, wickets: 0, balls: 0 }))).toBe(99);
  });

  it("starts close to even at par", () => {
    const start = pct(t20Chase({ runs: 0, wickets: 0, balls: 0 }));
    expect(start).toBeGreaterThanOrEqual(45);
    expect(start).toBeLessThanOrEqual(55);
  });

  it("falls as the runs needed rise", () => {
    let prev = 101;
    for (let runs = 160; runs >= 0; runs -= 5) {
      const p = pct(t20Chase({ runs }));
      expect(p).toBeLessThanOrEqual(prev);
      prev = p;
    }
  });

  it("rises with balls left", () => {
    let prev = -1;
    for (let balls = 119; balls >= 0; balls -= 7) {
      const p = pct(t20Chase({ balls }));
      expect(p).toBeGreaterThanOrEqual(prev);
      prev = p;
    }
  });

  it("rises with wickets in hand", () => {
    let prev = -1;
    for (let wickets = 9; wickets >= 0; wickets -= 1) {
      const p = pct(t20Chase({ wickets }));
      expect(p).toBeGreaterThanOrEqual(prev);
      prev = p;
    }
  });

  it("reads the format: the same position is easier with more overs left", () => {
    // 60 needed with 5 wickets down after 10 overs: T20 vs 50 overs.
    const t20 = pct(t20Chase({ runs: 100, target: 161, balls: 60, wickets: 5 }));
    const odi = pct(
      t20Chase({ oversPerInnings: 50, runs: 100, target: 161, balls: 60, wickets: 5 }),
    );
    expect(odi).toBeGreaterThan(t20);
  });

  it("needs a target", () => {
    expect(winPredictor(t20Chase({ target: null }))).toBeNull();
  });
});

describe("winPredictor: first innings", () => {
  const first = (over: Partial<WinPredictorInput> = {}) =>
    winPredictor({
      inningsNumber: 1,
      oversPerInnings: 20,
      runs: 80,
      wickets: 2,
      balls: 60,
      ...over,
    });

  it("projects a range, not a probability", () => {
    const p = first();
    expect(p?.kind).toBe("projection");
    if (p?.kind !== "projection") return;
    expect(p.low).toBeLessThan(p.mid);
    expect(p.mid).toBeLessThan(p.high);
    expect(p.low).toBeGreaterThanOrEqual(80);
    expect(p.label).toBe("Estimate");
  });

  it("projects less with more wickets down", () => {
    const a = first({ wickets: 1 });
    const b = first({ wickets: 6 });
    if (a?.kind !== "projection" || b?.kind !== "projection") throw new Error();
    expect(b.mid).toBeLessThan(a.mid);
  });

  it("waits for two overs", () => {
    expect(first({ balls: PROJECTION_MIN_BALLS - 1 })).toBeNull();
  });
});

describe("excluded innings", () => {
  it("has no estimate for super overs", () => {
    expect(winPredictor(t20Chase({ inningsNumber: 3 }))).toBeNull();
    expect(winPredictor(t20Chase({ inningsNumber: 4 }))).toBeNull();
  });

  it("winPredictorFromLive only reads an innings in play", () => {
    const row = {
      status: "live",
      innings_number: 2,
      innings_completed: false,
      overs_per_innings: 20,
      total_runs: 100,
      total_wickets: 3,
      total_balls: 90,
      target_runs: 161,
    };
    expect(winPredictorFromLive(row)?.kind).toBe("chase");
    expect(winPredictorFromLive({ ...row, status: "completed" })).toBeNull();
    expect(winPredictorFromLive({ ...row, innings_completed: true })).toBeNull();
    expect(winPredictorFromLive({ ...row, innings_number: 3 })).toBeNull();
  });
});
