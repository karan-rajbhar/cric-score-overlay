/**
 * Centralized Design Tokens for CricScore
 * Single source of truth for colors, typography, spacing, radii, shadows, and WCAG contrast.
 */

export interface ColorToken {
  hsl: string; // "H S% L%" for Tailwind CSS variables
  hex: string;
  rgb: [number, number, number];
  label: string;
}

export const PALETTE = {
  // Cricket Pitch Emerald Scale
  pitch: {
    50: {
      hsl: "152 68% 96%",
      hex: "#ebfaf2",
      rgb: [235, 250, 242],
      label: "Pitch 50",
    },
    100: {
      hsl: "152 64% 90%",
      hex: "#d0f4e1",
      rgb: [208, 244, 225],
      label: "Pitch 100",
    },
    200: {
      hsl: "152 60% 78%",
      hex: "#a4e8c5",
      rgb: [164, 232, 197],
      label: "Pitch 200",
    },
    300: {
      hsl: "152 56% 62%",
      hex: "#6ed7a2",
      rgb: [110, 215, 162],
      label: "Pitch 300",
    },
    400: {
      hsl: "152 54% 48%",
      hex: "#38bf7e",
      rgb: [56, 191, 126],
      label: "Pitch 400",
    },
    500: {
      hsl: "152 62% 38%",
      hex: "#239f63",
      rgb: [35, 159, 99],
      label: "Pitch 500 (Primary Brand)",
    },
    600: {
      hsl: "152 68% 30%",
      hex: "#177e4c",
      rgb: [23, 126, 76],
      label: "Pitch 600",
    },
    700: {
      hsl: "152 70% 23%",
      hex: "#13643d",
      rgb: [19, 100, 61],
      label: "Pitch 700",
    },
    800: {
      hsl: "152 68% 18%",
      hex: "#124f32",
      rgb: [18, 79, 50],
      label: "Pitch 800",
    },
    900: {
      hsl: "152 65% 14%",
      hex: "#0f412a",
      rgb: [15, 65, 42],
      label: "Pitch 900",
    },
    950: {
      hsl: "152 72% 8%",
      hex: "#062517",
      rgb: [6, 37, 23],
      label: "Pitch 950",
    },
  },

  // Broadcast Live Ruby Scale
  ruby: {
    50: {
      hsl: "354 100% 97%",
      hex: "#fff0f2",
      rgb: [255, 240, 242],
      label: "Ruby 50",
    },
    100: {
      hsl: "354 94% 93%",
      hex: "#ffe0e4",
      rgb: [255, 224, 228],
      label: "Ruby 100",
    },
    400: {
      hsl: "354 84% 65%",
      hex: "#f8536a",
      rgb: [248, 83, 106],
      label: "Ruby 400",
    },
    500: {
      hsl: "354 84% 54%",
      hex: "#ef233c",
      rgb: [239, 35, 60],
      label: "Ruby 500 (Live Indicator)",
    },
    600: {
      hsl: "354 88% 44%",
      hex: "#d90429",
      rgb: [217, 4, 41],
      label: "Ruby 600",
    },
    700: {
      hsl: "354 86% 36%",
      hex: "#b10321",
      rgb: [177, 3, 33],
      label: "Ruby 700",
    },
  },

  // Trophy Amber / Gold Scale
  gold: {
    50: {
      hsl: "48 100% 96%",
      hex: "#fefce8",
      rgb: [254, 252, 232],
      label: "Gold 50",
    },
    100: {
      hsl: "48 96% 89%",
      hex: "#fef08a",
      rgb: [254, 240, 138],
      label: "Gold 100",
    },
    400: {
      hsl: "40 94% 56%",
      hex: "#fbbf24",
      rgb: [251, 191, 36],
      label: "Gold 400",
    },
    500: {
      hsl: "38 92% 48%",
      hex: "#f59e0b",
      rgb: [245, 158, 11],
      label: "Gold 500 (Trophy Honors)",
    },
    600: {
      hsl: "34 90% 40%",
      hex: "#d97706",
      rgb: [217, 119, 6],
      label: "Gold 600",
    },
    700: {
      hsl: "28 85% 32%",
      hex: "#b45309",
      rgb: [180, 83, 9],
      label: "Gold 700",
    },
  },

  // Blue / Stats Accent
  sky: {
    400: {
      hsl: "200 85% 55%",
      hex: "#38bdf8",
      rgb: [56, 189, 248],
      label: "Sky 400",
    },
    500: {
      hsl: "200 80% 45%",
      hex: "#0ea5e9",
      rgb: [14, 165, 233],
      label: "Sky 500",
    },
    600: {
      hsl: "200 85% 38%",
      hex: "#0284c7",
      rgb: [2, 132, 199],
      label: "Sky 600",
    },
  },

  // Purple / Wickets Accent
  amethyst: {
    400: {
      hsl: "270 75% 65%",
      hex: "#c084fc",
      rgb: [192, 132, 252],
      label: "Purple 400",
    },
    500: {
      hsl: "270 70% 55%",
      hex: "#a855f7",
      rgb: [168, 85, 247],
      label: "Purple 500 (Wickets)",
    },
    600: {
      hsl: "270 75% 45%",
      hex: "#9333ea",
      rgb: [147, 51, 234],
      label: "Purple 600",
    },
  },

  // Multi-Elevation Neutral Surfaces (Dark Mode - Floodlit Stadium Palette)
  darkSurfaces: {
    base: {
      hsl: "160 14% 6%",
      hex: "#0d1210",
      rgb: [13, 18, 16],
      label: "Surface Base (Dark Stadium Obsidian)",
    },
    surface1: {
      hsl: "160 10% 9%",
      hex: "#141a17",
      rgb: [20, 26, 23],
      label: "Surface 1 (Card/Sidebar Stadium Charcoal)",
    },
    surface2: {
      hsl: "160 10% 12%",
      hex: "#1b231f",
      rgb: [27, 35, 31],
      label: "Surface 2 (Elevated/Popover)",
    },
    surface3: {
      hsl: "160 10% 16%",
      hex: "#242e29",
      rgb: [36, 46, 41],
      label: "Surface 3 (Hover/Active)",
    },
    border: {
      hsl: "160 8% 18%",
      hex: "#29332e",
      rgb: [41, 51, 46],
      label: "Border (Dark Stadium)",
    },
    textPrimary: {
      hsl: "150 10% 98%",
      hex: "#f7faf8",
      rgb: [247, 250, 248],
      label: "Text Primary (Dark)",
    },
    textSecondary: {
      hsl: "150 8% 76%",
      hex: "#bdc7c1",
      rgb: [189, 199, 193],
      label: "Text Secondary (Dark)",
    },
    textMuted: {
      hsl: "150 6% 62%",
      hex: "#96a19b",
      rgb: [150, 161, 155],
      label: "Text Muted (Dark)",
    },
  },

  // Clean Paper Neutrals (Light Mode - Chromatic Joy)
  lightSurfaces: {
    base: {
      hsl: "40 33% 98%",
      hex: "#fffdfa",
      rgb: [255, 253, 250],
      label: "Surface Base (Chromatic Joy Daylight)",
    },
    surface1: {
      hsl: "0 0% 100%",
      hex: "#ffffff",
      rgb: [255, 255, 255],
      label: "Surface 1 (Card/Sidebar)",
    },
    surface2: {
      hsl: "150 10% 95%",
      hex: "#f0f4f2",
      rgb: [240, 244, 242],
      label: "Surface 2 (Elevated)",
    },
    surface3: {
      hsl: "150 12% 90%",
      hex: "#e2eae5",
      rgb: [226, 234, 229],
      label: "Surface 3 (Hover/Active)",
    },
    border: {
      hsl: "150 8% 86%",
      hex: "#d8e2dc",
      rgb: [216, 226, 220],
      label: "Border (Light)",
    },
    textPrimary: {
      hsl: "220 30% 10%",
      hex: "#121824",
      rgb: [18, 24, 36],
      label: "Text Primary (Light)",
    },
    textSecondary: {
      hsl: "220 18% 28%",
      hex: "#3b4557",
      rgb: [59, 69, 87],
      label: "Text Secondary (Light)",
    },
    textMuted: {
      hsl: "220 12% 40%",
      hex: "#5a6474",
      rgb: [90, 100, 116],
      label: "Text Muted (Light)",
    },
  },
} as const;

