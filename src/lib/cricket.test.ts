import { describe, expect, it } from "vitest";
import {
  oversFromBalls,
  ballsFromOvers,
  bowlerBalls,
  hasBowled,
  strikeRate,
  economyRate,
  deliveryLabel,
  dismissalText,
  scoreLine,
  teamName,
  formatDecimalOvers,
  topBatters,
  topBowlers,
  inningsForTeam,
  bowlingInningsForTeam,
} from "./cricket";
import type { BowlingPerformance, FallOfWicket, Innings } from "./match-types";
import { makeMatch } from "~/test/factories";

describe("cricket math & formatting utilities", () => {
  describe("oversFromBalls", () => {
    it("formats 0 balls", () => {
      expect(oversFromBalls(0)).toBe("0.0");
    });

    it("formats balls within the first over", () => {
      expect(oversFromBalls(1)).toBe("0.1");
      expect(oversFromBalls(5)).toBe("0.5");
    });

    it("formats full overs", () => {
      expect(oversFromBalls(6)).toBe("1.0");
      expect(oversFromBalls(12)).toBe("2.0");
      expect(oversFromBalls(120)).toBe("20.0");
    });

    it("formats partial overs", () => {
      expect(oversFromBalls(8)).toBe("1.2");
      expect(oversFromBalls(23)).toBe("3.5");
    });
  });

  describe("ballsFromOvers", () => {
    it("converts 0 overs to 0 balls", () => {
      expect(ballsFromOvers(0)).toBe(0);
    });

    it("converts decimal overs notation back to ball counts", () => {
      expect(ballsFromOvers(1.0)).toBe(6);
      expect(ballsFromOvers(1.2)).toBe(8);
      expect(ballsFromOvers(3.5)).toBe(23);
      expect(ballsFromOvers(20.0)).toBe(120);
    });
  });

  describe("bowlerBalls & hasBowled", () => {
    it("prioritizes balls_bowled when present", () => {
      expect(bowlerBalls({ balls_bowled: 15, overs_bowled: 2.3 })).toBe(15);
    });

    it("falls back to overs_bowled when balls_bowled is 0", () => {
      expect(bowlerBalls({ balls_bowled: 0, overs_bowled: 2.3 })).toBe(15);
    });

    it("identifies whether a player has bowled", () => {
      expect(hasBowled({ balls_bowled: 1, overs_bowled: 0 })).toBe(true);
      expect(hasBowled({ balls_bowled: 0, overs_bowled: 0.1 })).toBe(true);
      expect(hasBowled({ balls_bowled: 0, overs_bowled: 0 })).toBe(false);
    });
  });

  describe("strikeRate", () => {
    it("calculates strike rate accurately", () => {
      expect(strikeRate(50, 25)).toBe("200.0");
      expect(strikeRate(33, 20)).toBe("165.0");
      expect(strikeRate(1, 3)).toBe("33.3");
    });

    it("handles 0 balls or empty inputs gracefully", () => {
      expect(strikeRate(0, 0)).toBe("—");
      expect(strikeRate(null, null)).toBe("—");
      expect(strikeRate(10, undefined)).toBe("—");
    });
  });

  describe("economyRate", () => {
    it("calculates economy rate per 6 legal deliveries", () => {
      expect(economyRate(24, 24)).toBe("6.00");
      expect(economyRate(30, 20)).toBe("9.00");
    });

    it("handles 0 balls or empty inputs gracefully", () => {
      expect(economyRate(0, 0)).toBe("—");
      expect(economyRate(null, null)).toBe("—");
    });
  });

  describe("deliveryLabel", () => {
    it("returns W for wickets", () => {
      expect(
        deliveryLabel({
          is_wicket: true,
          runs_scored: 0,
          extras: 0,
          extra_type: null,
        }),
      ).toBe("W");
    });

    it("formats wide deliveries with or without extra runs", () => {
      expect(
        deliveryLabel({
          is_wicket: false,
          runs_scored: 0,
          extras: 1,
          extra_type: "wide",
        }),
      ).toBe("wd");
      expect(
        deliveryLabel({
          is_wicket: false,
          runs_scored: 0,
          extras: 2,
          extra_type: "wide",
        }),
      ).toBe("wd+1");
    });

    it("formats no-balls with or without extra runs", () => {
      expect(
        deliveryLabel({
          is_wicket: false,
          runs_scored: 0,
          extras: 1,
          extra_type: "no_ball",
        }),
      ).toBe("nb");
      expect(
        deliveryLabel({
          is_wicket: false,
          runs_scored: 0,
          extras: 3,
          extra_type: "no_ball",
        }),
      ).toBe("nb+2");
    });

    it("formats byes, leg-byes, and penalties", () => {
      expect(
        deliveryLabel({
          is_wicket: false,
          runs_scored: 0,
          extras: 4,
          extra_type: "bye",
        }),
      ).toBe("b4");
      expect(
        deliveryLabel({
          is_wicket: false,
          runs_scored: 0,
          extras: 1,
          extra_type: "leg_bye",
        }),
      ).toBe("lb1");
      expect(
        deliveryLabel({
          is_wicket: false,
          runs_scored: 0,
          extras: 5,
          extra_type: "penalty",
        }),
      ).toBe("p5");
    });

    it("formats normal off-the-bat deliveries", () => {
      expect(
        deliveryLabel({
          is_wicket: false,
          runs_scored: 0,
          extras: 0,
          extra_type: null,
        }),
      ).toBe("0");
      expect(
        deliveryLabel({
          is_wicket: false,
          runs_scored: 1,
          extras: 0,
          extra_type: null,
        }),
      ).toBe("1");
      expect(
        deliveryLabel({
          is_wicket: false,
          runs_scored: 4,
          extras: 0,
          extra_type: null,
        }),
      ).toBe("4");
      expect(
        deliveryLabel({
          is_wicket: false,
          runs_scored: 6,
          extras: 0,
          extra_type: null,
        }),
      ).toBe("6");
    });
  });

  describe("dismissalText", () => {
    const fow: FallOfWicket[] = [
      {
        id: "f1",
        match_id: "m1",
        innings_id: "inn1",
        wicket_number: 1,
        batsman_out_id: "u1",
        bowler_id: "b1",
        fielder_id: "f1",
        runs_at_fall: 35,
        overs_at_fall: 4.2,
        bowler: { id: "b1", full_name: "Patel" },
        fielder: { id: "f1", full_name: "Sharma" },
      },
      {
        id: "f2",
        match_id: "m1",
        innings_id: "inn1",
        wicket_number: 2,
        batsman_out_id: "u2",
        bowler_id: "b1",
        runs_at_fall: 50,
        overs_at_fall: 6.0,
        bowler: { id: "b1", full_name: "Patel" },
      },
    ];

    it("returns 'not out' when batter is not out", () => {
      expect(
        dismissalText(
          { user_id: "u3", is_out: false, dismissal_type: null },
          fow,
        ),
      ).toBe("not out");
    });

    it("formats caught dismissals with fielder and bowler", () => {
      expect(
        dismissalText(
          { user_id: "u1", is_out: true, dismissal_type: "caught" },
          fow,
        ),
      ).toBe("c Sharma b Patel");
    });

    it("formats bowled dismissals with bowler", () => {
      expect(
        dismissalText(
          { user_id: "u2", is_out: true, dismissal_type: "bowled" },
          fow,
        ),
      ).toBe("b Patel");
    });

    it("formats lbw dismissals with bowler", () => {
      expect(
        dismissalText(
          { user_id: "u2", is_out: true, dismissal_type: "lbw" },
          fow,
        ),
      ).toBe("lbw b Patel");
    });

    it("formats run out dismissals with fielder", () => {
      expect(
        dismissalText(
          { user_id: "u1", is_out: true, dismissal_type: "run_out" },
          fow,
        ),
      ).toBe("run out (Sharma)");
    });
  });

  describe("scoreLine, teamName, formatDecimalOvers", () => {
    it("formats scoreLine correctly", () => {
      expect(scoreLine(undefined)).toBe("Yet to bat");
      const inn: Innings = {
        id: "inn1",
        match_id: "m1",
        team_id: "t1",
        innings_number: 1,
        total_runs: 165,
        total_wickets: 4,
        total_balls: 120,
        total_overs: 20,
        is_completed: true,
        extras_total: 5,
        extras_byes: 0,
        extras_leg_byes: 0,
        extras_wides: 4,
        extras_no_balls: 1,
        extras_penalties: 0,
      };
      expect(scoreLine(inn)).toBe("165/4 (20.0)");
    });

    it("resolves teamName from match", () => {
      const match = makeMatch();
      expect(teamName(match, "t1")).toBe("Royal Tigers");
      expect(teamName(match, "t2")).toBe("Coastal Kings");
    });

    it("formats decimal overs properly", () => {
      expect(formatDecimalOvers(10.2)).toBe("10.2");
      expect(formatDecimalOvers(4)).toBe("4.0");
    });
  });

  describe("topBatters & topBowlers", () => {
    it("returns top batters sorted by runs scored", () => {
      const innings: Innings = {
        id: "inn1",
        match_id: "m1",
        team_id: "t1",
        innings_number: 1,
        total_runs: 99,
        total_wickets: 1,
        total_balls: 60,
        total_overs: 10,
        is_completed: false,
        extras_total: 0,
        extras_byes: 0,
        extras_leg_byes: 0,
        extras_wides: 0,
        extras_no_balls: 0,
        extras_penalties: 0,
        batting_performances: [
          {
            id: "b1",
            match_id: "m1",
            innings_id: "inn1",
            user_id: "u1",
            runs_scored: 24,
            balls_faced: 18,
            fours: 2,
            sixes: 1,
            is_out: true,
          },
          {
            id: "b2",
            match_id: "m1",
            innings_id: "inn1",
            user_id: "u2",
            runs_scored: 75,
            balls_faced: 42,
            fours: 8,
            sixes: 3,
            is_out: false,
          },
          {
            id: "b3",
            match_id: "m1",
            innings_id: "inn1",
            user_id: "u3",
            runs_scored: 0,
            balls_faced: 0,
            fours: 0,
            sixes: 0,
            is_out: false,
          },
        ],
      };

      const top = topBatters(innings, 2);
      expect(top).toHaveLength(2);
      expect(top[0]?.runs_scored).toBe(75);
      expect(top[1]?.runs_scored).toBe(24);
    });

    it("returns top bowlers sorted by wickets desc then runs asc", () => {
      const bowlingPerf1: BowlingPerformance = {
        id: "bw1",
        match_id: "m1",
        innings_id: "inn2",
        user_id: "ub1",
        overs_bowled: 4,
        balls_bowled: 24,
        runs_conceded: 28,
        wickets_taken: 2,
        maidens: 0,
        wides: 1,
        no_balls: 0,
      };

      const bowlingPerf2: BowlingPerformance = {
        id: "bw2",
        match_id: "m1",
        innings_id: "inn2",
        user_id: "ub2",
        overs_bowled: 4,
        balls_bowled: 24,
        runs_conceded: 20,
        wickets_taken: 2,
        maidens: 1,
        wides: 0,
        no_balls: 0,
      };

      const bowlingPerf3: BowlingPerformance = {
        id: "bw3",
        match_id: "m1",
        innings_id: "inn2",
        user_id: "ub3",
        overs_bowled: 4,
        balls_bowled: 24,
        runs_conceded: 18,
        wickets_taken: 3,
        maidens: 0,
        wides: 0,
        no_balls: 0,
      };

      const match = makeMatch({
        innings: [
          {
            id: "inn2",
            match_id: "m1",
            team_id: "t2",
            innings_number: 2,
            total_runs: 66,
            total_wickets: 7,
            total_balls: 72,
            total_overs: 12,
            is_completed: false,
            extras_total: 1,
            extras_byes: 0,
            extras_leg_byes: 0,
            extras_wides: 1,
            extras_no_balls: 0,
            extras_penalties: 0,
            bowling_performances: [bowlingPerf1, bowlingPerf2, bowlingPerf3],
          },
        ],
      });

      // Bowling against team1 means looking at team2's innings bowlers
      const top = topBowlers(match, "t1", 3);
      expect(top).toHaveLength(3);
      expect(top[0]?.wickets_taken).toBe(3); // ub3 (3 wickets)
      expect(top[1]?.user_id).toBe("ub2"); // ub2 (2 wickets, 20 runs conceded)
      expect(top[2]?.user_id).toBe("ub1"); // ub1 (2 wickets, 28 runs conceded)
    });

    it("retrieves inningsForTeam and bowlingInningsForTeam", () => {
      const inn1 = {
        id: "i1",
        match_id: "m1",
        team_id: "t1",
        innings_number: 1,
        total_runs: 0,
        total_wickets: 0,
        total_balls: 0,
        total_overs: 0,
        is_completed: false,
        extras_total: 0,
        extras_byes: 0,
        extras_leg_byes: 0,
        extras_wides: 0,
        extras_no_balls: 0,
        extras_penalties: 0,
      } as Innings;

      const inn2 = {
        id: "i2",
        match_id: "m1",
        team_id: "t2",
        innings_number: 2,
        total_runs: 0,
        total_wickets: 0,
        total_balls: 0,
        total_overs: 0,
        is_completed: false,
        extras_total: 0,
        extras_byes: 0,
        extras_leg_byes: 0,
        extras_wides: 0,
        extras_no_balls: 0,
        extras_penalties: 0,
      } as Innings;

      const match = makeMatch({ innings: [inn1, inn2] });

      expect(inningsForTeam(match, "t1")?.id).toBe("i1");
      expect(bowlingInningsForTeam(match, "t1")?.id).toBe("i2");
    });
  });
});
