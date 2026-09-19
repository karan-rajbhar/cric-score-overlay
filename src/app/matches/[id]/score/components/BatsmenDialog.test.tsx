import { render, screen, fireEvent } from "@testing-library/react";
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
        addPlayerTarget={null}
        newPlayerName=""
        onNewPlayerNameChange={vi.fn()}
        onAddPlayer={vi.fn()}
        onAddPlayerTargetChange={vi.fn()}
      />,
    );

    expect(screen.getByText(/Select.*Batsmen/i)).toBeInTheDocument();
    expect(screen.getByText("Striker")).toBeInTheDocument();
    expect(screen.getByText("Non-Striker")).toBeInTheDocument();
    expect(screen.getByText("New player? Add to squad")).toBeInTheDocument();
  });

  it("shows input and Add button when addPlayerTarget is 'batting'", () => {
    const handleAddPlayer = vi.fn();
    const handleNameChange = vi.fn();

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
        addPlayerTarget="batting"
        newPlayerName="KL Rahul"
        onNewPlayerNameChange={handleNameChange}
        onAddPlayer={handleAddPlayer}
        onAddPlayerTargetChange={vi.fn()}
      />,
    );

    const input = screen.getByPlaceholderText("Player name");
    expect(input).toBeInTheDocument();
    expect(input).toHaveValue("KL Rahul");

    const addButton = screen.getByRole("button", { name: "Add" });
    expect(addButton).toBeEnabled();

    fireEvent.click(addButton);
    expect(handleAddPlayer).toHaveBeenCalledTimes(1);
  });

  it("disables Confirm button when striker or non-striker is missing", () => {
    render(
      <BatsmenDialog
        open={true}
        onOpenChange={vi.fn()}
        battingTeamPlayers={mockPlayers}
        strikerId="user-1"
        nonStrikerId={null}
        onStrikerChange={vi.fn()}
        onNonStrikerChange={vi.fn()}
        onConfirm={vi.fn()}
        isProcessing={false}
        addPlayerTarget={null}
        newPlayerName=""
        onNewPlayerNameChange={vi.fn()}
        onAddPlayer={vi.fn()}
        onAddPlayerTargetChange={vi.fn()}
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
        addPlayerTarget={null}
        newPlayerName=""
        onNewPlayerNameChange={vi.fn()}
        onAddPlayer={vi.fn()}
        onAddPlayerTargetChange={vi.fn()}
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
        addPlayerTarget={null}
        newPlayerName=""
        onNewPlayerNameChange={vi.fn()}
        onAddPlayer={vi.fn()}
        onAddPlayerTargetChange={vi.fn()}
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
        addPlayerTarget={null}
        newPlayerName=""
        onNewPlayerNameChange={vi.fn()}
        onAddPlayer={vi.fn()}
        onAddPlayerTargetChange={vi.fn()}
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
        addPlayerTarget={null}
        newPlayerName=""
        onNewPlayerNameChange={vi.fn()}
        onAddPlayer={vi.fn()}
        onAddPlayerTargetChange={vi.fn()}
      />,
    );

    expect(screen.queryByText("Opposing Bowler")).not.toBeInTheDocument();
  });
});
