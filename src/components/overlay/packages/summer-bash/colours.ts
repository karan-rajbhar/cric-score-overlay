/**
 * Summer bash colour: a night-league package. Panels are deep violet
 * glass; the neon set (magenta, cyan, lime, yellow, orange, red) marks
 * state; each side plays in its own team colour pushed to full
 * saturation, so even a navy or maroon club reads as a lit sign at night.
 *
 * Pure: the palette (`--ov-*`, what fallbacks and shared pieces read) and
 * the package's own variables (`--sb-*`) from the live row.
 */

import {
  contrastRatio,
  parseHex,
  withAlpha,
  type OverlayPalette,
} from "../../overlay-themes";
import type { LiveMatchState } from "../../types";
import type { PaletteContext } from "../types";

/** The package's fixed colours. */
export const NEON = {
  /** Text on neon plates; the deepest panel tone. */
  ink: "#0b0620",
  night: "#140a36",
  violet: "#2a1466",
  deep: "#1b0d47",
  magenta: "#ff2ea6",
  cyan: "#1fe5ff",
  lime: "#b8ff2e",
  yellow: "#ffe23d",
  orange: "#ff8a1f",
  red: "#ff3355",
  white: "#ffffff",
  /** Secondary text on the violet panels (AA on every panel tone). */
  mist: "#d9d0ff",
} as const;

type Rgb = [number, number, number];

function toHex([r, g, b]: Rgb): string {
  const c = (v: number) =>
    Math.round(Math.max(0, Math.min(255, v)))
      .toString(16)
      .padStart(2, "0");
  return `#${c(r)}${c(g)}${c(b)}`;
}

/** [h 0-360, s 0-1, l 0-1] of a hex colour, or null. */
export function hexToHsl(hex: string): [number, number, number] | null {
  const rgb = parseHex(hex);
  if (!rgb) return null;
  const [r, g, b] = rgb.map((v) => v / 255) as Rgb;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return [h * 60, s, l];
}

export function hslToHex(h: number, s: number, l: number): string {
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) =>
    l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return toHex([f(0) * 255, f(8) * 255, f(4) * 255]);
}

/**
 * A team colour at full saturation and sign-like lightness; null for a
 * missing colour or one with no hue to speak of (black, white, greys).
 */
export function vivid(hex: string | null | undefined): string | null {
  const hsl = hex ? hexToHsl(hex) : null;
  if (!hsl) return null;
  const [h, s, l] = hsl;
  if (s < 0.18 || l < 0.06 || l > 0.96) return null;
  return hslToHex(h, Math.max(s, 0.92), Math.min(0.6, Math.max(0.46, l)));
}

/** Degrees between two hues (0-180). */
export function hueDistance(a: string, b: string): number {
  const ha = hexToHsl(a)?.[0] ?? 0;
  const hb = hexToHsl(b)?.[0] ?? 0;
  const d = Math.abs(ha - hb) % 360;
  return d > 180 ? 360 - d : d;
}

/** Two sides closer than this read as one colour on air. */
const CLASH_DEGREES = 28;

export interface SideColour {
  /** The plate: the vivid colour, deepened where white must sit on it. */
  bg: string;
  /** Text on the plate (AA, 4.5:1). */
  text: string;
  /** The lit edge and glow: the vivid colour itself. */
  glow: string;
}

/**
 * A plate in `glow`: night ink on light colours (lime, yellow, cyan),
 * white on the rest, the plate deepened step by step until white reaches
 * 4.5:1 where neither text colour does on the vivid colour itself.
 */
export function sideColour(glow: string): SideColour {
  if (contrastRatio(glow, NEON.ink) >= 7) {
    return { bg: glow, text: NEON.ink, glow };
  }
  const hsl = hexToHsl(glow) ?? [0, 0, 0.5];
  let bg = glow;
  let l = hsl[2];
  while (contrastRatio(bg, NEON.white) < 4.5 && l > 0.12) {
    l -= 0.03;
    bg = hslToHex(hsl[0], hsl[1], l);
  }
  return { bg, text: NEON.white, glow };
}

