import { describe, expect, it } from "vitest";
import {
  buildExportSummary,
  buildMatchReport,
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

  const URL_ = "https://cricket.app/matches/match-124";
  const ball = (n: number, extra: Record<string, unknown>) => ({
    id: `b${n}`,
    match_id: "m1",
    innings_id: "inn1",
    over_number: 1,
    ball_number: n,
    runs_scored: 0,
    extras: 0,
    extra_type: null,
    is_wicket: false,
    dismissal_type: null,
    bowler_id: "b_u1",
    batsman_id: "u1",
    non_striker_id: "u2",
    bowler: { id: "b_u1", full_name: "Mitchell Starc" },
    batsman: { id: "u1", full_name: "Virat Kohli" },
    ...extra,
  });
  const deliveriesOf = (): Innings["ball_by_ball"] =>
    [
      ball(1, { runs_scored: 4 }),
      ball(2, { extras: 1, extra_type: "wide" }),
      ball(3, { is_wicket: true, dismissal_type: "bowled" }),
    ] as never;

  describe("buildMatchReport", () => {
    it("holds each innings' scorecard, fall of wickets and the match facts", () => {
      const r = buildMatchReport(sampleMatch, URL_);
      expect(r.title).toBe("T20 Championship Final");
      expect(r.matchUrl).toBe(URL_);
      expect(r.innings.map((i) => i.heading)).toEqual([
        "1st innings",
        "2nd innings",
      ]);
      const first = r.innings[0]!;
      expect(first.score).toBe("178/5");
      expect(first.batters.map((b) => b.name)).toContain("Virat Kohli");
      expect(first.extras).toEqual({ total: 10, detail: "(b 2, lb 1, wd 5, nb 2)" });
      expect(first.fallOfWickets.slice(0, 2)).toEqual([
        { score: "1-26", name: "David Brown", over: "2.5" },
        { score: "2-46", name: "Tom Garcia", over: "5.4" },
      ]);
      expect(first.fallOfWickets.at(-1)).toEqual({
        score: "6-141",
        name: "Alex Davis",
        over: "17.1",
      });
      expect(r.innings[1]!.bowlers[0]).toMatchObject({
        name: "Jasprit Bumrah",
        wickets: 3,
        wides: 1,
        // No ball log: dot balls, fours and sixes are not known.
        dots: null,
      });
      expect(r.info).toContainEqual({
        label: "Venue",
        value: "Melbourne Cricket Ground",
        wide: undefined,
      });
      expect(r.fileName).toBe("Royal Tigers vs Coastal Kings – match report.pdf");
    });

    it("builds the over-by-over comparison, charts and analysis from the ball log", () => {
      const r = buildMatchReport(
        {
          ...sampleMatch,
          innings: [{ ...innings1, ball_by_ball: deliveriesOf() }, innings2],
        },
        URL_,
      );
      const over = r.overs?.rows[0]?.[0];
      expect(over?.bowlerName).toBe("Mitchell Starc");
      expect(over?.balls.map((b) => b.type)).toEqual(["four", "extra", "wicket"]);
      expect(r.charts?.sides[0]?.overs[0]).toMatchObject({ runs: 5, wickets: 1 });
      expect(r.phases?.rows.map((p) => p.name)).toEqual([
        "Powerplay",
        "Middle overs",
        "Death overs",
      ]);
      expect(r.impact[0]?.name).toBe("Virat Kohli");
      expect(r.innings[0]!.bowlers).toEqual([]);
    });

    it("spells balls as the app does and counts wickets as the engine does", () => {
      const r = buildMatchReport(
        {
          ...sampleMatch,
          innings: [
            {
              ...innings1,
              ball_by_ball: [
                ball(1, {
                  runs_scored: 3,
                  is_wicket: true,
                  dismissal_type: "run_out",
                }),
                ball(2, {
                  bowler_id: null,
                  is_wicket: true,
                  dismissal_type: "retired_hurt",
                }),
                ball(2, { is_wicket: true, dismissal_type: "bowled" }),
                ball(3, { extras: 2, extra_type: "bye" }),
              ] as never,
            },
            innings2,
          ],
        },
        URL_,
      );
      const over = r.overs?.rows[0]?.[0];
      expect(over?.balls).toEqual([
        { text: "W+3", type: "wicket" },
        { text: "rh", type: "dot" },
        { text: "W", type: "wicket" },
        { text: "b2", type: "extra" },
      ]);
      // The run out and the bowled fell; the bowler took only the bowled,
      // and is charged the run out's 3 but not the byes.
      expect(over).toMatchObject({ wickets: 2, bowlerWickets: 1, bowlerRuns: 3 });
    });

    it("shows a bowler's run out as a run out, on the scorecard and the bowler's figures", () => {
      const r = buildMatchReport(
        {
          ...sampleMatch,
          innings: [
            {
              ...innings1,
              batting_performances: [
                {
                  ...innings1.batting_performances![0]!,
                  is_out: true,
                  dismissal_type: "run_out",
                },
              ],
              fall_of_wickets: [
                {
                  id: "f1",
                  batsman_out_id: "u1",
                  wicket_number: 1,
                  runs_at_fall: 10,
                  overs_at_fall: 2,
                  bowler_id: "b_u1",
                  fielder_id: "b_u1",
                  bowler: { id: "b_u1", full_name: "Mitchell Starc" },
                  fielder: { id: "b_u1", full_name: "Mitchell Starc" },
                },
              ] as never,
            },
            innings2,
          ],
        },
        URL_,
      );
      expect(r.innings[0]!.batters[0]!.dismissal).toBe("run out (Mitchell Starc)");
    });

    it("does not count a retirement in the phase table", () => {
      const deliveries = [
        ball(1, { runs_scored: 1 }),
        ball(2, {
          bowler_id: null,
          is_wicket: true,
          dismissal_type: "retired_hurt",
        }),
        ball(2, { is_wicket: true, dismissal_type: "bowled" }),
      ];
      const r = buildMatchReport(
        {
          ...sampleMatch,
          innings: [{ ...innings1, ball_by_ball: deliveries as never }, innings2],
        },
        URL_,
      );
      expect(r.phases?.rows[0]?.sides[0]).toMatchObject({ score: "1/1" });
    });

    it("leaves out partnerships without a ball log, and signs off with blank name lines", () => {
      const r = buildMatchReport(sampleMatch, URL_);
      // Who batted together is not known without the ball log: no made-up
      // "Partner" rows.
      expect(r.innings.every((i) => i.partnerships.length === 0)).toBe(true);
      expect(r.signoff.map((s) => s.role)).toEqual([
        "RTG captain",
        "CKS captain",
        "Lead match umpire",
        "Official scorer / referee",
      ]);
      // A name only when the match holds it: a line to write it on.
      expect(r.signoff.every((s) => s.name === null)).toBe(true);
      expect(r.generated).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it("builds partnerships from the actual pair, ball by ball", () => {
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
              // A no-ball is a ball faced: Charlie's, and the stand's.
              del(5, "c", "b", { runs_scored: 2, extras: 1, extra_type: "no_ball" }),
            ] as never,
          },
        ],
      };
      const stands = buildMatchReport(match, "https://x.test/m").innings[0]!
        .partnerships;
      // Alpha-Bravo (2 balls), then Bravo-Charlie unbroken, still for the
      // 1st wicket (retired hurt is not one).
      expect(stands.map((p) => [p.wicketNumber, p.isUnbroken])).toEqual([
        [1, false],
        [1, true],
      ]);
      expect(stands[0]).toMatchObject({
        batter1: { name: "Alpha", runs: 1, balls: 1 },
        batter2: { name: "Bravo", runs: 0, balls: 1 },
      });
      expect(stands[1]).toMatchObject({
        runs: 8,
        balls: 2,
        batter1: { name: "Bravo", runs: 4, balls: 1 },
        batter2: { name: "Charlie", runs: 2, balls: 1 },
      });
    });

    it("lists the side that batted first first and batters in batting order", () => {
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
      const r = buildMatchReport(
        {
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
        },
        "https://x.test/m",
      );
      expect(r.teams.map((t) => t.name)).toEqual(["Coastal Kings", "Royal Tigers"]);
      expect(r.innings[1]!.target).toBe(161);
      expect(r.innings[1]!.batters.map((b) => b.name)).toEqual([
        "Opener One",
        "Opener Two",
        "Fifth In",
      ]);
    });

    it("states only facts the match holds, in plain words", () => {
      const r = buildMatchReport(
        { ...sampleMatch, toss_winner_team_id: "t2", toss_decision: "bowl" },
        "https://x.test/m",
      );
      const text = JSON.stringify(r.info);
      for (const filler of [
        "11 Per Side",
        "Official League Umpires",
        "Standard Leather Ball",
        "Host Organiser",
        "Opted To",
      ]) {
        expect(text).not.toContain(filler);
      }
      expect(r.info.map((i) => i.label)).not.toContain("Umpires");
      expect(text).toContain("Coastal Kings won the toss and chose to bowl");
      const withScorer = buildMatchReport(
        { ...sampleMatch, umpire1_name: "A Umpire", scorer_name: "C Scorer" },
        "https://x.test/m",
      );
      expect(withScorer.signoff[2]).toEqual({
        role: "Lead match umpire",
        name: "A Umpire",
      });
      expect(withScorer.signoff[3]!.name).toBe("C Scorer");
    });

    it("includes super overs and marks a retired batter", () => {
      const r = buildMatchReport(
        {
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
        },
        "https://x.test/m",
      );
      const hurt = r.innings[0]!.batters.find((b) => b.name === "Hurt Batter");
      expect(hurt).toMatchObject({ dismissal: "retired hurt", notOut: false });
      expect(r.innings.filter((i) => i.heading === "Super over")).toHaveLength(2);
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
});
