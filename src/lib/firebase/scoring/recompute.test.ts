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

  it("splits each stand between its batters as the batting card credits them", () => {
    const balls = [
      ball({ runs_scored: 1 }),
      ball({ batsman_id: "n", non_striker_id: "s", runs_scored: 4 }),
      // Extras: in the stand, not in either batter's share; a wide is not
      // a ball faced, a bye is.
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
      // A no-ball's bat runs are the batter's (not a legal ball).
      ball({
        batsman_id: "n",
        non_striker_id: "s",
        runs_scored: 2,
        extras: 1,
        extra_type: "no_ball",
      }),
      ball({
        batsman_id: "n",
        non_striker_id: "s",
        is_wicket: true,
        dismissal_type: "bowled",
        dismissed_player_id: "n",
      }),
      ball({ batsman_id: "c", non_striker_id: "s", runs_scored: 6 }),
    ];
    const out = recomputeInnings({
      match,
      innings,
      balls,
      existingBatting: [],
      existingBowling: [],
      now: NOW,
    });
    const [first, second] = out.partnerships;
    expect(first).toMatchObject({
      batsman1_id: "s",
      batsman2_id: "n",
      runs: 11,
      balls: 4,
      batsman1_runs: 1,
      batsman1_balls: 1,
      batsman2_runs: 6,
      batsman2_balls: 3,
      wicket_number: 1,
    });
    // The shares and the extras make up the stand, and agree with the card.
    const n = out.batting.find((b) => b.user_id === "n")!;
    expect(n).toMatchObject({ runs_scored: 6, balls_faced: 3 });
    expect(second).toMatchObject({
      batsman1_id: "c",
      batsman2_id: "s",
      batsman1_runs: 6,
      batsman1_balls: 1,
      batsman2_runs: 0,
      batsman2_balls: 0,
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

describe("recomputeInnings keeps the scorer's choices since the last ball", () => {
  const batter = (
    id: string,
    pos: number,
    current = false,
    striker = false,
  ) => ({
    id: `i1_${id}`,
    match_id: "m1",
    innings_id: "i1",
    user_id: id,
    batting_position: pos,
    runs_scored: 0,
    balls_faced: 0,
    minutes_batted: 0,
    fours: 0,
    sixes: 0,
    is_out: false,
    dismissal_type: null,
    bowler_id: null,
    fielder_id: null,
    is_current_batsman: current,
    is_striker: striker,
    created_at: null,
    updated_at: null,
  });
  const bowlerRow = (id: string, current = false) => ({
    id: `i1_${id}`,
    match_id: "m1",
    innings_id: "i1",
    user_id: id,
    overs_bowled: 0,
    balls_bowled: 0,
    runs_conceded: 0,
    wickets_taken: 0,
    maidens: 0,
    wides: 0,
    no_balls: 0,
    is_current_bowler: current,
    created_at: null,
    updated_at: null,
  });
  const run = (
    balls: BallInput[],
    existingBatting: ReturnType<typeof batter>[],
    existingBowling: ReturnType<typeof bowlerRow>[],
  ) =>
    recomputeInnings({
      match,
      innings,
      balls,
      existingBatting,
      existingBowling,
      now: NOW,
    });
  const current = (out: ReturnType<typeof run>) => ({
    striker:
      out.batting.find((b) => b.is_current_batsman && b.is_striker)?.user_id ??
      null,
    nonStriker:
      out.batting.find((b) => b.is_current_batsman && !b.is_striker)?.user_id ??
      null,
    bowler: out.bowling.find((b) => b.is_current_bowler)?.user_id ?? null,
  });

  it("keeps the openers and the bowler when no ball is left (an innings' first ball undone)", () => {
    const out = run(
      [],
      [batter("s", 1, true, true), batter("n", 2, true)],
      [bowlerRow("bw1", true)],
    );
    expect(current(out)).toEqual({
      striker: "s",
      nonStriker: "n",
      bowler: "bw1",
    });
  });

  it("keeps the next over's bowler when that over's first ball is undone", () => {
    const over = Array.from({ length: 6 }, (_, i) =>
      ball({ ball_number: i + 1, batsman_id: "s", non_striker_id: "n" }),
    );
    const out = run(
      over,
      [batter("s", 1), batter("n", 2, true, true)],
      [bowlerRow("bw1"), bowlerRow("bw2", true)],
    );
    expect(current(out).bowler).toBe("bw2");
    // Not the bowler of the over that just ended.
    const same = run(
      over,
      [batter("s", 1), batter("n", 2, true, true)],
      [bowlerRow("bw1", true)],
    );
    expect(current(same).bowler).toBeNull();
  });

  it("keeps the new batter after a wicket, but not someone the log sent off", () => {
    const wicket = ball({
      is_wicket: true,
      dismissal_type: "bowled",
      dismissed_player_id: "s",
    });
    const out = run(
      [wicket],
      [batter("s", 1), batter("n", 2, true), batter("c", 3, true, true)],
      [bowlerRow("bw1", true)],
    );
    expect(current(out)).toMatchObject({ striker: "c", nonStriker: "n" });

    // A retirement in the log empties that end; the retiree stays off.
    const retired = ball({
      runs_scored: 0,
      is_wicket: true,
      dismissal_type: "retired_hurt",
      dismissed_player_id: "s",
    });
    const off = run(
      [retired],
      [batter("s", 1, true, true), batter("n", 2, true)],
      [bowlerRow("bw1", true)],
    );
    expect(current(off).striker).toBeNull();
  });

  it("keeps a retired-hurt batter brought back, who is no longer retired once they bat", () => {
    const log = [
      ball({ runs_scored: 2 }),
      ball({
        bowler_id: null,
        is_wicket: true,
        dismissal_type: "retired_hurt",
        dismissed_player_id: "s",
      }),
      ball({ batsman_id: "c", is_wicket: true, dismissal_type: "bowled" }),
    ];
    // Brought back after c's wicket (stored still marked retired hurt), then
    // an edit recomputes the innings before they face a ball.
    const back = {
      ...batter("s", 1, true, true),
      dismissal_type: "retired_hurt",
    } as unknown as ReturnType<typeof batter>;
    const out = run(
      log,
      [back, batter("n", 2, true), batter("c", 3)],
      [bowlerRow("bw1", true)],
    );
    expect(current(out)).toMatchObject({ striker: "s", nonStriker: "n" });

    // Retired hurt again by the log's last entry: off.
    const again = run(
      [
        ...log,
        ball({
          bowler_id: null,
          is_wicket: true,
          dismissal_type: "retired_hurt",
          dismissed_player_id: "s",
        }),
      ],
      [back, batter("n", 2, true), batter("c", 3)],
      [bowlerRow("bw1", true)],
    );
    expect(current(again).striker).toBeNull();

    // Once they bat again, the retirement no longer stands.
    const batted = run(
      [...log, ball({ runs_scored: 1 })],
      [back, batter("n", 2, true), batter("c", 3)],
      [bowlerRow("bw1", true)],
    );
    expect(batted.batting.find((b) => b.user_id === "s")).toMatchObject({
      runs_scored: 3,
      is_out: false,
      dismissal_type: null,
    });
  });

  it("drops a batter or bowler with nothing recorded who is no longer in", () => {
    // The wicket was undone: the batter who came in for it is not needed.
    const out = run(
      [ball({ runs_scored: 1 })],
      [batter("s", 1), batter("n", 2), batter("c", 3)],
      [bowlerRow("bw1"), bowlerRow("bw9")],
    );
    expect(out.batting.map((b) => b.user_id).sort()).toEqual(["n", "s"]);
    expect(out.bowling.map((b) => b.user_id)).toEqual(["bw1"]);
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

  it("judges a chase against its revised target", () => {
    // 150 first, then rain: 121 to win from fewer overs.
    const chase = (runs: number, wickets = 3) =>
      ({
        ...first,
        id: "i2",
        team_id: "t2",
        innings_number: 2,
        total_runs: runs,
        total_wickets: wickets,
        target_runs: 121,
      }) as InningsRow;
    const result = (inn: InningsRow) =>
      advanceAfterInnings(
        {
          match: baseMatch,
          completed: inn,
          allInnings: [first, inn],
          teamNames: { t1: "Tigers", t2: "Kings" },
          now: NOW,
        },
        "x",
      ).matchPatch;

    // Reached the revised target, though short of the first innings.
    expect(result(chase(123))).toMatchObject({
      winning_team_id: "t2",
      win_margin_type: "wickets",
      win_margin: 7,
      result_description: "Kings won by 7 wickets (revised target)",
    });
    // Short of it: the margin is from the revised target, not from 150.
    expect(result(chase(110, 9))).toMatchObject({
      winning_team_id: "t1",
      win_margin_type: "runs",
      win_margin: 10,
      result_description: "Tigers won by 10 runs (revised target)",
    });
    expect(result(chase(120))).toMatchObject({
      result_type: "tie",
      result_description: "Match tied",
    });
  });

  it("counts wickets in hand from the chasing side's squad", () => {
    const chase = {
      ...first,
      id: "i2",
      team_id: "t2",
      innings_number: 2,
      total_runs: 151,
      total_wickets: 3,
      target_runs: 151,
    } as InningsRow;
    const result = (squad: number | null, lastManStands = false) =>
      advanceAfterInnings(
        {
          match: { ...baseMatch, last_man_stands: lastManStands } as MatchesRow,
          completed: chase,
          allInnings: [first, chase],
          teamNames: { t2: "Kings" },
          now: NOW,
          chaseSquadSize: squad,
        },
        "x",
      ).matchPatch;
    // Eight players, three down: four wickets in hand.
    expect(result(8)).toMatchObject({
      win_margin: 4,
      result_description: "Kings won by 4 wickets",
    });
    // Last man stands: the last batter bats on, so one more.
    expect(result(8, true)).toMatchObject({ win_margin: 5 });
    // A full squad, or none known: the match's limit.
    expect(result(15)).toMatchObject({ win_margin: 7 });
    expect(result(null)).toMatchObject({ win_margin: 7 });
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
