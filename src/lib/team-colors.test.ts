import { describe, expect, it } from "vitest";
import {
  contrastRatio,
  parseTeamColor,
  TEAM_COLOR_SWATCHES,
  textOn,
} from "./team-colors";

describe("parseTeamColor", () => {
  it("accepts #rrggbb, lower-cased, and empty as cleared", () => {
    expect(parseTeamColor("#1A2B3C")).toEqual({ ok: true, value: "#1a2b3c" });
    expect(parseTeamColor(" #ffffff ")).toEqual({ ok: true, value: "#ffffff" });
    expect(parseTeamColor("")).toEqual({ ok: true, value: null });
    expect(parseTeamColor(null)).toEqual({ ok: true, value: null });
  });

  it("rejects anything else", () => {
    for (const bad of ["red", "#fff", "123456", "#12345g", "#1234567", 7]) {
      expect(parseTeamColor(bad).ok).toBe(false);
    }
  });
});

describe("contrast", () => {
  it("measures black on white as 21:1", () => {
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 0);
  });

  it("picks the more readable text colour", () => {
    expect(textOn("#facc15").best).toBe("#242267");
    expect(textOn("#1e3a8a").best).toBe("#ffffff");
  });

  it("offers twelve valid swatches", () => {
    expect(TEAM_COLOR_SWATCHES).toHaveLength(12);
    for (const s of TEAM_COLOR_SWATCHES) {
      expect(parseTeamColor(s.hex)).toEqual({ ok: true, value: s.hex });
    }
  });
});
