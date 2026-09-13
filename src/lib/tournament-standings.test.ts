import { describe, it, expect } from "vitest";
import {
  calculateEffectiveOvers,
  calculateNetRunRate,
  calculatePoints,
  sortStandings,
  evaluateQualification,
} from "./tournament-standings";
import { generateRoundRobinFixtures } from "./tournament-scheduler";

describe("tournament-standings", () => {
  describe("calculateEffectiveOvers", () => {
    it("returns full quota when team is all out (10 wickets)", () => {
      const overs = calculateEffectiveOvers(110, 10, 20);
      expect(overs).toBe(20);
    });

    it("respects custom wickets cap (e.g. 8 wickets)", () => {
      const overs = calculateEffectiveOvers(90, 8, 20, 8);
      expect(overs).toBe(20);

      // Not all out if 7 down with cap 8
      const oversInHand = calculateEffectiveOvers(90, 7, 20, 8);
      expect(oversInHand).toBe(15);
    });

    it("calculates exact decimal overs when innings finishes with wickets in hand", () => {
      expect(calculateEffectiveOvers(120, 4, 20)).toBe(20);
      expect(calculateEffectiveOvers(117, 7, 20)).toBe(19.5);
      expect(calculateEffectiveOvers(0, 0, 20)).toBe(0);
    });
  });

  describe("calculateNetRunRate", () => {
    it("calculates positive NRR for victorious team", () => {
      const nrrA = calculateNetRunRate(165, 20.0, 142, 20.0);
      expect(nrrA).toBe(1.15);

      const nrrB = calculateNetRunRate(142, 20.0, 165, 20.0);
      expect(nrrB).toBe(-1.15);
    });

    it("returns 0.0 when overs faced or bowled is zero", () => {
      expect(calculateNetRunRate(0, 0, 0, 0)).toBe(0.0);
      expect(calculateNetRunRate(50, 0, 50, 20)).toBe(0.0);
    });

    it("correctly applies bowled-out rule in NRR", () => {
      const nrr = calculateNetRunRate(180, 20.0, 100, 20.0);
      expect(nrr).toBe(4.0);
    });
  });

  describe("calculatePoints", () => {
    it("awards 2 for win, 1 for tie/NR, 0 for loss", () => {
      expect(calculatePoints(3, 1, 0)).toBe(7);
      expect(calculatePoints(0, 0, 2)).toBe(2);
    });

    it("supports points adjustments (penalties, bonuses, decimals)", () => {
      // -1 penalty for slow over rate
      expect(calculatePoints(2, 0, 0, -1)).toBe(3);

      // +0.5 bonus point
      expect(calculatePoints(1, 1, 0, 0.5)).toBe(3.5);
    });
  });

  describe("sortStandings", () => {
    it("sorts by points descending, then NRR descending", () => {
      const list = [
        { teamId: "1", teamName: "Alpha", points: 4, netRunRate: 0.5 },
        { teamId: "2", teamName: "Beta", points: 6, netRunRate: -0.2 },
        { teamId: "3", teamName: "Gamma", points: 4, netRunRate: 1.2 },
      ];

      const sorted = sortStandings(list);
      expect(sorted[0]?.teamName).toBe("Beta"); // 6 pts
      expect(sorted[1]?.teamName).toBe("Gamma"); // 4 pts, +1.2 NRR
      expect(sorted[2]?.teamName).toBe("Alpha"); // 4 pts, +0.5 NRR
    });
  });

  describe("evaluateQualification", () => {
    it("correctly identifies qualified and eliminated teams", () => {
      const teams = [
        { teamId: "team-1", points: 8, remainingMatches: 0 },
        { teamId: "team-2", points: 6, remainingMatches: 1 },
        { teamId: "team-3", points: 4, remainingMatches: 1 },
        { teamId: "team-4", points: 0, remainingMatches: 1 }, // Max 2 pts, cannot reach cutoff 6
      ];

      const status = evaluateQualification(teams, 2);
      expect(status.get("team-1")).toBe("qualified");
      expect(status.get("team-4")).toBe("eliminated");
      expect(status.get("team-2")).toBe("in_contention");
      expect(status.get("team-3")).toBe("in_contention");
    });
  });

  describe("generateRoundRobinFixtures", () => {
    it("generates correct number of fixtures for 4 teams (N*(N-1)/2 = 6)", () => {
      const fixtures = generateRoundRobinFixtures(["A", "B", "C", "D"]);
      expect(fixtures.length).toBe(6);

      // Verify each pair meets exactly once
      const pairs = new Set<string>();
      fixtures.forEach((f) => {
        const key = [f.homeTeamId, f.awayTeamId].sort().join("-");
        pairs.add(key);
      });
      expect(pairs.size).toBe(6);
    });

    it("handles odd number of teams with byes", () => {
      // 5 teams -> 5*(4)/2 = 10 fixtures
      const fixtures = generateRoundRobinFixtures(["A", "B", "C", "D", "E"]);
      expect(fixtures.length).toBe(10);
    });
  });
});
