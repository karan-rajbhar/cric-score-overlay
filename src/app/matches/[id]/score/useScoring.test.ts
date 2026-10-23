import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { NO_CONNECTION_TOSS, useScoring } from "./useScoring";
import { getScoringState, getTeamPlayers } from "../../queries";
import {
  startMatch,
  recordBall,
  retirePlayer,
  setCurrentBatsmen,
  setCurrentBowler,
  undoLastBall,
} from "../../mutations";
import { enqueueAction, getPendingActions } from "~/lib/offline-queue";
import type { ReplayBatch, ReplayBatchAction } from "~/lib/scoring-replay/protocol";

vi.mock("~/lib/firebase/client", () => ({
  firebase: {
    channel: vi.fn().mockReturnValue({
      subscribe: vi.fn(),
      send: vi.fn(),
    }),
    removeChannel: vi.fn(),
  },
}));

vi.mock("../../queries", () => ({
  getScoringState: vi.fn(),
  getMatch: vi.fn(),
  getTeamPlayers: vi.fn(),
}));

vi.mock("../../mutations", () => ({
  startMatch: vi.fn(),
  recordBall: vi.fn(),
  updateBall: vi.fn(),
  undoLastBall: vi.fn(),
  setCurrentBatsmen: vi.fn(),
  setCurrentBowler: vi.fn(),
  endInnings: vi.fn(),
  startSuperOver: vi.fn(),
  retirePlayer: vi.fn(),
  awardTeamPenalty: vi.fn(),
  reassignCurrentOverBowler: vi.fn(),
}));

vi.mock("../../../teams/actions", () => ({
  createPlayerQuick: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: {
    info: vi.fn(),
    error: vi.fn(),
    success: vi.fn(),
  },
}));

/**
 * Stands in for POST /api/scoring/replay: answers each action with
 * `answer(action)` in order, stopping at the first failure, and returns the
 * batches it received.
 */
function mockReplayRoute(
  answer: (action: ReplayBatchAction) => { status: "applied" | "duplicate" | "failed"; error?: string },
  /** The committed documents the route answers with, per batch. */
  delta: (batch: ReplayBatch) => unknown = () => null,
): ReplayBatch[] {
  const batches: ReplayBatch[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init: RequestInit) => {
      expect(url).toBe("/api/scoring/replay");
      expect(init.method).toBe("POST");
      const batch = JSON.parse(String(init.body)) as ReplayBatch;
      batches.push(batch);
      const results = [];
      for (const action of batch.actions) {
        const r = answer(action);
        results.push({ id: action.id, ...r });
        if (r.status === "failed") break;
      }
      return new Response(JSON.stringify({ v: 1, results, delta: delta(batch) }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }),
  );
  return batches;
}

