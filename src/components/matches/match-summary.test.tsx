import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { Match } from "~/lib/match-types";

const liveState = vi.hoisted(() => ({
  current: null as Record<string, unknown> | null,
}));
vi.mock("~/lib/hooks/useLiveState", () => ({
  useLiveState: () => ({ state: liveState.current, version: 1, loaded: true }),
}));

import { MatchSummary } from "./match-summary";

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

    expect(screen.getByText("Key moments")).toBeDefined();
    expect(
      screen.getByText(/the toss, wickets and milestones appear here/i),
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
      screen.getByText(/Mumbai Stars won the toss and chose to bat/i),
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

    const moments = within(
      screen.getByRole("region", { name: "Key moments" }),
    );
    // Batter milestone (72 runs)
    expect(moments.getByText("Rohit Sharma 72 (45)")).toBeDefined();
    expect(moments.getByText("Fifty")).toBeDefined();
    // Bowler feat (3 wickets)
    expect(moments.getByText("Rashid Khan 3/22")).toBeDefined();
    // Fall of wicket
    expect(moments.getByText("Ishan Kishan b Rashid Khan")).toBeDefined();
    expect(moments.getByText("42/1 · Bowled")).toBeDefined();
  });

  it("shows both sides like the summary image, then the best performers", () => {
    const completedMatch: Match = {
      ...baseMatch,
      status: "completed",
      winning_team_id: "team-a",
      result_description: "Mumbai Stars won by 15 runs",
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
              is_out: false,
              user: { id: "u-1", full_name: "Rohit Sharma" },
            },
          ],
        },
      ],
    };

    render(<MatchSummary match={completedMatch} />);

    // Each side as on the share-summary image: score, top batters / bowlers.
    expect(screen.getByText("165/4")).toBeDefined();
    expect(screen.getByText("20.0 ov")).toBeDefined();
    expect(screen.getByText("Won")).toBeDefined();
    expect(screen.getAllByText("Top batters").length).toBeGreaterThan(0);
    expect(screen.getAllByText("72*").length).toBeGreaterThan(0);
    // The result and the player of the match are in the hero, not here.
    expect(screen.queryByText(/won by 15 runs/i)).toBeNull();
  });

  it("shows the crease, the bowler and this over while an innings is in play", () => {
    liveState.current = {
      innings_number: 1,
      this_over_balls: "1 0 4 W",
      partnership_runs: 12,
      partnership_balls: 9,
    };
    const live: Match = {
      ...baseMatch,
      status: "live",
      innings: [
        {
          id: "inn-1",
          match_id: "match-123",
          innings_number: 1,
          team_id: "team-a",
          total_runs: 54,
          total_wickets: 2,
          total_balls: 40,
          total_overs: 6.4,
          is_completed: false,
          extras_total: 3,
          extras_byes: 0,
          extras_leg_byes: 0,
          extras_wides: 3,
          extras_no_balls: 0,
          extras_penalties: 0,
          batting_performances: [
            {
              id: "bp-1",
              match_id: "match-123",
              innings_id: "inn-1",
              user_id: "u-1",
              batting_position: 1,
              runs_scored: 30,
              balls_faced: 20,
              fours: 4,
              sixes: 1,
              is_out: false,
              is_current_batsman: true,
              is_striker: true,
              user: { id: "u-1", full_name: "Rohit Sharma" },
            },
            {
              id: "bp-2",
              match_id: "match-123",
              innings_id: "inn-1",
              user_id: "u-4",
              batting_position: 4,
              runs_scored: 5,
              balls_faced: 6,
              fours: 0,
              sixes: 0,
              is_out: false,
              is_current_batsman: true,
              is_striker: false,
              user: { id: "u-4", full_name: "Suryakumar Yadav" },
            },
          ],
          bowling_performances: [
            {
              id: "bowl-1",
              match_id: "match-123",
              innings_id: "inn-1",
              user_id: "u-2",
              overs_bowled: 1.4,
              balls_bowled: 10,
              runs_conceded: 14,
              wickets_taken: 1,
              maidens: 0,
              wides: 0,
              no_balls: 0,
              is_current_bowler: true,
              user: { id: "u-2", full_name: "Rashid Khan" },
            },
          ],
        },
      ],
    };

    render(<MatchSummary match={live} />);

    expect(screen.getByText("Rohit Sharma")).toBeDefined();
    expect(screen.getByText("(on strike)")).toBeDefined();
    expect(screen.getByText("Suryakumar Yadav")).toBeDefined();
    expect(screen.getByText("Rashid Khan")).toBeDefined();
    expect(screen.getByText("This over")).toBeDefined();
    expect(
      within(screen.getByRole("list")).getAllByRole("listitem"),
    ).toHaveLength(4);
    expect(screen.getByText("Partnership")).toBeDefined();
    expect(screen.getByText("Projected")).toBeDefined();
    liveState.current = null;
  });
});
