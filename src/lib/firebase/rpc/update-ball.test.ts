import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import type { DataSource, Doc } from "../datasource";
import {
  GoldenReplay,
  SYNTHETIC_ROSTERS,
  syntheticTables,
} from "../scoring/__fixtures__/golden";
import { logicalMatch } from "../scoring/__fixtures__/legacy";
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

  it("editing a completed innings moves the chase's target and leaves its position alone", async () => {
    const side = stage2Driver(syntheticTables({ overs_per_innings: 2 }), true);
    const replay = new GoldenReplay(side, "M", SYNTHETIC_ROSTERS);
    // Innings 1 (2 overs), then 0.2 of innings 2.
    for (let i = 0; i < 14; i += 1) {
      await replay.step({ kind: "ball", ball: { runs: i % 2 } });
    }
    // The match with its position (derived from the current innings).
    const current = async () =>
      logicalMatch(
        (await side.ds.getById("matches", "M"))!,
        side.ds.all("innings"),
      );
    const live = async () => {
      const doc = { ...(await side.ds.getById("live_state", "M"))! };
      // Change signals and who made the change (the edit itself).
      for (const k of [
        "version",
        "updated_at",
        "overs_changed",
        "innings_changed",
        "last_change",
      ])
        delete doc[k];
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
    // The chase's target follows innings 1; nothing else of it changes.
    const added = 6 - (inn1Ball.runs_scored ?? 0);
    const target = (inn2Before.target_runs as number) + added;
    expect(await live()).toEqual({
      ...liveBefore,
      target_runs: target,
      runs_needed: (liveBefore.runs_needed as number) + added,
      required_run_rate: 6.6, // 11 off 10 balls (was 6: 3.6)
    });
    expect(await inn2()).toEqual({ ...inn2Before, target_runs: target });
    // The edit itself landed in innings 1.
    const inn1 = side.ds.all("innings").find((i) => i.id === "INN1")!;
    expect(inn1.total_runs).toBe(totalBefore - (inn1Ball.runs_scored ?? 0) + 6);
    expect(inn1.is_completed).toBe(true);
    // Scoring carries on from 0.2 of innings 2.
    await replay.step({ kind: "ball", ball: { runs: 1 } });
    expect(await current()).toMatchObject({ current_over: 0, current_ball: 3 });
  });
});

/**
 * A 1-over match: Alpha make 6 (six singles), Bravo chase 7 and score
 * `runs`. An edit of the ball log settles the innings and the match as a
 * delivery would.
 */
async function chase(incremental: boolean, runs: number[]) {
  const side = stage2Driver(
    syntheticTables({ overs_per_innings: 1 }),
    incremental,
  );
  const replay = new GoldenReplay(side, "M", SYNTHETIC_ROSTERS);
  for (let i = 0; i < 6; i += 1)
    await replay.step({ kind: "ball", ball: { runs: 1 } });
  for (const r of runs) await replay.step({ kind: "ball", ball: { runs: r } });
  const match = () => side.ds.all("matches").find((m) => m.id === "M")!;
  const innings = (n: number) =>
    side.ds.all("innings").find((i) => i.innings_number === n);
  const ballsOf = (n: number) =>
    (side.ds.all("overs") as unknown as OversRow[])
      .filter((o) => o.innings_id === innings(n)?.id)
      .flatMap((o) => o.balls)
      .sort((a, b) => a.seq - b.seq);
  const edit = (n: number, index: number, runsScored: number) =>
    updateBall(side.ctx, {
      p_match_id: "M",
      p_ball_id: ballsOf(n)[index]!.id,
      p_runs_scored: runsScored,
      p_extras: 0,
      p_extra_type: null,
      p_is_wicket: false,
    });
  return { side, replay, match, innings, edit };
}

describe.each([true, false])(
  "update_ball on a finished match (incremental: %s)",
  (incremental) => {
    it("reopens a won chase the edit takes back below its target", async () => {
      const { replay, match, innings, edit } = await chase(incremental, [4, 4]);
      expect(match()).toMatchObject({
        status: "completed",
        winning_team_id: "TB",
        win_margin: 10,
        win_margin_type: "wickets",
        result_description: "Bravo won by 10 wickets",
      });
      await edit(2, 0, 0);
      expect(innings(2)).toMatchObject({
        total_runs: 4,
        target_runs: 7,
        is_completed: false,
      });
      expect(match()).toMatchObject({
        status: "live",
        current_innings: 2,
        result_type: null,
        winning_team_id: null,
        win_margin: null,
        win_margin_type: null,
        result_description: null,
      });
      // Scoring resumes, and wins it again.
      await replay.step({ kind: "ball", ball: { runs: 4 } });
      expect(match()).toMatchObject({
        status: "completed",
        winning_team_id: "TB",
        result_description: "Bravo won by 10 wickets",
      });
    });

    it("re-derives the result of a finished match the edit leaves finished", async () => {
      // 5 off the over: Alpha won by 1 run.
      const { match, innings, edit } = await chase(
        incremental,
        [1, 1, 1, 1, 1, 0],
      );
      expect(match()).toMatchObject({
        status: "completed",
        winning_team_id: "TA",
        win_margin: 1,
        win_margin_type: "runs",
        result_description: "Alpha won by 1 run",
      });
      await edit(2, 5, 1);
      expect(innings(2)).toMatchObject({ total_runs: 6, is_completed: true });
      expect(match()).toMatchObject({
        status: "completed",
        result_type: "tie",
        winning_team_id: null,
        win_margin: null,
        win_margin_type: null,
        result_description: "Match tied",
      });
    });
  },
);

describe.each([true, false])(
  "update_ball on a live chase (incremental: %s)",
  (incremental) => {
    it("closes a live chase the edit takes to its target", async () => {
      const { match, innings, edit } = await chase(incremental, [4, 0]);
      expect(match()).toMatchObject({ status: "live" });
      await edit(2, 1, 4);
      expect(innings(2)).toMatchObject({ total_runs: 8, is_completed: true });
      expect(match()).toMatchObject({
        status: "completed",
        result_type: "win",
        winning_team_id: "TB",
        win_margin: 10,
        win_margin_type: "wickets",
        result_description: "Bravo won by 10 wickets",
      });
    });

    it("moves the chase's target with a completed first innings, unless revised", async () => {
      const { side, match, innings, edit } = await chase(incremental, [1]);
      await edit(1, 0, 4);
      expect(innings(1)).toMatchObject({ total_runs: 9, is_completed: true });
      expect(innings(2)).toMatchObject({
        target_runs: 10,
        is_completed: false,
      });
      expect(match()).toMatchObject({ status: "live", current_innings: 2 });

      // A revised target (DLS) stays as set.
      await side.ds.update("matches", "M", {
        dls_revision: { innings_number: 2, target_runs: 5, overs: 1 },
      });
      await side.ds.update("innings", innings(2)!.id as string, {
        target_runs: 5,
      });
      await edit(1, 1, 4);
      expect(innings(1)!.total_runs).toBe(12);
      expect(innings(2)!.target_runs).toBe(5);
    });

    it("finishes the match when the moved target is already reached", async () => {
      const { match, innings, edit } = await chase(incremental, [4]);
      // Alpha's 6 becomes 3: Bravo's 4 already beats the new target of 4.
      for (const i of [0, 1, 2]) await edit(1, i, 0);
      expect(innings(2)).toMatchObject({
        target_runs: 4,
        total_runs: 4,
        is_completed: true,
      });
      expect(match()).toMatchObject({
        status: "completed",
        winning_team_id: "TB",
        result_description: "Bravo won by 10 wickets",
      });
    });
  },
);
