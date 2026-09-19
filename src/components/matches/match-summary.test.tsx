import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MatchSummary } from "./match-summary";
import type { Match } from "~/lib/match-types";

describe("MatchSummary - Key Moments", () => {
  const baseMatch: Match = {
    id: "match-123",
    title: "Finals 2026",
    match_format: "t20",
    overs_per_innings: 20,
    status: "scheduled",
    current_innings: 1,
    current_over: 0,
    current_ball: 0,
    team1_id: "team-a",
    team2_id: "team-b",
    team1: { id: "team-a", name: "Mumbai Stars" },
    team2: { id: "team-b", name: "Delhi Titans" },
    innings: [],
  };

  it("shows empty state when no match events or toss have occurred yet", () => {
    render(<MatchSummary match={baseMatch} />);

    expect(screen.getByText("Key Moments")).toBeDefined();
    expect(
      screen.getByText(
        /No key moments recorded yet/i,
      ),
    ).toBeDefined();
  });

  it("displays toss key moment when toss data exists", () => {
    const matchWithToss: Match = {
      ...baseMatch,
      status: "live",
      toss_winner_team_id: "team-a",
      toss_decision: "bat",
    };

    render(<MatchSummary match={matchWithToss} />);

    expect(
      screen.getByText(/Mumbai Stars won the toss and elected to bat/i),
    ).toBeDefined();
  });

  it("displays milestones and wickets in Key Moments", () => {
    const matchWithMoments: Match = {
      ...baseMatch,
      status: "live",
      innings: [
        {
          id: "inn-1",
          match_id: "match-123",
          innings_number: 1,
          team_id: "team-a",
          total_runs: 165,
          total_wickets: 4,
          total_balls: 120,
          total_overs: 20,
          is_completed: true,
          extras_total: 5,
          extras_byes: 0,
          extras_leg_byes: 0,
          extras_wides: 3,
          extras_no_balls: 2,
          extras_penalties: 0,
          batting_performances: [
            {
              id: "bp-1",
              match_id: "match-123",
              innings_id: "inn-1",
              user_id: "u-1",
              runs_scored: 72,
              balls_faced: 45,
              fours: 6,
              sixes: 3,
              is_out: true,
              user: { id: "u-1", full_name: "Rohit Sharma" },
            },
          ],
          bowling_performances: [
            {
              id: "bowl-1",
              match_id: "match-123",
              innings_id: "inn-1",
              user_id: "u-2",
              overs_bowled: 4,
              balls_bowled: 24,
              runs_conceded: 22,
              wickets_taken: 3,
              maidens: 0,
              wides: 1,
              no_balls: 0,
              user: { id: "u-2", full_name: "Rashid Khan" },
            },
          ],
          fall_of_wickets: [
            {
              id: "fow-1",
              match_id: "match-123",
              innings_id: "inn-1",
              wicket_number: 1,
              runs_at_fall: 42,
              overs_at_fall: 4.3,
              batsman_out_id: "u-3",
              dismissal_type: "bowled",
              batsman: { id: "u-3", full_name: "Ishan Kishan" },
              bowler: { id: "u-2", full_name: "Rashid Khan" },
            },
          ],
        },
      ],
    };

    render(<MatchSummary match={matchWithMoments} />);

    // Check batter milestone (72 runs)
    expect(
      screen.getByText(/Rohit Sharma scored 72 \(45b\)/i),
    ).toBeDefined();

    // Check bowler feat (3 wickets)
    expect(
      screen.getByText(/Rashid Khan took 3\/22/i),
    ).toBeDefined();

    // Check Fall of Wicket
    expect(
      screen.getByText(/Wicket 1: Ishan Kishan b Rashid Khan \(42\/1\)/i),
    ).toBeDefined();
  });

  it("displays match completion and player of the match in Key Moments", () => {
    const completedMatch: Match = {
      ...baseMatch,
      status: "completed",
      result_description: "Mumbai Stars won by 15 runs",
      player_of_the_match: { id: "u-1", full_name: "Rohit Sharma" },
    };

    render(<MatchSummary match={completedMatch} />);

    expect(screen.getAllByText(/Mumbai Stars won by 15 runs/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/Player of the Match: Rohit Sharma/i)).toBeDefined();
  });
});
