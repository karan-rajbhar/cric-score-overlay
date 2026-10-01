import { renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { useScoring } from "./useScoring";
import { getScoringState, getTeamPlayers } from "../../queries";
import { setCurrentBowler } from "../../mutations";

vi.mock("~/lib/supabase/client", () => ({
  supabase: {
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
    vi.clearAllMocks();
    vi.mocked(getTeamPlayers).mockResolvedValue({ data: [], error: null });
    vi.mocked(getScoringState).mockResolvedValue({
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
    expect(resNoBatsman.error).toMatch(/batsm/i);
  });

  it("does not leak previous over deliveries into new bowler's over when syncing from DB", async () => {
    // Online mode
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(true);
    vi.mocked(setCurrentBowler).mockResolvedValue({ error: null });

    // Initial state: Over 0 finished, waiting for bowler
    const finishedOverDeliveries = [
      { id: "b1", over_number: 0, ball_number: 1, runs_scored: 1, extras: 0, extra_type: null, is_wicket: false },
      { id: "b2", over_number: 0, ball_number: 2, runs_scored: 4, extras: 0, extra_type: null, is_wicket: false },
    ];

    vi.mocked(getScoringState).mockResolvedValueOnce({
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

    await result.current.handleConfirmBowler("new-bowler-id");

    await waitFor(() => {
      expect(result.current.currentBowlerId).toBe("new-bowler-id");
      // rawDeliveries and lastBalls MUST be empty because over 1 has 0 deliveries!
      expect(result.current.rawDeliveries).toEqual([]);
      expect(result.current.lastBalls).toEqual([]);
    });
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
});
