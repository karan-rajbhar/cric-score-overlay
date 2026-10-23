import { describe, expect, it } from "vitest";
import {
  contrastRatio,
  LEGACY_OVERLAY_THEME_IDS,
  OVERLAY_THEME_IDS,
  OVERLAY_THEMES,
  overlayPalette,
  readableTextOn,
  resolveOverlayTheme,
  type OverlayPalette,
} from "./overlay-themes";

/** Every text-on-colour pair a palette draws. */
const pairs = (p: OverlayPalette): Array<[string, string, string]> => [
  ["bar", p.barText, p.bar],
  ["panel", p.panelText, p.panel],
  ["card", p.cardText, p.card],
  ["card muted", p.cardMuted, p.card],
  ["accent", p.accentText, p.accent],
  ["team 1", p.team1Text, p.team1],
  ["team 2", p.team2Text, p.team2],
];

const AA = 4.5;

describe("overlay themes", () => {
  it("lists the four plain themes first, every theme with a label and description", () => {
    // Broadcast packages follow the plain ones (packages/manifest.ts).
    expect(OVERLAY_THEMES.slice(0, OVERLAY_THEME_IDS.length).map((t) => t.id)).toEqual([
      ...OVERLAY_THEME_IDS,
    ]);
    expect(new Set(OVERLAY_THEMES.map((t) => t.id)).size).toBe(OVERLAY_THEMES.length);
    for (const t of OVERLAY_THEMES) {
      expect(t.label).toMatch(/^[A-Z][a-z]/);
      expect(t.description.length).toBeGreaterThan(10);
    }
  });

  it("maps every old theme id to Standard, unknown ids too", () => {
    for (const id of LEGACY_OVERLAY_THEME_IDS) {
      expect(resolveOverlayTheme(id)).toBe("standard");
    }
    expect(resolveOverlayTheme("Light")).toBe("light");
    expect(resolveOverlayTheme("team")).toBe("team");
    expect(resolveOverlayTheme("neon")).toBe("standard");
    expect(resolveOverlayTheme(null)).toBe("standard");
  });

  it.each(["standard", "light"])("keeps every %s text at AA contrast", (theme) => {
    for (const [what, fg, bg] of pairs(overlayPalette(theme))) {
      expect(contrastRatio(fg, bg), `${theme} ${what}`).toBeGreaterThanOrEqual(AA);
    }
  });

  it("picks readable text for any custom or team colour", () => {
    const colours = [
      "#ffffff", "#000000", "#777777", "#808080", "#ffcc00", "#00ff00",
      "#ff0000", "#0000ff", "#1e3a8a", "#f59e0b", "#ec4899", "#14b8a6",
      "#a3e635", "#7c3aed", "#94a3b8",
    ];
    for (const c of colours) {
      expect(contrastRatio(readableTextOn(c), c), c).toBeGreaterThanOrEqual(AA);
      const custom = overlayPalette("custom", { custom: { primary: c, accent: c } });
      for (const [what, fg, bg] of pairs(custom)) {
        expect(contrastRatio(fg, bg), `custom ${c} ${what}`).toBeGreaterThanOrEqual(AA);
      }
      const team = overlayPalette("team", { team1: { primary: c }, team2: { primary: c } });
      for (const [what, fg, bg] of pairs(team)) {
        expect(contrastRatio(fg, bg), `team ${c} ${what}`).toBeGreaterThanOrEqual(AA);
      }
    }
  });

  it("falls back to Standard for a side without colours", () => {
    const standard = overlayPalette("standard");
    const team = overlayPalette("team", { team1: { primary: "#b91c1c" }, team2: null });
    expect(team.team1).toBe("#b91c1c");
    expect(team.team2).toBe(standard.team2);
    expect(team.bar).toBe(standard.bar);
  });

  it("ignores malformed colours", () => {
    const p = overlayPalette("custom", { custom: { primary: "navy", accent: "#12" } });
    expect(p.bar).toBe(overlayPalette("standard").bar);
  });
});
