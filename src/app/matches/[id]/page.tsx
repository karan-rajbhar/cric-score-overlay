"use client";

import { useCallback, useEffect, useRef, useState, Suspense } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { MatchExportButtons } from "~/components/matches/match-export-buttons";
import { DlsCalculatorModal } from "~/components/matches/dls-calculator-modal";
import { MatchSummary } from "~/components/matches/match-summary";
import { MatchScorecard } from "~/components/matches/match-scorecard";
import { MatchStats } from "~/components/matches/match-stats";
import { MatchBalls } from "~/components/matches/match-balls";
import { MatchManhattan } from "~/components/matches/match-manhattan";
import { MatchPartnerships } from "~/components/matches/match-partnerships";
import { MatchInfo } from "~/components/matches/match-info";
import { getMatch } from "../queries";
import type { Match } from "~/lib/match-types";
import { formatDecimalOvers, formatStatus } from "~/lib/cricket";
import { useAuth } from "~/lib/auth";
import { TeamLogo } from "~/components/teams/team-logo";
import { HeadToHead } from "~/components/matches/head-to-head";
import { supabase } from "~/lib/supabase";
import MatchDetailLoading from "./loading";
import { EmptyState } from "~/components/ui/empty-state";
import {
  ChevronLeft,
  ChevronRight,
  Tv,
  Play,
  FileText,
  BarChart3,
  CircleDot,
  Info,
  LayoutDashboard,
  Award,
  Swords,
  AlertCircle,
  Trophy,
  Shield,
} from "lucide-react";

function MatchDetailsPageContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const matchId = params.id as string;
  const { user } = useAuth();
  const [match, setMatch] = useState<Match | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isScorerRole, setIsScorerRole] = useState<boolean>(false);
  const fetchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancelled = false;
    const checkScorer = async () => {
      if (!user || !matchId) {
        setIsScorerRole(false);
        return;
      }
      const { data } = await supabase.rpc("is_match_admin", {
        p_match_id: matchId,
      });
      if (!cancelled) {
        setIsScorerRole(Boolean(data));
      }
    };
    void checkScorer();
    return () => {
      cancelled = true;
    };
  }, [user, matchId]);

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

  useEffect(() => {
    let cancelled = false;
    async function resolveContext() {
      const updates: typeof contextNames = {};

      if (clubId && match?.club?.id !== clubId) {
        const { data } = await supabase
          .from("clubs")
          .select("name")
          .eq("id", clubId)
          .single();
        if (!cancelled && data?.name) updates.clubName = data.name;
      }

      if (tournamentId && match?.tournament?.id !== tournamentId) {
        const { data } = await supabase
          .from("tournaments")
          .select("name")
          .eq("id", tournamentId)
          .single();
        if (!cancelled && data?.name) updates.tournamentName = data.name;
      }

      if (playerId) {
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
        } else {
          const { data } = await supabase
            .from("users")
            .select("full_name")
            .eq("id", playerId)
            .single();
          if (!cancelled && data?.full_name)
            updates.playerName = data.full_name;
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

  const refetchMatch = useCallback(async () => {
    const result = await getMatch(matchId);
    if (result.data) {
      setMatch(result.data as Match);
    }
  }, [matchId]);

  // Initial load
  useEffect(() => {
    let cancelled = false;
    async function fetchInitialMatch() {
      const result = await getMatch(matchId);
      if (cancelled) return;
      if (result.error) {
        setError(result.error);
      } else {
        setMatch(result.data as Match);
      }
      setLoading(false);
    }
    void fetchInitialMatch();
    return () => {
      cancelled = true;
    };
  }, [matchId]);

  // Realtime subscription + polling fallback when live
  useEffect(() => {
    const isUuid =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        matchId,
      );
    if (!isUuid) return;

    const scheduleRefetch = () => {
      if (fetchTimer.current) clearTimeout(fetchTimer.current);
      fetchTimer.current = setTimeout(() => void refetchMatch(), 250);
    };

    const channel = supabase
      .channel(`match_detail_${matchId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "ball_by_ball",
          filter: `match_id=eq.${matchId}`,
        },
        scheduleRefetch,
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "matches",
          filter: `id=eq.${matchId}`,
        },
        scheduleRefetch,
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "innings",
          filter: `match_id=eq.${matchId}`,
        },
        scheduleRefetch,
      )
      .subscribe((status) => setIsConnected(status === "SUBSCRIBED"));

    const poll = setInterval(() => {
      if (match?.status === "live") {
        void refetchMatch();
      }
    }, 15000);

    return () => {
      void supabase.removeChannel(channel);
      clearInterval(poll);
      if (fetchTimer.current) clearTimeout(fetchTimer.current);
    };
  }, [matchId, refetchMatch, match?.status]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "live":
        return <Badge variant="live">Live</Badge>;
      case "completed":
        return <Badge variant="success">Result</Badge>;
      case "scheduled":
        return <Badge variant="outline">Scheduled</Badge>;
      default:
        return <Badge variant="outline">{formatStatus(status)}</Badge>;
    }
  };

  if (loading) {
    return <MatchDetailLoading />;
  }

  if (error || !match) {
    return (
      <div className="container mx-auto flex min-h-[60vh] max-w-lg items-center justify-center px-4 py-12">
        <EmptyState
          icon={AlertCircle}
          title={error ? "Error Loading Match" : "Match Not Found"}
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
            label: "Try Again",
            onClick: () => refetchMatch(),
          }}
          className="w-full"
        />
      </div>
    );
  }

  const team1Innings = match.innings?.find((i) => i.team_id === match.team1_id);
  const team2Innings = match.innings?.find((i) => i.team_id === match.team2_id);
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
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-14 z-20 border-b border-border bg-card">
        <div className="container mx-auto px-4 py-2.5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <Button
                variant="ghost"
                size="sm"
                asChild
                className="interactive-button shrink-0 pl-0 text-xs font-medium sm:text-sm"
              >
                <Link href={matchBackHref} onClick={handleBackClick}>
                  <ChevronLeft className="mr-1 h-4 w-4" />
                  {matchBackLabel}
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

            <div className="flex shrink-0 items-center gap-2">
              {match.status === "live" && (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-border/80 bg-muted/60 px-2.5 py-1 text-xs font-medium">
                  <span
                    className={`h-2 w-2 rounded-full ${
                      isConnected
                        ? "animate-pulse bg-emerald-500"
                        : "bg-zinc-400"
                    }`}
                  />
                  <span className="text-xs font-medium text-muted-foreground">
                    {isConnected ? "Realtime sync" : "Connecting"}
                  </span>
                </span>
              )}
              {getStatusBadge(match.status)}
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
                  className="hidden items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-xs font-medium text-amber-700 hover:bg-amber-500/20 dark:text-amber-300 md:inline-flex"
                  title="View Tournament"
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
                  className="hidden items-center gap-1 rounded-full border bg-muted/60 px-2.5 py-1 text-xs font-medium text-muted-foreground hover:text-foreground md:inline-flex"
                  title="View Club"
                >
                  <Shield className="h-3 w-3 shrink-0" />
                  <span className="max-w-[120px] truncate">
                    {match.club.name}
                  </span>
                </Link>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Score Header - Always Visible */}
      <div className="border-b border-border bg-card">
        <div className="container mx-auto px-4 py-6">
          <h1 className="mb-5 text-center text-sm font-medium text-muted-foreground">
            {match.title}
          </h1>

          <div className="flex items-center justify-center gap-6 sm:gap-10">
            {/* Team 1 */}
            <div className="flex max-w-[320px] flex-1 items-center justify-end gap-4 text-right">
              <div>
                <p className="font-semibold text-foreground">
                  {match.team1.name}
                </p>
                {team1Innings ? (
                  <p className="score-display tabular mt-0.5 text-3xl font-semibold leading-none">
                    {team1Innings.total_runs}/{team1Innings.total_wickets}
                    <span className="ml-2 font-score text-base font-medium text-muted-foreground">
                      ({formatDecimalOvers(team1Innings.total_overs)})
                    </span>
                  </p>
                ) : (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Yet to bat
                  </p>
                )}
              </div>
              <TeamLogo
                name={match.team1.name}
                shortName={match.team1.short_name}
                logoUrl={match.team1.logo_url}
                className="h-12 w-12 shrink-0 text-sm"
              />
            </div>

            {/* VS */}
            <div className="text-xs font-semibold uppercase text-muted-foreground/60">
              vs
            </div>

            {/* Team 2 */}
            <div className="flex max-w-[320px] flex-1 items-center gap-4">
              <TeamLogo
                name={match.team2.name}
                shortName={match.team2.short_name}
                logoUrl={match.team2.logo_url}
                className="h-12 w-12 shrink-0 text-sm"
              />
              <div>
                <p className="font-semibold text-foreground">
                  {match.team2.name}
                </p>
                {team2Innings ? (
                  <p className="score-display tabular mt-0.5 text-3xl font-semibold leading-none">
                    {team2Innings.total_runs}/{team2Innings.total_wickets}
                    <span className="ml-2 font-score text-base font-medium text-muted-foreground">
                      ({formatDecimalOvers(team2Innings.total_overs)})
                    </span>
                  </p>
                ) : (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Yet to bat
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Result */}
          {match.status === "completed" && match.result_description && (
            <p className="mt-5 text-center text-base font-medium text-primary">
              {match.result_description}
            </p>
          )}

          {/* Player of the Match */}
          {match.player_of_the_match && (
            <div className="mx-auto mt-4 flex max-w-md items-center justify-center gap-3 rounded-full border border-amber-500/30 bg-amber-500/10 px-4 py-2 text-amber-900 dark:text-amber-200">
              <Award className="h-5 w-5 flex-shrink-0 text-amber-500" />
              <span className="text-xs font-semibold text-amber-700 dark:text-amber-300">
                Player of the match:
              </span>
              <span className="truncate text-sm font-bold">
                {match.player_of_the_match.full_name}
              </span>
            </div>
          )}

          {/* Action Buttons */}
          <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
            {isScorer &&
              (match.status === "scheduled" || match.status === "live") && (
                <Button asChild size="sm">
                  <Link
                    href={`/matches/${match.id}/score${
                      searchParams.toString()
                        ? `?${searchParams.toString()}`
                        : ""
                    }`}
                  >
                    <Play className="mr-1.5 h-4 w-4" />
                    {match.status === "scheduled"
                      ? "Start match"
                      : "Continue scoring"}
                  </Link>
                </Button>
              )}
            {match.status === "completed" && (
              <MatchExportButtons match={match} />
            )}
            {match.status === "live" && (
              <DlsCalculatorModal match={match} canEdit={isScorer} />
            )}
            <Button variant="outline" size="sm" asChild>
              <Link href={`/overlay/${match.id}`} target="_blank">
                <Tv className="mr-1.5 h-4 w-4" />
                OBS overlay
              </Link>
            </Button>
          </div>
        </div>
      </div>

      {/* Tabs Content */}
      <div className="container mx-auto px-4 py-8">
        <Tabs defaultValue="summary" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3 sm:grid-cols-7">
            <TabsTrigger value="summary" className="gap-1.5">
              <FileText className="h-4 w-4" />
              Summary
            </TabsTrigger>
            <TabsTrigger value="scorecard" className="gap-1.5">
              <LayoutDashboard className="h-4 w-4" />
              Scorecard
            </TabsTrigger>
            <TabsTrigger value="stats" className="gap-1.5">
              <BarChart3 className="h-4 w-4" />
              Stats
            </TabsTrigger>
            <TabsTrigger value="balls" className="gap-1.5">
              <CircleDot className="h-4 w-4" />
              Balls
            </TabsTrigger>
            <TabsTrigger value="info" className="gap-1.5">
              <Info className="h-4 w-4" />
              Info
            </TabsTrigger>
            <TabsTrigger value="h2h" className="gap-1.5">
              <Swords className="h-4 w-4" />
              Head-to-Head
            </TabsTrigger>
          </TabsList>

          <TabsContent value="summary">
            <MatchSummary match={match} />
          </TabsContent>

          <TabsContent value="scorecard">
            <MatchScorecard match={match} />
          </TabsContent>

          <TabsContent value="stats" className="space-y-6">
            <MatchManhattan match={match} />
            <MatchPartnerships match={match} />
            <MatchStats match={match} />
          </TabsContent>

          <TabsContent value="balls">
            <MatchBalls match={match} />
          </TabsContent>

          <TabsContent value="info">
            <MatchInfo match={match} />
          </TabsContent>

          <TabsContent value="h2h">
            <HeadToHead
              team1={match.team1}
              team2={match.team2}
              currentMatchId={match.id}
            />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

export default function MatchDetailsPage() {
  return (
    <Suspense fallback={<MatchDetailLoading />}>
      <MatchDetailsPageContent />
    </Suspense>
  );
}
