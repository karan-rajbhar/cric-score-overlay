import { render, screen, fireEvent, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { LiveMatchHUD } from "./live-match-hud";
import type { Match, Innings } from "~/lib/match-types";

vi.mock("~/lib/hooks/useMediaQuery", () => ({ useMediaQuery: () => false }));

describe("LiveMatchHUD Component", () => {
  const mockMatchChasing: Match = {
    id: "m-1",
    title: "Championship Final",
    match_format: "T20",
    overs_per_innings: 20,
    status: "live",
    current_innings: 2,
    current_over: 16,
    current_ball: 2,
    team1_id: "team-1",
    team2_id: "team-2",
    team1: { id: "team-1", name: "Team 1" },
    team2: { id: "team-2", name: "Team 2" },
    innings: [
      {
        id: "inn-1",
        match_id: "m-1",
        innings_number: 1,
        team_id: "team-1",
        total_runs: 167,
        total_wickets: 7,
        total_balls: 120,
        total_overs: 20,
        is_completed: true,
        extras_total: 8,
        extras_byes: 0,
        extras_leg_byes: 2,
        extras_wides: 5,
        extras_no_balls: 1,
        extras_penalties: 0,
      },
    ],
  };

  const mockCurrentInningsChasing: Innings = {
    id: "inn-2",
    match_id: "m-1",
    innings_number: 2,
    team_id: "team-2",
    total_runs: 134,
    total_wickets: 3,
    total_balls: 98, // 16.2 overs
    total_overs: 16.2,
    is_completed: false,
    target_runs: 168,
    extras_total: 6,
    extras_byes: 0,
    extras_leg_byes: 1,
    extras_wides: 4,
    extras_no_balls: 1,
    extras_penalties: 0,
  };

  const mockStriker = {
    id: "p-1",
    name: "Virat Kohli",
    runs: 64,
    balls: 42,
    fours: 6,
    sixes: 2,
    isStriker: true,
  };

  const mockNonStriker = {
    id: "p-2",
    name: "Hardik Pandya",
    runs: 28,
    balls: 14,
    fours: 2,
    sixes: 2,
    isStriker: false,
  };

  const mockBowler = {
    id: "p-3",
    name: "Pat Cummins",
    overs: 3.2,
    maidens: 0,
    runs: 26,
    wickets: 2,
  };

  it("accurately calculates and displays the chase equation in the 2nd innings", () => {
    render(
      <LiveMatchHUD
        match={mockMatchChasing}
        currentInnings={mockCurrentInningsChasing}
        striker={mockStriker}
        nonStriker={mockNonStriker}
        bowler={mockBowler}
        lastBalls={["1", "4"]}
      />,
    );

    // Target = 168, current = 134 -> Need 34 runs from 22 balls (120 total - 98 bowled = 22 remaining)
    expect(screen.getByTestId("chase-equation-title")).toHaveTextContent(
      /Need 34 runs from 22 balls/i,
    );
    expect(screen.getByText(/Target:/i)).toBeInTheDocument();
    expect(screen.getAllByText("168").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/wickets in hand/i)).toBeInTheDocument();
  });

  it("marks only the striker, and puts the other batter on strike when tapped", () => {
    const onSwapStriker = vi.fn();
    const onChangeStriker = vi.fn();
    const onChangeNonStriker = vi.fn();
    const props = {
      match: mockMatchChasing,
      currentInnings: mockCurrentInningsChasing,
      bowler: mockBowler,
      lastBalls: ["1", "4"],
      onSwapStriker,
      onChangeStriker,
      onChangeNonStriker,
    };
    const first = { ...mockStriker, position: 1 };
    const second = { ...mockNonStriker, position: 2 };
    const { rerender } = render(
      <LiveMatchHUD {...props} striker={first} nonStriker={second} />,
    );
    const group = screen.getByRole("radiogroup", { name: "Batter on strike" });
    const radios = within(group).getAllByRole("radio");
    // One on strike, marked once.
    expect(radios.map((r) => r.getAttribute("aria-checked"))).toEqual(["true", "false"]);
    expect(within(group).getAllByText("On strike")).toHaveLength(1);
    expect(radios[0]).toHaveTextContent("Virat Kohli *");
    expect(radios[1]).not.toHaveTextContent("*");

    // Tapping the other batter puts him on strike; tapping the striker does nothing.
    fireEvent.click(radios[0]!);
    expect(onSwapStriker).not.toHaveBeenCalled();
    fireEvent.click(radios[1]!);
    expect(onSwapStriker).toHaveBeenCalledTimes(1);

    // After the change of strike the rows stay put; only the mark moves.
    rerender(
      <LiveMatchHUD
        {...props}
        striker={{ ...second, isStriker: true }}
        nonStriker={{ ...first, isStriker: false }}
      />,
    );
    const after = within(screen.getByRole("radiogroup")).getAllByRole("radio");
    expect(after[0]).toHaveTextContent(/Virat Kohli/);
    expect(after.map((r) => r.getAttribute("aria-checked"))).toEqual(["false", "true"]);

    // Each batter can be changed on his own.
    fireEvent.click(screen.getByRole("button", { name: /change virat kohli/i }));
    expect(onChangeNonStriker).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: /change hardik pandya/i }));
    expect(onChangeStriker).toHaveBeenCalledTimes(1);
  });

  it("renders bowler figures and max overs quota", () => {
    render(
      <LiveMatchHUD
        match={mockMatchChasing}
        currentInnings={mockCurrentInningsChasing}
        striker={mockStriker}
        nonStriker={mockNonStriker}
        bowler={mockBowler}
        lastBalls={["1", "4"]}
      />,
    );

    expect(screen.getByText(/Pat Cummins/i)).toBeInTheDocument();
    // 2/26 wickets/runs
    expect(screen.getByText("2/26")).toBeInTheDocument();
    // Max 4 overs in T20 (20 / 5)
    expect(screen.getByText(/\/ 4/i)).toBeInTheDocument();
  });

  it("renders 1st innings situation with projected score when in 1st innings", () => {
    const mockMatch1stInns: Match = {
      ...mockMatchChasing,
      current_innings: 1,
    };

    const mockInnings1: Innings = {
      ...mockCurrentInningsChasing,
      innings_number: 1,
      target_runs: null,
      total_runs: 80,
      total_balls: 60, // 10 overs, CRR = 8.00, Projected = 160
    };

    render(
      <LiveMatchHUD
        match={mockMatch1stInns}
        currentInnings={mockInnings1}
        striker={mockStriker}
        nonStriker={mockNonStriker}
        bowler={mockBowler}
        lastBalls={["1", "0", "4"]}
      />,
    );

    expect(screen.getByText(/1st Innings/i)).toBeInTheDocument();
    expect(screen.getByText(/CRR: 8.00/i)).toBeInTheDocument();
    expect(screen.getByText(/Proj: 160/i)).toBeInTheDocument();
  });

  it("filters out previous over deliveries so new bowler starts with 0 runs this over", () => {
    const newBowlerMatch: Match = {
      ...mockMatchChasing,
      current_over: 1,
      current_ball: 0,
    };

    // rawDeliveries contains deliveries from Over 0 (e.g. 6 runs scored in Over 0)
    const rawDeliveries = [
      {
        id: "b1",
        over_number: 0,
        ball_number: 1,
        runs_scored: 4,
        extras: 0,
        extra_type: null,
        is_wicket: false,
      },
      {
        id: "b2",
        over_number: 0,
        ball_number: 2,
        runs_scored: 2,
        extras: 0,
        extra_type: null,
        is_wicket: false,
      },
    ];

    render(
      <LiveMatchHUD
        match={newBowlerMatch}
        currentInnings={mockCurrentInningsChasing}
        striker={mockStriker}
        nonStriker={mockNonStriker}
        bowler={{
          id: "new-bowler",
          name: "Jasprit Bumrah",
          overs: 0,
          maidens: 0,
          runs: 0,
          wickets: 0,
        }}
        lastBalls={[]}
        rawDeliveries={rawDeliveries}
      />,
    );

    // This Over runs for the new bowler in over 1 should be 0, not 6!
    expect(screen.getByText(/0 runs/i)).toBeInTheDocument();
    expect(screen.queryByText(/6 runs/i)).not.toBeInTheDocument();
    expect(
      screen.getByText(/Awaiting first ball of over/i),
    ).toBeInTheDocument();
  });
});

