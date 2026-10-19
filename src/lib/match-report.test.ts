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
    const URL = "https://cricscore.example.com/matches/match-124";

    it("renders a complete scorecard with the result, the facts and a QR code", async () => {
      const html = await buildMatchReportHtml(sampleMatch, URL);

      expect(html.toLowerCase()).toContain("<!doctype html>");
      expect(html).toContain("<h1>Royal Tigers vs Coastal Kings</h1>");
      expect(html).toContain("T20 Championship Final");
      expect(html).toContain("Melbourne Cricket Ground");
      expect(html).toContain("Royal Tigers won by 18 runs");
      expect(html).toContain("Virat Kohli");
      expect(html).toContain("Jasprit Bumrah");
      expect(html).toContain("data:image/png;base64,");
      expect(html).toContain(`<a href="${URL}">${URL}</a>`);
      expect(html).toContain("@media print");
      expect(html).toContain("@page { size: A4");
      expect(html).toContain(
        "1-26 (David Brown, 2.5 ov), 2-46 (Tom Garcia, 5.4 ov)",
      );
      // Extras with their breakdown, and the total with the run rate.
      expect(html).toContain("b 2, lb 1, w 5, nb 2");
      expect(html).toContain("178/5 <span class=\"muted\">(20.0 ov, RR 8.90)</span>");
    });

    it("states only facts the match holds", async () => {
      const html = await buildMatchReportHtml(sampleMatch, URL);
      for (const filler of [
        "11 Per Side",
        "Official League Umpires",
        "Official Scorer",
        "Standard Leather Ball",
        "Verified Electronic Record",
      ]) {
        expect(html).not.toContain(filler);
      }
      const withOfficials = await buildMatchReportHtml(
        {
          ...sampleMatch,
          umpire1_name: "A Umpire",
          umpire2_name: "B Umpire",
          scorer_name: "C Scorer",
        },
        URL,
      );
      expect(withOfficials).toContain("<dt>Umpires</dt><dd>A Umpire, B Umpire</dd>");
      expect(withOfficials).toContain("<dt>Scorer</dt><dd>C Scorer</dd>");
    });

    it("lists the side that batted first first, and batters in batting order", async () => {
      const bat = (id: string, name: string, pos: number, balls: number) => ({
        id: `bp-${id}`,
        match_id: "m1",
        innings_id: "inn1",
        user_id: id,
        batting_position: pos,
        runs_scored: balls,
        balls_faced: balls,
        fours: 0,
        sixes: 0,
        is_out: true,
        user: { id, full_name: name },
      });
      const match: Match = {
        ...sampleMatch,
        innings: [
          { ...innings2, team_id: "t2", innings_number: 1 },
          {
            ...innings1,
            team_id: "t1",
            innings_number: 2,
            target_runs: 161,
            batting_performances: [
              // Number 5 faced the most balls: still listed fifth.
              bat("u5", "Fifth In", 5, 60),
              bat("u1", "Opener One", 1, 10),
              bat("u2", "Opener Two", 2, 12),
            ],
          },
        ],
      };
      const html = await buildMatchReportHtml(match, URL);
      expect(html).toContain("<h1>Coastal Kings vs Royal Tigers</h1>");
      expect(html.indexOf("Coastal Kings innings")).toBeLessThan(
        html.indexOf("Royal Tigers innings"),
      );
      expect(html).toContain("Target 161");
      const order = ["Opener One", "Opener Two", "Fifth In"].map((n) =>
        html.indexOf(n),
      );
      expect(order).toEqual([...order].sort((a, b) => a - b));
    });

    it("marks not-out and retired batters, and includes super overs", async () => {
      const match: Match = {
        ...sampleMatch,
        innings: [
          {
            ...innings1,
            batting_performances: [
              ...(innings1.batting_performances ?? []),
              {
                id: "bp-r",
                match_id: "m1",
                innings_id: "inn1",
                user_id: "ur",
                batting_position: 3,
                runs_scored: 7,
                balls_faced: 5,
                fours: 1,
                sixes: 0,
                is_out: false,
                dismissal_type: "retired_hurt",
                user: { id: "ur", full_name: "Hurt Batter" },
              },
            ],
          },
          innings2,
          { ...innings1, id: "inn3", innings_number: 3, fall_of_wickets: [] },
          { ...innings2, id: "inn4", innings_number: 4 },
        ],
      };
      const html = await buildMatchReportHtml(match, URL);
      expect(html).toContain("Rohit Sharma *");
      expect(html).toContain("retired hurt");
      expect(html).toContain("Royal Tigers, super over");
      expect(html).toContain("Coastal Kings, super over");
    });
  });
});
