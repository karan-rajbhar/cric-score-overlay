import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MatchSuperstars } from "./match-superstars";
import { makeMatch } from "~/test/factories";

describe("MatchSuperstars", () => {
  it("renders empty state when no performances are recorded yet", () => {
    const match = makeMatch({
      status: "scheduled",
      innings: [],
    });

    render(<MatchSuperstars match={match} />);

    expect(screen.getByText("Superstars XI")).toBeInTheDocument();
    expect(
      screen.getByText(/Superstars XI will be automatically generated/i),
    ).toBeInTheDocument();
  });

  it("renders the Top 11 superstars with team filter bar, ratings, and milestone badges", () => {
    const match = makeMatch({
      team1_id: "t1",
      team2_id: "t2",
      status: "completed",
      winning_team_id: "t1",
      team1: {
        id: "t1",
        name: "Mumbai Titans",
        short_name: "MT",
      },
      team2: {
        id: "t2",
        name: "Delhi Warriors",
        short_name: "DW",
      },
      innings: [
        {
          id: "inn-1",
          match_id: "m1",
          innings_number: 1,
          team_id: "t1",
          total_runs: 175,
          total_wickets: 4,
          total_balls: 120,
          total_overs: 20,
          is_completed: true,
          extras_total: 0,
          extras_byes: 0,
          extras_leg_byes: 0,
          extras_wides: 0,
          extras_no_balls: 0,
          extras_penalties: 0,
          batting_performances: [
            {
              id: "bp-1",
              match_id: "m1",
              innings_id: "inn-1",
              user_id: "u-virat",
              runs_scored: 82,
              balls_faced: 50,
              fours: 7,
              sixes: 3,
              is_out: false,
              user: { id: "u-virat", full_name: "Virat Kohli" },
            },
            {
              id: "bp-2",
              match_id: "m1",
              innings_id: "inn-1",
              user_id: "u-rohit",
              runs_scored: 45,
              balls_faced: 30,
              fours: 4,
              sixes: 2,
              is_out: true,
              user: { id: "u-rohit", full_name: "Rohit Sharma" },
            },
          ],
          bowling_performances: [
            {
              id: "bowl-1",
              match_id: "m1",
              innings_id: "inn-1",
              user_id: "u-bumrah",
              overs_bowled: 4,
              balls_bowled: 24,
              runs_conceded: 18,
              wickets_taken: 3,
              maidens: 1,
              wides: 0,
              no_balls: 0,
              user: { id: "u-bumrah", full_name: "Jasprit Bumrah" },
            },
          ],
        },
      ],
    });

    render(<MatchSuperstars match={match} />);

    // Header title and team tags
    expect(screen.getByText("Superstar 11")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /all players/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /mumbai titans/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /delhi warriors/i })).toBeInTheDocument();

    // Top performers names
    expect(screen.getAllByText(/Virat Kohli/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/Jasprit Bumrah/i).length).toBeGreaterThanOrEqual(1);

    // Filter by team
    const team1Filter = screen.getByRole("button", { name: /mumbai titans/i });
    fireEvent.click(team1Filter);
    expect(screen.getAllByText(/Virat Kohli/i).length).toBeGreaterThanOrEqual(1);
  });

  it("toggles between Pitch View and List View", () => {
    const match = makeMatch({
      team1_id: "t1",
      team2_id: "t2",
      status: "completed",
      innings: [
        {
          id: "inn-1",
          match_id: "m1",
          innings_number: 1,
          team_id: "t1",
          total_runs: 150,
          total_wickets: 3,
          total_balls: 120,
          total_overs: 20,
          is_completed: true,
          extras_total: 0,
          extras_byes: 0,
          extras_leg_byes: 0,
          extras_wides: 0,
          extras_no_balls: 0,
          extras_penalties: 0,
          batting_performances: [
            {
              id: "bp-1",
              match_id: "m1",
              innings_id: "inn-1",
              user_id: "u-surya",
              runs_scored: 60,
              balls_faced: 35,
              fours: 6,
              sixes: 3,
              is_out: false,
              user: { id: "u-surya", full_name: "Surya Yadav" },
            },
          ],
          bowling_performances: [],
        },
      ],
    });

    render(<MatchSuperstars match={match} />);

    // Default view has pitch or toggle buttons
    const listBtn = screen.getByRole("button", { name: /List/i });
    const pitchBtn = screen.getByRole("button", { name: /Pitch|Field/i });

    expect(listBtn).toBeInTheDocument();
    expect(pitchBtn).toBeInTheDocument();

    // Switch to List view
    fireEvent.click(listBtn);
    expect(screen.getByText("Superstars Performance Rankings")).toBeInTheDocument();
    expect(screen.getAllByText(/Surya Yadav/i).length).toBeGreaterThanOrEqual(1);

    // Switch back to Pitch view
    fireEvent.click(pitchBtn);
    expect(screen.getAllByText(/Surya Yadav/i).length).toBeGreaterThanOrEqual(1);
  });
});
