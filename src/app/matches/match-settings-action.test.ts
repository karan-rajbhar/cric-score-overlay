/**
 * `updateMatchSettings` over the real engine: what a save from the Match
 * settings dialog does to the chase's target, its DLS revision and the
 * stored scorecards.
 */
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("~/lib/match-cache", () => ({ invalidateMatchCache: vi.fn() }));
const server: { client: unknown } = { client: null };
vi.mock("~/lib/firebase/server", () => ({
  createServerClient: async () => server.client,
}));

import type { AppUser } from "~/lib/firebase/auth-types";
import type { MatchesRow } from "~/lib/firebase/types";
import {
  ADMIN,
  GoldenReplay,
  SYNTHETIC_ROSTERS,
  syntheticTables,
  type BallSpec,
  type Step,
} from "~/lib/firebase/scoring/__fixtures__/golden";
import { stage2Driver } from "~/lib/firebase/scoring/__fixtures__/stage2";
import { serverClientFor } from "~/lib/firebase/server-client";
import {
  updateDlsTarget,
  updateMatchSettings,
  updateTargetRuns,
} from "./mutations";

const ball = (runs: number, extra: BallSpec = {}): Step => ({
  kind: "ball",
  ball: { runs, ...extra },
});

/** A match on the real engine, scored by ADMIN, after `steps`. */
async function matchAfter(steps: Step[], overrides: Partial<MatchesRow> = {}) {
  const side = stage2Driver(syntheticTables(overrides));
  const replay = new GoldenReplay(side, "M", SYNTHETIC_ROSTERS);
  for (const step of steps) await replay.step(step);
  server.client = serverClientFor({
    ds: side.ds,
    db: null,
    getUser: async (): Promise<AppUser> => ({
      id: ADMIN,
      email: null,
      phone: null,
      user_metadata: {},
    }),
  });
  const match = () =>
    side.ds.all("matches").find((m) => m.id === "M") as unknown as MatchesRow;
  const innings = (n: number) =>
    side.ds.all("innings").find((i) => i.innings_number === n) as
      | { id: string; target_runs: number | null }
      | undefined;
  return { side, replay, match, innings };
}

/** A whole first innings of the synthetic match's 2 overs. */
const firstInnings = (runs: number) =>
  Array.from({ length: 12 }, () => ball(runs));

describe("updateMatchSettings and the chase's target", () => {
  it("keeps a DLS revision when the save does not change the target", async () => {
    const { match, innings } = await matchAfter([...firstInnings(1), ball(1)]);
    expect(match().current_innings).toBe(2);
    // 13 to win from 2 overs, revised to 5 from 1.
    expect(await updateDlsTarget("M", innings(2)!.id, 5, 1)).toEqual({
      success: true,
      error: null,
    });
    expect(match().dls_revision).toEqual({
      innings_number: 2,
      target_runs: 5,
      overs: 1,
    });

    // The dialog's payload: the target it was opened with, unchanged.
    expect(
      await updateMatchSettings("M", { freeHit: false, targetRuns: 5 }),
    ).toEqual({ success: true, error: null });
    expect(match().free_hit).toBe(false);
    expect(match().dls_revision).toEqual({
      innings_number: 2,
      target_runs: 5,
      overs: 1,
    });
    expect(innings(2)!.target_runs).toBe(5);

    // Nothing about the target at all: the same.
    await updateMatchSettings("M", { goldenBall: true });
    expect(match().dls_revision).not.toBeNull();
  });

  it("replaces the revision with a target typed by hand", async () => {
    const { match, innings } = await matchAfter(firstInnings(1));
    await updateDlsTarget("M", innings(2)!.id, 5, 1);
    expect(await updateMatchSettings("M", { targetRuns: 6 })).toEqual({
      success: true,
      error: null,
    });
    expect(innings(2)!.target_runs).toBe(6);
    expect(match().dls_revision).toBeNull();
  });

  it("leaves a super-over chase's target alone", async () => {
    const { match, innings } = await matchAfter(
      [
        // 4 each in one over: a tie.
        ball(4),
        ...Array.from({ length: 5 }, () => ball(0)),
        ball(2),
        ball(2),
        ...Array.from({ length: 4 }, () => ball(0)),
        { kind: "super_over" },
        ball(1),
        ball(0, { wicket: "bowled" }),
        ball(0, { extras: 1, extraType: "wide" }),
        ball(0, { wicket: "caught", fielder: "a1" }),
      ],
      { overs_per_innings: 1 },
    );
    expect(match().current_innings).toBe(4);
    const target = innings(4)!.target_runs;
    expect(target).toBe(3);

    await updateMatchSettings("M", { freeHit: false });
    expect(innings(4)!.target_runs).toBe(target);
    await updateMatchSettings("M", { freeHit: true, targetRuns: target });
    expect(innings(4)!.target_runs).toBe(target);
    // The main match's chase keeps its own.
    expect(innings(2)!.target_runs).toBe(5);
  });
});

describe("updateMatchSettings refusing a target", () => {
  it("refuses a target outside a chase", async () => {
    const { innings } = await matchAfter([ball(1)]);
    expect((await updateMatchSettings("M", { targetRuns: 50 })).error).toBe(
      "A target can be set only during a chase",
    );
    expect(innings(1)!.target_runs).toBeNull();
  });

  it("refuses a target below 1 run in a chase", async () => {
    const { innings } = await matchAfter(firstInnings(1));
    expect((await updateMatchSettings("M", { targetRuns: 0 })).error).toBe(
      "The target must be at least 1 run",
    );
    expect(innings(2)!.target_runs).toBe(13);
  });
});

