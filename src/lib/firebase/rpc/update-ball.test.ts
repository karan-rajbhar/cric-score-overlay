import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import type { DataSource, Doc } from "../datasource";
import {
  GoldenReplay,
  SYNTHETIC_ROSTERS,
  syntheticTables,
} from "../scoring/__fixtures__/golden";
import { stage2Driver } from "../scoring/__fixtures__/stage2";
import { overDocIdOfBall, type OversRow } from "../scorecard";
import { recomputeInningsRpc, updateBall } from "./scoring";

/** Counts documents read from `overs` through a data source. */
function countOvers(ds: DataSource) {
  const counter = { overs: 0 };
  const proxy = new Proxy(ds, {
    get(target, prop) {
      const value = Reflect.get(target, prop, target) as unknown;
      if (typeof value !== "function") return value;
      const fn = value as (...a: unknown[]) => Promise<unknown>;
      if (prop === "getById" || prop === "getByIds" || prop === "query") {
        return async (...args: unknown[]) => {
          const out = await fn.apply(target, args);
          if (args[0] === "overs") {
            counter.overs += Array.isArray(out) ? out.length : out ? 1 : 0;
          }
          return out;
        };
      }
      return fn.bind(target);
    },
  });
  return { proxy, counter };
}

describe("update_ball", () => {
  it("reads only the edited ball's innings, locating its over from the id", async () => {
    const side = stage2Driver(
      syntheticTables({ overs_per_innings: 3, wickets_per_innings: 10 }),
      true,
    );
    const replay = new GoldenReplay(side, "M", SYNTHETIC_ROSTERS);
    // Innings 1 (3 overs), then 2 overs of innings 2.
    for (let i = 0; i < 30; i += 1) {
      await replay.step({ kind: "ball", ball: { runs: i % 2 } });
    }
    const overs = side.ds.all("overs") as unknown as OversRow[];
    const inn1 = overs.filter((o) => o.innings_id === "INN1");
    expect(overs.length).toBeGreaterThan(inn1.length);
    const target = inn1.find((o) => o.over_number === 1)!.balls[2]!;
    expect(overDocIdOfBall(target.id)).toBe("INN1_1");

    const { proxy, counter } = countOvers(side.ctx.ds);
    const ctx = { ...side.ctx, ds: proxy };
    const edit = (ballId: string, runs: number) =>
      updateBall(ctx, {
        p_match_id: "M",
        p_ball_id: ballId,
        p_runs_scored: runs,
        p_extras: 0,
        p_extra_type: null,
        p_is_wicket: false,
      });

    await edit(target.id, 4);
    // The hinted over doc, then the innings' own overs (for the recompute).
    expect(counter.overs).toBe(1 + inn1.length);

    // A ball recorded before stage 3 has a plain id: found by the scan.
    const legacyId = "00000000-0000-4000-8000-000000000000";
    const over = side.ds.all("overs").find((o) => o.id === "INN1_2")!;
    await side.ds.update("overs", "INN1_2", {
      balls: (over.balls as Doc[]).map((b, i) =>
        i === 0 ? { ...b, id: legacyId } : b,
      ),
    });
    counter.overs = 0;
    await edit(legacyId, 6);
    expect(counter.overs).toBe(side.ds.all("overs").length);

    const after = side.ds.all("overs") as unknown as OversRow[];
    const runsOf = (overId: string, ballId: string) =>
      after.find((o) => o.id === overId)!.balls.find((b) => b.id === ballId)!
        .runs_scored;
    expect(runsOf("INN1_1", target.id)).toBe(4);
    expect(runsOf("INN1_2", legacyId)).toBe(6);
    await expect(edit("INN1_9~missing", 1)).rejects.toThrow("ball_not_found");
  });

  it("editing a completed innings leaves the current innings' position and live state alone", async () => {
    const side = stage2Driver(syntheticTables({ overs_per_innings: 2 }), true);
    const replay = new GoldenReplay(side, "M", SYNTHETIC_ROSTERS);
    // Innings 1 (2 overs), then 0.2 of innings 2.
    for (let i = 0; i < 14; i += 1) {
      await replay.step({ kind: "ball", ball: { runs: i % 2 } });
    }
    const current = () => side.ds.getById("matches", "M");
    const live = async () => {
      const doc = { ...(await side.ds.getById("live_state", "M"))! };
      for (const k of ["version", "updated_at", "overs_changed"]) delete doc[k];
      return doc;
    };
    const inn2 = async () => {
      const all = side.ds.all("innings");
      const doc = { ...all.find((i) => i.innings_number === 2)! };
      delete doc.updated_at;
      return doc;
    };
    const before = await current();
    expect(before).toMatchObject({
      current_innings: 2,
      current_over: 0,
      current_ball: 2,
    });
    const liveBefore = await live();
    const inn2Before = await inn2();

    const inn1Ball = (side.ds.all("overs") as unknown as OversRow[]).find(
      (o) => o.id === "INN1_1",
    )!.balls[5]!;
    const totalBefore = side.ds.all("innings").find((i) => i.id === "INN1")!
      .total_runs as number;
    const state = await updateBall(side.ctx, {
      p_match_id: "M",
      p_ball_id: inn1Ball.id,
      p_runs_scored: 6,
      p_extras: 0,
      p_extra_type: null,
      p_is_wicket: false,
    });
    expect(state).toMatchObject({
      current_innings: 2,
      current_over: 0,
      current_ball: 2,
    });
    await recomputeInningsRpc(side.ctx, "INN1");

    expect(await current()).toMatchObject({ current_over: 0, current_ball: 2 });
    expect(await live()).toEqual(liveBefore);
    expect(await inn2()).toEqual(inn2Before);
    // The edit itself landed in innings 1.
    const inn1 = side.ds.all("innings").find((i) => i.id === "INN1")!;
    expect(inn1.total_runs).toBe(totalBefore - (inn1Ball.runs_scored ?? 0) + 6);
    expect(inn1.is_completed).toBe(true);

    // Scoring carries on from 0.2 of innings 2.
    await replay.step({ kind: "ball", ball: { runs: 1 } });
    expect(await current()).toMatchObject({ current_over: 0, current_ball: 3 });
  });
});
