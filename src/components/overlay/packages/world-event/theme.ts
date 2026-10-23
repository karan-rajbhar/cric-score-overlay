/**
 * World event colours: deep midnight panels, crisp white panels, one strong
 * event accent (magenta into violet) and each side in its own team colour.
 *
 * Pure: the package's palette (`--ov-*`, for anything drawn by Standard),
 * its own variables (`--we-*`) and the contrast rules behind them. Every
 * text colour is checked against the colour it sits on (WCAG AA 4.5:1);
 * a team colour used as a stripe or a marker is pushed until it reads
 * against the panel it sits on (3:1, the non-text minimum).
 */

import {
  contrastRatio,
  parseHex,
  readableTextOn,
  shade,
  withAlpha,
  type OverlayPalette,
} from "../../overlay-themes";
import type { LiveTeamColours } from "~/lib/firebase/types";
import type { PaletteContext } from "../types";

/** The package's fixed colours. */
export const WE = {
  /** Midnight panels (deep indigo), top and bottom of their gradient. */
  night: "#140a4f",
  nightTop: "#2a1585",
  nightDeep: "#0a0532",
  /** Raised strips on a midnight panel. */
  night2: "#22137a",
  /** White panels and their lavender lower edge. */
  paper: "#ffffff",
  paperLow: "#ebe8f8",
  ink: "#120a3d",
  inkMuted: "#4f4a72",
  /** The event accent (magenta into violet). */
  accent: "#dc0078",
  accentEnd: "#6a1fd0",
  /** Mint: powerplay, boundary four, the strike marker. */
  mint: "#19e0b4",
  /** Awards and milestones. */
  gold: "#ffc629",
  /** Deliveries. */
  four: "#19e0b4",
  six: "#dc0078",
  wicket: "#d4142a",
  extra: "#ffb020",
} as const;

/** Team colours when a side has none: two event tones that never clash. */
export const DEFAULT_TEAM = ["#2f6fe4", "#0f8a7a"] as const;

export interface TeamTone {
  /** The team's colour as a panel. */
  base: string;
  /** Text on `base` (AA). */
  text: string;
  /** Its lighter and darker ends, for gradients. */
  hi: string;
  deep: string;
  /** A version that reads as a stripe on white (3:1). */
  onLight: string;
  /** A version that reads as a stripe on the midnight panels (3:1). */
  onDark: string;
}

/** Move `hex` towards black or white until it reaches `ratio` against `bg`. */
export function pushUntil(
  hex: string,
  bg: string,
  ratio: number,
  direction: -1 | 1,
): string {
  let out = hex;
  for (let step = 0; step <= 20 && contrastRatio(out, bg) < ratio; step++) {
    out = shade(hex, direction * step * 0.05);
  }
  return out;
}

/**
 * A side's colours from its primary colour. Stripes and bars keep the
 * team's own hue, darkened on white or lightened on midnight until they
 * read (a pale yellow side gets an ochre stripe, a deep red one a coral
 * bar), so a team is always recognisable by its colour.
 */
export function teamTone(
  colours: LiveTeamColours | null | undefined,
  fallback: string,
): TeamTone {
  const primary = parseHex(colours?.primary) ? colours!.primary! : fallback;
  return {
    base: primary,
    text: readableTextOn(primary),
    hi: shade(primary, 0.16),
    deep: shade(primary, -0.38),
    onLight: pushUntil(primary, WE.paper, 3, -1),
    onDark: pushUntil(primary, WE.night, 3, 1),
  };
}

/** Both sides' tones for a match (team 1, team 2). */
export function teamTones(ctx: Pick<PaletteContext, "state">): [TeamTone, TeamTone] {
  const colours = ctx.state?.team_colors;
  return [
    teamTone(colours?.team1, DEFAULT_TEAM[0]),
    teamTone(colours?.team2, DEFAULT_TEAM[1]),
  ];
}

/** The `--ov-*` palette: what a Standard component would draw with. */
export function worldEventPalette(ctx: PaletteContext): OverlayPalette {
  const [t1, t2] = teamTones(ctx);
  return {
    bar: WE.night,
    barText: WE.paper,
    barMuted: withAlpha(WE.paper, 0.74),
    panel: WE.night2,
    panelText: WE.paper,
    panelMuted: withAlpha(WE.paper, 0.74),
    card: WE.paper,
    cardText: WE.ink,
    cardMuted: WE.inkMuted,
    cardLine: "#dfe2ee",
    accent: WE.accent,
    accentText: readableTextOn(WE.accent),
    line: withAlpha(WE.paper, 0.16),
    shadow: "0 18px 40px rgba(4, 5, 24, 0.45)",
    team1: t1.base,
    team1Text: t1.text,
    team2: t2.base,
    team2Text: t2.text,
  };
}

/** The package's own variables: each side's tones. */
export function worldEventVars(ctx: PaletteContext): Record<string, string> {
  const vars: Record<string, string> = {};
  teamTones(ctx).forEach((t, i) => {
    const n = i + 1;
    vars[`--we-t${n}`] = t.base;
    vars[`--we-t${n}-text`] = t.text;
    vars[`--we-t${n}-hi`] = t.hi;
    vars[`--we-t${n}-deep`] = t.deep;
    vars[`--we-t${n}-light`] = t.onLight;
    vars[`--we-t${n}-dark`] = t.onDark;
  });
  return vars;
}

/** CSS custom properties naming a side's tones (`side` 1 or 2). */
export function sideVars(side: 1 | 2): Record<string, string> {
  return {
    "--we-side": `var(--we-t${side})`,
    "--we-side-text": `var(--we-t${side}-text)`,
    "--we-side-hi": `var(--we-t${side}-hi)`,
    "--we-side-deep": `var(--we-t${side}-deep)`,
    "--we-side-light": `var(--we-t${side}-light)`,
    "--we-side-dark": `var(--we-t${side}-dark)`,
  };
}

export type BallTone = "dot" | "run" | "four" | "six" | "wicket" | "extra";

/**
 * A delivery token of `live_state.this_over_balls` ("0", "1", "4", "6",
 * "W", "wd", "2+wd", "nb", "4+nb", "nb+1lb") as its tone.
 */
export function ballTone(token: string): BallTone {
  if (token === "W") return "wicket";
  if (/wd|nb/.test(token)) return "extra";
  if (token === "4") return "four";
  if (token === "6") return "six";
  if (token === "0") return "dot";
  return "run";
}
