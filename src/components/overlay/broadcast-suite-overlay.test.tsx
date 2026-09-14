import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import {
  BroadcastSuiteOverlay,
  BROADCAST_VIEW_OPTIONS,
} from "./broadcast-suite-overlay";
import type { LiveMatchState } from "./types";

const mockState: LiveMatchState = {
  match_id: "test-match-123",
  title: "IPL Final 2026",
  status: "live",
  match_format: "T20",
  overs_per_innings: 20,
  venue: "Wankhede Stadium, Mumbai",
  current_innings: 1,
  current_over: 16,
  current_ball: 2,
  result_type: null,
  result_description: null,
  tournament_name: "Indian Premier League",
  team1_name: "Mumbai Indians",
  team1_short_name: "MI",
  team2_name: "Chennai Super Kings",
  team2_short_name: "CSK",
  winning_team_name: null,
  innings_number: 1,
  total_runs: 168,
  total_wickets: 3,
  total_overs: 16,
  total_balls: 98,
  extras_total: 10,
  innings_completed: false,
  target_runs: null,
  batting_team_name: "Mumbai Indians",
  batting_team_short_name: "MI",
  bowling_team_name: "Chennai Super Kings",
  bowling_team_short_name: "CSK",
  striker_name: "Rohit Sharma",
  striker_runs: 74,
  striker_balls: 42,
  non_striker_name: "Suryakumar Yadav",
  non_striker_runs: 48,
  non_striker_balls: 26,
  current_bowler_name: "Jasprit Bumrah",
  bowler_balls: 18,
  bowler_runs: 22,
  bowler_wickets: 2,
  partnership_runs: 65,
  partnership_balls: 34,
  this_over_balls: "1 4 6 W 0 1",
  current_run_rate: 10.28,
  runs_needed: null,
  balls_remaining: null,
  required_run_rate: null,
};

describe("BroadcastSuiteOverlay", () => {
  it("renders the primary ScoreBar (view 1) with runs, wickets, batsmen, and bowler", () => {
    render(<BroadcastSuiteOverlay state={mockState} activeView="1" />);

    expect(screen.getByText(/Rohit Sharma/i)).toBeDefined();
    expect(screen.getByText(/Suryakumar Yadav/i)).toBeDefined();
    expect(screen.getByText(/Jasprit Bumrah/i)).toBeDefined();
    expect(screen.getByText("168")).toBeDefined();
    expect(screen.getByText("3")).toBeDefined();
    expect(screen.getByText("MI")).toBeDefined();
    expect(screen.getByText("CSK")).toBeDefined();
  });

  it("renders the 29-button switcher dock when showControls is true", () => {
    const handleSelectView = vi.fn();
    render(
      <BroadcastSuiteOverlay
        state={mockState}
        activeView="1"
        showControls={true}
        onSelectView={handleSelectView}
      />,
    );

    const battingBtn = screen.getByRole("button", {
      name: "Batting Team 1(I1)",
    });
    expect(battingBtn).toBeDefined();

    fireEvent.click(battingBtn);
    expect(handleSelectView).toHaveBeenCalledWith("2");
  });

  it("renders Batting Team 1 card (view 2) and allows closing back to Scorebar", () => {
    const handleClose = vi.fn();
    render(
      <BroadcastSuiteOverlay
        state={mockState}
        activeView="2"
        onCloseCard={handleClose}
      />,
    );

    expect(screen.getByText(/Mumbai Indians · BATTING CARD/i)).toBeDefined();
    const closeBtn = screen.getByRole("button", { name: "Close Card" });
    fireEvent.click(closeBtn);
    expect(handleClose).toHaveBeenCalled();
  });

  it("renders Bowling Team 1 card (view 3)", () => {
    render(<BroadcastSuiteOverlay state={mockState} activeView="3" />);
    expect(
      screen.getByText(/Chennai Super Kings · BOWLING CARD/i),
    ).toBeDefined();
  });

  it("renders Match Intro splash banner (view 13)", () => {
    render(<BroadcastSuiteOverlay state={mockState} activeView="13" />);
    expect(screen.getByText("Indian Premier League")).toBeDefined();
    expect(screen.getByText("WE WILL BE STARTING SOON")).toBeDefined();
    expect(screen.getByText("VS")).toBeDefined();
  });

  it("renders Partnership breakdown card (view 23)", () => {
    render(<BroadcastSuiteOverlay state={mockState} activeView="23" />);
    expect(screen.getByText("CURRENT PARTNERSHIP")).toBeDefined();
  });

  it("has all 29 valid view configurations defined in BROADCAST_VIEW_OPTIONS", () => {
    expect(BROADCAST_VIEW_OPTIONS.length).toBe(29);
    expect(BROADCAST_VIEW_OPTIONS.map((o) => o.id)).toContain("1");
    expect(BROADCAST_VIEW_OPTIONS.map((o) => o.id)).toContain("2");
    expect(BROADCAST_VIEW_OPTIONS.map((o) => o.id)).toContain("29");
  });

  it("applies theme data attribute and styling when different broadcast themes are selected", () => {
    const { container, rerender } = render(
      <BroadcastSuiteOverlay state={mockState} activeView="1" theme="apex" />,
    );

    const mainWrap = container.querySelector(".mainWrap");
    expect(mainWrap?.getAttribute("data-theme")).toBe("apex");
    expect(mainWrap?.classList.contains("theme-apex")).toBe(true);

    rerender(
      <BroadcastSuiteOverlay state={mockState} activeView="1" theme="volt" />,
    );
    expect(mainWrap?.getAttribute("data-theme")).toBe("volt");
    expect(mainWrap?.classList.contains("theme-volt")).toBe(true);

    rerender(
      <BroadcastSuiteOverlay
        state={mockState}
        activeView="1"
        theme="sonysports"
      />,
    );
    expect(mainWrap?.getAttribute("data-theme")).toBe("sonysports");
    expect(mainWrap?.classList.contains("theme-sonysports")).toBe(true);
  });
});
