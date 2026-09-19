import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MatchStats } from "./match-stats";
import type { Match } from "~/lib/match-types";

vi.mock("~/lib/hooks/useMatchQueries", () => ({
  useMatchBallLogQuery: () => ({
    data: [],
    isLoading: false,
    error: null,
  }),
  useOverSummariesQuery: () => ({
    data: [],
    isLoading: false,
    error: null,
  }),
}));

describe("MatchStats stacked layout", () => {
  const dummyMatch: Match = {
    id: "m-1",
    title: "Hawks vs Eagles",
    match_format: "t20",
    tournament_id: "t-1",
    team1_id: "team-a",
    team2_id: "team-b",
    status: "live",
    current_innings: 1,
    current_over: 5,
    current_ball: 2,
    overs_per_innings: 20,
    team1: { id: "team-a", name: "Hawks", short_name: "HWK" },
    team2: { id: "team-b", name: "Eagles", short_name: "EAG" },
    innings: [],
  };

  it("renders wagon wheel first, then worm, manhattan and breakdown one after another", () => {
    const { container } = render(<MatchStats match={dummyMatch} />);

    // No inner tabs anymore — everything stacked
    expect(screen.queryByRole("tab")).not.toBeInTheDocument();

    // Wagon wheel on top
    expect(
      screen.getByText(/360° circular wagon wheel/i),
    ).toBeInTheDocument();

    // Sections follow in order: worm → manhattan → breakdown
    const text = container.textContent ?? "";
    const wagonIdx = text.indexOf("360");
    const wormIdx = text.indexOf("Worm Chart");
    const manhattanIdx = text.indexOf("Manhattan");
    const breakdownIdx = text.indexOf("Delivery Breakdown");
    expect(wagonIdx).toBeGreaterThanOrEqual(0);
    expect(wormIdx).toBeGreaterThan(wagonIdx);
    expect(manhattanIdx).toBeGreaterThan(wormIdx);
    expect(breakdownIdx).toBeGreaterThan(manhattanIdx);
  });
});
