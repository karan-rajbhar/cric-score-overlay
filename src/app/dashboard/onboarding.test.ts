import { describe, expect, it } from "vitest";
import { onboardingSteps } from "./onboarding";

describe("onboardingSteps", () => {
  it("sends Add players to the team's squad tab", () => {
    const steps = onboardingSteps({
      teamId: "t1",
      hasPlayers: false,
      matchId: null,
      hasCoScorer: false,
    });
    expect(steps.find((s) => s.id === "players")?.href).toBe(
      "/teams/t1?tab=squad",
    );
  });
});
