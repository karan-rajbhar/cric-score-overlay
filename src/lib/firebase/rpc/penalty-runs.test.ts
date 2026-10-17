/**
 * Penalty runs awarded to the fielding side (Law 41.17) through
 * `award_penalty_runs` with `p_team_id`: added to that team's latest
 * innings (raising the current target) or, when they have not batted yet,
 * credited to their upcoming innings. Totals, live_state and
 * live_scorecard follow, and undo / recompute stay consistent with the
 * ball log.
 */

import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { liveScorecardView, type LiveScorecardDoc } from "../live-scorecard";
import type { LiveStateDoc } from "../live-state";
import { ballLogOf, type OversRow } from "../scorecard";
import {
  GoldenReplay,
  SYNTHETIC_ROSTERS,
  syntheticTables,
} from "../scoring/__fixtures__/golden";
import { logicalMatch } from "../scoring/__fixtures__/legacy";
import { stage2Driver, type Stage2Side } from "../scoring/__fixtures__/stage2";
import { recomputeInnings } from "../scoring/recompute";
import type { InningsRow, MatchesRow } from "../types";
import { awardPenaltyRuns, recomputeInningsRpc, undoLastBall } from "./scoring";

function setup(incremental: boolean) {
  const side = stage2Driver(
    syntheticTables({ overs_per_innings: 1 }),
    incremental,
  );
  const replay = new GoldenReplay(side, "M", SYNTHETIC_ROSTERS);
  return { side, replay };
}

const innings = (side: Stage2Side, n: number) =>
  side.ds.all("innings").find((i) => i.innings_number === n) as unknown as
    | InningsRow
    | undefined;
/** The match with its position (derived from the current innings). */
const match = (side: Stage2Side) =>
  logicalMatch(
    side.ds.all("matches").find((m) => m.id === "M")!,
    side.ds.all("innings"),
  ) as unknown as MatchesRow;
const live = (side: Stage2Side) =>
  side.ds
    .all("live_state")
    .find((d) => d.id === "M") as unknown as LiveStateDoc;
/** An innings total as the live scorecard shows it. */
const cardTotal = (side: Stage2Side, n: number) => {
  const doc = side.ds
    .all("live_scorecard")
    .find((d) => d.id === "M") as unknown as LiveScorecardDoc;
  return liveScorecardView(doc).innings.find((i) => i.innings_number === n)
    ?.total_runs;
};

/** Every innings' stored totals equal a fresh recompute of its ball log. */
function expectConsistent(side: Stage2Side) {
  const m = match(side);
  for (const inn of side.ds.all("innings") as unknown as InningsRow[]) {
    const overs = side.ds
      .all("overs")
      .filter((o) => o.innings_id === inn.id) as unknown as OversRow[];
    const out = recomputeInnings({
      match: m,
      innings: inn,
      balls: ballLogOf(overs),
      existingBatting: [],
      existingBowling: [],
      now: "x",
    });
    for (const k of ["total_runs", "extras_total", "extras_penalties"] as const)
      expect(inn[k]).toBe(out.inningsPatch[k]);
  }
}

const award = (side: Stage2Side, teamId: string, runs = 5) =>
  awardPenaltyRuns(side.ctx, {
    p_match_id: "M",
    p_runs: runs,
    p_type: "penalty",
    p_reason: "fake fielding",
    p_team_id: teamId,
  });