/** Each side's colours: its own team colour, else magenta / cyan. */
export function teamColours(
  state: Pick<LiveMatchState, "team_colors"> | null | undefined,
): { team1: SideColour; team2: SideColour } {
  const c1 = state?.team_colors?.team1;
  const c2 = state?.team_colors?.team2;
  const one = vivid(c1?.primary) ?? NEON.magenta;
  let two = vivid(c2?.primary) ?? NEON.cyan;
  if (hueDistance(one, two) < CLASH_DEGREES) {
    // Same colour twice: the second side's secondary colour, else a neon
    // far from the first.
    const second = vivid(c2?.secondary);
    two =
      second && hueDistance(one, second) >= CLASH_DEGREES
        ? second
        : hueDistance(one, NEON.cyan) >= CLASH_DEGREES
          ? NEON.cyan
          : NEON.magenta;
  }
  return { team1: sideColour(one), team2: sideColour(two) };
}

/** Which side (1 / 2) bats, by name; null when unknown. */
function battingSideOf(state: LiveMatchState | null): 1 | 2 | null {
  const bat = state?.batting_team_name;
  if (!state || !bat) return null;
  if (bat === state.team1_name) return 1;
  if (bat === state.team2_name) return 2;
  return null;
}

/** The night palette every shared piece and fallback reads. */
export function summerBashPalette(ctx: PaletteContext): OverlayPalette {
  const { team1, team2 } = teamColours(ctx.state);
  return {
    bar: NEON.deep,
    barText: NEON.white,
    barMuted: NEON.mist,
    panel: NEON.night,
    panelText: NEON.white,
    panelMuted: NEON.mist,
    card: NEON.night,
    cardText: NEON.white,
    cardMuted: NEON.mist,
    cardLine: withAlpha(NEON.white, 0.14),
    accent: NEON.magenta,
    accentText: NEON.ink,
    line: withAlpha(NEON.white, 0.16),
    shadow: `0 0 0 1px ${withAlpha(NEON.magenta, 0.55)}, 0 12px 32px rgba(5, 2, 20, 0.6)`,
    team1: team1.bg,
    team1Text: team1.text,
    team2: team2.bg,
    team2Text: team2.text,
  };
}

const sideVars = (prefix: string, c: SideColour): Record<string, string> => ({
  [`--sb-${prefix}`]: c.bg,
  [`--sb-${prefix}-text`]: c.text,
  [`--sb-${prefix}-glow`]: c.glow,
  [`--sb-${prefix}-haze`]: withAlpha(c.glow, 0.45),
});

/**
 * The package's variables: the neon set, both sides, and the batting /
 * bowling side's colours for whatever is in play.
 */
export function summerBashVars(ctx: PaletteContext): Record<string, string> {
  const { team1, team2 } = teamColours(ctx.state);
  const side = battingSideOf(ctx.state);
  const bat = side === 2 ? team2 : team1;
  const bowl = side === 2 ? team1 : team2;
  return {
    "--sb-ink": NEON.ink,
    "--sb-night": NEON.night,
    "--sb-deep": NEON.deep,
    "--sb-violet": NEON.violet,
    "--sb-magenta": NEON.magenta,
    "--sb-cyan": NEON.cyan,
    "--sb-lime": NEON.lime,
    "--sb-yellow": NEON.yellow,
    "--sb-orange": NEON.orange,
    "--sb-red": NEON.red,
    "--sb-mist": NEON.mist,
    ...Object.fromEntries(
      (["magenta", "cyan", "lime", "yellow", "orange", "red"] as const).map(
        (n) => [`--sb-${n}-haze`, withAlpha(NEON[n], 0.42)],
      ),
    ),
    ...sideVars("t1", team1),
    ...sideVars("t2", team2),
    ...sideVars("bat", bat),
    ...sideVars("bowl", bowl),
  };
}
