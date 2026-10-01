import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MatchPartnerships } from "./match-partnerships";
import { makeInnings, makeMatch } from "~/test/factories";
import * as matchQueries from "~/lib/hooks/useMatchQueries";

vi.mock("~/lib/hooks/useMatchQueries", () => ({
  usePartnershipsQuery: vi.fn(),
  useMatchBallLogQuery: vi.fn(),
}));

describe("MatchPartnerships", () => {
  it("renders empty message when no partnerships are recorded", () => {
    vi.mocked(matchQueries.usePartnershipsQuery).mockReturnValue({
      data: [],
      error: null,
      isLoading: false,
    } as never);
    vi.mocked(matchQueries.useMatchBallLogQuery).mockReturnValue({
      data: [],
    } as never);

    const match = makeMatch();
    render(<MatchPartnerships match={match} />);

    expect(screen.getByText(/no partnerships recorded yet/i)).toBeInTheDocument();
  });

  it("renders partnership stands with batter names and runs", () => {
    const mockPartnerships = [
      {
        id: "part-1",
        innings_id: "inn-1",
        runs: 75,
        balls: 45,
        start_over: 0,
        end_over: 7,
        is_current: false,
        batsman1_id: "bat-1",
        batsman2_id: "bat-2",
        batsman1: { full_name: "Virat Kohli" },
        batsman2: { full_name: "Faf du Plessis" },
      },
    ];

    vi.mocked(matchQueries.usePartnershipsQuery).mockReturnValue({
      data: mockPartnerships,
      error: null,
      isLoading: false,
    } as never);
    vi.mocked(matchQueries.useMatchBallLogQuery).mockReturnValue({
      data: [],
    } as never);

    const match = makeMatch({
      innings: [
        makeInnings({
          id: "inn-1",
          match_id: "m1",
          innings_number: 1,
          team_id: "t1",
          total_runs: 180,
          total_wickets: 2,
          total_overs: 20,
          total_balls: 120,
        }),
      ],
    });

    render(<MatchPartnerships match={match} />);

    expect(screen.getByText("Partnerships")).toBeInTheDocument();
    expect(screen.getByText("Virat Kohli")).toBeInTheDocument();
    expect(screen.getByText("Faf du Plessis")).toBeInTheDocument();
    expect(screen.getByText("75")).toBeInTheDocument();
    expect(screen.getByText(/45b/)).toBeInTheDocument();
  });
});
