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
  formatDismissalType,
  formatExtraType,
  formatStatus,
  formatTournamentFormat,
  formatPlayerRole,
  formatClubType,
  formatTeamType,
  scoreLine,
  teamName,
  formatDecimalOvers,
  formatBowlerOvers,
  bowlerEconomy,
  formatFowOvers,
  topBatters,
  topBowlers,
  inningsForTeam,
  bowlingInningsForTeam,
  runRate,
  inningsBalls,
  ballsRemaining,
  requiredRunRate,
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

    it("handles null, undefined, and non-integer inputs gracefully without float drift", () => {
      expect(oversFromBalls(null)).toBe("0.0");
      expect(oversFromBalls(undefined)).toBe("0.0");
      expect(oversFromBalls(8.4)).toBe("1.2");
      expect(oversFromBalls(8.4)).not.toContain("1.2.4");
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

  describe("formatDismissalType", () => {
    it("formats known dismissal types into human-friendly strings", () => {
      expect(formatDismissalType("run_out")).toBe("Run Out");
      expect(formatDismissalType("bowled")).toBe("Bowled");
      expect(formatDismissalType("caught")).toBe("Caught");
      expect(formatDismissalType("lbw")).toBe("LBW");
      expect(formatDismissalType("stumped")).toBe("Stumped");
      expect(formatDismissalType("hit_wicket")).toBe("Hit Wicket");
    });

    it("handles null, undefined, or custom values gracefully", () => {
      expect(formatDismissalType(null)).toBe("Out");
      expect(formatDismissalType(undefined)).toBe("Out");
      expect(formatDismissalType("custom_dismissal")).toBe("Custom Dismissal");
    });
  });

  describe("formatExtraType", () => {
    it("formats known extra types into human-friendly strings", () => {
      expect(formatExtraType("no_ball")).toBe("No Ball");
      expect(formatExtraType("leg_bye")).toBe("Leg Bye");
      expect(formatExtraType("wide")).toBe("Wide");
      expect(formatExtraType("bye")).toBe("Bye");
      expect(formatExtraType("penalty")).toBe("Penalty");
    });

    it("handles null or undefined gracefully", () => {
      expect(formatExtraType(null)).toBe("");
      expect(formatExtraType(undefined)).toBe("");
    });
  });

  describe("formatStatus", () => {
    it("formats known statuses into human-friendly strings", () => {
      expect(formatStatus("registration_open")).toBe("Registration Open");
      expect(formatStatus("innings_break")).toBe("Innings Break");
      expect(formatStatus("in_contention")).toBe("In Contention");
      expect(formatStatus("scheduled")).toBe("Scheduled");
      expect(formatStatus("live")).toBe("Live");
      expect(formatStatus("completed")).toBe("Completed");
      expect(formatStatus("abandoned")).toBe("Abandoned");
    });

    it("handles null or undefined gracefully", () => {
      expect(formatStatus(null)).toBe("");
      expect(formatStatus(undefined)).toBe("");
    });

    it("converts unknown snake_case statuses to Title Case", () => {
      expect(formatStatus("delayed_rain")).toBe("Delayed Rain");
    });
  });

  describe("formatTournamentFormat", () => {
    it("formats known tournament formats", () => {
      expect(formatTournamentFormat("round_robin")).toBe("Round Robin");
      expect(formatTournamentFormat("league")).toBe("League");
      expect(formatTournamentFormat("knockout")).toBe("Knockout");
      expect(formatTournamentFormat("mixed")).toBe("Mixed");
    });

    it("handles null or undefined gracefully", () => {
      expect(formatTournamentFormat(null)).toBe("League");
      expect(formatTournamentFormat(undefined)).toBe("League");
    });
  });

  describe("formatPlayerRole", () => {
    it("formats known player roles", () => {
      expect(formatPlayerRole("captain")).toBe("Captain");
      expect(formatPlayerRole("vice_captain")).toBe("Vice Captain");
      expect(formatPlayerRole("wicket_keeper")).toBe("Wicket-keeper");
      expect(formatPlayerRole("all_rounder")).toBe("All-rounder");
      expect(formatPlayerRole("batsman")).toBe("Batter");
      expect(formatPlayerRole("bowler")).toBe("Bowler");
      expect(formatPlayerRole("player")).toBe("Player");
    });

    it("handles null or undefined gracefully", () => {
      expect(formatPlayerRole(null)).toBe("Player");
      expect(formatPlayerRole(undefined)).toBe("Player");
    });
  });

  describe("formatClubType", () => {
    it("formats known club types", () => {
      expect(formatClubType("community")).toBe("Community");
      expect(formatClubType("corporate")).toBe("Corporate");
      expect(formatClubType("school")).toBe("School");
      expect(formatClubType("professional")).toBe("Professional");
    });

    it("handles null or undefined gracefully", () => {
      expect(formatClubType(null)).toBe("Community");
      expect(formatClubType(undefined)).toBe("Community");
    });
  });

  describe("formatTeamType", () => {
    it("formats known team types", () => {
      expect(formatTeamType("club")).toBe("Club");
      expect(formatTeamType("match")).toBe("Match");
      expect(formatTeamType("tournament")).toBe("Tournament");
    });

    it("handles null or undefined gracefully", () => {
      expect(formatTeamType(null)).toBe("Club");
      expect(formatTeamType(undefined)).toBe("Club");
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
      expect(formatDecimalOvers(0)).toBe("0.0");
      expect(formatDecimalOvers(2.5)).toBe("2.5");
      expect(formatDecimalOvers(5.4)).toBe("5.4");
      expect(formatDecimalOvers(8.4)).toBe("8.4");
      expect(formatDecimalOvers(11.3)).toBe("11.3");
      expect(formatDecimalOvers(14.2)).toBe("14.2");
      expect(formatDecimalOvers(17.1)).toBe("17.1");
    });

    it("handles floating point precision drift in decimal overs", () => {
      expect(formatDecimalOvers(1.2000000000000004)).toBe("1.2");
      expect(formatDecimalOvers(2.1999999999999993)).toBe("2.2");
      expect(formatDecimalOvers(2.510000000000001)).toBe("2.5");
      expect(formatDecimalOvers(null)).toBe("0.0");
      expect(formatDecimalOvers(undefined)).toBe("0.0");
      expect(formatDecimalOvers(NaN)).toBe("0.0");
    });

    it("formats bowler overs and economy across engine columns", () => {
      const b1 = { balls_bowled: 24, overs_bowled: 0, runs_conceded: 26 };
      expect(formatBowlerOvers(b1)).toBe("4.0");
      expect(bowlerEconomy(b1)).toBe("6.50");

      const b2 = { balls_bowled: 0, overs_bowled: 4.0, runs_conceded: 26 };
      expect(formatBowlerOvers(b2)).toBe("4.0");
      expect(bowlerEconomy(b2)).toBe("6.50");

      const b3 = { balls_bowled: 21, overs_bowled: 0, runs_conceded: 21 };
      expect(formatBowlerOvers(b3)).toBe("3.3");
      expect(bowlerEconomy(b3)).toBe("6.00");
    });

    it("formats Fall of Wickets overs properly via formatFowOvers", () => {
      expect(formatFowOvers(2.5)).toBe("2.5");
      expect(formatFowOvers(8.4)).toBe("8.4");
      expect(formatFowOvers(14.2)).toBe("14.2");
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

  describe("inningsBalls", () => {
    it("returns 0 for null or empty innings", () => {
      expect(inningsBalls(null)).toBe(0);
      expect(inningsBalls(undefined)).toBe(0);
      expect(inningsBalls({ total_balls: 0, total_overs: 0 })).toBe(0);
    });

    it("prefers total_balls when present and positive", () => {
      expect(inningsBalls({ total_balls: 82, total_overs: 13.4 })).toBe(82);
    });

    it("falls back to ballsFromOvers when total_balls is missing", () => {
      expect(inningsBalls({ total_balls: 0, total_overs: 13.4 })).toBe(82);
      expect(inningsBalls({ total_balls: 0, total_overs: 20.0 })).toBe(120);
    });
  });

  describe("ballsRemaining", () => {
    it("calculates discrete remaining balls in a 20-over match without floating-point errors", () => {
      // User's exact scenario: 13.4 overs bowled (82 balls) in a 20-over match -> 38 balls remaining
      const ballsBowled = ballsFromOvers(13.4); // 82
      expect(ballsRemaining(20, ballsBowled)).toBe(38);
      // Ensures it is strictly an integer and NOT 39.599999999999994
      expect(Number.isInteger(ballsRemaining(20, ballsBowled))).toBe(true);
    });

    it("handles the final over and boundary conditions", () => {
      expect(ballsRemaining(20, 119)).toBe(1);
      expect(ballsRemaining(20, 120)).toBe(0);
      expect(ballsRemaining(20, 125)).toBe(0); // Clamped at 0
    });

    it("handles 50-over match calculations", () => {
      expect(ballsRemaining(50, 299)).toBe(1);
      expect(ballsRemaining(50, 0)).toBe(300);
    });
  });

  describe("runRate", () => {
    it("returns 0.00 when 0 balls have been bowled", () => {
      expect(runRate(0, 0)).toBe("0.00");
      expect(runRate(10, 0)).toBe("0.00");
      expect(runRate(null, null)).toBe("0.00");
    });

    it("calculates accurate run rates per 6 legal balls", () => {
      expect(runRate(60, 36)).toBe("10.00"); // 6.0 overs
      expect(runRate(111, 82)).toBe("8.12"); // 13.4 overs
      expect(runRate(1, 1)).toBe("6.00");
    });
  });

  describe("requiredRunRate", () => {
    it("returns dash when no balls remain", () => {
      expect(requiredRunRate(10, 0)).toBe("—");
      expect(requiredRunRate(0, 0)).toBe("—");
    });

    it("calculates accurate required run rates", () => {
      // 39 runs from 38 balls -> (39 * 6) / 38 = 6.1578... -> "6.16"
      expect(requiredRunRate(39, 38)).toBe("6.16");
      expect(requiredRunRate(36, 36)).toBe("6.00");
      expect(requiredRunRate(0, 38)).toBe("0.00");
    });
  });
});
