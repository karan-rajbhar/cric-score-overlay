"use client";

import { useCallback, useState, Suspense } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import { backLabelOf, matchTrail, parentOf } from "~/lib/navigation";
import { setUrlParam } from "~/lib/url-state";
import { Button } from "~/components/ui/button";
import { PageTrail } from "~/components/ds/page-trail";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import dynamic from "next/dynamic";
import { MatchSummary } from "~/components/matches/match-summary";
import { MatchScorecard } from "~/components/matches/match-scorecard";
import { MatchBalls } from "~/components/matches/match-balls";
import { MatchInfo } from "~/components/matches/match-info";
import { LiveFreshness } from "~/components/matches/live-freshness";
import {
  useMatchDetailQuery,
  useMatchAdminQuery,
} from "~/lib/hooks/useMatchQueries";
import { sidesInBattingOrder } from "~/lib/cricket";
import { matchShareMessage } from "~/lib/share-match";
import { useAuth } from "~/lib/auth";
import { MatchHero } from "~/components/matches/match-hero";
import { ContentSheet, ScreenBar } from "~/components/ds/screen";
import MatchDetailLoading from "./loading";
import { EmptyState } from "~/components/ui/empty-state";

const MatchExportButtons = dynamic(
  () =>
    import("~/components/matches/match-export-buttons").then(
      (m) => m.MatchExportButtons,
    ),
  { ssr: false },
);
const MatchStats = dynamic(
  () => import("~/components/matches/match-stats").then((m) => m.MatchStats),
  { ssr: false },
);
const HeadToHead = dynamic(
  () => import("~/components/matches/head-to-head").then((m) => m.HeadToHead),
  { ssr: false },
);
const MatchSuperstars = dynamic(
  () =>
    import("~/components/matches/match-superstars").then(
      (m) => m.MatchSuperstars,
    ),
  { ssr: false },
);
const MatchMoreMenu = dynamic(
  () =>
    import("~/components/matches/match-more-menu").then(
      (m) => m.MatchMoreMenu,
    ),
  { ssr: false },
);
const MatchScorersDialog = dynamic(
  () =>
    import("~/components/matches/match-scorers-dialog").then(
      (m) => m.MatchScorersDialog,
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
import {
  ChevronLeft,
  Play,
  AlertCircle,
} from "lucide-react";
import { ShareMatchButton } from "~/components/matches/share-match-button";
import { EntityActions } from "~/components/follow/entity-actions";

/** The round white buttons of the phone screen bar. */
const screenAction =
  "h-11 w-11 rounded-full border-0 bg-card p-0 shadow-soft ring-1 ring-border/60 hover:bg-accent";
/** The same round action, at the desktop bar's height (ds `icon-sm`). */
const barAction =
  "h-9 w-9 rounded-full border-0 bg-card p-0 shadow-soft ring-1 ring-border/60 hover:bg-accent";

/** Tabs that show per-player figures (refetched per change unless live). */
const FULL_MATCH_TABS = new Set(["summary", "scorecard", "superstars"]);
/**
 * Tabs that follow `live_scorecard` while the match is live (Stats for its
 * partnerships and batter list); the others need only `live_state`.
 */
const LIVE_SCORECARD_TABS = new Set([
  "summary",
  "scorecard",
  "superstars",
  "stats",
]);

const DEFAULT_MATCH_TAB = "summary";
const MATCH_TABS = new Set([
  DEFAULT_MATCH_TAB,
  "scorecard",
  "superstars",
  "stats",
  "balls",
  "info",
]);

function MatchDetailsPageContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const matchId = params.id as string;
  const { user } = useAuth();
  // In the URL, so a reload, Back from a player and a shared link keep it.
  const [activeTab, setActiveTab] = useState(() => {
    const tab = searchParams.get("tab");
    return tab && MATCH_TABS.has(tab) ? tab : DEFAULT_MATCH_TAB;
  });
  const changeTab = useCallback((tab: string) => {
    setActiveTab(tab);
    setUrlParam("tab", tab, DEFAULT_MATCH_TAB);
  }, []);
  const {
    data: matchData,
    isLoading: loading,
    error: matchQueryError,
    refetch: refetchQuery,
  } = useMatchDetailQuery(matchId, {
    // Only these tabs show per-player figures; the header and the other
    // tabs run off the live totals or their own (ball log) queries.
    refetchOnChange: FULL_MATCH_TABS.has(activeTab),
    liveScorecard: LIVE_SCORECARD_TABS.has(activeTab),
  });
  const match = matchData ?? null;
  const error = matchQueryError ? matchQueryError.message : null;
  const refetchMatch = useCallback(() => {
    void refetchQuery();
  }, [refetchQuery]);

  const { data: isScorerAdmin } = useMatchAdminQuery(matchId, user?.id);
  const isScorerRole = Boolean(isScorerAdmin);

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

  // Scoreboard in batting order: the side that batted first, then the chase.
  const [side1, side2] = sidesInBattingOrder(match);
  // While live the first tab is the live view (crease, this over).
  const inPlay = match.status === "live" || match.status === "innings_break";
  // A link share sends the score so far with the link.
  const shareTitle = `${match.team1?.name ?? "Team 1"} vs ${match.team2?.name ?? "Team 2"}`;
  const shareText = matchShareMessage(match);
  const isScorer =
    (!!user &&
      (match.created_by === user.id ||
        (match.match_admins ?? []).includes(user.id))) ||
    isScorerRole;

  const trail = matchTrail(match);
  // Its Back leads here, so Back from here must not lead there.
  const scoringPath = `/matches/${match.id}/score`;

  return (
    // Full-bleed page: cancel the app shell's padding so the sticky header
    // and scoreboard bands sit flush under the navigation bar.
    // The shell's wash shows through behind the header.
    // Phones: the sheet runs to the bottom of the screen, under the tab bar.
    <div className="-mx-4 -mt-5 min-h-screen overflow-x-clip sm:-mx-6 sm:-mt-8 lg:-mx-8 max-md:-mb-32 max-md:flex max-md:flex-col">
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

            <div className="flex shrink-0 items-center gap-2">
              <ShareMatchButton
                matchId={match.id}
                title={shareTitle}
                text={shareText}
              />
              <MatchMoreMenu
                match={match}
                dlsMatch={match}
                canEditDls={isScorer}
                className={barAction}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Match header on the wash, Scoreline style */}
      <div className="container mx-auto px-4 pb-10 pt-3 sm:px-6 md:pb-4 md:pt-8">
        <div className="mx-auto max-w-3xl">
          {/* Phones: the screen's own bar instead of the header. */}
          <ScreenBar
            className="mb-5 md:hidden"
            title="Match centre"
            backHref={parentOf(trail)}
            backLabel={backLabelOf(trail)}
            backAvoid={scoringPath}
            action={
              <>
                <ShareMatchButton
                  matchId={match.id}
                  title={shareTitle}
                  text={shareText}
                  className={screenAction}
                />
                <MatchMoreMenu
                  match={match}
                  dlsMatch={match}
                  canEditDls={isScorer}
                  className={screenAction}
                />
              </>
            }
          />
          <h1 className="mb-3 text-balance text-center text-xl font-semibold text-foreground max-md:hidden">
            {match.title}
          </h1>
          <MatchHero match={match} sides={[side1, side2]}>
            {/* While live: when the score last changed, or that the live
                connection is down (phones have no header). */}
            {match.status === "live" && (
              <LiveFreshness matchId={match.id} className="-mt-2 mb-3" />
            )}
            {/* Action Buttons */}
            <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3">
              {isScorer &&
                (match.status === "scheduled" || match.status === "live") && (
                  <Button asChild>
                    <Link
                      href={scoringPath}
                    >
                      <Play className="mr-1.5 h-4 w-4 shrink-0" />
                      {match.status === "scheduled"
                        ? "Start match"
                        : "Continue scoring"}
                    </Link>
                  </Button>
                )}
              {match.status === "completed" && (
                <MatchExportButtons match={match} />
              )}
              {match.status !== "completed" && match.status !== "abandoned" && <EntityActions kind="match" id={match.id} name={match.title} />}
              {isScorer && (
                <MatchScorersDialog
                  matchId={match.id}
                  isCreator={match.created_by === user?.id}
                />
              )}
            </div>
          </MatchHero>
        </div>
      </div>

      {/* Tabs Content: on phones a white sheet rising over the wash */}
      <ContentSheet className="container mx-auto max-md:-mt-6 max-md:mx-0 max-md:mb-0 max-md:flex-1 sm:max-md:mx-0 md:px-4 md:py-6">
        <Tabs
          value={activeTab}
          onValueChange={changeTab}
          className="space-y-6"
        >
          <TabsList className="flex h-auto w-full justify-start">
            <TabsTrigger
              value="summary"
              className="shrink-0 gap-1.5"
            >
              {inPlay ? "Live" : "Summary"}
            </TabsTrigger>
            <TabsTrigger
              value="scorecard"
              className="shrink-0 gap-1.5"
            >
              <span>Scorecard</span>
            </TabsTrigger>
            <TabsTrigger
              value="superstars"
              className="shrink-0 gap-1.5"
            >
              <span>Top performers</span>
            </TabsTrigger>
            <TabsTrigger
              value="stats"
              className="shrink-0 gap-1.5"
            >
              Stats
            </TabsTrigger>
            <TabsTrigger
              value="balls"
              className="shrink-0 gap-1.5"
            >
              <span>Balls</span>
            </TabsTrigger>
            <TabsTrigger
              value="info"
              className="shrink-0 gap-1.5"
            >
              Info
            </TabsTrigger>
          </TabsList>

          <TabsContent value="summary">
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
          </TabsContent>

          <TabsContent value="scorecard">
            <MatchScorecard match={match} />
          </TabsContent>

          <TabsContent value="superstars">
            <MatchSuperstars match={match} />
          </TabsContent>

          {/* Partnerships are on the Scorecard. */}
          <TabsContent value="stats" className="space-y-6">
            <MatchStats match={match} />
          </TabsContent>

          <TabsContent value="balls">
            <MatchBalls match={match} />
          </TabsContent>

          <TabsContent value="info" className="space-y-6">
            <MatchInfo match={match} />
            <HeadToHead
              team1={match.team1}
              team2={match.team2}
              currentMatchId={match.id}
            />
          </TabsContent>
        </Tabs>
      </ContentSheet>
    </div>
  );
}

export function MatchDetailsPage() {
  return (
    <Suspense fallback={<MatchDetailLoading />}>
      <MatchDetailsPageContent />
    </Suspense>
  );
}
