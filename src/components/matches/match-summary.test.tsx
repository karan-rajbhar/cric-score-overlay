import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { Match } from "~/lib/match-types";
import { makeInnings, makeMatch } from "~/test/factories";

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
    expect(screen.getByText("Projected score")).toBeDefined();
    liveState.current = null;
  });

  it("says a finished match with no moments has none, not that they are coming", () => {
    render(
      <MatchSummary
        match={{
          ...baseMatch,
          status: "abandoned",
          result_description: "Match abandoned: Rain",
        }}
      />,
    );
    expect(
      screen.getByText(/no toss, wickets or milestones were recorded/i),
    ).toBeDefined();
  });
});

describe("MatchLivePanel between and before innings", () => {
  const first = makeInnings({
    total_runs: 150,
    total_balls: 120,
    total_overs: 20,
    is_completed: true,
  });
  const chase = makeInnings({
    id: "inn-2",
    team_id: "t2",
    innings_number: 2,
    target_runs: 151,
  });

  it("calls the wait before the chase an innings break, with the target", () => {
    render(<MatchSummary match={makeMatch({ innings: [first, chase] })} />);
    expect(screen.getByText("Innings break.")).toBeDefined();
    expect(
      screen.getByText(/Coastal Kings\s+need 151 runs to win/),
    ).toBeDefined();
    // No run rate of 0.00 before a ball is bowled.
    expect(screen.queryByText("Run rate")).toBeNull();
    expect(screen.getByText("Target")).toBeDefined();
  });

  it("says who bats first before the first ball", () => {
    render(<MatchSummary match={makeMatch({ innings: [makeInnings()] })} />);
    expect(screen.getByText("Yet to start.")).toBeDefined();
    expect(screen.getByText(/Royal Tigers\s+bat first/)).toBeDefined();
  });

  it("counts a DLS chase over its revised overs and says so", () => {
    const revised = { ...chase, target_runs: 98, total_runs: 40, total_balls: 36 };
    render(
      <MatchSummary
        match={makeMatch({
          innings: [first, revised],
          dls_revision: { innings_number: 2, target_runs: 98, overs: 12 },
        })}
      />,
    );
    // 58 needed from 36 balls (12 overs, 6 bowled): 9.67 an over.
    expect(screen.getByText("9.67")).toBeDefined();
    expect(
      screen.getByText("Target revised by the DLS method: 98 runs in 12 overs."),
    ).toBeDefined();
  });

  it("shows phones the first key moments, then all of them on request", () => {
    const wickets = Array.from({ length: 7 }, (_, i) => ({
      id: `w${i}`,
      wicket_number: i + 1,
      runs_at_fall: 10 * (i + 1),
      overs_at_fall: i + 1,
      batsman_id: `u${i}`,
      batsman: { id: `u${i}`, full_name: `Batter ${i}` },
      dismissal_type: "bowled",
    }));
    render(
      <MatchSummary
        match={makeMatch({
          status: "completed",
          innings: [
            makeInnings({ is_completed: true, fall_of_wickets: wickets as never }),
          ],
        })}
      />,
    );
    const moments = within(screen.getByRole("region", { name: "Key moments" }));
    const show = moments.getByRole("button", { name: /Show all \d+ moments/ });
    const rows = () => moments.getAllByText(/^Batter \d$/);
    const hidden = () =>
      rows().filter((r) => r.closest(".max-md\\:hidden")).length;
    expect(rows()).toHaveLength(7);
    expect(hidden()).toBeGreaterThan(0);
    fireEvent.click(show);
    expect(hidden()).toBe(0);
    expect(moments.queryByRole("button", { name: /Show all/ })).toBeNull();
  });
});
