"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "~/lib/auth";
import { createClient } from "~/lib/supabase/client";
import { Button } from "~/components/ui/button";
import { MatchCard } from "~/components/matches/match-card";
import { TeamLogo } from "~/components/teams/team-logo";
import { getMatches } from "~/app/matches/queries";
import { MatchCardSkeleton } from "~/components/ui/skeleton";
import { EmptyState } from "~/components/ui/empty-state";
import { Plus, Radio, Tv, Trophy, Shield } from "lucide-react";
import type { Match } from "~/lib/match-types";

export default function Dashboard() {
  const { user } = useAuth();
  const [liveMatches, setLiveMatches] = useState<Match[]>([]);
  const [recentMatches, setRecentMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [myClubAdminIds, setMyClubAdminIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    const fetchAdminClubs = async () => {
      const supabaseClient = createClient();
      const [{ data: owned }, { data: mems }] = await Promise.all([
        supabaseClient.from("clubs").select("id").eq("owner_id", user.id),
        supabaseClient
          .from("club_memberships")
          .select("club_id")
          .eq("user_id", user.id)
          .in("role", ["owner", "admin"])
          .eq("status", "active"),
      ]);
      if (cancelled) return;
      const set = new Set<string>();
      (owned ?? []).forEach((c) => set.add(c.id));
      (mems ?? []).forEach((m) => {
        if (m.club_id) set.add(m.club_id);
      });
      setMyClubAdminIds(set);
    };
    void fetchAdminClubs();
    return () => {
      cancelled = true;
    };
  }, [user]);

  const canScoreMatch = (match: Match) => {
    if (!user) return false;
    if (match.created_by === user.id) return true;
    if ((match.match_admins ?? []).includes(user.id)) return true;
    const clubId = match.club_id || match.club?.id;
    return Boolean(clubId && myClubAdminIds.has(clubId));
  };

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      const [liveResult, recentResult] = await Promise.all([
        getMatches({ status: "live" }),
        getMatches({ status: "completed", limit: 6 }),
      ]);
      if (cancelled) return;
      setLiveMatches((liveResult.data ?? []) as unknown as Match[]);
      setRecentMatches((recentResult.data ?? []) as unknown as Match[]);
      setLoading(false);
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const featuredLive = liveMatches[0];
  const otherLiveMatches = liveMatches.slice(1);
  const featuredInn1 = featuredLive?.innings?.find(
    (i) => i.team_id === featuredLive.team1?.id,
  );
  const featuredInn2 = featuredLive?.innings?.find(
    (i) => i.team_id === featuredLive.team2?.id,
  );

  return (
    <div className="space-y-8">
      {/* Top Header Bar */}
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            {user?.user_metadata?.full_name
              ? `Welcome back, ${user.user_metadata.full_name.split(" ")[0]}`
              : "Dashboard"}
          </h1>
          <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
            Live pitch updates, tournament tables, and broadcast controls
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            asChild
            size="sm"
            variant="outline"
            className="interactive-button gap-1.5"
          >
            <Link href="/teams">
              <Shield className="h-4 w-4" />
              Manage teams
            </Link>
          </Button>
          <Button
            asChild
            size="sm"
            className="interactive-button gap-1.5 font-semibold"
          >
            <Link href="/matches/create">
              <Plus className="h-4 w-4" />
              New match
            </Link>
          </Button>
        </div>
      </header>

      {/* Featured Match Hero or Matchday Launchpad */}
      {loading ? (
        <div className="h-56 animate-pulse rounded-2xl border border-border/70 bg-card/50" />
      ) : featuredLive ? (
        <div className="relative overflow-hidden rounded-2xl border border-primary/30 bg-gradient-to-br from-card via-card to-primary/5 p-5 shadow-sm sm:p-7">
          <div className="flex flex-wrap items-center justify-between gap-2.5 border-b border-border/70 pb-4">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-red-500" />
              </span>
              <span className="text-xs font-bold tracking-tight text-red-600 dark:text-red-400">
                Live match
              </span>
              <span className="text-border">|</span>
              <span className="text-xs font-medium text-muted-foreground">
                {featuredLive.match_format}, {featuredLive.overs_per_innings}{" "}
                overs
              </span>
              {featuredLive.venue && (
                <>
                  <span className="text-border">•</span>
                  <span className="text-xs text-muted-foreground">
                    {featuredLive.venue}
                  </span>
                </>
              )}
            </div>

            {featuredLive.tournament && (
              <Link
                href={`/tournaments/${featuredLive.tournament.id}`}
                className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-0.5 text-xs font-medium text-amber-700 transition-colors hover:bg-amber-500/20 dark:text-amber-300"
              >
                <Trophy className="h-3 w-3" />
                <span>{featuredLive.tournament.name}</span>
              </Link>
            )}
          </div>

          {/* Teams and Scores Display */}
          <div className="my-5 grid gap-4 sm:grid-cols-2 sm:gap-6">
            {/* Team 1 */}
            <div className="flex items-center justify-between gap-3 rounded-xl border border-border/70 bg-muted/20 p-4 sm:p-5">
              <div className="flex items-center gap-3">
                <TeamLogo
                  name={featuredLive.team1.name}
                  shortName={featuredLive.team1.short_name}
                  logoUrl={featuredLive.team1.logo_url}
                  className="h-11 w-11 text-xs"
                />
                <div className="min-w-0">
                  <h3 className="truncate font-bold text-foreground sm:text-lg">
                    {featuredLive.team1.name}
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    {featuredInn1
                      ? featuredInn1.is_completed
                        ? "Innings closed"
                        : "Batting now"
                      : "Yet to bat"}
                  </p>
                </div>
              </div>
              <div className="shrink-0 text-right">
                <p className="score-display tabular text-3xl font-bold leading-none sm:text-4xl">
                  {featuredInn1
                    ? `${featuredInn1.total_runs}/${featuredInn1.total_wickets}`
                    : "-"}
                </p>
                {featuredInn1 && (
                  <p className="tabular mt-1 text-xs text-muted-foreground">
                    {featuredInn1.total_overs.toFixed(1)} ov
                  </p>
                )}
              </div>
            </div>

            {/* Team 2 */}
            <div className="flex items-center justify-between gap-3 rounded-xl border border-border/70 bg-muted/20 p-4 sm:p-5">
              <div className="flex items-center gap-3">
                <TeamLogo
                  name={featuredLive.team2.name}
                  shortName={featuredLive.team2.short_name}
                  logoUrl={featuredLive.team2.logo_url}
                  className="h-11 w-11 text-xs"
                />
                <div className="min-w-0">
                  <h3 className="truncate font-bold text-foreground sm:text-lg">
                    {featuredLive.team2.name}
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    {featuredInn2
                      ? featuredInn2.is_completed
                        ? "Innings closed"
                        : "Batting now"
                      : "Yet to bat"}
                  </p>
                </div>
              </div>
              <div className="shrink-0 text-right">
                <p className="score-display tabular text-3xl font-bold leading-none sm:text-4xl">
                  {featuredInn2
                    ? `${featuredInn2.total_runs}/${featuredInn2.total_wickets}`
                    : "-"}
                </p>
                {featuredInn2 && (
                  <p className="tabular mt-1 text-xs text-muted-foreground">
                    {featuredInn2.total_overs.toFixed(1)} ov
                  </p>
                )}
              </div>
            </div>
          </div>

          {featuredLive.result_description && (
            <p className="mb-4 text-sm font-semibold text-primary">
              {featuredLive.result_description}
            </p>
          )}

          {/* Action Bar */}
          <div className="flex flex-wrap items-center gap-2.5 border-t border-border/70 pt-4">
            {canScoreMatch(featuredLive) && (
              <Button asChild size="sm" className="gap-2 font-semibold">
                <Link href={`/matches/${featuredLive.id}/score`}>
                  <Radio className="h-4 w-4" />
                  Score live match
                </Link>
              </Button>
            )}
            <Button asChild size="sm" variant="outline" className="gap-2">
              <Link href={`/matches/${featuredLive.id}`}>View scorecard</Link>
            </Button>
            <Button
              asChild
              size="sm"
              variant="ghost"
              className="gap-2 text-muted-foreground hover:text-foreground"
            >
              <Link href={`/overlay/${featuredLive.id}`} target="_blank">
                <Tv className="h-4 w-4" />
                Launch OBS overlay
              </Link>
            </Button>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-border/80 bg-gradient-to-br from-card via-card to-muted/20 p-6 sm:p-8">
          <div className="max-w-2xl space-y-3">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
              <Shield className="h-3.5 w-3.5" />
              <span>Matchday command</span>
            </div>
            <h2 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              Ready to score, stream, or run your tournament?
            </h2>
            <p className="text-sm text-muted-foreground sm:text-base">
              Create a match with live ball-by-ball scoring, generate broadcast
              overlay graphics for OBS, or organize club tournaments with
              automated standings tables.
            </p>
            <div className="flex flex-wrap items-center gap-3 pt-2">
              <Button asChild className="gap-2 font-semibold">
                <Link href="/matches/create">
                  <Plus className="h-4 w-4" />
                  Start new match
                </Link>
              </Button>
              <Button asChild variant="outline" className="gap-2">
                <Link href="/tournaments">
                  <Trophy className="h-4 w-4" />
                  Tournaments & standings
                </Link>
              </Button>
              <Button
                asChild
                variant="ghost"
                className="gap-2 text-muted-foreground hover:text-foreground"
              >
                <Link href="/teams">Manage teams</Link>
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Sleek Matchday Context Bar (Replacing generic 3 SaaS cards) */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Link
          href="/matches"
          className="group flex items-center justify-between rounded-xl border border-border/80 bg-card p-4 transition-colors hover:border-primary/50"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-red-500/20 bg-red-500/10 text-red-600 dark:text-red-400">
              <Radio className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground transition-colors group-hover:text-primary">
                Match center
              </p>
              <p className="text-xs text-muted-foreground">
                {liveMatches.length > 0
                  ? `${liveMatches.length} live games streaming`
                  : "All fixtures and scorecards"}
              </p>
            </div>
          </div>
          <span className="text-xs font-medium text-muted-foreground transition-colors group-hover:text-foreground">
            {liveMatches.length} live
          </span>
        </Link>

        <Link
          href="/tournaments"
          className="group flex items-center justify-between rounded-xl border border-border/80 bg-card p-4 transition-colors hover:border-primary/50"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <Trophy className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground transition-colors group-hover:text-primary">
                Tournaments
              </p>
              <p className="text-xs text-muted-foreground">
                Points tables and qualification
              </p>
            </div>
          </div>
          <span className="text-xs font-medium text-muted-foreground transition-colors group-hover:text-foreground">
            Standings
          </span>
        </Link>

        <Link
          href="/overlay/test"
          className="group flex items-center justify-between rounded-xl border border-border/80 bg-card p-4 transition-colors hover:border-primary/50"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-primary/20 bg-primary/10 text-primary">
              <Tv className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground transition-colors group-hover:text-primary">
                Broadcast suite
              </p>
              <p className="text-xs text-muted-foreground">
                OBS scoreboard overlays
              </p>
            </div>
          </div>
          <span className="text-xs font-medium text-muted-foreground transition-colors group-hover:text-foreground">
            Studio
          </span>
        </Link>
      </div>

      {/* Additional Live Matches (if more than 1) */}
      {otherLiveMatches.length > 0 && (
        <section className="space-y-4">
          <div className="section-heading">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" />
              </span>
              <span>Other live matches</span>
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {otherLiveMatches.map((match) => (
              <MatchCard
                key={match.id}
                match={match as never}
                contextQuery="from=dashboard"
                canScore={canScoreMatch(match)}
              />
            ))}
          </div>
        </section>
      )}

      {/* Recent Completed Results Section */}
      <section className="space-y-4">
        <div className="flex items-center justify-between border-b border-border/70 pb-3">
          <div className="flex items-center gap-2">
            <Trophy className="h-4 w-4 text-amber-500" />
            <h2 className="text-base font-bold text-foreground">
              Recent completed results
            </h2>
          </div>
          <Button
            asChild
            variant="ghost"
            size="sm"
            className="h-8 text-xs text-muted-foreground hover:text-foreground"
          >
            <Link href="/matches?status=completed">View all results</Link>
          </Button>
        </div>

        {loading ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <MatchCardSkeleton />
            <MatchCardSkeleton />
            <MatchCardSkeleton />
          </div>
        ) : recentMatches.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {recentMatches.map((match) => (
              <MatchCard
                key={match.id}
                match={match as never}
                contextQuery="from=dashboard"
                canScore={false}
              />
            ))}
          </div>
        ) : (
          <EmptyState
            icon={Trophy}
            title="No completed matches yet"
            description="Completed matches with scorecards, bowler figures, and match wagon wheels will appear here."
            primaryAction={{
              label: "Schedule first match",
              href: "/matches/create",
              icon: Plus,
            }}
          />
        )}
      </section>
    </div>
  );
}
