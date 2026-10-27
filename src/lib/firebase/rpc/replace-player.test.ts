import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  GoldenReplay,
  SYNTHETIC_ROSTERS,
  syntheticTables,
} from "../scoring/__fixtures__/golden";
import { stage2Driver } from "../scoring/__fixtures__/stage2";
import { canonicalJson } from "../derive.mjs";
import { OVERS_COLLECTION, type PlayerMatchesRow } from "../scorecard";
import { rebuildStats } from "../stats.mjs";
import type { Doc } from "../datasource";
import type {
  BattingPerformancesRow,
  BowlingPerformancesRow,
  InningsRow,
  MatchesRow,
} from "../types";
import { replacePlayer } from "./scoring";

const { TA, TB } = SYNTHETIC_ROSTERS;

/**
 * One over a side: in the first innings the second ball is caught by b5,
 * so a batter is out early. `finish`: the second innings is played too
 * (the match is then over).
 */
async function played(finish: boolean) {
  const side = stage2Driver(syntheticTables({ overs_per_innings: 1 }), true);
  const replay = new GoldenReplay(side, "M", SYNTHETIC_ROSTERS);
  const first = [
    { runs: 4 },
    { runs: 0, wicket: "caught", fielder: "b5" },
    { runs: 1 },
    { runs: 2 },
    { runs: 0 },
    { runs: 1 },
  ];
  for (const ball of first) await replay.step({ kind: "ball", ball });
  if (finish) {
    for (const runs of [1, 0, 2, 0, 1, 0]) {
      await replay.step({ kind: "ball", ball: { runs } });
    }
  }
  const innings = () =>
    (side.ds.all("innings") as unknown as InningsRow[]).sort(
      (a, b) => a.innings_number - b.innings_number,
    );
  const match = () =>
    side.ds.all("matches").find((m) => m.id === "M") as unknown as MatchesRow;
  const replace = (from: string, to: string, ctx = side.ctx) =>
    replacePlayer(ctx, { p_match_id: "M", p_from_id: from, p_to_id: to });
  /** Any mention of `id` in the match's scorecards or ball log. */
  const mentioned = (id: string) =>
    JSON.stringify([
      side.ds.all("innings"),
      side.ds.all(OVERS_COLLECTION),
    ]).includes(JSON.stringify(id));
  const unused = (roster: string[]) => roster.find((id) => !mentioned(id))!;
  const outBatter = () =>
    (innings()[0]!.batting as BattingPerformancesRow[]).find((b) => b.is_out)!;
  return { side, innings, match, replace, mentioned, unused, outBatter };
}

const strip = (docs: Doc[]) =>
  docs
    .map((d) => {
      const c: Record<string, unknown> = { ...d };
      delete c.updated_at;
      delete c.last_updated;
      return canonicalJson(c);
    })
    .sort();

describe("replace_player", () => {
  it("after the match: a batter who was out gets their whole innings credited to the right player", async () => {
    const { side, innings, match, replace, mentioned, unused, outBatter } =
      await played(true);
    expect(match().status).toBe("completed");
    const wrong = { ...outBatter() };
    const right = unused(TA);
    const totals = innings().map((i) => [i.total_runs, i.total_wickets]);

    await replace(wrong.user_id, right);

    expect(mentioned(wrong.user_id)).toBe(false);
    const row = (innings()[0]!.batting as BattingPerformancesRow[]).find(
      (b) => b.user_id === right,
    );
    expect(row).toMatchObject({
      runs_scored: wrong.runs_scored,
      balls_faced: wrong.balls_faced,
      is_out: true,
      dismissal_type: "caught",
      batting_position: wrong.batting_position,
    });
    expect(
      innings()[0]!.fall_of_wickets?.some((f) => f.batsman_out_id === right),
    ).toBe(true);
    // The score and the result stand.
    expect(innings().map((i) => [i.total_runs, i.total_wickets])).toEqual(
      totals,
    );
    expect(match().status).toBe("completed");

    // Their record and statistics move with them; nothing else changes.
    const records = side.ds.all("player_matches");
    expect(records.some((r) => r.user_id === wrong.user_id)).toBe(false);
    expect(records.find((r) => r.user_id === right)).toBeTruthy();
    const rebuilt = rebuildStats(
      records as unknown as PlayerMatchesRow[],
      new Map(side.ds.all("users").map((u) => [u.id, u])),
      "x",
    );
    expect(strip(side.ds.all("player_career_stats"))).toEqual(
      strip(rebuilt.careers as Doc[]),
    );
  });

  it("during the match: a batter already out, which the crease's Change cannot reach", async () => {
    const { innings, match, replace, mentioned, unused, outBatter } =
      await played(false);
    expect(match().status).toBe("live");
    const wrong = outBatter().user_id;
    const right = unused(TA);
    await replace(wrong, right);
    expect(mentioned(wrong)).toBe(false);
    expect(
      (innings()[0]!.batting as BattingPerformancesRow[]).find(
        (b) => b.user_id === right,
      )?.is_out,
    ).toBe(true);
  });

  it("moves a fielder's catch and a bowler's spell, and the player of the match award", async () => {
    const { side, innings, replace, mentioned, unused } = await played(true);
    // The catcher.
    const sub = unused(TB);
    await replace("b5", sub);
    expect(mentioned("b5")).toBe(false);
    expect(
      innings()[0]!.fall_of_wickets?.find((f) => f.dismissal_type === "caught")
        ?.fielder_id,
    ).toBe(sub);

    // The first innings' bowler, also player of the match.
    const bowler = (innings()[0]!.bowling as BowlingPerformancesRow[])[0]!;
    await side.ds.update("matches", "M", {
      player_of_the_match_id: bowler.user_id,
    });
    const right = unused(TB);
    await replace(bowler.user_id, right);
    expect(
      (innings()[0]!.bowling as BowlingPerformancesRow[]).find(
        (b) => b.user_id === right,
      ),
    ).toMatchObject({
      wickets_taken: bowler.wickets_taken,
      runs_conceded: bowler.runs_conceded,
    });
    const after = await side.ds.getById("matches", "M");
    expect(after?.player_of_the_match_id).toBe(right);
  });

  it("refuses to merge two players, to cross teams, to replace nobody, and non-scorers", async () => {
    const { side, replace, unused, outBatter } = await played(true);
    const wrong = outBatter().user_id;
    // Someone who played in the match: their figures would merge.
    await expect(replace(wrong, "b5")).rejects.toThrow("player_already_in_match");
    // Someone from the other team's squad.
    await expect(replace(wrong, unused(TB))).rejects.toThrow(
      "player_not_in_team",
    );
    // Nobody to replace.
    await expect(replace(unused(TA), wrong)).rejects.toThrow(
      "player_not_in_match",
    );
    await expect(replace(wrong, wrong)).rejects.toThrow("invalid_input");
    await expect(
      replace(wrong, unused(TA), { ...side.ctx, uid: "stranger" }),
    ).rejects.toThrow("not_authorized");
  });
});
