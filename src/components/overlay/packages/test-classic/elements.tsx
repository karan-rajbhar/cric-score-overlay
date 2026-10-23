"use client";

/** Every element of the Test classic package (all 33: no fallbacks). */

import { winPredictorFromLive } from "~/lib/win-predictor";
import type { OverlayElementProps, PackageElements } from "../types";
import {
  BowlingCard,
  BreakCard,
  FallOfWicketsCard,
  InningsBreakCard,
  LeaderboardCard,
  MatchIntroCard,
  MatchSummaryCard,
  NextFixtureCard,
  PartnershipCard,
  PlayingXiCard,
  PointsTableCard,
  ProjectedCard,
  ResultCard,
  ScorecardCard,
  ThisOverCard,
  TossCard,
  WinPredictorCard,
} from "./cards";
import { RunRates, RunsPerOver, WagonWheel, Worm } from "./charts";
import { SponsorPlaque, Ticker } from "./chrome";
import { TestClassicScoreBug } from "./score-bug";
import { TestClassicSting } from "./sting";
import {
  BatterLowerThird,
  BowlerLowerThird,
  BreakStrapView,
  ChaseStrap,
  MessageView,
  NewBatter,
  NewBowler,
  PartnershipStrap,
  PlayerOfTheMatch,
  PlayerProfile,
  ProjectedStrap,
  ThisOverStrap,
  WinPredictorStrap,
} from "./strap-elements";

/**
 * The win predictor and the projected score are one estimate: a chase's
 * chances, or a first innings' projection, whichever the score gives.
 */
function Estimate(p: OverlayElementProps["winPredictor"]) {
  const projection = winPredictorFromLive(p.state)?.kind === "projection";
  if (p.variant === "strap") {
    return projection ? <ProjectedStrap {...p} /> : <WinPredictorStrap {...p} />;
  }
  return projection ? <ProjectedCard {...p} /> : <WinPredictorCard {...p} />;
}

export const TEST_CLASSIC_ELEMENTS: PackageElements = {
  scoreBug: TestClassicScoreBug,
  batterLowerThird: BatterLowerThird,
  bowlerLowerThird: BowlerLowerThird,
  newBatter: NewBatter,
  newBowler: NewBowler,
  partnership: (p) =>
    p.variant === "strap" ? <PartnershipStrap {...p} /> : <PartnershipCard {...p} />,
  chase: ChaseStrap,
  thisOver: (p) =>
    p.variant === "strap" ? <ThisOverStrap {...p} /> : <ThisOverCard {...p} />,
  sting: TestClassicSting,
  scorecard: ScorecardCard,
  bowlingCard: BowlingCard,
  fallOfWickets: FallOfWicketsCard,
  playingXi: PlayingXiCard,
  toss: TossCard,
  matchIntro: MatchIntroCard,
  playerProfile: PlayerProfile,
  pointsTable: PointsTableCard,
  leaderboard: LeaderboardCard,
  nextFixture: NextFixtureCard,
  result: ResultCard,
  matchSummary: MatchSummaryCard,
  inningsBreak: InningsBreakCard,
  playerOfTheMatch: PlayerOfTheMatch,
  winPredictor: Estimate,
  projectedScore: Estimate,
  breakStrap: (p) =>
    p.variant === "card" ? <BreakCard {...p} /> : <BreakStrapView {...p} />,
  message: MessageView,
  sponsors: SponsorPlaque,
  ticker: Ticker,
  runsPerOver: RunsPerOver,
  worm: Worm,
  runRates: RunRates,
  wagonWheel: WagonWheel,
};
