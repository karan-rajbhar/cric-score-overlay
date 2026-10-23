import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { MemoryDataSource, type Doc } from "./datasource";
import { legacyRowsDataSource } from "./legacy-rows";
import { liveRowOf, writeLiveState, type LiveStateDoc } from "./live-state";
import { recordState } from "./rpc/state";
import { SCORECARD_FIELDS } from "./scorecard";
import {
  countingDataSource,
  legacyBuildLiveMatchState,
  legacyRecordState,
  withoutOverlayFields,
} from "./scoring/__fixtures__/legacy";
import { buildLiveMatchState, buildOverSummaries } from "./views";

const seed = JSON.parse(
  readFileSync(join(process.cwd(), "firebase/seed/data.json"), "utf8"),
) as Record<string, Doc[]>;
const matchIds = seed.matches!.map((m) => m.id);

/**
 * The legacy (full-read) implementations run on the legacy row view of the
 * same storage: every scorecard row and the whole ball log.
 */
const legacyView = (ds: MemoryDataSource) => legacyRowsDataSource(ds);

/** The seed as stored before the innings caches existed. */
function withoutInningsCaches(): Record<string, Doc[]> {
  return {
    ...seed,
    innings: seed.innings!.map((i) => {
      const copy = { ...i };
      delete copy.last_ball;
      delete copy.last_over_bowler_id;
      return copy;
    }),
  };
}

describe("buildLiveMatchState (targeted reads)", () => {
  it.each(matchIds)(
    "matches the full-read view for seed match %s",
    async (id) => {
      const ds = new MemoryDataSource(seed);
      const expected = await legacyBuildLiveMatchState(legacyView(ds), id);
      const { ds: counted, stats } = countingDataSource(ds);
      const actual = await buildLiveMatchState(counted, id);
      expect(JSON.stringify(withoutOverlayFields(actual))).toBe(
        JSON.stringify(expected),
      );
      // Match, tournament, current innings (scorecard + last ball), current
      // over and the names shown. Before stage 2: 12-18 documents.
      expect(stats.reads).toBeLessThanOrEqual(10);
    },
  );

  it("falls back to the over documents for innings without the caches", async () => {
    const ds = new MemoryDataSource(withoutInningsCaches());
    for (const id of matchIds) {
      expect(withoutOverlayFields(await buildLiveMatchState(ds, id))).toEqual(
        await legacyBuildLiveMatchState(legacyView(ds), id),
      );
    }
  });

  it("counts a DLS chase's revised overs and says so (dls_overs)", async () => {
    // A seed chase: 82 balls bowled of 20 overs, target 147.
    const id = "950e8400-e29b-41d4-a716-446655440003";
    const before = await buildLiveMatchState(new MemoryDataSource(seed), id);
    expect(before).not.toHaveProperty("dls_overs");
    const revised = {
      ...seed,
      matches: seed.matches!.map((m) =>
        m.id === id
          ? {
              ...m,
              dls_revision: { innings_number: 2, target_runs: 120, overs: 16 },
            }
          : m,
      ),
    };
    const state = await buildLiveMatchState(new MemoryDataSource(revised), id);
    expect(state).toMatchObject({
      dls_overs: 16,
      balls_remaining: 16 * 6 - 82,
    });
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
      const { ds: counted, stats } = countingDataSource(ds);
      expect(await recordState(counted, id)).toEqual(
        await legacyRecordState(legacyView(ds), id),
      );
      // Match, current innings and up to four names.
      expect(stats.reads).toBeLessThanOrEqual(6);
    },
  );

  it("matches for innings without the caches (reads the previous over)", async () => {
    const ds = new MemoryDataSource(withoutInningsCaches());
    for (const m of withInnings) {
      expect(await recordState(ds, m.id)).toEqual(
        await legacyRecordState(legacyView(ds), m.id),
      );
    }
  });
});

describe("buildOverSummaries", () => {
  it("reads one document per over", async () => {
    const id = matchIds[0]!;
    const { ds, stats } = countingDataSource(new MemoryDataSource(seed));
    const rows = await buildOverSummaries(ds, id);
    const overs = seed.overs!.filter((o) => o.match_id === id).length;
    expect(rows).toHaveLength(overs);
    expect(stats.reads).toBe(overs);
    const balls = seed
      .overs!.filter((o) => o.match_id === id)
      .reduce((n, o) => n + (o.balls as unknown[]).length, 0);
    expect(
      rows.reduce((n, r) => n + (r.legal_deliveries ?? 0), 0),
    ).toBeLessThanOrEqual(balls);
  });
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
    expect(withoutOverlayFields(liveRowOf(stored!))).toEqual(
      await legacyBuildLiveMatchState(legacyView(ds), id),
    );
  });

  it("does nothing for a missing match", async () => {
    expect(await writeLiveState(new MemoryDataSource(seed), "nope")).toBe(null);
  });
});

it("seed innings carry every stage 2 field", () => {
  for (const inn of seed.innings!) {
    for (const field of SCORECARD_FIELDS) expect(inn).toHaveProperty(field);
  }
});
