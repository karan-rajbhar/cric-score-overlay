import { describe, it, expect } from "vitest";
import {
  getDlsResourcePercentage,
  calculateDlsTarget,
  calculateDlsParScore,
} from "./dls";

/** Decimal overs from scorebook notation: 7.4 is 7 overs 4 balls. */
const ov = (overs: number, balls = 0) => overs + balls / 6;

describe("DLS Standard Edition", () => {
  describe("getDlsResourcePercentage", () => {
    // [overs left, wickets lost, resources %] from the ICC's Standard Edition
    // table (TABS2002), every one also in the ECB's copy.
    const tablePoints: [number, number, number][] = [
      [50, 0, 100.0],
      [50, 9, 4.7],
      [45, 0, 95.0],
      [40, 0, 89.3],
      [40, 4, 59.5],
      [38, 1, 82.0],
      [35, 0, 82.7],
      [33, 0, 79.8],
      [30, 3, 61.6],
      [28, 1, 68.8],
      [25, 7, 21.6],
      [20, 0, 56.6],
      [20, 3, 49.1],
      [20, 5, 38.6],
      [18, 3, 45.9],
      [16, 3, 42.3],
      [15, 2, 42.6],
      [12, 2, 35.8],
      [10, 5, 26.1],
      [10, 8, 11.4],
      [8, 2, 25.5],
      [7, 2, 22.7],
      [5, 0, 17.2],
      [5, 5, 15.4],
      [5, 6, 14.3],
      [3, 2, 10.4],
      [2, 9, 3.7],
      [1, 0, 3.6],
    ];
    it.each(tablePoints)(
      "%i overs left, %i down: %f%%",
      (overs, wickets, expected) => {
        expect(getDlsResourcePercentage(overs, wickets)).toBe(expected);
      },
    );

    // [overs, balls, wickets lost, value on the ICC's ball-by-ball sheets]
    const ballPoints: [number, number, number, number][] = [
      [49, 5, 0, 99.8],
      [38, 2, 2, 76.3],
      [25, 3, 4, 50.5],
      [17, 1, 5, 35.9],
      [12, 4, 3, 35.8],
      [7, 4, 6, 19.4],
      [4, 2, 7, 11.3],
      [2, 5, 8, 6.9],
      [0, 1, 0, 0.6],
    ];
    it.each(ballPoints)(
      "interpolates %i.%i overs left, %i down to within 0.1 of %f%%",
      (overs, balls, wickets, expected) => {
        expect(
          Math.abs(
            getDlsResourcePercentage(ov(overs, balls), wickets) - expected,
          ),
        ).toBeLessThanOrEqual(0.1 + 1e-9);
      },
    );

    it("stays within 0.3 of the sheets with under an over left and 9 down", () => {
      expect(
        Math.abs(getDlsResourcePercentage(ov(0, 3), 9) - 1.5),
      ).toBeLessThanOrEqual(0.3 + 1e-9);
    });

    it("never rises as balls are used or wickets fall", () => {
      for (let w = 0; w < 10; w++) {
        for (let balls = 1; balls <= 300; balls++) {
          const now = getDlsResourcePercentage(balls / 6, w);
          expect(now).toBeGreaterThanOrEqual(
            getDlsResourcePercentage((balls - 1) / 6, w),
          );
          expect(now).toBeGreaterThanOrEqual(
            getDlsResourcePercentage(balls / 6, w + 1),
          );
        }
      }
    });

    it("gives 0 with no overs left or 10 wickets down", () => {
      for (let w = 0; w <= 10; w++) {
        expect(getDlsResourcePercentage(0, w)).toBe(0);
      }
      expect(getDlsResourcePercentage(-5, 0)).toBe(0);
      expect(getDlsResourcePercentage(20, 10)).toBe(0);
      expect(getDlsResourcePercentage(50, 10)).toBe(0);
      expect(getDlsResourcePercentage(Number.NaN, 0)).toBe(0);
    });

    it("counts overs beyond 50 as a full innings", () => {
      expect(getDlsResourcePercentage(60, 0)).toBe(100);
    });
  });

  // The worked examples in the ICC's Standard Edition rules (playing
  // conditions, images.icc-cricket.com/image/upload/prd/orlbya4cqyhqaceje3b2.pdf).
  describe("ICC worked examples", () => {
    it("1: a stoppage in Team 1's innings raises the target by G50", () => {
      // 79/3 after 20 of 50 overs; 10 overs a side lost; 180 in 40 overs.
      const input = {
        team1Runs: 180,
        team1OversScheduled: 50,
        team1OversBatted: 40,
        team1InterruptionOversRemaining: 30,
        team1InterruptionWicketsLost: 3,
        team2OversScheduled: 40,
        team2OversAvailable: 40,
      };
      const res = calculateDlsTarget({ ...input, g50: 245 });
      expect(res.team1Resource).toBe(87.5);
      expect(res.team2Resource).toBe(89.3);
      expect(res.resourceDifference).toBe(1.8);
      expect(res.targetRuns).toBe(185);
      // The app's default G50 is the ICC's figure for lower levels, 200.
      expect(calculateDlsTarget(input).targetRuns).toBe(184);
    });

    it("2: a delay before Team 2's innings scales the target down", () => {
      // 45-over match, Team 1 212; Team 2 cut to 35 overs.
      const res = calculateDlsTarget({
        team1Runs: 212,
        team1OversScheduled: 45,
        team2OversScheduled: 35,
        team2OversAvailable: 35,
      });
      expect(res.team1Resource).toBe(95.0);
      expect(res.team2Resource).toBe(82.7);
      expect(res.targetRuns).toBe(185);
    });

    it("3: a stoppage in Team 2's innings", () => {
      // 250 in 50 overs; Team 2 40/1 after 12 overs, 10 overs lost.
      const res = calculateDlsTarget({
        team1Runs: 250,
        team1OversScheduled: 50,
        team2OversScheduled: 50,
        team2OversAvailable: 40,
        interruptionOversRemaining: 38,
        interruptionWicketsLost: 1,
      });
      expect(res.team2Resource).toBe(86.8);
      // 250 x 86.8 / 100 is exactly 217: no floating-point slip to 216.
      expect(res.targetRuns).toBe(218);
    });

    it("4: reads the resources the second stoppage and the abandonment use", () => {
      expect(getDlsResourcePercentage(18, 3)).toBe(45.9);
      expect(getDlsResourcePercentage(16, 3)).toBe(42.3);
      // 7.4 overs left, 6 down: 19.4 on the ball-by-ball sheet.
      const left = getDlsResourcePercentage(ov(7, 4), 6);
      expect(Math.abs(left - 19.4)).toBeLessThanOrEqual(0.1);
      // R2 = 86.8 - 3.6 - 19.4 (19.3 here): par 159 either way.
      expect(Math.floor((250 * (86.8 - 3.6 - left)) / 100)).toBe(159);
    });

    const team1CutShort = {
      // India 226/8 when rain ended their innings after 47.1 of 50 overs.
      team1Runs: 226,
      team1OversScheduled: 50,
      team1OversBatted: ov(47, 1),
      team1InterruptionOversRemaining: ov(2, 5),
      team1InterruptionWicketsLost: 8,
      team2OversScheduled: 33,
    };

    it("5: Team 1's innings ended by rain, Team 2 given 33 overs", () => {
      const res = calculateDlsTarget({
        ...team1CutShort,
        team2OversAvailable: 33,
      });
      expect(res.team1Resource).toBe(93.1);
      expect(res.team2Resource).toBe(79.8);
      expect(res.targetRuns).toBe(194);
    });

    it("6: as 5, then 5 more overs lost at 140/2 after 25", () => {
      const res = calculateDlsTarget({
        ...team1CutShort,
        team2OversAvailable: 28,
        interruptionOversRemaining: 8,
        interruptionWicketsLost: 2,
      });
      expect(res.team2Resource).toBe(64.7);
      expect(res.targetRuns).toBe(158);
    });
  });

  describe("calculateDlsTarget", () => {
    it("is Team 1's score + 1 when nothing was lost", () => {
      const res = calculateDlsTarget({
        team1Runs: 160,
        team1OversScheduled: 20,
        team2OversScheduled: 20,
        team2OversAvailable: 20,
      });
      expect(res.targetRuns).toBe(161);
      expect(res.team1Resource).toBe(56.6);
      expect(res.team2Resource).toBe(56.6);
      expect(res.methodDescription).toBe(
        "Target is 161 runs in 20 overs (DLS method)",
      );
    });

    it("New South Wales v South Australia, 2003: 214 after a stoppage at 19 overs", () => {
      // 273 in 50 overs; chase stopped at 31 overs left, 2 down, resumed
      // with 17 left (Wikipedia's Standard Edition example).
      const res = calculateDlsTarget({
        team1Runs: 273,
        team1OversScheduled: 50,
        team2OversScheduled: 50,
        team2OversAvailable: 36,
        interruptionOversRemaining: 31,
        interruptionWicketsLost: 2,
      });
      expect(res.team2Resource).toBe(78.1);
      expect(res.targetRuns).toBe(214);
    });

    it("Lancashire v Hampshire, 2003: 221 in 28 overs after 231 in 30", () => {
      const res = calculateDlsTarget({
        team1Runs: 231,
        team1OversScheduled: 30,
        team2OversScheduled: 30,
        team2OversAvailable: 28,
      });
      expect(res.team1Resource).toBe(75.1);
      expect(res.team2Resource).toBe(71.8);
      expect(res.targetRuns).toBe(221);
      expect(res.methodDescription).toContain("DLS method");
    });

    describe("T20 (the same table from the 20-overs row)", () => {
      it("cuts the chase to 12 overs before it starts", () => {
        const res = calculateDlsTarget({
          team1Runs: 160,
          team1OversScheduled: 20,
          team2OversScheduled: 20,
          team2OversAvailable: 12,
          format: "T20",
        });
        expect(res.team1Resource).toBe(56.6);
        expect(res.team2Resource).toBe(37.6);
        expect(res.targetRuns).toBe(107);
      });

      it("counts the wickets down when rain stops the chase", () => {
        // 160 in 20 overs; rain at 8 overs (12 left), 2 down; 15 overs a side.
        const res = calculateDlsTarget({
          team1Runs: 160,
          team1OversScheduled: 20,
          team2OversScheduled: 20,
          team2OversAvailable: 15,
          interruptionOversRemaining: 12,
          interruptionWicketsLost: 2,
        });
        // 56.6 - (35.8 at 12 overs, 2 down - 22.7 at 7 overs, 2 down)
        expect(res.team2Resource).toBe(43.5);
        expect(res.targetRuns).toBe(123);
        // With 6 down the lost overs were worth less: a higher target.
        expect(
          calculateDlsTarget({
            team1Runs: 160,
            team1OversScheduled: 20,
            team2OversScheduled: 20,
            team2OversAvailable: 15,
            interruptionOversRemaining: 12,
            interruptionWicketsLost: 6,
          }).targetRuns,
        ).toBeGreaterThan(123);
      });

      it("raises the target with the 50-over G50, not a T20 average", () => {
        // Team 1 120/2 when rain ended their innings at 15 overs; 15 for Team 2.
        const res = calculateDlsTarget({
          team1Runs: 120,
          team1OversScheduled: 20,
          team1OversBatted: 15,
          team1InterruptionOversRemaining: 5,
          team1InterruptionWicketsLost: 2,
          team2OversScheduled: 15,
          team2OversAvailable: 15,
        });
        expect(res.team1Resource).toBe(39.8); // 56.6 - 16.8
        expect(res.team2Resource).toBe(45.2);
        // 120 + 5.4% of 200 (10.8, rounded down) + 1
        expect(res.targetRuns).toBe(131);
      });
    });
  });

  describe("calculateDlsParScore", () => {
    it("Sri Lanka v South Africa, 2003 World Cup: par 229 at 229/6, a tie", () => {
      // Sri Lanka 268/9 in 50 overs; rain ended the chase after 45 overs.
      expect(calculateDlsParScore(268, 50, 50, 5, 6)).toBe(229);
    });

    it("is 0 before a ball of the chase", () => {
      expect(calculateDlsParScore(200, 20, 20, 20, 0)).toBe(0);
    });

    it("grows as overs are bowled", () => {
      const par15 = calculateDlsParScore(180, 20, 20, 15, 0);
      const par10 = calculateDlsParScore(180, 20, 20, 10, 0);
      const par5 = calculateDlsParScore(180, 20, 20, 5, 0);
      expect(par10).toBeGreaterThan(par15);
      expect(par5).toBeGreaterThan(par10);
    });

    it("is higher with more wickets down", () => {
      const par1Wkt = calculateDlsParScore(180, 20, 20, 10, 1);
      const par4Wkt = calculateDlsParScore(180, 20, 20, 10, 4);
      expect(par4Wkt).toBeGreaterThan(par1Wkt);
      // 180 x (56.6 - 28.3) / 56.6 = 90
      expect(par4Wkt).toBe(90);
    });
  });
});
