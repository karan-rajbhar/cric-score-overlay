"use client";

/**
 * Franchise night: a glossy prime-time franchise-league package. Dark
 * metallic glass lit by the teams' colours, one gold accent, condensed
 * caps, big figures; a wide score bug with both crests, a rate strip with
 * the chase meter or projected totals; stings that slam in; lower thirds
 * with a photo slot; timeout and leader cards.
 *
 * Original artwork only: crests are the match's own logos (or codes), no
 * league, broadcaster or sponsor marks.
 */

import { winPredictorFromLive } from "~/lib/win-predictor";
import { ballsPerOverOf } from "../../score-bug";
import type {
  BroadcastPackage,
  ElementMotion,
  MotionSpec,
  OverlayElementProps,
} from "../types";
import {
  BreakCard,
  EstimateCard,
  FranchiseBowlingCard,
  FranchiseFallOfWickets,
  FranchiseMatchIntro,
  FranchisePlayingXi,
  FranchiseResult,
  FranchiseScorecard,
  FranchiseToss,
  PartnershipCard,
  SummaryCard,
  ThisOverCard,
} from "./cards";
import { ChartElement, FranchiseWagonWheel } from "./charts";
import { FranchiseSponsors, FranchiseTicker } from "./corner";
import { FranchiseScoreBug } from "./score-bug";
import {
  FranchiseLeaderboard,
  FranchiseNextFixture,
  FranchisePointsTable,
} from "./standings";
import { FranchiseSting } from "./sting";
import {
  BreakBandStrap,
  FranchiseBatterLowerThird,
  FranchiseBowlerLowerThird,
  FranchiseChase,
  FranchiseMessage,
  FranchiseNewBatter,
  FranchiseNewBowler,
  FranchisePartnershipStrap,
  FranchisePlayerOfTheMatch,
  FranchisePlayerProfile,
  FranchiseThisOverStrap,
  PredictorStrap,
  ProjectionStrap,
} from "./straps";
import { packageFonts } from "../shared/fonts";
import { saira } from "./fonts";
import { franchisePalette, franchiseVars } from "./theme";

const EASE_OUT = "cubic-bezier(0.16, 1, 0.3, 1)";
const EASE_IN = "cubic-bezier(0.7, 0, 0.84, 0)";

const spec = (
  keyframes: Keyframe[],
  durationMs: number,
  easing = EASE_OUT,
): MotionSpec => ({ keyframes, durationMs, easing });

/** The bar opens from its centre and settles; leaves the same way. */
const BAR: ElementMotion = {
  enter: spec(
    [
      { opacity: 0, transform: "translateY(36px)" },
      { opacity: 1, transform: "translateY(0)" },
    ],
    600,
  ),
  exit: spec(
    [
      { opacity: 1, transform: "translateY(0)" },
      { opacity: 0, transform: "translateY(40px)" },
    ],
    340,
    EASE_IN,
  ),
  update: spec(
    [
      { filter: "brightness(1)" },
      { filter: "brightness(1.28)" },
      { filter: "brightness(1)" },
    ],
    420,
  ),
};

/** Lower thirds slide in from the left edge and go back out. */
const STRAP: ElementMotion = {
  enter: spec(
    [
      { opacity: 0, transform: "translateX(-64px)" },
      { opacity: 1, transform: "translateX(0)" },
    ],
    560,
  ),
  exit: spec(
    [
      { opacity: 1, transform: "translateX(0)" },
      { opacity: 0, transform: "translateX(-48px)" },
    ],
    320,
    EASE_IN,
  ),
  update: spec(
    [
      { opacity: 0.4, transform: "translateX(-16px)" },
      { opacity: 1, transform: "translateX(0)" },
    ],
    380,
  ),
};

/** Full cards rise and settle; leave by sinking away. */
const CARD: ElementMotion = {
  enter: spec(
    [
      { opacity: 0, transform: "translateY(32px) scale(0.97)" },
      { opacity: 1, transform: "translateY(0) scale(1)" },
    ],
    560,
  ),
  exit: spec(
    [
      { opacity: 1, transform: "translateY(0) scale(1)" },
      { opacity: 0, transform: "translateY(16px) scale(0.985)" },
    ],
    300,
    EASE_IN,
  ),
};

/** Stings: the burst is inside; the layer cuts in and wipes out fast. */
const STING: ElementMotion = {
  enter: spec([{ opacity: 0 }, { opacity: 1 }], 120),
  exit: spec(
    [
      { clipPath: "inset(0 0 0 0)", transform: "translateX(0)" },
      { clipPath: "inset(0 0 0 100%)", transform: "translateX(120px)" },
    ],
    420,
    EASE_IN,
  ),
  update: spec(
    [
      { filter: "brightness(1.8)" },
      { filter: "brightness(1)" },
    ],
    300,
  ),
};

