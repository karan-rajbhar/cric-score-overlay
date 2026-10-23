/**
 * Overlay themes: the one place the setup flow, the control room and the
 * overlay state get the list from.
 *
 * PLACEHOLDER until the new graphics merge: they export `OVERLAY_THEMES`
 * and `resolveOverlayTheme` (same names, same three themes) from
 * `~/app/overlay/[matchId]/theme-styles`. Then this file becomes a
 * re-export of those, and {@link paletteOf} goes (the new components take
 * the theme id directly).
 */

import type { OverlayTheme } from "./types";

export interface OverlayThemeOption {
  id: string;
  label: string;
  description: string;
}

export const OVERLAY_THEMES: readonly OverlayThemeOption[] = [
  {
    id: "standard",
    label: "Standard",
    description: "Dark bar with light figures, for any camera",
  },
  {
    id: "light",
    label: "Light",
    description: "Light bar with dark figures",
  },
  {
    id: "custom",
    label: "Custom",
    description: "Your club's colours",
  },
];

export const DEFAULT_OVERLAY_THEME = "standard";

/** Any theme id, old or new, as one of {@link OVERLAY_THEMES}. */
export function resolveOverlayTheme(id: string | null | undefined): string {
  if (!id) return DEFAULT_OVERLAY_THEME;
  if (OVERLAY_THEMES.some((t) => t.id === id)) return id;
  if (id === "minimal") return "light";
  return DEFAULT_OVERLAY_THEME;
}

/** The current components' palette for a theme (until the new ones land). */
export function paletteOf(themeId: string): OverlayTheme {
  const id = resolveOverlayTheme(themeId);
  if (id === "light") return "minimal";
  if (id === "custom") return "custom";
  return "starsports";
}
