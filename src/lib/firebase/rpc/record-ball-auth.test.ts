import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  GoldenReplay,
  SYNTHETIC_ROSTERS,
  syntheticTables,
} from "../scoring/__fixtures__/golden";
import { stage2Driver } from "../scoring/__fixtures__/stage2";
import { seqCounterOf } from "../scorecard";
import type { InningsRow, MatchesRow } from "../types";

/**
 * The record_ball server action no longer checks scoring rights itself; the
 * transaction does (requireAdminOf). These tests drive the real engine to
 * prove who may and may not record a ball.
 */
async function setup() {
  const side = stage2Driver(
    syntheticTables({ overs_per_innings: 3, wickets_per_innings: 10 }),
    true,
  );
  const replay = new GoldenReplay(side, "M", SYNTHETIC_ROSTERS);
  await replay.step({ kind: "ball", ball: { runs: 1 } });
  // The match's seq counter (held by its current innings).
  const seq = async () =>
    seqCounterOf(
      (await side.ds.getById("matches", "M")) as unknown as MatchesRow,
      ...(side.ds.all("innings") as unknown as InningsRow[]),
    );
  const as = (uid: string | null) => {
    side.ctx = { ...side.ctx, uid };
  };
  // The replay returns engine errors instead of throwing them.
  const ball = () => replay.step({ kind: "ball", ball: { runs: 1 } });
  const refused = async () => {
    const out = await ball();
    expect(out).toBeInstanceOf(Error);
    expect((out as Error).message).toBe("not_authorized");
  };
  const allowed = async () => {
    expect(await ball()).not.toBeInstanceOf(Error);
  };
  return { side, seq, as, refused, allowed };
}

describe("record_ball authorization", () => {
  it("refuses a signed-in user who can't score the match, writing nothing", async () => {
    const { seq, as, refused } = await setup();
    const before = await seq();
    as("attacker");
    await refused();
    expect(await seq()).toBe(before);
  });

  it("refuses a request without a user", async () => {
    const { seq, as, refused } = await setup();
    const before = await seq();
    as(null);
    await refused();
    expect(await seq()).toBe(before);
  });

  it("lets a listed scorer record a ball", async () => {
    const { side, seq, as, allowed } = await setup();
    await side.ds.update("matches", "M", { match_admins: ["scorer-1"] });
    const before = await seq();
    as("scorer-1");
    await allowed();
    expect(await seq()).toBe((before ?? 0) + 1);
  });

  it("lets the tournament creator record a ball", async () => {
    const { side, seq, as, allowed } = await setup();
    await side.ds.update("tournaments", "T1", { created_by: "organiser" });
    const before = await seq();
    as("organiser");
    await allowed();
    expect(await seq()).toBe((before ?? 0) + 1);
  });

  it("refuses crease / bowler changes too (their actions rely on it)", async () => {
    const { setCurrentBatsmen, setCurrentBowler } = await import("./scoring");
    const { side } = await setup();
    const before = side.ds.writes;
    const ctx = { ...side.ctx, uid: "attacker" };
    await expect(setCurrentBatsmen(ctx, "M", "a", "b")).rejects.toThrow(
      "not_authorized",
    );
    await expect(setCurrentBowler(ctx, "M", "c")).rejects.toThrow(
      "not_authorized",
    );
    expect(side.ds.writes).toBe(before);
  });

  it("lets a club admin of the match's club record a ball", async () => {
    const { side, seq, as, allowed } = await setup();
    await side.ds.insert("clubs", [
      { id: "C1", name: "Club", owner_id: "owner" },
    ]);
    await side.ds.update("matches", "M", { club_id: "C1" });
    const before = await seq();
    as("owner");
    await allowed();
    expect(await seq()).toBe((before ?? 0) + 1);
  });
});
