"use client";

import { useCallback, useEffect, useRef, useState, Suspense } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { StatusBadge } from "~/components/ui/status-badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import dynamic from "next/dynamic";
import { MatchSummary } from "~/components/matches/match-summary";
import { MatchScorecard } from "~/components/matches/match-scorecard";
import { MatchBalls } from "~/components/matches/match-balls";
import { MatchPartnerships } from "~/components/matches/match-partnerships";
import { MatchInfo } from "~/components/matches/match-info";
import {
  useMatchDetailQuery,
  useMatchAdminQuery,
} from "~/lib/hooks/useMatchQueries";
import {
  sidesInBattingOrder,
} from "~/lib/cricket";
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
import {
  ChevronLeft,
  ChevronRight,
  Play,
  AlertCircle,
  Trophy,
  Shield,
} from "lucide-react";
import { ShareMatchButton } from "~/components/matches/share-match-button";

/** The round white buttons of the phone screen bar. */
const screenAction =
  "h-11 w-11 rounded-full border-0 bg-card p-0 shadow-soft ring-1 ring-border/60 hover:bg-accent";

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
    isConnected,
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
            label: "Back to Matches",
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
  const isScorer =
    (!!user &&
      (match.created_by === user.id ||
        (match.match_admins ?? []).includes(user.id))) ||
    isScorerRole;

  let matchBackHref = "/matches";
  let matchBackLabel = "Back to Matches";
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
    matchBackLabel = "Back to Dashboard";
    breadcrumbItems.push(
      { label: "Dashboard", href: "/dashboard" },
      { label: "Matches", href: "/matches" },
    );
  } else if (fromParam === "search") {
    matchBackHref = "/search";
    matchBackLabel = "Back to Search";
    breadcrumbItems.push({ label: "Search", href: "/search" });
  } else {
    // Default fallback: return to general matches list
    matchBackHref = "/matches";
    matchBackLabel = "Back to Matches";
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
          <div className="flex items-center justify-between gap-2 sm:gap-3">
            <div className="flex min-w-0 items-center gap-2 sm:gap-3">
              <Button
                variant="outline"
                size="sm"
                asChild
                className="shrink-0 pl-2.5 text-xs font-medium sm:text-sm"
              >
                <Link href={matchBackHref} onClick={handleBackClick}>
                  <ChevronLeft className="mr-1 h-4 w-4 shrink-0" />
                  <span className="sm:hidden">Back</span>
                  <span className="hidden sm:inline">{matchBackLabel}</span>
                </Link>
              </Button>

              {/* Breadcrumb Trail */}
              {breadcrumbItems.length > 0 && (
                <nav
                  aria-label="Breadcrumb"
                  className="hidden items-center gap-1.5 border-l pl-3 text-xs text-muted-foreground md:flex"
                >
                  {breadcrumbItems.map((item, idx) => (
                    <span key={item.href} className="flex items-center gap-1.5">
                      {idx > 0 && <ChevronRight className="h-3 w-3 shrink-0" />}
                      <Link
                        href={item.href}
                        className="max-w-[140px] truncate transition-colors hover:text-foreground"
                      >
                        {item.label}
                      </Link>
                    </span>
                  ))}
                  <ChevronRight className="h-3 w-3 shrink-0" />
                  <span className="max-w-[160px] truncate font-medium text-foreground">
                    {match.title}
                  </span>
                </nav>
              )}
            </div>

            <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
              {match.status === "live" && (
                <span
                  className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-2 py-1 text-xs font-medium sm:px-2.5"
                  title={
                    isConnected ? "Realtime sync connected" : "Connecting..."
                  }
                >
                  <span
                    className={`h-2 w-2 rounded-full ${
                      isConnected
                        ? "bg-success"
                        : "bg-muted-foreground/50"
                    }`}
                  />
                  <span className="hidden text-xs font-medium text-muted-foreground sm:inline">
                    {isConnected ? "Realtime sync" : "Connecting"}
                  </span>
                </span>
              )}
              {match.status !== "live" && <StatusBadge status={match.status} />}
              <ShareMatchButton
                matchId={match.id}
                title={`${match.team1?.name ?? "Team 1"} vs ${match.team2?.name ?? "Team 2"}`}
                className="h-8 px-2 sm:px-3"
              />
              <Badge variant="outline" className="hidden sm:inline-flex">
                {match.match_format}
              </Badge>
              <Badge variant="outline" className="hidden sm:inline-flex">
                {match.overs_per_innings} overs
              </Badge>

              {/* Secondary link to Tournament fixture if not already coming from tournament */}
              {match.tournament && !tournamentId && (
                <Link
                  href={`/tournaments/${match.tournament.id}?tab=fixtures${clubId ? `&clubId=${clubId}` : ""}`}
                  className="hidden items-center gap-1 rounded-full border border-border bg-card px-2.5 py-1 text-xs font-medium text-muted-foreground hover:text-foreground md:inline-flex"
                  title="View tournament"
                >
                  <Trophy className="h-3 w-3 shrink-0" />
                  <span className="max-w-[120px] truncate">
                    {match.tournament.name}
                  </span>
                </Link>
              )}

              {/* Secondary link to Club if not already coming from club */}
              {match.club && !clubId && (
                <Link
                  href={`/clubs/${match.club.id}?tab=matches`}
                  className="hidden items-center gap-1 rounded-full border border-border bg-card px-2.5 py-1 text-xs font-medium text-muted-foreground hover:text-foreground md:inline-flex"
                  title="View club"
                >
                  <Shield className="h-3 w-3 shrink-0" />
                  <span className="max-w-[120px] truncate">
                    {match.club.name}
                  </span>
                </Link>
              )}
              <MatchMoreMenu
                match={match}
                dlsMatch={match}
                canEditDls={isScorer}
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
                  title={`${match.team1?.name ?? "Team 1"} vs ${match.team2?.name ?? "Team 2"}`}
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
          <h1 className="mb-5 text-balance text-center text-sm font-medium text-muted-foreground max-md:hidden">
            {match.title}
          </h1>
          <MatchHero match={match} sides={[side1, side2]}>
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
            <MatchSummary match={match} />
          </TabsContent>

          <TabsContent value="scorecard">
            <MatchScorecard match={match} />
          </TabsContent>

          <TabsContent value="superstars">
            <MatchSuperstars match={match} />
          </TabsContent>

          <TabsContent value="stats" className="space-y-6">
            <MatchStats match={match} />
            <MatchPartnerships match={match} />
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
