import { describe, expect, it } from "vitest";
import { redoToSave, restoredRedo, type UndoneBall } from "./scoring-undo";
import type { PredictionBase } from "./scoring-prediction";

/** A screen state: one innings with `runs` scored. */
const stateWith = (runs: number, inningsId = "i1") => ({
  snapshot: {
    match: {
      id: "m",
      innings: [{ id: inningsId, total_runs: runs, total_wickets: 0, total_balls: 6 }],
    },
  },
  base: { innings: { id: inningsId }, overs: [] } as unknown as PredictionBase,
});

const four: UndoneBall = {
  seq: 7,
  over: 1,
  ball: 1,
  bowlerId: "b",
  batsmanId: "s",
  nonStrikerId: "n",
  event: { runsScored: 4 } as UndoneBall["event"],
  isEvent: false,
};

describe("Restore ball across a reload", () => {
  it("offers the undone ball again while the scorecard is as it was", () => {
    const saved = JSON.parse(JSON.stringify(redoToSave([four], stateWith(10))));
    expect(restoredRedo(saved, stateWith(10))).toEqual([four]);
  });

  it("drops it once anything changed: a ball, an edit, another innings", () => {
    const saved = redoToSave([four], stateWith(10));
    expect(restoredRedo(saved, stateWith(11))).toEqual([]);
    expect(restoredRedo(saved, stateWith(10, "i2"))).toEqual([]);
    expect(restoredRedo(null, stateWith(10))).toEqual([]);
  });

  it("saves nothing when no ball waits to be restored", () => {
    expect(redoToSave([], stateWith(10))).toBeNull();
  });
});
