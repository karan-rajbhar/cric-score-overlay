"use client";

/**
 * World event: a global tournament's broadcast look. Deep indigo and
 * crisp white panels, one event accent (magenta into violet) with a mint
 * powerplay and boundary tone, each side in its own team colour, bold
 * geometric caps and figures, and purposeful motion (wipes along the
 * panels' angled edges, staggered rows, rolling figures, energetic stings).
 *
 * Original artwork throughout: no event, league or broadcaster marks.
 */

import type { BroadcastPackage, ElementMotion, MotionSpec, PackageElements } from "../types";
import {
  WorldEventBowlingCard,
  WorldEventFallOfWickets,
  WorldEventInningsBreak,
  WorldEventMatchIntro,
  WorldEventMatchSummary,
  WorldEventPartnershipCard,
  WorldEventPlayerOfTheMatch,
  WorldEventPlayingXi,
  WorldEventResult,
  WorldEventScorecard,
  WorldEventThisOverCard,
  WorldEventToss,
} from "./cards";
import {
  WorldEventProjectedScore,
  WorldEventRunRates,
  WorldEventRunsPerOver,
  WorldEventWagonWheel,
  WorldEventWinPredictor,
  WorldEventWorm,
} from "./charts";
import { WorldEventSponsors, WorldEventTicker } from "./corner";
import {
  WorldEventBatterLowerThird,
  WorldEventBowlerLowerThird,
  WorldEventBreakStrap,
  WorldEventChase,
  WorldEventMessage,
  WorldEventNewBatter,
  WorldEventNewBowler,
  WorldEventPartnershipStrap,
  WorldEventPlayerProfile,
  WorldEventThisOverStrap,
  WorldEventWinStrap,
} from "./lower-thirds";
import { WorldEventScoreBug } from "./score-bug";
import { WorldEventPointsTable, WorldEventLeaderboard, WorldEventNextFixture } from "./standings";
import { WorldEventSting } from "./sting";
import { worldEventPalette, worldEventVars } from "./theme";

/** Every element, in this package's look (none falls back to Standard). */
export const WORLD_EVENT_ELEMENTS: PackageElements = {
  scoreBug: WorldEventScoreBug,
  batterLowerThird: WorldEventBatterLowerThird,
  bowlerLowerThird: WorldEventBowlerLowerThird,
  newBatter: WorldEventNewBatter,
  newBowler: WorldEventNewBowler,
  partnership: (p) =>
    p.variant === "strap" ? (
      <WorldEventPartnershipStrap state={p.state} layout={p.layout} strap={p.strap} />
    ) : (
      <WorldEventPartnershipCard {...p} />
    ),
  chase: WorldEventChase,
  thisOver: (p) =>
    p.variant === "strap" ? (
      <WorldEventThisOverStrap state={p.state} layout={p.layout} strap={p.strap} />
    ) : (
      <WorldEventThisOverCard state={p.state} />
    ),
  sting: WorldEventSting,
  scorecard: WorldEventScorecard,
  bowlingCard: WorldEventBowlingCard,
  fallOfWickets: WorldEventFallOfWickets,
  playingXi: WorldEventPlayingXi,
  toss: WorldEventToss,
  matchIntro: WorldEventMatchIntro,
  playerProfile: WorldEventPlayerProfile,
  pointsTable: WorldEventPointsTable,
  leaderboard: WorldEventLeaderboard,
  nextFixture: WorldEventNextFixture,
  result: WorldEventResult,
  matchSummary: WorldEventMatchSummary,
  inningsBreak: WorldEventInningsBreak,
  playerOfTheMatch: WorldEventPlayerOfTheMatch,
  winPredictor: (p) =>
    p.variant === "strap" ? (
      <WorldEventWinStrap state={p.state} layout={p.layout} strap={p.strap} />
    ) : (
      <WorldEventWinPredictor {...p} />
    ),
  projectedScore: (p) =>
    p.variant === "strap" ? (
      <WorldEventWinStrap state={p.state} layout={p.layout} strap={p.strap} />
    ) : (
      <WorldEventProjectedScore {...p} />
    ),
  breakStrap: WorldEventBreakStrap,
  message: WorldEventMessage,
  sponsors: WorldEventSponsors,
  ticker: WorldEventTicker,
  runsPerOver: WorldEventRunsPerOver,
  worm: WorldEventWorm,
  runRates: WorldEventRunRates,
  wagonWheel: WorldEventWagonWheel,
};

const EASE_OUT = "cubic-bezier(0.16, 1, 0.3, 1)";
const EASE_IN = "cubic-bezier(0.7, 0, 0.84, 0)";

