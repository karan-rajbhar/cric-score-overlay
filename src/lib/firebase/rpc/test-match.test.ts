/**
 * A Test (two innings a side) through the scoring engine: no target until
 * the fourth innings, declarations, the follow-on, a win by an innings, the
 * chase, a draw, and no super over after a tie. Each step runs the real
 * procedures on the in-memory documents.
 */

import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  GoldenReplay,
  SYNTHETIC_ROSTERS,
  syntheticTables,
  type BallSpec,
} from "../scoring/__fixtures__/golden";
import { stage2Driver } from "../scoring/__fixtures__/stage2";
import type { InningsRow, MatchesRow } from "../types";
import {
  drawMatch,
  endInnings,
  setFollowOn,
  startSuperOver,
  undoLastBall,
} from "./scoring";

/** A Test of `days` days with two wickets an innings, so sides are out fast. */
function setup(days = 5) {
  const side = stage2Driver(
    syntheticTables({
      match_format: "Test",
      innings_per_side: 2,
      overs_per_innings: null,
      days,
      current_day: 1,
      wickets_per_innings: 2,
    }),
    true,
  );
  const replay = new GoldenReplay(side, "M", SYNTHETIC_ROSTERS);
  const match = () =>
    side.ds.all("matches").find((m) => m.id === "M") as unknown as MatchesRow;
  const innings = (n: number) =>
    (side.ds.all("innings") as unknown as InningsRow[]).find(
      (i) => i.innings_number === n,
    );
  const balls = async (n: number, spec: BallSpec) => {
    for (let i = 0; i < n; i += 1) await replay.step({ kind: "ball", ball: spec });
  };
  /** Two wickets: the side is all out. */
  const allOut = () => balls(2, { wicket: "bowled" });
  return { side, replay, match, innings, balls, allOut, ctx: side.ctx };
}

