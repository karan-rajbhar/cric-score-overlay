import { describe, expect, it } from "vitest";
import { livePerformanceOf } from "./live-player";
import { buildLiveScorecard, type ScorecardSource } from "./live-scorecard";

function bat(user_id: string, extra: Record<string, unknown> = {}) {
  return {
    user_id,
    batting_position: 1,
    runs_scored: 0,
    balls_faced: 0,
    minutes_batted: 0,
    fours: 0,
    sixes: 0,
    is_out: false,
    dismissal_type: null,
    bowler_id: null,
    fielder_id: null,
    is_current_batsman: false,
    is_striker: false,
    ...extra,
  };
}

function bowl(user_id: string, extra: Record<string, unknown> = {}) {
  return {
    user_id,
    overs_bowled: 0,
    balls_bowled: 0,
    runs_conceded: 0,
    wickets_taken: 0,
    maidens: 0,
    wides: 0,
    no_balls: 0,
    is_current_bowler: false,
    ...extra,
  };
}

function innings(
  id: string,
  n: number,
  completed: boolean,
  batting: unknown[],
  bowling: unknown[],
): ScorecardSource {
  return {
    id,
    team_id: `team-${n}`,
    innings_number: n,
    total_runs: 0,
    total_wickets: 0,
    total_balls: 0,
    total_overs: 0,
    extras_total: 0,
    extras_byes: 0,
    extras_leg_byes: 0,
    extras_wides: 0,
    extras_no_balls: 0,
    extras_penalties: 0,
    extras_bonuses: 0,
    target_runs: null,
    is_completed: completed,
    batting,
    bowling,
    fall_of_wickets: [],
    partnerships: [],
  } as unknown as ScorecardSource;
}

const doc = buildLiveScorecard({
  matchId: "m1",
  innings: [
    // First innings (closed): already in player_matches, so left out.
    innings(
      "i1",
      1,
      true,
      [bat("p1", { runs_scored: 50, balls_faced: 30 })],
      [bowl("p2", { balls_bowled: 24, runs_conceded: 30, wickets_taken: 1 })],
    ),
    innings(
      "i2",
      2,
      false,
      [
        bat("p2", {
          runs_scored: 34,
          balls_faced: 21,
          fours: 4,
          sixes: 1,
          is_current_batsman: true,
        }),
        bat("p3", { runs_scored: 5, is_out: true, dismissal_type: "bowled" }),
      ],
      [
        bowl("p1", {
          overs_bowled: 3.2,
          balls_bowled: 20,
          runs_conceded: 18,
          wickets_taken: 2,
          is_current_bowler: true,
        }),
      ],
    ),
  ],
  nameOf: (id) => id.toUpperCase(),
  version: 1,
  now: "2026-10-17T00:00:00.000Z",
});

describe("livePerformanceOf", () => {
  it("returns the player's figures in the innings in progress", () => {
    expect(livePerformanceOf(doc, "p2")).toEqual({
      matchId: "m1",
      batting: [
        {
          inningsId: "i2",
          runs: 34,
          balls: 21,
          fours: 4,
          sixes: 1,
          isOut: false,
          dismissal: null,
          atCrease: true,
        },
      ],
      bowling: [],
    });
    expect(livePerformanceOf(doc, "p1")).toEqual({
      matchId: "m1",
      batting: [],
      bowling: [
        {
          inningsId: "i2",
          overs: "3.2",
          runs: 18,
          wickets: 2,
          maidens: 0,
          current: true,
        },
      ],
    });
    expect(livePerformanceOf(doc, "p3")?.batting[0]).toMatchObject({
      isOut: true,
      dismissal: "bowled",
      atCrease: false,
    });
  });

  it("is null for players with nothing in the current innings", () => {
    expect(livePerformanceOf(doc, "nobody")).toBeNull();
    const closed = { ...doc, innings: doc.innings.slice(0, 1) };
    expect(livePerformanceOf(closed, "p1")).toBeNull();
  });
});
