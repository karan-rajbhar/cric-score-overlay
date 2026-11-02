"use client";

import { useCallback, useRef, useState, Suspense } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import { backLabelOf, matchTrail, parentOf } from "~/lib/navigation";
import { setUrlParam } from "~/lib/url-state";
import { Button } from "~/components/ui/button";
import { PageTrail } from "~/components/ds/page-trail";
import { ScoreLine } from "~/components/ds/score";
import { PinnedTabs, Tabs, TabsContent } from "~/components/ds/tabs";
import dynamic from "next/dynamic";
import { MatchSummary } from "~/components/matches/match-summary";
import { MatchScorecard } from "~/components/matches/match-scorecard";
import { MatchBalls } from "~/components/matches/match-balls";
import { MatchSquads } from "~/components/matches/match-squads";
import { LiveFreshness } from "~/components/matches/live-freshness";
import {
  useMatchDetailQuery,
  useMatchAdminQuery,
} from "~/lib/hooks/useMatchQueries";
import { useScrolledPast } from "~/lib/hooks/useScrolledPast";
import { sidesInBattingOrder } from "~/lib/cricket";
import { matchShareMessage } from "~/lib/share-match";
import {
  DEFAULT_MATCH_TAB,
  matchTabFrom,
  matchTabsOf,
  type MatchTab,
} from "~/lib/match-tabs";
import type { Match } from "~/lib/match-types";
import { useAuth } from "~/lib/auth";
import { cn } from "~/lib/utils";
import { MatchHero, scoreLineSides } from "~/components/matches/match-hero";
import { ContentSheet, ScreenBar, TopStrip } from "~/components/ds/screen";
import MatchDetailLoading from "./loading";
import { EmptyState } from "~/components/ui/empty-state";
import { ChevronLeft, Play, AlertCircle } from "lucide-react";
import { MatchShareMenu } from "~/components/matches/match-share-menu";
import { ShareMatchButton } from "~/components/matches/share-match-button";
import { EntityActions } from "~/components/follow/entity-actions";

const MatchStats = dynamic(
  () => import("~/components/matches/match-stats").then((m) => m.MatchStats),
  { ssr: false },
);
const HeadToHead = dynamic(
  () => import("~/components/matches/head-to-head").then((m) => m.HeadToHead),
  { ssr: false },
);
const MatchMoreMenu = dynamic(
  () =>
    import("~/components/matches/match-more-menu").then(
      (m) => m.MatchMoreMenu,
    ),
  { ssr: false },
);
// Shown to few (scorers of a finished match in no club): loaded on demand.
const ClubSuggestionCard = dynamic(
  () =>
    import("~/components/matches/club-suggestion").then(
      (m) => m.ClubSuggestionCard,
    ),
  { ssr: false },
);

/** The round white buttons of the phone screen bar. */
const screenAction =
  "h-11 w-11 rounded-full border-0 bg-card p-0 shadow-soft ring-1 ring-border/60 hover:bg-accent";
/** The same round action, at the desktop bar's height (ds `icon-sm`). */
const barAction =
  "h-9 w-9 rounded-full border-0 bg-card p-0 shadow-soft ring-1 ring-border/60 hover:bg-accent";

/**
 * Tabs that show per-player figures: they refetch per change, or follow
 * `live_scorecard` while the match is live. The others run off the live
 * totals or their own (ball log) queries.
 */
const FIGURES_TABS = new Set<MatchTab>(["summary", "scorecard", "stats"]);

/**
 * The match page's screen, from a match: the header, then the tabs, which
 * stay on screen as a long tab scrolls. Phones also pin the score in a thin
 * strip, and tablets and desktop in their header, once the hero has gone.
 */
