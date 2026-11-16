import { render, screen, fireEvent, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { LiveMatchHUD, currentStandOf } from "./live-match-hud";
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
    // One plain line on every size: the target, wickets left and the rate
    // needed, with no "RRR" / "wkts" shorthand (the run rate from sm up).
    const line = screen.getByText(/^Target/);
    expect(line).toHaveTextContent(/Target 168 · \d+ wickets left · needs [\d.]+ an over/);
    expect(screen.queryByText(/RRR|CRR|wkts|RPO|Req RR|Curr RR/)).toBeNull();
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

    expect(screen.getByText("1st innings · T20")).toBeInTheDocument();
    // The rate and the projection once, in words; 60 balls of 120 left.
    expect(screen.getByText(/^Run rate/)).toHaveTextContent(
      /Run rate 8\.00 · Projected 160 \(\d+ at 8 an over, \d+ at 10\)/,
    );
    expect(screen.getByText("60 balls left")).toBeInTheDocument();
    expect(screen.getByText("10.0 of 20 ov")).toBeInTheDocument();
    expect(screen.queryByText(/Proj:|CRR|Projected score/)).toBeNull();
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
  // The last over: the scoreboard offers End innings only near the end.
  total_overs: 19.2,
  total_balls: 116,
  fall_of_wickets: [],
} as unknown as Innings;

function renderHud(innings_number = 1, innings: Partial<Innings> = {}) {
  const onEndInnings = vi.fn();
  const match = {
    id: "m1",
    title: "Test match",
    status: "live",
    current_innings: innings_number,
    overs_per_innings: 20,
    wickets_per_innings: 10,
    balls_per_over: 6,
    innings: [{ ...endInningsFixture, innings_number, ...innings }],
  } as unknown as Match;
  render(
    <LiveMatchHUD
      match={match}
      currentInnings={{ ...endInningsFixture, innings_number, ...innings }}
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
  it("keeps End innings off the scoreboard mid-innings (S13)", () => {
    renderHud(1, { total_overs: 12, total_balls: 72 } as Partial<Innings>);
    expect(screen.queryByRole("button", { name: "End innings" })).toBeNull();
  });

  it("shows it with one wicket left, whatever the over", () => {
    renderHud(1, {
      total_overs: 12,
      total_balls: 72,
      total_wickets: 9,
    } as Partial<Innings>);
    expect(screen.getByRole("button", { name: "End innings" })).toBeInTheDocument();
  });

  it("asks for confirmation and can be cancelled", async () => {
    const { onEndInnings, user } = renderHud();
    await user.click(screen.getByRole("button", { name: "End innings" }));

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
    await user.click(screen.getByRole("button", { name: "End innings" }));
    await screen.findByRole("dialog");

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(onEndInnings).not.toHaveBeenCalled();
  });

  it("ends the innings once when confirmed", async () => {
    const { onEndInnings, user } = renderHud(2);
    await user.click(screen.getByRole("button", { name: "End innings" }));
    const dialog = await screen.findByRole("dialog");
    expect(dialog).toHaveTextContent("This ends the match");

    await user.click(screen.getByRole("button", { name: "End innings" }));
    expect(onEndInnings).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});

describe("LiveMatchHUD super over", () => {
  const superOverMatch = (innings_number: number) =>
    ({
      id: "m1",
      title: "Test match",
      status: "live",
      current_innings: innings_number,
      overs_per_innings: 20,
      wickets_per_innings: 10,
      balls_per_over: 6,
      innings: [],
    }) as unknown as Match;

  it("shows one over and two wickets, not the match's limits", () => {
    render(
      <LiveMatchHUD
        match={superOverMatch(3)}
        currentInnings={
          {
            id: "inn-3",
            innings_number: 3,
            total_runs: 7,
            total_wickets: 0,
            total_balls: 2,
            fall_of_wickets: [],
          } as unknown as Innings
        }
        striker={null}
        nonStriker={null}
        bowler={null}
        lastBalls={[]}
      />,
    );
    expect(screen.getByText(/Super over · 1st innings/)).toBeInTheDocument();
    expect(screen.getByText("4 balls left")).toBeInTheDocument();
    expect(screen.getByText("0.2 of 1 ov")).toBeInTheDocument();
    expect(screen.queryByText(/1st innings ·/i)).not.toBeInTheDocument();
  });

  it("shows the chase in the super over's second innings", () => {
    render(
      <LiveMatchHUD
        match={superOverMatch(4)}
        currentInnings={
          {
            id: "inn-4",
            innings_number: 4,
            total_runs: 5,
            total_wickets: 1,
            total_balls: 3,
            target_runs: 12,
            fall_of_wickets: [],
          } as unknown as Innings
        }
        striker={null}
        nonStriker={null}
        bowler={null}
        lastBalls={[]}
      />,
    );
    expect(screen.getByTestId("chase-equation-title")).toHaveTextContent(
      "Need 7 runs from 3 balls",
    );
    expect(screen.getByText(/Super over · 2nd innings/)).toBeInTheDocument();
  });
});

describe("currentStandOf", () => {
  const stands = [
    { batsman1_id: "a", batsman2_id: "b", wicket_number: 1, runs: 30, balls: 20, is_current: false },
    // Ended by a retirement: no wicket, a new stand after it.
    { batsman1_id: "c", batsman2_id: "b", wicket_number: null, runs: 12, balls: 9, is_current: false },
    // Its balls are the balls the pair faced (a no-ball counts).
    { batsman1_id: "d", batsman2_id: "b", wicket_number: null, runs: 7, balls: 5, is_current: true },
  ];

  it("is the engine's current stand, not the runs since the last wicket", () => {
    expect(currentStandOf({ partnerships: stands }, "b", "d")).toEqual({
      runs: 7,
      balls: 5,
    });
  });

  it("is 0 off 0 for a pair yet to face a ball together", () => {
    expect(currentStandOf({ partnerships: stands }, "b", "e")).toEqual({
      runs: 0,
      balls: 0,
    });
    expect(currentStandOf({ partnerships: [] }, "b", "d")).toEqual({
      runs: 0,
      balls: 0,
    });
    expect(currentStandOf(null, null, null)).toEqual({ runs: 0, balls: 0 });
  });
});

describe("LiveMatchHUD before the chase's first ball", () => {
  it("says nothing of ahead or behind with no rate yet", async () => {
    const { render: r, screen: sc } = await import("@testing-library/react");
    const match = {
      id: "m", status: "live", current_innings: 2, overs_per_innings: 5, balls_per_over: 6,
      team1_id: "a", team2_id: "b", team1: { id: "a", name: "A" }, team2: { id: "b", name: "B" },
      innings: [{ id: "i1", innings_number: 1, team_id: "a", total_runs: 51, total_wickets: 2, total_balls: 30, is_completed: true }],
    } as unknown as Match;
    const chase = { id: "i2", innings_number: 2, team_id: "b", total_runs: 0, total_wickets: 0, total_balls: 0, target_runs: 52, is_completed: false } as unknown as Innings;
    r(
      <LiveMatchHUD match={match} currentInnings={chase} striker={null} nonStriker={null} bowler={null} lastBalls={[]} />,
    );
    expect(sc.getByTestId("chase-equation-title")).toHaveTextContent(/Need 52 runs from 30 balls/);
    expect(sc.queryByText(/an over (ahead|behind)/)).toBeNull();
  });
});
