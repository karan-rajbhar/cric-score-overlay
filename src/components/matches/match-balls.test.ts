import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { deliveryLabel } from "~/lib/cricket";
import type { BallEvent } from "~/lib/match-types";
import { outcomeOf } from "./match-balls";

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
