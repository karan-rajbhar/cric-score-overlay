/**
 * Overlay themes: a small, deliberate set built from the app's design
 * tokens (`globals.css`), replacing the old broadcaster-styled palettes.
 *
 * - Standard (default): a flat bar in the app's navy primary, white text.
 *   Reads over bright daytime grass and over dark footage alike.
 * - Light: a white bar with navy text, for night or dark footage.
 * - Team colours: each side's badge and card header in its team colour,
 *   Standard where a team has none.
 * - Custom: the producer's primary and accent colours.
 *
 * Text on any chosen colour is picked for contrast (WCAG AA, 4.5:1). No
 * gradients, glows, blur or texture; colour signals state (four, six,
 * wicket, extra, live) through the app's delivery tokens, and each theme
 * has at most one accent. Every overlay graphic reads its colours from the
 * `--ov-*` variables {@link overlayThemeVars} sets.
 *
 * The figures are fixed hex copies of the light-mode tokens, so the
 * overlay looks the same in OBS and in a dark-mode control room preview.
 */

import type { CSSProperties } from "react";

export const OVERLAY_THEME_IDS = ["standard", "light", "team", "custom"] as const;
export type OverlayThemeId = (typeof OVERLAY_THEME_IDS)[number];

export interface OverlayThemeOption {
  id: OverlayThemeId;
  label: string;
  description: string;
}

/** The themes a producer can pick, in display order. */
export const OVERLAY_THEMES: readonly OverlayThemeOption[] = [
  {
    id: "standard",
    label: "Standard",
    description: "Navy bar, white figures. Reads over grass and dark footage.",
  },
  {
    id: "light",
    label: "Light",
    description: "White bar, navy figures. For night or dark footage.",
  },
  {
    id: "team",
    label: "Team colours",
    description: "Each side in its team colour, Standard where a team has none.",
  },
  {
    id: "custom",
    label: "Custom",
    description: "Your primary and accent colours, text picked for contrast.",
  },
];

/**
 * Ids of the themes this set replaced. Saved OBS URLs and stored settings
 * may still name them; every one was a dark bar, so all map to Standard.
 */
export const LEGACY_OVERLAY_THEME_IDS = [
  "starsports",
  "sonysports",
  "foxcricket",
  "skysports",
  "thehundred",
  "apex",
  "volt",
  "agni",
  "dharma",
  "thunder",
  "nakshatra",
  "broadcast",
  "dark",
  "emerald",
  "minimal",
] as const;

const LEGACY_THEME_MAP: Record<string, OverlayThemeId> = Object.fromEntries(
  LEGACY_OVERLAY_THEME_IDS.map((id) => [id, "standard" as const]),
);

/** A theme id from a URL, a command or storage: current, legacy or unknown. */
export function resolveOverlayTheme(
  id: string | null | undefined,
): OverlayThemeId {
  if (!id) return "standard";
  const key = id.trim().toLowerCase();
  if ((OVERLAY_THEME_IDS as readonly string[]).includes(key)) {
    return key as OverlayThemeId;
  }
  return LEGACY_THEME_MAP[key] ?? "standard";
}

// ---- colour maths ---------------------------------------------------------

