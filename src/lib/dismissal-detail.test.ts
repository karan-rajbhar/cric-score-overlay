import { describe, expect, it } from "vitest";
import type { FallOfWicket } from "~/lib/match-types";
import { dismissalDetailOf } from "./dismissal-detail";

const entry = (over: Partial<FallOfWicket> = {}): FallOfWicket => ({
  id: "f1",
  match_id: "m",
  innings_id: "i",
  wicket_number: 1,
  runs_at_fall: 40,
  overs_at_fall: 4.4,
  batsman_out_id: "b1",
  dismissal_type: "caught",
  bowler_id: "bw",
  fielder_id: "fl",
  bowler: { id: "bw", full_name: "Jacob Duffy" },
  fielder: { id: "fl", full_name: "Glenn Phillips" },
  ...over,
});

describe("dismissalDetailOf", () => {
  it("describes a catch: the ball, who bowled to whom, the fielder, the score", () => {
    expect(dismissalDetailOf("Sanju Samson", entry())).toEqual({
      over: "4.4",
      headline: "Jacob Duffy to Sanju Samson",
      outcome: "Out, caught by Glenn Phillips",
      score: "40/1 · wicket 1",
    });
  });

  it("says caught and bowled when the bowler took it", () => {
    const d = dismissalDetailOf(
      "A",
      entry({
        fielder_id: "bw",
        fielder: { id: "bw", full_name: "Jacob Duffy" },
      }),
    );
    expect(d?.outcome).toBe("Out, caught and bowled");
  });

  it("covers the other ways out", () => {
    const out = (o: Partial<FallOfWicket>) =>
      dismissalDetailOf("A", entry(o))?.outcome;
    expect(
      out({ dismissal_type: "bowled", fielder: null, fielder_id: null }),
    ).toBe("Out, bowled");
    expect(
      out({ dismissal_type: "lbw", fielder: null, fielder_id: null }),
    ).toBe("Out, LBW");
    expect(out({ dismissal_type: "stumped" })).toBe(
      "Out, stumped by Glenn Phillips",
    );
    expect(out({ dismissal_type: "run_out" })).toBe(
      "Out, run out (Glenn Phillips)",
    );
    expect(
      out({ dismissal_type: "run_out", fielder: null, fielder_id: null }),
    ).toBe("Out, run out");
    expect(out({ dismissal_type: "hit_wicket" })).toBe("Out, hit wicket");
    expect(out({ dismissal_type: "timed_out" })).toBe("Out, timed out");
  });

  it("leaves the bowler out when none is recorded, and has nothing without an entry", () => {
    const d = dismissalDetailOf("A", entry({ bowler: null, bowler_id: null }));
    expect(d?.headline).toBe("A");
    expect(dismissalDetailOf("A", undefined)).toBeNull();
  });

  it("takes the batter's own recorded type over the entry's", () => {
    expect(dismissalDetailOf("A", entry(), "bowled")?.outcome).toBe(
      "Out, bowled",
    );
  });
});
