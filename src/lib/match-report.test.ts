import { describe, expect, it } from "vitest";
import { buildExportSummary, buildMatchReportHtml } from "./match-report";
import { makeMatch } from "~/test/factories";
import type { Innings, Match } from "./match-types";

describe("match-report export helpers", () => {
  const innings1: Innings = {
    id: "inn1",
    match_id: "m1",
    team_id: "t1",
    innings_number: 1,
    total_runs: 178,
    total_wickets: 5,
    total_balls: 120,
    total_overs: 20,
    is_completed: true,
    extras_total: 10,
    extras_byes: 2,
    extras_leg_byes: 1,
    extras_wides: 5,
    extras_no_balls: 2,
    extras_penalties: 0,
    batting_performances: [
      {
        id: "bp1",
        match_id: "m1",
        innings_id: "inn1",
        user_id: "u1",
        runs_scored: 82,
        balls_faced: 48,
        fours: 8,
        sixes: 4,
        is_out: true,
        user: { id: "u1", full_name: "Virat Kohli" },
      },
      {
        id: "bp2",
        match_id: "m1",
        innings_id: "inn1",
        user_id: "u2",
        runs_scored: 45,
        balls_faced: 30,
        fours: 4,
        sixes: 1,
        is_out: false,
        user: { id: "u2", full_name: "Rohit Sharma" },
      },
    ],
    bowling_performances: [],
    fall_of_wickets: [
      {
        id: "fow1",
        match_id: "m1",
        innings_id: "inn1",
        wicket_number: 1,
        runs_at_fall: 26,
        overs_at_fall: 2.5,
        batsman_out_id: "u4",
        batsman: { id: "u4", full_name: "David Brown" },
      },
      {
        id: "fow2",
        match_id: "m1",
        innings_id: "inn1",
        wicket_number: 2,
        runs_at_fall: 46,
        overs_at_fall: 5.4,
        batsman_out_id: "u5",
        batsman: { id: "u5", full_name: "Tom Garcia" },
      },
      {
        id: "fow3",
        match_id: "m1",
        innings_id: "inn1",
        wicket_number: 3,
        runs_at_fall: 73,
        overs_at_fall: 8.4,
        batsman_out_id: "u6",
        batsman: { id: "u6", full_name: "Mike Wilson" },
      },
      {
        id: "fow4",
        match_id: "m1",
        innings_id: "inn1",
        wicket_number: 4,
        runs_at_fall: 94,
        overs_at_fall: 11.3,
        batsman_out_id: "u7",
        batsman: { id: "u7", full_name: "John Smith" },
      },
      {
        id: "fow5",
        match_id: "m1",
        innings_id: "inn1",
        wicket_number: 5,
        runs_at_fall: 117,
        overs_at_fall: 14.2,
        batsman_out_id: "u8",
        batsman: { id: "u8", full_name: "Ryan Martinez" },
      },
      {
        id: "fow6",
        match_id: "m1",
        innings_id: "inn1",
        wicket_number: 6,
        runs_at_fall: 141,
        overs_at_fall: 17.1,
        batsman_out_id: "u9",
        batsman: { id: "u9", full_name: "Alex Davis" },
      },
    ],
  };

  const innings2: Innings = {
    id: "inn2",
    match_id: "m1",
    team_id: "t2",
    innings_number: 2,
    total_runs: 160,
    total_wickets: 9,
    total_balls: 120,
    total_overs: 20,
    is_completed: true,
    extras_total: 8,
    extras_byes: 0,
    extras_leg_byes: 2,
    extras_wides: 4,
    extras_no_balls: 2,
    extras_penalties: 0,
    batting_performances: [
      {
        id: "bp3",
        match_id: "m1",
        innings_id: "inn2",
        user_id: "u3",
        runs_scored: 60,
        balls_faced: 40,
        fours: 6,
        sixes: 2,
        is_out: true,
        user: { id: "u3", full_name: "Steve Smith" },
      },
    ],
    bowling_performances: [
      {
        id: "bwp1",
        match_id: "m1",
        innings_id: "inn2",
        user_id: "ub1",
        overs_bowled: 4,
        balls_bowled: 24,
        runs_conceded: 26,
        wickets_taken: 3,
        maidens: 0,
        wides: 1,
        no_balls: 0,
        user: { id: "ub1", full_name: "Jasprit Bumrah" },
      },
    ],
  };

  const sampleMatch: Match = makeMatch({
    id: "match-124",
    title: "T20 Championship Final",
    match_format: "T20",
    overs_per_innings: 20,
    venue: "Melbourne Cricket Ground",
    scheduled_at: "2026-03-15T10:00:00Z",
    status: "completed",
    result_description: "Royal Tigers won by 18 runs",
    innings: [innings1, innings2],
  });

  describe("buildExportSummary", () => {
    it("builds correct metadata and team summary structure", () => {
      const summary = buildExportSummary(
        sampleMatch,
        "https://cricket.app/matches/match-124",
      );

      expect(summary.title).toBe("T20 Championship Final");
      expect(summary.format).toBe("T20 · 20 ov");
      expect(summary.venue).toBe("Melbourne Cricket Ground");
      expect(summary.result).toBe("Royal Tigers won by 18 runs");
      expect(summary.matchUrl).toBe("https://cricket.app/matches/match-124");

      // Team 1
      expect(summary.team1.name).toBe("Royal Tigers");
      expect(summary.team1.shortName).toBe("RTG");
      expect(summary.team1.scoreLine).toBe("178/5 (20.0)");
      expect(summary.team1.batters).toHaveLength(2);
      expect(summary.team1.batters[0]?.name).toBe("Virat Kohli");
      expect(summary.team1.batters[0]?.runs).toBe(82);
      expect(summary.team1.batters[0]?.sr).toBe("170.8");

      // Team 2
      expect(summary.team2.name).toBe("Coastal Kings");
      expect(summary.team2.shortName).toBe("CKS");
      expect(summary.team2.scoreLine).toBe("160/9 (20.0)");
      expect(summary.team2.batters).toHaveLength(1);
      expect(summary.team2.batters[0]?.name).toBe("Steve Smith");
    });
  });

  describe("buildMatchReportHtml", () => {
    it("generates complete HTML document with QR code and scorecard tables", async () => {
      const html = await buildMatchReportHtml(
        sampleMatch,
        "https://cricket.app/matches/match-124",
      );

      expect(html.toLowerCase()).toContain("<!doctype html>");
      expect(html).toContain("T20 Championship Final");
      expect(html).toContain("Melbourne Cricket Ground");
      expect(html).toContain("Royal Tigers won by 18 runs");
      expect(html).toContain("Virat Kohli");
      expect(html).toContain("Jasprit Bumrah");
      expect(html).toContain("data:image/png;base64,"); // QR code data url
      expect(html).toContain('class="innings"');
      expect(html).toContain("@media print");

      // Verify Fall of Wickets formatting
      expect(html).toContain(
        '1-26</strong> <span class="fow-sub">(David Brown, 2.5 ov)',
      );
      expect(html).toContain(
        '2-46</strong> <span class="fow-sub">(Tom Garcia, 5.4 ov)',
      );
      expect(html).toContain(
        '3-73</strong> <span class="fow-sub">(Mike Wilson, 8.4 ov)',
      );
      expect(html).toContain(
        '4-94</strong> <span class="fow-sub">(John Smith, 11.3 ov)',
      );
      expect(html).toContain(
        '5-117</strong> <span class="fow-sub">(Ryan Martinez, 14.2 ov)',
      );
      expect(html).toContain(
        '6-141</strong> <span class="fow-sub">(Alex Davis, 17.1 ov)',
      );

      // Must never produce double-dot or float artifacts
      expect(html).not.toContain("0.2.5 ov");
      expect(html).not.toContain("0.5.4 ov");
      expect(html).not.toContain("1.2.4000");
      expect(html).not.toContain("1.5.3000");
      expect(html).not.toContain("2.2.1999");
      expect(html).not.toContain("2.5.1000");
    });
  });
});
