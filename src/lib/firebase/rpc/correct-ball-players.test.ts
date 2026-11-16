import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  GoldenReplay,
  SYNTHETIC_ROSTERS,
  syntheticTables,
} from "../scoring/__fixtures__/golden";
import { stage2Driver } from "../scoring/__fixtures__/stage2";
import { canonicalJson } from "../derive.mjs";
import {
  ballLogOf,
  OVERS_COLLECTION,
  type OversRow,
  type PlayerMatchesRow,
} from "../scorecard";
import { rebuildStats } from "../stats.mjs";
import type { Doc } from "../datasource";
import type {
  BallByBallRow,
  BattingPerformancesRow,
  BowlingPerformancesRow,
  InningsRow,
  MatchesRow,
} from "../types";
import {
  correctBallPlayers,
  correctOverBowler,
  swapBatters,
  updateBall,
  type BallPlayersFix,
} from "./scoring";

const { TA } = SYNTHETIC_ROSTERS;

/**
 * One over a side, both played: in the first innings the second ball is
 * caught, so a new batter comes in.
 */
async function played() {
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
  for (const runs of [1, 0, 2, 0, 1, 0]) {
    await replay.step({ kind: "ball", ball: { runs } });
  }
  const innings = () =>
    (side.ds.all("innings") as unknown as InningsRow[]).sort(
      (a, b) => a.innings_number - b.innings_number,
    );
  const match = () =>
    side.ds.all("matches").find((m) => m.id === "M") as unknown as MatchesRow;
  const balls = (n: number): BallByBallRow[] =>
    ballLogOf(
      (side.ds.all(OVERS_COLLECTION) as unknown as OversRow[]).filter(
        (o) => o.innings_id === innings()[n]!.id,
      ),
    );
  const correct = (n: number, fixes: BallPlayersFix[], ctx = side.ctx) =>
    correctBallPlayers(ctx, {
      p_match_id: "M",
      p_innings_id: innings()[n]!.id,
      p_balls: fixes,
    });
  const row = (n: number, userId: string) =>
    (innings()[n]!.batting as BattingPerformancesRow[]).find(
      (b) => b.user_id === userId,
    );
  const swap = (n: number, from: string, to: string | null, ctx = side.ctx) =>
    swapBatters(ctx, {
      p_match_id: "M",
      p_innings_id: innings()[n]!.id,
      p_from_ball_id: from,
      p_to_ball_id: to,
    });
  const overBowler = (n: number, over: number, bowler: string, ctx = side.ctx) =>
    correctOverBowler(ctx, {
      p_match_id: "M",
      p_innings_id: innings()[n]!.id,
      p_over_number: over,
      p_bowler_id: bowler,
    });
  const lastChange = () =>
    (side.ds.all("live_state").find((d) => d.id === "M") as
      | { last_change?: Record<string, unknown> }
      | undefined)?.last_change;
  return {
    side,
    innings,
    match,
    balls,
    correct,
    row,
    swap,
    overBowler,
    lastChange,
  };
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

function expectStatsRebuilt(side: Awaited<ReturnType<typeof played>>["side"]) {
  const rebuilt = rebuildStats(
    side.ds.all("player_matches") as unknown as PlayerMatchesRow[],
    new Map(side.ds.all("users").map((u) => [u.id, u])),
    "x",
  );
  expect(strip(side.ds.all("player_career_stats"))).toEqual(
    strip(rebuilt.careers as Doc[]),
  );
}

describe("correct_ball_players", () => {
  it("the batters the wrong way round from a wicket given to the wrong one: each gets their own balls", async () => {
    const { side, innings, match, balls, correct, row } = await played();
    const log = balls(0);
    const wicket = log.find((b) => b.is_wicket)!;
    const given = wicket.batsman_id!; // given out
    const really = wicket.non_striker_id!; // who was out
    const totals = innings().map((i) => [i.total_runs, i.total_wickets]);
    const result = match().result_description;

    // The wicket was `really`'s; everything the log gives `really` after it
    // was `given`'s, who batted on.
    const after = log.filter((b) => (b.seq ?? 0) > (wicket.seq ?? 0));
    const swap = (id: string | null | undefined) =>
      id === really ? given : (id ?? null);
    await correct(0, [
      {
        ball_id: wicket.id,
        batsman_id: really,
        non_striker_id: given,
        dismissed_player_id: really,
      },
      ...after.map((b) => ({
        ball_id: b.id,
        batsman_id: swap(b.batsman_id)!,
        non_striker_id: swap(b.non_striker_id),
      })),
    ]);

    const fixed = balls(0);
    expect(fixed.find((b) => b.id === wicket.id)).toMatchObject({
      batsman_id: really,
      non_striker_id: given,
      dismissed_player_id: really,
      runs_scored: wicket.runs_scored,
      bowler_id: wicket.bowler_id,
      fielder_id: wicket.fielder_id,
    });
    expect(
      fixed.some(
        (b) =>
          (b.seq ?? 0) > (wicket.seq ?? 0) &&
          (b.batsman_id === really || b.non_striker_id === really),
      ),
    ).toBe(false);

    const ranAfter = after
      .filter((b) => b.batsman_id === really)
      .reduce((s, b) => s + (b.runs_scored ?? 0), 0);
    expect(row(0, really)).toMatchObject({
      is_out: true,
      dismissal_type: "caught",
      runs_scored: 0,
      balls_faced: 1,
    });
    expect(row(0, given)).toMatchObject({
      is_out: false,
      runs_scored: 4 + ranAfter,
    });
    expect(innings()[0]!.fall_of_wickets?.[0]?.batsman_out_id).toBe(really);
    // The batting order follows the log: the openers keep theirs.
    expect(
      [...(innings()[0]!.batting as BattingPerformancesRow[])]
        .sort((a, b) => (a.batting_position ?? 0) - (b.batting_position ?? 0))
        .map((b) => b.batting_position),
    ).toEqual([1, 2, 3]);
    expect(row(0, given)?.batting_position).toBe(1);

    // The score and the result stand; records and statistics follow.
    expect(innings().map((i) => [i.total_runs, i.total_wickets])).toEqual(
      totals,
    );
    expect(match().status).toBe("completed");
    expect(match().result_description).toBe(result);
    expectStatsRebuilt(side);
  });

  it("an over credited to a duplicate of a player who batted: one player, one record", async () => {
    const { side, innings, balls, correct, row } = await played();
    // A first-innings batter who did not bowl in the second innings.
    const real = (innings()[0]!.batting as BattingPerformancesRow[]).find(
      (b) =>
        !(innings()[1]!.bowling as BowlingPerformancesRow[]).some(
          (w) => w.user_id === b.user_id,
        ),
    )!.user_id;
    expect(row(0, real)).toBeTruthy();
    const over = balls(1);
    const dup = over[0]!.bowler_id!;
    const figures = (innings()[1]!.bowling as BowlingPerformancesRow[]).find(
      (w) => w.user_id === dup,
    )!;

    await correct(
      1,
      over.map((b) => ({ ball_id: b.id, bowler_id: real })),
    );

    const bowling = innings()[1]!.bowling as BowlingPerformancesRow[];
    expect(bowling.some((w) => w.user_id === dup)).toBe(false);
    expect(bowling.find((w) => w.user_id === real)).toMatchObject({
      balls_bowled: figures.balls_bowled,
      runs_conceded: figures.runs_conceded,
      wickets_taken: figures.wickets_taken,
    });
    const records = side.ds.all("player_matches");
    expect(records.filter((r) => r.user_id === real)).toHaveLength(1);
    // The duplicate keeps a record only for what else it did (batting).
    expect(records.some((r) => r.user_id === dup)).toBe(
      row(0, dup) !== undefined,
    );
    expectStatsRebuilt(side);
  });

  it("swap_batters from a wicket to the end: the wicket and the innings after it go to the right batters", async () => {
    const { side, innings, balls, swap, row, lastChange } = await played();
    const log = balls(0);
    const wicket = log.find((b) => b.is_wicket)!;
    const given = wicket.batsman_id!;
    const really = wicket.non_striker_id!;
    const ranAfter = log
      .filter((b) => (b.seq ?? 0) > (wicket.seq ?? 0) && b.batsman_id === really)
      .reduce((s, b) => s + (b.runs_scored ?? 0), 0);
    const totals = innings().map((i) => [i.total_runs, i.total_wickets]);

    await swap(0, wicket.id, null);

    expect(row(0, really)).toMatchObject({
      is_out: true,
      dismissal_type: "caught",
      balls_faced: 1,
    });
    expect(row(0, given)).toMatchObject({
      is_out: false,
      runs_scored: 4 + ranAfter,
    });
    expect(innings().map((i) => [i.total_runs, i.total_wickets])).toEqual(
      totals,
    );
    expect(lastChange()?.correction).toMatchObject({
      kind: "swap_batters",
      innings_number: 1,
      over: wicket.over_number,
      ball: wicket.ball_number,
      to_over: null,
      from_id: given,
      to_id: really,
    });
    expectStatsRebuilt(side);
  });

  it("swap_batters over a range leaves the balls after it as recorded", async () => {
    const { balls, swap } = await played();
    const log = balls(0);
    const [first, second] = log;
    await swap(0, first!.id, first!.id);
    const after = balls(0);
    expect(after[0]).toMatchObject({
      batsman_id: first!.non_striker_id,
      non_striker_id: first!.batsman_id,
    });
    // The second ball (the wicket) and everything after it are untouched.
    expect(after.slice(1).map((b) => [b.batsman_id, b.non_striker_id])).toEqual(
      log.slice(1).map((b) => [b.batsman_id, b.non_striker_id]),
    );
    expect(second!.is_wicket).toBe(true);
  });

  it("correct_over_bowler moves a whole over and says so; again it changes nothing", async () => {
    const { innings, balls, overBowler, lastChange } = await played();
    const real = (innings()[0]!.batting as BattingPerformancesRow[]).find(
      (b) =>
        !(innings()[1]!.bowling as BowlingPerformancesRow[]).some(
          (w) => w.user_id === b.user_id,
        ),
    )!.user_id;
    const before = balls(1)[0]!.bowler_id;

    await overBowler(1, 0, real);

    expect(balls(1).every((b) => !b.bowler_id || b.bowler_id === real)).toBe(true);
    expect(lastChange()?.correction).toMatchObject({
      kind: "over_bowler",
      innings_number: 2,
      over: 0,
      from_id: before,
      to_id: real,
    });
    const version = (lastChange() as { at?: string } | undefined)?.at;
    await overBowler(1, 0, real);
    expect((lastChange() as { at?: string } | undefined)?.at).toBe(version);
    await expect(overBowler(1, 5, real)).rejects.toThrow("over_not_found");
  });

  it("refuses naming a batter at the crease after they were out", async () => {
    const { balls, correct } = await played();
    const log = balls(0);
    const wicket = log.find((b) => b.is_wicket)!;
    const out = wicket.batsman_id!;
    const later = log.find(
      (b) => (b.seq ?? 0) > (wicket.seq ?? 0) && b.batsman_id !== out,
    )!;
    await expect(
      correct(0, [{ ball_id: later.id, batsman_id: out }]),
    ).rejects.toThrow("batter_already_out");
  });

  it("applies a re-sent correction once", async () => {
    const { side, balls, overBowler, innings } = await played();
    const real = (innings()[0]!.batting as BattingPerformancesRow[])[0]!.user_id;
    const other = (innings()[0]!.batting as BattingPerformancesRow[])[1]!.user_id;
    const ctx = { ...side.ctx, clientActionId: "q-1" };
    await overBowler(1, 0, real, ctx);
    // The scorer changes it again by hand; the old queued action comes back.
    await overBowler(1, 0, other);
    await overBowler(1, 0, real, ctx);
    expect(balls(1).filter((b) => b.bowler_id).every((b) => b.bowler_id === other)).toBe(
      true,
    );
  });

  it("update_ball: a wicket added before the batter batted on needs who came in", async () => {
    const { side, innings, balls, row } = await played();
    const log = balls(0);
    // Ball 1: a four by the opener, who is then caught at ball 2.
    const first = log[0]!;
    const opener = first.batsman_id!;
    const edit = (later: string | null) =>
      updateBall(side.ctx, {
        p_match_id: "M",
        p_ball_id: first.id,
        p_runs_scored: 0,
        p_extras: 0,
        p_is_wicket: true,
        p_dismissal_type: "bowled",
        p_later_batter_id: later,
      });
    // Out at ball 1 and still facing ball 2: refused.
    await expect(edit(null)).rejects.toThrow("batter_already_out");
    const unused = TA.find(
      (id) => !JSON.stringify(side.ds.all("innings")).includes(JSON.stringify(id)),
    )!;
    await edit(unused);
    const after = balls(0);
    expect(after[0]).toMatchObject({ is_wicket: true, dismissed_player_id: opener });
    // Ball 2 (the catch) was the batter who came in.
    expect(after[1]).toMatchObject({ batsman_id: unused, dismissed_player_id: unused });
    expect(after.slice(1).some((b) => b.batsman_id === opener || b.non_striker_id === opener)).toBe(false);
    expect(row(0, opener)).toMatchObject({ is_out: true, dismissal_type: "bowled", balls_faced: 1 });
    expect(row(0, unused)).toMatchObject({ is_out: true, dismissal_type: "caught" });
    expect(innings()[0]!.total_wickets).toBe(2);
    expectStatsRebuilt(side);
  });

  it("refuses what cannot have happened, players from elsewhere and non-scorers", async () => {
    const { side, balls, correct } = await played();
    const log = balls(0);
    const wicket = log.find((b) => b.is_wicket)!;
    const plain = log.find((b) => !b.is_wicket)!;
    const unused = TA.find(
      (id) => !JSON.stringify(side.ds.all("innings")).includes(JSON.stringify(id)),
    )!;

    await expect(correct(0, [])).rejects.toThrow("invalid_input");
    await expect(
      correct(0, [{ ball_id: plain.id, non_striker_id: plain.batsman_id }]),
    ).rejects.toThrow("invalid_input");
    // Caught: only the striker can be out.
    await expect(
      correct(0, [
        { ball_id: wicket.id, dismissed_player_id: wicket.non_striker_id },
      ]),
    ).rejects.toThrow("invalid_input");
    await expect(
      correct(0, [{ ball_id: plain.id, dismissed_player_id: plain.batsman_id }]),
    ).rejects.toThrow("invalid_input");
    // A batter from the fielding side, a bowler from the batting side.
    await expect(
      correct(0, [{ ball_id: plain.id, batsman_id: "b9" }]),
    ).rejects.toThrow("player_not_in_team");
    await expect(
      correct(0, [{ ball_id: plain.id, bowler_id: unused }]),
    ).rejects.toThrow("player_not_in_team");
    await expect(
      correct(0, [{ ball_id: "nope", batsman_id: unused }]),
    ).rejects.toThrow("ball_not_found");
    await expect(
      correct(0, [{ ball_id: plain.id, batsman_id: unused }], {
        ...side.ctx,
        uid: "stranger",
      }),
    ).rejects.toThrow("not_authorized");
  });
});
