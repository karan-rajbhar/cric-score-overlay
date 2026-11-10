/**
 * Followers hear about a result or an innings break however it came: a
 * penalty award, a retirement or an edit can now finish a match or close an
 * innings (the engine settles them as it does a delivery). The server
 * actions run over the real engine.
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
import type { OversRow } from "~/lib/firebase/scorecard";
import { matchMessage, type MatchDoc } from "~/lib/push/notify";
import { awardTeamPenalty, retirePlayer, updateBall } from "./mutations";

const ball = (runs: number): Step => ({ kind: "ball", ball: { runs } });
const balls = (n: number, runs: number) =>
  Array.from({ length: n }, () => ball(runs));

/** A one-over match on the real engine, scored by ADMIN, after `steps`. */
async function matchAfter(steps: Step[], overrides: Partial<MatchesRow> = {}) {
  const side = stage2Driver(
    syntheticTables({ overs_per_innings: 1, ...overrides }),
  );
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
    side.ds.all("matches").find((m) => m.id === "M") as unknown as MatchDoc &
      MatchesRow;
  notifyFollowersAfter.mockReset();
  return { side, match };
}

/** The one call made, as [event, the message followers get]. */
function sent(match: MatchDoc) {
  expect(notifyFollowersAfter).toHaveBeenCalledTimes(1);
  const [matchId, event, state] = notifyFollowersAfter.mock.calls[0]!;
  expect(matchId).toBe("M");
  return [event, matchMessage(match, event, state).body];
}

describe("followers and actions that are not deliveries", () => {
  beforeEach(() => notifyFollowersAfter.mockReset());

  it("hears the result of a chase a penalty award wins", async () => {
    // 7 to win; at 2/0, five penalty runs make it 7.
    const { match } = await matchAfter([...balls(6, 1), ball(1), ball(1)]);
    const res = await awardTeamPenalty("M", {
      teamId: "TB",
      runs: 5,
      reason: "Fielder's helmet",
    });
    expect(res.error).toBeNull();
    expect(match().status).toBe("completed");
    expect(sent(match())).toEqual(["result", match().result_description]);
  });

  it("hears the innings break a retirement for the last wicket makes", async () => {
    const { side, match } = await matchAfter(
      [ball(2), { kind: "ball", ball: { runs: 0, wicket: "bowled" } }],
      { wickets_per_innings: 2 },
    );
    const first = side.ds.all("innings").find((i) => i.innings_number === 1)!;
    const atCrease = (
      first.batting as Array<{ user_id: string; is_current_batsman?: boolean }>
    ).find((b) => b.is_current_batsman)!;
    const res = await retirePlayer("M", {
      playerId: atCrease.user_id,
      type: "retired_out",
    });
    expect(res.error).toBeNull();
    expect(match().current_innings).toBe(2);
    // The synthetic match has no team snapshots: "Team 1", "Team 2".
    expect(sent(match())).toEqual([
      "innings_break",
      "Innings break. Team 1 2/2 (0.2 overs). Team 2 need 3 to win.",
    ]);
  });

  it("hears the result of a chase an edited ball wins", async () => {
    const { side, match } = await matchAfter([
      ...balls(6, 1),
      ball(4),
      ball(0),
      ball(0),
    ]);
    const chase = side.ds.all("innings").find((i) => i.innings_number === 2)!;
    const over = (side.ds.all("overs") as unknown as OversRow[]).find(
      (o) => o.innings_id === chase.id,
    )!;
    const res = await updateBall({
      matchId: "M",
      ballId: over.balls[1]!.id,
      runsScored: 4,
    });
    expect(res.error).toBeNull();
    expect(match().status).toBe("completed");
    expect(sent(match())).toEqual(["result", match().result_description]);
  });

  it("tells nobody about a penalty that ends nothing", async () => {
    await matchAfter([ball(1)]);
    await awardTeamPenalty("M", { teamId: "TA", runs: 5, reason: "Time" });
    await retirePlayer("M", {
      playerId: "a1",
      type: "retired_hurt",
    });
    expect(
      notifyFollowersAfter.mock.calls.filter(([, event]) => event !== null),
    ).toEqual([]);
  });
});
