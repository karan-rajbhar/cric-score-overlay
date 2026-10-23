"use client";

/**
 * Test classic: an understated heritage look for long-form cricket, after
 * the feel of Test coverage on television (original artwork, no marks).
 *
 * - Deep navy bars with a lit bevel, ivory cards, gold-leaf rules and a
 *   varnished-wood honours board for hundreds and five-fors.
 * - Libre Baskerville for titles and big figures, Fira Sans Condensed for
 *   names and tables (`fonts.ts`, loaded lazily: `use-fonts.ts`).
 * - Calm, precise motion: wipes and gold rules drawn from the left,
 *   staggered rows, scoreboard flips on the figures, one sheen across the
 *   gold on a milestone.
 * - The score bug carries the long innings: the side's earlier innings
 *   ("325 & 112-2"), the lead or deficit from the innings totals in a
 *   multi-innings match (else the chase), the partnership first on its
 *   strip, and a "this over" tray.
 */

import { contrastRatio, overlayPalette, parseHex, withAlpha } from "../../overlay-themes";
import type { OverlayPalette } from "../../overlay-themes";
import type { BroadcastPackage, MotionSpec, PaletteContext } from "../types";
import { FONT_STACKS } from "./use-fonts";
import { TC } from "./kit";
import { TEST_CLASSIC_ELEMENTS } from "./elements";

export const TEST_CLASSIC_ID = "test-classic";

/** The `--ov-*` palette (Standard's components read it, e.g. a preview). */
function palette(): OverlayPalette {
  const base = overlayPalette("standard");
  return {
    ...base,
    bar: TC.navy,
    barText: TC.ivory,
    barMuted: withAlpha(TC.ivory, 0.74),
    panel: TC.navyLo,
    panelText: TC.ivory,
    panelMuted: withAlpha(TC.ivory, 0.74),
    card: TC.ivory,
    cardText: TC.ink,
    cardMuted: TC.inkMuted,
    cardLine: TC.ivoryLine,
    accent: TC.gold,
    accentText: TC.ink,
    line: withAlpha(TC.ivory, 0.18),
    shadow: "0 12px 30px rgba(3, 9, 22, 0.42)",
    team1: TC.navyLo,
    team1Text: TC.ivory,
    team2: TC.navyLo,
    team2Text: TC.ivory,
  };
}

/**
 * A team colour that shows on the navy bar: its primary, else its
 * secondary, else ivory (a navy or black side would vanish into the bar).
 */
export function teamStripe(
  colours: { primary: string | null; secondary: string | null } | null | undefined,
  fallback: string,
): string {
  for (const c of [colours?.primary, colours?.secondary]) {
    if (c && parseHex(c) && contrastRatio(c, TC.navy) >= 1.6) return c;
  }
  return fallback;
}

function vars(ctx: PaletteContext): Record<string, string> {
  const t = ctx.state?.team_colors;
  return {
    "--tc-team1": teamStripe(t?.team1, TC.gold),
    "--tc-team2": teamStripe(t?.team2, TC.ivory),
  };
}

const EASE_OUT = "cubic-bezier(0.22, 0.8, 0.2, 1)";
const EASE_IN = "cubic-bezier(0.6, 0, 0.8, 0.2)";

/** The layer's part: a short settle in; the components draw their own wipes. */
const settleIn = (ms = 260): MotionSpec => ({
  keyframes: [{ opacity: 0 }, { opacity: 1 }],
  durationMs: ms,
  easing: EASE_OUT,
});

/** Out: a quiet drop and fade. */
const sinkOut = (ms = 340, px = 14): MotionSpec => ({
  keyframes: [
    { opacity: 1, transform: "translateY(0)" },
    { opacity: 0, transform: `translateY(${px}px)` },
  ],
  durationMs: ms,
  easing: EASE_IN,
});

/** A card leaves by closing upwards from its foot. */
const cardOut: MotionSpec = {
  keyframes: [
    { opacity: 1, transform: "scale(1)" },
    { opacity: 0, transform: "scale(0.985)" },
  ],
  durationMs: 360,
  easing: EASE_IN,
};

/** A sting leaves with a wipe from the left. */
const stingOut: MotionSpec = {
  keyframes: [
    { clipPath: "inset(0 0 0 0)", opacity: 1 },
    { clipPath: "inset(0 0 0 100%)", opacity: 0.6 },
  ],
  durationMs: 420,
  easing: EASE_IN,
};

const strap = { enter: settleIn(), exit: sinkOut() };
const card = { enter: settleIn(220), exit: cardOut };

export const testClassicPackage: BroadcastPackage = {
  id: TEST_CLASSIC_ID,
  kind: "broadcast",
  palette,
  vars,
  // The faces load lazily (see use-fonts.ts): no class on the stage root;
  // every element applies them itself.
  fonts: {
    display: FONT_STACKS.serif,
    text: FONT_STACKS.sans,
    figures: FONT_STACKS.serif,
  },
  motion: {
    scoreBug: { enter: settleIn(300), exit: sinkOut(380, 24) },
    batterLowerThird: strap,
    bowlerLowerThird: strap,
    newBatter: strap,
    newBowler: strap,
    partnership: strap,
    chase: strap,
    thisOver: strap,
    sting: { enter: settleIn(200), exit: stingOut },
    scorecard: card,
    bowlingCard: card,
    fallOfWickets: card,
    playingXi: card,
    toss: card,
    matchIntro: card,
    playerProfile: strap,
    pointsTable: card,
    leaderboard: card,
    nextFixture: card,
    result: card,
    matchSummary: card,
    inningsBreak: card,
    playerOfTheMatch: strap,
    winPredictor: card,
    projectedScore: card,
    breakStrap: strap,
    message: strap,
    sponsors: { enter: settleIn(400), exit: sinkOut(300, -8) },
    ticker: { enter: settleIn(300), exit: sinkOut(300, 12) },
    runsPerOver: card,
    worm: card,
    runRates: card,
    wagonWheel: card,
  },
  elements: TEST_CLASSIC_ELEMENTS,
};