const fade = (durationMs: number): MotionSpec => ({
  keyframes: [{ opacity: 0 }, { opacity: 1 }],
  durationMs,
  easing: EASE_OUT,
});

/** The bar drops away and fades. */
const sinkOut: MotionSpec = {
  keyframes: [
    { opacity: 1, transform: "translateY(0)" },
    { opacity: 0, transform: "translateY(36px)" },
  ],
  durationMs: 320,
  easing: EASE_IN,
};

/** Lower thirds wipe back to their left edge. */
const wipeToLeft: MotionSpec = {
  keyframes: [
    { clipPath: "inset(0 0 0 0)", opacity: 1 },
    { clipPath: "inset(0 calc(100% - 96px) 0 0)", opacity: 0.4 },
  ],
  durationMs: 420,
  easing: EASE_IN,
};

/** Full-screen cards settle back and fade. */
const cardOut: MotionSpec = {
  keyframes: [
    { opacity: 1, transform: "scale(1)" },
    { opacity: 0, transform: "scale(0.97) translateY(14px)" },
  ],
  durationMs: 340,
  easing: EASE_IN,
};

/** A new strap on air: a quick re-wipe from the left. */
const rewipe: MotionSpec = {
  keyframes: [{ clipPath: "inset(0 100% 0 0)" }, { clipPath: "inset(0 0 0 0)" }],
  durationMs: 420,
  easing: EASE_OUT,
};

const bug: ElementMotion = {
  enter: {
    keyframes: [
      { opacity: 0, transform: "translateY(28px)" },
      { opacity: 1, transform: "translateY(0)" },
    ],
    durationMs: 460,
    easing: EASE_OUT,
  },
  exit: sinkOut,
};

const lower: ElementMotion = { enter: fade(160), exit: wipeToLeft, update: rewipe };
const card: ElementMotion = { enter: fade(220), exit: cardOut };

/** Stings wipe off to the right; a new one re-enters with a flash. */
const sting: ElementMotion = {
  enter: fade(120),
  exit: {
    keyframes: [
      { clipPath: "inset(0 0 0 0)", opacity: 1 },
      { clipPath: "inset(0 0 0 100%)", opacity: 0.6 },
    ],
    durationMs: 440,
    easing: EASE_IN,
  },
  update: {
    keyframes: [{ filter: "brightness(1.7)" }, { filter: "brightness(1)" }],
    durationMs: 380,
    easing: EASE_OUT,
  },
};

/** The corner plate slides in from the right edge. */
const corner: ElementMotion = {
  enter: {
    keyframes: [
      { opacity: 0, transform: "translateX(40px)" },
      { opacity: 1, transform: "translateX(0)" },
    ],
    durationMs: 480,
    easing: EASE_OUT,
  },
  exit: { keyframes: [{ opacity: 1 }, { opacity: 0 }], durationMs: 260, easing: EASE_IN },
};

/** The ticker rises from the bottom edge; new text fades through. */
const ticker: ElementMotion = {
  enter: {
    keyframes: [{ transform: "translateY(46px)" }, { transform: "translateY(0)" }],
    durationMs: 420,
    easing: EASE_OUT,
  },
  exit: {
    keyframes: [{ transform: "translateY(0)" }, { transform: "translateY(46px)" }],
    durationMs: 300,
    easing: EASE_IN,
  },
  update: { keyframes: [{ opacity: 0.25 }, { opacity: 1 }], durationMs: 360, easing: EASE_OUT },
};

export const WORLD_EVENT_PACKAGE: BroadcastPackage = {
  id: "world-event",
  kind: "broadcast",
  palette: worldEventPalette,
  vars: worldEventVars,
  motion: {
    scoreBug: bug,
    sting,
    sponsors: corner,
    ticker,
    batterLowerThird: lower,
    bowlerLowerThird: lower,
    newBatter: lower,
    newBowler: lower,
    chase: lower,
    playerProfile: lower,
    playerOfTheMatch: lower,
    message: lower,
    breakStrap: lower,
    partnership: card,
    thisOver: lower,
    winPredictor: card,
    projectedScore: card,
    scorecard: card,
    bowlingCard: card,
    fallOfWickets: card,
    playingXi: card,
    toss: card,
    matchIntro: card,
    pointsTable: card,
    leaderboard: card,
    nextFixture: card,
    result: card,
    matchSummary: card,
    inningsBreak: card,
    runsPerOver: card,
    worm: card,
    runRates: card,
    wagonWheel: card,
  },
  elements: WORLD_EVENT_ELEMENTS,
};
