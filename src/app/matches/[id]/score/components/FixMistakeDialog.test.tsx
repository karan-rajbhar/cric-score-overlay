import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { TeamPlayer } from "~/lib/match-types";
import {
  FixMistakeDialog,
  oversToCorrect,
  type FixInnings,
  type FixTeam,
  type LoggedBall,
} from "./FixMistakeDialog";

const ball = (
  over: number,
  n: number,
  extra: Partial<LoggedBall> & Record<string, unknown> = {},
): LoggedBall =>
  ({
    id: `b${over}.${n}`,
    innings_id: "i2",
    over_number: over,
    ball_number: n,
    seq: over * 10 + n,
    runs_scored: 1,
    extras: 0,
    extra_type: null,
    is_wicket: false,
    dismissal_type: null,
    dismissed_player_id: null,
    fielder_id: null,
    bowler_id: "w1",
    batsman_id: "a",
    non_striker_id: "b",
    ...extra,
  }) as LoggedBall;

/**
 * A chase as on 15 November: Sandeep sir (a) and Vinayak (b) open, the
 * third ball is caught and given to Vinayak, Mahesh (c) comes in.
 */
const chase = (): LoggedBall[] => [
  ball(0, 1, { batsman_id: "a", non_striker_id: "b", runs_scored: 1 }),
  ball(0, 2, { batsman_id: "b", non_striker_id: "a", runs_scored: 4 }),
  ball(0, 3, {
    batsman_id: "b",
    non_striker_id: "a",
    runs_scored: 0,
    is_wicket: true,
    dismissal_type: "caught",
    fielder_id: "f1",
  }),
  ball(0, 4, { batsman_id: "c", non_striker_id: "a", runs_scored: 0 }),
  ball(1, 1, { batsman_id: "a", non_striker_id: "c", runs_scored: 2, bowler_id: "w2" }),
  ball(1, 2, { batsman_id: "a", non_striker_id: "c", runs_scored: 1, bowler_id: "w2" }),
  // The first innings, to switch to.
  ball(0, 1, { id: "x0.1", innings_id: "i1", batsman_id: "w1", non_striker_id: "w2", bowler_id: "a" }),
];

const player = (team: string, id: string, name: string): TeamPlayer => ({
  id: `tp_${id}`,
  team_id: team,
  user_id: id,
  user: { id, full_name: name } as TeamPlayer["user"],
});

const teams: FixTeam[] = [
  {
    id: "ta",
    name: "Vinayak 11",
    players: [
      player("ta", "a", "Sandeep sir"),
      player("ta", "b", "Vinayak"),
      player("ta", "c", "Mahesh"),
    ],
  },
  {
    id: "tb",
    name: "Omkar 11",
    players: [
      player("tb", "w1", "Kishor"),
      player("tb", "w2", "Karan"),
      player("tb", "f1", "Abhi"),
    ],
  },
];

const innings: FixInnings[] = [
  { id: "i1", number: 1, teamId: "tb", label: "1st innings · Omkar 11" },
  { id: "i2", number: 2, teamId: "ta", label: "2nd innings · Vinayak 11" },
];

const rules = {
  id: "M",
  balls_per_over: 6,
  max_balls_per_over: null,
  wide_runs_to_batsman: false,
  noball_extras_to_batsman: false,
  wide_counts_as_ball_faced: false,
  noball_counts_as_ball_faced: true,
};

function open(props: Partial<React.ComponentProps<typeof FixMistakeDialog>> = {}) {
  const handlers = {
    onOpenChange: vi.fn(),
    onEditBall: vi.fn(),
    onSwapBatters: vi.fn(async () => ({ error: null })),
    onCorrectOverBowler: vi.fn(async () => ({ error: null })),
  };
  render(
    <FixMistakeDialog
      open
      innings={innings}
      defaultInningsId="i2"
      teams={teams}
      rules={rules}
      loadBalls={async () => chase()}
      {...handlers}
      {...props}
    />,
  );
  return handlers;
}

