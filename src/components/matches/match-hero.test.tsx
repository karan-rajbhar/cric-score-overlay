import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { sidesInBattingOrder } from "~/lib/cricket";
import type { Match } from "~/lib/match-types";
import { makeInnings, makeMatch } from "~/test/factories";
import { MatchHero, scoreLineSides } from "./match-hero";

const hero = (match: Match) =>
  render(<MatchHero match={match} sides={sidesInBattingOrder(match)} />);

const first = makeInnings({
  total_runs: 150,
  total_balls: 120,
  total_overs: 20,
  is_completed: true,
});

describe("MatchHero on the match page", () => {
  const finished = () =>
    makeMatch({
      status: "completed",
      result_description: "Rohan won by 15 runs",
      winning_team_id: "t1",
      match_format: "Custom",
      overs_per_innings: 8,
      title: "Rohan vs Omkar",
      player_of_the_match: { id: "p", full_name: "Rohan Desai" },
      innings: [makeInnings({ is_completed: true, total_runs: 83 })],
    });

  it("keeps to what only it can say", () => {
    const match = finished();
    render(<MatchHero match={match} sides={sidesInBattingOrder(match)} page />);
    expect(screen.getByText("Rohan won by 15 runs")).toBeInTheDocument();
    // Summary has the award, the bar the title, and the result needs no chip.
    expect(screen.queryByText("Player of the match")).toBeNull();
    expect(screen.queryByText("Rohan vs Omkar")).toBeNull();
    expect(screen.queryByText("Result")).toBeNull();
  });

  it("says the length, not a format that means nothing", () => {
    const match = finished();
    render(<MatchHero match={match} sides={sidesInBattingOrder(match)} page />);
    expect(screen.getByText("8 overs")).toBeInTheDocument();
    expect(screen.queryByText(/Custom/)).toBeNull();
  });

  it("shows a start time without an Upcoming chip beside it", () => {
    const match = makeMatch({
      status: "scheduled",
      scheduled_at: "2026-11-01T09:48:00.000Z",
    });
    render(<MatchHero match={match} sides={sidesInBattingOrder(match)} page />);
    expect(screen.getAllByText("Upcoming")).toHaveLength(1);
  });

  it("leaves the report's header as it was", () => {
    const match = finished();
    render(
      <MatchHero
        match={match}
        sides={sidesInBattingOrder(match)}
        plain={false}
      />,
    );
    expect(screen.getByText("Player of the match")).toBeInTheDocument();
    expect(screen.getByText("Result")).toBeInTheDocument();
    expect(screen.getByText("Rohan vs Omkar")).toBeInTheDocument();
  });
});

describe("scoreLineSides", () => {
  it("gives each side's code and score, quiet for the side that lost", () => {
    const match = makeMatch({
      status: "completed",
      winning_team_id: "t1",
      innings: [
        makeInnings({
          id: "a",
          team_id: "t1",
          total_runs: 83,
          total_wickets: 6,
          total_balls: 48,
          is_completed: true,
        }),
        makeInnings({
          id: "b",
          innings_number: 2,
          team_id: "t2",
          total_runs: 68,
          total_wickets: 6,
          total_balls: 48,
          is_completed: true,
        }),
      ],
    });
    expect(scoreLineSides(match, sidesInBattingOrder(match))).toEqual([
      { code: "RTG", score: "83/6 (8.0)", dim: false },
      { code: "CKS", score: "68/6 (8.0)", dim: true },
    ]);
  });

  it("has no score before a side bats", () => {
    const match = makeMatch({ status: "scheduled" });
    const [first] = scoreLineSides(match, sidesInBattingOrder(match));
    expect(first.score).toBeNull();
  });
});

describe("MatchHero", () => {
  it("says why an abandoned match has no result", () => {
    hero(
      makeMatch({
        status: "abandoned",
        result_description: "Match abandoned: Rain",
        innings: [first],
      }),
    );
    expect(screen.getByText("Abandoned")).toBeDefined();
    expect(screen.getByText("Match abandoned: Rain")).toBeDefined();
  });

  it("shows an innings break until the chase's first ball", () => {
    hero(
      makeMatch({
        innings: [
          first,
          makeInnings({
            id: "inn-2",
            team_id: "t2",
            innings_number: 2,
            target_runs: 151,
          }),
        ],
      }),
    );
    expect(screen.getByText("Innings break")).toBeDefined();
    expect(
      screen.getByText("Coastal Kings need 151 runs from 120 balls"),
    ).toBeDefined();
  });

  it("counts a DLS chase over its revised overs and names the target", () => {
    hero(
      makeMatch({
        dls_revision: { innings_number: 2, target_runs: 98, overs: 12 },
        innings: [
          first,
          makeInnings({
            id: "inn-2",
            team_id: "t2",
            innings_number: 2,
            target_runs: 98,
            total_runs: 40,
            total_balls: 36,
            total_overs: 6,
          }),
        ],
      }),
    );
    expect(
      screen.getByText("Coastal Kings need 58 runs from 36 balls (DLS target 98)"),
    ).toBeDefined();
  });

  it("says who bats first instead of a run rate of 0.00", () => {
    hero(makeMatch({ innings: [makeInnings()] }));
    expect(screen.getByText("Royal Tigers bat first")).toBeDefined();
    expect(screen.queryByText(/Run rate/)).toBeNull();
  });

  it("opens a player's profile from the top performers and the player of the match", () => {
    const batter = {
      id: "bp1",
      match_id: "m1",
      innings_id: "inn-1",
      user_id: "u-bat",
      batting_position: 1,
      runs_scored: 58,
      balls_faced: 41,
      fours: 5,
      sixes: 1,
      is_out: false,
      user: { id: "u-bat", full_name: "Arjun Mehta" },
    };
    hero(
      makeMatch({
        status: "completed",
        winning_team_id: "t1",
        result_description: "Royal Tigers won by 15 runs",
        player_of_the_match: { id: "u-bat", full_name: "Arjun Mehta" },
        innings: [{ ...first, batting_performances: [batter] }],
      }),
    );

    const links = screen
      .getAllByRole("link")
      .filter((a) => a.getAttribute("href") === "/players/u-bat");
    // The surname line under the side, and the award card's name.
    expect(links.map((a) => a.textContent)).toEqual(
      expect.arrayContaining(["Mehta 58* (41)", "Arjun Mehta"]),
    );
  });
});
