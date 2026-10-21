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
import { replaceBatter } from "./scoring";

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
