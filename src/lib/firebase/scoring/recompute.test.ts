import { describe, expect, it } from "vitest";
import { recomputeInnings, type BallInput } from "./recompute";
import { advanceAfterInnings, inningsLimits } from "./result";
import type { MatchesRow, InningsRow } from "../types";

const match = {
  id: "m1",
  balls_per_over: 6,
  max_balls_per_over: null,
  wide_runs_to_batsman: false,
  noball_extras_to_batsman: false,
  wide_counts_as_ball_faced: false,
};
const innings = { id: "i1", match_id: "m1" };
const NOW = "2024-07-01T00:00:00.000Z";

let seq = 0;
function ball(partial: Partial<BallInput>): BallInput {
  seq += 1;
  return {
    id: `b${seq}`,
    match_id: "m1",
    innings_id: "i1",
    over_number: 0,
    ball_number: 1,
    bowler_id: "bw1",
    batsman_id: "s",
    non_striker_id: "n",
    runs_scored: 0,
    extras: 0,
    extra_type: null,
    is_wicket: false,
    dismissal_type: null,
    fielder_id: null,
    dismissed_player_id: null,
    commentary: null,
    shot_zone: null,
    seq,
    ...partial,
  };
}

describe("recomputeInnings", () => {
  it("derives totals, strike rotation, extras and bowler figures from the ball log", () => {
    const balls = [
      ball({ runs_scored: 1 }),
      ball({ batsman_id: "n", non_striker_id: "s", runs_scored: 4 }),
      ball({
        batsman_id: "n",
        non_striker_id: "s",
        extras: 1,
        extra_type: "wide",
      }),
      ball({
        batsman_id: "n",
        non_striker_id: "s",
        extras: 2,
        extra_type: "bye",
      }),
      ball({ batsman_id: "n", non_striker_id: "s", runs_scored: 6 }),
    ];
    const out = recomputeInnings({
      match,
      innings,
      balls,
      existingBatting: [],
      existingBowling: [],
      now: NOW,
    });

    expect(out.inningsPatch).toMatchObject({
      total_runs: 14,
      total_wickets: 0,
      total_balls: 4,
      total_overs: 0.4,
      extras_wides: 1,
      extras_byes: 2,
      extras_total: 3,
    });
    expect(out.matchPatch).toEqual({ current_over: 0, current_ball: 4 });

    const s = out.batting.find((b) => b.user_id === "s")!;
    const n = out.batting.find((b) => b.user_id === "n")!;
    expect(s).toMatchObject({
      runs_scored: 1,
      balls_faced: 1,
      batting_position: 1,
      is_current_batsman: true,
      is_striker: false,
    });
    expect(n).toMatchObject({
      runs_scored: 10,
      balls_faced: 3,
      fours: 1,
      sixes: 1,
      is_striker: true,
    });

    const bw = out.bowling[0]!;
    expect(bw).toMatchObject({
      balls_bowled: 4,
      runs_conceded: 12,
      wides: 1,
      overs_bowled: 0.4,
      is_current_bowler: true,
    });
    expect(out.partnerships).toHaveLength(1);
    expect(out.partnerships[0]).toMatchObject({
      runs: 14,
      balls: 4,
      is_current: true,
    });
  });

  it("records wickets, fall of wickets and closes partnerships; retired hurt is not out", () => {
    const balls = [
      ball({ runs_scored: 2 }),
      ball({ is_wicket: true, dismissal_type: "bowled" }),
      ball({
        batsman_id: "x",
        non_striker_id: "n",
        is_wicket: true,
        dismissal_type: "retired_hurt",
      }),
    ];
    const out = recomputeInnings({
      match,
      innings,
      balls,
      existingBatting: [],
      existingBowling: [],
      now: NOW,
    });

    expect(out.inningsPatch.total_wickets).toBe(1);
    expect(out.fallOfWickets).toHaveLength(1);
    expect(out.fallOfWickets[0]).toMatchObject({
      wicket_number: 1,
      runs_at_fall: 2,
      batsman_out_id: "s",
      overs_at_fall: 0.2,
    });
    expect(out.batting.find((b) => b.user_id === "s")).toMatchObject({
      is_out: true,
      dismissal_type: "bowled",
      is_current_batsman: false,
    });
    expect(out.batting.find((b) => b.user_id === "x")).toMatchObject({
      is_out: false,
      dismissal_type: "retired_hurt",
      is_current_batsman: false,
    });
    expect(out.bowling[0]!.wickets_taken).toBe(1);
    expect(out.partnerships.map((p) => p.is_current)).toEqual([false, false]);
    expect(out.partnerships[0]!.wicket_number).toBe(1);
  });

  it("swaps strike and clears the bowler at the end of an over, crediting maidens", () => {
    const balls = Array.from({ length: 6 }, (_, i) =>
      ball({ ball_number: i + 1 }),
    );
    const out = recomputeInnings({
      match,
      innings,
      balls,
      existingBatting: [],
      existingBowling: [],
      now: NOW,
    });

    expect(out.overJustEnded).toBe(true);
    expect(out.matchPatch).toEqual({ current_over: 1, current_ball: 0 });
    expect(out.batting.find((b) => b.user_id === "n")!.is_striker).toBe(true);
    expect(out.bowling[0]).toMatchObject({
      maidens: 1,
      overs_bowled: 1,
      is_current_bowler: false,
    });
  });
});

