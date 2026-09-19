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
}));

describe("MatchStats Tab Ordering", () => {
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

  it("renders Scoring Zones (Wagon Wheel) as the first and default tab", () => {
    render(<MatchStats match={dummyMatch} />);

    // Get all tab triggers
    const tabs = screen.getAllByRole("tab");
    expect(tabs.length).toBeGreaterThanOrEqual(3);

    // First tab should be Scoring Zones
    expect(tabs[0]).toHaveTextContent(/scoring zones|zones/i);
    expect(tabs[0]).toHaveAttribute("aria-selected", "true");

    // Wagon Wheel component should be visible in the default tab
    expect(
      screen.getByText(/360° circular wagon wheel/i),
    ).toBeInTheDocument();
  });
});