describe("a Test", () => {
  it("plays on past the overs a limited-overs match would stop at", async () => {
    const t = setup();
    // 40 overs of singles: a T20's quota twice over.
    await t.balls(240, { runs: 1 });
    expect(t.match()).toMatchObject({ status: "live", current_innings: 1 });
    expect(t.innings(1)).toMatchObject({ total_runs: 240, is_completed: false });
  });

  it("gives the second innings no target and the third to the side that batted first", async () => {
    const t = setup();
    await t.balls(4, { runs: 4 });
    await t.allOut();
    expect(t.innings(2)).toMatchObject({ team_id: "TB", target_runs: null });
    await t.balls(6, { runs: 4 });
    await t.allOut();
    expect(t.innings(3)).toMatchObject({ team_id: "TA", target_runs: null });
    expect(t.match()).toMatchObject({ status: "live", current_innings: 3 });
  });

  it("marks a declaration, which opens the next innings", async () => {
    const t = setup();
    await t.balls(5, { runs: 4 });
    await endInnings(t.ctx, "M", 1, true);
    expect(t.innings(1)).toMatchObject({
      is_completed: true,
      declared: true,
      total_runs: 20,
    });
    expect(t.innings(2)).toMatchObject({ team_id: "TB", target_runs: null });
    // The summary carries the declaration for cards and lists.
    expect(t.match().innings_summary?.[0]).toMatchObject({ declared: true });
  });

  it("enforces the follow-on and ends in a win by an innings", async () => {
    // One day: the follow-on needs a lead of 75.
    const t = setup(1);
    await t.balls(20, { runs: 4 }); // 80
    await endInnings(t.ctx, "M", 1, true);
    await t.allOut(); // Bravo 0 all out: 80 behind
    expect(t.innings(3)?.team_id).toBe("TA");

    await setFollowOn(t.ctx, "M", true);
    expect(t.innings(3)).toMatchObject({ team_id: "TB", follow_on: true });

    await t.balls(10, { runs: 1 }); // Bravo 10 in their second innings
    await t.allOut();
    expect(t.match()).toMatchObject({
      status: "completed",
      result_type: "win",
      winning_team_id: "TA",
      win_margin_type: "innings",
      win_margin: 70,
      result_description: "Alpha won by an innings and 70 runs",
    });
    expect(t.innings(4)).toBeUndefined();

    // Undo takes back the last wicket: the match is on again.
    await undoLastBall(t.ctx, "M");
    expect(t.match()).toMatchObject({ status: "live", current_innings: 3 });
    expect(t.innings(3)).toMatchObject({ is_completed: false, follow_on: true });
  });

  it("refuses the follow-on short of the lead or once the third innings has started", async () => {
    const t = setup(5); // needs 200
    await t.balls(20, { runs: 4 });
    await t.allOut();
    await t.allOut();
    await expect(setFollowOn(t.ctx, "M", true)).rejects.toThrow(
      "follow_on_unavailable",
    );

    const u = setup(1);
    await u.balls(20, { runs: 4 });
    await u.allOut();
    await u.allOut();
    await u.balls(1, { runs: 1 });
    await expect(setFollowOn(u.ctx, "M", true)).rejects.toThrow(
      "follow_on_unavailable",
    );
  });

  it("sets the chase after the third innings and wins it by wickets", async () => {
    const t = setup();
    await t.balls(4, { runs: 4 }); // Alpha 16
    await t.allOut();
    await t.balls(6, { runs: 4 }); // Bravo 24
    await t.allOut();
    await t.balls(5, { runs: 4 }); // Alpha 20: 36 against 24
    await t.allOut();
    expect(t.innings(4)).toMatchObject({ team_id: "TB", target_runs: 13 });

    await t.balls(4, { runs: 4 }); // 16 passes 13
    expect(t.match()).toMatchObject({
      status: "completed",
      winning_team_id: "TB",
      win_margin_type: "wickets",
      result_description: "Bravo won by 2 wickets",
    });
  });

  it("wins by runs when the side batting last is all out short", async () => {
    const t = setup();
    await t.balls(4, { runs: 4 }); // Alpha 16
    await t.allOut();
    await t.balls(6, { runs: 4 }); // Bravo 24
    await t.allOut();
    await t.balls(5, { runs: 4 }); // Alpha 36 in all: target 13
    await t.allOut();
    await t.balls(2, { runs: 4 }); // 8
    await t.allOut();
    expect(t.match()).toMatchObject({
      status: "completed",
      winning_team_id: "TA",
      win_margin_type: "runs",
      win_margin: 4,
      result_description: "Alpha won by 4 runs",
    });
  });

  it("ends as a draw when time runs out, the innings in play counting", async () => {
    const t = setup();
    await t.balls(4, { runs: 4 });
    await t.allOut();
    await t.balls(6, { runs: 4 });
    await t.allOut();
    await t.balls(5, { runs: 4 });
    await t.allOut();
    await t.balls(1, { runs: 4 }); // Bravo 4 of 13
    await drawMatch(t.ctx, "M");
    expect(t.match()).toMatchObject({
      status: "completed",
      result_type: "draw",
      winning_team_id: null,
      result_description: "Match drawn",
    });
    expect(t.innings(4)).toMatchObject({ is_completed: true, total_runs: 4 });
    // The not-out batter's innings is in the records.
    const records = t.side.ds
      .all("player_matches")
      .filter((d) => d.match_id === "M");
    expect(records.length).toBeGreaterThan(0);
  });

  it("drops an innings opened but not started when drawn", async () => {
    const t = setup();
    await t.balls(4, { runs: 4 });
    await t.allOut();
    await drawMatch(t.ctx, "M");
    expect(t.innings(2)).toBeUndefined();
    expect(t.match()).toMatchObject({
      status: "completed",
      result_type: "draw",
      current_innings: 1,
    });
  });

  it("starts no super over after a tie", async () => {
    const t = setup();
    await t.balls(4, { runs: 4 }); // Alpha 16
    await t.allOut();
    await t.balls(4, { runs: 4 }); // Bravo 16
    await t.allOut();
    await t.balls(2, { runs: 4 }); // Alpha 24: target 9
    await t.allOut();
    await t.balls(2, { runs: 4 }); // Bravo 8
    await t.allOut();
    expect(t.match()).toMatchObject({ status: "completed", result_type: "tie" });
    await expect(startSuperOver(t.ctx, "M")).rejects.toThrow(
      "super_over_needs_tie",
    );
  });
});

describe("a limited-overs match", () => {
  it("cannot be drawn", async () => {
    const side = stage2Driver(syntheticTables({ overs_per_innings: 1 }), true);
    await expect(drawMatch(side.ctx, "M")).rejects.toThrow(
      "draw_needs_two_innings",
    );
  });

  it("ignores a declaration: End innings ends it as before", async () => {
    const side = stage2Driver(syntheticTables({ overs_per_innings: 2 }), true);
    const replay = new GoldenReplay(side, "M", SYNTHETIC_ROSTERS);
    await replay.step({ kind: "ball", ball: { runs: 4 } });
    await endInnings(side.ctx, "M", 1, true);
    const first = (side.ds.all("innings") as unknown as InningsRow[]).find(
      (i) => i.innings_number === 1,
    );
    expect(first?.declared).toBeUndefined();
    const second = (side.ds.all("innings") as unknown as InningsRow[]).find(
      (i) => i.innings_number === 2,
    );
    expect(second?.target_runs).toBe(5);
  });
});
