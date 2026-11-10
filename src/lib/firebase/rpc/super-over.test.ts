/**
 * `start_super_over` starts only from a completed, tied match: not twice
 * (two scorers, or a queued action replayed after the other started it),
 * and not while an innings is in play.
 */

import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  GoldenReplay,
  SYNTHETIC_ROSTERS,
  syntheticTables,
} from "../scoring/__fixtures__/golden";
import { stage2Driver } from "../scoring/__fixtures__/stage2";
import { startSuperOver } from "./scoring";

function setup() {
  const side = stage2Driver(syntheticTables({ overs_per_innings: 1 }), true);
  const replay = new GoldenReplay(side, "M", SYNTHETIC_ROSTERS);
  const inningsCount = () => side.ds.all("innings").length;
  const match = () => side.ds.all("matches").find((m) => m.id === "M")!;
  const start = (actionId: string) =>
    startSuperOver({ ...side.ctx, clientActionId: actionId }, "M");
  return { side, replay, inningsCount, match, start };
}

describe("start_super_over", () => {
  it("starts once from a tie; a second start is refused", async () => {
    const { replay, inningsCount, match, start } = setup();
    // 6 each.
    for (let i = 0; i < 12; i += 1)
      await replay.step({ kind: "ball", ball: { runs: 1 } });
    expect(match()).toMatchObject({ status: "completed", result_type: "tie" });

    await start("first");
    expect(inningsCount()).toBe(3);
    expect(match()).toMatchObject({ status: "live", current_innings: 3 });

    // The same action again (a lost reply) is a no-op; another is refused.
    await start("first");
    await expect(start("second")).rejects.toThrow("super_over_needs_tie");
    expect(inningsCount()).toBe(3);
    expect(match().current_innings).toBe(3);
  });

  it("is refused while an innings is in play, and after a result", async () => {
    const { replay, inningsCount, match, start } = setup();
    await replay.step({ kind: "ball", ball: { runs: 1 } });
    await expect(start("early")).rejects.toThrow("super_over_needs_tie");
    expect(inningsCount()).toBe(1);
    expect(match()).toMatchObject({ status: "live", current_innings: 1 });

    // Alpha 6, Bravo 0: a result, not a tie.
    for (let i = 0; i < 5; i += 1)
      await replay.step({ kind: "ball", ball: { runs: 1 } });
    for (let i = 0; i < 6; i += 1)
      await replay.step({ kind: "ball", ball: { runs: 0 } });
    expect(match()).toMatchObject({ status: "completed", result_type: "win" });
    await expect(start("after")).rejects.toThrow("super_over_needs_tie");
    expect(inningsCount()).toBe(2);
  });
});
