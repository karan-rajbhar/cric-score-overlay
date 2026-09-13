"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Card, CardContent } from "~/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { MatchExportButtons } from "~/components/matches/match-export-buttons";
import { MatchSummary } from "~/components/matches/match-summary";
import { MatchScorecard } from "~/components/matches/match-scorecard";
import { MatchStats } from "~/components/matches/match-stats";
import { MatchBalls } from "~/components/matches/match-balls";
import { MatchManhattan } from "~/components/matches/match-manhattan";
import { MatchPartnerships } from "~/components/matches/match-partnerships";
import { MatchInfo } from "~/components/matches/match-info";
import { getMatch } from "../queries";
import type { Match } from "~/lib/match-types";
import { formatDecimalOvers } from "~/lib/cricket";
import { useAuth } from "~/lib/auth";
import { HeadToHead } from "~/components/matches/head-to-head";
import { supabase } from "~/lib/supabase";
import {
  ChevronLeft,
  Tv,
  Play,
  Loader2,
  FileText,
  BarChart3,
  CircleDot,
  Info,
  LayoutDashboard,
  Award,
  Swords,
} from "lucide-react";

export default function MatchDetailsPage() {
  const params = useParams();
  const matchId = params.id as string;
  const { user } = useAuth();
  const [match, setMatch] = useState<Match | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const fetchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !match) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Card className="mx-4 w-full max-w-md">
          <CardContent className="p-6 text-center">
            <p className="mb-4 text-red-500">{error || "Match not found"}</p>
            <Button asChild>
              <Link href="/matches">Back to Matches</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const team1Innings = match.innings?.find((i) => i.team_id === match.team1_id);
  const team2Innings = match.innings?.find((i) => i.team_id === match.team2_id);
  const isScorer =
    !!user &&
    (match.created_by === user.id ||
      (match.match_admins ?? []).includes(user.id));

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-14 z-20 border-b border-border bg-card">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="sm" asChild>
                <Link href="/matches">
                  <ChevronLeft className="mr-1 h-4 w-4" />
                  Matches
                </Link>
              </Button>
            </div>
            <div className="flex items-center gap-2">
              {match.status === "live" && (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-border/80 bg-muted/60 px-2.5 py-1 text-xs font-medium">
                  <span
                    className={`h-2 w-2 rounded-full ${
                      isConnected
                        ? "animate-pulse bg-emerald-500"
                        : "bg-zinc-400"
                    }`}
                  />
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    {isConnected ? "Live Feed" : "Connecting"}
                  </span>
                </span>
              )}
              {getStatusBadge(match.status)}
              <Badge variant="outline">{match.match_format}</Badge>
              <Badge variant="outline">{match.overs_per_innings} overs</Badge>
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
                <p className="font-semibold">{match.team1.name}</p>
                {team1Innings ? (
                  <p className="score-display tabular mt-0.5 text-3xl font-semibold leading-none">
                    {team1Innings.total_runs}/{team1Innings.total_wickets}
                    <span className="ml-2 font-score text-base font-medium text-muted-foreground">
                      ({formatDecimalOvers(team1Innings.total_overs)})
                    </span>
                  </p>
                ) : (
                  <p className="mt-1 text-xs uppercase tracking-wider text-muted-foreground">
                    Yet to bat
                  </p>
                )}
              </div>
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-secondary text-xs font-bold tracking-wide text-secondary-foreground">
                {match.team1.short_name?.substring(0, 3).toUpperCase() ||
                  match.team1.name.substring(0, 3).toUpperCase()}
              </span>
            </div>

            {/* VS */}
            <div className="font-score text-lg font-medium uppercase tracking-widest text-muted-foreground/60">
              vs
            </div>

            {/* Team 2 */}
            <div className="flex max-w-[320px] flex-1 items-center gap-4">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-secondary text-xs font-bold tracking-wide text-secondary-foreground">
                {match.team2.short_name?.substring(0, 3).toUpperCase() ||
                  match.team2.name.substring(0, 3).toUpperCase()}
              </span>
              <div>
                <p className="font-semibold">{match.team2.name}</p>
                {team2Innings ? (
                  <p className="score-display tabular mt-0.5 text-3xl font-semibold leading-none">
                    {team2Innings.total_runs}/{team2Innings.total_wickets}
                    <span className="ml-2 font-score text-base font-medium text-muted-foreground">
                      ({formatDecimalOvers(team2Innings.total_overs)})
                    </span>
                  </p>
                ) : (
                  <p className="mt-1 text-xs uppercase tracking-wider text-muted-foreground">
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
              <span className="text-xs font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                Player of the Match:
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
                  <Link href={`/matches/${match.id}/score`}>
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
            <Button variant="outline" size="sm" asChild>
              <Link href={`/overlay/${match.id}`} target="_blank">
                <Tv className="mr-1.5 h-4 w-4" />
                OBS overlay
              </Link>
            </Button>
          </div>
        </div>
      </div>

      {/* Main Tabbed Content */}
      <div className="container mx-auto px-4 py-6">
        <Tabs defaultValue="summary" className="w-full">
          <TabsList className="mb-6 w-full justify-start bg-muted/50 p-1">
            <TabsTrigger value="summary" className="flex items-center gap-2">
              <LayoutDashboard className="h-4 w-4" />
              Summary
            </TabsTrigger>
            <TabsTrigger value="scorecard" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Scorecard
            </TabsTrigger>
            <TabsTrigger value="stats" className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Stats
            </TabsTrigger>
            <TabsTrigger value="balls" className="flex items-center gap-2">
              <CircleDot className="h-4 w-4" />
              Balls
            </TabsTrigger>
            <TabsTrigger value="info" className="flex items-center gap-2">
              <Info className="h-4 w-4" />
              Info
            </TabsTrigger>
            <TabsTrigger value="h2h" className="flex items-center gap-2">
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
