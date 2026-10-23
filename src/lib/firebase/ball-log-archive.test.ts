/**
 * Ball-log archives (`ball-log-archive.ts`, `match-ball-log.ts`): a
 * completed innings is archived the first time its log is read, the log
 * read from archives equals the one read from every over, live innings are
 * never archived, and an edit to a completed innings drops its archive.
 */

import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { BALL_LOGS_COLLECTION } from "./ball-log-archive";
import type { Doc } from "./datasource";
import { matchBallLog } from "./match-ball-log";
import { serverClientFor } from "./server-client";
import {
  GoldenReplay,
  SYNTHETIC_ROSTERS,
  syntheticTables,
} from "./scoring/__fixtures__/golden";
import { stage2Driver } from "./scoring/__fixtures__/stage2";
import { undoLastBall, updateBall } from "./rpc/scoring";
import type { OversRow } from "./scorecard";

function setup() {
  const side = stage2Driver(
    syntheticTables({ overs_per_innings: 3, wickets_per_innings: 10 }),
    true,
  );
  const replay = new GoldenReplay(side, "M", SYNTHETIC_ROSTERS);
  const db = serverClientFor({
    ds: side.ds,
    db: null,
    getUser: async () => null,
  });
  /** The log as read from every over document (the reference). */
  const fromOvers = async () =>
    (
      await db
        .from("ball_by_ball")
        .select("*, innings(innings_number, team_id)")
        .eq("match_id", "M")
        .order("seq")
    ).data as Doc[];
  const archived = () =>
    side.ds
      .all(BALL_LOGS_COLLECTION)
      .map((d) => d.id)
      .sort();
  const log = () => matchBallLog({ ds: side.ds }, "M");
  return { side, replay, fromOvers, archived, log };
}

const strip = (rows: Doc[]) =>
  rows.map((r) => JSON.parse(JSON.stringify(r)) as Doc);

describe("ball-log archives", () => {
  it("archive a completed innings once and read the same log from it", async () => {
    const { side, replay, fromOvers, archived, log } = setup();
    // Innings 1 (3 overs), then 2 overs of innings 2.
    for (let i = 0; i < 30; i += 1) {
      await replay.step({ kind: "ball", ball: { runs: i % 3 } });
    }
    expect(archived()).toEqual([]);
    const first = await log();
    expect(strip(first)).toEqual(strip(await fromOvers()));
    // Only the completed innings; the one in play stays on its overs.
    expect(archived()).toEqual(["INN1"]);

    const reads = side.ds.billedReads;
    const again = await log();
    expect(again).toEqual(first);
    const oversInPlay = side.ds
      .all("overs")
      .filter((o) => o.innings_id !== "INN1").length;
    // Innings query (2), the archive (1), the innings in play's overs.
    expect(side.ds.billedReads - reads).toBe(3 + oversInPlay);

    // Deliveries in the innings in play leave the archive alone.
    const writes = { ...side.ds.writesByTable };
    await replay.step({ kind: "ball", ball: { runs: 4 } });
    expect(archived()).toEqual(["INN1"]);
    expect(side.ds.writesByTable[BALL_LOGS_COLLECTION] ?? 0).toBe(
      writes[BALL_LOGS_COLLECTION] ?? 0,
    );
    expect(strip(await log())).toEqual(strip(await fromOvers()));
  });

  it("drop the archive when a completed innings is edited, then rebuild it", async () => {
    const { side, replay, fromOvers, archived, log } = setup();
    for (let i = 0; i < 24; i += 1) {
      await replay.step({ kind: "ball", ball: { runs: 1 } });
    }
    await log();
    expect(archived()).toEqual(["INN1"]);

    const inn1 = side.ds
      .all("overs")
      .filter((o) => o.innings_id === "INN1") as unknown as OversRow[];
    const target = inn1.find((o) => o.over_number === 1)!.balls[2]!;
    await updateBall(side.ctx, {
      p_match_id: "M",
      p_ball_id: target.id,
      p_runs_scored: 6,
      p_extras: 0,
      p_extra_type: null,
      p_is_wicket: false,
    });
    expect(archived()).toEqual([]);
    const edited = await log();
    expect(strip(edited)).toEqual(strip(await fromOvers()));
    expect(edited.find((b) => b.id === target.id)!.runs_scored).toBe(6);
    expect(archived()).toEqual(["INN1"]);
  });

  it("drop the archive when an undo reopens the innings", async () => {
    const { side, replay, fromOvers, archived, log } = setup();
    // Exactly the first innings: 3 overs.
    for (let i = 0; i < 18; i += 1) {
      await replay.step({ kind: "ball", ball: { runs: 1 } });
    }
    await log();
    expect(archived()).toEqual(["INN1"]);
    await undoLastBall(side.ctx, "M");
    expect(archived()).toEqual([]);
    expect(strip(await log())).toEqual(strip(await fromOvers()));
    // Reopened: not archived again until it completes.
    expect(archived()).toEqual([]);
  });
});
