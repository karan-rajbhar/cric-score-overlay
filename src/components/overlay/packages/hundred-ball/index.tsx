"use client";

/**
 * Hundred-ball countdown: a bold, minimal broadcast package for short
 * formats. Balls, never overs: the bug's second hero figure counts the
 * innings' balls down, sets (or overs) show as squares, the chase is one
 * statement ("Needs 24 from 15 balls"), cards keep to a few big figures,
 * and stings are typographic, with flat colour wipes.
 */

import type { MotionSpec } from "../types";
import type { BroadcastPackage } from "../types";
import { HundredScoreBug } from "./bug";
import { HUNDRED_FONTS } from "./fonts";
import { hundredPalette, hundredVars } from "./palette";

const EASE_IN = "cubic-bezier(0.7, 0, 0.84, 0)";

const fadeIn = (ms: number): MotionSpec => ({
  keyframes: [{ opacity: 0 }, { opacity: 1 }],
  durationMs: ms,
});

/** The layer wipes off towards an edge. */
const wipeOff = (to: "left" | "right" | "up" | "down", ms = 380): MotionSpec => {
  const end = {
    left: "inset(0 100% 0 0)",
    right: "inset(0 0 0 100%)",
    up: "inset(0 0 100% 0)",
    down: "inset(100% 0 0 0)",
  }[to];
  return {
    keyframes: [{ clipPath: "inset(0 0 0 0)" }, { clipPath: end }],
    durationMs: ms,
    easing: EASE_IN,
  };
};

/** A new strap over the last: a quick drop and settle. */
const bump: MotionSpec = {
  keyframes: [
    { transform: "translateY(10px)", opacity: 0.4 },
    { transform: "none", opacity: 1 },
  ],
  durationMs: 260,
};

export const HUNDRED_BALL: BroadcastPackage = {
  id: "hundred-ball",
  kind: "broadcast",
  palette: hundredPalette,
  vars: hundredVars,
  fonts: HUNDRED_FONTS,
  motion: {
    scoreBug: { enter: fadeIn(120), exit: wipeOff("left", 420) },
  },
  elements: {
    scoreBug: HundredScoreBug,
  },
};

export const HUNDRED_MOTION_PARTS = { fadeIn, wipeOff, bump };
