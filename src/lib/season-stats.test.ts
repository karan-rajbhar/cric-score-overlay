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