const endInningsFixture = {
  id: "inn-1",
  match_id: "m1",
  innings_number: 1,
  total_runs: 142,
  total_wickets: 6,
  total_overs: 17.2,
  fall_of_wickets: [],
} as unknown as Innings;

function renderHud(innings_number = 1) {
  const onEndInnings = vi.fn();
  const match = {
    id: "m1",
    title: "Test match",
    status: "live",
    current_innings: innings_number,
    overs_per_innings: 20,
    wickets_per_innings: 10,
    balls_per_over: 6,
    innings: [{ ...endInningsFixture, innings_number }],
  } as unknown as Match;
  render(
    <LiveMatchHUD
      match={match}
      currentInnings={{ ...endInningsFixture, innings_number }}
      striker={null}
      nonStriker={null}
      bowler={null}
      lastBalls={[]}
      battingTeamName="Strikers"
      onEndInnings={onEndInnings}
    />,
  );
  return { onEndInnings, user: userEvent.setup() };
}

describe("LiveMatchHUD end innings", () => {
  it("asks for confirmation and can be cancelled", async () => {
    const { onEndInnings, user } = renderHud();
    await user.click(screen.getByRole("button", { name: "End inns" }));

    const dialog = await screen.findByRole("dialog", {
      name: "End this innings?",
    });
    expect(dialog).toHaveTextContent("Strikers 142/6 after");
    expect(dialog).toHaveTextContent("target of 143");

    await user.click(screen.getByRole("button", { name: "Keep scoring" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(onEndInnings).not.toHaveBeenCalled();
  });

  it("closes on Escape without ending the innings", async () => {
    const { onEndInnings, user } = renderHud();
    await user.click(screen.getByRole("button", { name: "End inns" }));
    await screen.findByRole("dialog");

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(onEndInnings).not.toHaveBeenCalled();
  });

  it("ends the innings once when confirmed", async () => {
    const { onEndInnings, user } = renderHud(2);
    await user.click(screen.getByRole("button", { name: "End inns" }));
    const dialog = await screen.findByRole("dialog");
    expect(dialog).toHaveTextContent("No more balls can be scored");

    await user.click(screen.getByRole("button", { name: "End innings" }));
    expect(onEndInnings).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
