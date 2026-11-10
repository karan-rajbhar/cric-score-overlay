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
  type Step,
} from "~/lib/firebase/scoring/__fixtures__/golden";
import { stage2Driver } from "~/lib/firebase/scoring/__fixtures__/stage2";
import { serverClientFor } from "~/lib/firebase/server-client";
import { updateDlsTarget, updateMatchSettings } from "./mutations";

const ball = (
  runs: number,
  extra: Partial<Step & { kind: "ball" }>["ball"] = {},
): Step => ({
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
