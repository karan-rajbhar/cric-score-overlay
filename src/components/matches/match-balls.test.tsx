import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MatchBalls, outcomeOf } from "./match-balls";
import { deliveryLabel } from "~/lib/cricket";
import type { BallEvent } from "~/lib/match-types";
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

    expect(screen.getByText("All deliveries")).toBeInTheDocument();
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

describe("folding overs", () => {
  const oversLog = (count: number) =>
    Array.from({ length: count }, (_, over) => ({
      id: `b${over}`,
      match_id: "m1",
      innings_id: "inn-1",
      over_number: over,
      ball_number: 1,
      runs_scored: 1,
      extras: 0,
      extra_type: null,
      is_wicket: over === 0,
      dismissal_type: over === 0 ? "bowled" : null,
      bowler_id: "bowl-1",
      bowler: { id: "bowl-1", full_name: "Jasprit Bumrah" },
      batsman: { id: "bat-1", full_name: "Virat Kohli" },
    }));
  const renderOvers = () => {
    vi.mocked(matchQueries.useMatchBallLogQuery).mockReturnValue({
      data: oversLog(3),
      error: null,
      isLoading: false,
    } as never);
    const match = makeMatch({
      current_innings: 1,
      innings: [makeInnings({ id: "inn-1", innings_number: 1 })],
    });
    const { container } = render(<MatchBalls match={match} />);
    const openOvers = () =>
      [...container.querySelectorAll("details")].map(
        (d) => (d as HTMLDetailsElement).open,
      );
    return { openOvers };
  };

  it("keeps only the latest over open, with every over's chips in view", () => {
    const { openOvers } = renderOvers();
    expect(openOvers()).toEqual([true, false, false]);
    expect(screen.getByText("Over 1").closest("summary")).toHaveTextContent("W");
  });

  it("opens every over a filter leaves, then folds them again", () => {
    const { openOvers } = renderOvers();
    fireEvent.click(screen.getByText("Wickets"));
    expect(openOvers()).toEqual([true]);
    fireEvent.click(screen.getByText("All deliveries"));
    expect(openOvers()).toEqual([true, false, false]);
  });
});

const person = (id: string, full_name: string) => ({ id, full_name });

const ball = (over: Partial<BallEvent> = {}): BallEvent => ({
  id: "b1",
  match_id: "m",
  innings_id: "i",
  over_number: 3,
  ball_number: 2,
  batsman_id: "kohli",
  batsman: person("kohli", "Kohli"),
  bowler_id: "starc",
  bowler: person("starc", "Starc"),
  runs_scored: 0,
  extras: 0,
  is_wicket: false,
  ...over,
});

const runOut = (over: Partial<BallEvent> = {}) =>
  ball({
    is_wicket: true,
    dismissal_type: "run_out",
    dismissed_player_id: "kohli",
    dismissed_player: person("kohli", "Kohli"),
    fielder_id: "smith",
    fielder: person("smith", "Smith"),
    ...over,
  });

describe("outcomeOf", () => {
  it("says the runs of a wicket ball, chip and words alike", () => {
    const b = runOut({ runs_scored: 3 });
    expect(deliveryLabel(b)).toBe("W+3");
    expect(outcomeOf(b)).toBe("3 runs. Out, run out (Smith)");
  });

  it("names the batter out when it is not the one facing", () => {
    expect(
      outcomeOf(
        runOut({
          runs_scored: 1,
          dismissed_player_id: "rohit",
          dismissed_player: person("rohit", "Rohit"),
        }),
      ),
    ).toBe("1 run. Rohit run out (Smith)");
  });

  it("says who took the catch, or caught and bowled", () => {
    const caught = {
      is_wicket: true,
      dismissal_type: "caught",
      dismissed_player_id: "kohli",
    };
    expect(
      outcomeOf(
        ball({ ...caught, fielder_id: "smith", fielder: person("smith", "Smith") }),
      ),
    ).toBe("Out, caught by Smith");
    expect(
      outcomeOf(
        ball({ ...caught, fielder_id: "starc", fielder: person("starc", "Starc") }),
      ),
    ).toBe("Out, caught and bowled");
  });

  it("keeps the extra of a wicket ball", () => {
    expect(
      outcomeOf(
        ball({
          is_wicket: true,
          dismissal_type: "stumped",
          dismissed_player_id: "kohli",
          extra_type: "wide",
          extras: 1,
        }),
      ),
    ).toBe("1 run, wide. Out, stumped");
  });

  it("does not call a retirement out", () => {
    const retired = {
      bowler_id: null,
      bowler: null,
      is_wicket: true,
      dismissed_player_id: "rohit",
      dismissed_player: person("rohit", "Rohit"),
    };
    expect(outcomeOf(ball({ ...retired, dismissal_type: "retired_hurt" }))).toBe(
      "Rohit retired hurt",
    );
    expect(outcomeOf(ball({ ...retired, dismissal_type: "retired_out" }))).toBe(
      "Rohit retired out",
    );
  });

  it("reads plain balls as before", () => {
    expect(outcomeOf(ball({ runs_scored: 4 }))).toBe("Four");
    expect(outcomeOf(ball({ runs_scored: 6 }))).toBe("Six");
    expect(outcomeOf(ball())).toBe("No run");
    expect(outcomeOf(ball({ runs_scored: 2 }))).toBe("2 runs");
  });
});
