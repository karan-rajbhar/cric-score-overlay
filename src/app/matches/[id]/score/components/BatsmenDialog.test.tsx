import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { BatsmenDialog } from "./BatsmenDialog";
import type { TeamPlayer } from "~/lib/match-types";

describe("BatsmenDialog", () => {
  const mockPlayers: TeamPlayer[] = [
    {
      id: "tp-1",
      team_id: "team-1",
      user_id: "user-1",
      user: { id: "user-1", full_name: "Virat Kohli" },
    },
    {
      id: "tp-2",
      team_id: "team-1",
      user_id: "user-2",
      user: { id: "user-2", full_name: "Rohit Sharma" },
    },
  ];

  it("renders BatsmenDialog with Striker and Non-Striker fields", () => {
    render(
      <BatsmenDialog
        open={true}
        onOpenChange={vi.fn()}
        battingTeamPlayers={mockPlayers}
        strikerId={null}
        nonStrikerId={null}
        onStrikerChange={vi.fn()}
        onNonStrikerChange={vi.fn()}
        onConfirm={vi.fn()}
        isProcessing={false}
      />,
    );

    expect(screen.getByText(/Select.*Batsmen/i)).toBeInTheDocument();
    expect(screen.getByText("Striker")).toBeInTheDocument();
    expect(screen.getByText("Non-striker")).toBeInTheDocument();
    expect(
      screen.getByRole("radio", { name: /Virat Kohli/ }),
    ).toBeInTheDocument();
  });

  it("adds a new player inline and puts them in the open slot", async () => {
    const onCreatePlayer = vi.fn().mockResolvedValue("user-new");
    const onStrikerChange = vi.fn();

    render(
      <BatsmenDialog
        open={true}
        onOpenChange={vi.fn()}
        battingTeamPlayers={mockPlayers}
        battingTeamName="Mumbai"
        strikerId={null}
        nonStrikerId={null}
        onStrikerChange={onStrikerChange}
        onNonStrikerChange={vi.fn()}
        onConfirm={vi.fn()}
        isProcessing={false}
        onCreatePlayer={onCreatePlayer}
      />,
    );

    fireEvent.change(screen.getByRole("searchbox"), {
      target: { value: "KL Rahul" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: /Add .KL Rahul. to Mumbai/ }),
    );
    await waitFor(() =>
      expect(onCreatePlayer).toHaveBeenCalledWith("KL Rahul"),
    );
    await waitFor(() =>
      expect(onStrikerChange).toHaveBeenCalledWith("user-new"),
    );
  });

  it("fills the striker then the non-striker with two taps", () => {
    const onStrikerChange = vi.fn();
    const onNonStrikerChange = vi.fn();
    const props = {
      open: true,
      onOpenChange: vi.fn(),
      battingTeamPlayers: mockPlayers,
      onStrikerChange,
      onNonStrikerChange,
      onConfirm: vi.fn(),
      isProcessing: false,
    };
    const { rerender } = render(
      <BatsmenDialog {...props} strikerId={null} nonStrikerId={null} />,
    );
    fireEvent.click(screen.getByRole("radio", { name: /Virat Kohli/ }));
    expect(onStrikerChange).toHaveBeenCalledWith("user-1");

    rerender(
      <BatsmenDialog {...props} strikerId="user-1" nonStrikerId={null} />,
    );
    fireEvent.click(screen.getByRole("radio", { name: /Rohit Sharma/ }));
    expect(onNonStrikerChange).toHaveBeenCalledWith("user-2");
  });

  it("preselects the next batter after a wicket and confirms in one tap", () => {
    const onConfirm = vi.fn();
    const onNonStrikerChange = vi.fn();
    const players: TeamPlayer[] = [
      ...mockPlayers,
      {
        id: "tp-3",
        team_id: "team-1",
        user_id: "user-3",
        user: { id: "user-3", full_name: "Shubman Gill" },
      },
    ];
    render(
      <BatsmenDialog
        open={true}
        onOpenChange={vi.fn()}
        battingTeamPlayers={players}
        battingPerformances={[
          {
            id: "bp-2",
            match_id: "m",
            innings_id: "i",
            user_id: "user-2",
            runs_scored: 12,
            balls_faced: 9,
            fours: 2,
            sixes: 0,
            is_out: true,
            dismissal_type: "bowled",
          },
        ]}
        dismissedPlayerIds={new Set(["user-2"])}
        strikerId="user-1"
        nonStrikerId={null}
        onStrikerChange={vi.fn()}
        onNonStrikerChange={onNonStrikerChange}
        onConfirm={onConfirm}
        isProcessing={false}
      />,
    );

    expect(screen.getByRole("radio", { name: /Rohit Sharma/ })).toBeDisabled();
    expect(
      screen.getByRole("radio", { name: /Rohit Sharma/ }),
    ).toHaveTextContent("Out");
    fireEvent.click(screen.getByRole("button", { name: "Confirm" }));
    expect(onNonStrikerChange).toHaveBeenCalledWith("user-3");
    expect(onConfirm).toHaveBeenCalledWith({
      strikerId: "user-1",
      nonStrikerId: "user-3",
    });
  });

  it("swaps ends when the batter at the other end is picked", () => {
    const onStrikerChange = vi.fn();
    const onNonStrikerChange = vi.fn();
    render(
      <BatsmenDialog
        open={true}
        onOpenChange={vi.fn()}
        battingTeamPlayers={mockPlayers}
        strikerId="user-1"
        nonStrikerId="user-2"
        onStrikerChange={onStrikerChange}
        onNonStrikerChange={onNonStrikerChange}
        onConfirm={vi.fn()}
        isProcessing={false}
      />,
    );
    fireEvent.click(screen.getByRole("radio", { name: /Rohit Sharma/ }));
    expect(onStrikerChange).toHaveBeenCalledWith("user-2");
    expect(onNonStrikerChange).toHaveBeenCalledWith("user-1");
  });

  it("disables Confirm button when striker or non-striker is missing", () => {
    // Nobody is left to suggest, so the empty end stays empty.
    render(
      <BatsmenDialog
        open={true}
        onOpenChange={vi.fn()}
        battingTeamPlayers={mockPlayers}
        dismissedPlayerIds={new Set(["user-2"])}
        strikerId="user-1"
        nonStrikerId={null}
        onStrikerChange={vi.fn()}
        onNonStrikerChange={vi.fn()}
        onConfirm={vi.fn()}
        isProcessing={false}
      />,
    );

    const confirmButton = screen.getByRole("button", { name: "Confirm" });
    expect(confirmButton).toBeDisabled();
  });

  it("enables Confirm button when both striker and non-striker are chosen", () => {
    const handleConfirm = vi.fn();

    render(
      <BatsmenDialog
        open={true}
        onOpenChange={vi.fn()}
        battingTeamPlayers={mockPlayers}
        strikerId="user-1"
        nonStrikerId="user-2"
        onStrikerChange={vi.fn()}
        onNonStrikerChange={vi.fn()}
        onConfirm={handleConfirm}
        isProcessing={false}
      />,
    );

    const confirmButton = screen.getByRole("button", { name: "Confirm" });
    expect(confirmButton).toBeEnabled();

    fireEvent.click(confirmButton);
    expect(handleConfirm).toHaveBeenCalledTimes(1);
  });

  it("disables Confirm button and filters or disables bowler when bowler or bowling player is selected", () => {
    const bowlingTeamPlayerIds = new Set(["user-bowler-1"]);
    const handleConfirm = vi.fn();

    const { rerender } = render(
      <BatsmenDialog
        open={true}
        onOpenChange={vi.fn()}
        battingTeamPlayers={mockPlayers}
        bowlingTeamPlayerIds={bowlingTeamPlayerIds}
        currentBowlerId="user-1"
        strikerId="user-1"
        nonStrikerId="user-2"
        onStrikerChange={vi.fn()}
        onNonStrikerChange={vi.fn()}
        onConfirm={handleConfirm}
        isProcessing={false}
      />,
    );

    // Confirm is disabled because striker is currentBowlerId
    expect(screen.getByRole("button", { name: "Confirm" })).toBeDisabled();

    // If striker is an opposing team player in bowlingTeamPlayerIds
    rerender(
      <BatsmenDialog
        open={true}
        onOpenChange={vi.fn()}
        battingTeamPlayers={mockPlayers}
        bowlingTeamPlayerIds={bowlingTeamPlayerIds}
        currentBowlerId={null}
        strikerId="user-bowler-1"
        nonStrikerId="user-2"
        onStrikerChange={vi.fn()}
        onNonStrikerChange={vi.fn()}
        onConfirm={handleConfirm}
        isProcessing={false}
      />,
    );

    expect(screen.getByRole("button", { name: "Confirm" })).toBeDisabled();
  });

  it("filters out opposing team players from selectable batting list when in bowlingTeamPlayerIds", () => {
    const mixedPlayers: TeamPlayer[] = [
      ...mockPlayers,
      {
        id: "tp-3",
        team_id: "team-2",
        user_id: "user-opp-3",
        user: { id: "user-opp-3", full_name: "Opposing Bowler" },
      },
    ];

    render(
      <BatsmenDialog
        open={true}
        onOpenChange={vi.fn()}
        battingTeamPlayers={mixedPlayers}
        bowlingTeamPlayerIds={new Set(["user-opp-3"])}
        currentBowlerId={null}
        strikerId={null}
        nonStrikerId={null}
        onStrikerChange={vi.fn()}
        onNonStrikerChange={vi.fn()}
        onConfirm={vi.fn()}
        isProcessing={false}
      />,
    );

    expect(screen.queryByText("Opposing Bowler")).not.toBeInTheDocument();
  });
});