/** What a recompute of the ball log decides, per innings. */
function scorecards(side: { ds: { all(t: string): Record<string, unknown>[] } }) {
  return side.ds
    .all("innings")
    .sort((a, b) => Number(a.innings_number) - Number(b.innings_number))
    .map((i) => ({
      n: i.innings_number,
      total_runs: i.total_runs,
      total_balls: i.total_balls,
      batting: i.batting,
      bowling: i.bowling,
      partnerships: i.partnerships,
    }));
}

/** Every stored innings equals a fresh recompute of its ball log. */
async function expectRecomputed(
  side: Parameters<typeof scorecards>[0],
  replay: GoldenReplay,
) {
  const stored = scorecards(side);
  for (const { n } of stored) {
    await replay.step({ kind: "recompute", innings: Number(n) });
  }
  expect(stored).toEqual(scorecards(side));
}

const wide = (extras: number) => ball(0, { extras, extraType: "wide" });

describe("updateMatchSettings changing the rules mid-match", () => {
  it.each([
    { wideRunsToBatsman: true },
    { wideCountsAsBallFaced: true },
    { noballExtrasToBatsman: true },
    { noBallCountsAsBallFaced: false },
  ])("recomputes every innings after %o", async (rule) => {
    const { side, replay } = await matchAfter([
      wide(3),
      ball(1, { extras: 1, extraType: "no_ball" }),
      ...firstInnings(1),
      wide(2),
      ball(2, { extras: 1, extraType: "no_ball" }),
    ]);
    expect(await updateMatchSettings("M", rule)).toEqual({
      success: true,
      error: null,
    });
    await replay.step(ball(1));
    await expectRecomputed(side, replay);
  });

  it("changes the balls an over while no over has a ball", async () => {
    const { match } = await matchAfter([wide(1)]);
    expect(await updateMatchSettings("M", { ballsPerOver: 8 })).toEqual({
      success: true,
      error: null,
    });
    expect(match().balls_per_over).toBe(8);
  });

  it("refuses another number of balls an over once a ball is bowled", async () => {
    const { match } = await matchAfter([ball(1)]);
    expect((await updateMatchSettings("M", { ballsPerOver: 8 })).error).toBe(
      "Balls per over cannot change once a ball has been bowled",
    );
    expect(match().balls_per_over).toBe(6);
    // The dialog sends the value it showed: unchanged is fine.
    expect(
      (await updateMatchSettings("M", { ballsPerOver: 6, freeHit: false }))
        .error,
    ).toBeNull();
    expect(match().free_hit).toBe(false);
  });

  it("refuses overs the innings in play has already bowled", async () => {
    const { match } = await matchAfter(
      Array.from({ length: 13 }, () => ball(0)),
      { overs_per_innings: 3 },
    );
    for (const overs of [1, 2]) {
      expect(
        (await updateMatchSettings("M", { oversPerInnings: overs })).error,
      ).toBe("The overs must be more than the overs already bowled");
    }
    expect(match().overs_per_innings).toBe(3);
    expect(
      (await updateMatchSettings("M", { oversPerInnings: 4 })).error,
    ).toBeNull();
    expect(match().overs_per_innings).toBe(4);
  });
});

describe("updateTargetRuns (Revise target / overs)", () => {
  it("revises the chase's overs and leaves the first innings' alone", async () => {
    const { match, innings, replay } = await matchAfter(firstInnings(1));
    expect(
      await updateTargetRuns("M", { targetRuns: 9, overs: 1 }),
    ).toEqual({ success: true, error: null });
    expect(innings(2)!.target_runs).toBe(9);
    expect(match().overs_per_innings).toBe(2);
    expect(match().dls_revision).toEqual({
      innings_number: 2,
      target_runs: 9,
      overs: 1,
    });
    // The engine ends the chase at the revised over.
    for (let i = 0; i < 6; i += 1) await replay.step(ball(1));
    expect(match()).toMatchObject({ status: "completed", winning_team_id: "TA" });
  });

  it("takes a target at the full overs as one set by hand", async () => {
    const { match, innings } = await matchAfter(firstInnings(1));
    await updateDlsTarget("M", innings(2)!.id, 9, 1);
    expect(
      await updateTargetRuns("M", { targetRuns: 15, overs: 2 }),
    ).toEqual({ success: true, error: null });
    expect(innings(2)!.target_runs).toBe(15);
    expect(match().dls_revision).toBeNull();
    expect(match().overs_per_innings).toBe(2);
  });

  it("refuses the first innings", async () => {
    const { match, innings } = await matchAfter([ball(1)]);
    expect((await updateTargetRuns("M", { targetRuns: 75 })).error).toBe(
      "A target can be set only during a chase",
    );
    expect(innings(1)!.target_runs).toBeNull();
    expect(match().dls_revision ?? null).toBeNull();
  });

  it("refuses a target below 1 run and overs it cannot play to", async () => {
    const { match, innings } = await matchAfter([
      ...firstInnings(1),
      ...Array.from({ length: 7 }, () => ball(0)),
    ]);
    const cases: Array<[number | null, number | null | undefined, string]> = [
      [0, null, "The target must be at least 1 run"],
      [-5, null, "The target must be at least 1 run"],
      [null, 1, "The target must be at least 1 run"],
      [10, 2.5, "The revised overs must be a whole number from 1 to 2"],
      [10, 3, "The revised overs must be a whole number from 1 to 2"],
      [10, 1, "The revised overs must be more than the overs already bowled"],
    ];
    for (const [targetRuns, overs, error] of cases) {
      expect((await updateTargetRuns("M", { targetRuns, overs })).error).toBe(
        error,
      );
    }
    expect(innings(2)!.target_runs).toBe(13);
    expect(match().dls_revision ?? null).toBeNull();
  });
});
