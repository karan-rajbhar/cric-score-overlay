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

  it("sends the revised overs with the revised target", async () => {
    vi.mocked(updateDlsTarget).mockResolvedValue({
      success: true,
      error: null,
    });
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
          total_balls: 30,
          total_overs: 5,
          target_runs: 161,
        },
      ],
    };
    render(<DlsCalculatorModal match={chase} canEdit={true} />);
    fireEvent.click(screen.getByRole("button", { name: /DLS calculator/i }));
    fireEvent.change(screen.getByLabelText("Second innings overs"), {
      target: { value: "12" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: /Set target: \d+ runs in 12 overs/ }),
    );
    await waitFor(() =>
      expect(updateDlsTarget).toHaveBeenCalledWith(
        "m-1",
        "inn-2",
        expect.any(Number),
        12,
      ),
    );
  });
});