describe.each([true, false])(
  "penalty runs to the fielding side (incremental: %s)",
  (incremental) => {
    it("credits a side that has not batted yet to its upcoming innings", async () => {
      const { side, replay } = setup(incremental);
      for (let i = 0; i < 3; i += 1)
        await replay.step({ kind: "ball", ball: { runs: 1 } });
      const before = innings(side, 1)!;
      expect(before.total_runs).toBe(3);

      // TA bats innings 1; TB (fielding) has not batted.
      await award(side, "TB");
      expect(innings(side, 1)!.total_runs).toBe(3);
      expect(innings(side, 1)!.extras_penalties).toBe(0);
      expect(live(side).total_runs).toBe(3);
      expect(match(side)).toMatchObject({ current_over: 0, current_ball: 3 });
      expectConsistent(side);

      // Finish innings 1: innings 2 starts on 5 (penalty extras), chasing 7.
      for (let i = 0; i < 3; i += 1)
        await replay.step({ kind: "ball", ball: { runs: 1 } });
      const second = innings(side, 2)!;
      expect(second).toMatchObject({
        team_id: "TB",
        total_runs: 5,
        extras_penalties: 5,
        extras_total: 5,
        total_balls: 0,
        target_runs: 7,
      });
      expect(live(side)).toMatchObject({
        innings_number: 2,
        total_runs: 5,
        runs_needed: 2,
        this_over_balls: null,
      });
      expect(cardTotal(side, 2)).toBe(5);
      expectConsistent(side);

      // Scoring in innings 2 builds on the credit.
      await replay.step({ kind: "ball", ball: { runs: 1 } });
      expect(innings(side, 2)!.total_runs).toBe(6);
      expect(live(side)).toMatchObject({ total_runs: 6, runs_needed: 1 });
      expectConsistent(side);

      // Undo the innings 2 ball, then the ball that closed innings 1: the
      // credit goes with innings 2 and comes back when it starts again.
      await undoLastBall(side.ctx, "M");
      expect(innings(side, 2)!.total_runs).toBe(5);
      await undoLastBall(side.ctx, "M");
      expect(innings(side, 2)).toBeUndefined();
      expect(match(side).current_innings).toBe(1);
      await replay.step({ kind: "ball", ball: { runs: 1 } });
      expect(innings(side, 2)!.total_runs).toBe(5);
      expectConsistent(side);
    });

    it("undoing the award before the innings ends drops the credit", async () => {
      const { side, replay } = setup(incremental);
      await replay.step({ kind: "ball", ball: { runs: 2 } });
      await award(side, "TB");
      await undoLastBall(side.ctx, "M");
      expect(innings(side, 1)!.total_runs).toBe(2);
      for (let i = 0; i < 5; i += 1)
        await replay.step({ kind: "ball", ball: { runs: 0 } });
      expect(innings(side, 2)).toMatchObject({ total_runs: 0, target_runs: 3 });
      expectConsistent(side);
    });

    it("undo after a declaration removes the award and reopens the innings", async () => {
      const { side, replay } = setup(incremental);
      await replay.step({ kind: "ball", ball: { runs: 2 } });
      await award(side, "TB");
      await replay.step({ kind: "end_innings" });
      expect(innings(side, 2)).toMatchObject({ total_runs: 5, target_runs: 3 });
      // The carried copy shares the award's seq; undo takes the original.
      await undoLastBall(side.ctx, "M");
      expect(innings(side, 2)).toBeUndefined();
      expect(innings(side, 1)).toMatchObject({
        total_runs: 2,
        is_completed: false,
      });
      expect(side.ds.all("overs").every((o) => o.innings_id === "INN1")).toBe(
        true,
      );
      expectConsistent(side);
    });

    it("adds to the latest innings of a side that has batted and raises the target", async () => {
      const { side, replay } = setup(incremental);
      for (let i = 0; i < 6; i += 1)
        await replay.step({ kind: "ball", ball: { runs: 1 } });
      await replay.step({ kind: "ball", ball: { runs: 2 } });
      expect(innings(side, 2)).toMatchObject({ total_runs: 2, target_runs: 7 });
      const liveBefore = live(side);
      expect(liveBefore.runs_needed).toBe(5);

      // TB bats innings 2; TA (fielding) batted innings 1.
      await award(side, "TA");
      expect(innings(side, 1)).toMatchObject({
        total_runs: 11,
        extras_penalties: 5,
        is_completed: true,
      });
      expect(innings(side, 2)).toMatchObject({
        total_runs: 2,
        target_runs: 12,
        is_completed: false,
      });
      expect(match(side)).toMatchObject({
        current_innings: 2,
        current_over: 0,
        current_ball: 1,
      });
      expect(live(side)).toMatchObject({
        innings_number: 2,
        total_runs: 2,
        target_runs: 12,
        runs_needed: 10,
        striker_name: liveBefore.striker_name,
        this_over_balls: liveBefore.this_over_balls,
      });
      expect(cardTotal(side, 1)).toBe(11);
      expect(
        (match(side).innings_summary ?? []).find((s) => s.innings_number === 1)
          ?.total_runs,
      ).toBe(11);
      expectConsistent(side);

      // A recompute of innings 1 keeps the award (it is in the ball log).
      await recomputeInningsRpc(side.ctx, innings(side, 1)!.id);
      expect(innings(side, 1)!.total_runs).toBe(11);

      // Scoring continues against the raised target.
      await replay.step({ kind: "ball", ball: { runs: 4 } });
      expect(live(side)).toMatchObject({ total_runs: 6, runs_needed: 6 });

      // Undo the ball, then the award: innings 1 and the target go back,
      // innings 2 stays current with its first ball.
      await undoLastBall(side.ctx, "M");
      await undoLastBall(side.ctx, "M");
      expect(innings(side, 1)).toMatchObject({
        total_runs: 6,
        extras_penalties: 0,
        is_completed: true,
      });
      expect(innings(side, 2)).toMatchObject({ total_runs: 2, target_runs: 7 });
      expect(match(side)).toMatchObject({
        current_innings: 2,
        current_over: 0,
        current_ball: 1,
      });
      expect(live(side)).toMatchObject({ total_runs: 2, runs_needed: 5 });
      expectConsistent(side);
    });

    it("still credits the batting side at the crease", async () => {
      const { side, replay } = setup(incremental);
      await replay.step({ kind: "ball", ball: { runs: 1 } });
      await award(side, "TA");
      expect(innings(side, 1)).toMatchObject({
        total_runs: 6,
        extras_penalties: 5,
      });
      await expect(award(side, "nobody")).rejects.toThrow();
    });
  },
);
