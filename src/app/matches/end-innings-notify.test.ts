/**
 * Ending an innings by hand tells followers, like the ball that ends one
 * does: the `endInnings` server action run over the real engine. Its reply
 * describes the innings opened next and carries no innings-break flag, so
 * nothing was sent before.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("~/lib/match-cache", () => ({ invalidateMatchCache: vi.fn() }));
const server: { client: unknown } = { client: null };
vi.mock("~/lib/firebase/server", () => ({
  createServerClient: async () => server.client,
}));
const notifyFollowersAfter = vi.fn();
vi.mock("~/lib/push/notify", async (importOriginal) => ({
  ...(await importOriginal<typeof import("~/lib/push/notify")>()),
  notifyFollowersAfter: (...args: unknown[]) => notifyFollowersAfter(...args),
}));

import type { AppUser } from "~/lib/firebase/auth-types";
import {
  ADMIN,
  GoldenReplay,
  SYNTHETIC_ROSTERS,
  syntheticTables,
} from "~/lib/firebase/scoring/__fixtures__/golden";
import { stage2Driver } from "~/lib/firebase/scoring/__fixtures__/stage2";
import { serverClientFor } from "~/lib/firebase/server-client";
import {
  matchMessage,
  type EventState,
  type MatchDoc,
} from "~/lib/push/notify";
import { endInnings } from "./mutations";

/** A match with `balls` deliveries of two runs each, scored by ADMIN. */
async function matchInPlay(balls: number) {
  const side = stage2Driver(syntheticTables({ overs_per_innings: 5 }));
  const replay = new GoldenReplay(side, "M", SYNTHETIC_ROSTERS);
  for (let i = 0; i < balls; i += 1) {
    await replay.step({ kind: "ball", ball: { runs: 2 } });
  }
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
  const stored = () =>
    side.ds.all("matches").find((m) => m.id === "M") as unknown as MatchDoc;
  return { replay, stored };
}

describe("endInnings and a match's followers", () => {
  beforeEach(() => notifyFollowersAfter.mockReset());

  it("notifies the innings break with the ended innings' score and the target", async () => {
    const { stored } = await matchInPlay(4);
    const res = await endInnings("M");
    expect(res.error).toBeNull();
    expect(res.data).toMatchObject({ current_innings: 2, total_runs: 0 });

    expect(notifyFollowersAfter).toHaveBeenCalledTimes(1);
    const [matchId, event, reply] = notifyFollowersAfter.mock.calls[0] as [
      string,
      string,
      EventState,
    ];
    expect([matchId, event]).toEqual(["M", "innings_break"]);
    expect(reply).toBe(res.data);
    expect(matchMessage(stored(), "innings_break", reply)).toMatchObject({
      key: "innings_break:1",
      body: "Innings break. Team 1 8/0 (0.4 overs). Team 2 need 9 to win.",
    });
  });

  it("notifies the result when the innings ended was the last", async () => {
    const { replay } = await matchInPlay(4);
    expect((await endInnings("M")).error).toBeNull();
    await replay.step({ kind: "ball", ball: { runs: 1 } });
    notifyFollowersAfter.mockReset();

    const res = await endInnings("M");
    expect(res.data).toMatchObject({ match_completed: true });
    expect(notifyFollowersAfter).toHaveBeenCalledTimes(1);
    expect(notifyFollowersAfter.mock.calls[0]!.slice(0, 2)).toEqual([
      "M",
      "result",
    ]);
  });

  it("notifies nobody when the innings cannot be ended", async () => {
    const { replay } = await matchInPlay(4);
    await endInnings("M");
    await replay.step({ kind: "ball", ball: { runs: 1 } });
    await endInnings("M");
    notifyFollowersAfter.mockReset();

    // The match is over: there is no open innings left to end.
    const res = await endInnings("M");
    expect(res.data).toBeNull();
    expect(res.error).toBeTruthy();
    expect(notifyFollowersAfter).not.toHaveBeenCalled();
  });
});
