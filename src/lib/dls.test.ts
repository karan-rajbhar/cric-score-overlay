import { describe, it, expect } from "vitest";
import {
  getDlsResourcePercentage,
  calculateDlsTarget,
  calculateDlsParScore,
} from "./dls";

describe("Duckworth-Lewis-Stern (DLS) Standard Method", () => {
  describe("getDlsResourcePercentage", () => {
    it("returns 100% at 50 overs with 0 wickets lost", () => {
      const res = getDlsResourcePercentage(50, 0);
      expect(res).toBeCloseTo(100.0, 0);
    });

    it("returns 0% when 0 overs remain", () => {
      expect(getDlsResourcePercentage(0, 0)).toBe(0);
      expect(getDlsResourcePercentage(-5, 0)).toBe(0);
    });

    it("returns 0% when all 10 wickets are lost", () => {
      expect(getDlsResourcePercentage(20, 10)).toBe(0);
    });

    it("monotonically decreases as wickets fall with same overs remaining", () => {
      const w0 = getDlsResourcePercentage(20, 0);
      const w1 = getDlsResourcePercentage(20, 1);
      const w3 = getDlsResourcePercentage(20, 3);
      const w6 = getDlsResourcePercentage(20, 6);
      const w9 = getDlsResourcePercentage(20, 9);

      expect(w0).toBeGreaterThan(w1);
      expect(w1).toBeGreaterThan(w3);
      expect(w3).toBeGreaterThan(w6);
      expect(w6).toBeGreaterThan(w9);
      expect(w9).toBeGreaterThan(0);
    });

    it("monotonically decreases as overs reduce with same wickets", () => {
      const o20 = getDlsResourcePercentage(20, 2);
      const o15 = getDlsResourcePercentage(15, 2);
      const o10 = getDlsResourcePercentage(10, 2);
      const o5 = getDlsResourcePercentage(5, 2);

      expect(o20).toBeGreaterThan(o15);
      expect(o15).toBeGreaterThan(o10);
      expect(o10).toBeGreaterThan(o5);
    });
  });

  describe("calculateDlsTarget", () => {
    it("returns Team1 runs + 1 when overs are equal and uninterrupted", () => {
      const res = calculateDlsTarget({
        team1Runs: 160,
        team1OversScheduled: 20,
        team2OversScheduled: 20,
        team2OversAvailable: 20,
      });
      expect(res.targetRuns).toBe(161);
      expect(res.team1Resource).toBe(res.team2Resource);
    });

    it("proportionately reduces target when Team 2 overs are reduced before innings", () => {
      // 20-over match, Team 1 scored 180. Team 2 gets only 12 overs due to rain delay.
      const res = calculateDlsTarget({
        team1Runs: 180,
        team1OversScheduled: 20,
        team2OversScheduled: 20,
        team2OversAvailable: 12,
      });

      expect(res.targetRuns).toBeLessThan(180);
      expect(res.targetRuns).toBeGreaterThan(100);
      expect(res.team2Resource).toBeLessThan(res.team1Resource);
      expect(res.methodDescription).toContain("DLS method");
    });

    it("handles mid-innings rain interruption with wickets down", () => {
      // Team 2 was chasing 20 overs, rain stopped play at 10 overs with 2 wickets down
      // Overs reduced to 15 overs total (so 5 overs left on restart)
      const res = calculateDlsTarget({
        team1Runs: 175,
        team1OversScheduled: 20,
        team2OversScheduled: 20,
        team2OversAvailable: 15,
        interruptionOversRemaining: 10,
        interruptionWicketsLost: 2,
        interruptionRunsScored: 80,
      });

      expect(res.targetRuns).toBeLessThan(175);
      expect(res.team2Resource).toBeLessThan(res.team1Resource);
    });
  });

  describe("calculateDlsParScore", () => {
    it("returns 0 at the start of chase with 0 balls bowled", () => {
      const par = calculateDlsParScore(200, 20, 20, 20, 0);
      expect(par).toBe(0);
    });

    it("increases as overs are bowled", () => {
      const par15 = calculateDlsParScore(180, 20, 20, 15, 0); // 5 overs bowled
      const par10 = calculateDlsParScore(180, 20, 20, 10, 0); // 10 overs bowled
      const par5 = calculateDlsParScore(180, 20, 20, 5, 0); // 15 overs bowled

      expect(par10).toBeGreaterThan(par15);
      expect(par5).toBeGreaterThan(par10);
    });

    it("requires higher par score when wickets fall", () => {
      // At 10 overs left, par score with 1 wicket vs 4 wickets down
      const par1Wkt = calculateDlsParScore(180, 20, 20, 10, 1);
      const par4Wkt = calculateDlsParScore(180, 20, 20, 10, 4);

      expect(par4Wkt).toBeGreaterThan(par1Wkt);
    });
  });
});
