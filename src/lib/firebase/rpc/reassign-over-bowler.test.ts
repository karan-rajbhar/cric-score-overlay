import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  GoldenReplay,
  SYNTHETIC_ROSTERS,
  syntheticTables,
} from "../scoring/__fixtures__/golden";
import { stage2Driver } from "../scoring/__fixtures__/stage2";
import type { OversRow } from "../scorecard";
import { overBowlingOf } from "../scoring/ball-docs";
import type { BowlingPerformancesRow, InningsRow } from "../types";
import { setCurrentBowler } from "./scoring";

const [a, b, c] = SYNTHETIC_ROSTERS.TB.slice(-3) as [string, string, string];

function started() {
  const side = stage2Driver(syntheticTables({ overs_per_innings: 5 }), true);
  const replay = new GoldenReplay(side, "M", SYNTHETIC_ROSTERS);
  const innings = () =>
    (side.ds.all("innings") as unknown as InningsRow[]).find(
      (i) => i.id === "INN1",
    )!;
  const bowling = () => (innings().bowling ?? []) as BowlingPerformancesRow[];
  const figures = (id: string) => bowling().find((r) => r.user_id === id);
  const balls = () =>
    (side.ds.all("overs") as unknown as OversRow[])
      .filter((o) => o.innings_id === "INN1")
      .flatMap((o) => o.balls);
  const bowl = async (bowler: string, ...runs: number[]) => {
    for (const r of runs) {
      await replay.step({ kind: "ball", ball: { runs: r, bowler } });
    }
  };
  return { side, replay, innings, figures, balls, bowl };
}

describe("overBowlingOf", () => {
  const ball = (bowler_id: string | null, extra_type?: string) => ({
    over_number: 2,
    bowler_id,
    extra_type,
  });

  it("is the over's latest bowler and their balls, not the one before", () => {
    expect(
      overBowlingOf([ball("a"), ball("a"), ball("b", "wide"), ball("b")], 2),
    ).toEqual({ bowlerId: "b", balls: 2 });
  });

  it("skips other overs and what is not a delivery", () => {
    expect(
      overBowlingOf(
        [
          { ...ball("z"), over_number: 1 },
          ball("a"),
          ball(null),
          ball("b", "penalty"),
          ball("b", "bonus"),
        ],
        2,
      ),
    ).toEqual({ bowlerId: "a", balls: 1 });
  });

  it("is null before the over's first delivery", () => {
    expect(overBowlingOf([{ ...ball("a"), over_number: 1 }], 2)).toBeNull();
  });
});

describe("reassign_over_bowler", () => {
  it("gives the wrong bowler's balls in the over to the right one", async () => {
    const { side, innings, figures, bowl } = started();
    await bowl(a, 1, 4, 0);
    const total = innings().total_runs;

    await side.reassignBowler("M", b);

    expect(figures(b)).toMatchObject({
      balls_bowled: 3,
      runs_conceded: 5,
      is_current_bowler: true,
    });
    // The wrong bowler never bowled: no row left behind.
    expect(figures(a)).toBeUndefined();
    expect(innings().total_runs).toBe(total);
    expect(innings().total_balls).toBe(3);
  });

  it("leaves the wrong bowler's earlier overs alone", async () => {
    const { side, figures, bowl } = started();
    await bowl(a, 0, 0, 0, 0, 0, 0);
    await bowl(b, 0, 0, 0, 0, 0, 0);
    await bowl(a, 2, 2);

    await side.reassignBowler("M", c);

    expect(figures(a)).toMatchObject({ balls_bowled: 6, runs_conceded: 0 });
    expect(figures(c)).toMatchObject({ balls_bowled: 2, runs_conceded: 4 });
  });

  it("keeps a retirement in the over an event, not a ball", async () => {
    const { side, replay, innings, figures, balls, bowl } = started();
    await bowl(a, 1, 1);
    await replay.step({ kind: "retire", who: "striker", type: "retired_hurt" });
    await bowl(a, 1);
    const retirement = () =>
      balls().find((x) => x.dismissal_type === "retired_hurt")!;
    expect(retirement().bowler_id ?? null).toBeNull();

    await side.reassignBowler("M", b);

    expect(innings().total_balls).toBe(3);
    expect(figures(b)).toMatchObject({ balls_bowled: 3, runs_conceded: 3 });
    expect(retirement().bowler_id ?? null).toBeNull();
  });

  it("leaves an injured bowler's balls when their replacement was the wrong pick", async () => {
    const { side, figures, bowl } = started();
    await bowl(a, 1, 1, 1);
    await bowl(b, 4);

    await side.reassignBowler("M", c);

    expect(figures(a)).toMatchObject({ balls_bowled: 3, runs_conceded: 3 });
    expect(figures(c)).toMatchObject({
      balls_bowled: 1,
      runs_conceded: 4,
      is_current_bowler: true,
    });
    expect(figures(b)).toBeUndefined();
  });

  it("fills in a bowler brought on with none of the over's balls", async () => {
    const { side, figures, bowl } = started();
    await bowl(a, 1, 4, 0);
    // The change that left the new bowler on 0 balls.
    await setCurrentBowler(side.ctx, "M", b);
    expect(figures(b)).toMatchObject({ balls_bowled: 0 });

    await side.reassignBowler("M", b);

    expect(figures(b)).toMatchObject({
      balls_bowled: 3,
      runs_conceded: 5,
      is_current_bowler: true,
    });
    expect(figures(a)).toBeUndefined();
  });

  it("moves a wide in an over with no legal ball yet", async () => {
    const { side, replay, figures, bowl } = started();
    await bowl(a, 0, 0, 0, 0, 0, 0);
    await replay.step({
      kind: "ball",
      ball: { runs: 0, extras: 1, extraType: "wide", bowler: b },
    });

    await side.reassignBowler("M", c);

    expect(figures(c)).toMatchObject({
      balls_bowled: 0,
      wides: 1,
      runs_conceded: 1,
      is_current_bowler: true,
    });
    expect(figures(b)).toBeUndefined();
    expect(figures(a)).toMatchObject({ balls_bowled: 6 });
  });
});
