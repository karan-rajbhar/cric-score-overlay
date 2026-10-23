"use client";

/**
 * The Standard package's components for every element: the plain
 * packages (Standard, Light, Team colours, Custom) draw with these, and a
 * broadcast package falls back to them for any element it leaves out.
 * Thin adapters over the overlay's components; positions are theirs.
 */

import type { ReactNode } from "react";
import { ChartCard } from "../charts-card";
import { CornerWatermark } from "../corner-watermark";
import { NewsTicker } from "../news-ticker";
import { FullScreen, OverlayFrame } from "../overlay-kit";
import {
  OverSummaryCard,
  PartnershipCard,
  PlayingXiCard,
  ResultCard,
  TossCard,
} from "../presentation-card-views";
import { CareerCard, InningsFiguresCard, SeriesCard } from "../profile-card";
import { ScoreBug } from "../score-bug";
import {
  FallOfWicketsCard,
  InningsCard,
} from "../scorecard-cards";
import {
  LeaderboardCard,
  NextFixtureCard,
  PointsTableCard,
} from "../standings-cards";
import { StingCard } from "../sting-card";
import { StrapView } from "../strap-views";
import {
  IntroCard,
  PartnershipView,
  PlayerOfTheMatch,
  StoppageCard,
  SummaryCard,
  TeamListCard,
} from "../suite-views";
import type { ActiveLowerThirdStrap } from "../types";
import { WagonWheelCard } from "../wagon-wheel-card";
import { WinPredictorCard } from "../win-predictor-card";
import type { ElementBaseProps, PackageElements } from "./types";

/** A full-screen card, centred on the canvas. */
function Full({ p, children }: { p: ElementBaseProps; children: ReactNode }) {
  return (
    <OverlayFrame state={p.state} theme={p.theme} customColors={p.customColors}>
      <FullScreen>{children}</FullScreen>
    </OverlayFrame>
  );
}

/** A lower-third card, above the score bar. */
function Lower({ p, children }: { p: ElementBaseProps; children: ReactNode }) {
  return (
    <OverlayFrame
      state={p.state}
      theme={p.theme}
      customColors={p.customColors}
      className="pointer-events-none fixed inset-x-0 bottom-[12rem] z-30 flex justify-center px-12"
    >
      {children}
    </OverlayFrame>
  );
}

/** The strap a producer put up, or one of `type` built from the score. */
function Strap({
  p,
  strap,
  type,
}: {
  p: ElementBaseProps;
  strap: ActiveLowerThirdStrap | null;
  type: ActiveLowerThirdStrap["type"];
}) {
  return (
    <StrapView
      strap={strap ?? { id: `standard-${type}`, type, title: "" }}
      state={p.state}
      layout={p.layout}
      theme={p.theme}
      customColors={p.customColors}
    />
  );
}