/** "#rgb" / "#rrggbb" to [r, g, b] (0-255), or null. */
export function parseHex(hex: string | null | undefined): [number, number, number] | null {
  if (!hex) return null;
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  let h = m[1]!;
  if (h.length === 3) h = h.replace(/(.)/g, "$1$1");
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function toHex([r, g, b]: [number, number, number]): string {
  const c = (v: number) =>
    Math.round(Math.max(0, Math.min(255, v)))
      .toString(16)
      .padStart(2, "0");
  return `#${c(r)}${c(g)}${c(b)}`;
}

/** WCAG relative luminance of a colour. */
export function luminance(hex: string): number {
  const rgb = parseHex(hex);
  if (!rgb) return 0;
  const [r, g, b] = rgb.map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG contrast ratio of two colours (1 to 21). */
export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [
    number,
    number,
  ];
  return (hi + 0.05) / (lo + 0.05);
}

const WHITE = "#ffffff";
const BLACK = "#000000";

/**
 * Text colour for a background: the app's navy ink or white when either
 * reaches 4.5:1, else whichever of black and white is higher (one of them
 * always reaches 4.58:1).
 */
export function readableTextOn(bg: string): string {
  const candidates = [TOKENS.ink, WHITE];
  const best = candidates
    .map((c) => ({ c, r: contrastRatio(bg, c) }))
    .sort((x, y) => y.r - x.r)[0]!;
  if (best.r >= 4.5) return best.c;
  return contrastRatio(bg, BLACK) >= contrastRatio(bg, WHITE) ? BLACK : WHITE;
}

/** Mix a colour towards black (amount < 0) or white (amount > 0). */
export function shade(hex: string, amount: number): string {
  const rgb = parseHex(hex);
  if (!rgb) return hex;
  const target = amount < 0 ? 0 : 255;
  const t = Math.min(1, Math.abs(amount));
  return toHex(rgb.map((v) => v + (target - v) * t) as [number, number, number]);
}

/** `hex` at `alpha` as rgba(). */
export function withAlpha(hex: string, alpha: number): string {
  const rgb = parseHex(hex) ?? [0, 0, 0];
  return `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${alpha})`;
}

// ---- palettes -------------------------------------------------------------

/** Light-mode values of the app tokens the overlay uses (globals.css). */
export const TOKENS = {
  /** --primary */
  navy: "#242267",
  /** --primary at 20% lightness: the second tone of the Standard bar. */
  navyDeep: "#1a194d",
  /** --primary in dark mode: the lavender accent on navy. */
  lavender: "#a8abfa",
  /** --primary-soft */
  lavenderSoft: "#e7e8fd",
  /** --foreground */
  ink: "#11132c",
  /** --muted-foreground */
  inkMuted: "#63667e",
  /** --border */
  line: "#e2e4ee",
  /** --background */
  paper: "#fafafd",
} as const;

export interface TeamColours {
  primary?: string | null;
  secondary?: string | null;
}

export interface CustomColours {
  primary: string;
  accent: string;
}

/** The overlay's default custom colours (the control room's starting values). */
export const DEFAULT_CUSTOM_COLOURS: CustomColours = {
  primary: TOKENS.navy,
  accent: TOKENS.lavender,
};

export interface OverlayPalette {
  /** The score bar and card headers. */
  bar: string;
  barText: string;
  barMuted: string;
  /** Its second tone: sub-strips, figure wells, team badges. */
  panel: string;
  panelText: string;
  panelMuted: string;
  /** Card bodies (tables, charts). */
  card: string;
  cardText: string;
  cardMuted: string;
  cardLine: string;
  /** The theme's one accent: striker marker, target chip, sting edge. */
  accent: string;
  accentText: string;
  /** Hairlines on the bar. */
  line: string;
  shadow: string;
  team1: string;
  team1Text: string;
  team2: string;
  team2Text: string;
}

const CARD = {
  card: WHITE,
  cardText: TOKENS.ink,
  cardMuted: TOKENS.inkMuted,
  cardLine: TOKENS.line,
};

const STANDARD: OverlayPalette = {
  bar: TOKENS.navy,
  barText: WHITE,
  barMuted: withAlpha(WHITE, 0.74),
  panel: TOKENS.navyDeep,
  panelText: WHITE,
  panelMuted: withAlpha(WHITE, 0.74),
  ...CARD,
  accent: TOKENS.lavender,
  accentText: TOKENS.ink,
  line: withAlpha(WHITE, 0.16),
  shadow: "0 2px 10px rgba(8, 9, 30, 0.35)",
  team1: TOKENS.navyDeep,
  team1Text: WHITE,
  team2: TOKENS.navyDeep,
  team2Text: WHITE,
};

const LIGHT: OverlayPalette = {
  bar: WHITE,
  barText: TOKENS.ink,
  barMuted: TOKENS.inkMuted,
  panel: TOKENS.lavenderSoft,
  panelText: TOKENS.ink,
  panelMuted: TOKENS.inkMuted,
  ...CARD,
  accent: TOKENS.navy,
  accentText: WHITE,
  line: TOKENS.line,
  shadow: "0 2px 10px rgba(8, 9, 30, 0.22)",
  team1: TOKENS.lavenderSoft,
  team1Text: TOKENS.ink,
  team2: TOKENS.lavenderSoft,
  team2Text: TOKENS.ink,
};

function customPalette(colours: CustomColours): OverlayPalette {
  const bar = parseHex(colours.primary) ? colours.primary : TOKENS.navy;
  const accent = parseHex(colours.accent) ? colours.accent : TOKENS.lavender;
  const barText = readableTextOn(bar);
  // The second tone goes darker on a light bar's text side, lighter on a dark one.
  const panel = shade(bar, barText === WHITE ? -0.25 : -0.08);
  const panelText = readableTextOn(panel);
  return {
    bar,
    barText,
    barMuted: withAlpha(barText, 0.74),
    panel,
    panelText,
    panelMuted: withAlpha(panelText, 0.74),
    ...CARD,
    accent,
    accentText: readableTextOn(accent),
    line: withAlpha(barText, 0.16),
    shadow: STANDARD.shadow,
    team1: panel,
    team1Text: panelText,
    team2: panel,
    team2Text: panelText,
  };
}

function teamPalette(team1?: TeamColours, team2?: TeamColours): OverlayPalette {
  const side = (c: TeamColours | undefined) => {
    const bg = parseHex(c?.primary) ? c!.primary! : null;
    return bg
      ? { bg, text: readableTextOn(bg) }
      : { bg: STANDARD.team1, text: STANDARD.team1Text };
  };
  const t1 = side(team1);
  const t2 = side(team2);
  return {
    ...STANDARD,
    team1: t1.bg,
    team1Text: t1.text,
    team2: t2.bg,
    team2Text: t2.text,
  };
}

export interface PaletteOptions {
  custom?: CustomColours | null;
  team1?: TeamColours | null;
  team2?: TeamColours | null;
}

/** The colours of a theme (any id, legacy ones included). */
export function overlayPalette(
  theme: string | null | undefined,
  options: PaletteOptions = {},
): OverlayPalette {
  switch (resolveOverlayTheme(theme)) {
    case "light":
      return LIGHT;
    case "custom":
      return customPalette(options.custom ?? DEFAULT_CUSTOM_COLOURS);
    case "team":
      return teamPalette(options.team1 ?? undefined, options.team2 ?? undefined);
    default:
      return STANDARD;
  }
}

/**
 * The light-mode delivery and chart tokens, pinned on overlay graphics so
 * ball chips and charts match the app's light look whatever the page's
 * colour scheme (a dark-mode control room preview included).
 */
const PINNED_TOKENS: Record<string, string> = {
  "--four": "163 94% 24%",
  "--four-foreground": "0 0% 100%",
  "--six": "262 69% 50%",
  "--six-foreground": "0 0% 100%",
  "--wicket": "0 72% 51%",
  "--wicket-foreground": "0 0% 100%",
  "--extra": "26 90% 37%",
  "--extra-foreground": "0 0% 100%",
  "--live": "0 72% 51%",
  "--live-foreground": "0 0% 100%",
  "--series-1": "241 51% 47.6%",
  "--series-2": "17 82% 56.3%",
  "--foreground": "236 45% 12%",
  "--muted": "230 33% 96%",
  "--muted-foreground": "233 12% 44%",
  "--border": "230 25% 91%",
  "--card": "0 0% 100%",
  "--card-foreground": "236 45% 12%",
};

/** CSS variables of a palette (`--ov-*`) plus the pinned app tokens. */
export function overlayThemeVars(palette: OverlayPalette): CSSProperties {
  const vars: Record<string, string> = {
    ...PINNED_TOKENS,
    "--ov-bar": palette.bar,
    "--ov-bar-text": palette.barText,
    "--ov-bar-muted": palette.barMuted,
    "--ov-panel": palette.panel,
    "--ov-panel-text": palette.panelText,
    "--ov-panel-muted": palette.panelMuted,
    "--ov-card": palette.card,
    "--ov-card-text": palette.cardText,
    "--ov-card-muted": palette.cardMuted,
    "--ov-card-line": palette.cardLine,
    "--ov-accent": palette.accent,
    "--ov-accent-text": palette.accentText,
    "--ov-line": palette.line,
    "--ov-shadow": palette.shadow,
    "--ov-team1": palette.team1,
    "--ov-team1-text": palette.team1Text,
    "--ov-team2": palette.team2,
    "--ov-team2-text": palette.team2Text,
  };
  return vars as CSSProperties;
}
