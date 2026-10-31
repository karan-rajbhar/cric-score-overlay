import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { overBall, overSlotsLeft } from "~/components/overlay/packages/shared/derive";
import {
  GoldenReplay,
  SYNTHETIC_ROSTERS,
  syntheticTables,
} from "./scoring/__fixtures__/golden";
import { stage2Driver } from "./scoring/__fixtures__/stage2";
import type { LiveMatchStateRow } from "./types";

describe("live_state.this_over_balls", () => {
  it("spells each ball as the app does, for the live page and the overlays", async () => {
    const side = stage2Driver(syntheticTables({ overs_per_innings: 5 }), true);
    const replay = new GoldenReplay(side, "M", SYNTHETIC_ROSTERS);
    const live = () =>
      (side.ds.all("live_state") as unknown as LiveMatchStateRow[])[0]!;

    await replay.step({ kind: "ball", ball: { runs: 1 } });
    await replay.step({
      kind: "ball",
      ball: { runs: 0, extras: 2, extraType: "bye" },
    });
    await replay.step({
      kind: "retire",
      who: "striker",
      type: "retired_hurt",
    });
    await replay.step({
      kind: "ball",
      ball: { runs: 2, wicket: "run_out", dismissed: "striker" },
    });
    await replay.step({
      kind: "ball",
      ball: { runs: 0, extras: 2, extraType: "wide" },
    });
    await replay.step({
      kind: "ball",
      ball: { runs: 2, extras: 1, extraType: "no_ball" },
    });

    const tokens = live().this_over_balls!.split(" ");
    expect(tokens).toEqual(["1", "b2", "rh", "W+2", "wd+1", "nb+2"]);
    // The retirement, the wide and the no-ball leave 3 of 6 balls bowled.
    expect(overSlotsLeft(tokens.map(overBall))).toBe(3);
    expect(live().this_over_runs).toBe(1 + 2 + 2 + 2 + 3);
  });
});
