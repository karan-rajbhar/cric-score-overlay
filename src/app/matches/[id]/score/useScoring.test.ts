import { renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { useScoring } from "./useScoring";
import { getScoringState, getTeamPlayers } from "../../queries";

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
});
