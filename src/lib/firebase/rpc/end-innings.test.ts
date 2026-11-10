/**
 * `end_innings` naming its innings: an End innings queued offline after the
 * ball that already closed that innings (the server opened the next one with
 * it) must not end the next innings when the queue replays.
 */

import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  GoldenReplay,
  SYNTHETIC_ROSTERS,
  syntheticTables,
} from "../scoring/__fixtures__/golden";
import { stage2Driver, type Stage2Side } from "../scoring/__fixtures__/stage2";
import type { InningsRow, MatchesRow } from "../types";
import { endInnings } from "./scoring";

/** A one-over match whose first innings the sixth ball has closed. */
async function firstInningsBowled() {
  const side = stage2Driver(syntheticTables({ overs_per_innings: 1 }), true);
  const replay = new GoldenReplay(side, "M", SYNTHETIC_ROSTERS);
  for (let i = 0; i < 6; i += 1) {
    await replay.step({ kind: "ball", ball: { runs: 1 } });
  }
  return { side, replay };
}

const matchOf = (side: Stage2Side) =>
  side.ds.all("matches").find((m) => m.id === "M") as unknown as MatchesRow;
const inningsOf = (side: Stage2Side) =>
  (side.ds.all("innings") as unknown as InningsRow[])
    .map((i) => [i.innings_number, i.total_runs, i.total_balls, i.is_completed])
    .sort((a, b) => Number(a[0]) - Number(b[0]));

describe("end_innings naming an innings", () => {
  it("does nothing when that innings already ended", async () => {
    const { side } = await firstInningsBowled();
    expect(matchOf(side)).toMatchObject({ status: "live", current_innings: 2 });

    const state = await endInnings(
      { ...side.ctx, clientActionId: "queued-end" },
      "M",
      1,
    );

    expect(state).toMatchObject({ current_innings: 2, total_runs: 0 });
    expect(matchOf(side)).toMatchObject({ status: "live", current_innings: 2 });
    expect(inningsOf(side)).toEqual([
      [1, 6, 6, true],
      [2, 0, 0, false],
    ]);
  });

  it("does nothing when that innings is not the current one", async () => {
    const side = stage2Driver(syntheticTables({ overs_per_innings: 5 }), true);
    const replay = new GoldenReplay(side, "M", SYNTHETIC_ROSTERS);
    await replay.step({ kind: "ball", ball: { runs: 4 } });

    await endInnings(side.ctx, "M", 2);

    expect(matchOf(side)).toMatchObject({ status: "live", current_innings: 1 });
    expect(inningsOf(side)).toEqual([[1, 4, 1, false]]);
  });

  it("ends the innings it names", async () => {
    const { side, replay } = await firstInningsBowled();
    await replay.step({ kind: "ball", ball: { runs: 2 } });

    await endInnings(side.ctx, "M", 2);

    expect(matchOf(side)).toMatchObject({ status: "completed" });
    expect(inningsOf(side)).toEqual([
      [1, 6, 6, true],
      [2, 2, 1, true],
    ]);
  });

  it("without a number, still ends the current innings (actions queued before)", async () => {
    const { side } = await firstInningsBowled();

    await endInnings(side.ctx, "M");

    expect(matchOf(side)).toMatchObject({ status: "completed" });
    expect(inningsOf(side)).toEqual([
      [1, 6, 6, true],
      [2, 0, 0, true],
    ]);
  });
});
