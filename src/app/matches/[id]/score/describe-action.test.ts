import { describe, expect, it } from "vitest";
import type { QueuedAction } from "~/lib/offline-queue";
import { describeQueuedAction } from "./describe-action";

const names: Record<string, string> = {
  w1: "Starc",
  a1: "Kohli",
  t1: "Kent",
};
const nameOf = (id: string | null | undefined) => (id ? names[id] : null) ?? null;
const ball = (event: Record<string, unknown>) =>
  ({
    queueId: "q",
    matchId: "m",
    enqueuedAt: 0,
    type: "recordBall",
    payload: {
      matchId: "m",
      bowlerId: "w1",
      batsmanId: "a1",
      nonStrikerId: "a2",
      event,
    },
  }) as QueuedAction;

describe("describeQueuedAction", () => {
  it("names the ball and the players", () => {
    expect(describeQueuedAction(ball({ runsScored: 4 }), nameOf)).toBe(
      "Four, Starc to Kohli",
    );
    expect(
      describeQueuedAction(
        ball({ isWicket: true, dismissalType: "caught" }),
        nameOf,
      ),
    ).toBe("Wicket (caught), Starc to Kohli");
    expect(
      describeQueuedAction(
        ball({ extraType: "no_ball", extras: 3, noBallRuns: "bye" }),
        nameOf,
      ),
    ).toBe("No ball + 2 byes, Starc to Kohli");
  });

  it("names the team runs are awarded to", () => {
    expect(
      describeQueuedAction(
        {
          queueId: "q",
          matchId: "m",
          enqueuedAt: 0,
          type: "awardPenalty",
          payload: { teamId: "t1", runs: 5, reason: "x", type: "penalty" },
        },
        nameOf,
      ),
    ).toBe("5 penalty runs to Kent");
  });
});
