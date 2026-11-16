import { describe, expect, it } from "vitest";
import {
  inSeason,
  seasonFigures,
  seasonsOf,
  type SeasonBatting,
  type SeasonBowling,
} from "./season-stats";

const bat = (
  match_id: string,
  runs_scored: number,
  balls_faced: number,
  is_out: boolean,
  created_at: string,
): SeasonBatting => ({ match_id, runs_scored, balls_faced, is_out, created_at });

const bowl = (
  match_id: string,
  balls_bowled: number,
  runs_conceded: number,
  wickets_taken: number,
  created_at: string,
): SeasonBowling => ({
  match_id,
  balls_bowled,
  runs_conceded,
  wickets_taken,
  created_at,
});

const batting = [
  bat("a", 104, 60, false, "2025-03-01T10:00:00Z"),
  bat("b", 52, 40, true, "2026-01-10T10:00:00Z"),
  bat("c", 8, 10, true, "2026-02-10T10:00:00Z"),
];
const bowling = [
  bowl("b", 24, 30, 5, "2026-01-10T10:00:00Z"),
  bowl("c", 12, 20, 0, "2026-02-10T10:00:00Z"),
];

describe("seasons", () => {
  it("lists the years with records, newest first", () => {
    expect(seasonsOf(batting, bowling)).toEqual([2026, 2025]);
  });

  it("falls back to the match's scheduled date", () => {
    expect(
      seasonsOf([{ match: { scheduled_at: "2024-06-01T00:00:00Z" } }], []),
    ).toEqual([2024]);
    expect(seasonsOf([{}], [])).toEqual([]);
  });

  it("keeps only the rows of a season", () => {
    expect(inSeason(batting, 2026).map((b) => b.match_id)).toEqual(["b", "c"]);
  });
});

describe("seasonFigures", () => {
  it("uses the career formulas over the season's rows", () => {
    const f = seasonFigures(inSeason(batting, 2026), inSeason(bowling, 2026));
    expect(f).toMatchObject({
      matches: 2,
      runs: 60,
      wickets: 5,
      average: 30,
      strikeRate: 120,
      halfCenturies: 1,
      centuries: 0,
      bowlingAverage: 10,
      economy: 8.33,
      fiveWickets: 1,
    });
  });

  it("has no averages without outs or wickets", () => {
    const f = seasonFigures(inSeason(batting, 2025), []);
    expect(f.average).toBeNull();
    expect(f.bowlingAverage).toBeNull();
    expect(f.centuries).toBe(1);
  });
});

describe("seasonFigures: the cards' figures", () => {
  it("counts innings, not outs, the highest score, balls and boundaries", () => {
    const f = seasonFigures(
      [
        { match_id: "m1", runs_scored: 28, balls_faced: 15, fours: 2, sixes: 2, is_out: true },
        { match_id: "m2", runs_scored: 28, balls_faced: 12, fours: 1, sixes: 3, is_out: false },
        { match_id: "m3", runs_scored: 4, balls_faced: 6, is_out: true },
      ],
      [],
    );
    expect(f.innings).toBe(3);
    expect(f.notOuts).toBe(1);
    // A not-out of the same score ranks above an out.
    expect(f.highest).toBe("28*");
    expect([f.balls, f.fours, f.sixes]).toEqual([33, 3, 5]);
  });

  it("finds the best figures (most wickets, then fewest runs) and the hauls", () => {
    const f = seasonFigures(
      [],
      [
        { match_id: "m1", balls_bowled: 12, runs_conceded: 20, wickets_taken: 3 },
        { match_id: "m2", balls_bowled: 12, runs_conceded: 11, wickets_taken: 3 },
        { match_id: "m3", balls_bowled: 8, runs_conceded: 9, wickets_taken: 1 },
      ],
    );
    expect(f.best).toBe("3/11");
    expect(f.overs).toBe("5.2");
    expect(f.threeWickets).toBe(2);
    expect(f.fiveWickets).toBe(0);
  });
});
