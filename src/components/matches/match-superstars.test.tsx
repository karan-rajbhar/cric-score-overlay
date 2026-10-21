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

    expect(screen.getByText("Top performers")).toBeInTheDocument();
    expect(
      screen.getByText(/appear here once runs, wickets and catches/i),
    ).toBeInTheDocument();
  });

  it("ranks the players, the leader on top, with a team filter", () => {
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

    // The team filter (short codes) and the leader
    const filter = screen.getByRole("group", { name: "Team" });
    expect(filter).toHaveTextContent("All players");
    expect(screen.getByText("Most impact")).toBeInTheDocument();

    // Top performers names
    expect(screen.getAllByText(/Virat Kohli/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/Jasprit Bumrah/i).length).toBeGreaterThanOrEqual(1);

    // Filter by team
    fireEvent.click(screen.getByRole("button", { name: "MT" }));
    expect(screen.getAllByText(/Virat Kohli/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByText(/Jasprit Bumrah/i)).not.toBeInTheDocument();
  });

  it("opens a player's points and the rules", () => {
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

    // A player opens their points, part by part.
    fireEvent.click(screen.getByRole("button", { name: /Surya Yadav/ }));
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveTextContent("Impact rating");
    expect(dialog).toHaveTextContent("60* (35) · 6 fours · 3 sixes");
    fireEvent.keyDown(dialog, { key: "Escape" });

    // The rules match the formula (no captain multipliers).
    fireEvent.click(screen.getByRole("button", { name: /how points work/i }));
    expect(screen.getByRole("dialog")).toHaveTextContent("25 points a wicket");
    expect(screen.getByRole("dialog")).not.toHaveTextContent(/2x|captain/i);
  });
});
