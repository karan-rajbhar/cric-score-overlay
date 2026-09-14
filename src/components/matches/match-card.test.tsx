import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MatchCard } from "./match-card";

import { makeMatch } from "~/test/factories";

const liveMatch = makeMatch({
  venue: "City Ground",
  scheduled_at: new Date().toISOString(),
  created_by: "user-owner",
  match_admins: ["user-owner"],
  innings: [
    {
      id: "i1",
      match_id: "m1",
      innings_number: 1,
      team_id: "t1",
      total_runs: 98,
      total_wickets: 3,
      total_balls: 62,
      total_overs: 10.2,
      is_completed: false,
      extras_total: 0,
      extras_byes: 0,
      extras_leg_byes: 0,
      extras_wides: 0,
      extras_no_balls: 0,
      extras_penalties: 0,
    },
  ],
});

describe("MatchCard scoring actions", () => {
  it("shows the Score action for a scorer on a live match without duplicate live badges", () => {
    render(<MatchCard match={liveMatch} canScore />);
    expect(screen.getByText("Score")).toBeInTheDocument();
    // The card should only display a single Live status pill, never duplicate Live action buttons
    expect(screen.getAllByText("Live")).toHaveLength(1);
  });

  it("hides scoring actions from non-scoring users", () => {
    render(<MatchCard match={liveMatch} />);
    expect(screen.queryByText("Score")).not.toBeInTheDocument();
    // The live status pill still shows to everyone…
    expect(screen.getByText("Live")).toBeInTheDocument();
    // …but there is no second "Live" entry from the action row.
    expect(screen.getAllByText("Live")).toHaveLength(1);
  });

  it("always shows the scorecard link", () => {
    render(<MatchCard match={liveMatch} />);
    expect(screen.getByText("Scorecard")).toBeInTheDocument();
  });

  it("renders both team names and the running score", () => {
    render(<MatchCard match={liveMatch} />);
    expect(screen.getByText("Royal Tigers")).toBeInTheDocument();
    expect(screen.getByText("Coastal Kings")).toBeInTheDocument();
    expect(screen.getByText("98/3")).toBeInTheDocument();
  });
});
