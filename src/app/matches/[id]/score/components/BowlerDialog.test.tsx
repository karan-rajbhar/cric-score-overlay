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
        onConfirm={vi.fn()}
        isProcessing={false}
      />,
    );

    expect(
      screen.getByText(
        /This bowler bowled the last over. Choose someone else./i,
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
    const onConfirm = vi.fn();

    render(
      <BowlerDialog
        open={true}
        onOpenChange={vi.fn()}
        bowlingTeamPlayers={mockPlayers}
        bowlingTeamName="Chennai"
        currentBowlerId={null}
        lastOverBowlerId="user-kishor"
        onConfirm={onConfirm}
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
    // The new player is picked; confirming bowls them.
    fireEvent.click(screen.getByRole("button", { name: "Confirm bowler" }));
    await waitFor(() => expect(onConfirm).toHaveBeenCalledWith("user-new"));
  });

  it("shows why the previous over's bowler is unavailable and preselects nobody", () => {
    const onConfirm = vi.fn();
    render(
      <BowlerDialog
        open={true}
        onOpenChange={vi.fn()}
        bowlingTeamPlayers={mockPlayers}
        currentBowlerId={null}
        lastOverBowlerId="user-kishor"
        onConfirm={onConfirm}
        isProcessing={false}
      />,
    );

    const kishor = screen.getByRole("radio", { name: /Kishor/ });
    expect(kishor).toBeDisabled();
    expect(kishor).toHaveTextContent("Bowled last over");
    const rahul = screen.getByRole("radio", { name: /Rahul/ });
    expect(rahul).toHaveAttribute("aria-checked", "false");
    expect(screen.getByRole("button", { name: "Confirm bowler" })).toBeDisabled();
    // Picking does not bowl them yet: only Confirm does.
    fireEvent.click(rahul);
    expect(onConfirm).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Confirm bowler" }));
    expect(onConfirm).toHaveBeenCalledWith("user-rahul");
  });

  it("says it is the bowling side's dialog, and for which over", () => {
    render(
      <BowlerDialog
        open={true}
        onOpenChange={vi.fn()}
        bowlingTeamPlayers={mockPlayers}
        bowlingTeamName="Chennai"
        currentBowlerId={null}
        overNumber={5}
        onConfirm={vi.fn()}
        isProcessing={false}
        onCreatePlayer={vi.fn()}
      />,
    );
    expect(screen.getByTestId("role-band-bowling")).toHaveTextContent("Bowling · Chennai");
    expect(
      screen.getByRole("heading", { name: "Choose the bowler for over 5" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("searchbox", { name: "Search or add a bowler" })).toBeInTheDocument();
  });

  it("focuses the first available row on open (no phone keyboard) and confirms with Enter", async () => {
    const onConfirm = vi.fn();
    render(
      <BowlerDialog
        open={true}
        onOpenChange={vi.fn()}
        bowlingTeamPlayers={mockPlayers}
        bowlingTeamName="Chennai"
        currentBowlerId={null}
        lastOverBowlerId="user-kishor"
        onConfirm={onConfirm}
        isProcessing={false}
        onCreatePlayer={vi.fn()}
      />,
    );
    const rahul = screen.getByRole("radio", { name: /Rahul/ });
    await waitFor(() => expect(rahul).toHaveFocus());
    fireEvent.keyDown(rahul, { key: "Enter" });
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

  describe("mid-over, with balls already bowled", () => {
    const squad: TeamPlayer[] = [
      ...mockPlayers,
      {
        id: "tp-3",
        team_id: "team-2",
        user_id: "user-manoj",
        user: { id: "user-manoj", full_name: "Manoj" },
      },
    ];
    const renderMidOver = (
      overrides: Partial<React.ComponentProps<typeof BowlerDialog>> = {},
    ) => {
      const onConfirm = vi.fn();
      const onReassign = vi.fn();
      render(
        <BowlerDialog
          open={true}
          onOpenChange={vi.fn()}
          bowlingTeamPlayers={squad}
          currentBowlerId="user-rahul"
          overBowling={{ bowlerId: "user-rahul", balls: 3 }}
          overNumber={5}
          onConfirm={onConfirm}
          onReassign={onReassign}
          isProcessing={false}
          {...overrides}
        />,
      );
      return { onConfirm, onReassign };
    };
    const pick = (name: RegExp) =>
      fireEvent.click(screen.getByRole("radio", { name }));

    it("says whose balls they are and asks what happened before any pick", () => {
      renderMidOver();
      expect(
        screen.getByText("Rahul has bowled 3 balls in this over."),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("heading", { name: "Change the bowler of over 5" }),
      ).toBeInTheDocument();
      expect(screen.queryByRole("radio", { name: /Kishor/ })).toBeNull();
      expect(
        screen.getByRole("button", { name: "Choose what happened" }),
      ).toBeDisabled();
    });

    it("a wrong bowler gives the balls to the right one", () => {
      const { onConfirm, onReassign } = renderMidOver();
      pick(/Wrong bowler/);
      expect(
        screen.getByRole("button", { name: "Choose who bowled" }),
      ).toBeDisabled();
      pick(/Kishor/);
      fireEvent.click(
        screen.getByRole("button", { name: "Give 3 balls to Kishor" }),
      );
      expect(onReassign).toHaveBeenCalledWith("user-kishor");
      expect(onConfirm).not.toHaveBeenCalled();
    });

    it("an injured bowler keeps the balls and another finishes the over", () => {
      const { onConfirm, onReassign } = renderMidOver();
      pick(/Can't finish the over/);
      pick(/Manoj/);
      fireEvent.click(
        screen.getByRole("button", { name: "Manoj finishes the over" }),
      );
      expect(onConfirm).toHaveBeenCalledWith("user-manoj");
      expect(onReassign).not.toHaveBeenCalled();
    });

    it("never offers the bowler whose balls these are", () => {
      renderMidOver();
      pick(/Wrong bowler/);
      expect(screen.queryByRole("radio", { name: /^Rahul/ })).toBeNull();
    });

    it("keeps the previous over's bowler out, whichever the reason", () => {
      const { onReassign } = renderMidOver({
        lastOverBowlerId: "user-kishor",
      });
      pick(/Wrong bowler/);
      expect(screen.getByRole("radio", { name: /Kishor/ })).toBeDisabled();
      expect(onReassign).not.toHaveBeenCalled();
    });

    it("lets a bowler brought on with none of the balls be given them", () => {
      const { onReassign } = renderMidOver({
        currentBowlerId: "user-kishor",
      });
      expect(
        screen.getByText("Rahul has bowled 3 balls in this over."),
      ).toBeInTheDocument();
      pick(/Wrong bowler/);
      pick(/Kishor/);
      fireEvent.click(
        screen.getByRole("button", { name: "Give 3 balls to Kishor" }),
      );
      expect(onReassign).toHaveBeenCalledWith("user-kishor");
    });

    it("asks nothing before the over's first ball", () => {
      renderMidOver({ overBowling: null });
      expect(screen.queryByText("What happened?")).toBeNull();
      expect(
        screen.getByRole("button", { name: "Confirm bowler" }),
      ).toBeInTheDocument();
    });

    it("reads one ball in the singular", () => {
      renderMidOver({ overBowling: { bowlerId: "user-rahul", balls: 1 } });
      expect(
        screen.getByText("Rahul has bowled 1 ball in this over."),
      ).toBeInTheDocument();
    });
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
        onConfirm={vi.fn()}
        isProcessing={false}
      />,
    );

    expect(screen.queryByText("Opposing Batsman")).not.toBeInTheDocument();
  });
});
