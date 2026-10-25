import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { sidesInBattingOrder } from "~/lib/cricket";
import type { Match } from "~/lib/match-types";
import { makeInnings, makeMatch } from "~/test/factories";
import { MatchHero } from "./match-hero";

const hero = (match: Match) =>
  render(<MatchHero match={match} sides={sidesInBattingOrder(match)} />);

const first = makeInnings({
  total_runs: 150,
  total_balls: 120,
  total_overs: 20,
  is_completed: true,
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
