import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { LiveMatchHUD } from "./live-match-hud";
import type { Match, Innings } from "~/lib/match-types";

describe("LiveMatchHUD Component", () => {
  const mockMatchChasing: Match = {
    id: "m-1",
    title: "Championship Final",
    match_format: "T20",
    overs_per_innings: 20,
    status: "live",
    current_innings: 2,
    current_over: 16,
    current_ball: 2,
    team1_id: "team-1",
    team2_id: "team-2",
    team1: { id: "team-1", name: "Team 1" },
    team2: { id: "team-2", name: "Team 2" },
    innings: [
      {
        id: "inn-1",
        match_id: "m-1",
        innings_number: 1,
        team_id: "team-1",
        total_runs: 167,
        total_wickets: 7,
        total_balls: 120,
        total_overs: 20,
        is_completed: true,
        extras_total: 8,
        extras_byes: 0,
        extras_leg_byes: 2,
        extras_wides: 5,
        extras_no_balls: 1,
        extras_penalties: 0,
      },
    ],
  };

  const mockCurrentInningsChasing: Innings = {
    id: "inn-2",
    match_id: "m-1",
    innings_number: 2,
    team_id: "team-2",
    total_runs: 134,
    total_wickets: 3,
    total_balls: 98, // 16.2 overs
    total_overs: 16.2,
    is_completed: false,
    target_runs: 168,
    extras_total: 6,
    extras_byes: 0,
    extras_leg_byes: 1,
    extras_wides: 4,
    extras_no_balls: 1,
    extras_penalties: 0,
  };

  const mockStriker = {
    id: "p-1",
    name: "Virat Kohli",
    runs: 64,
    balls: 42,
    fours: 6,
    sixes: 2,
    isStriker: true,
  };

  const mockNonStriker = {
    id: "p-2",
    name: "Hardik Pandya",
    runs: 28,
    balls: 14,
    fours: 2,
    sixes: 2,
    isStriker: false,
  };

  const mockBowler = {
    id: "p-3",
    name: "Pat Cummins",
    overs: 3.2,
    maidens: 0,
    runs: 26,
    wickets: 2,
  };

  it("accurately calculates and displays the chase equation in the 2nd innings", () => {
    render(
      <LiveMatchHUD
        match={mockMatchChasing}
        currentInnings={mockCurrentInningsChasing}
        striker={mockStriker}
        nonStriker={mockNonStriker}
        bowler={mockBowler}
        lastBalls={["1", "4"]}
      />,
    );

    // Target = 168, current = 134 -> Need 34 runs from 22 balls (120 total - 98 bowled = 22 remaining)
    expect(screen.getByTestId("chase-equation-title")).toHaveTextContent(/Need 34 runs from 22 balls/i);
    expect(screen.getByText(/Target:/i)).toBeInTheDocument();
    expect(screen.getAllByText("168").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/wickets in hand/i)).toBeInTheDocument();
  });

  it("renders active striker and non-striker with swap button", () => {
    const onSwapStriker = vi.fn();

    render(
      <LiveMatchHUD
        match={mockMatchChasing}
        currentInnings={mockCurrentInningsChasing}
        striker={mockStriker}
        nonStriker={mockNonStriker}
        bowler={mockBowler}
        lastBalls={["1", "4"]}
        onSwapStriker={onSwapStriker}
      />,
    );

    expect(screen.getByText(/Virat Kohli \*/i)).toBeInTheDocument();
    expect(screen.getByText(/Hardik Pandya/i)).toBeInTheDocument();

    const swapBtn = screen.getByRole("button", { name: /swap active striker/i });
    fireEvent.click(swapBtn);
    expect(onSwapStriker).toHaveBeenCalledTimes(1);
  });

  it("renders bowler figures and max overs quota", () => {
    render(
      <LiveMatchHUD
        match={mockMatchChasing}
        currentInnings={mockCurrentInningsChasing}
        striker={mockStriker}
        nonStriker={mockNonStriker}
        bowler={mockBowler}
        lastBalls={["1", "4"]}
      />,
    );

    expect(screen.getByText(/Pat Cummins/i)).toBeInTheDocument();
    // 2/26 wickets/runs
    expect(screen.getByText("2/26")).toBeInTheDocument();
    // Max 4 overs in T20 (20 / 5)
    expect(screen.getByText(/\/ 4/i)).toBeInTheDocument();
  });

  it("renders 1st innings situation with projected score when in 1st innings", () => {
    const mockMatch1stInns: Match = {
      ...mockMatchChasing,
      current_innings: 1,
    };

    const mockInnings1: Innings = {
      ...mockCurrentInningsChasing,
      innings_number: 1,
      target_runs: null,
      total_runs: 80,
      total_balls: 60, // 10 overs, CRR = 8.00, Projected = 160
    };

    render(
      <LiveMatchHUD
        match={mockMatch1stInns}
        currentInnings={mockInnings1}
        striker={mockStriker}
        nonStriker={mockNonStriker}
        bowler={mockBowler}
        lastBalls={["1", "0", "4"]}
      />,
    );

    expect(screen.getByText(/1st Innings/i)).toBeInTheDocument();
    expect(screen.getByText(/CRR: 8.00/i)).toBeInTheDocument();
    expect(screen.getByText(/Proj: 160/i)).toBeInTheDocument();
  });
});
