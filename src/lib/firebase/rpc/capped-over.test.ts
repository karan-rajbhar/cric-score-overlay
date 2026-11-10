/**
 * A cap on deliveries per over (`max_balls_per_over`, e.g. ECB junior: 8):
 * an over that reaches it ends there and counts as a complete over, for
 * the innings and for its bowler.
 */

import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  GoldenReplay,
  SYNTHETIC_ROSTERS,
  syntheticTables,
} from "../scoring/__fixtures__/golden";
import { logicalMatch } from "../scoring/__fixtures__/legacy";
import { stage2Driver } from "../scoring/__fixtures__/stage2";
import type { OversRow } from "../scorecard";
import type { InningsRow } from "../types";

async function cappedOver(incremental: boolean, overs: number) {
  const side = stage2Driver(
    syntheticTables({ max_balls_per_over: 8, overs_per_innings: overs }),
    incremental,
  );
  const replay = new GoldenReplay(side, "M", SYNTHETIC_ROSTERS);
  for (let i = 0; i < 4; i += 1)
    await replay.step({
      kind: "ball",
      ball: { extras: 1, extraType: "wide" },
    });
  for (let i = 0; i < 4; i += 1)
    await replay.step({ kind: "ball", ball: { runs: 0 } });
  const innings = (n = 1) =>
    (side.ds.all("innings") as unknown as InningsRow[]).find(
      (i) => i.innings_number === n,
    );
  const crease = () => {
    const inn = innings()!;
    const at = (inn.batting ?? []).filter((b) => b.is_current_batsman);
    return {
      striker: at.find((b) => b.is_striker)?.user_id ?? null,
      nonStriker: at.find((b) => !b.is_striker)?.user_id ?? null,
      bowler:
        (inn.bowling ?? []).find((b) => b.is_current_bowler)?.user_id ?? null,
    };
  };
  const position = () =>
    logicalMatch(side.ds.all("matches")[0]!, side.ds.all("innings"));
  const ballsOf = (over: number) =>
    (side.ds.all("overs") as unknown as OversRow[])
      .filter((o) => o.innings_id === "INN1" && o.over_number === over)
      .flatMap((o) => o.balls);
  return { side, replay, innings, crease, position, ballsOf };
}

describe.each([true, false])("a capped over (incremental: %s)", (incremental) => {
  it("ends once at the cap, and the next ball starts the next over", async () => {
    const { replay, innings, crease, position, ballsOf } = await cappedOver(
      incremental,
      2,
    );
    // Four wides and four dots, all faced by a1: the over is over.
    expect(innings()).toMatchObject({ total_balls: 6, total_overs: 1 });
    expect(position()).toMatchObject({ current_over: 1, current_ball: 0 });
    expect(crease()).toEqual({ striker: "a2", nonStriker: "a1", bowler: null });
    const b7 = innings()!.bowling!.find((b) => b.user_id === "b7")!;
    expect(b7).toMatchObject({ balls_bowled: 6, overs_bowled: 1, wides: 4 });

    await replay.step({ kind: "ball", ball: { runs: 0, bowler: "b8" } });
    await replay.step({ kind: "ball", ball: { runs: 0 } });
    expect(ballsOf(0)).toHaveLength(8);
    expect(ballsOf(1).map((b) => b.ball_number)).toEqual([1, 2]);
    // One swap only, and the new over's bowler stays on.
    expect(crease()).toEqual({ striker: "a2", nonStriker: "a1", bowler: "b8" });
    expect(position()).toMatchObject({ current_over: 1, current_ball: 2 });
    expect(innings()).toMatchObject({ total_balls: 8, total_overs: 1.2 });
  });

  it("ends a 1-over innings at the cap", async () => {
    const { innings, position } = await cappedOver(incremental, 1);
    expect(innings(1)).toMatchObject({ total_overs: 1, is_completed: true });
    expect(innings(2)).toMatchObject({ target_runs: 5, is_completed: false });
    expect(position()).toMatchObject({ current_innings: 2 });
  });
});
