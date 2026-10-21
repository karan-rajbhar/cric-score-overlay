import { describe, it, expect } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { MatchScorecard } from "./match-scorecard";
import { makeMatch } from "~/test/factories";
import type { Innings } from "~/lib/match-types";

describe("MatchScorecard", () => {
  it("renders empty state when there are no innings", () => {
    const match = makeMatch({ innings: [] });
    render(<MatchScorecard match={match} />);

    expect(
      screen.getByText(/no innings data available yet/i),
    ).toBeInTheDocument();
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

    // The side's tab carries its score
    expect(screen.getByRole("tab")).toHaveTextContent("Royal Tigers");
    expect(screen.getByRole("tab")).toHaveTextContent("165/4 (20.0 ov)");

    // Batters
    expect(screen.getByText("Virat Kohli")).toBeInTheDocument();
    expect(screen.getByText("not out")).toBeInTheDocument();
    // (also in the fall of wickets)
    expect(screen.getAllByText("Rohit Sharma")[0]).toBeInTheDocument();
    expect(screen.getByText("b Jasprit Bumrah")).toBeInTheDocument();

    // Bowlers
    expect(screen.getByText("Jasprit Bumrah")).toBeInTheDocument();

    // Fall of wickets, as on a printed scorecard
    expect(screen.getByText(/fall of wickets/i)).toBeInTheDocument();
    expect(screen.getByText("1-45").closest("li")).toHaveTextContent(
      "1-45Rohit Sharma5.2 ov",
    );

    // Extras with their breakdown, and the total with overs and run rate
    expect(screen.getByText("(b 2, lb 1, wd 5, nb 2)")).toBeInTheDocument();
    expect(screen.getByText("10")).toBeInTheDocument();
    expect(
      screen.getByRole("rowheader", { name: "Total" }).closest("tr"),
    ).toHaveTextContent("165/4 (20.0 ov)RR 8.25");
  });

  const inningsOf = (over: Partial<Innings>): Innings => ({
    id: "inn-1",
    match_id: "m1",
    innings_number: 1,
    team_id: "t1",
    total_runs: 60,
    total_wickets: 1,
    total_overs: 6,
    total_balls: 36,
    is_completed: false,
    extras_total: 0,
    extras_byes: 0,
    extras_leg_byes: 0,
    extras_wides: 0,
    extras_no_balls: 0,
    extras_penalties: 0,
    batting_performances: [
      {
        id: "b1",
        match_id: "m1",
        innings_id: "inn-1",
        user_id: "p1",
        batting_position: 1,
        runs_scored: 30,
        balls_faced: 20,
        fours: 3,
        sixes: 1,
        is_out: true,
        dismissal_type: "bowled",
        user: { id: "p1", full_name: "Virat Kohli" },
      },
      {
        id: "b2",
        match_id: "m1",
        innings_id: "inn-1",
        user_id: "p2",
        batting_position: 2,
        runs_scored: 20,
        balls_faced: 12,
        fours: 2,
        sixes: 0,
        is_out: false,
        user: { id: "p2", full_name: "Rohit Sharma" },
      },
      {
        id: "b3",
        match_id: "m1",
        innings_id: "inn-1",
        user_id: "p3",
        batting_position: 3,
        runs_scored: 10,
        balls_faced: 4,
        fours: 1,
        sixes: 0,
        is_out: false,
        user: { id: "p3", full_name: "Shubman Gill" },
      },
    ],
    bowling_performances: [],
    ...over,
  });

  it("lists the partnerships by wicket, with each batter's runs and balls", () => {
    const match = makeMatch({
      innings: [
        inningsOf({
          partnerships: [
            {
              batsman1_id: "p1",
              batsman2_id: "p2",
              runs: 45,
              balls: 26,
              batsman1_runs: 30,
              batsman1_balls: 20,
              batsman2_runs: 12,
              batsman2_balls: 6,
              wicket_number: 1,
              is_current: false,
            },
            // Recorded before shares were kept: names and total only.
            {
              batsman1_id: "p2",
              batsman2_id: "p3",
              runs: 15,
              balls: 10,
              wicket_number: null,
              is_current: true,
            },
          ],
        }),
      ],
    });
    render(<MatchScorecard match={match} />);
    const list = screen.getByRole("list", { name: "Partnerships" });
    const items = within(list).getAllByRole("listitem");
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveTextContent("1st wicket");
    expect(items[0]).toHaveTextContent("45 (26)");
    expect(items[0]).toHaveTextContent("Virat Kohli30(20)");
    expect(items[0]).toHaveTextContent("Rohit Sharma12(6)");
    expect(items[0]).toHaveTextContent("+ 3 extras");
    expect(items[0]).not.toHaveTextContent("Unbroken");
    expect(items[1]).toHaveTextContent("2nd wicket");
    expect(items[1]).toHaveTextContent("Rohit Sharma & Shubman Gill");
    // The stand in progress is live.
    expect(items[1]).toHaveTextContent("Live");
  });

  it("names both stands around a retirement after the same wicket", () => {
    const match = makeMatch({
      innings: [
        inningsOf({
          partnerships: [
            // Closed by a retirement with no wicket down (wicket count 0).
            {
              batsman1_id: "p1",
              batsman2_id: "p2",
              runs: 20,
              balls: 12,
              wicket_number: 0,
              is_current: false,
            },
            {
              batsman1_id: "p2",
              batsman2_id: "p3",
              runs: 9,
              balls: 7,
              wicket_number: 1,
              is_current: false,
            },
          ],
        }),
      ],
    });
    render(<MatchScorecard match={match} />);
    const items = within(
      screen.getByRole("list", { name: "Partnerships" }),
    ).getAllByRole("listitem");
    expect(items[0]).toHaveTextContent("1st wicket");
    expect(items[0]).toHaveTextContent("Retired hurt");
    expect(items[1]).toHaveTextContent("1st wicket");
    expect(items[1]).not.toHaveTextContent("Retired");
  });

  it("marks the selected side's tab and gives the innings its run rate", () => {
    const match = makeMatch({
      current_innings: 2,
      innings: [
        inningsOf({ is_completed: true }),
        inningsOf({
          id: "inn-2",
          innings_number: 2,
          team_id: "t2",
          total_runs: 30,
          total_balls: 24,
          total_overs: 4,
          target_runs: 61,
        }),
      ],
    });
    render(<MatchScorecard match={match} />);
    const tabs = screen.getAllByRole("tab");
    expect(tabs[0]).toHaveTextContent("Royal Tigers");
    expect(tabs[0]).toHaveTextContent("60/1 (6.0 ov)");
    expect(tabs[0]).toHaveAttribute("aria-selected", "false");
    expect(tabs[1]).toHaveTextContent("Coastal Kings");
    expect(tabs[1]).toHaveAttribute("aria-selected", "true");
    // Filled in the primary colour when selected.
    expect(tabs[1]!.className).toContain("data-[state=active]:bg-primary");
    // The tab carries the score; the innings repeats only its run rate.
    expect(screen.queryByText("Target 61")).not.toBeInTheDocument();
    expect(screen.getByText("RR 7.50")).toBeInTheDocument();
  });

  it("shows the batting card, then the bowling card", () => {
    const match = makeMatch({
      innings: [
        inningsOf({
          bowling_performances: [
            {
              id: "w1",
              match_id: "m1",
              innings_id: "inn-1",
              user_id: "q1",
              overs_bowled: 2,
              balls_bowled: 12,
              maidens: 0,
              runs_conceded: 20,
              wickets_taken: 1,
              wides: 0,
              no_balls: 0,
              user: { id: "q1", full_name: "Jasprit Bumrah" },
            },
          ],
        }),
      ],
    });
    render(<MatchScorecard match={match} />);
    const [batting, bowling] = screen.getAllByRole("table");
    expect(
      within(batting!).getByRole("columnheader", { name: "Batter" }),
    ).toBeInTheDocument();
    expect(
      within(bowling!).getByRole("columnheader", { name: "Bowler" }),
    ).toBeInTheDocument();
    expect(within(bowling!).getByText("Jasprit Bumrah")).toBeInTheDocument();
  });
});
