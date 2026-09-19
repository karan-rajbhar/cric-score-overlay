import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { PotmDialog } from "./PotmDialog";
import { setPlayerOfTheMatch } from "~/app/matches/mutations";
import { makeMatch } from "~/test/factories";

vi.mock("~/app/matches/mutations", () => ({
  setPlayerOfTheMatch: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

describe("PotmDialog", () => {
  const matchId = "match-123";

  const mockPlayers = [
    {
      id: "u-1",
      name: "Virat Kohli",
      teamName: "Royal Tigers",
    },
    {
      id: "u-2",
      name: "Jasprit Bumrah",
      teamName: "Royal Tigers",
    },
  ];

  const mockMatch = makeMatch({
    id: matchId,
    winning_team_id: "t1",
    innings: [
      {
        id: "inn-1",
        match_id: matchId,
        innings_number: 1,
        team_id: "t1",
        total_runs: 180,
        total_wickets: 3,
        total_balls: 120,
        total_overs: 20,
        is_completed: true,
        extras_total: 0,
        extras_byes: 0,
        extras_leg_byes: 0,
        extras_wides: 0,
        extras_no_balls: 0,
        extras_penalties: 0,
        batting_performances: [
          {
            id: "bp-1",
            match_id: matchId,
            innings_id: "inn-1",
            user_id: "u-1",
            runs_scored: 85,
            balls_faced: 48,
            fours: 8,
            sixes: 4,
            is_out: false,
            user: { id: "u-1", full_name: "Virat Kohli" },
          },
        ],
        bowling_performances: [
          {
            id: "bowl-1",
            match_id: matchId,
            innings_id: "inn-1",
            user_id: "u-2",
            overs_bowled: 4,
            balls_bowled: 24,
            runs_conceded: 20,
            wickets_taken: 2,
            maidens: 0,
            wides: 0,
            no_balls: 0,
            user: { id: "u-2", full_name: "Jasprit Bumrah" },
          },
        ],
      },
    ],
  });

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(setPlayerOfTheMatch).mockResolvedValue({
      success: true,
      error: null,
    });
  });

  it("automatically highlights and pre-selects the calculated top performer", () => {
    render(
      <PotmDialog
        open={true}
        onOpenChange={vi.fn()}
        matchId={matchId}
        players={mockPlayers}
        match={mockMatch}
      />,
    );

    // Verify dialog shows automated recommendation
    expect(screen.getByText(/Top Recommended/i)).toBeDefined();
    expect(screen.getByText(/Virat Kohli/i)).toBeDefined();
  });

  it("awards the selected player on Confirm Award click", async () => {
    const onOpenChange = vi.fn();
    const onSuccess = vi.fn();

    render(
      <PotmDialog
        open={true}
        onOpenChange={onOpenChange}
        matchId={matchId}
        players={mockPlayers}
        match={mockMatch}
        onSuccess={onSuccess}
      />,
    );

    const confirmBtn = screen.getByRole("button", { name: /Confirm Award/i });
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(setPlayerOfTheMatch).toHaveBeenCalledWith(matchId, "u-1");
      expect(onOpenChange).toHaveBeenCalledWith(false);
      expect(onSuccess).toHaveBeenCalledWith("u-1");
    });
  });

  it("provides an Auto-Award button for one-click automated decision", async () => {
    const onOpenChange = vi.fn();

    render(
      <PotmDialog
        open={true}
        onOpenChange={onOpenChange}
        matchId={matchId}
        players={mockPlayers}
        match={mockMatch}
      />,
    );

    const autoAwardBtn = screen.getByRole("button", {
      name: /Auto-Award Top Performer/i,
    });
    fireEvent.click(autoAwardBtn);

    await waitFor(() => {
      expect(setPlayerOfTheMatch).toHaveBeenCalledWith(matchId, "u-1");
    });
  });
});
