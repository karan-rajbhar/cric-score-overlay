import { describe, expect, it } from "vitest";
import { parseReplayAction } from "./schemas";

const action = (type: string, payload: unknown) => ({
  id: "q1",
  type,
  payload,
  queuedAt: 0,
});

const ball = (event: Record<string, unknown>) =>
  action("recordBall", {
    bowlerId: "w1",
    batsmanId: "a1",
    nonStrikerId: "a2",
    event,
  });

describe("v1 replay payloads (optional fields need no new version)", () => {
  it("accepts a ball with or without byes off a no-ball", () => {
    expect(parseReplayAction("m1", ball({ runsScored: 4 })).ok).toBe(true);
    const res = parseReplayAction(
      "m1",
      ball({ extraType: "no_ball", extras: 3, noBallRuns: "bye" }),
    );
    expect(res).toMatchObject({
      ok: true,
      action: { payload: { event: { noBallRuns: "bye" } } },
    });
    expect(
      parseReplayAction("m1", ball({ extraType: "no_ball", noBallRuns: "wide" }))
        .ok,
    ).toBe(false);
  });

  it("accepts a ball correction from an older client and one with the fielder", () => {
    const old = {
      ballId: "b1",
      runsScored: 0,
      extras: 0,
      isWicket: true,
      dismissalType: "caught",
    };
    expect(parseReplayAction("m1", action("updateBall", old)).ok).toBe(true);
    expect(
      parseReplayAction(
        "m1",
        action("updateBall", {
          ...old,
          fielderId: "f1",
          dismissedPlayerId: "a1",
          noBallRuns: null,
        }),
      ),
    ).toMatchObject({
      ok: true,
      action: { payload: { fielderId: "f1", dismissedPlayerId: "a1" } },
    });
  });
});
