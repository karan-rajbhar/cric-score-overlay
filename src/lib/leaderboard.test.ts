import { describe, expect, it } from "vitest";
import {
  buildLeaderboardData,
  sortBattingEntries,
  sortBowlingEntries,
  sortFieldingEntries,
  sortMvpEntries,
  getLegalDeliveries,
  formatOvers,
  RawBattingRecord,
  RawBowlingRecord,
  RawFallOfWicketRecord,
} from "./leaderboard";

describe("leaderboard calculation engine", () => {
  it("handles empty or null inputs gracefully", () => {
    const data = buildLeaderboardData({
      batting: null,
      bowling: null,
      fallOfWickets: null,
    });

    expect(data.batting).toEqual([]);
    expect(data.bowling).toEqual([]);
    expect(data.fielding).toEqual([]);
    expect(data.mvp).toEqual([]);
    expect(data.highlights.orangeCap).toBeNull();
    expect(data.highlights.purpleCap).toBeNull();
    expect(data.highlights.mvpLeader).toBeNull();
  });

  describe("overs and legal delivery helpers", () => {
    it("converts balls or overs notation correctly", () => {
      expect(getLegalDeliveries(24, null)).toBe(24);
      expect(getLegalDeliveries(null, 3.4)).toBe(22);
      expect(getLegalDeliveries(null, 4.0)).toBe(24);
      expect(getLegalDeliveries(0, 0)).toBe(0);
    });

    it("formats balls into overs notation", () => {
      expect(formatOvers(24)).toBe("4.0");
      expect(formatOvers(23)).toBe("3.5");
      expect(formatOvers(0)).toBe("0.0");
    });
  });

  describe("batting calculations", () => {
    const mockBatting: RawBattingRecord[] = [
      {
        match_id: "m1",
        user_id: "u1",
        runs_scored: 104,
        balls_faced: 52,
        fours: 8,
        sixes: 6,
        is_out: false,
        user: { full_name: "Virat Kohli", avatar_url: "https://example.com/vk.jpg" },
      },
      {
        match_id: "m2",
        user_id: "u1",
        runs_scored: 58,
        balls_faced: 35,
        fours: 4,
        sixes: 2,
        is_out: true,
        user: { full_name: "Virat Kohli", avatar_url: "https://example.com/vk.jpg" },
      },
      {
        match_id: "m1",
        user_id: "u2",
        runs_scored: 45,
        balls_faced: 20,
        fours: 3,
        sixes: 4,
        is_out: true,
        user: { full_name: "Rohit Sharma", avatar_url: null },
      },
      {
        match_id: "m2",
        user_id: "u2",
        runs_scored: 12,
        balls_faced: 10,
        fours: 2,
        sixes: 0,
        is_out: false,
        user: { full_name: "Rohit Sharma", avatar_url: null },
      },
    ];

    it("computes accurate aggregates for batting stats", () => {
      const data = buildLeaderboardData({ batting: mockBatting });
      expect(data.batting.length).toBe(2);

      const kohli = data.batting.find((b) => b.userId === "u1")!;
      expect(kohli.name).toBe("Virat Kohli");
      expect(kohli.avatar).toBe("https://example.com/vk.jpg");
      expect(kohli.matches).toBe(2);
      expect(kohli.innings).toBe(2);
      expect(kohli.notOuts).toBe(1);
      expect(kohli.runs).toBe(162);
      expect(kohli.balls).toBe(87);
      expect(kohli.fours).toBe(12);
      expect(kohli.sixes).toBe(8);
      expect(kohli.centuries).toBe(1);
      expect(kohli.fifties).toBe(1);
      expect(kohli.highestScore).toBe(104);
      expect(kohli.isHighestNotOut).toBe(true);
      expect(kohli.highestScoreDisplay).toBe("104*");
      // Average: 162 runs / 1 dismissal = 162.00
      expect(kohli.average).toBe(162);
      expect(kohli.averageDisplay).toBe("162.00");
      // Strike Rate: (162 / 87) * 100 = 186.21
      expect(kohli.strikeRateDisplay).toBe("186.21");

      const rohit = data.batting.find((b) => b.userId === "u2")!;
      expect(rohit.runs).toBe(57);
      expect(rohit.balls).toBe(30);
      expect(rohit.centuries).toBe(0);
      expect(rohit.fifties).toBe(0);
      expect(rohit.highestScoreDisplay).toBe("45");
      // Average: 57 runs / 1 dismissal = 57.00
      expect(rohit.averageDisplay).toBe("57.00");
    });

    it("sorts batting entries by different metrics", () => {
      const data = buildLeaderboardData({ batting: mockBatting });
      
      const bySixes = sortBattingEntries(data.batting, "sixes");
      expect(bySixes[0]!.userId).toBe("u1");

      const byFifties = sortBattingEntries(data.batting, "fifties");
      expect(byFifties[0]!.fifties).toBe(1);

      const byCenturies = sortBattingEntries(data.batting, "centuries");
      expect(byCenturies[0]!.centuries).toBe(1);

      const byHighest = sortBattingEntries(data.batting, "highestScore");
      expect(byHighest[0]!.highestScore).toBe(104);
    });
  });

  describe("bowling calculations", () => {
    const mockBowling: RawBowlingRecord[] = [
      {
        match_id: "m1",
        user_id: "bowler1",
        overs_bowled: 4.0,
        balls_bowled: 24,
        runs_conceded: 18,
        wickets_taken: 5,
        maidens: 1,
        user: { full_name: "Jasprit Bumrah" },
      },
      {
        match_id: "m2",
        user_id: "bowler1",
        overs_bowled: 4.0,
        balls_bowled: 24,
        runs_conceded: 22,
        wickets_taken: 3,
        maidens: 0,
        user: { full_name: "Jasprit Bumrah" },
      },
      {
        match_id: "m1",
        user_id: "bowler2",
        overs_bowled: 4.0,
        balls_bowled: 24,
        runs_conceded: 35,
        wickets_taken: 2,
        maidens: 0,
        user: { full_name: "Rashid Khan" },
      },
    ];

    it("computes accurate bowling metrics including 3w, 5w, and BBI", () => {
      const data = buildLeaderboardData({ bowling: mockBowling });
      expect(data.bowling.length).toBe(2);

      const bumrah = data.bowling.find((b) => b.userId === "bowler1")!;
      expect(bumrah.name).toBe("Jasprit Bumrah");
      expect(bumrah.matches).toBe(2);
      expect(bumrah.innings).toBe(2);
      expect(bumrah.overs).toBe("8.0");
      expect(bumrah.balls).toBe(48);
      expect(bumrah.maidens).toBe(1);
      expect(bumrah.runsConceded).toBe(40);
      expect(bumrah.wickets).toBe(8);
      // Best Bowling: 5/18
      expect(bumrah.bestBowling.display).toBe("5/18");
      expect(bumrah.fiveWickets).toBe(1);
      expect(bumrah.threeWickets).toBe(1);
      // Average: 40 runs / 8 wickets = 5.00
      expect(bumrah.average).toBe(5);
      expect(bumrah.averageDisplay).toBe("5.00");
      // Economy: 40 runs / (48 / 6) = 5.00
      expect(bumrah.economy).toBe(5);
      expect(bumrah.economyDisplay).toBe("5.00");
    });

    it("sorts bowling entries by different metrics", () => {
      const data = buildLeaderboardData({ bowling: mockBowling });
      
      const byEconomy = sortBowlingEntries(data.bowling, "economy");
      expect(byEconomy[0]!.userId).toBe("bowler1");

      const byMaidens = sortBowlingEntries(data.bowling, "maidens");
      expect(byMaidens[0]!.maidens).toBe(1);

      const byBestBowling = sortBowlingEntries(data.bowling, "bestBowling");
      expect(byBestBowling[0]!.bestBowling.display).toBe("5/18");
    });
  });

  describe("fielding and dismissal calculations", () => {
    const mockFow: RawFallOfWicketRecord[] = [
      {
        match_id: "m1",
        fielder_id: "f1",
        dismissal_type: "caught",
        fielder: { full_name: "Ravindra Jadeja" },
      },
      {
        match_id: "m1",
        fielder_id: "f1",
        dismissal_type: "run_out",
        fielder: { full_name: "Ravindra Jadeja" },
      },
      {
        match_id: "m2",
        fielder_id: "f2",
        dismissal_type: "stumped",
        fielder: { full_name: "MS Dhoni" },
      },
    ];

    it("aggregates catches, stumpings, and run outs", () => {
      const data = buildLeaderboardData({ fallOfWickets: mockFow });
      expect(data.fielding.length).toBe(2);

      const jadeja = data.fielding.find((f) => f.userId === "f1")!;
      expect(jadeja.name).toBe("Ravindra Jadeja");
      expect(jadeja.catches).toBe(1);
      expect(jadeja.runOuts).toBe(1);
      expect(jadeja.stumpings).toBe(0);
      expect(jadeja.totalDismissals).toBe(2);

      const dhoni = data.fielding.find((f) => f.userId === "f2")!;
      expect(dhoni.stumpings).toBe(1);
      expect(dhoni.catches).toBe(0);
      expect(dhoni.totalDismissals).toBe(1);
    });

    it("sorts fielding entries properly", () => {
      const data = buildLeaderboardData({ fallOfWickets: mockFow });

      const byStumpings = sortFieldingEntries(data.fielding, "stumpings");
      expect(byStumpings[0]!.userId).toBe("f2");

      const byRunOuts = sortFieldingEntries(data.fielding, "runOuts");
      expect(byRunOuts[0]!.userId).toBe("f1");
    });
  });

  describe("MVP and Highlights computation", () => {
    it("computes all-round MVP points and highlights", () => {
      const data = buildLeaderboardData({
        batting: [
          {
            match_id: "m1",
            user_id: "allrounder",
            runs_scored: 75,
            balls_faced: 40,
            fours: 6,
            sixes: 4,
            is_out: false,
            user: { full_name: "Hardik Pandya" },
          },
        ],
        bowling: [
          {
            match_id: "m1",
            user_id: "allrounder",
            overs_bowled: 4.0,
            balls_bowled: 24,
            runs_conceded: 20,
            wickets_taken: 3,
            maidens: 0,
            user: { full_name: "Hardik Pandya" },
          },
        ],
        fallOfWickets: [
          {
            match_id: "m1",
            fielder_id: "allrounder",
            dismissal_type: "caught",
            fielder: { full_name: "Hardik Pandya" },
          },
        ],
      });

      expect(data.mvp.length).toBe(1);
      const hardik = data.mvp[0]!;
      expect(hardik.name).toBe("Hardik Pandya");
      expect(hardik.runs).toBe(75);
      expect(hardik.wickets).toBe(3);
      expect(hardik.catches).toBe(1);
      expect(hardik.battingPoints).toBeGreaterThan(0);
      expect(hardik.bowlingPoints).toBeGreaterThan(0);
      expect(hardik.fieldingPoints).toBe(10);
      expect(hardik.totalPoints).toBe(
        hardik.battingPoints + hardik.bowlingPoints + hardik.fieldingPoints,
      );

      // Highlights
      expect(data.highlights.orangeCap?.userId).toBe("allrounder");
      expect(data.highlights.purpleCap?.userId).toBe("allrounder");
      expect(data.highlights.mvpLeader?.userId).toBe("allrounder");
      expect(data.highlights.mostSixes?.userId).toBe("allrounder");
      expect(data.highlights.mostFours?.userId).toBe("allrounder");
      expect(data.highlights.bestBowling?.userId).toBe("allrounder");
      expect(data.highlights.topFielder?.userId).toBe("allrounder");

      // Verify sortMvpEntries
      const sortedByBat = sortMvpEntries(data.mvp, "battingPoints");
      expect(sortedByBat[0]!.userId).toBe("allrounder");
      const sortedByBowl = sortMvpEntries(data.mvp, "bowlingPoints");
      expect(sortedByBowl[0]!.userId).toBe("allrounder");
      const sortedByField = sortMvpEntries(data.mvp, "fieldingPoints");
      expect(sortedByField[0]!.userId).toBe("allrounder");
    });
  });
});
