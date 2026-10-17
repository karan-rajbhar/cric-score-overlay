/**
 * Moving the per-ball match fields to the current innings
 * (`scripts/migrate-per-ball-fields.mjs`): the plan copies the seq counter
 * and the client action memory to the match's current innings, is
 * idempotent, and the engine scores identically on data before the
 * migration (old shape, the app reads both), after it, and when an older
 * app version wrote to the match in between.
 */

import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  mergeActionIds as mergeInScript,
  planPerBallFields,
} from "../../../scripts/lib/per-ball-fields.mjs";
import type { Doc } from "./datasource";
import { mergeActionIds, recordBall } from "./rpc/scoring";
import { ballLogOf, seqCounterOf, type OversRow } from "./scorecard";
import {
  GoldenReplay,
  SYNTHETIC_ROSTERS,
  syntheticTables,
} from "./scoring/__fixtures__/golden";
import { stage2Driver, type Stage2Side } from "./scoring/__fixtures__/stage2";
import type { InningsRow, MatchesRow } from "./types";

/** Plan and apply the migration on a side's documents. */
const apply = async (side: Stage2Side) => {
  const plan = planPerBallFields({
    matches: side.ds.all("matches"),
    innings: side.ds.all("innings"),
  });
  for (const { id, data } of plan.updates) {
    const doc = side.ds.all("innings").find((d) => d.id === id)!;
    await side.ds.insert("innings", [{ ...doc, ...data }]);
  }
  return plan;
};

/** Replace a stored document with `edit` applied to it. */
const rewrite = async (
  side: Stage2Side,
  table: string,
  id: string,
  edit: (doc: Doc) => void,
) => {
  const doc = side.ds.all(table).find((d) => d.id === id)!;
  edit(doc);
  await side.ds.insert(table, [doc]);
};

const matchOf = (side: Stage2Side) =>
  side.ds.all("matches").find((m) => m.id === "M") as unknown as MatchesRow;
const inningsOf = (side: Stage2Side) =>
  side.ds.all("innings") as unknown as InningsRow[];

/**
 * A match scored by an app version that kept the per-ball fields on the
 * match: the counter and the client action memory on the match only.
 */
async function legacyShaped(seq: number, recent: string[]) {
  const side = stage2Driver(syntheticTables({ overs_per_innings: 3 }), true);
  const replay = new GoldenReplay(side, "M", SYNTHETIC_ROSTERS);
  for (const runs of [1, 0, 4]) {
    await replay.step({ kind: "ball", ball: { runs } });
  }
  for (const inn of side.ds.all("innings")) {
    await rewrite(side, "innings", inn.id, (d) => {
      delete d.last_ball_seq;
      delete d.recent_client_actions;
    });
  }
  await rewrite(side, "matches", "M", (d) => {
    Object.assign(d, { last_ball_seq: seq, recent_client_actions: recent });
  });
  return { side, replay };
}

describe("per-ball fields migration plan", () => {
  it("copies the counter and the client action memory to the current innings", () => {
    const matches: Doc[] = [
      {
        id: "m1",
        current_innings: 2,
        last_ball_seq: 140,
        recent_client_actions: ["a", "b"],
      },
      { id: "m2", current_innings: 1, last_ball_seq: 0 },
      // Not started: no innings to hold the counter.
      { id: "m3", current_innings: 1, last_ball_seq: 0 },
      // Nothing to move.
      { id: "m4", current_innings: 1 },
    ];
    const innings: Doc[] = [
      { id: "i1", match_id: "m1", innings_number: 1 },
      {
        id: "i2",
        match_id: "m1",
        innings_number: 2,
        recent_client_actions: ["b", "c"],
      },
      { id: "i3", match_id: "m2", innings_number: 1, last_ball_seq: 7 },
      { id: "i4", match_id: "m4", innings_number: 1 },
    ];
    const plan = planPerBallFields({ matches, innings });
    expect(plan.updates).toEqual([
      {
        id: "i2",
        data: { last_ball_seq: 140, recent_client_actions: ["a", "b", "c"] },
      },
    ]);
    expect(plan.matchesWithoutInnings).toBe(1);
  });

  it("is idempotent, also when the memory overflows", () => {
    const ids = (p: string, n: number) =>
      Array.from({ length: n }, (_, i) => `${p}${i}`);
    const matches: Doc[] = [
      {
        id: "m1",
        current_innings: 1,
        last_ball_seq: 9,
        recent_client_actions: ids("m", 15),
      },
    ];
    const innings: Doc[] = [
      {
        id: "i1",
        match_id: "m1",
        innings_number: 1,
        recent_client_actions: ids("i", 12),
      },
    ];
    const first = planPerBallFields({ matches, innings });
    expect(first.updates).toHaveLength(1);
    const merged = first.updates[0]!.data.recent_client_actions as string[];
    expect(merged).toHaveLength(20);
    expect(merged.at(-1)).toBe("i11");
    Object.assign(innings[0]!, first.updates[0]!.data);
    expect(planPerBallFields({ matches, innings }).updates).toEqual([]);
  });

  it("merges ids exactly as the engine does", () => {
    const cases: string[][][] = [
      [
        ["a", "b"],
        ["b", "c"],
      ],
      [[], ["x"]],
      [Array.from({ length: 25 }, (_, i) => `k${i}`), ["k3", "z"]],
    ];
    for (const lists of cases) {
      expect(mergeInScript(...lists)).toEqual(mergeActionIds(...lists));
    }
  });
});

describe("the engine across the migration", () => {
  it("scores the same before and after it, and on old-shape data", async () => {
    const before = await legacyShaped(41, ["old-1"]);
    const after = await legacyShaped(41, ["old-1"]);
    expect((await apply(after.side)).updates).toHaveLength(1);
    expect((await apply(after.side)).updates).toEqual([]);

    for (const { side, replay } of [before, after]) {
      // The next ball continues the old counter.
      await replay.step({ kind: "ball", ball: { runs: 2 } });
      const balls = ballLogOf(side.ds.all("overs") as unknown as OversRow[]);
      expect(balls.at(-1)!.seq).toBe(42);
      expect(seqCounterOf(matchOf(side), ...inningsOf(side))).toBe(42);

      // A replay of an action the old version applied is still refused.
      const current = inningsOf(side).find((i) => i.innings_number === 1)!;
      const striker = current.batting!.find((b) => b.is_striker)!.user_id;
      const nonStriker = current.batting!.find(
        (b) => b.is_current_batsman && !b.is_striker,
      )!.user_id;
      const bowler = current.bowling!.find((b) => b.is_current_bowler)!.user_id;
      const count = () => ballLogOf(side.ds.all("overs") as never).length;
      const n = count();
      await recordBall(
        { ...side.ctx, clientActionId: "old-1" },
        {
          p_match_id: "M",
          p_bowler_id: bowler,
          p_batsman_id: striker,
          p_non_striker_id: nonStriker,
          p_runs_scored: 1,
        },
      );
      expect(count()).toBe(n);
    }
  });

  it("keeps counting past what an older app version wrote to the match meanwhile", async () => {
    const { side, replay } = await legacyShaped(41, []);
    await apply(side);
    // The older version records a ball: it bumps only the match's counter.
    await rewrite(side, "matches", "M", (d) => {
      d.last_ball_seq = 57;
    });
    await replay.step({ kind: "ball", ball: { runs: 1 } });
    const balls = ballLogOf(side.ds.all("overs") as unknown as OversRow[]);
    expect(balls.at(-1)!.seq).toBe(58);
    // The match document was not written by the ball.
    expect(matchOf(side).last_ball_seq).toBe(57);
  });
});
