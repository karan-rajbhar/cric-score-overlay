"use client";

import { useCallback, useEffect, useRef, useState, Suspense } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "~/components/ui/button";
import { Button as DsButton } from "~/components/ds/button";
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
import { firebase } from "~/lib/firebase";
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
  ChevronRight,
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

function MatchDetailsPageContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const matchId = params.id as string;
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("summary");
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

  const clubId = searchParams.get("clubId");
  const tournamentId = searchParams.get("tournamentId");
  const teamId = searchParams.get("teamId");
  const playerId = searchParams.get("playerId");
  const fromParam = searchParams.get("from");

  const [contextNames, setContextNames] = useState<{
    clubName?: string;
    teamName?: string;
    tournamentName?: string;
    playerName?: string;
  }>({});

  const resolvedRef = useRef<{
    clubId?: string;
    tournamentId?: string;
    playerId?: string;
  }>({});

  useEffect(() => {
    if (!match) return; // Names show with the match, which usually has them.
    let cancelled = false;
    async function resolveContext() {
      const updates: typeof contextNames = {};

      if (clubId && resolvedRef.current.clubId !== clubId) {
        if (match?.club?.id === clubId && match.club.name) {
          updates.clubName = match.club.name;
          resolvedRef.current.clubId = clubId;
        } else {
          const { data } = await firebase
            .from("clubs")
            .select("name")
            .eq("id", clubId)
            .single();
          if (!cancelled && data?.name) {
            updates.clubName = data.name;
            resolvedRef.current.clubId = clubId;
          }
        }
      }

      if (tournamentId && resolvedRef.current.tournamentId !== tournamentId) {
        if (match?.tournament?.id === tournamentId && match.tournament.name) {
          updates.tournamentName = match.tournament.name;
          resolvedRef.current.tournamentId = tournamentId;
        } else {
          const { data } = await firebase
            .from("tournaments")
            .select("name")
            .eq("id", tournamentId)
            .single();
          if (!cancelled && data?.name) {
            updates.tournamentName = data.name;
            resolvedRef.current.tournamentId = tournamentId;
          }
        }
      }

      if (playerId && resolvedRef.current.playerId !== playerId) {
        let foundName: string | undefined;
        match?.innings?.forEach((inn) => {
          inn.batting_performances?.forEach((bp) => {
            if (bp.user?.id === playerId && bp.user.full_name) {
              foundName = bp.user.full_name;
            }
          });
          inn.bowling_performances?.forEach((bp) => {
            if (bp.user?.id === playerId && bp.user.full_name) {
              foundName = bp.user.full_name;
            }
          });
        });
        if (foundName) {
          updates.playerName = foundName;
          resolvedRef.current.playerId = playerId;
        } else {
          const { data } = await firebase
            .from("users")
            .select("full_name")
            .eq("id", playerId)
            .single();
          if (!cancelled && data?.full_name) {
            updates.playerName = data.full_name;
            resolvedRef.current.playerId = playerId;
          }
        }
      }

      if (!cancelled && Object.keys(updates).length > 0) {
        setContextNames((prev) => ({ ...prev, ...updates }));
      }
    }

    void resolveContext();
    return () => {
      cancelled = true;
    };
  }, [clubId, tournamentId, playerId, match]);



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

  let matchBackHref = "/matches";
  let matchBackLabel = "Back to matches";
  const breadcrumbItems: Array<{ label: string; href: string }> = [];

  if (clubId) {
    const clubName =
      (match?.club?.id === clubId ? match.club.name : null) ??
      contextNames.clubName ??
      "Club";
    if (tournamentId) {
      const tournamentName =
        (match?.tournament?.id === tournamentId
          ? match.tournament.name
          : null) ??
        contextNames.tournamentName ??
        "Tournament";
      matchBackHref = `/tournaments/${tournamentId}?tab=fixtures&clubId=${clubId}`;
      matchBackLabel = `Back to ${tournamentName}`;
      breadcrumbItems.push(
        { label: "Clubs", href: "/clubs" },
        { label: clubName, href: `/clubs/${clubId}?tab=tournaments` },
        {
          label: tournamentName,
          href: `/tournaments/${tournamentId}?tab=fixtures&clubId=${clubId}`,
        },
      );
    } else {
      matchBackHref = `/clubs/${clubId}?tab=matches`;
      matchBackLabel = `Back to ${clubName}`;
      breadcrumbItems.push(
        { label: "Clubs", href: "/clubs" },
        { label: clubName, href: `/clubs/${clubId}?tab=matches` },
      );
    }
  } else if (teamId) {
    const teamName =
      (match?.team1?.id === teamId
        ? match.team1.name
        : match?.team2?.id === teamId
          ? match.team2.name
          : null) ??
      contextNames.teamName ??
      "Team";
    if (tournamentId) {
      const tournamentName =
        (match?.tournament?.id === tournamentId
          ? match.tournament.name
          : null) ??
        contextNames.tournamentName ??
        "Tournament";
      breadcrumbItems.push(
        { label: "Tournaments", href: "/tournaments" },
        {
          label: tournamentName,
          href: `/tournaments/${tournamentId}?tab=teams`,
        },
        {
          label: teamName,
          href: `/teams/${teamId}?tournamentId=${tournamentId}&tab=matches`,
        },
      );
      matchBackHref = `/teams/${teamId}?tournamentId=${tournamentId}&tab=matches`;
    } else {
      breadcrumbItems.push(
        { label: "Teams", href: "/teams" },
        { label: teamName, href: `/teams/${teamId}?tab=matches` },
      );
      matchBackHref = `/teams/${teamId}?tab=matches`;
    }
    matchBackLabel = `Back to ${teamName}`;
  } else if (tournamentId) {
    const tournamentName =
      (match?.tournament?.id === tournamentId ? match.tournament.name : null) ??
      contextNames.tournamentName ??
      "Tournament";
    matchBackHref = `/tournaments/${tournamentId}?tab=fixtures`;
    matchBackLabel = `Back to ${tournamentName}`;
    breadcrumbItems.push(
      { label: "Tournaments", href: "/tournaments" },
      {
        label: tournamentName,
        href: `/tournaments/${tournamentId}?tab=fixtures`,
      },
    );
  } else if (playerId) {
    const playerName = contextNames.playerName ?? "Player";
    matchBackHref = `/players/${playerId}?tab=matches`;
    matchBackLabel = `Back to ${playerName}`;
    breadcrumbItems.push(
      { label: "Players", href: "/players" },
      { label: playerName, href: `/players/${playerId}?tab=matches` },
    );
  } else if (fromParam === "dashboard") {
    matchBackHref = "/dashboard";
    matchBackLabel = "Back to dashboard";
    breadcrumbItems.push(
      { label: "Dashboard", href: "/dashboard" },
      { label: "Matches", href: "/matches" },
    );
  } else if (fromParam === "search") {
    matchBackHref = "/search";
    matchBackLabel = "Back to search";
    breadcrumbItems.push({ label: "Search", href: "/search" });
  } else {
    // Default fallback: return to general matches list
    matchBackHref = "/matches";
    matchBackLabel = "Back to matches";
    breadcrumbItems.push({ label: "Matches", href: "/matches" });
  }

  const handleBackClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (typeof window === "undefined") return;

    // Check if we have safe in-app history to go back to
    const referrer = document.referrer;
    const isSameOrigin =
      !!referrer && referrer.startsWith(window.location.origin);
    const isFromScorePage =
      !!referrer && referrer.includes(`/matches/${matchId}/score`);

    // If navigated from the scoring screen of this match, avoid looping back into scoring
    if (isSameOrigin && !isFromScorePage && window.history.length > 1) {
      e.preventDefault();
      router.back();
    }
  };

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
            <div className="flex min-w-0 items-center gap-3">
              <DsButton
                variant="surface"
                size="icon-sm"
                asChild
                className="shrink-0"
              >
                <Link
                  href={matchBackHref}
                  onClick={handleBackClick}
                  aria-label={matchBackLabel}
                  title={matchBackLabel}
                >
                  <ChevronLeft />
                </Link>
              </DsButton>
              <nav
                aria-label="Breadcrumb"
                className="flex min-w-0 items-center gap-1.5 text-sm text-muted-foreground"
              >
                {breadcrumbItems.map((item) => (
                  <span key={item.href} className="flex shrink-0 items-center gap-1.5">
                    <Link
                      href={item.href}
                      className="max-w-[10rem] truncate transition-colors hover:text-foreground"
                    >
                      {item.label}
                    </Link>
                    <ChevronRight className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  </span>
                ))}
                <span
                  aria-current="page"
                  className="min-w-0 truncate font-medium text-foreground"
                >
                  {match.title}
                </span>
              </nav>
            </div>

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
            backHref={matchBackHref}
            backLabel={matchBackLabel}
            onBack={handleBackClick}
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
                      href={`/matches/${match.id}/score${
                        searchParams.toString()
                          ? `?${searchParams.toString()}`
                          : ""
                      }`}
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
          onValueChange={setActiveTab}
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
