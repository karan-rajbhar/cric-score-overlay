import { describe, expect, it } from "vitest";
import {
  buildExportSummary,
  buildMatchReportHtml,
  phaseBoundaries,
} from "./match-report";
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

      // The app's brand: its fonts, the stumps mark and the wordmark.
      expect(html).toContain("family=Barlow:");
      expect(html).toContain("Barlow+Condensed");
      expect(html).not.toMatch(/Outfit|Plus Jakarta Sans|JetBrains Mono/);
      expect(html).toContain('class="brand-tile"');
      expect(html).toContain('<span class="brand-wordmark">CricScore');
      expect(html).not.toContain("13 2 3 14 12 14 11 22 21 10 12 10 13 2");
      expect(html).toContain("match-duel-hero");
    });

    it("renders over comparison page when deliveries are present", async () => {
      const matchWithDeliveries: Match = {
        ...sampleMatch,
        innings: [
          {
            ...innings1,
            ball_by_ball: [
              {
                id: "b1",
                match_id: "m1",
                innings_id: "inn1",
                over_number: 1,
                ball_number: 1,
                runs_scored: 4,
                extras: 0,
                extra_type: null,
                is_wicket: false,
                dismissal_type: null,
                bowler_id: "b_u1",
                batsman_id: "u1",
                non_striker_id: "u2",
                bowler: { id: "b_u1", full_name: "Mitchell Starc" },
                batsman: { id: "u1", full_name: "Virat Kohli" },
              },
              {
                id: "b2",
                match_id: "m1",
                innings_id: "inn1",
                over_number: 1,
                ball_number: 2,
                runs_scored: 0,
                extras: 1,
                extra_type: "wide",
                is_wicket: false,
                dismissal_type: null,
                bowler_id: "b_u1",
                batsman_id: "u1",
                non_striker_id: "u2",
                bowler: { id: "b_u1", full_name: "Mitchell Starc" },
                batsman: { id: "u1", full_name: "Virat Kohli" },
              },
              {
                id: "b3",
                match_id: "m1",
                innings_id: "inn1",
                over_number: 1,
                ball_number: 3,
                runs_scored: 0,
                extras: 0,
                extra_type: null,
                is_wicket: true,
                dismissal_type: "bowled",
                bowler_id: "b_u1",
                batsman_id: "u1",
                non_striker_id: "u2",
                bowler: { id: "b_u1", full_name: "Mitchell Starc" },
                batsman: { id: "u1", full_name: "Virat Kohli" },
              },
            ],
          },
          innings2,
        ],
      };

      const html = await buildMatchReportHtml(
        matchWithDeliveries,
        "https://cricket.app/matches/match-124",
      );

      expect(html).toContain("Over Comparison");
      expect(html).toContain("Mitchell Starc");
      expect(html).toContain("ball-pill");
      expect(html).toContain("ball-wicket");
      expect(html).toContain("ball-four");
      expect(html).toContain("ball-extra");

      // Advanced visual analytics
      expect(html).toContain("Worm Chart");
      expect(html).toContain("Manhattan Chart");
      expect(html).toContain("<svg");
      expect(html).toContain("Phase-by-Phase Match Comparison");
      expect(html).toContain("Match Impact &amp; MVP Index");
      expect(html).toContain("Official Verification &amp; Match Sign-off");
    });

    it("leaves out partnerships without a ball log, and signs off with blank name lines", async () => {
      const html = await buildMatchReportHtml(
        sampleMatch,
        "https://cricket.app/matches/match-124",
      );

      // Who batted together is not known without the ball log: no made-up
      // "Partner" rows.
      expect(html).not.toContain("Key Partnerships");
      expect(html).not.toContain("Active Batters");

      // Verification signoff block: roles, and a line to write unknown names
      expect(html).toContain("Official Verification &amp; Match Sign-off");
      expect(html).toContain("Certified Official Scoresheet");
      expect(html).toContain("Lead Match Umpire");
      expect(html).toContain("Official Scorer");
      expect(html).toContain("signoff-name-blank");
      expect(html).not.toContain("Team 1 Captain");
      expect(html).toContain("Generated:");
    });

    it("builds partnerships from the actual pair, ball by ball", async () => {
      const del = (
        seq: number,
        batsman: string,
        nonStriker: string,
        extra: Record<string, unknown> = {},
      ) => ({
        id: `d${seq}`,
        match_id: "m1",
        innings_id: "inn1",
        seq,
        over_number: 0,
        ball_number: seq,
        runs_scored: 1,
        extras: 0,
        extra_type: null,
        is_wicket: false,
        dismissal_type: null,
        bowler_id: "bw",
        batsman_id: batsman,
        non_striker_id: nonStriker,
        ...extra,
      });
      const names: Record<string, string> = { a: "Alpha", b: "Bravo", c: "Charlie" };
      const match: Match = {
        ...sampleMatch,
        innings: [
          {
            ...innings1,
            batting_performances: Object.entries(names).map(([id, full_name], i) => ({
              id: `bp-${id}`,
              match_id: "m1",
              innings_id: "inn1",
              user_id: id,
              batting_position: i + 1,
              runs_scored: 1,
              balls_faced: 1,
              fours: 0,
              sixes: 0,
              is_out: false,
              user: { id, full_name },
            })),
            ball_by_ball: [
              del(1, "a", "b"),
              // Retired hurt: the stand ends, but it is no wicket.
              del(2, "b", "a", { runs_scored: 0, is_wicket: true, dismissal_type: "retired_hurt", dismissed_player_id: "a" }),
              del(3, "b", "c", { runs_scored: 4 }),
              del(4, "c", "b", { runs_scored: 0, extras: 1, extra_type: "wide" }),
            ] as never,
          },
        ],
      };
      const html = await buildMatchReportHtml(match, "https://x.test/m");
      const section = html.slice(html.indexOf("Key Partnerships"));
      // First stand Alpha-Bravo (2 balls), then Bravo-Charlie unbroken, still
      // for the 1st wicket (retired hurt is not one).
      expect(section).toContain("Alpha");
      expect(section).toContain("Charlie");
      expect(section.match(/1st Wkt/g)?.length).toBe(2);
      expect(section).toContain("1st Wkt (Unbroken)");
      expect(section).not.toContain("2nd Wkt");
    });

    it("verifies clean text alignment, CSS rules scoping, and signature lines in generated report", async () => {
      const html = await buildMatchReportHtml(
        sampleMatch,
        "https://cricket.app/matches/match-124",
      );

      // CSS rules scoping and utility classes
      expect(html).toContain(".text-left { text-align: left !important; }");
      expect(html).toContain(".text-center { text-align: center !important; }");
      expect(html).toContain(".text-right { text-align: right !important; }");
      expect(html).toContain(".font-mono {");
      expect(html).toContain(".partnerships-wrap {");
      expect(html).toContain(".phase-analysis-card, .impact-card {");
      expect(html).toContain(".official-signoff-card {");

      // Verify signoff signature elements (no raw underscore overflow)
      expect(html).toContain("signoff-sig-line");
      expect(html).toContain("Signature &amp; Date");
      expect(html).not.toContain("______________________");

      // Match info card alignment and styling
      expect(html).toContain("class=\"match-info-card\"");
      expect(html).toContain("class=\"info-grid\"");
      expect(html).toContain("class=\"info-row\"");
      expect(html).toContain("class=\"info-label\"");
      expect(html).toContain("class=\"info-val\"");

      // Match impact leaderboard
      expect(html).toContain("class=\"impact-card\"");
      expect(html).toContain("class=\"impact-list\"");
      expect(html).toContain("class=\"impact-rank rank-gold\"");
      expect(html).toContain("class=\"impact-pts\"");
    });

    it("verifies mobile responsive CSS and table-responsive containers", async () => {
      const html = await buildMatchReportHtml(
        sampleMatch,
        "https://cricket.app/matches/match-124",
      );

      // Mobile responsive queries and wrapper classes
      expect(html).toContain("@media screen and (max-width: 768px)");
      expect(html).toContain("@media screen and (max-width: 640px)");
      expect(html).toContain(".table-responsive {");
      expect(html).toContain("overflow-x: auto;");
      expect(html).toContain("-webkit-overflow-scrolling: touch;");
      expect(html).toContain("class=\"table-responsive\"");

      // Avoid page-break cuts mid-card
      expect(html).toContain("break-inside: avoid !important;");
      expect(html).toContain("break-after: avoid !important;");

      // Verify cascade order: media queries must appear AFTER base styles to override them
      const baseReportPageIdx = html.indexOf(".report-page {");
      const baseChartsGridIdx = html.indexOf(".charts-duo-grid {");
      const mediaQueryIdx = html.indexOf("@media screen and (max-width: 768px)");

      expect(mediaQueryIdx).toBeGreaterThan(baseReportPageIdx);
      expect(mediaQueryIdx).toBeGreaterThan(baseChartsGridIdx);
    });

    it("flows 1st innings directly on Page 1 to eliminate wasted space and splits 2nd innings on Page 2", async () => {
      const html = await buildMatchReportHtml(
        sampleMatch,
        "https://cricket.app/matches/match-124",
      );

      // 1st innings is directly inside Page 1 (match-overview-page)
      const page1Index = html.indexOf('class="report-page match-overview-page"');
      const inn1Index = html.indexOf('1st Innings Scorecard');
      const page2Index = html.indexOf('class="report-page page-break innings-page-2"');
      const inn2Index = html.indexOf('2nd Innings Scorecard');

      expect(page1Index).toBeGreaterThan(-1);
      expect(inn1Index).toBeGreaterThan(page1Index);
      expect(page2Index).toBeGreaterThan(inn1Index);
      expect(inn2Index).toBeGreaterThan(page2Index);
    });

    it("renders single innings match cleanly on Page 1 with signoff and footer", async () => {
      const singleInningsMatch: Match = {
        ...sampleMatch,
        innings: [innings1],
      };

      const html = await buildMatchReportHtml(
        singleInningsMatch,
        "https://cricket.app/matches/match-124",
      );

      expect(html).toContain("1st Innings Scorecard");
      expect(html).not.toContain("2nd Innings Scorecard");
      expect(html).not.toContain("innings-page-2");
      expect(html).toContain("Official Verification &amp; Match Sign-off");
      expect(html).toContain("data:image/png;base64,"); // QR code
    });
      it("lists the side that batted first first and batters in batting order", async () => {
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
      const html = await buildMatchReportHtml(match, "https://x.test/m");
      const hero = html.slice(html.indexOf("match-duel-hero"));
      expect(hero.indexOf("Coastal Kings")).toBeLessThan(
        hero.indexOf("Royal Tigers"),
      );
      expect(html).toContain("Target 161");
      const card = html.slice(html.indexOf("2nd Innings Scorecard"));
      const order = ["Opener One", "Opener Two", "Fifth In"].map((n) =>
        card.indexOf(n),
      );
      expect(order).toEqual([...order].sort((a, b) => a - b));
    });

    it("states only facts the match holds, in plain words", async () => {
      const html = await buildMatchReportHtml(
        { ...sampleMatch, toss_winner_team_id: "t2", toss_decision: "bowl" },
        "https://x.test/m",
      );
      for (const filler of [
        "11 Per Side",
        "Official League Umpires",
        "Standard Leather Ball",
        "Host Organiser",
        "Opted To",
      ]) {
        expect(html).not.toContain(filler);
      }
      expect(html).toContain("Coastal Kings won the toss and chose to bowl");
      const withScorer = await buildMatchReportHtml(
        { ...sampleMatch, umpire1_name: "A Umpire", scorer_name: "C Scorer" },
        "https://x.test/m",
      );
      expect(withScorer).toContain("A Umpire");
      expect(withScorer).toContain("C Scorer");
    });

    it("includes super overs and marks a retired batter", async () => {
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
          { ...innings1, id: "inn3", innings_number: 3 },
          { ...innings2, id: "inn4", innings_number: 4 },
        ],
      };
      const html = await buildMatchReportHtml(match, "https://x.test/m");
      expect(html).toContain("retired hurt");
      expect(html.match(/Super Over Scorecard/g)).toHaveLength(2);
    });
  });

  describe("phase analysis", () => {
    it("splits any length into powerplay, middle and death overs", () => {
      expect(phaseBoundaries(20)).toEqual({ ppEnd: 6, midEnd: 15 });
      expect(phaseBoundaries(10)).toEqual({ ppEnd: 3, midEnd: 7 });
      expect(phaseBoundaries(50)).toEqual({ ppEnd: 10, midEnd: 40 });
      expect(phaseBoundaries(5)).toEqual({ ppEnd: 2, midEnd: 4 });
      expect(phaseBoundaries(3)).toBeNull();
    });
  });

  it("offers the report as a PDF file to share, built ahead of the tap", async () => {
    const html = await buildMatchReportHtml(
      {
        ...sampleMatch,
        team1: { ...sampleMatch.team1!, logo_url: "https://cdn.test/a.png" },
      },
      "https://x.test/m",
    );
    // Disabled until the file is ready; named after the sides in batting order.
    expect(html).toMatch(/<button id="btn-share-pdf"[^>]*disabled/);
    expect(html).toMatch(/data-file-name="[^"]+ vs [^"]+ – match report\.pdf"/);
    // Pinned libraries, checked by the browser.
    expect(html).toContain("html2canvas@1.4.1");
    expect(html).toContain("jspdf@2.5.2");
    expect(html.match(/"sha384-[A-Za-z0-9+/=]{64}"/g)).toHaveLength(2);
    // The file alone goes to the share sheet (WhatsApp on iOS drops it
    // when text comes with it).
    expect(html).toContain("navigator.share({ files: [file] })");
    // Logos carry what the crest shows without them.
    expect(html).toContain('data-initials="');
  });

  it("shares the link and waits for fonts before printing", async () => {
    const html = await buildMatchReportHtml(sampleMatch, "https://x.test/m");
    expect(html).toContain('data-url="https://x.test/m"');
    expect(html).toContain("Share link");
    expect(html).toContain("document.fonts.ready");
  });
});
