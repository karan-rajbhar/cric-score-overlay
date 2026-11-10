/**
 * A penalty award, a retirement or an edit can now finish a match or close
 * an innings (the engine settles them as it does a delivery). Then, as
 * after a delivery, followers hear about it, and a finished match gets its
 * player of the match and its tournament pages revalidated. The server
 * actions run over the real engine.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("~/lib/match-cache", async (importOriginal) => ({
  ...(await importOriginal<typeof import("~/lib/match-cache")>()),
  invalidateMatchCache: vi.fn(),
}));
const server: { client: unknown } = { client: null };
vi.mock("~/lib/firebase/server", () => ({
  createServerClient: async () => server.client,
}));
const notifyFollowersAfter = vi.fn();
vi.mock("~/lib/push/notify", async (importOriginal) => ({
  ...(await importOriginal<typeof import("~/lib/push/notify")>()),
  notifyFollowersAfter: (...args: unknown[]) => notifyFollowersAfter(...args),
}));

import { revalidatePath } from "next/cache";
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
import {
  awardTeamPenalty,
  endInnings,
  retirePlayer,
  updateBall,
} from "./mutations";

/** A match id as the app makes them (getMatch reads only those). */
const M = "5f1e0c2a-3b4d-4e6f-8a9b-0c1d2e3f4a5b";

const ball = (runs: number): Step => ({ kind: "ball", ball: { runs } });
const balls = (n: number, runs: number) =>
  Array.from({ length: n }, () => ball(runs));

/** A one-over match on the real engine, scored by ADMIN, after `steps`. */
async function matchAfter(steps: Step[], overrides: Partial<MatchesRow> = {}) {
  const tables = syntheticTables({ overs_per_innings: 1, ...overrides });
  for (const doc of tables.matches!) doc.id = M;
  for (const doc of tables.innings!) doc.match_id = M;
  const side = stage2Driver(tables);
  const replay = new GoldenReplay(side, M, SYNTHETIC_ROSTERS);
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
    side.ds.all("matches").find((m) => m.id === M) as unknown as MatchDoc &
      MatchesRow;
  /** The ball `index` of innings `n`'s first over. */
  const ballOf = (n: number, index: number) => {
    const innings = side.ds.all("innings").find((i) => i.innings_number === n)!;
    const over = (side.ds.all("overs") as unknown as OversRow[]).find(
      (o) => o.innings_id === innings.id,
    )!;
    return over.balls[index]!.id;
  };
  notifyFollowersAfter.mockReset();
  vi.mocked(revalidatePath).mockClear();
  return { side, match, ballOf };
}

/** The one call made, as [event, the message followers get]. */
function sent(match: MatchDoc) {
  expect(notifyFollowersAfter).toHaveBeenCalledTimes(1);
  const [matchId, event, state] = notifyFollowersAfter.mock.calls[0]!;
  expect(matchId).toBe(M);
  return [event, matchMessage(match, event, state).body];
}

describe("followers and actions that are not deliveries", () => {
  it("hears the result of a chase a penalty award wins", async () => {
    // 7 to win; at 2/0, five penalty runs make it 7.
    const { match } = await matchAfter([...balls(6, 1), ball(1), ball(1)]);
    const res = await awardTeamPenalty(M, {
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
    const res = await retirePlayer(M, {
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
    const { match, ballOf } = await matchAfter([
      ...balls(6, 1),
      ball(4),
      ball(0),
      ball(0),
    ]);
    const res = await updateBall({
      matchId: M,
      ballId: ballOf(2, 1),
      runsScored: 4,
    });
    expect(res.error).toBeNull();
    expect(match().status).toBe("completed");
    expect(sent(match())).toEqual(["result", match().result_description]);
  });

  it("tells nobody about a penalty that ends nothing", async () => {
    await matchAfter([ball(1)]);
    await awardTeamPenalty(M, { teamId: "TA", runs: 5, reason: "Time" });
    await retirePlayer(M, {
      playerId: "a1",
      type: "retired_hurt",
    });
    expect(notifyFollowersAfter).not.toHaveBeenCalled();
  });
});

/** The tournament pages revalidated. */
const revalidatedTournaments = () =>
  vi
    .mocked(revalidatePath)
    .mock.calls.map(([path]) => path)
    .filter((p) => p.startsWith("/tournaments"));

describe("a match finished by an action that is not a delivery", () => {
  beforeEach(() => vi.mocked(revalidatePath).mockClear());

  it("gets its player of the match when an edit wins the chase", async () => {
    const { match, ballOf } = await matchAfter([
      ...balls(6, 1),
      ball(4),
      ball(0),
      ball(0),
    ]);
    await updateBall({ matchId: M, ballId: ballOf(2, 1), runsScored: 4 });
    expect(match().status).toBe("completed");
    expect(match().player_of_the_match_id).toEqual(expect.any(String));
    expect(revalidatedTournaments()).toEqual([
      "/tournaments/T1",
      "/tournaments",
    ]);
  });

  it("gets its player of the match when penalty runs win the chase", async () => {
    const { match } = await matchAfter([...balls(6, 1), ball(1), ball(1)]);
    await awardTeamPenalty(M, { teamId: "TB", runs: 5, reason: "Helmet" });
    expect(match().player_of_the_match_id).toEqual(expect.any(String));
    expect(revalidatedTournaments()).toEqual([
      "/tournaments/T1",
      "/tournaments",
    ]);
  });

  it("leaves the player of the match of an edited finished match alone", async () => {
    const { side, match, ballOf } = await matchAfter([
      ...balls(6, 1),
      ...balls(2, 4),
    ]);
    expect(match().status).toBe("completed");
    await side.ds.update("matches", M, { player_of_the_match_id: "b9" });
    await updateBall({ matchId: M, ballId: ballOf(1, 0), runsScored: 2 });
    expect(match().status).toBe("completed");
    expect(match().player_of_the_match_id).toBe("b9");
  });

  it("leaves the player of the match alone when a queued End innings arrives late", async () => {
    // The chase is won by a ball; an End innings naming innings 2, queued
    // offline before that ball's reply, then changes nothing.
    const { side, match } = await matchAfter([...balls(6, 1), ...balls(2, 4)]);
    expect(match().status).toBe("completed");
    await side.ds.update("matches", M, { player_of_the_match_id: "b9" });
    const res = await endInnings(M, null, 2);
    expect(res.error).toBeNull();
    expect(res.data).toMatchObject({ match_completed: true });
    expect(match().player_of_the_match_id).toBe("b9");
    expect(revalidatedTournaments()).toEqual([]);
  });
});