/** The corner plate slides in from the right. */
const CORNER: ElementMotion = {
  enter: spec(
    [
      { opacity: 0, transform: "translateX(48px)" },
      { opacity: 1, transform: "translateX(0)" },
    ],
    500,
  ),
  exit: spec(
    [
      { opacity: 1, transform: "translateX(0)" },
      { opacity: 0, transform: "translateX(32px)" },
    ],
    300,
    EASE_IN,
  ),
};

/** The crawl rises from the bottom edge. */
const CRAWL: ElementMotion = {
  enter: spec(
    [
      { opacity: 0, transform: "translateY(100%)" },
      { opacity: 1, transform: "translateY(0)" },
    ],
    450,
  ),
  exit: spec(
    [
      { opacity: 1, transform: "translateY(0)" },
      { opacity: 0, transform: "translateY(100%)" },
    ],
    300,
    EASE_IN,
  ),
  update: spec([{ opacity: 0.3 }, { opacity: 1 }], 300),
};

export const FRANCHISE_NIGHT: BroadcastPackage = {
  id: "franchise-night",
  kind: "broadcast",
  palette: (ctx) => franchisePalette(ctx.state),
  vars: (ctx) => franchiseVars(ctx.state),
  fonts: packageFonts({ display: saira }, "'Arial Narrow', sans-serif"),
  motion: {
    scoreBug: BAR,
    batterLowerThird: STRAP,
    bowlerLowerThird: STRAP,
    newBatter: STRAP,
    newBowler: STRAP,
    partnership: STRAP,
    chase: STRAP,
    thisOver: STRAP,
    winPredictor: STRAP,
    projectedScore: STRAP,
    breakStrap: STRAP,
    message: STRAP,
    playerProfile: STRAP,
    playerOfTheMatch: STRAP,
    sting: STING,
    scorecard: CARD,
    bowlingCard: CARD,
    fallOfWickets: CARD,
    playingXi: CARD,
    toss: CARD,
    matchIntro: CARD,
    pointsTable: CARD,
    leaderboard: CARD,
    nextFixture: CARD,
    result: CARD,
    matchSummary: CARD,
    inningsBreak: CARD,
    runsPerOver: CARD,
    worm: CARD,
    runRates: CARD,
    wagonWheel: CARD,
    sponsors: CORNER,
    ticker: CRAWL,
  },
  elements: {
    scoreBug: FranchiseScoreBug,
    batterLowerThird: FranchiseBatterLowerThird,
    bowlerLowerThird: FranchiseBowlerLowerThird,
    newBatter: FranchiseNewBatter,
    newBowler: FranchiseNewBowler,
    partnership: (p) =>
      p.variant === "strap" ? (
        <FranchisePartnershipStrap state={p.state} strap={p.strap} />
      ) : (
        <PartnershipCard {...p} />
      ),
    chase: FranchiseChase,
    thisOver: (p) =>
      p.variant === "strap" ? (
        <FranchiseThisOverStrap state={p.state} strap={p.strap} bpo={ballsPerOverOf(p.match)} />
      ) : (
        <ThisOverCard {...p} />
      ),
    sting: FranchiseSting,
    playerProfile: FranchisePlayerProfile,
    playerOfTheMatch: FranchisePlayerOfTheMatch,
    winPredictor: (p) => <EstimateElement {...p} />,
    projectedScore: (p) => <EstimateElement {...p} />,
    breakStrap: (p) =>
      p.variant === "card" ? (
        <BreakCard {...p} />
      ) : (
        <BreakBandStrap state={p.state} kind={p.kind} strap={p.strap} />
      ),
    message: FranchiseMessage,
    scorecard: FranchiseScorecard,
    bowlingCard: FranchiseBowlingCard,
    fallOfWickets: FranchiseFallOfWickets,
    playingXi: FranchisePlayingXi,
    toss: FranchiseToss,
    matchIntro: FranchiseMatchIntro,
    result: FranchiseResult,
    matchSummary: (p) => <SummaryCard {...p} />,
    inningsBreak: (p) => <SummaryCard {...p} breakCard />,
    pointsTable: FranchisePointsTable,
    leaderboard: FranchiseLeaderboard,
    nextFixture: FranchiseNextFixture,
    runsPerOver: (p) => <ChartElement {...p} kind="manhattan" />,
    worm: (p) => <ChartElement {...p} kind="worm" />,
    runRates: (p) => <ChartElement {...p} kind="run_rate" />,
    wagonWheel: FranchiseWagonWheel,
    sponsors: FranchiseSponsors,
    ticker: FranchiseTicker,
  },
};

/** The win predictor in a chase; the projection in a first innings. */
function EstimateElement(
  p: OverlayElementProps["winPredictor"] | OverlayElementProps["projectedScore"],
) {
  const bpo = ballsPerOverOf(p.match);
  const chase = winPredictorFromLive(p.state)?.kind === "chase";
  if (p.variant === "strap") {
    return chase ? (
      <PredictorStrap state={p.state} />
    ) : (
      <ProjectionStrap state={p.state} bpo={bpo} />
    );
  }
  return <EstimateCard state={p.state} bpo={bpo} />;
}
