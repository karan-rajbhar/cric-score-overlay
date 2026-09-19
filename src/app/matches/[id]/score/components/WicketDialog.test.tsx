import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { WicketDialog } from "./WicketDialog";

describe("WicketDialog", () => {
  const mockFielders = [
    { user_id: "u-1", user: { full_name: "Ravindra Jadeja" } },
    { user_id: "u-2", user: { full_name: "KL Rahul" } },
  ];

  it("renders WicketDialog with rapid dismissal chips", () => {
    render(
      <WicketDialog
        open={true}
        onOpenChange={vi.fn()}
        dismissalType="bowled"
        onDismissalTypeChange={vi.fn()}
        fielderId=""
        onFielderChange={vi.fn()}
        bowlingTeamPlayers={mockFielders}
        strikerId="s-1"
        nonStrikerId="ns-1"
        strikerName="Virat Kohli"
        nonStrikerName="Rohit Sharma"
        onConfirm={vi.fn()}
        isProcessing={false}
      />,
    );

    expect(screen.getByRole("heading", { name: "Record Wicket" })).toBeInTheDocument();
    expect(screen.getByText("How was the batsman out?")).toBeInTheDocument();

    // Check rapid chips
    const bowledChip = screen.getByRole("button", { name: "Bowled" });
    const caughtChip = screen.getByRole("button", { name: "Caught" });
    expect(bowledChip).toBeInTheDocument();
    expect(caughtChip).toBeInTheDocument();
  });

  it("triggers onDismissalTypeChange when a rapid chip is tapped", () => {
    const handleDismissalChange = vi.fn();
    render(
      <WicketDialog
        open={true}
        onOpenChange={vi.fn()}
        dismissalType="bowled"
        onDismissalTypeChange={handleDismissalChange}
        fielderId=""
        onFielderChange={vi.fn()}
        bowlingTeamPlayers={mockFielders}
        strikerId="s-1"
        nonStrikerId="ns-1"
        strikerName="Virat Kohli"
        nonStrikerName="Rohit Sharma"
        onConfirm={vi.fn()}
        isProcessing={false}
      />,
    );

    const caughtChip = screen.getByRole("button", { name: "Caught" });
    fireEvent.click(caughtChip);
    expect(handleDismissalChange).toHaveBeenCalledWith("caught");
  });

  it("filters dismissals under No-Ball according to MCC Law 21.18", () => {
    render(
      <WicketDialog
        open={true}
        onOpenChange={vi.fn()}
        dismissalType="run_out"
        onDismissalTypeChange={vi.fn()}
        fielderId=""
        onFielderChange={vi.fn()}
        bowlingTeamPlayers={mockFielders}
        strikerId="s-1"
        nonStrikerId="ns-1"
        extraType="no_ball"
        onConfirm={vi.fn()}
        isProcessing={false}
      />,
    );

    expect(screen.getByText(/Under MCC Law 21.18/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Bowled" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Run Out" })).toBeInTheDocument();
  });
});
