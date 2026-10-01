import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MatchScorecard } from "./match-scorecard";
import { makeMatch } from "~/test/factories";
import type { Innings } from "~/lib/match-types";

describe("MatchScorecard", () => {
  it("renders empty state when there are no innings", () => {
    const match = makeMatch({ innings: [] });
    render(<MatchScorecard match={match} />);

    expect(screen.getByText(/no innings data available yet/i)).toBeInTheDocument();
  });

  it("renders innings details, batting table, bowling table, and extras", () => {
    const innings1: Innings = {
      id: "inn-1",
      match_id: "m1",
      innings_number: 1,
      team_id: "t1",
      total_runs: 165,
      total_wickets: 4,
      total_overs: 20,
      total_balls: 120,
      is_completed: true,
      target_runs: null,
      extras_total: 10,
      extras_byes: 2,
      extras_leg_byes: 1,
      extras_wides: 5,
      extras_no_balls: 2,
      extras_penalties: 0,
      batting_performances: [
        {
          id: "bp-1",
          match_id: "m1",
          innings_id: "inn-1",
          user_id: "p1",
          batting_position: 1,
          runs_scored: 54,
          balls_faced: 38,
          fours: 6,
          sixes: 2,
          is_out: false,
          user: { id: "p1", full_name: "Virat Kohli" },
        },
        {
          id: "bp-2",
          match_id: "m1",
          innings_id: "inn-1",
          user_id: "p2",
          batting_position: 2,
          runs_scored: 30,
          balls_faced: 22,
          fours: 3,
          sixes: 1,
          is_out: true,
          dismissal_type: "bowled",
          user: { id: "p2", full_name: "Rohit Sharma" },
        },
      ],
      bowling_performances: [
        {
          id: "bowl-1",
          match_id: "m1",
          innings_id: "inn-1",
          user_id: "bp-bowler",
          overs_bowled: 4,
          balls_bowled: 24,
          maidens: 1,
          runs_conceded: 24,
          wickets_taken: 2,
          wides: 0,
          no_balls: 0,
          user: { id: "bp-bowler", full_name: "Jasprit Bumrah" },
        },
      ],
      fall_of_wickets: [
        {
          id: "fow-1",
          match_id: "m1",
          innings_id: "inn-1",
          wicket_number: 1,
          runs_at_fall: 45,
          overs_at_fall: 5.2,
          batsman_out_id: "p2",
          bowler: { id: "bp-bowler", full_name: "Jasprit Bumrah" },
          batsman: { id: "p2", full_name: "Rohit Sharma" },
        },
      ],
    };

    const match = makeMatch({
      innings: [innings1],
    });

    render(<MatchScorecard match={match} />);

    // Innings tab header and title
    expect(screen.getAllByText(/Royal Tigers/i)[0]).toBeInTheDocument();
    expect(screen.getAllByText("165/4")[0]).toBeInTheDocument();

    // Batters
    expect(screen.getByText("Virat Kohli")).toBeInTheDocument();
    expect(screen.getByText("not out")).toBeInTheDocument();
    expect(screen.getByText("Rohit Sharma")).toBeInTheDocument();
    expect(screen.getByText("b Jasprit Bumrah")).toBeInTheDocument();

    // Bowlers
    expect(screen.getByText("Jasprit Bumrah")).toBeInTheDocument();

    // Fall of wickets
    expect(screen.getByText(/fall of wickets/i)).toBeInTheDocument();
    expect(screen.getByText(/45\/1/)).toBeInTheDocument();

    // Extras
    expect(screen.getByText("10")).toBeInTheDocument();
  });
});
