import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { EarlierBallsDialog, oversToCorrect } from "./EarlierBallsDialog";

const ball = (over: number, n: number, extra: Record<string, unknown> = {}) => ({
  id: `b${over}.${n}`,
  innings_id: "i1",
  over_number: over,
  ball_number: n,
  seq: over * 10 + n,
  runs_scored: 1,
  extras: 0,
  extra_type: null,
  bowler_id: "w1",
  batsman_id: "a1",
  ...extra,
});

describe("EarlierBallsDialog", () => {
  it("lists this innings' balls by over, latest first, without events", () => {
    const overs = oversToCorrect(
      [
        ball(0, 1),
        ball(0, 2),
        ball(1, 1),
        ball(1, 2, { extra_type: "penalty", bowler_id: null }),
        { ...ball(2, 1), innings_id: "i0" },
      ],
      "i1",
    );
    expect(overs.map((o) => [o.over, o.balls.map((b) => b.id)])).toEqual([
      [1, ["b1.1"]],
      [0, ["b0.1", "b0.2"]],
    ]);
  });

  it("loads the balls when it opens and hands back the one tapped", async () => {
    const onPick = vi.fn();
    render(
      <EarlierBallsDialog
        open
        onOpenChange={vi.fn()}
        inningsId="i1"
        loadBalls={async () => [ball(0, 1), ball(0, 2, { runs_scored: 4 })]}
        onPick={onPick}
      />,
    );
    fireEvent.click(await screen.findByRole("button", { name: "Ball 0.2: Four" }));
    expect(onPick).toHaveBeenCalledWith(expect.objectContaining({ id: "b0.2" }));
  });

  it("says it needs a connection offline", () => {
    const loadBalls = vi.fn();
    render(
      <EarlierBallsDialog
        open
        onOpenChange={vi.fn()}
        inningsId="i1"
        loadBalls={loadBalls}
        onPick={vi.fn()}
        offline
      />,
    );
    expect(screen.getByText(/needs a connection/)).toBeInTheDocument();
    expect(loadBalls).not.toHaveBeenCalled();
  });
});
