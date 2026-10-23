import { describe, expect, it } from "vitest";
import { DEMO_MATCH_STATE } from "~/app/overlay/[matchId]/demo-data";
import { contrastRatio } from "../../overlay-themes";
import {
  DEFAULT_TEAM_COLOURS,
  HB,
  hundredPalette,
  hundredVars,
  swatchOf,
} from "./palette";

const ctx = (team1: string | null, team2: string | null) => ({
  state: {
    ...DEMO_MATCH_STATE,
    team_colors: {
      team1: team1 ? { primary: team1, secondary: null } : null,
      team2: team2 ? { primary: team2, secondary: null } : null,
    },
  },
  theme: "hundred-ball",
  customColors: null,
});

describe("Hundred-ball colours", () => {
  it("puts readable text on every team colour (AA)", () => {
    for (const colour of ["#ffffff", "#fde047", "#0b1a3a", "#0f766e", "#b91c1c", "#7c3aed", "#d9ff2e"]) {
      const s = swatchOf(colour, "#000000");
      expect(contrastRatio(s.bg, s.fg), colour).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("lifts a dark team colour so bars and edges still read on ink", () => {
    const navy = swatchOf("#0b1a3a", "#000000");
    expect(contrastRatio(navy.pop, HB.ink)).toBeGreaterThanOrEqual(3);
    // A colour that already reads keeps itself.
    expect(swatchOf("#d9ff2e", "#000000").pop).toBe("#d9ff2e");
  });

  it("uses each side's own colour, a default where it has none", () => {
    const vars = hundredVars(ctx("#0f766e", null));
    expect(vars["--hb-t1"]).toBe("#0f766e");
    expect(vars["--hb-t2"]).toBe(DEFAULT_TEAM_COLOURS.team2);
    const p = hundredPalette(ctx(null, "#b91c1c"));
    expect(p.team1).toBe(DEFAULT_TEAM_COLOURS.team1);
    expect(p.team2).toBe("#b91c1c");
    expect(p.bar).toBe(HB.ink);
    expect(p.accent).toBe(HB.volt);
  });

  it("keeps the event colours AA with their text", () => {
    const vars = hundredVars(ctx(null, null));
    for (const k of ["four", "six", "wicket", "free", "volt"]) {
      expect(
        contrastRatio(vars[`--hb-${k}`]!, vars[`--hb-${k}-fg`]!),
        k,
      ).toBeGreaterThanOrEqual(4.5);
    }
  });
});
