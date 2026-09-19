import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { BowlerDialog } from "./BowlerDialog";
import type { TeamPlayer } from "~/lib/match-types";

describe("BowlerDialog", () => {
  const mockPlayers: TeamPlayer[] = [
    {
      id: "tp-1",
      team_id: "team-2",
      user_id: "user-kishor",
      user: { id: "user-kishor", full_name: "Kishor" },
    },
    {
      id: "tp-2",
      team_id: "team-2",
      user_id: "user-rahul",
      user: { id: "user-rahul", full_name: "Rahul" },
    },
  ];

  it("renders BowlerDialog with title and prompt", () => {
    render(
      <BowlerDialog
        open={true}
        onOpenChange={vi.fn()}
        bowlingTeamPlayers={mockPlayers}
        currentBowlerId={null}
        lastOverBowlerId={null}
        onBowlerChange={vi.fn()}
        onConfirm={vi.fn()}
        isProcessing={false}
        addPlayerTarget={null}
        newPlayerName=""
        onNewPlayerNameChange={vi.fn()}
        onAddPlayer={vi.fn()}
        onAddPlayerTargetChange={vi.fn()}
      />,
    );

    expect(
      screen.getByRole("heading", { name: /Bowler/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Choose the bowler/i),
    ).toBeInTheDocument();
    expect(screen.getByText("New player? Add to squad")).toBeInTheDocument();
  });


  it("disables Confirm Bowler when currentBowlerId is null", () => {
    render(
      <BowlerDialog
        open={true}
        onOpenChange={vi.fn()}
        bowlingTeamPlayers={mockPlayers}
        currentBowlerId={null}
        lastOverBowlerId="user-kishor"
        onBowlerChange={vi.fn()}
        onConfirm={vi.fn()}
        isProcessing={false}
        addPlayerTarget={null}
        newPlayerName=""
        onNewPlayerNameChange={vi.fn()}
        onAddPlayer={vi.fn()}
        onAddPlayerTargetChange={vi.fn()}
      />,
    );

    const confirmBtn = screen.getByRole("button", { name: "Confirm Bowler" });
    expect(confirmBtn).toBeDisabled();
  });

  it("disables Confirm Bowler when currentBowlerId is the consecutive bowler", () => {
    render(
      <BowlerDialog
        open={true}
        onOpenChange={vi.fn()}
        bowlingTeamPlayers={mockPlayers}
        currentBowlerId="user-kishor"
        lastOverBowlerId="user-kishor"
        onBowlerChange={vi.fn()}
        onConfirm={vi.fn()}
        isProcessing={false}
        addPlayerTarget={null}
        newPlayerName=""
        onNewPlayerNameChange={vi.fn()}
        onAddPlayer={vi.fn()}
        onAddPlayerTargetChange={vi.fn()}
      />,
    );

    expect(
      screen.getByText(
        /This bowler completed the previous over. Please select a different bowler./i,
      ),
    ).toBeInTheDocument();

    const confirmBtn = screen.getByRole("button", { name: "Confirm Bowler" });
    expect(confirmBtn).toBeDisabled();
  });

  it("enables Confirm Bowler when a non-consecutive bowler is chosen", () => {
    const handleConfirm = vi.fn();
    render(
      <BowlerDialog
        open={true}
        onOpenChange={vi.fn()}
        bowlingTeamPlayers={mockPlayers}
        currentBowlerId="user-rahul"
        lastOverBowlerId="user-kishor"
        onBowlerChange={vi.fn()}
        onConfirm={handleConfirm}
        isProcessing={false}
        addPlayerTarget={null}
        newPlayerName=""
        onNewPlayerNameChange={vi.fn()}
        onAddPlayer={vi.fn()}
        onAddPlayerTargetChange={vi.fn()}
      />,
    );

    const confirmBtn = screen.getByRole("button", { name: "Confirm Bowler" });
    expect(confirmBtn).toBeEnabled();

    fireEvent.click(confirmBtn);
    expect(handleConfirm).toHaveBeenCalledTimes(1);
  });

  it("allows inline addition of a new bowler to squad", () => {
    const handleAddPlayer = vi.fn();
    const handleNameChange = vi.fn();

    render(
      <BowlerDialog
        open={true}
        onOpenChange={vi.fn()}
        bowlingTeamPlayers={mockPlayers}
        currentBowlerId={null}
        lastOverBowlerId="user-kishor"
        onBowlerChange={vi.fn()}
        onConfirm={vi.fn()}
        isProcessing={false}
        addPlayerTarget="bowling"
        newPlayerName="Jasprit Bumrah"
        onNewPlayerNameChange={handleNameChange}
        onAddPlayer={handleAddPlayer}
        onAddPlayerTargetChange={vi.fn()}
      />,
    );

    const input = screen.getByPlaceholderText("Player name");
    expect(input).toHaveValue("Jasprit Bumrah");

    const addBtn = screen.getByRole("button", { name: "Add" });
    fireEvent.click(addBtn);
    expect(handleAddPlayer).toHaveBeenCalledTimes(1);
  });

  it("renders reassign deliveries checkbox when currentBall > 0", () => {
    const handleReassignChange = vi.fn();

    render(
      <BowlerDialog
        open={true}
        onOpenChange={vi.fn()}
        bowlingTeamPlayers={mockPlayers}
        currentBowlerId="user-rahul"
        lastOverBowlerId="user-kishor"
        currentBall={3}
        reassignOverDeliveries={false}
        onReassignOverDeliveriesChange={handleReassignChange}
        onBowlerChange={vi.fn()}
        onConfirm={vi.fn()}
        isProcessing={false}
      />,
    );

    const checkbox = screen.getByRole("checkbox");
    expect(checkbox).toBeInTheDocument();
    expect(
      screen.getByText(/Correct wrong bowler selection/i),
    ).toBeInTheDocument();

    fireEvent.click(checkbox);
    expect(handleReassignChange).toHaveBeenCalledWith(true);
  });

  it("disables Confirm Bowler when currentBowlerId is batting (striker or non-striker)", () => {
    const handleConfirm = vi.fn();
    const { rerender } = render(
      <BowlerDialog
        open={true}
        onOpenChange={vi.fn()}
        bowlingTeamPlayers={mockPlayers}
        currentBowlerId="user-kishor"
        strikerId="user-kishor"
        nonStrikerId="user-other"
        onBowlerChange={vi.fn()}
        onConfirm={handleConfirm}
        isProcessing={false}
      />,
    );

    const confirmBtn = screen.getByRole("button", { name: "Confirm Bowler" });
    expect(confirmBtn).toBeDisabled();
    expect(
      screen.getByText(
        /This player is currently batting for the opposing team and cannot bowl./i,
      ),
    ).toBeInTheDocument();

    // Also check non-striker
    rerender(
      <BowlerDialog
        open={true}
        onOpenChange={vi.fn()}
        bowlingTeamPlayers={mockPlayers}
        currentBowlerId="user-kishor"
        strikerId="user-other"
        nonStrikerId="user-kishor"
        onBowlerChange={vi.fn()}
        onConfirm={handleConfirm}
        isProcessing={false}
      />,
    );

    expect(screen.getByRole("button", { name: "Confirm Bowler" })).toBeDisabled();
  });

  it("filters out batting team players from selectable bowling list when in battingTeamPlayerIds", () => {
    const mixedPlayers: TeamPlayer[] = [
      ...mockPlayers,
      {
        id: "tp-batter",
        team_id: "team-1",
        user_id: "user-batter-1",
        user: { id: "user-batter-1", full_name: "Opposing Batsman" },
      },
    ];

    render(
      <BowlerDialog
        open={true}
        onOpenChange={vi.fn()}
        bowlingTeamPlayers={mixedPlayers}
        battingTeamPlayerIds={new Set(["user-batter-1"])}
        currentBowlerId={null}
        onBowlerChange={vi.fn()}
        onConfirm={vi.fn()}
        isProcessing={false}
      />,
    );

    expect(screen.queryByText("Opposing Batsman")).not.toBeInTheDocument();
  });
});

