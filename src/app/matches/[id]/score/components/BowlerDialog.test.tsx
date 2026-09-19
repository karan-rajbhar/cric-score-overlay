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

    expect(screen.getByText("Select Bowler")).toBeInTheDocument();
    expect(
      screen.getByText(/Choose the bowler to deliver the next over/i),
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
});
