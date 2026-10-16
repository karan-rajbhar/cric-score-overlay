import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { MemoryDataSource, type Doc } from "./datasource";
import { liveRowOf, writeLiveState, type LiveStateDoc } from "./live-state";
import { recordState } from "./rpc/state";
import {
  countingDataSource,
  legacyBuildLiveMatchState,
  legacyRecordState,
} from "./scoring/__fixtures__/legacy";
import { buildLiveMatchState } from "./views";

const seed = JSON.parse(
  readFileSync(join(process.cwd(), "firebase/seed/data.json"), "utf8"),
) as Record<string, Doc[]>;
const matchIds = seed.matches!.map((m) => m.id);

describe("buildLiveMatchState (targeted reads)", () => {
  it.each(matchIds)(
    "matches the full-read view for seed match %s",
    async (id) => {
      const ds = new MemoryDataSource(seed);
      const legacy = countingDataSource(ds);
      const expected = await legacyBuildLiveMatchState(legacy.ds, id);
      const { ds: counted, stats } = countingDataSource(ds);
      const actual = await buildLiveMatchState(counted, id);
      expect(JSON.stringify(actual)).toBe(JSON.stringify(expected));
      // The old view read every scorecard row and the whole ball log
      // (79-158 documents on these matches); this one reads 12-18.
      expect(stats.reads).toBeLessThanOrEqual(25);
      expect(stats.reads).toBeLessThanOrEqual(legacy.stats.reads);
    },
  );

  it("matches after an undo removed the ball last_ball_seq points at", async () => {
    const ds = new MemoryDataSource(seed);
    const live = seed.matches!.find((m) => m.status === "live")!;
    const last = seed
      .ball_by_ball!.filter((b) => b.match_id === live.id)
      .sort((a, b) => (b.seq as number) - (a.seq as number))[0]!;
    await ds.delete("ball_by_ball", last.id);
    expect(await buildLiveMatchState(ds, live.id)).toEqual(
      await legacyBuildLiveMatchState(ds, live.id),
    );
  });

  it("returns null for a missing match", async () => {
    expect(await buildLiveMatchState(new MemoryDataSource(seed), "nope")).toBe(
      null,
    );
  });
});

describe("recordState (targeted reads)", () => {
  const withInnings = seed.matches!.filter((m) =>
    seed.innings!.some((i) => i.match_id === m.id),
  );
  it.each(withInnings.map((m) => m.id))(
    "matches the previous implementation for seed match %s",
    async (id) => {
      const ds = new MemoryDataSource(seed);
      expect(await recordState(ds, id)).toEqual(
        await legacyRecordState(ds, id),
      );
    },
  );
});

describe("writeLiveState", () => {
  it("writes the live row with an increasing version", async () => {
    const ds = new MemoryDataSource(seed);
    const id = seed.matches!.find((m) => m.status === "live")!.id;
    const first = await writeLiveState(ds, id);
    const second = await writeLiveState(ds, id);
    expect(first?.version).toBe(1);
    expect(second?.version).toBe(2);
    const stored = (await ds.getById(
      "live_state",
      id,
    )) as unknown as LiveStateDoc | null;
    expect(stored?.version).toBe(2);
    expect(typeof stored?.updated_at).toBe("string");
    expect(liveRowOf(stored!)).toEqual(await legacyBuildLiveMatchState(ds, id));
  });

  it("does nothing for a missing match", async () => {
    expect(await writeLiveState(new MemoryDataSource(seed), "nope")).toBe(null);
  });
});
