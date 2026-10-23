"use client";

/**
 * The overlay's packages by theme id, and {@link OverlayPackageScope}: the
 * stage root that puts a package on air (its palette, variables and fonts
 * on the root; its components and motion for every `OverlayElement`
 * inside, Standard's where it has none).
 *
 * Adding a package: build it in `packages/<id>/` as a `BroadcastPackage`,
 * add it to {@link OVERLAY_PACKAGES} and its name to `manifest.ts`.
 */

import { useMemo, type ReactNode } from "react";
import { cn } from "~/lib/utils";
import {
  overlayPalette,
  overlayThemeVars,
  resolveOverlayTheme,
} from "../overlay-themes";
import type { LiveMatchState } from "../types";
import { OverlayStageContext } from "./element";
import { MotionPreferenceContext } from "./motion";
import { StageStyleContext } from "./palette-context";
import { HUNDRED_BALL } from "./hundred-ball";
import { STANDARD_ELEMENTS } from "./standard";
import type { BroadcastPackage, PaletteContext } from "./types";
import type { CustomColours } from "../overlay-themes";
import { FRANCHISE_NIGHT } from "./franchise-night";

/** The plain packages' palette: the theme's, with this match's team colours. */
function plainPalette(ctx: PaletteContext) {
  return overlayPalette(ctx.theme, {
    custom: ctx.customColors,
    team1: ctx.state?.team_colors?.team1,
    team2: ctx.state?.team_colors?.team2,
  });
}

const plain = (id: string): BroadcastPackage => ({
  id,
  kind: "plain",
  palette: plainPalette,
  elements: {},
});

/** Every package by id (the plain four share Standard's components). */
export const OVERLAY_PACKAGES: Record<string, BroadcastPackage> = {
  standard: plain("standard"),
  light: plain("light"),
  team: plain("team"),
  custom: plain("custom"),
  [FRANCHISE_NIGHT.id]: FRANCHISE_NIGHT,
  [HUNDRED_BALL.id]: HUNDRED_BALL,
};

/** The package a theme id selects (legacy and unknown ids: Standard). */
export function resolveOverlayPackage(
  theme: string | null | undefined,
): BroadcastPackage {
  return (
    (theme ? OVERLAY_PACKAGES[theme] : undefined) ??
    OVERLAY_PACKAGES[resolveOverlayTheme(theme)] ??
    OVERLAY_PACKAGES.standard!
  );
}

/** The root style a package gets for this match and scene. */
export function packageStyle(pkg: BroadcastPackage, ctx: PaletteContext) {
  return {
    ...overlayThemeVars(pkg.palette(ctx)),
    ...(pkg.vars?.(ctx) ?? {}),
    ...(pkg.fonts?.display ? { "--pkg-font-display": pkg.fonts.display } : {}),
    ...(pkg.fonts?.text ? { "--pkg-font-text": pkg.fonts.text } : {}),
    ...(pkg.fonts?.figures ? { "--pkg-font-figures": pkg.fonts.figures } : {}),
  } as React.CSSProperties;
}

/**
 * Puts the package for `theme` on air for its children: the stage (OBS
 * output and previews) and the gallery.
 */
export function OverlayPackageScope({
  theme,
  customColors,
  state,
  respectReducedMotion = false,
  className,
  children,
}: {
  theme: string;
  customColors: CustomColours | null;
  state: LiveMatchState | null;
  /** Previews: honour prefers-reduced-motion (the OBS output never does). */
  respectReducedMotion?: boolean;
  className?: string;
  children: ReactNode;
}) {
  const pkg = resolveOverlayPackage(theme);
  const style = packageStyle(pkg, { state, theme, customColors });
  const styleKey = JSON.stringify(style);
  // Stable while the colours do not change (consumers re-render less).
  const stageStyle = useMemo(
    () => JSON.parse(styleKey) as React.CSSProperties,
    [styleKey],
  );
  const stage = useMemo(
    () => ({
      elements: { ...STANDARD_ELEMENTS, ...pkg.elements },
      motion: pkg.motion ?? {},
    }),
    [pkg],
  );
  const motionPref = useMemo(
    () => ({ respectReducedMotion }),
    [respectReducedMotion],
  );
  return (
    <StageStyleContext.Provider value={stageStyle}>
      <OverlayStageContext.Provider value={stage}>
        <MotionPreferenceContext.Provider value={motionPref}>
          <div
            data-package={pkg.id}
            style={stageStyle}
            className={cn("contents", pkg.fonts?.className, className)}
          >
            {children}
          </div>
        </MotionPreferenceContext.Provider>
      </OverlayStageContext.Provider>
    </StageStyleContext.Provider>
  );
}
