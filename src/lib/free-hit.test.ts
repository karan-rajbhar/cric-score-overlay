import { describe, expect, it } from "vitest";
import { freeHitsOn, nextIsFreeHit } from "./free-hit";

const legal = { extra_type: null };
const noBall = { extra_type: "no_ball" };
const wide = { extra_type: "wide" };

describe("free hits", () => {
  it("are on unless the match switched them off", () => {
    expect(freeHitsOn({})).toBe(true);
    expect(freeHitsOn({ free_hit: null })).toBe(true);
    expect(freeHitsOn({ free_hit: true })).toBe(true);
    expect(freeHitsOn({ free_hit: false })).toBe(false);
  });

  it("follow a no-ball, and end with the next legal ball", () => {
    expect(nextIsFreeHit([legal, noBall])).toBe(true);
    expect(nextIsFreeHit([noBall, legal])).toBe(false);
    expect(nextIsFreeHit([legal])).toBe(false);
    expect(nextIsFreeHit([])).toBe(false);
  });

  it("carry on through a wide or another no-ball on the free-hit ball", () => {
    expect(nextIsFreeHit([noBall, wide])).toBe(true);
    expect(nextIsFreeHit([noBall, noBall])).toBe(true);
    expect(nextIsFreeHit([noBall, wide, wide])).toBe(true);
    expect(nextIsFreeHit([noBall, wide, legal])).toBe(false);
    // A wide alone is not a free hit.
    expect(nextIsFreeHit([legal, wide])).toBe(false);
  });

  it("ignore events between balls (retirements, runs awarded)", () => {
    const retired = {
      extra_type: null,
      is_wicket: true,
      dismissal_type: "retired_hurt",
    };
    const penalty = { extra_type: "penalty" };
    expect(nextIsFreeHit([noBall, retired])).toBe(true);
    expect(nextIsFreeHit([noBall, penalty])).toBe(true);
  });

  it("never apply when the match plays without them", () => {
    expect(nextIsFreeHit([noBall], false)).toBe(false);
  });
});