describe("useScoring", () => {
  const matchId = "1523c4af-11e9-40bb-90f3-c8bf28db670d";

  const mockScoringState = {
    match: {
      id: matchId,
      status: "live",
      current_innings: 1,
      team1_id: "team-1",
      team2_id: "team-2",
      innings: [{ innings_number: 1, team_id: "team-1" }],
    },
    strikerId: "p1",
    nonStrikerId: "p2",
    bowlerId: null,
    lastOverBowlerId: null,
    thisOverDeliveries: [],
  };

  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    vi.unstubAllGlobals();
    vi.mocked(getTeamPlayers).mockResolvedValue({ data: [], error: null });
    vi.mocked(getScoringState).mockResolvedValue({
      base: null,
      data: mockScoringState,
      error: null,
    });
  });

  it("calls getScoringState only once on initial mount", async () => {
    const onNeedsBowler = vi.fn();
    const { result } = renderHook(() =>
      useScoring(matchId, { onNeedsBowler }),
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(getScoringState).toHaveBeenCalledTimes(1);
    expect(onNeedsBowler).toHaveBeenCalledTimes(1);
  });

  it("does not enter an infinite loop when options object reference changes on each render", async () => {
    let renderCount = 0;
    const { result, rerender } = renderHook(() => {
      renderCount++;
      // Simulating what page.tsx was doing: creating a fresh object literal every render
      return useScoring(matchId, {
        onNeedsBowler: () => {},
        onNeedsBatsman: () => {},
      });
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // Re-render multiple times with new inline options object
    rerender();
    rerender();
    rerender();

    // getScoringState should still have been called only ONCE by useEffect
    expect(getScoringState).toHaveBeenCalledTimes(1);
    expect(renderCount).toBeGreaterThanOrEqual(4);
  });

  it("strictly segregates batting and bowling squads and prevents cross-team player leakage", async () => {
    const team1Players = [
      { id: "tp1", team_id: "team-1", user_id: "u1", user: { id: "u1", full_name: "T1 P1" } },
      { id: "tp2", team_id: "team-1", user_id: "u2", user: { id: "u2", full_name: "T1 P2" } },
    ];
    const team2Players = [
      { id: "tp3", team_id: "team-2", user_id: "u3", user: { id: "u3", full_name: "T2 P3" } },
      { id: "tp4", team_id: "team-2", user_id: "u4", user: { id: "u4", full_name: "T2 P4" } },
    ];

    vi.mocked(getTeamPlayers).mockImplementation((teamId: string) => {
      if (teamId === "team-1") return Promise.resolve({ data: team1Players as never, error: null });
      if (teamId === "team-2") return Promise.resolve({ data: team2Players as never, error: null });
      return Promise.resolve({ data: [], error: null });
    });

    const { result } = renderHook(() => useScoring(matchId));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // Innings 1: team-1 is batting, team-2 is bowling
    expect(result.current.battingTeamPlayers.map((p) => p.user_id)).toEqual(["u1", "u2"]);
    expect(result.current.bowlingTeamPlayers.map((p) => p.user_id)).toEqual(["u3", "u4"]);

    // Now simulate Innings 2 where team-2 is batting and team-1 is bowling
    const innings2Match = {
      ...mockScoringState.match,
      current_innings: 2,
      innings: [
        { innings_number: 1, team_id: "team-1" },
        { innings_number: 2, team_id: "team-2" },
      ],
    };

    await result.current.loadPlayers(innings2Match as never);

    // After switching innings, team-1 players MUST NOT leak into battingTeamPlayers!
    await waitFor(() => {
      expect(result.current.battingTeamPlayers.map((p) => p.user_id)).toEqual(["u3", "u4"]);
      expect(result.current.bowlingTeamPlayers.map((p) => p.user_id)).toEqual(["u1", "u2"]);
    });
  });

  it("handleConfirmBatsmen rejects selecting opposing team players or current bowler", async () => {
    const team1Players = [
      { id: "tp1", team_id: "team-1", user_id: "u1", user: { id: "u1", full_name: "T1 P1" } },
      { id: "tp2", team_id: "team-1", user_id: "u2", user: { id: "u2", full_name: "T1 P2" } },
    ];
    const team2Players = [
      { id: "tp3", team_id: "team-2", user_id: "u3", user: { id: "u3", full_name: "T2 P3" } },
    ];

    vi.mocked(getTeamPlayers).mockImplementation((teamId: string) => {
      if (teamId === "team-1") return Promise.resolve({ data: team1Players as never, error: null });
      if (teamId === "team-2") return Promise.resolve({ data: team2Players as never, error: null });
      return Promise.resolve({ data: [], error: null });
    });

    const { result } = renderHook(() => useScoring(matchId));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // Selecting bowler u3 (who belongs to bowling team) as batsman must be rejected
    const resOpponent = await result.current.handleConfirmBatsmen("u1", "u3");
    expect(resOpponent).toEqual({ error: expect.stringMatching(/opposing|bowling/i) });

    // Selecting the same player for striker and non-striker must be rejected
    const resSame = await result.current.handleConfirmBatsmen("u1", "u1");
    expect(resSame).toEqual({ error: expect.stringMatching(/different/i) });
  });

  it("handleConfirmBowler rejects selecting active batsmen or batting team players", async () => {
    const team1Players = [
      { id: "tp1", team_id: "team-1", user_id: "u1", user: { id: "u1", full_name: "T1 P1" } },
      { id: "tp2", team_id: "team-1", user_id: "u2", user: { id: "u2", full_name: "T1 P2" } },
    ];
    const team2Players = [
      { id: "tp3", team_id: "team-2", user_id: "u3", user: { id: "u3", full_name: "T2 P3" } },
    ];

    vi.mocked(getTeamPlayers).mockImplementation((teamId: string) => {
      if (teamId === "team-1") return Promise.resolve({ data: team1Players as never, error: null });
      if (teamId === "team-2") return Promise.resolve({ data: team2Players as never, error: null });
      return Promise.resolve({ data: [], error: null });
    });

    const { result } = renderHook(() => useScoring(matchId));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // Selecting u1 (who belongs to batting team) as bowler must be rejected
    const resBattingPlayer = await result.current.handleConfirmBowler("u1");
    expect(resBattingPlayer).toEqual({ error: expect.stringMatching(/batting|opposing/i) });
  });

  it("offline scoring records deliveries, completes over, prompts for bowler, and resets lastBalls on new over", async () => {
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);

    const team1Players = [
      { id: "tp1", team_id: "team-1", user_id: "u1", user: { id: "u1", full_name: "T1 P1" } },
      { id: "tp2", team_id: "team-1", user_id: "u2", user: { id: "u2", full_name: "T1 P2" } },
    ];
    const team2Players = [
      { id: "tp3", team_id: "team-2", user_id: "u3", user: { id: "u3", full_name: "T2 P3" } },
      { id: "tp4", team_id: "team-2", user_id: "u4", user: { id: "u4", full_name: "T2 P4" } },
    ];

    vi.mocked(getTeamPlayers).mockImplementation((teamId: string) => {
      if (teamId === "team-1") return Promise.resolve({ data: team1Players as never, error: null });
      if (teamId === "team-2") return Promise.resolve({ data: team2Players as never, error: null });
      return Promise.resolve({ data: [], error: null });
    });

    const onNeedsBowler = vi.fn();
    const { result } = renderHook(() => useScoring(matchId, { onNeedsBowler }));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
      expect(result.current.bowlingTeamPlayers.length).toBe(2);
    });

    // Set bowler u3 for over 0
    await result.current.handleConfirmBowler("u3");

    await waitFor(() => {
      expect(result.current.currentBowlerId).toBe("u3");
    });

    // Bowl 5 dot balls offline
    for (let i = 0; i < 5; i++) {
      const res = await result.current.handleScore("u3", "u1", "u2", { runsScored: 0 });
      expect(res.data?.current_ball).toBe(i + 1);
    }

    await waitFor(() => {
      expect(result.current.lastBalls.length).toBe(5);
    });

    // Bowl 6th ball (boundary 4) to complete the over
    const overFinalRes = await result.current.handleScore("u3", "u1", "u2", { runsScored: 4 });
    expect(overFinalRes.data?.over_completed).toBe(true);
    expect(overFinalRes.data?.needs_bowler).toBe(true);
    expect(overFinalRes.data?.current_over).toBe(1);
    expect(overFinalRes.data?.current_ball).toBe(0);

    // Bowler u3 should have conceded 4 runs in 1.0 over
    expect(overFinalRes.data?.last_bowler_runs).toBe(4);
    expect(overFinalRes.data?.last_bowler_overs).toBe(1);

    // Current bowler is now null (waiting for next bowler selection)
    await waitFor(() => {
      expect(result.current.currentBowlerId).toBeNull();
    });

    // Now select new bowler u4 for Over 1
    await result.current.handleConfirmBowler("u4");

    // lastBalls and rawDeliveries should be reset to empty for the new over!
    await waitFor(() => {
      expect(result.current.currentBowlerId).toBe("u4");
      expect(result.current.lastBalls).toEqual([]);
      expect(result.current.rawDeliveries).toEqual([]);
    });

    // Bowl 1st ball of Over 1 with bowler u4
    const newOverBall1 = await result.current.handleScore("u4", "u2", "u1", { runsScored: 1 });
    expect(newOverBall1.data?.current_ball).toBe(1);
    expect(newOverBall1.data?.current_over).toBe(1);
    // Bowler u4's runs conceded should only be 1 (not inheriting u3's 4 runs!)
    expect(newOverBall1.data?.bowler_runs).toBe(1);
    expect(newOverBall1.data?.bowler_overs).toBe(0.1);

    await waitFor(() => {
      expect(result.current.lastBalls).toEqual(["1"]);
    });
  });

  it("offline scoring rejects scoring when bowler or batsmen are missing", async () => {
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);

    const { result } = renderHook(() => useScoring(matchId));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // Score without bowler
    const resNoBowler = await result.current.handleScore("", "u1", "u2", { runsScored: 1 });
    expect(resNoBowler.error).toMatch(/bowler/i);

    // Score without batsmen
    const resNoBatsman = await result.current.handleScore("u3", "", "", { runsScored: 1 });
    expect(resNoBatsman.error).toMatch(/batter/i);
  });

  it("does not leak previous over deliveries into new bowler's over when syncing from DB", async () => {
    // Online mode: the bowler change goes through the replay route, which
    // answers without documents, so the screen re-reads.
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(true);
    mockReplayRoute(() => ({ status: "applied" }));

    // Initial state: Over 0 finished, waiting for bowler
    const finishedOverDeliveries = [
      { id: "b1", over_number: 0, ball_number: 1, runs_scored: 1, extras: 0, extra_type: null, is_wicket: false },
      { id: "b2", over_number: 0, ball_number: 2, runs_scored: 4, extras: 0, extra_type: null, is_wicket: false },
    ];

    vi.mocked(getScoringState).mockResolvedValueOnce({
      base: null,
      data: {
        match: {
          id: matchId,
          status: "live",
          current_innings: 1,
          current_over: 1,
          current_ball: 0,
          team1_id: "team-1",
          team2_id: "team-2",
          innings: [{ innings_number: 1, team_id: "team-1", total_balls: 6 }],
        },
        strikerId: "p1",
        nonStrikerId: "p2",
        bowlerId: null,
        lastOverBowlerId: "prev-bowler",
        thisOverDeliveries: finishedOverDeliveries,
      },
      error: null,
    });

    const { result } = renderHook(() => useScoring(matchId));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // When new bowler is confirmed, syncFromDb will return state with bowler assigned
    vi.mocked(getScoringState).mockResolvedValueOnce({
      base: null,
      data: {
        match: {
          id: matchId,
          status: "live",
          current_innings: 1,
          current_over: 1,
          current_ball: 0,
          team1_id: "team-1",
          team2_id: "team-2",
          innings: [{ innings_number: 1, team_id: "team-1", total_balls: 6 }],
        },
        strikerId: "p1",
        nonStrikerId: "p2",
        bowlerId: "new-bowler-id",
        lastOverBowlerId: "prev-bowler",
        // Even if DB queries returned old over deliveries before DB catchup
        thisOverDeliveries: finishedOverDeliveries,
      },
      error: null,
    });

    await act(async () => {
      await result.current.handleConfirmBowler("new-bowler-id");
    });

    await waitFor(() => {
      expect(result.current.currentBowlerId).toBe("new-bowler-id");
      // rawDeliveries and lastBalls MUST be empty because over 1 has 0 deliveries!
      expect(result.current.rawDeliveries).toEqual([]);
      expect(result.current.lastBalls).toEqual([]);
    });
  });

  it("updates from the documents a ball committed instead of re-reading", async () => {
    const row = (user_id: string, extra: object) => ({
      user_id,
      user: { id: user_id, full_name: user_id.toUpperCase() },
      ...extra,
    });
    vi.mocked(getScoringState).mockResolvedValue({
      base: null,
      data: {
        ...mockScoringState,
        match: {
          ...mockScoringState.match,
          current_over: 0,
          current_ball: 0,
          innings: [
            {
              id: "i1",
              innings_number: 1,
              team_id: "team-1",
              total_balls: 0,
              batting_performances: [
                row("p1", { is_current_batsman: true, is_striker: true }),
                row("p2", { is_current_batsman: true, is_striker: false }),
              ],
              bowling_performances: [row("b1", { is_current_bowler: true })],
            },
          ],
        },
        bowlerId: "b1",
      },
      error: null,
    });
    const { result } = renderHook(() => useScoring(matchId, {}));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(getScoringState).toHaveBeenCalledTimes(1);

    const ball = {
      id: "i1_0~x",
      seq: 1,
      ball_number: 1,
      runs_scored: 1,
      extras: 0,
      extra_type: null,
      is_wicket: false,
      bowler_id: "b1",
      batsman_id: "p1",
    };
    const deltas: unknown[] = [
      {
        match: {
          id: matchId,
          status: "live",
          current_innings: 1,
          current_over: 0,
          current_ball: 1,
          team1_id: "team-1",
          team2_id: "team-2",
        } as never,
        innings: [
          {
            id: "i1",
            match_id: matchId,
            innings_number: 1,
            team_id: "team-1",
            total_balls: 1,
            batting: [
              { user_id: "p1", is_current_batsman: true, is_striker: false },
              { user_id: "p2", is_current_batsman: true, is_striker: true },
            ],
            bowling: [{ user_id: "b1", is_current_bowler: true }],
            last_ball: { ...ball, over_number: 0 },
          } as never,
        ],
        overs: [
          {
            id: "i1_0",
            match_id: matchId,
            innings_id: "i1",
            over_number: 0,
            balls: [ball],
          } as never,
        ],
      },
      null,
    ];
    mockReplayRoute(
      () => ({ status: "applied" }),
      () => deltas.shift() ?? null,
    );
    await act(async () => {
      await result.current.handleScore("b1", "p1", "p2", { runsScored: 1 });
    });
    await waitFor(() => expect(result.current.strikerId).toBe("p2"));
    expect(getScoringState).toHaveBeenCalledTimes(1);
    expect(result.current.rawDeliveries.map((d) => d.id)).toEqual(["i1_0~x"]);

    // Without the documents (or when they are not enough): one re-read.
    await act(async () => {
      await result.current.handleScore("b1", "p2", "p1", { runsScored: 0 });
    });
    await waitFor(() => expect(getScoringState).toHaveBeenCalledTimes(2));
  });

  it("skips squad refetch on resync while teams are unchanged", async () => {
    const team1Players = [
      { id: "tp1", team_id: "team-1", user_id: "u1", user: { id: "u1", full_name: "P1" } },
    ];
    const team2Players = [
      { id: "tp2", team_id: "team-2", user_id: "u2", user: { id: "u2", full_name: "P2" } },
    ];
    vi.mocked(getTeamPlayers).mockImplementation((teamId: string) =>
      Promise.resolve({
        data: teamId === "team-1" ? team1Players : team2Players,
        error: null,
      }),
    );

    const { result } = renderHook(() => useScoring(matchId, {}));
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    expect(getTeamPlayers).toHaveBeenCalledTimes(2);

    // A resync of the same innings must not refetch squads.
    await result.current.syncFromDb();
    expect(getTeamPlayers).toHaveBeenCalledTimes(2);

    // When the innings flips (teams swap), squads are refetched.
    vi.mocked(getScoringState).mockResolvedValue({
      base: null,
      data: {
        ...mockScoringState,
        match: {
          ...mockScoringState.match,
          current_innings: 2,
          innings: [
            { innings_number: 1, team_id: "team-1" },
            { innings_number: 2, team_id: "team-2" },
          ],
        },
      },
      error: null,
    });
    await result.current.syncFromDb();
    expect(getTeamPlayers).toHaveBeenCalledTimes(4);
  });

  it("offline scoring handles wicket by clearing dismissed striker and marking them out in batting performances", async () => {
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
    const onNeedsBatsman = vi.fn();
    const { result } = renderHook(() => useScoring(matchId, { onNeedsBatsman }));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await result.current.handleConfirmBowler("u3");
    await result.current.handleConfirmBatsmen("u1", "u2");

    const scoreRes = await result.current.handleScore("u3", "u1", "u2", {
      isWicket: true,
      dismissalType: "bowled",
      runsScored: 0,
    });

    expect(scoreRes.data?.needs_batsman).toBe(true);
    expect(scoreRes.data?.striker_id).toBeNull();
    expect(scoreRes.data?.non_striker_id).toBe("u2");
    expect(onNeedsBatsman).toHaveBeenCalled();

    await waitFor(() => {
      expect(result.current.strikerId).toBeNull();
      const inn = result.current.match?.innings?.find((i) => i.innings_number === 1);
      const dismissedPerf = inn?.batting_performances?.find((bp) => bp.user_id === "u1");
      expect(dismissedPerf?.is_out).toBe(true);
      expect(dismissedPerf?.is_current_batsman).toBe(false);
    });
  });

  it("offline undo only removes delivery when undoing a recordBall action", async () => {
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
    const { result } = renderHook(() => useScoring(matchId));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await result.current.handleConfirmBowler("u3");
    await result.current.handleConfirmBatsmen("u1", "u2");

    // Score 1 ball
    await result.current.handleScore("u3", "u1", "u2", { runsScored: 1 });
    await waitFor(() => {
      expect(result.current.lastBalls.length).toBe(1);
      expect(result.current.rawDeliveries.length).toBe(1);
    });

    // Set bowler (non-ball action)
    await result.current.handleConfirmBowler("u4");
    await waitFor(() => {
      expect(result.current.currentBowlerId).toBe("u4");
    });

    // Undoing the setBowler action must NOT pop the previous delivery!
    await result.current.handleUndo();
    await waitFor(() => {
      expect(result.current.currentBowlerId).toBe("u3");
    });
    expect(result.current.lastBalls.length).toBe(1);
    expect(result.current.rawDeliveries.length).toBe(1);

    // Undoing again will undo the ball
    await result.current.handleUndo();
    await waitFor(() => {
      expect(result.current.lastBalls.length).toBe(0);
      expect(result.current.rawDeliveries.length).toBe(0);
    });
  });

  it("initiates Super Over offline, updates innings and queues startSuperOver for sync", async () => {
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
    const tiedMatchScoringState = {
      match: {
        id: matchId,
        status: "completed",
        current_innings: 2,
        team1_id: "team-1",
        team2_id: "team-2",
        innings: [
          { innings_number: 1, team_id: "team-1", is_completed: true },
          { innings_number: 2, team_id: "team-2", is_completed: true },
        ],
      },
      strikerId: null,
      nonStrikerId: null,
      bowlerId: null,
      lastOverBowlerId: null,
      thisOverDeliveries: [],
    };
    vi.mocked(getScoringState).mockResolvedValueOnce({
      base: null,
      data: tiedMatchScoringState,
      error: null,
    });

    const onNeedsBatsman = vi.fn();
    const { result } = renderHook(() =>
      useScoring(matchId, { onNeedsBatsman }),
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    const superOverRes = await result.current.handleStartSuperOver();
    expect(superOverRes.error).toBeNull();
    expect(onNeedsBatsman).toHaveBeenCalled();

    await waitFor(() => {
      expect(result.current.match?.status).toBe("live");
      expect(result.current.match?.current_innings).toBe(3);
      expect(result.current.match?.result_description).toBe("Super Over in progress");
      expect(result.current.strikerId).toBeNull();
      expect(result.current.nonStrikerId).toBeNull();
      expect(result.current.currentBowlerId).toBeNull();
      expect(result.current.pendingCount).toBe(1);
    });

    const actions = getPendingActions(matchId);
    expect(actions).toHaveLength(1);
    expect(actions[0]!.type).toBe("startSuperOver");
  });

  it("queues balls, an undo and a retirement offline, then replays them in order with their ids", async () => {
    const online = vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
    const { result } = renderHook(() => useScoring(matchId));
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await result.current.handleConfirmBowler("u3");
    await result.current.handleConfirmBatsmen("u1", "u2");
    await result.current.handleScore("u3", "u1", "u2", { runsScored: 0 });
    await result.current.handleScore("u3", "u1", "u2", { runsScored: 2 });
    await result.current.handleScore("u3", "u1", "u2", { runsScored: 4 });
    // Undo while offline drops the queued boundary instead of a server ball.
    await result.current.handleUndo();
    const retired = await result.current.handleRetireBatter({
      playerId: "u1",
      type: "retired_hurt",
      reason: "cramp",
    });
    expect(retired).toEqual({ error: null, queued: true });
    await waitFor(() => {
      expect(result.current.strikerId).toBeNull();
    });
    expect(retirePlayer).not.toHaveBeenCalled();
    expect(undoLastBall).not.toHaveBeenCalled();

    const queued = getPendingActions(matchId);
    expect(queued.map((a) => a.type)).toEqual([
      "setBowler",
      "setBatsmen",
      "recordBall",
      "recordBall",
      "retireBatter",
    ]);

    // ---- back online: replayed through the replay route, not server actions ----
    online.mockReturnValue(true);
    const batches = mockReplayRoute(() => ({ status: "applied" }));

    const res = await result.current.flushOfflineQueue();
    expect(res).toMatchObject({ synced: 5, failed: 0 });
    expect(batches).toHaveLength(1);
    const [batch] = batches;
    expect(batch).toMatchObject({ v: 1, matchId });
    // In order, each carrying its queue id as the idempotency key.
    expect(batch!.actions.map((a) => [a.type, a.id])).toEqual(
      queued.map((a) => [a.type, a.queueId]),
    );
    expect(
      batch!.actions
        .filter((a) => a.type === "recordBall")
        .map((a) => (a.payload as { event: { runsScored: number } }).event.runsScored),
    ).toEqual([0, 2]);
    expect(batch!.actions[4]!.payload).toEqual({
      playerId: "u1",
      type: "retired_hurt",
      reason: "cramp",
    });
    for (const fn of [setCurrentBowler, setCurrentBatsmen, recordBall, retirePlayer]) {
      expect(fn).not.toHaveBeenCalled();
    }
    expect(getPendingActions(matchId)).toHaveLength(0);
  });

  it("keeps the queue in order behind an action the route could not apply", async () => {
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(true);
    const { result } = renderHook(() => useScoring(matchId));
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    enqueueAction(matchId, "setBowler", { bowlerId: "u3" });
    enqueueAction(matchId, "setBatsmen", { strikerId: "u1", nonStrikerId: "u2" });
    enqueueAction(matchId, "endInnings", {} as Record<string, never>);
    const batches = mockReplayRoute((a) =>
      a.type === "setBatsmen" ? { status: "failed", error: "Server busy" } : { status: "applied" },
    );

    const res = await result.current.flushOfflineQueue();
    expect(res).toMatchObject({ synced: 1, failed: 1 });
    expect(batches).toHaveLength(1);
    const left = getPendingActions(matchId);
    expect(left.map((a) => a.type)).toEqual(["setBatsmen", "endInnings"]);
    expect(left[0]).toMatchObject({ retryCount: 1, lastError: "Server busy" });
  });

  it("lets the scorer skip only an action the server refused, then shows what it has", async () => {
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(true);
    const { result } = renderHook(() => useScoring(matchId));
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    enqueueAction(matchId, "setBatsmen", { strikerId: "u1", nonStrikerId: "u2" });
    enqueueAction(matchId, "endInnings", {} as Record<string, never>);

    // No answer at all: nothing to skip (the server may yet apply it).
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("Failed to fetch");
      }),
    );
    await act(async () => {
      await result.current.flushOfflineQueue();
    });
    expect(result.current.refusedHead).toBeNull();
    await act(async () => {
      expect(await result.current.handleSkipHeadAction()).toBeNull();
    });
    expect(getPendingActions(matchId)).toHaveLength(2);

    // Refused by the server: it may be skipped.
    const batches = mockReplayRoute((a) =>
      a.type === "setBatsmen"
        ? { status: "failed", error: "Server busy" }
        : { status: "applied" },
    );
    await act(async () => {
      await result.current.flushOfflineQueue();
    });
    expect(result.current.refusedHead?.type).toBe("setBatsmen");
    const reads = vi.mocked(getScoringState).mock.calls.length;
    await act(async () => {
      await result.current.handleSkipHeadAction();
    });
    // Kept for review; the rest went on, and the screen re-read.
    expect(result.current.deadLetters.map((d) => d.action.type)).toEqual([
      "setBatsmen",
    ]);
    expect(batches.at(-1)!.actions.map((a) => a.type)).toEqual(["endInnings"]);
    expect(getPendingActions(matchId)).toHaveLength(0);
    expect(vi.mocked(getScoringState).mock.calls.length).toBeGreaterThan(reads);
    expect(result.current.refusedHead).toBeNull();
  });

  it("frees the screen when the toss gets no answer", async () => {
    const { result } = renderHook(() => useScoring(matchId));
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    vi.mocked(startMatch).mockRejectedValueOnce(new TypeError("Failed to fetch"));
    let res: { error: string | null } | undefined;
    await act(async () => {
      res = await result.current.handleStartMatch("team-1", "bat");
    });
    expect(res?.error).toBe(NO_CONNECTION_TOSS);
    expect(result.current.isProcessing).toBe(false);
  });

  it("offline, ends a chase without opening a third innings", async () => {
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
    vi.mocked(getScoringState).mockResolvedValueOnce({
      base: null,
      data: {
        ...mockScoringState,
        match: {
          ...mockScoringState.match,
          current_innings: 2,
          innings: [
            { innings_number: 1, team_id: "team-1", is_completed: true },
            { innings_number: 2, team_id: "team-2" },
          ],
        },
      },
      error: null,
    });
    const onNeedsBatsman = vi.fn();
    const { result } = renderHook(() => useScoring(matchId, { onNeedsBatsman }));
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    onNeedsBatsman.mockClear();
    await act(async () => {
      await result.current.handleEndInnings();
    });
    expect(result.current.match?.current_innings).toBe(2);
    expect(
      result.current.match?.innings?.find((i) => i.innings_number === 2)
        ?.is_completed,
    ).toBe(true);
    expect(onNeedsBatsman).not.toHaveBeenCalled();
    expect(getPendingActions(matchId).map((a) => a.type)).toEqual(["endInnings"]);
  });

  it("queues a ball whose reply was lost under the id it was sent with", async () => {
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(true);
    const sent: ReplayBatch[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init: RequestInit) => {
        sent.push(JSON.parse(String(init.body)) as ReplayBatch);
        throw new TypeError("Failed to fetch");
      }),
    );
    const { result } = renderHook(() => useScoring(matchId));
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    const res = await result.current.handleScore("u3", "p1", "p2", { runsScored: 1 });
    expect(res.error).toBeNull();
    const sentId = sent[0]!.actions[0]!.id;
    expect(sentId).toBeTruthy();
    const queued = getPendingActions(matchId);
    expect(queued).toHaveLength(1);
    // The server may have recorded it: the replay uses the same key.
    expect(queued[0]!.queueId).toBe(sentId);
  });

  it("sends a new action only after the queued ones, and queues it behind them if they cannot be sent", async () => {
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(true);
    const { result } = renderHook(() => useScoring(matchId));
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    enqueueAction(matchId, "setBowler", { bowlerId: "u3" });
    mockReplayRoute(() => ({ status: "failed", error: "DB Error" }));

    const res = await result.current.handleRetireBatter({
      playerId: "p1",
      type: "retired_out",
    });
    expect(res).toEqual({ error: null, queued: true });
    expect(retirePlayer).not.toHaveBeenCalled();
    expect(getPendingActions(matchId).map((a) => a.type)).toEqual([
      "setBowler",
      "retireBatter",
    ]);
  });
});

