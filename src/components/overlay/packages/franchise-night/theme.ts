/**
 * Franchise night's colours: dark glass panels lit by the teams' colours,
 * with one gold accent. Pure (no React), so the palette, the package's
 * CSS variables and the tests share it.
 *
 * Team colours come from `live_state.team_colors` (the match's team
 * snapshots). A side without one gets a strong default (royal blue for
 * team 1, saffron for team 2); a colour too dark to read on the glass is
 * lifted for edges and glows; text on a team colour is picked for
 * contrast (AA).
 */

import {
  contrastRatio,
  luminance,
  parseHex,
  readableTextOn,
  shade,
  withAlpha,
  type OverlayPalette,
} from "../../overlay-themes";
import type { LiveMatchState } from "../../types";

/** The glass, gold and state colours (fixed: the look of the package). */
export const FN = {
  /** Deepest glass, the bottom of a panel. */
  ink: "#05070c",
  /** Panel glass, top to bottom. */
  glassTop: "#1d2232",
  glassMid: "#121624",
  glassLow: "#090b13",
  /** Rows on cards. */
  row: "#151a28",
  rowAlt: "#10141f",
  gold: "#ffc531",
  goldDeep: "#c98a00",
  goldText: "#1c1300",
  white: "#ffffff",
  /** Secondary text on glass (AA on every glass tone). */
  muted: "#b9c0d4",
  /** Hairlines on glass. */
  line: "rgba(255, 255, 255, 0.14)",
  four: "#1f8fff",
  six: "#b03cff",
  wicket: "#ff3b4e",
  extra: "#ff9a1f",
  positive: "#20d47a",
} as const;

/** Defaults for a side without colours: one per side, far apart. */
export const DEFAULT_TEAM_COLOURS = { team1: "#2446d8", team2: "#e8590c" } as const;

export interface TeamTone {
  /** The colour itself. */
  base: string;
  /** Lighter: the lit edge of a wedge, glows on glass. */
  light: string;
  /** Darker: the shadowed end of a wedge. */
  deep: string;
  /** Text on `base` (AA). */
  text: string;
  /** Muted text on `base`. */
  textMuted: string;
}

/** A team's tones from its colour (or the side's default). */
export function teamTone(colour: string | null | undefined, fallback: string): TeamTone {
  const base = parseHex(colour) ? colour!.trim().toLowerCase() : fallback;
  const lum = luminance(base);
  // Very dark colours vanish on the glass: lift their light tone further.
  const light = shade(base, lum < 0.03 ? 0.42 : lum > 0.6 ? -0.08 : 0.22);
  const deep = shade(base, lum > 0.6 ? -0.28 : -0.5);
  const text = readableTextOn(base);
  return {
    base,
    light,
    deep,
    text,
    textMuted: withAlpha(text, 0.8),
  };
}

/** Rough distance of two colours (0 to ~441), to tell team colours apart. */
export function colourDistance(a: string, b: string): number {
  const x = parseHex(a) ?? [0, 0, 0];
  const y = parseHex(b) ?? [0, 0, 0];
  return Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]);
}

export interface MatchTones {
  team1: TeamTone;
  team2: TeamTone;
  /** The batting side's (team 1 when nobody bats yet). */
  bat: TeamTone;
  /** The other side's. */
  bowl: TeamTone;
  /** Team 2's colour for side-by-side figures (charts, the predictor bar). */
  team2Contrast: string;
}

/** Which side bats, by name (null when unknown). */
export function battingSideOf(state: LiveMatchState | null): 1 | 2 | null {
  const bat = state?.batting_team_name;
  if (!bat) return null;
  if (bat === state.team1_name) return 1;
  if (bat === state.team2_name) return 2;
  return null;
}

/** Both teams' tones for this match. */
export function matchTones(state: LiveMatchState | null): MatchTones {
  const colours = state?.team_colors;
  const team1 = teamTone(colours?.team1?.primary, DEFAULT_TEAM_COLOURS.team1);
  const team2 = teamTone(colours?.team2?.primary, DEFAULT_TEAM_COLOURS.team2);
  const side = battingSideOf(state);
  // Two sides in near enough the same colour: team 2 shows its second
  // colour (or gold) wherever both sit side by side.
  let team2Contrast = team2.light;
  if (colourDistance(team1.base, team2.base) < 90) {
    const second = colours?.team2?.secondary;
    team2Contrast =
      parseHex(second) && colourDistance(second!, team1.base) >= 90
        ? second!
        : FN.gold;
  }
  return {
    team1,
    team2,
    bat: side === 2 ? team2 : team1,
    bowl: side === 2 ? team1 : team2,
    team2Contrast,
  };
}

function toneVars(prefix: string, t: TeamTone): Record<string, string> {
  return {
    [`--fn-${prefix}`]: t.base,
    [`--fn-${prefix}-light`]: t.light,
    [`--fn-${prefix}-deep`]: t.deep,
    [`--fn-${prefix}-text`]: t.text,
    [`--fn-${prefix}-muted`]: t.textMuted,
  };
}

/** The package's CSS variables for this match. */
export function franchiseVars(state: LiveMatchState | null): Record<string, string> {
  const tones = matchTones(state);
  return {
    ...toneVars("t1", tones.team1),
    ...toneVars("t2", tones.team2),
    ...toneVars("bat", tones.bat),
    ...toneVars("bowl", tones.bowl),
    "--fn-t2-contrast": tones.team2Contrast,
    "--fn-gold": FN.gold,
    "--fn-gold-deep": FN.goldDeep,
    "--fn-gold-text": FN.goldText,
    "--fn-muted": FN.muted,
    "--fn-line": FN.line,
    "--fn-ink": FN.ink,
  };
}

/**
 * The `--ov-*` palette (what Standard components and the hold screen
 * read): the same dark glass, gold accent and team colours.
 */
export function franchisePalette(state: LiveMatchState | null): OverlayPalette {
  const tones = matchTones(state);
  return {
    bar: FN.glassMid,
    barText: FN.white,
    barMuted: FN.muted,
    panel: FN.glassLow,
    panelText: FN.white,
    panelMuted: FN.muted,
    card: FN.row,
    cardText: FN.white,
    cardMuted: FN.muted,
    cardLine: FN.line,
    accent: FN.gold,
    accentText: FN.goldText,
    line: FN.line,
    shadow: "0 18px 40px rgba(0, 0, 0, 0.55)",
    team1: tones.team1.base,
    team1Text: tones.team1.text,
    team2: tones.team2.base,
    team2Text: tones.team2.text,
  };
}

/** Whether `fg` reads on `bg` at AA for text (4.5:1). */
export function readsOn(fg: string, bg: string): boolean {
  return contrastRatio(fg, bg) >= 4.5;
}