describe("advanceAfterInnings", () => {
  const baseMatch = {
    id: "m1",
    team1_id: "t1",
    team2_id: "t2",
    overs_per_innings: 20,
    balls_per_over: 6,
    wickets_per_innings: 10,
  } as unknown as MatchesRow;
  const first = {
    id: "i1",
    match_id: "m1",
    team_id: "t1",
    innings_number: 1,
    total_runs: 150,
    total_wickets: 7,
    is_completed: false,
  } as InningsRow;

  it("sets up the chase after the first innings", () => {
    const out = advanceAfterInnings(
      {
        match: baseMatch,
        completed: first,
        allInnings: [first],
        teamNames: {},
        now: NOW,
      },
      "i2",
    );
    expect(out.nextInnings).toMatchObject({
      id: "i2",
      team_id: "t2",
      innings_number: 2,
      target_runs: 151,
    });
    expect(out.matchPatch).toMatchObject({
      current_innings: 2,
      current_over: 0,
      current_ball: 0,
    });
    expect(out.matchPatch.status).toBeUndefined();
  });

  it("names the winner with the correct margin", () => {
    const second = {
      ...first,
      id: "i2",
      team_id: "t2",
      innings_number: 2,
      total_runs: 151,
      total_wickets: 4,
    } as InningsRow;
    const out = advanceAfterInnings(
      {
        match: baseMatch,
        completed: second,
        allInnings: [first, second],
        teamNames: { t1: "Tigers", t2: "Kings" },
        now: NOW,
      },
      "x",
    );
    expect(out.matchPatch).toMatchObject({
      status: "completed",
      winning_team_id: "t2",
      win_margin: 6,
      win_margin_type: "wickets",
      result_description: "Kings won by 6 wickets",
    });

    const defended = { ...second, total_runs: 140 } as InningsRow;
    const out2 = advanceAfterInnings(
      {
        match: baseMatch,
        completed: defended,
        allInnings: [first, defended],
        teamNames: { t1: "Tigers", t2: "Kings" },
        now: NOW,
      },
      "x",
    );
    expect(out2.matchPatch).toMatchObject({
      winning_team_id: "t1",
      win_margin: 10,
      result_description: "Tigers won by 10 runs",
    });

    const tied = { ...second, total_runs: 150 } as InningsRow;
    const out3 = advanceAfterInnings(
      {
        match: baseMatch,
        completed: tied,
        allInnings: [first, tied],
        teamNames: {},
        now: NOW,
      },
      "x",
    );
    expect(out3.matchPatch).toMatchObject({
      result_type: "tie",
      winning_team_id: null,
      result_description: "Match tied",
    });
  });

  it("limits super overs to one over and two wickets", () => {
    expect(inningsLimits(baseMatch, 1)).toEqual({
      maxBalls: 120,
      wicketsCap: 10,
      ballsPerOver: 6,
    });
    expect(inningsLimits(baseMatch, 3)).toEqual({
      maxBalls: 6,
      wicketsCap: 2,
      ballsPerOver: 6,
    });
  });
});
