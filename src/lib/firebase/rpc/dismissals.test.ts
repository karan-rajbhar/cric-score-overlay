import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  GoldenReplay,
  SYNTHETIC_ROSTERS,
  syntheticTables,
} from "../scoring/__fixtures__/golden";
import { stage2Driver } from "../scoring/__fixtures__/stage2";
import { NON_BOWLER_DISMISSALS } from "../scoring/recompute";
import { fielderOf } from "../scoring/ball-docs";
import type { BowlingPerformancesRow, InningsRow } from "../types";

const [a, b] = SYNTHETIC_ROSTERS.TB.slice(-2) as [string, string];

function started() {
  const side = stage2Driver(syntheticTables({ overs_per_innings: 5 }), true);
  const replay = new GoldenReplay(side, "M", SYNTHETIC_ROSTERS);
  const innings = () =>
    (side.ds.all("innings") as unknown as InningsRow[]).find(
      (i) => i.id === "INN1",
    )!;
  const bowling = () => (innings().bowling ?? []) as BowlingPerformancesRow[];
  return { replay, innings, bowling };
}

describe("dismissals through the engine", () => {
  it("drops a fielder left over from the scorer's first pick", async () => {
    const { replay, innings } = started();
    await replay.step({
      kind: "ball",
      ball: { runs: 0, wicket: "bowled", dismissed: "striker", fielder: b, bowler: a },
    });
    const [fall] = innings().fall_of_wickets ?? [];
    expect(fall).toMatchObject({ dismissal_type: "bowled" });
    expect(fall?.fielder_id ?? null).toBeNull();
  });

  it("keeps the fielder of a bowler's run out and gives them no wicket", async () => {
    const { replay, innings, bowling } = started();
    await replay.step({
      kind: "ball",
      ball: { runs: 1, wicket: "run_out", dismissed: "striker", fielder: a, bowler: a },
    });
    expect(innings().fall_of_wickets?.[0]).toMatchObject({
      dismissal_type: "run_out",
      fielder_id: a,
      bowler_id: a,
    });
    expect(bowling().find((r) => r.user_id === a)?.wickets_taken ?? 0).toBe(0);
  });

  it("knows which dismissals take a fielder", () => {
    expect(fielderOf("caught", "f")).toBe("f");
    expect(fielderOf("run_out", "f")).toBe("f");
    expect(fielderOf("stumped", "f")).toBe("f");
    expect(fielderOf("bowled", "f")).toBeNull();
    expect(fielderOf("lbw", "f")).toBeNull();
    expect(fielderOf("caught", null)).toBeNull();
  });

  it("credits the bowler as the Laws do", () => {
    for (const type of [
      "run_out",
      "obstructing",
      "timed_out",
      "handled_ball",
      "retired_out",
      "retired_hurt",
    ]) {
      expect(NON_BOWLER_DISMISSALS.has(type), type).toBe(true);
    }
    for (const type of ["bowled", "caught", "lbw", "stumped", "hit_wicket"]) {
      expect(NON_BOWLER_DISMISSALS.has(type), type).toBe(false);
    }
  });
});