export function MatchView({
  match,
  isScorer,
  activeTab,
  onTabChange,
}: {
  match: Match;
  isScorer: boolean;
  activeTab: MatchTab;
  onTabChange: (tab: MatchTab) => void;
}) {
  const { user } = useAuth();
  const heroEnd = useRef<HTMLDivElement>(null);
  const tabBar = useRef<HTMLDivElement>(null);
  const pinned = useScrolledPast(heroEnd, tabBar);

  const tabs = matchTabsOf(match);
  const shownTab = tabs.some((t) => t.value === activeTab)
    ? activeTab
    : DEFAULT_MATCH_TAB;

  // Scoreboard in batting order: the side that batted first, then the chase.
  const [side1, side2] = sidesInBattingOrder(match);
  const scoreLine = scoreLineSides(match, [side1, side2]);
  // A link share sends the score so far with the link.
  const shareTitle = `${match.team1?.name ?? "Team 1"} vs ${match.team2?.name ?? "Team 2"}`;
  const shareText = matchShareMessage(match);
  const title = match.title || shareTitle;

  const trail = matchTrail(match);
  // Its Back leads here, so Back from here must not lead there.
  const scoringPath = `/matches/${match.id}/score`;

  const share = (className: string) =>
    match.status === "completed" ? (
      <MatchShareMenu
        match={match}
        title={shareTitle}
        text={shareText}
        className={className}
      />
    ) : (
      <ShareMatchButton
        matchId={match.id}
        title={shareTitle}
        text={shareText}
        className={className}
        iconOnly
      />
    );
  const moreMenu = (className: string) => (
    <MatchMoreMenu
      match={match}
      dlsMatch={match}
      canEditDls={isScorer}
      isCreator={match.created_by === user?.id}
      className={className}
    />
  );

  // One action at most, so the tabs start high: scoring for a scorer, Follow
  // for anyone else, until the match is over.
  const canScore =
    isScorer && (match.status === "scheduled" || match.status === "live");
  const canFollow = !["completed", "abandoned", "cancelled"].includes(
    match.status,
  );

  return (
    // Full-bleed page: cancel the app shell's padding so the sticky header
    // and scoreboard bands sit flush under the navigation bar.
    // The shell's wash shows through behind the header.
    // Phones: the sheet runs to the bottom of the screen, under the tab bar.
    // --pinned-top: where the tabs stick, under the strip (phones) or the
    // header (tablets up); --pinned-tabs: their height, for what pins below.
    <div className="-mx-4 -mt-5 min-h-screen overflow-x-clip [--pinned-tabs:3.5rem] [--pinned-top:calc(env(safe-area-inset-top)+1.8125rem)] sm:-mx-6 sm:-mt-8 md:[--pinned-tabs:3.25rem] md:[--pinned-top:7.0625rem] lg:-mx-8 max-md:-mb-32 max-md:flex max-md:flex-col">
      {/* Phones: the score stays once the hero has scrolled away. */}
      <TopStrip show={pinned}>
        <ScoreLine sides={scoreLine} />
      </TopStrip>

      {/* Header */}
      <div className="sticky top-14 z-20 border-b border-border/60 bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/70 max-md:hidden">
        <div className="container mx-auto px-3 py-2.5 sm:px-4">
          {/* The phone ScreenBar's layout: round back, where you are, and
              the actions. Status, format, overs and the club / tournament
              are on the score card right below, not repeated here. */}
          <div className="flex items-center justify-between gap-3">
            <PageTrail
              crumbs={trail}
              current={match.title}
              avoid={scoringPath}
            />
            <ScoreLine
              sides={scoreLine}
              className={cn(
                "flex-1 transition-opacity motion-reduce:transition-none",
                !pinned && "invisible opacity-0",
              )}
            />
            <div className="flex shrink-0 items-center gap-2">
              {share(barAction)}
              {moreMenu(barAction)}
            </div>
          </div>
        </div>
      </div>

      {/* Match header on the wash, Scoreline style */}
      <div className="container mx-auto px-4 pb-9 pt-3 sm:px-6 md:pb-4 md:pt-8">
        <div className="mx-auto max-w-3xl">
          {/* Phones: the screen's own bar instead of the header. */}
          <ScreenBar
            className="mb-3 md:hidden"
            title={title}
            backHref={parentOf(trail)}
            backLabel={backLabelOf(trail)}
            backAvoid={scoringPath}
            action={
              <>
                {share(screenAction)}
                {moreMenu(screenAction)}
              </>
            }
          />
          <h1 className="mb-3 text-balance text-center text-xl font-semibold text-foreground max-md:hidden">
            {match.title}
          </h1>
          <MatchHero match={match} sides={[side1, side2]} page>
            {/* While live: when the score last changed, or that the live
                connection is down (phones have no header). */}
            {match.status === "live" && (
              <LiveFreshness matchId={match.id} className="-mt-2 mb-3" />
            )}
            {(canScore || canFollow) && (
              <div className="flex justify-center">
                {canScore ? (
                  <Button asChild size="sm">
                    <Link href={scoringPath}>
                      <Play className="mr-1.5 h-4 w-4 shrink-0" />
                      {match.status === "scheduled"
                        ? "Start match"
                        : "Continue scoring"}
                    </Link>
                  </Button>
                ) : (
                  <EntityActions
                    kind="match"
                    id={match.id}
                    name={match.title}
                  />
                )}
              </div>
            )}
          </MatchHero>
          <div ref={heroEnd} aria-hidden="true" className="h-px" />
        </div>
      </div>

      {/* Tabs Content: on phones a white sheet rising over the wash */}
      <ContentSheet className="container mx-auto max-md:-mt-6 max-md:mx-0 max-md:mb-0 max-md:flex-1 max-md:pt-3 sm:max-md:mx-0 md:px-4 md:py-6">
        <Tabs
          value={shownTab}
          onValueChange={(value) => onTabChange(matchTabFrom(value))}
        >
          <PinnedTabs ref={tabBar} label="Match sections" tabs={tabs} />

          <TabsContent value="summary" className="mt-4">
            {/* A finished match whose players play for the scorer's club
                (the page follows live_state, so it updates once added). */}
            {isScorer && match.status === "completed" && !match.club_id && (
              <ClubSuggestionCard
                match={match}
                isScorer={isScorer}
                className="mb-4"
              />
            )}
            <MatchSummary match={match} />
            {/* Stats has it once there is a match to look at. */}
            {tabs.length === 2 && (
              <div className="mt-4">
                <HeadToHead
                  team1={match.team1}
                  team2={match.team2}
                  currentMatchId={match.id}
                />
              </div>
            )}
          </TabsContent>

          <TabsContent value="scorecard" className="mt-4">
            <MatchScorecard match={match} />
          </TabsContent>

          <TabsContent value="balls" className="mt-4">
            <MatchBalls match={match} />
          </TabsContent>

          {/* Top performers and head to head are here too; partnerships
              are on the Scorecard. */}
          <TabsContent value="stats" className="mt-4 space-y-6">
            <MatchStats match={match} />
          </TabsContent>

          <TabsContent value="squads" className="mt-4">
            <MatchSquads match={match} />
          </TabsContent>
        </Tabs>
      </ContentSheet>
    </div>
  );
}

function MatchDetailsPageContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const matchId = params.id as string;
  const { user } = useAuth();
  // In the URL, so a reload, Back from a player and a shared link keep it.
  const [activeTab, setActiveTab] = useState(() =>
    matchTabFrom(searchParams.get("tab")),
  );
  const changeTab = useCallback((tab: MatchTab) => {
    setActiveTab(tab);
    setUrlParam("tab", tab, DEFAULT_MATCH_TAB);
  }, []);
  const {
    data: matchData,
    isLoading: loading,
    error: matchQueryError,
    refetch: refetchQuery,
  } = useMatchDetailQuery(matchId, {
    refetchOnChange: FIGURES_TABS.has(activeTab),
    liveScorecard: FIGURES_TABS.has(activeTab),
  });
  const match = matchData ?? null;
  const error = matchQueryError ? matchQueryError.message : null;
  const refetchMatch = useCallback(() => {
    void refetchQuery();
  }, [refetchQuery]);

  const { data: isScorerAdmin } = useMatchAdminQuery(matchId, user?.id);

  if (loading) {
    return <MatchDetailLoading />;
  }

  if (error || !match) {
    return (
      <div className="container mx-auto flex min-h-[60vh] max-w-lg items-center justify-center px-4 py-12">
        <EmptyState
          icon={AlertCircle}
          title={error ? "Couldn't load match" : "Match not found"}
          description={
            error ||
            "This match could not be found or may have been removed from the tournament schedule."
          }
          primaryAction={{
            label: "Back to matches",
            href: "/matches",
            icon: ChevronLeft,
          }}
          secondaryAction={{
            label: "Try again",
            onClick: () => refetchMatch(),
          }}
          className="w-full"
        />
      </div>
    );
  }

  const isScorer =
    (!!user &&
      (match.created_by === user.id ||
        (match.match_admins ?? []).includes(user.id))) ||
    Boolean(isScorerAdmin);

  return (
    <MatchView
      match={match}
      isScorer={isScorer}
      activeTab={activeTab}
      onTabChange={changeTab}
    />
  );
}

export function MatchDetailsPage() {
  return (
    <Suspense fallback={<MatchDetailLoading />}>
      <MatchDetailsPageContent />
    </Suspense>
  );
}
