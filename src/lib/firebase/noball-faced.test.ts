/**
 * The no-ball balls-faced migration's plan (`planNoBallFaced`, run by
 * scripts/migrate-noball-balls-faced.mjs) on the seed, which was recorded
 * when a no-ball was not counted as a ball faced.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { MemoryDataSource, type Doc } from "./datasource";
import { planNoBallFaced, type NoBallFacedPlan } from "./noball-faced";
import { ballLogOf, type OversRow } from "./scorecard";
import type { InningsRow } from "./types";

const NOW = "2026-10-23T00:00:00.000Z";
const seed = JSON.parse(
  readFileSync(join(process.cwd(), "firebase/seed/data.json"), "utf8"),
) as Record<string, Doc[]>;

async function apply(ds: MemoryDataSource, plan: NoBallFacedPlan) {
  for (const w of plan.writes) {
    if (!w.after) await ds.delete(w.table, w.id);
    else if (w.before) await ds.update(w.table, w.id, w.after);
    else await ds.insert(w.table, [w.after]);
  }
}

describe("planNoBallFaced on the seed", () => {
  it("adds each batter's no-balls received, derives the records, and is idempotent", async () => {
    const ds = new MemoryDataSource(seed);
    const plan = await planNoBallFaced(ds, { now: NOW });

    expect(plan.inningsChecked).toBe(12);
    expect(plan.inningsChanged).toBe(12);
    expect(plan.matches).toBe(6);
    // Never the ball log, nor anything outside the derived figures.
    expect(Object.keys(plan.byTable).sort()).toEqual([
      "innings",
      "leaderboards",
      "player_career_stats",
      "player_matches",
    ]);
    expect(plan.byTable).toMatchObject({ innings: 12 });

    // Each batter: one more ball per no-ball received, nothing else.
    const overs = seed.overs as unknown as OversRow[];
    for (const w of plan.writes.filter((x) => x.table === "innings")) {
      const before = w.before as unknown as InningsRow;
      const after = w.after as unknown as InningsRow;
      const log = ballLogOf(overs.filter((o) => o.innings_id === w.id));
      for (const b of after.batting ?? []) {
        const was = before.batting!.find((x) => x.user_id === b.user_id)!;
        const noBalls = log.filter(
          (x) => x.extra_type === "no_ball" && x.batsman_id === b.user_id,
        ).length;
        expect((b.balls_faced ?? 0) - (was.balls_faced ?? 0)).toBe(noBalls);
        expect({ ...b, balls_faced: 0 }).toEqual({ ...was, balls_faced: 0 });
      }
      const { batting: _a, partnerships: _p, ...restAfter } = after;
      const { batting: _b, partnerships: _q, ...restBefore } = before;
      void _a;
      void _p;
      void _b;
      void _q;
      expect(restAfter).toEqual(restBefore);
    }
    // Career figures follow the records.
    const careers = plan.writes.filter((w) => w.table === "player_career_stats");
    expect(careers.length).toBeGreaterThan(0);
    for (const w of careers) {
      expect(w.after!.total_balls_faced as number).toBeGreaterThan(
        w.before!.total_balls_faced as number,
      );
    }

    await apply(ds, plan);
    const again = await planNoBallFaced(ds, { now: NOW });
    expect(again.writes).toEqual([]);
  });

  it("leaves a match that keeps no-balls out of balls faced as it is", async () => {
    const tables = structuredClone(seed);
    for (const m of tables.matches!) m.noball_counts_as_ball_faced = false;
    const plan = await planNoBallFaced(new MemoryDataSource(tables), { now: NOW });
    expect(plan.inningsChecked).toBe(12);
    expect(plan.writes).toEqual([]);
  });
});