describe("FixMistakeDialog", () => {
  it("lists an innings' balls by over, latest first, without events", () => {
    const overs = oversToCorrect(
      [
        ball(0, 1),
        ball(0, 2),
        ball(1, 1),
        ball(1, 2, { extra_type: "penalty", bowler_id: null }),
        { ...ball(2, 1), innings_id: "i0" },
      ],
      "i2",
    );
    expect(overs.map((o) => [o.over, o.balls.map((b) => b.id)])).toEqual([
      [1, ["b1.1"]],
      [0, ["b0.1", "b0.2"]],
    ]);
  });

  it("edits a ball with the side that batted in its innings", async () => {
    const { onEditBall } = open();
    fireEvent.click(await screen.findByRole("button", { name: "Ball 0.2: Four" }));
    fireEvent.click(screen.getByRole("button", { name: /Edit this ball/ }));
    expect(onEditBall).toHaveBeenCalledWith(
      expect.objectContaining({ id: "b0.2" }),
      "ta",
      expect.arrayContaining([expect.objectContaining({ id: "b0.2" })]),
    );
  });

  it("swaps the batters from a ball, refusing a range that leaves one in after being out", async () => {
    const { onSwapBatters } = open();
    fireEvent.click(await screen.findByRole("button", { name: /Ball 0\.1/ }));
    fireEvent.click(
      screen.getByRole("button", { name: /The batters were at the wrong ends/ }),
    );
    const confirm = screen.getByRole("button", { name: "Swap them" });
    // Nothing is chosen for the scorer.
    expect(confirm).toBeDisabled();

    // To the end of the over: the wicket moves to Sandeep sir, who then bats on.
    fireEvent.click(screen.getByRole("radio", { name: /The end of this over/ }));
    expect(screen.getByRole("alert")).toHaveTextContent(/after they were out/);
    expect(confirm).toBeDisabled();

    fireEvent.click(screen.getByRole("radio", { name: /The end of the innings/ }));
    expect(screen.queryByRole("alert")).toBeNull();
    fireEvent.click(confirm);
    expect(onSwapBatters).toHaveBeenCalledWith({
      inningsId: "i2",
      fromBallId: "b0.1",
      toBallId: null,
    });
  });

  it("gives a wicket to the other batter, showing the figures that change", async () => {
    const { onSwapBatters, onOpenChange } = open({
      start: { inningsId: "i2", ballId: "b0.3", mode: "wrong_batter_out" },
    });
    expect(
      await screen.findByText("The wrong batter was given out"),
    ).toBeInTheDocument();
    const changes = screen.getByText("What changes").parentElement!;
    expect(within(changes).getByText(/Sandeep sir: 4\* \(3\)/)).toHaveTextContent(
      "1 (2), caught",
    );
    expect(within(changes).getByText(/Vinayak: 4 \(2\), caught/)).toHaveTextContent(
      "7* (3)",
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Give the wicket to Sandeep sir" }),
    );
    expect(onSwapBatters).toHaveBeenCalledWith({
      inningsId: "i2",
      fromBallId: "b0.3",
      toBallId: null,
    });
    await vi.waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
  });

  it("gives a whole over to the bowler who bowled it", async () => {
    const { onCorrectOverBowler } = open();
    fireEvent.click(
      await screen.findByRole("button", { name: "Change the bowler of over 2" }),
    );
    expect(screen.getByRole("button", { name: "Choose who bowled" })).toBeDisabled();
    fireEvent.click(screen.getByRole("radio", { name: "Kishor" }));
    const changes = screen.getByText("What changes").parentElement!;
    expect(within(changes).getByText(/Karan \(bowling\)/)).toHaveTextContent(
      "0.2-0-3-0",
    );
    fireEvent.click(screen.getByRole("button", { name: "Give over 2 to Kishor" }));
    expect(onCorrectOverBowler).toHaveBeenCalledWith({
      inningsId: "i2",
      overNumber: 1,
      bowlerId: "w1",
    });
  });

  it("switches to another innings", async () => {
    open();
    fireEvent.click(await screen.findByRole("radio", { name: "1st innings · Omkar 11" }));
    expect(screen.getByText(/Over 1 · Sandeep sir/)).toBeInTheDocument();
  });

  it("opens on a ball's choices from the Balls view; Back closes it", async () => {
    const h = open({ start: { inningsId: "i2", ballId: "b0.3", mode: "ball" } });
    expect(await screen.findByRole("button", { name: /Edit this ball/ })).toBeInTheDocument();
    expect(screen.queryByRole("group", { name: "Innings" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(h.onOpenChange).toHaveBeenCalledWith(false);
  });

  it("opens on an over's bowler from the Balls view", async () => {
    open({ start: { inningsId: "i2", over: 1, mode: "bowler" } });
    expect(await screen.findByText(/over 2/i)).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /Kishor/ })).toBeInTheDocument();
  });

  it("says it needs a connection offline", () => {
    const loadBalls = vi.fn();
    open({ loadBalls, offline: true });
    expect(screen.getByText(/needs a connection/)).toBeInTheDocument();
    expect(loadBalls).not.toHaveBeenCalled();
  });
});
