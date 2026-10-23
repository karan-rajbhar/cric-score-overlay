"use client";

/**
 * Hundred-ball countdown: a bold, minimal broadcast package for short
 * formats. Balls, never overs: the bug's second hero figure counts the
 * innings' balls down, sets (or overs) show as squares, the chase is one
 * statement ("Needs 24 from 15 balls"), cards keep to a few big figures,
 * and stings are typographic, with flat colour wipes.
 *
 * Each graphic builds its own blocks (staggered wipes, rises, number
 * rolls); the stage's layer adds a short fade in and the wipe off.
 */

import type { BroadcastPackage, ElementMotion, MotionSpec } from "../types";
import { HundredScoreBug } from "./bug";
import {
  EstimateCard,
  HundredBowlingCard,
  HundredFallOfWickets,
  HundredInningsBreak,
  HundredLeaderboard,
  HundredMatchIntro,
  HundredMatchSummary,
  HundredNextFixture,
  HundredPartnershipCard,
  HundredPlayerOfTheMatch,
  HundredPlayingXi,
  HundredPointsTable,
  HundredResult,
  HundredScorecard,
  HundredThisOverCard,
  HundredToss,
} from "./cards";
import {
  HundredRunRates,
  HundredRunsPerSet,
  HundredWagonWheel,
  HundredWorm,
} from "./charts";
import { HundredPlayerProfile, HundredSponsors, HundredTicker } from "./extras";
import { HUNDRED_FONTS } from "./fonts";
import { hundredPalette, hundredVars } from "./palette";
import { HundredSting } from "./sting";
import {
  EstimateStrap,
  HundredBatter,
  HundredBowler,
  HundredBreak,
  HundredChase,
  HundredMessage,
  HundredNewBatter,
  HundredNewBowler,
  HundredPartnershipStrap,
  HundredThisOverStrap,
} from "./straps";

const EASE_IN = "cubic-bezier(0.7, 0, 0.84, 0)";

const fadeIn = (ms: number): MotionSpec => ({
  keyframes: [{ opacity: 0 }, { opacity: 1 }],
  durationMs: ms,
});

/** The layer wipes off towards an edge. */
export const wipeOff = (
  to: "left" | "right" | "up" | "down",
  ms = 380,
): MotionSpec => ({
  keyframes: [
    { clipPath: "inset(0 0 0 0)" },
    {
      clipPath: {
        left: "inset(0 100% 0 0)",
        right: "inset(0 0 0 100%)",
        up: "inset(0 0 100% 0)",
        down: "inset(100% 0 0 0)",
      }[to],
    },
  ],
  durationMs: ms,
  easing: EASE_IN,
});

/** A new strap over the last one: a quick drop and settle. */
const bump: MotionSpec = {
  keyframes: [
    { transform: "translateY(12px)", opacity: 0.35 },
    { transform: "none", opacity: 1 },
  ],
  durationMs: 280,
};

const strap: ElementMotion = { enter: fadeIn(120), exit: wipeOff("right", 360), update: bump };
const card: ElementMotion = { enter: fadeIn(140), exit: wipeOff("down", 420) };

export const HUNDRED_BALL: BroadcastPackage = {
  id: "hundred-ball",
  kind: "broadcast",
  palette: hundredPalette,
  vars: hundredVars,
  fonts: HUNDRED_FONTS,
  motion: {
    scoreBug: { enter: fadeIn(120), exit: wipeOff("left", 420) },
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
    sting: { enter: fadeIn(60), exit: wipeOff("right", 340) },
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
    sponsors: { enter: fadeIn(120), exit: wipeOff("right", 320) },
    ticker: { enter: fadeIn(120), exit: wipeOff("down", 300), update: bump },
  },
  elements: {
    scoreBug: HundredScoreBug,
    batterLowerThird: HundredBatter,
    bowlerLowerThird: HundredBowler,
    newBatter: HundredNewBatter,
    newBowler: HundredNewBowler,
    partnership: (p) =>
      p.variant === "strap" ? <HundredPartnershipStrap {...p} /> : <HundredPartnershipCard {...p} />,
    chase: HundredChase,
    thisOver: (p) =>
      p.variant === "strap" ? <HundredThisOverStrap {...p} /> : <HundredThisOverCard {...p} />,
    sting: HundredSting,
    scorecard: HundredScorecard,
    bowlingCard: HundredBowlingCard,
    fallOfWickets: HundredFallOfWickets,
    playingXi: HundredPlayingXi,
    toss: HundredToss,
    matchIntro: HundredMatchIntro,
    playerProfile: HundredPlayerProfile,
    pointsTable: HundredPointsTable,
    leaderboard: HundredLeaderboard,
    nextFixture: HundredNextFixture,
    result: HundredResult,
    matchSummary: HundredMatchSummary,
    inningsBreak: HundredInningsBreak,
    playerOfTheMatch: HundredPlayerOfTheMatch,
    winPredictor: (p) =>
      p.variant === "strap" ? (
        <EstimateStrap p={p} testId="hb-win-predictor" />
      ) : (
        <EstimateCard state={p.state} testId="hb-win-predictor" />
      ),
    projectedScore: (p) =>
      p.variant === "strap" ? (
        <EstimateStrap p={p} testId="hb-projected" />
      ) : (
        <EstimateCard state={p.state} testId="hb-projected" />
      ),
    breakStrap: HundredBreak,
    message: HundredMessage,
    sponsors: HundredSponsors,
    ticker: HundredTicker,
    runsPerOver: HundredRunsPerSet,
    worm: HundredWorm,
    runRates: HundredRunRates,
    wagonWheel: HundredWagonWheel,
  },
};
