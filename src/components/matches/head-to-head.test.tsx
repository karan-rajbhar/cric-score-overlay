import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { HeadToHead } from "./head-to-head";
import * as matchQueries from "~/lib/hooks/useMatchQueries";

vi.mock("~/lib/hooks/useMatchQueries", () => ({
  useHeadToHeadQuery: vi.fn(),
}));

describe("HeadToHead", () => {
  const team1 = { id: "t1", name: "Royal Tigers", short_name: "RTG" };
  const team2 = { id: "t2", name: "Coastal Kings", short_name: "CKS" };

  it("renders loading indicator while query is pending", () => {
    vi.mocked(matchQueries.useHeadToHeadQuery).mockReturnValue({
      data: null,
      isLoading: true,
      error: null,
    } as never);

    render(<HeadToHead team1={team1} team2={team2} currentMatchId="m1" />);

    expect(screen.getByText(/loading head-to-head records/i)).toBeInTheDocument();
  });

  it("renders zero matches view when no prior matches exist", () => {
    vi.mocked(matchQueries.useHeadToHeadQuery).mockReturnValue({
      data: [],
      isLoading: false,
      error: null,
    } as never);

    render(<HeadToHead team1={team1} team2={team2} currentMatchId="m1" />);

    expect(screen.getByText("Head-to-Head Record")).toBeInTheDocument();
    expect(
      screen.getByText(/no previous completed encounters/i),
    ).toBeInTheDocument();
  });

  it("renders historical matches and win tally when records exist", () => {
    const mockMatches = [
      {
        id: "hist-1",
        title: "Tigers vs Kings - Final",
        scheduled_at: "2026-05-10T14:00:00Z",
        venue: "National Cricket Stadium",
        winning_team_id: "t1",
        result_type: "win",
        result_description: "Royal Tigers won by 15 runs",
        team1_id: "t1",
        team2_id: "t2",
        innings: [
          { team_id: "t1", total_runs: 175, total_wickets: 5, total_overs: 20 },
          { team_id: "t2", total_runs: 160, total_wickets: 8, total_overs: 20 },
        ],
      },
    ];

    vi.mocked(matchQueries.useHeadToHeadQuery).mockReturnValue({
      data: mockMatches,
      isLoading: false,
      error: null,
    } as never);

    render(<HeadToHead team1={team1} team2={team2} currentMatchId="m1" />);

    expect(screen.getByText("Head-to-Head Record")).toBeInTheDocument();
    expect(screen.getByText("Royal Tigers won by 15 runs")).toBeInTheDocument();
    expect(screen.getByText("National Cricket Stadium")).toBeInTheDocument();
  });
});
