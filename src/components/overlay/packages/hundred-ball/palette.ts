/**
 * The Hundred-ball colours: near-black ink, white paper, one volt accent,
 * flat team colours and a colour per event (four, six, wicket, free hit).
 *
 * Text on any colour is picked for contrast (WCAG AA); a team colour that
 * would vanish on the ink panels gets a lighter "pop" tone for bars and
 * edges, and its own darker tone for the stacked-block depth.
 */

import {
  contrastRatio,
  parseHex,
  readableTextOn,
  shade,
  withAlpha,
  type OverlayPalette,
} from "../../overlay-themes";
import type { PaletteContext } from "../types";

export const HB = {
  ink: "#0d0e14",
  ink2: "#1b1d27",
  ink3: "#30333f",
  paper: "#ffffff",
  paper2: "#eceef4",
  /** Secondary text on paper (8.9:1). */
  paperMuted: "#4a4d5c",
  /** Secondary text on ink (10:1). */
  inkMuted: "rgba(255, 255, 255, 0.74)",
  volt: "#d9ff2e",
  four: "#1f5bff",
  six: "#d6157f",
  wicket: "#e0241b",
  free: "#ff9b1a",
} as const;

/** Each side's colour when the team has none. */
export const DEFAULT_TEAM_COLOURS = {
  team1: "#3a2bff",
  team2: "#ff5a1f",
} as const;

export interface Swatch {
  bg: string;
  fg: string;
  muted: string;
  /** Darker tone: the stacked block behind. */
  deep: string;
  /** A tone that reads on the ink panels (bars, edges). */
  pop: string;
}

/** A colour's text, depth and on-ink tones. */
export function swatchOf(colour: string | null | undefined, fallback: string): Swatch {
  const bg = parseHex(colour) ? colour! : fallback;
  const fg = readableTextOn(bg);
  let pop = bg;
  for (let t = 0.15; contrastRatio(pop, HB.ink) < 3 && t <= 0.9; t += 0.15) {
    pop = shade(bg, t);
  }
  return {
    bg,
    fg,
    muted: withAlpha(fg, 0.78),
    deep: shade(bg, -0.45),
    pop,
  };
}

function teamSwatches(ctx: PaletteContext) {
  const colours = ctx.state?.team_colors;
  return {
    t1: swatchOf(colours?.team1?.primary, DEFAULT_TEAM_COLOURS.team1),
    t2: swatchOf(colours?.team2?.primary, DEFAULT_TEAM_COLOURS.team2),
  };
}

/** The `--ov-*` palette (OverlayFrame and anything reading it). */
export function hundredPalette(ctx: PaletteContext): OverlayPalette {
  const { t1, t2 } = teamSwatches(ctx);
  return {
    bar: HB.ink,
    barText: "#ffffff",
    barMuted: HB.inkMuted,
    panel: HB.ink2,
    panelText: "#ffffff",
    panelMuted: HB.inkMuted,
    card: HB.paper,
    cardText: HB.ink,
    cardMuted: HB.paperMuted,
    cardLine: "#dfe2ea",
    accent: HB.volt,
    accentText: HB.ink,
    line: withAlpha("#ffffff", 0.14),
    shadow: "0 12px 28px rgba(0, 0, 0, 0.4)",
    team1: t1.bg,
    team1Text: t1.fg,
    team2: t2.bg,
    team2Text: t2.fg,
  };
}

/** The package's own variables (`--hb-*`). */
export function hundredVars(ctx: PaletteContext): Record<string, string> {
  const { t1, t2 } = teamSwatches(ctx);
  const side = (k: string, s: Swatch) => ({
    [`--hb-${k}`]: s.bg,
    [`--hb-${k}-fg`]: s.fg,
    [`--hb-${k}-muted`]: s.muted,
    [`--hb-${k}-deep`]: s.deep,
    [`--hb-${k}-pop`]: s.pop,
  });
  const event = (k: string, colour: string) => side(k, swatchOf(colour, colour));
  return {
    "--hb-ink": HB.ink,
    "--hb-ink2": HB.ink2,
    "--hb-ink3": HB.ink3,
    "--hb-paper": HB.paper,
    "--hb-paper2": HB.paper2,
    "--hb-paper-muted": HB.paperMuted,
    "--hb-ink-muted": HB.inkMuted,
    ...side("t1", t1),
    ...side("t2", t2),
    ...event("volt", HB.volt),
    ...event("four", HB.four),
    ...event("six", HB.six),
    ...event("wicket", HB.wicket),
    ...event("free", HB.free),
    "--hb-ease": "cubic-bezier(0.16, 1, 0.3, 1)",
  };
}
