/**
 * Undo returns the crease and the bowler the undone entry was recorded
 * with: what the scoring screen showed just before it, which instant undo
 * (`~/lib/scoring-undo`) shows at once.
 */

import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  GoldenReplay,
  SYNTHETIC_ROSTERS,
  syntheticTables,
} from "../scoring/__fixtures__/golden";
import { stage2Driver } from "../scoring/__fixtures__/stage2";
import type { InningsRow } from "../types";
import { retireBatter, setCurrentBatsmen, undoLastBall } from "./scoring";

function setup(incremental: boolean) {
  const side = stage2Driver(
    syntheticTables({ overs_per_innings: 5 }),
    incremental,
  );
  const replay = new GoldenReplay(side, "M", SYNTHETIC_ROSTERS);
  /** Striker, non-striker and current bowler, as stored. */
  const crease = () => {
    const inn = (side.ds.all("innings") as unknown as InningsRow[]).find(
      (i) => i.id === "INN1",
    )!;
    const at = (inn.batting ?? []).filter((b) => b.is_current_batsman);
    return {
      striker: at.find((b) => b.is_striker)?.user_id ?? null,
      nonStriker: at.find((b) => !b.is_striker)?.user_id ?? null,
      bowler:
        (inn.bowling ?? []).find((b) => b.is_current_bowler)?.user_id ?? null,
    };
  };
  return { side, replay, crease };
}

describe.each([true, false])("undo (incremental: %s)", (incremental) => {
  it("restores the striker chosen by hand", async () => {
    const { side, replay, crease } = setup(incremental);
    // a1's single puts a2 on strike; the scorer puts a1 back on strike.
    await replay.step({ kind: "ball", ball: { runs: 1 } });
    expect(crease()).toMatchObject({ striker: "a2", nonStriker: "a1" });
    await replay.step({
      kind: "ball",
      ball: { batsman: "a1", nonStriker: "a2", runs: 0 },
    });
    await undoLastBall(side.ctx, "M");
    expect(crease()).toEqual({ striker: "a1", nonStriker: "a2", bowler: "b7" });
  });

  it("restores the bowler changed in the middle of the over", async () => {
    const { side, replay, crease } = setup(incremental);
    await replay.step({ kind: "ball", ball: { runs: 0 } });
    await replay.step({ kind: "ball", ball: { runs: 0 } });
    expect(crease().bowler).toBe("b7");
    await replay.step({ kind: "ball", ball: { runs: 0, bowler: "b8" } });
    const before = crease();
    expect(before.bowler).toBe("b8");
    await undoLastBall(side.ctx, "M");
    expect(crease()).toEqual({ ...before, bowler: "b8" });
  });

  it("restores the crease a retirement was recorded at", async () => {
    const { side, replay, crease } = setup(incremental);
    await replay.step({ kind: "ball", ball: { runs: 0 } });
    // The scorer puts a2 on strike (the log has a1), then a2 retires hurt.
    await setCurrentBatsmen(side.ctx, "M", "a2", "a1");
    await retireBatter(side.ctx, {
      p_match_id: "M",
      p_player_id: "a2",
      p_type: "retired_hurt",
    });
    expect(crease()).toMatchObject({ striker: null, nonStriker: "a1" });
    await undoLastBall(side.ctx, "M");
    expect(crease()).toEqual({ striker: "a2", nonStriker: "a1", bowler: "b7" });
  });
});