// ---------------------------------------------------------------------------
// WCAG 2.1 Contrast Calculation Utilities
// ---------------------------------------------------------------------------

/**
 * Convert an sRGB color component [0, 255] to linear luminance component.
 */
function sRGBtoLin(c: number): number {
  const v = c / 255;
  return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
}

/**
 * Calculate relative luminance (L) of an RGB color according to WCAG 2.1 specs.
 * L = 0.2126 * R + 0.7152 * G + 0.0722 * B
 */
export function getRelativeLuminance(
  rgb: readonly [number, number, number] | [number, number, number],
): number {
  const [r, g, b] = rgb;
  return 0.2126 * sRGBtoLin(r) + 0.7152 * sRGBtoLin(g) + 0.0722 * sRGBtoLin(b);
}

/**
 * Calculate the WCAG 2.1 contrast ratio between two RGB colors.
 * Contrast Ratio = (L1 + 0.05) / (L2 + 0.05) where L1 is the lighter color.
 */
export function getContrastRatio(
  color1: readonly [number, number, number] | [number, number, number],
  color2: readonly [number, number, number] | [number, number, number],
): number {
  const l1 = getRelativeLuminance(color1);
  const l2 = getRelativeLuminance(color2);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Check if a color pair satisfies WCAG 2.1 AA requirements.
 * - Normal text requires >= 4.5:1
 * - Large text (>= 18pt or >= 14pt bold) requires >= 3.0:1
 */
export function isWcagAALarge(ratio: number): boolean {
  return ratio >= 3.0;
}

export function isWcagAANormal(ratio: number): boolean {
  return ratio >= 4.5;
}
