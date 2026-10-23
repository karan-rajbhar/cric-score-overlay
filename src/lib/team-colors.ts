/**
 * Team colours (`teams.primary_color` / `secondary_color`, copied onto the
 * match snapshots): "#rrggbb" or null. Shared by the server validation and
 * the colour picker.
 */

const HEX_COLOR = /^#[0-9a-f]{6}$/i;

/**
 * A colour from a form: "#rrggbb" (lower-cased), null when cleared, or an
 * error for anything else ("red", "#fff", "123456").
 */
export function parseTeamColor(
  value: unknown,
): { ok: true; value: string | null } | { ok: false; error: string } {
  if (value === null || value === undefined) return { ok: true, value: null };
  if (typeof value !== "string") {
    return { ok: false, error: "Team colours must look like #1a2b3c" };
  }
  const trimmed = value.trim();
  if (!trimmed) return { ok: true, value: null };
  return HEX_COLOR.test(trimmed)
    ? { ok: true, value: trimmed.toLowerCase() }
    : { ok: false, error: "Team colours must look like #1a2b3c" };
}

export function isTeamColor(value: string): boolean {
  return HEX_COLOR.test(value.trim());
}

/** A dozen colours that read well as a crest or a scoreboard band. */
export const TEAM_COLOR_SWATCHES: readonly { name: string; hex: string }[] = [
  { name: "Navy", hex: "#1e3a8a" },
  { name: "Royal blue", hex: "#2563eb" },
  { name: "Sky blue", hex: "#38bdf8" },
  { name: "Teal", hex: "#0f766e" },
  { name: "Green", hex: "#15803d" },
  { name: "Lime", hex: "#84cc16" },
  { name: "Yellow", hex: "#facc15" },
  { name: "Orange", hex: "#ea580c" },
  { name: "Red", hex: "#dc2626" },
  { name: "Maroon", hex: "#7f1d1d" },
  { name: "Purple", hex: "#7c3aed" },
  { name: "Black", hex: "#111827" },
];

/** The app's navy text colour (`--primary`, hsl(241 50% 27%)). */
export const NAVY_TEXT = "#242267";
export const WHITE_TEXT = "#ffffff";

function channel(c: number): number {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

function luminance(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/** WCAG contrast ratio between two "#rrggbb" colours (1 to 21). */
export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [
    number,
    number,
  ];
  return (hi + 0.05) / (lo + 0.05);
}

/** Normal-size text needs 4.5:1 (WCAG AA). */
export const MIN_TEXT_CONTRAST = 4.5;

/**
 * How white and navy text read on a team colour, and which one to use for
 * a preview (the one with more contrast).
 */
export function textOn(background: string): {
  white: number;
  navy: number;
  best: string;
} {
  const white = contrastRatio(background, WHITE_TEXT);
  const navy = contrastRatio(background, NAVY_TEXT);
  return { white, navy, best: white >= navy ? WHITE_TEXT : NAVY_TEXT };
}