export const STANDARD_ELEMENTS: PackageElements = {
  scoreBug: (p) => (
    <ScoreBug
      state={p.state}
      match={p.match}
      layout={p.layout}
      sponsor={p.sponsor}
      marginOffsetPx={p.marginOffsetPx}
      theme={p.theme}
      customColors={p.customColors}
    />
  ),
  batterLowerThird: (p) =>
    p.variant === "strap" ? (
      <Strap
        p={p}
        strap={p.strap}
        type={p.slot === "last_out" ? "last_wicket" : "batsman"}
      />
    ) : (
      <Lower p={p}>
        <InningsFiguresCard state={p.state} slot={p.slot} />
      </Lower>
    ),
  bowlerLowerThird: (p) =>
    p.variant === "strap" ? (
      <Strap p={p} strap={p.strap} type="bowler" />
    ) : (
      <Lower p={p}>
        <InningsFiguresCard state={p.state} slot="bowler" />
      </Lower>
    ),
  newBatter: (p) => <Strap p={p} strap={p.strap} type="new_batter" />,
  newBowler: (p) => <Strap p={p} strap={p.strap} type="new_bowler" />,
  partnership: (p) =>
    p.variant === "strap" ? (
      <Strap p={p} strap={p.strap} type="partnership" />
    ) : (
      <Full p={p}>
        {p.variant === "card" ? (
          <PartnershipCard state={p.state} innings={p.match?.innings ?? []} />
        ) : (
          <PartnershipView state={p.state} innings={p.match?.innings ?? []} />
        )}
      </Full>
    ),
  chase: (p) => <Strap p={p} strap={p.strap} type="target" />,
  thisOver: (p) =>
    p.variant === "strap" ? (
      <Strap p={p} strap={p.strap} type="over_end" />
    ) : (
      <Full p={p}>
        <OverSummaryCard state={p.state} />
      </Full>
    ),
  sting: (p) => (
    <StingCard sting={p.sting} theme={p.theme} customColors={p.customColors} />
  ),
  scorecard: (p) => (
    <Full p={p}>
      <InningsCard
        state={p.state}
        innings={p.innings}
        teamName={p.teamName}
        kind={p.full ? "full" : "batting"}
      />
    </Full>
  ),
  bowlingCard: (p) => (
    <Full p={p}>
      <InningsCard
        state={p.state}
        innings={p.innings}
        teamName={p.teamName}
        kind="bowling"
      />
    </Full>
  ),
  fallOfWickets: (p) => (
    <Full p={p}>
      <FallOfWicketsCard
        state={p.state}
        innings={p.innings}
        teamName={p.teamName}
      />
    </Full>
  ),
  playingXi: (p) => (
    <Full p={p}>
      {p.side === null ? (
        <PlayingXiCard state={p.state} match={p.match} />
      ) : (
        <TeamListCard state={p.state} match={p.match} side={p.side} />
      )}
    </Full>
  ),
  toss: (p) => (
    <Full p={p}>
      <TossCard state={p.state} match={p.match} />
    </Full>
  ),
  matchIntro: (p) => (
    <Full p={p}>
      <IntroCard state={p.state} match={p.match} />
    </Full>
  ),
  playerProfile: (p) => (
    <Lower p={p}>
      {p.mode === "career" ? (
        <CareerCard state={p.state} slot={p.slot} profile={p.profile} />
      ) : (
        <SeriesCard
          state={p.state}
          slot={p.slot}
          series={p.snapshots?.series}
        />
      )}
    </Lower>
  ),
  pointsTable: (p) => (
    <Full p={p}>
      <PointsTableCard state={p.state} table={p.table} />
    </Full>
  ),
  leaderboard: (p) => (
    <Full p={p}>
      <LeaderboardCard state={p.state} board={p.board} />
    </Full>
  ),
  nextFixture: (p) => (
    <Full p={p}>
      <NextFixtureCard state={p.state} fixture={p.fixture} />
    </Full>
  ),
  result: (p) => (
    <Full p={p}>
      <ResultCard state={p.state} match={p.match} innings={p.innings} />
    </Full>
  ),
  matchSummary: (p) => (
    <Full p={p}>
      <SummaryCard state={p.state} match={p.match} innings={p.innings} />
    </Full>
  ),
  inningsBreak: (p) => (
    <Full p={p}>
      <SummaryCard
        state={p.state}
        match={p.match}
        innings={p.innings}
        breakCard
      />
    </Full>
  ),
  playerOfTheMatch: (p) => (
    <Lower p={p}>
      <PlayerOfTheMatch state={p.state} match={p.match} innings={p.innings} />
    </Lower>
  ),
  winPredictor: (p) =>
    p.variant === "strap" ? (
      <Strap p={p} strap={p.strap} type="win_predictor" />
    ) : (
      <Full p={p}>
        <WinPredictorCard state={p.state} />
      </Full>
    ),
  projectedScore: (p) =>
    p.variant === "strap" ? (
      <Strap p={p} strap={p.strap} type="win_predictor" />
    ) : (
      <Full p={p}>
        <WinPredictorCard state={p.state} />
      </Full>
    ),
  breakStrap: (p) =>
    p.variant === "card" &&
    (p.kind === "drinks" || p.kind === "rain_delay") ? (
      <Lower p={p}>
        <StoppageCard
          state={p.state}
          kind={p.kind === "drinks" ? "drinks" : "rain"}
        />
      </Lower>
    ) : (
      <Strap p={p} strap={p.strap} type={p.kind} />
    ),
  message: (p) => <Strap p={p} strap={p.strap} type="custom" />,
  sponsors: (p) => (
    <CornerWatermark
      title={p.title}
      sponsors={p.sponsors}
      visible={p.sponsors.length > 0}
      theme={p.theme}
      customColors={p.customColors}
    />
  ),
  ticker: (p) => (
    <NewsTicker
      text={p.text}
      visible
      theme={p.theme}
      customColors={p.customColors}
    />
  ),
  runsPerOver: (p) => (
    <Full p={p}>
      <ChartCard state={p.state} match={p.match} kind="manhattan" />
    </Full>
  ),
  worm: (p) => (
    <Full p={p}>
      <ChartCard state={p.state} match={p.match} kind="worm" />
    </Full>
  ),
  runRates: (p) => (
    <Full p={p}>
      <ChartCard state={p.state} match={p.match} kind="run_rate" />
    </Full>
  ),
  wagonWheel: (p) => (
    <Full p={p}>
      <WagonWheelCard state={p.state} match={p.match} batterId={p.batterId} />
    </Full>
  ),
};
