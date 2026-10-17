import { render, screen, fireEvent, waitFor } from "@testing-library/react";
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
      />,
    );

    expect(
      screen.getByRole("heading", { name: /Bowler/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Choose the bowler/i)).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /Kishor/ })).toBeInTheDocument();
  });

  it("disables Confirm Bowler when currentBowlerId is null", () => {
    // Two eligible bowlers: nothing is preselected.
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
      />,
    );

    const confirmBtn = screen.getByRole("button", { name: "Confirm bowler" });
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
      />,
    );

    expect(
      screen.getByText(
        /This bowler completed the previous over. Please select a different bowler./i,
      ),
    ).toBeInTheDocument();

    const confirmBtn = screen.getByRole("button", { name: "Confirm bowler" });
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
      />,
    );

    const confirmBtn = screen.getByRole("button", { name: "Confirm bowler" });
    expect(confirmBtn).toBeEnabled();

    fireEvent.click(confirmBtn);
    expect(handleConfirm).toHaveBeenCalledTimes(1);
  });

  it("allows inline addition of a new bowler to squad", async () => {
    const onCreatePlayer = vi.fn().mockResolvedValue("user-new");
    const onBowlerChange = vi.fn();

    render(
      <BowlerDialog
        open={true}
        onOpenChange={vi.fn()}
        bowlingTeamPlayers={mockPlayers}
        bowlingTeamName="Chennai"
        currentBowlerId={null}
        lastOverBowlerId="user-kishor"
        onBowlerChange={onBowlerChange}
        onConfirm={vi.fn()}
        isProcessing={false}
        onCreatePlayer={onCreatePlayer}
      />,
    );

    fireEvent.change(screen.getByRole("searchbox"), {
      target: { value: "Jasprit Bumrah" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: /Add .Jasprit Bumrah. to Chennai/ }),
    );
    await waitFor(() =>
      expect(onCreatePlayer).toHaveBeenCalledWith("Jasprit Bumrah"),
    );
    await waitFor(() =>
      expect(onBowlerChange).toHaveBeenCalledWith("user-new"),
    );
  });

  it("shows why the previous over's bowler is unavailable and preselects the only eligible one", () => {
    const onConfirm = vi.fn();
    render(
      <BowlerDialog
        open={true}
        onOpenChange={vi.fn()}
        bowlingTeamPlayers={mockPlayers}
        currentBowlerId={null}
        lastOverBowlerId="user-kishor"
        onBowlerChange={vi.fn()}
        onConfirm={onConfirm}
        isProcessing={false}
      />,
    );

    const kishor = screen.getByRole("radio", { name: /Kishor/ });
    expect(kishor).toBeDisabled();
    expect(kishor).toHaveTextContent("Bowled last over");
    expect(screen.getByRole("radio", { name: /Rahul/ })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    fireEvent.click(screen.getByRole("button", { name: "Confirm bowler" }));
    expect(onConfirm).toHaveBeenCalledWith("user-rahul");
  });

  it("disables adding players with a reason while offline", () => {
    render(
      <BowlerDialog
        open={true}
        onOpenChange={vi.fn()}
        bowlingTeamPlayers={mockPlayers}
        bowlingTeamName="Chennai"
        currentBowlerId={null}
        onBowlerChange={vi.fn()}
        onConfirm={vi.fn()}
        isProcessing={false}
        onCreatePlayer={vi.fn()}
        addPlayerDisabledReason="Adding players needs a connection."
      />,
    );
    fireEvent.change(screen.getByRole("searchbox"), {
      target: { value: "Ashwin" },
    });
    expect(
      screen.getByRole("button", { name: /Add .Ashwin. to Chennai/ }),
    ).toBeDisabled();
    expect(
      screen.getByText("Adding players needs a connection."),
    ).toBeInTheDocument();
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

    const confirmBtn = screen.getByRole("button", { name: "Confirm bowler" });
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

    expect(
      screen.getByRole("button", { name: "Confirm bowler" }),
    ).toBeDisabled();
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
