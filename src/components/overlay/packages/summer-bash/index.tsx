"use client";

/**
 * Summer bash: a loud, neon night-league look for T20, after the
 * high-energy, game-like coverage of Australia's summer T20 league
 * (original artwork; no league, team or broadcaster marks).
 *
 * - Deep violet glass panels lit at the edges, neon state colours, each
 *   side in its team colour at full saturation (`colours.ts`).
 * - Wide, heavy type (Unbounded) for scores and headlines, a width-axis
 *   grotesque (Archivo) for names (`fonts.ts`).
 * - Slanted HUD segments, racing stripes and light streaks; angled wipes,
 *   a punch on every score change and big, long stings (`motion.ts`,
 *   `summer-bash.module.css`).
 *
 * Every element is its own: none falls back to Standard.
 */

import type { BroadcastPackage, PackageElements } from "../types";
import { SummerBashScoreBug } from "./bug";
import {
  BowlingCard,
  EstimateCard,
  FallOfWicketsCard,
  LeaderboardCard,
  MatchIntroCard,
  NextFixtureCard,
  PartnershipCardView,
  PlayingXiCard,
  PointsTableCard,
  ResultCard,
  ScorecardCard,
  SummaryCard,
  ThisOverCard,
  TossCard,
} from "./cards";
import { RunRates, RunsPerOver, WagonWheel, Worm } from "./charts";
import { summerBashPalette, summerBashVars } from "./colours";
import { Sponsors, Ticker } from "./extras";
import { SUMMER_BASH_FONTS } from "./fonts";
import { SUMMER_BASH_MOTION } from "./motion";
import { PlayerOfTheMatch, PlayerProfile } from "./players";
import { SummerBashSting } from "./stings";
import {
  BatterLowerThird,
  BowlerLowerThird,
  BreakStrap,
  ChaseStrap,
  Message,
  NewBatter,
  NewBowler,
  PartnershipStrap,
  ThisOverStrap,
  WinPredictorStrap,
} from "./straps";

export const SUMMER_BASH_ID = "summer-bash";

export const SUMMER_BASH_ELEMENTS: PackageElements = {
  scoreBug: SummerBashScoreBug,
  batterLowerThird: BatterLowerThird,
  bowlerLowerThird: BowlerLowerThird,
  newBatter: NewBatter,
  newBowler: NewBowler,
  partnership: (p) =>
    p.variant === "strap" ? (
      <PartnershipStrap state={p.state} layout={p.layout} strap={p.strap} />
    ) : (
      <PartnershipCardView state={p.state} match={p.match} split={p.variant === "split"} />
    ),
  chase: ChaseStrap,
  thisOver: (p) =>
    p.variant === "strap" ? (
      <ThisOverStrap state={p.state} layout={p.layout} strap={p.strap} />
    ) : (
      <ThisOverCard state={p.state} match={p.match} />
    ),
  sting: SummerBashSting,
  scorecard: ScorecardCard,
  bowlingCard: BowlingCard,
  fallOfWickets: FallOfWicketsCard,
  playingXi: PlayingXiCard,
  toss: TossCard,
  matchIntro: MatchIntroCard,
  playerProfile: PlayerProfile,
  pointsTable: (p) => <PointsTableCard state={p.state} table={p.table} />,
  leaderboard: (p) => <LeaderboardCard state={p.state} board={p.board} />,
  nextFixture: (p) => <NextFixtureCard state={p.state} fixture={p.fixture} />,
  result: ResultCard,
  matchSummary: (p) => (
    <SummaryCard state={p.state} match={p.match} innings={p.innings} breakCard={false} />
  ),
  inningsBreak: (p) => (
    <SummaryCard state={p.state} match={p.match} innings={p.innings} breakCard />
  ),
  playerOfTheMatch: PlayerOfTheMatch,
  winPredictor: (p) =>
    p.variant === "strap" ? (
      <WinPredictorStrap state={p.state} layout={p.layout} strap={p.strap} />
    ) : (
      <EstimateCard state={p.state} />
    ),
  projectedScore: (p) =>
    p.variant === "strap" ? (
      <WinPredictorStrap state={p.state} layout={p.layout} strap={p.strap} />
    ) : (
      <EstimateCard state={p.state} />
    ),
  breakStrap: BreakStrap,
  message: Message,
  sponsors: Sponsors,
  ticker: Ticker,
  runsPerOver: RunsPerOver,
  worm: Worm,
  runRates: RunRates,
  wagonWheel: WagonWheel,
};

export const SUMMER_BASH: BroadcastPackage = {
  id: SUMMER_BASH_ID,
  kind: "broadcast",
  palette: summerBashPalette,
  vars: summerBashVars,
  fonts: SUMMER_BASH_FONTS,
  motion: SUMMER_BASH_MOTION,
  elements: SUMMER_BASH_ELEMENTS,
};
