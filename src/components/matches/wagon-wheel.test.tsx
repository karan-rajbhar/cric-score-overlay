import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { WagonWheel } from "./wagon-wheel";
import type { Match, BallEvent } from "~/lib/match-types";

// Mock useMatchBallLogQuery to avoid real Supabase network calls in tests
vi.mock("~/lib/hooks/useMatchQueries", () => ({
  useMatchBallLogQuery: () => ({
    data: [],
    isLoading: false,
    error: null,
  }),
}));

describe("WagonWheel Component (Stumps App Design)", () => {
  const mockBatter1 = {
    id: "user-1",
    full_name: "Virat Kohli",
  };
  const mockBatter2 = {
    id: "user-2",
    full_name: "Rohit Sharma",
  };

  const sampleBalls: BallEvent[] = [
    // Off-side shots:
    // Cover (4 runs)
    {
      id: "b-1",
      match_id: "m-1",
      innings_id: "inn-1",
      over_number: 0,
      ball_number: 1,
      batsman_id: "user-1",
      runs_scored: 4,
      extras: 0,
      is_wicket: false,
      shot_zone: "cover",
    },
    // Point (2 runs)
    {
      id: "b-2",
      match_id: "m-1",
      innings_id: "inn-1",
      over_number: 0,
      ball_number: 2,
      batsman_id: "user-1",
      runs_scored: 2,
      extras: 0,
      is_wicket: false,
      shot_zone: "point",
    },
    // Third Man (1 run)
    {
      id: "b-3",
      match_id: "m-1",
      innings_id: "inn-1",
      over_number: 0,
      ball_number: 3,
      batsman_id: "user-1",
      runs_scored: 1,
      extras: 0,
      is_wicket: false,
      shot_zone: "third_man",
    },
    // Long Off (6 runs)
    {
      id: "b-4",
      match_id: "m-1",
      innings_id: "inn-1",
      over_number: 0,
      ball_number: 4,
      batsman_id: "user-2",
      runs_scored: 6,
      extras: 0,
      is_wicket: false,
      shot_zone: "long_off",
    },

    // Leg-side shots:
    // Mid Wicket (6 runs)
    {
      id: "b-5",
      match_id: "m-1",
      innings_id: "inn-1",
      over_number: 0,
      ball_number: 5,
      batsman_id: "user-1",
      runs_scored: 6,
      extras: 0,
      is_wicket: false,
      shot_zone: "mid_wicket",
    },
    // Square Leg (4 runs)
    {
      id: "b-6",
      match_id: "m-1",
      innings_id: "inn-1",
      over_number: 0,
      ball_number: 6,
      batsman_id: "user-2",
      runs_scored: 4,
      extras: 0,
      is_wicket: false,
      shot_zone: "square_leg",
    },
    // Fine Leg (1 run)
    {
      id: "b-7",
      match_id: "m-1",
      innings_id: "inn-1",
      over_number: 1,
      ball_number: 1,
      batsman_id: "user-1",
      runs_scored: 1,
      extras: 0,
      is_wicket: false,
      shot_zone: "fine_leg",
    },
    // Long On (3 runs)
    {
      id: "b-8",
      match_id: "m-1",
      innings_id: "inn-1",
      over_number: 1,
      ball_number: 2,
      batsman_id: "user-1",
      runs_scored: 3,
      extras: 0,
      is_wicket: false,
      shot_zone: "long_on",
    },
  ];

  // Off-side total = 4 (cover) + 2 (point) + 1 (third_man) + 6 (long_off) = 13
  // Leg-side total = 6 (mid_wicket) + 4 (square_leg) + 1 (fine_leg) + 3 (long_on) = 14
  // Total runs = 27 across 8 balls. SR = (27 / 8) * 100 = 337.5
  // Run counts: 1s: 2, 2s: 1, 3s: 1, 4s: 2, 6s: 2

  const dummyMatch: Match = {
    id: "m-1",
    title: "India vs Australia",
    match_format: "t20",
    tournament_id: "t-1",
    team1_id: "team-ind",
    team2_id: "team-aus",
    status: "live",
    current_innings: 1,
    current_over: 2,
    current_ball: 2,
    overs_per_innings: 20,
    team1: { id: "team-ind", name: "India", short_name: "IND" },
    team2: { id: "team-aus", name: "Australia", short_name: "AUS" },
    innings: [
      {
        id: "inn-1",
        match_id: "m-1",
        innings_number: 1,
        team_id: "team-ind",
        total_runs: 27,
        total_wickets: 0,
        total_balls: 8,
        total_overs: 1.2,
        is_completed: false,
        extras_total: 0,
        extras_byes: 0,
        extras_leg_byes: 0,
        extras_wides: 0,
        extras_no_balls: 0,
        extras_penalties: 0,
        batting_performances: [
          {
            id: "bp-1",
            match_id: "m-1",
            innings_id: "inn-1",
            user_id: "user-1",
            runs_scored: 17,
            balls_faced: 6,
            fours: 1,
            sixes: 1,
            is_out: false,
            user: mockBatter1,
          },
          {
            id: "bp-2",
            match_id: "m-1",
            innings_id: "inn-1",
            user_id: "user-2",
            runs_scored: 10,
            balls_faced: 2,
            fours: 1,
            sixes: 1,
            is_out: false,
            user: mockBatter2,
          },
        ],
        ball_by_ball: sampleBalls,
      },
    ],
  };

  it("renders the Wagon Wheel header and circular SVG map", () => {
    render(<WagonWheel match={dummyMatch} />);

    expect(screen.getByText("Wagon Wheel")).toBeInTheDocument();
    expect(
      screen.getByText(/visual shot direction analysis/i),
    ).toBeInTheDocument();

    const svg = screen.getByRole("img", {
      name: /cricket wagon wheel shot distribution map/i,
    });
    expect(svg).toBeInTheDocument();
  });

  it("displays accurate Metrics Bar figures for Runs, Balls, SR, Off-S, and Leg-S", () => {
    render(<WagonWheel match={dummyMatch} />);

    // Off-side runs = 13, Leg-side runs = 14, Total runs = 27
    expect(screen.getByText("Runs")).toBeInTheDocument();
    expect(screen.getByText("Balls")).toBeInTheDocument();
    expect(screen.getByText("SR")).toBeInTheDocument();
    expect(screen.getByText("Off-S")).toBeInTheDocument();
    expect(screen.getByText("Leg-S")).toBeInTheDocument();

    expect(screen.getByText("27")).toBeInTheDocument(); // Runs
    expect(screen.getByText("8")).toBeInTheDocument(); // Balls
    expect(screen.getByText("337.5")).toBeInTheDocument(); // SR
    expect(screen.getByText("13")).toBeInTheDocument(); // Off-S
    expect(screen.getByText("14")).toBeInTheDocument(); // Leg-S
  });

  it("displays delivery counts in the run breakdown pill (1s, 2s, 3s, 4s, 6s)", () => {
    render(<WagonWheel match={dummyMatch} />);

    expect(screen.getByRole("button", { name: /filter 1s/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /filter 2s/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /filter 3s/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /filter 4s/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /filter 6s/i })).toBeInTheDocument();
  });

  it("toggles run filter when a run pill is clicked", () => {
    render(<WagonWheel match={dummyMatch} />);

    const sixPill = screen.getByRole("button", { name: /filter 6s/i });
    expect(sixPill).toHaveAttribute("aria-pressed", "false");

    // Click to filter by 6s
    fireEvent.click(sixPill);
    expect(sixPill).toHaveAttribute("aria-pressed", "true");

    // Metrics update to reflect 6s: 2 sixes = 12 runs, 2 balls, SR = 600.0, Off-S = 6, Leg-S = 6
    expect(screen.getByText("12")).toBeInTheDocument(); // Filtered runs
    expect(screen.getByText("600.0")).toBeInTheDocument(); // Filtered SR

    // Click again to deselect filter
    fireEvent.click(sixPill);
    expect(sixPill).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByText("27")).toBeInTheDocument(); // Back to all runs
  });

  it("renders expandable detailed zone breakdown", () => {
    render(<WagonWheel match={dummyMatch} />);

    const toggleBtn = screen.getByRole("button", {
      name: /detailed scoring zones breakdown/i,
    });
    expect(toggleBtn).toBeInTheDocument();

    // Click to expand
    fireEvent.click(toggleBtn);
    expect(screen.getByText("Cover")).toBeInTheDocument();
    expect(screen.getByText("Mid Wicket")).toBeInTheDocument();
    expect(screen.getByText("Square Leg")).toBeInTheDocument();
  });
});
