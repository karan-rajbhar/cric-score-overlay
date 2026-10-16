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
import { updateBall } from "./scoring";

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
});
