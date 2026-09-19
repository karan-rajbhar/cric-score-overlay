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
});
