import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { updateDlsTarget } from "~/app/matches/mutations";

vi.mock("~/app/matches/mutations", () => ({
  updateDlsTarget: vi.fn(),
}));

import { DlsCalculatorModal } from "./dls-calculator-modal";
import type { Match } from "~/lib/match-types";

describe("DlsCalculatorModal", () => {
  const baseMatch: Match = {
    id: "m-1",
    title: "Test Match",
    match_format: "T20",
    overs_per_innings: 20,
    status: "live",
    current_innings: 1,
    current_over: 5,
    current_ball: 2,
    team1_id: "t-1",
    team2_id: "t-2",
    team1: { id: "t-1", name: "Team 1" },
    team2: { id: "t-2", name: "Team 2" },
    innings: [
      {
        id: "inn-1",
        match_id: "m-1",
        team_id: "t-1",
        innings_number: 1,
        total_runs: 45,
        total_wickets: 1,
        total_balls: 32,
        total_overs: 5.2,
        extras_total: 2,
        extras_byes: 0,
        extras_leg_byes: 0,
        extras_wides: 2,
        extras_no_balls: 0,
        extras_penalties: 0,
        is_completed: false,
      },
    ],
  };

  it("renders trigger button when match is live and limited-overs", () => {
    render(<DlsCalculatorModal match={baseMatch} canEdit={true} />);
    expect(
      screen.getByRole("button", { name: /DLS calculator/i }),
    ).toBeInTheDocument();
  });

  it("returns null and does not render trigger when match is completed", () => {
    const completedMatch: Match = {
      ...baseMatch,
      status: "completed",
    };
    const { container } = render(
      <DlsCalculatorModal match={completedMatch} canEdit={true} />,
    );
    expect(container.firstChild).toBeNull();
    expect(
      screen.queryByRole("button", { name: /DLS calculator/i }),
    ).not.toBeInTheDocument();
  });

  it("returns null and does not render trigger when match is scheduled", () => {
    const scheduledMatch: Match = {
      ...baseMatch,
      status: "scheduled",
    };
    const { container } = render(
      <DlsCalculatorModal match={scheduledMatch} canEdit={true} />,
    );
    expect(container.firstChild).toBeNull();
    expect(
      screen.queryByRole("button", { name: /DLS calculator/i }),
    ).not.toBeInTheDocument();
  });

  it("returns null and does not render trigger when match is abandoned", () => {
    const abandonedMatch: Match = {
      ...baseMatch,
      status: "abandoned",
    };
    const { container } = render(
      <DlsCalculatorModal match={abandonedMatch} canEdit={true} />,
    );
    expect(container.firstChild).toBeNull();
  });

  // 160 in 20 overs; the chase is 30/1 after 5 overs when rain stops play.
  const chase: Match = {
    ...baseMatch,
    current_innings: 2,
    innings: [
      { ...baseMatch.innings![0]!, total_runs: 160, is_completed: true },
      {
        ...baseMatch.innings![0]!,
        id: "inn-2",
        team_id: "t-2",
        innings_number: 2,
        total_runs: 30,
        total_wickets: 1,
        total_balls: 30,
        total_overs: 5,
        target_runs: 161,
      },
    ],
  };

  it("sends the revised overs with the revised target", async () => {
    vi.mocked(updateDlsTarget).mockResolvedValue({
      success: true,
      error: null,
    });
    render(<DlsCalculatorModal match={chase} canEdit={true} />);
    fireEvent.click(screen.getByRole("button", { name: /DLS calculator/i }));
    fireEvent.change(screen.getByLabelText("Second innings overs"), {
      target: { value: "12" },
    });
    // 56.6% - (44.1% at 15 overs left, 1 down - 23.1% at 7 left) = 35.6%:
    // 160 x 35.6 / 56.6 = 100.6, so 101.
    fireEvent.click(
      screen.getByRole("button", { name: "Set target: 101 runs in 12 overs" }),
    );
    await waitFor(() =>
      expect(updateDlsTarget).toHaveBeenCalledWith("m-1", "inn-2", 101, 12),
    );
  });

  it("counts the overs and wickets at the stoppage in the target", () => {
    render(<DlsCalculatorModal match={chase} canEdit={true} />);
    fireEvent.click(screen.getByRole("button", { name: /DLS calculator/i }));
    expect(screen.getByLabelText("Overs bowled")).toHaveValue(5);
    expect(screen.getByLabelText("Wickets down")).toHaveValue(1);
    fireEvent.change(screen.getByLabelText("Second innings overs"), {
      target: { value: "12" },
    });
    fireEvent.change(screen.getByLabelText("Wickets down"), {
      target: { value: "5" },
    });
    // 56.6% - (33.5% - 20.1%) = 43.2%: 160 x 43.2 / 56.6 = 122.1, so 123.
    expect(
      screen.getByRole("button", { name: "Set target: 123 runs in 12 overs" }),
    ).toBeInTheDocument();
    // Par if no more play: 160 x (56.6 - 33.5) / 56.6 = 65.3.
    expect(
      screen.getByText("Par score if play does not resume").parentElement
        ?.nextElementSibling,
    ).toHaveTextContent("65");
    // Before the chase starts: the 12 overs alone, 160 x 37.6 / 56.6 = 106.3.
    fireEvent.change(screen.getByLabelText("Overs bowled"), {
      target: { value: "0" },
    });
    expect(
      screen.getByRole("button", { name: "Set target: 107 runs in 12 overs" }),
    ).toBeInTheDocument();
  });

  it("says when the chase has been revised before", () => {
    render(
      <DlsCalculatorModal
        match={{
          ...chase,
          dls_revision: { innings_number: 2, target_runs: 130, overs: 16 },
        }}
        canEdit={true}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /DLS calculator/i }));
    expect(
      screen.getByText(/already has a revised target/),
    ).toBeInTheDocument();
  });
});
