import { render, screen, fireEvent, waitFor } from "@testing-library/react";
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

    expect(screen.getByRole("heading", { name: "Record wicket" })).toBeInTheDocument();
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

  it("picks a fielder from the list, keeper first for a stumping", () => {
    const onFielderChange = vi.fn();
    render(
      <WicketDialog
        open={true}
        onOpenChange={vi.fn()}
        dismissalType="stumped"
        onDismissalTypeChange={vi.fn()}
        fielderId=""
        onFielderChange={onFielderChange}
        bowlingTeamPlayers={[
          ...mockFielders,
          {
            user_id: "u-3",
            role_in_team: "wicket_keeper",
            user: { full_name: "MS Dhoni" },
          },
        ]}
        strikerId="s-1"
        nonStrikerId="ns-1"
        onConfirm={vi.fn()}
        isProcessing={false}
      />,
    );
    const fielders = screen.getAllByRole("radio", { name: /Jadeja|Rahul|Dhoni/ });
    expect(fielders[0]).toHaveAccessibleName("MS Dhoni (wk)");
    fireEvent.click(screen.getByRole("radio", { name: /Jadeja/ }));
    expect(onFielderChange).toHaveBeenCalledWith("u-1");
  });

  it("only lets a run out take the non-striker", () => {
    const onDismissed = vi.fn();
    const props = {
      open: true,
      onOpenChange: vi.fn(),
      onDismissalTypeChange: vi.fn(),
      fielderId: "",
      onFielderChange: vi.fn(),
      bowlingTeamPlayers: mockFielders,
      strikerId: "s-1",
      nonStrikerId: "ns-1",
      strikerName: "Virat Kohli",
      nonStrikerName: "Rohit Sharma",
      dismissedPlayerId: "s-1",
      onDismissedPlayerChange: onDismissed,
      onConfirm: vi.fn(),
      isProcessing: false,
    };
    const { rerender } = render(<WicketDialog {...props} dismissalType="bowled" />);
    expect(screen.getByRole("radio", { name: /Rohit Sharma/ })).toBeDisabled();

    rerender(<WicketDialog {...props} dismissalType="run_out" />);
    fireEvent.click(screen.getByRole("radio", { name: /Rohit Sharma/ }));
    expect(onDismissed).toHaveBeenCalledWith("ns-1");
  });

  it("adds a substitute fielder inline", async () => {
    const onCreateFielder = vi.fn().mockResolvedValue("u-sub");
    const onFielderChange = vi.fn();
    render(
      <WicketDialog
        open={true}
        onOpenChange={vi.fn()}
        dismissalType="caught"
        onDismissalTypeChange={vi.fn()}
        fielderId=""
        onFielderChange={onFielderChange}
        bowlingTeamPlayers={mockFielders}
        bowlingTeamName="India"
        onCreateFielder={onCreateFielder}
        strikerId="s-1"
        nonStrikerId="ns-1"
        onConfirm={vi.fn()}
        isProcessing={false}
      />,
    );
    fireEvent.change(screen.getByRole("searchbox"), {
      target: { value: "Sub Fielder" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: /Add .Sub Fielder. to India/ }),
    );
    await waitFor(() => expect(onFielderChange).toHaveBeenCalledWith("u-sub"));
  });

  it("offers a retirement apart from dismissals, for either batter, never on an extra", () => {
    const props = {
      open: true,
      onOpenChange: vi.fn(),
      onDismissalTypeChange: vi.fn(),
      fielderId: "",
      onFielderChange: vi.fn(),
      bowlingTeamPlayers: mockFielders,
      strikerId: "s-1",
      nonStrikerId: "ns-1",
      strikerName: "Virat Kohli",
      nonStrikerName: "Rohit Sharma",
      onDismissedPlayerChange: vi.fn(),
      onConfirm: vi.fn(),
      isProcessing: false,
    };
    const { rerender } = render(
      <WicketDialog {...props} dismissalType="retired_hurt" dismissedPlayerId="ns-1" />,
    );
    expect(
      screen.getByRole("group", { name: "Or a retirement (not a ball)" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("note")).toHaveTextContent(/not out/i);
    // Either batter can retire; the button says who.
    expect(screen.getByRole("radio", { name: /Rohit Sharma/ })).toBeEnabled();
    expect(
      screen.getByRole("button", { name: "Retire hurt: Rohit Sharma" }),
    ).toBeInTheDocument();

    // Back to a dismissal only the striker can take: the striker is picked.
    fireEvent.click(screen.getByRole("button", { name: "Bowled" }));
    expect(props.onDismissalTypeChange).toHaveBeenCalledWith("bowled");
    expect(props.onDismissedPlayerChange).toHaveBeenCalledWith("s-1");

    // A wicket on a no-ball: no retirement offered.
    rerender(
      <WicketDialog {...props} dismissalType="run_out" extraType="no_ball" />,
    );
    expect(screen.queryByRole("button", { name: "Retired hurt" })).toBeNull();
  });
});
