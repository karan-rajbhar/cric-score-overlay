/**
 * Summer bash's motion per element (the stage plays these on each
 * element's layer): fast angled wipes for the score bug and lower thirds,
 * a punch on every score change, cards that drop in from the camera and
 * stings that blow out. The elements add their own staggered reveals,
 * light streaks and bursts inside (CSS, `summer-bash.module.css`).
 */

import type { ElementMotion, MotionSpec, OverlayElementId } from "../types";

const EASE_OUT = "cubic-bezier(0.16, 1, 0.3, 1)";
const EASE_IN = "cubic-bezier(0.7, 0, 0.84, 0)";

/** An angled wipe from the left edge across the frame. */
const wipeIn = (durationMs: number): MotionSpec => ({
  keyframes: [
    {
      clipPath: "polygon(0% 0%, 0% 0%, -12% 100%, 0% 100%)",
      transform: "translateX(-48px)",
      opacity: 0.4,
    },
    {
      clipPath: "polygon(0% 0%, 112% 0%, 100% 100%, 0% 100%)",
      transform: "translateX(0)",
      opacity: 1,
    },
  ],
  durationMs,
  easing: EASE_OUT,
});

/** The same angle wiping off to the right. */
const wipeOut = (durationMs: number): MotionSpec => ({
  keyframes: [
    {
      clipPath: "polygon(0% 0%, 112% 0%, 100% 100%, -12% 100%)",
      transform: "translateX(0)",
      opacity: 1,
    },
    {
      clipPath: "polygon(112% 0%, 112% 0%, 100% 100%, 100% 100%)",
      transform: "translateX(36px)",
      opacity: 0.6,
    },
  ],
  durationMs,
  easing: EASE_IN,
});

/** A punch on a change: a lift and a flash. */
const punch = (durationMs: number): MotionSpec => ({
  keyframes: [
    { transform: "translateY(0)", filter: "brightness(1)" },
    { transform: "translateY(-7px)", filter: "brightness(1.45)", offset: 0.3 },
    { transform: "translateY(0)", filter: "brightness(1)" },
  ],
  durationMs,
  easing: "cubic-bezier(0.34, 1.56, 0.64, 1)",
});

/** Cards drop in out of focus from the camera and land. */
const cardIn: MotionSpec = {
  keyframes: [
    { opacity: 0, transform: "scale(1.08)", filter: "blur(10px)" },
    { opacity: 1, transform: "scale(0.995)", filter: "blur(0px)", offset: 0.7 },
    { opacity: 1, transform: "scale(1)", filter: "blur(0px)" },
  ],
  durationMs: 560,
  easing: EASE_OUT,
};

const cardOut: MotionSpec = {
  keyframes: [
    { opacity: 1, transform: "scale(1) translateY(0)" },
    { opacity: 0, transform: "scale(0.96) translateY(24px)" },
  ],
  durationMs: 320,
  easing: EASE_IN,
};

/** Stings cut in (their burst is their own) and blow out towards the camera. */
const stingIn: MotionSpec = {
  keyframes: [{ opacity: 0 }, { opacity: 1 }],
  durationMs: 120,
  easing: EASE_OUT,
};

const stingOut: MotionSpec = {
  keyframes: [
    { opacity: 1, transform: "scale(1)", filter: "blur(0px)" },
    { opacity: 0, transform: "scale(1.18)", filter: "blur(10px)" },
  ],
  durationMs: 420,
  easing: EASE_IN,
};

const fromRight: MotionSpec = {
  keyframes: [
    { opacity: 0, transform: "translateX(80px)" },
    { opacity: 1, transform: "translateX(0)" },
  ],
  durationMs: 520,
  easing: EASE_OUT,
};

const toRight: MotionSpec = {
  keyframes: [
    { opacity: 1, transform: "translateX(0)" },
    { opacity: 0, transform: "translateX(80px)" },
  ],
  durationMs: 300,
  easing: EASE_IN,
};

const fromBelow: MotionSpec = {
  keyframes: [
    { opacity: 0, transform: "translateY(72px)" },
    { opacity: 1, transform: "translateY(0)" },
  ],
  durationMs: 460,
  easing: EASE_OUT,
};

const toBelow: MotionSpec = {
  keyframes: [
    { opacity: 1, transform: "translateY(0)" },
    { opacity: 0, transform: "translateY(72px)" },
  ],
  durationMs: 280,
  easing: EASE_IN,
};

const strap: ElementMotion = {
  enter: wipeIn(480),
  exit: wipeOut(320),
  update: punch(360),
};

const card: ElementMotion = { enter: cardIn, exit: cardOut, update: punch(360) };

export const SUMMER_BASH_MOTION: Partial<Record<OverlayElementId, ElementMotion>> =
  {
    scoreBug: { enter: wipeIn(560), exit: wipeOut(360), update: punch(380) },
    batterLowerThird: strap,
    bowlerLowerThird: strap,
    newBatter: strap,
    newBowler: strap,
    partnership: strap,
    chase: strap,
    thisOver: strap,
    winPredictor: strap,
    projectedScore: strap,
    breakStrap: strap,
    message: strap,
    playerProfile: strap,
    playerOfTheMatch: strap,
    sting: { enter: stingIn, exit: stingOut },
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
    sponsors: { enter: fromRight, exit: toRight },
    ticker: { enter: fromBelow, exit: toBelow, update: punch(320) },
  };
