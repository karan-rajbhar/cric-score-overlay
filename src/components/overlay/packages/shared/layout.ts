/**
 * The overlay canvas's grid: 1920x1080, a 5% title-safe inset (96 px left
 * and right, 54 px top and bottom), and where the score bug and lower
 * thirds anchor. Every element positions itself (`fixed`) on this canvas;
 * a package passes its own bug height, the rest is the same for all.
 */

import type { CSSProperties } from "react";
import type { LayoutMode } from "../../types";

export const CANVAS = { width: 1920, height: 1080 } as const;

/** Title safe: 5% of each dimension. */
export const SAFE = { x: 96, y: 54 } as const;

/** Width and height inside title safe. */
export const SAFE_WIDTH = CANVAS.width - SAFE.x * 2;
export const SAFE_HEIGHT = CANVAS.height - SAFE.y * 2;

/**
 * Where the score bug sits for a layout: top (along the top of title
 * safe, full width), compact (a corner card at the bottom left) or bottom
 * (along the bottom, full width; also "broadcast"). `marginOffsetPx` is
 * the producer's lift above the bottom edge.
 */
export function scoreBugAnchor(layout: LayoutMode, marginOffsetPx = 0): CSSProperties {
  if (layout === "top") return { top: SAFE.y, left: SAFE.x, width: SAFE_WIDTH };
  if (layout === "compact") return { bottom: SAFE.y + marginOffsetPx, left: SAFE.x };
  return { bottom: SAFE.y + marginOffsetPx, left: SAFE.x, width: SAFE_WIDTH };
}

/**
 * The bottom edge of a lower third clear of a bottom score bug `bugHeight`
 * tall, with `gap` between them. (The stage already lifts lower thirds by
 * the producer's margin offset.)
 */
export function lowerThirdBottom(bugHeight: number, gap = 22): number {
  return SAFE.y + bugHeight + gap;
}

/** A lower third's anchor: left edge of title safe, above the bug. */
export function lowerThirdAnchor(bugHeight: number, gap = 22): CSSProperties {
  return { left: SAFE.x, bottom: lowerThirdBottom(bugHeight, gap), maxWidth: SAFE_WIDTH };
}

/** A full-screen card's frame: the canvas, padded to title safe (centre the card in it). */
export const FULL_FRAME: CSSProperties = {
  position: "fixed",
  inset: 0,
  padding: `${SAFE.y}px ${SAFE.x}px`,
};
