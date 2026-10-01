import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MatchBalls } from "./match-balls";
import { makeInnings, makeMatch } from "~/test/factories";
import * as matchQueries from "~/lib/hooks/useMatchQueries";

vi.mock("~/lib/hooks/useMatchQueries", () => ({
  useMatchBallLogQuery: vi.fn(),
}));

describe("MatchBalls", () => {
  it("renders loading state when ball log query is loading", () => {
    vi.mocked(matchQueries.useMatchBallLogQuery).mockReturnValue({
      data: null,
      error: null,
      isLoading: true,
    } as never);

    const match = makeMatch();
    const { container } = render(<MatchBalls match={match} />);

    expect(container.querySelector(".animate-spin")).toBeInTheDocument();
  });

  it("renders empty state when no innings exist", () => {
    vi.mocked(matchQueries.useMatchBallLogQuery).mockReturnValue({
      data: [],
      error: null,
      isLoading: false,
    } as never);

    const match = makeMatch({ innings: [] });
    render(<MatchBalls match={match} />);

    expect(screen.getByText(/no ball-by-ball data available yet/i)).toBeInTheDocument();
  });

  it("renders balls grouped by over and filters boundaries", () => {
    const mockBalls = [
      {
        id: "b1",
        match_id: "m1",
        innings_id: "inn-1",
        over_number: 1,
        ball_number: 1,
        runs_scored: 4,
        extras: 0,
        extra_type: null,
        is_wicket: false,
        bowler: { id: "bowl-1", full_name: "Jasprit Bumrah" },
        batsman: { id: "bat-1", full_name: "Virat Kohli" },
      },
      {
        id: "b2",
        match_id: "m1",
        innings_id: "inn-1",
        over_number: 1,
        ball_number: 2,
        runs_scored: 0,
        extras: 0,
        extra_type: null,
        is_wicket: true,
        bowler: { id: "bowl-1", full_name: "Jasprit Bumrah" },
        batsman: { id: "bat-1", full_name: "Virat Kohli" },
      },
    ];

    vi.mocked(matchQueries.useMatchBallLogQuery).mockReturnValue({
      data: mockBalls,
      error: null,
      isLoading: false,
    } as never);

    const match = makeMatch({
      innings: [
        makeInnings({
          id: "inn-1",
          match_id: "m1",
          innings_number: 1,
          team_id: "t1",
          total_runs: 4,
          total_wickets: 1,
          total_overs: 1,
          total_balls: 2,
        }),
      ],
    });

    render(<MatchBalls match={match} />);

    expect(screen.getByText("All Deliveries")).toBeInTheDocument();
    expect(screen.getByText(/Boundaries/)).toBeInTheDocument();
    expect(screen.getByText("Wickets")).toBeInTheDocument();

    // Check balls render
    expect(screen.getByText("4")).toBeInTheDocument();
    expect(screen.getByText("W")).toBeInTheDocument();

    // Click Boundaries filter
    fireEvent.click(screen.getByText(/Boundaries/));
    expect(screen.getByText("4")).toBeInTheDocument();
    expect(screen.queryByText("W")).not.toBeInTheDocument();
  });
});