describe("useScoring offline reload", () => {
  const matchId = "0b0c0d0e-1111-4222-8333-444455556666";
  const team1 = [
    { id: "tp1", team_id: "team-1", user_id: "u1", user: { id: "u1", full_name: "A" } },
    { id: "tp2", team_id: "team-1", user_id: "u2", user: { id: "u2", full_name: "B" } },
  ];
  const team2 = [
    { id: "tp3", team_id: "team-2", user_id: "u3", user: { id: "u3", full_name: "C" } },
    { id: "tp4", team_id: "team-2", user_id: "u4", user: { id: "u4", full_name: "D" } },
  ];
  const serverState = {
    match: {
      id: matchId,
      status: "live",
      current_innings: 1,
      current_over: 0,
      current_ball: 0,
      overs_per_innings: 20,
      team1_id: "team-1",
      team2_id: "team-2",
      innings: [
        {
          innings_number: 1,
          team_id: "team-1",
          total_runs: 10,
          total_wickets: 0,
          total_balls: 0,
          batting_performances: [],
          bowling_performances: [],
        },
      ],
    },
    strikerId: "u1",
    nonStrikerId: "u2",
    bowlerId: "u3",
    lastOverBowlerId: null,
    thisOverDeliveries: [],
  };

  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    vi.mocked(getTeamPlayers).mockImplementation((teamId: string) =>
      Promise.resolve({
        data: (teamId === "team-1" ? team1 : team2) as never,
        error: null,
      }),
    );
    vi.mocked(getScoringState).mockResolvedValue({
      base: null,
      data: serverState as never,
      error: null,
    });
  });

  it("reopens offline from the device copy, including balls scored offline", async () => {
    // Online visit: the state is saved on the device.
    const first = renderHook(() => useScoring(matchId));
    await waitFor(() => expect(first.result.current.loading).toBe(false));

    // Signal lost: score a four, which is queued.
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
    await first.result.current.handleScore("u3", "u1", "u2", { runsScored: 4 });
    await waitFor(() => expect(first.result.current.pendingCount).toBe(1));
    first.unmount();

    // Reload while offline: no server call, the four is still there.
    vi.mocked(getScoringState).mockClear();
    const second = renderHook(() => useScoring(matchId));
    await waitFor(() => expect(second.result.current.loading).toBe(false));

    expect(getScoringState).not.toHaveBeenCalled();
    const m = second.result.current.match!;
    expect(m.innings?.[0]?.total_runs).toBe(14);
    expect(second.result.current.lastBalls).toEqual(["4"]);
    expect(second.result.current.strikerId).toBe("u1");
    expect(second.result.current.currentBowlerId).toBe("u3");
    expect(second.result.current.battingTeamPlayers).toHaveLength(2);
    expect(second.result.current.pendingCount).toBe(1);

    // And scoring continues from there.
    await second.result.current.handleScore("u3", "u1", "u2", { runsScored: 1 });
    await waitFor(() =>
      expect(second.result.current.match?.innings?.[0]?.total_runs).toBe(15),
    );
    expect(getPendingActions(matchId)).toHaveLength(2);
  });

  it("falls back to the device copy when the server cannot be reached", async () => {
    const first = renderHook(() => useScoring(matchId));
    await waitFor(() => expect(first.result.current.loading).toBe(false));
    first.unmount();

    // navigator says online, but the request fails (weak signal).
    vi.mocked(getScoringState).mockRejectedValue(new TypeError("Failed to fetch"));
    const second = renderHook(() => useScoring(matchId));
    await waitFor(() => expect(second.result.current.loading).toBe(false));
    expect(second.result.current.match?.id).toBe(matchId);
    expect(second.result.current.strikerId).toBe("u1");
  });
});
