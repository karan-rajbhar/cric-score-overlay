import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  GoldenReplay,
  SYNTHETIC_ROSTERS,
  syntheticTables,
} from "../scoring/__fixtures__/golden";
import { stage2Driver } from "../scoring/__fixtures__/stage2";
import type { OversRow } from "../scorecard";
import type { BattingPerformancesRow, InningsRow } from "../types";
import {
  awardPenaltyRuns,
  replaceBatter,
  setCurrentBatsmen,
  undoLastBall,
} from "./scoring";

async function started() {
  const side = stage2Driver(syntheticTables({ overs_per_innings: 5 }), true);
  const replay = new GoldenReplay(side, "M", SYNTHETIC_ROSTERS);
  for (const runs of [1, 4, 0, 6, 2, 1, 0, 3]) {
    await replay.step({ kind: "ball", ball: { runs } });
  }
  const innings = () =>
    (side.ds.all("innings") as unknown as InningsRow[]).find(
      (i) => i.id === "INN1",
    )!;
  const batting = () => (innings().batting ?? []) as BattingPerformancesRow[];
  const crease = () => batting().filter((b) => b.is_current_batsman);
  const replace = (from: string, to: string) =>
    replaceBatter(side.ctx, { p_match_id: "M", p_from_id: from, p_to_id: to });
  return { side, innings, batting, crease, replace };
}

describe("replace_batter", () => {
  it("credits the wrong player's innings to the right one", async () => {
    const { side, innings, batting, crease, replace } = await started();
    const [first] = crease();
    const before = { ...first! };
    const totalBefore = innings().total_runs;
    const unused = SYNTHETIC_ROSTERS.TA.find(
      (id) => !batting().some((b) => b.user_id === id),
    )!;

    await replace(before.user_id, unused);

    const row = batting().find((b) => b.user_id === unused)!;
    expect(row).toMatchObject({
      runs_scored: before.runs_scored,
      balls_faced: before.balls_faced,
      fours: before.fours,
      sixes: before.sixes,
      batting_position: before.batting_position,
      is_current_batsman: true,
      is_striker: before.is_striker,
    });
    // The wrong player never batted: no row, no ball, no stand.
    expect(batting().some((b) => b.user_id === before.user_id)).toBe(false);
    const overs = side.ds.all("overs") as unknown as OversRow[];
    const balls = overs
      .filter((o) => o.innings_id === "INN1")
      .flatMap((o) => o.balls);
    expect(
      balls.some(
        (b) =>
          b.batsman_id === before.user_id ||
          b.non_striker_id === before.user_id,
      ),
    ).toBe(false);
    expect(
      (innings().partnerships ?? []).some(
        (p) =>
          p.batsman1_id === before.user_id || p.batsman2_id === before.user_id,
      ),
    ).toBe(false);
    // The score is the same.
    expect(innings().total_runs).toBe(totalBefore);
    const live = await side.ds.getById("live_state", "M");
    expect([live?.striker_name, live?.non_striker_name]).toContain(
      `Player ${unused.toUpperCase()}`,
    );
  });

  it("refuses a player who has batted, one from the other side, and a batter with nothing logged", async () => {
    const { batting, crease, replace } = await started();
    const [a, b] = crease();
    await expect(replace(a!.user_id, b!.user_id)).rejects.toThrow(
      "player_already_batted",
    );
    await expect(replace(a!.user_id, SYNTHETIC_ROSTERS.TB[0]!)).rejects.toThrow(
      "player_not_in_batting_team",
    );
    const unused = SYNTHETIC_ROSTERS.TA.filter(
      (id) => !batting().some((r) => r.user_id === id),
    );
    await expect(replace(unused[0]!, unused[1]!)).rejects.toThrow(
      "player_not_batted",
    );
  });
});

/**
 * a1 faces two dots with a2 at the other end; a2 has faced nothing but the
 * log names them. Change cannot take them off (the next recompute would
 * bring them back from the log); replacing them moves the log's entries.
 */
async function twoDots(incremental: boolean) {
  const side = stage2Driver(
    syntheticTables({ overs_per_innings: 5 }),
    incremental,
  );
  const replay = new GoldenReplay(side, "M", SYNTHETIC_ROSTERS);
  for (let i = 0; i < 2; i += 1)
    await replay.step({ kind: "ball", ball: { runs: 0 } });
  const innings = () =>
    (side.ds.all("innings") as unknown as InningsRow[]).find(
      (i) => i.id === "INN1",
    )!;
  const ids = () => (innings().batting ?? []).map((b) => b.user_id).sort();
  return { side, replay, innings, ids };
}

describe("a batter the ball log names", () => {
  for (const incremental of [true, false]) {
    it(`cannot be changed, only replaced, and stays replaced (incremental: ${incremental})`, async () => {
      const { side, replay, ids } = await twoDots(incremental);
      expect(ids()).toEqual(["a1", "a2"]);
      await expect(
        setCurrentBatsmen(side.ctx, "M", "a1", "a3"),
      ).rejects.toThrow("batter_has_batted");
      expect(ids()).toEqual(["a1", "a2"]);

      await replaceBatter(side.ctx, {
        p_match_id: "M",
        p_from_id: "a2",
        p_to_id: "a3",
      });
      expect(ids()).toEqual(["a1", "a3"]);
      // A ball and its undo, then penalty runs (a full recompute).
      await replay.step({ kind: "ball", ball: { runs: 0 } });
      await undoLastBall(side.ctx, "M");
      expect(ids()).toEqual(["a1", "a3"]);
      await awardPenaltyRuns(side.ctx, {
        p_match_id: "M",
        p_runs: 5,
        p_type: "penalty",
        p_reason: null,
      });
      expect(ids()).toEqual(["a1", "a3"]);
      await replay.step({ kind: "ball", ball: { runs: 0 } });
      expect(ids()).toEqual(["a1", "a3"]);
    });
  }

  it("gives the same scorecard on both paths", async () => {
    const cards = [];
    for (const incremental of [true, false]) {
      const { side, replay, innings } = await twoDots(incremental);
      await setCurrentBatsmen(side.ctx, "M", "a1", "a3").catch(() => null);
      await replay.step({ kind: "ball", ball: { runs: 0 } });
      const { batting, partnerships, total_balls } = innings();
      cards.push({ batting, partnerships, total_balls });
    }
    const strip = (v: unknown) =>
      JSON.parse(
        JSON.stringify(v, (k, x: unknown) =>
          k === "updated_at" || k === "created_at" ? undefined : x,
        ),
      ) as unknown;
    expect(strip(cards[0])).toEqual(strip(cards[1]));
  });

  it("counts a striker who has received only wides", async () => {
    const side = stage2Driver(syntheticTables({ overs_per_innings: 5 }), true);
    const replay = new GoldenReplay(side, "M", SYNTHETIC_ROSTERS);
    await replay.step({
      kind: "ball",
      ball: { extras: 1, extraType: "wide" },
    });
    await expect(
      setCurrentBatsmen(side.ctx, "M", "a3", "a2"),
    ).rejects.toThrow("batter_has_batted");
    // Swapping ends takes nobody off.
    await setCurrentBatsmen(side.ctx, "M", "a2", "a1");
  });

  it("still lets a new batter who has not faced be changed", async () => {
    const { side, replay, ids } = await twoDots(true);
    await replay.step({ kind: "ball", ball: { runs: 0, wicket: "bowled" } });
    await setCurrentBatsmen(side.ctx, "M", "a3", "a2");
    await setCurrentBatsmen(side.ctx, "M", "a4", "a2");
    expect(ids()).toEqual(["a1", "a2", "a4"]);
  });
});
