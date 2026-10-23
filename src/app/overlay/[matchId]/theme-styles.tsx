/**
 * Score-bug helpers for the overlay page.
 *
 * The palettes now live in `~/components/overlay/overlay-themes`
 * (`OVERLAY_THEMES`, `resolveOverlayTheme`); graphics read them through
 * the `--ov-*` variables. `THEME_STYLES` remains for the page's inline
 * score bug until it moves to `ScoreBug`: every theme id (current and
 * legacy) gets the same classes, which read those variables and fall back
 * to the Standard theme's navy.
 */

import { BallChip as DsBallChip } from "~/components/ds/ball";
import { overBallChip } from "~/components/matches/match-live-panel";
import {
  LEGACY_OVERLAY_THEME_IDS,
  OVERLAY_THEME_IDS,
} from "~/components/overlay/overlay-themes";
import type { OverlayTheme } from "~/components/overlay/types";

export { oversText } from "~/components/overlay/overlay-kit";

/** A ball of this over as the app's ball chip (delivery colour tokens). */
export function BallChip({ label }: { label: string }) {
  const chip = overBallChip(label);
  return <DsBallChip kind={chip.kind} label={chip.label} size="sm" />;
}

interface ThemeClasses {
  outerBorder: string;
  teamBadge: string;
  mainBarBg: string;
  subBarBg: string;
  accentColor: string;
  accentText: string;
  strikeChevron: string;
}

const VAR_CLASSES: ThemeClasses = {
  outerBorder:
    "border-[color:var(--ov-line,rgba(255,255,255,0.16))] shadow-[var(--ov-shadow,0_2px_10px_rgba(8,9,30,0.35))]",
  teamBadge:
    "bg-[color:var(--ov-team1,#1a194d)] text-[color:var(--ov-team1-text,#ffffff)] font-semibold",
  mainBarBg:
    "bg-[color:var(--ov-bar,#242267)] text-[color:var(--ov-bar-text,#ffffff)]",
  subBarBg:
    "bg-[color:var(--ov-panel,#1a194d)] text-[color:var(--ov-panel-text,#ffffff)] border-t border-[color:var(--ov-line,rgba(255,255,255,0.16))]",
  accentColor: "var(--ov-accent, #a8abfa)",
  accentText: "text-[color:var(--ov-accent,#a8abfa)] font-semibold",
  strikeChevron: "text-[color:var(--ov-accent,#a8abfa)]",
};

/** Score-bug classes per theme id (all ids share the variable-driven set). */
export const THEME_STYLES = Object.fromEntries(
  [...OVERLAY_THEME_IDS, ...LEGACY_OVERLAY_THEME_IDS].map((id) => [
    id,
    VAR_CLASSES,
  ]),
) as Record<OverlayTheme, ThemeClasses>;
