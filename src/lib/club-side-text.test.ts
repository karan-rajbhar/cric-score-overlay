import { describe, expect, it } from "vitest";
import { clubSideOptions, clubStatsFact, possessive } from "./club-side-text";

describe("club side wording", () => {
  it("makes possessives of team names", () => {
    expect(possessive("Lions")).toBe("Lions'");
    expect(possessive("Riverside CC")).toBe("Riverside CC's");
  });

  it("offers both teams or one, saying who is left out", () => {
    expect(clubSideOptions("Lions", "Tigers")).toEqual([
      {
        value: "both",
        label: "Both teams",
        description: "Everyone's stats count: both teams are club players.",
      },
      {
        value: "team1",
        label: "Only Lions",
        description:
          "The other team, Tigers, is from outside the club. Its players keep their own stats.",
      },
      {
        value: "team2",
        label: "Only Tigers",
        description:
          "The other team, Lions, is from outside the club. Its players keep their own stats.",
      },
    ]);
  });

  it("states the choice on the match page", () => {
    expect(clubStatsFact(null, "Lions", "Tigers")).toEqual({
      counts: "Both teams",
      outside: null,
    });
    expect(clubStatsFact("team1", "Lions", "Tigers")).toEqual({
      counts: "Only Lions",
      outside: "Tigers",
    });
    expect(clubStatsFact("team2", "Lions", "Tigers")).toEqual({
      counts: "Only Tigers",
      outside: "Lions",
    });
  });
});
