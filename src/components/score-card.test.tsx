import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ScoreCard } from "./score-card";

const liveMatch = {
  id: "m1",
  team1: "Royal Tigers",
  team2: "Coastal Kings",
  status: "live" as const,
  team1Score: { runs: 145, wickets: 3, overs: 15.2 },
  team2Score: undefined,
  currentBatsmen: {
    batsman1: { name: "A. Sharma", runs: 62, balls: 40 },
    batsman2: { name: "R. Patel", runs: 31, balls: 24 },
  },
  recentOvers: ["1 4 W 0 1 2"],
};

const upcomingMatch = {
  id: "m2",
  team1: "Royal Tigers",
  team2: "Coastal Kings",
  status: "upcoming" as const,
};

describe("ScoreCard", () => {
  it("renders both team names", () => {
    render(<ScoreCard match={liveMatch} />);
    expect(
      screen.getByText("Royal Tigers vs Coastal Kings"),
    ).toBeInTheDocument();
  });

  it("shows a live indicator for live matches", () => {
    render(<ScoreCard match={liveMatch} />);
    expect(screen.getByText("Live")).toBeInTheDocument();
  });

  it("displays scores with runs/wickets and overs", () => {
    render(<ScoreCard match={liveMatch} />);
    expect(screen.getByText("145/3")).toBeInTheDocument();
    expect(screen.getByText("(15.2 ov)")).toBeInTheDocument();
  });

  it("shows 'Yet to bat' for the batting-side-to-be", () => {
    render(<ScoreCard match={liveMatch} />);
    expect(screen.getByText("Yet to bat")).toBeInTheDocument();
  });

  it("lists current batsmen when the match is live", () => {
    render(<ScoreCard match={liveMatch} />);
    expect(screen.getByText("A. Sharma")).toBeInTheDocument();
    expect(screen.getByText("R. Patel")).toBeInTheDocument();
  });

  it("does not show batsmen or scores for upcoming matches", () => {
    render(<ScoreCard match={upcomingMatch} />);
    expect(screen.queryByText("Live")).not.toBeInTheDocument();
    expect(screen.getAllByText("Yet to bat")).toHaveLength(2);
    expect(screen.queryByText("A. Sharma")).not.toBeInTheDocument();
  });
});
