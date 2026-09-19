import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MatchSettingsDialog } from "./MatchSettingsDialog";
import type { Match } from "~/lib/match-types";

describe("MatchSettingsDialog (Mid-Game Rules & Format Adjustment)", () => {
  const dummyMatch: Match = {
    id: "m-123",
    title: "Championship Final",
    match_format: "T20",
    overs_per_innings: 20,
    status: "live",
    current_innings: 2,
    current_over: 5,
    current_ball: 2,
    wickets_per_innings: 10,
    last_man_stands: false,
    golden_ball: false,
    team1_id: "t1",
    team2_id: "t2",
    team1: { id: "t1", name: "Hawks" },
    team2: { id: "t2", name: "Eagles" },
    innings: [
      {
        id: "inn-1",
        match_id: "m-123",
        innings_number: 1,
        team_id: "t1",
        total_runs: 160,
        total_wickets: 7,
        total_balls: 120,
        total_overs: 20,
        is_completed: true,
        extras_total: 10,
        extras_byes: 0,
        extras_leg_byes: 0,
        extras_wides: 5,
        extras_no_balls: 5,
        extras_penalties: 0,
      },
      {
        id: "inn-2",
        match_id: "m-123",
        innings_number: 2,
        team_id: "t2",
        total_runs: 45,
        total_wickets: 1,
        total_balls: 32,
        total_overs: 5,
        is_completed: false,
        target_runs: 161,
        extras_total: 4,
        extras_byes: 0,
        extras_leg_byes: 0,
        extras_wides: 2,
        extras_no_balls: 2,
        extras_penalties: 0,
      },
    ],
  };

  it("renders mid-game format, overs, target, and special rules controls", () => {
    render(
      <MatchSettingsDialog
        open={true}
        onOpenChange={vi.fn()}
        match={dummyMatch}
        onSave={vi.fn()}
        isProcessing={false}
      />,
    );

    expect(screen.getByText(/match settings & rules/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/match format/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/overs per innings/i)).toHaveValue(20);
    expect(screen.getByLabelText(/target runs/i)).toHaveValue(161);
    expect(screen.getByLabelText(/wickets per innings/i)).toHaveValue(10);
    expect(screen.getByLabelText(/last man stands/i)).not.toBeChecked();
    expect(screen.getByLabelText(/golden ball/i)).not.toBeChecked();
  });

  it("allows changing overs per innings mid-game (e.g. rain-shortened match)", () => {
    const onSave = vi.fn();
    render(
      <MatchSettingsDialog
        open={true}
        onOpenChange={vi.fn()}
        match={dummyMatch}
        onSave={onSave}
        isProcessing={false}
      />,
    );

    // Click 15 Overs quick preset button
    const preset15 = screen.getByRole("button", { name: "15" });
    fireEvent.click(preset15);
    expect(screen.getByLabelText(/overs per innings/i)).toHaveValue(15);

    // Save changes
    const saveButton = screen.getByRole("button", { name: /save changes/i });
    fireEvent.click(saveButton);

    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        oversPerInnings: 15,
      }),
    );
  });

  it("allows revising target runs and toggling special rules mid-game", () => {
    const onSave = vi.fn();
    render(
      <MatchSettingsDialog
        open={true}
        onOpenChange={vi.fn()}
        match={dummyMatch}
        onSave={onSave}
        isProcessing={false}
      />,
    );

    // Change target runs to 135 (e.g. DLS target)
    const targetInput = screen.getByLabelText(/target runs/i);
    fireEvent.change(targetInput, { target: { value: "135" } });

    // Toggle Last Man Stands
    const lmsCheckbox = screen.getByLabelText(/last man stands/i);
    fireEvent.click(lmsCheckbox);

    // Toggle Golden Ball
    const gbCheckbox = screen.getByLabelText(/golden ball/i);
    fireEvent.click(gbCheckbox);

    const saveButton = screen.getByRole("button", { name: /save changes/i });
    fireEvent.click(saveButton);

    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        targetRuns: 135,
        lastManStands: true,
        goldenBall: true,
      }),
    );
  });
});
