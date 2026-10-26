import { describe, expect, it } from "vitest";
import { cleanPlayerDetails, playerDetailLine } from "./player-profile";

describe("cleanPlayerDetails", () => {
  it("trims the location and clears empty choices", () => {
    expect(
      cleanPlayerDetails({ location: "  Pune   city ", playing_role: "" }),
    ).toEqual({
      ok: true,
      value: {
        location: "Pune city",
        playing_role: null,
        batting_hand: null,
        bowling_style: null,
      },
    });
  });

  it("accepts listed options", () => {
    const r = cleanPlayerDetails({
      playing_role: "all_rounder",
      batting_hand: "left",
      bowling_style: "left_arm_orthodox",
    });
    expect(r.ok && r.value.batting_hand).toBe("left");
  });

  it("refuses values that are not listed", () => {
    expect(cleanPlayerDetails({ batting_hand: "both" }).ok).toBe(false);
    expect(cleanPlayerDetails({ playing_role: "umpire" }).ok).toBe(false);
  });

  it("refuses a very long location", () => {
    expect(cleanPlayerDetails({ location: "x".repeat(61) }).ok).toBe(false);
  });
});

describe("playerDetailLine", () => {
  it("joins what is set and skips the rest", () => {
    expect(
      playerDetailLine(
        { batting_hand: "right", bowling_style: null, location: "Pune" },
        ["@karan", null],
      ),
    ).toBe("Right-hand bat · Pune · @karan");
    expect(playerDetailLine({})).toBe("");
  });
});
