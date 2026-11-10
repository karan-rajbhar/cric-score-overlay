/**
 * The scoring screen's offline queue replayed through the real replay
 * dispatch (`replayActions`, the server actions and the engine), for the
 * structural actions whose meaning depends on what the server has by then.
 */
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("~/lib/match-cache", () => ({ invalidateMatchCache: vi.fn() }));
const server: { client: unknown } = { client: null };
vi.mock("~/lib/firebase/server", () => ({
  createServerClient: async () => server.client,
}));
vi.mock("~/lib/push/notify", async (importOriginal) => ({
  ...(await importOriginal<typeof import("~/lib/push/notify")>()),
  notifyFollowersAfter: vi.fn(),
}));
vi.mock("../../queries", () => ({
  getScoringState: vi.fn(),
  getMatch: vi.fn(async () => ({ data: null, error: null })),
  getTeamPlayers: vi.fn(),
}));
vi.mock("../../../teams/actions", () => ({
  createPlayerQuick: vi.fn(),
  addExistingPlayerQuick: vi.fn(),
}));
vi.mock("sonner", () => ({
  toast: { info: vi.fn(), error: vi.fn(), success: vi.fn(), warning: vi.fn() },
}));

import { replayActions } from "~/app/api/scoring/replay/dispatch";
import type { AppUser } from "~/lib/firebase/auth-types";
import {
  A,
  ADMIN,
  B,
  GoldenReplay,
  SYNTHETIC_ROSTERS,
  syntheticTables,
} from "~/lib/firebase/scoring/__fixtures__/golden";
import { stage2Driver, type Stage2Side } from "~/lib/firebase/scoring/__fixtures__/stage2";
import { serverClientFor, type ServerClient } from "~/lib/firebase/server-client";
import type { InningsRow, MatchesRow } from "~/lib/firebase/types";
import { getDeadLetterActions, getPendingActions } from "~/lib/offline-queue";
import type { ReplayBatch } from "~/lib/scoring-replay/protocol";
import { getScoringState, getTeamPlayers } from "../../queries";
import { useScoring } from "./useScoring";

/** A one-over match, before its first ball, as the screen first reads it. */
const START = {
  match: {
    id: "M",
    status: "live",
    current_innings: 1,
    current_over: 0,
    current_ball: 0,
    overs_per_innings: 1,
    balls_per_over: 6,
    wickets_per_innings: 10,
    team1_id: "TA",
    team2_id: "TB",
    innings: [
      {
        id: "INN1",
        innings_number: 1,
        team_id: "TA",
        total_runs: 0,
        total_wickets: 0,
        total_balls: 0,
        batting_performances: [],
        bowling_performances: [],
      },
    ],
  },
  strikerId: null,
  nonStrikerId: null,
  bowlerId: null,
  lastOverBowlerId: null,
  thisOverDeliveries: [],
};

const squad = (team: string, ids: string[]) =>
  ids.map((id) => ({ id, team_id: team, user_id: id, user: { id, full_name: id } }));

let side: Stage2Side;

/** POST /api/scoring/replay, answered by the real dispatch over the engine. */
function routeToEngine() {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_url: string, init: RequestInit) => {
      const batch = JSON.parse(String(init.body)) as ReplayBatch;
      const out = await replayActions(
        server.client as ServerClient,
        batch.matchId,
        batch.actions,
      );
      return new Response(JSON.stringify({ v: 1, ...out }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }),
  );
}

const storedMatch = () =>
  side.ds.all("matches").find((m) => m.id === "M") as unknown as MatchesRow;
const storedInnings = () =>
  (side.ds.all("innings") as unknown as InningsRow[])
    .map((i) => [i.innings_number, i.total_runs, i.total_balls, i.is_completed])
    .sort((a, b) => Number(a[0]) - Number(b[0]));

/** The engine's match, the server client over it, and the screen's reads. */
function seed() {
  localStorage.clear();
  vi.clearAllMocks();
  vi.unstubAllGlobals();
  side = stage2Driver(syntheticTables({ overs_per_innings: 1 }), true);
  // Builds nothing: the match starts with an empty first innings.
  void new GoldenReplay(side, "M", SYNTHETIC_ROSTERS);
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
  vi.mocked(getTeamPlayers).mockImplementation(async (team: string) => ({
    data: (team === "TA" ? squad("TA", A) : squad("TB", B)) as never,
    error: null,
  }));
  vi.mocked(getScoringState).mockResolvedValue({
    base: null,
    data: START as never,
    error: null,
  } as never);
}

describe("useScoring: offline queue replayed by the server", () => {
  beforeEach(seed);

  it("ends only the innings the scorer ended, after the last ball already did", async () => {
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(true);
    const { result } = renderHook(() => useScoring("M"));
    await waitFor(() => expect(result.current.loading).toBe(false));

    // No signal: the first innings, its last ball, End innings, and the
    // start of the second innings, all queued on the device.
    const online = vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
    const [bowler, opener1, opener2] = [B[10]!, A[0]!, A[1]!];
    await act(async () => {
      await result.current.handleConfirmBatsmen(opener1, opener2);
    });
    await act(async () => {
      await result.current.handleConfirmBowler(bowler);
    });
    for (let i = 0; i < 6; i += 1) {
      await act(async () => {
        await result.current.handleScore(bowler, opener1, opener2, {
          runsScored: 2,
        });
      });
    }
    await act(async () => {
      await result.current.handleEndInnings();
    });
    expect(result.current.match?.current_innings).toBe(2);
    await act(async () => {
      await result.current.handleConfirmBatsmen(B[0]!, B[1]!);
    });
    await act(async () => {
      await result.current.handleConfirmBowler(A[10]!);
    });
    await act(async () => {
      await result.current.handleScore(A[10]!, B[0]!, B[1]!, { runsScored: 4 });
    });
    expect(getPendingActions("M").find((a) => a.type === "endInnings")?.payload).toEqual({
      inningsNumber: 1,
    });

    // Back online: the sixth ball closes the first innings on the server,
    // so the queued End innings has nothing left to end.
    online.mockReturnValue(true);
    routeToEngine();
    await act(async () => {
      await result.current.flushOfflineQueue();
    });

    expect(getPendingActions("M")).toEqual([]);
    expect(getDeadLetterActions("M")).toEqual([]);
    expect(storedMatch()).toMatchObject({ status: "live", current_innings: 2 });
    expect(storedInnings()).toEqual([
      [1, 12, 6, true],
      [2, 4, 1, false],
    ]);
  });
});
