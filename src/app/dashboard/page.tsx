"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { useAuth } from "~/lib/auth";
import { createClient } from "~/lib/firebase/client";
import { Button } from "~/components/ui/button";
import { MatchCard } from "~/components/matches/match-card";
import { TeamLogo } from "~/components/teams/team-logo";
import { LiveIndicator } from "~/components/matches/live-indicator";
import {
  useMatchesQuery,
  useUserAdminClubIdsQuery,
} from "~/lib/hooks/useMatchQueries";
import { MatchCardSkeleton } from "~/components/ui/skeleton";
import { EmptyState } from "~/components/ui/empty-state";
import { InviteDialog } from "~/components/invite-dialog";
import {
  PageContainer,
  PageHeader,
  SectionHeader,
} from "~/components/layout/page";
import { Plus, Radio, Tv, Trophy, Users } from "lucide-react";
import type { Match } from "~/lib/match-types";

export default function Dashboard() {
  const { user } = useAuth();
  const [fetchedUsername, setFetchedUsername] = useState<string | null>(null);
  const username =
    !user ? null : (fetchedUsername ?? (user.user_metadata?.username as string) ?? null);

  useEffect(() => {
    if (!user?.id) return;
    let isMounted = true;
    const db = createClient();
    void db
      .from("users")
      .select("username")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (isMounted && data?.username) {
          setFetchedUsername(data.username);
        }
      });
    return () => {
      isMounted = false;
    };
  }, [user?.id]);
  const { data: liveData, isLoading: liveLoading } = useMatchesQuery({
    status: "live",
  });
  const { data: recentData, isLoading: recentLoading } = useMatchesQuery({
    status: "completed",
    limit: 6,
  });
  const { data: adminClubsSet } = useUserAdminClubIdsQuery(user?.id);
  const liveMatches = liveData ?? [];
  const recentMatches = recentData ?? [];
  const loading =
    (liveLoading || recentLoading) &&
    liveMatches.length === 0 &&
    recentMatches.length === 0;
  const myClubAdminIds = adminClubsSet ?? new Set<string>();

  const canScoreMatch = (match: Match) => {
    if (!user) return false;
    if (match.created_by === user.id) return true;
    if ((match.match_admins ?? []).includes(user.id)) return true;
    const clubId = match.club_id || match.club?.id;
    return Boolean(clubId && myClubAdminIds.has(clubId));
  };

  const featuredLive = liveMatches[0];
  const otherLiveMatches = liveMatches.slice(1);
  const featuredInn1 = featuredLive?.innings?.find(
    (i) => i.team_id === featuredLive.team1?.id,
  );
  const featuredInn2 = featuredLive?.innings?.find(
    (i) => i.team_id === featuredLive.team2?.id,
  );

  return (
    <PageContainer>
      <PageHeader
        title={
          user?.user_metadata?.full_name
            ? `Welcome back, ${user.user_metadata.full_name.split(" ")[0]}`
            : "Dashboard"
        }
        description="Live matches, recent results and your teams"
        actions={
          <>
            <InviteDialog />
            <Button asChild size="sm" variant="outline">
              <Link href="/teams">
                <Users />
                Manage teams
              </Link>
            </Button>
            <Button asChild size="sm">
              <Link href="/matches/create">
                <Plus />
                New match
              </Link>
            </Button>
          </>
        }
      >
        {username && (
          <p className="mt-2 font-mono text-xs text-muted-foreground">
            @{username}
          </p>
        )}
      </PageHeader>

      {/* Featured Match Hero or Matchday Launchpad */}
      {loading ? (
        <div className="h-56 animate-pulse rounded-xl border border-border/70 bg-card/50" />
      ) : featuredLive ? (
        <div className="rounded-xl border border-border bg-card p-4 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-2.5 border-b border-border/70 pb-4">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <LiveIndicator />
              <span
                className="text-xs font-medium text-muted-foreground"
                aria-label={`${featuredLive.match_format}, ${featuredLive.overs_per_innings} overs${featuredLive.venue ? ` at ${featuredLive.venue}` : ""}`}
              >
                {featuredLive.match_format} · {featuredLive.overs_per_innings}{" "}
                overs
                {featuredLive.venue && ` · ${featuredLive.venue}`}
              </span>
            </div>

            {featuredLive.tournament && (
              <Link
                href={`/tournaments/${featuredLive.tournament.id}`}
                className="inline-flex items-center gap-1.5 rounded-full border border-border px-2.5 py-0.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <Trophy className="h-3 w-3 shrink-0" />
                <span>{featuredLive.tournament.name}</span>
              </Link>
            )}
          </div>

          {/* Teams and Scores Display */}
          <div className="my-4 grid gap-3 sm:my-5 sm:grid-cols-2 sm:gap-6">
            {/* Team 1 */}
            <div className="flex items-center justify-between gap-3 rounded-lg bg-muted/50 p-3.5 sm:p-4">
              <div className="flex min-w-0 items-center gap-2.5 sm:gap-3">
                <TeamLogo
                  name={featuredLive.team1.name}
                  shortName={featuredLive.team1.short_name}
                  logoUrl={featuredLive.team1.logo_url}
                  className="h-10 w-10 shrink-0 text-xs sm:h-11 sm:w-11"
                />
                <div className="min-w-0">
                  <h3 className="truncate font-semibold text-foreground sm:text-lg">
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
                <p className="score-display tabular-nums text-2xl font-bold leading-none sm:text-4xl">
                  {featuredInn1
                    ? `${featuredInn1.total_runs}/${featuredInn1.total_wickets}`
                    : "-"}
                </p>
                {featuredInn1 && (
                  <p className="tabular-nums mt-1 text-xs text-muted-foreground">
                    {featuredInn1.total_overs.toFixed(1)} ov
                  </p>
                )}
              </div>
            </div>

            {/* Team 2 */}
            <div className="flex items-center justify-between gap-3 rounded-lg bg-muted/50 p-3.5 sm:p-4">
              <div className="flex min-w-0 items-center gap-2.5 sm:gap-3">
                <TeamLogo
                  name={featuredLive.team2.name}
                  shortName={featuredLive.team2.short_name}
                  logoUrl={featuredLive.team2.logo_url}
                  className="h-10 w-10 shrink-0 text-xs sm:h-11 sm:w-11"
                />
                <div className="min-w-0">
                  <h3 className="truncate font-semibold text-foreground sm:text-lg">
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
                <p className="score-display tabular-nums text-2xl font-bold leading-none sm:text-4xl">
                  {featuredInn2
                    ? `${featuredInn2.total_runs}/${featuredInn2.total_wickets}`
                    : "-"}
                </p>
                {featuredInn2 && (
                  <p className="tabular-nums mt-1 text-xs text-muted-foreground">
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
          <div className="flex flex-col gap-2 border-t border-border/70 pt-4 sm:flex-row sm:flex-wrap sm:items-center sm:gap-2.5">
            {canScoreMatch(featuredLive) && (
              <Button
                asChild
                size="sm"
                className="w-full sm:w-auto"
              >
                <Link href={`/matches/${featuredLive.id}/score`}>
                  <Radio className="h-4 w-4 shrink-0" />
                  Score live match
                </Link>
              </Button>
            )}
            <Button
              asChild
              size="sm"
              variant="outline"
              className="w-full sm:w-auto"
            >
              <Link href={`/matches/${featuredLive.id}`}>View scorecard</Link>
            </Button>
            <Button
              asChild
              size="sm"
              variant="ghost"
              className="w-full text-muted-foreground hover:text-foreground sm:w-auto"
            >
              <Link href={`/overlay/${featuredLive.id}`} target="_blank">
                <Tv className="h-4 w-4 shrink-0" />
                Launch OBS overlay
              </Link>
            </Button>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card p-5 sm:p-6">
          <div className="max-w-2xl space-y-2">
            <h2 className="text-balance text-lg font-semibold text-foreground">
              No live matches right now
            </h2>
            <p className="text-sm text-muted-foreground">
              Start a match to score it ball by ball, or check tournament
              standings.
            </p>
            <div className="flex flex-col gap-2 pt-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-3">
              <Button
                asChild
                className="w-full sm:w-auto"
              >
                <Link href="/matches/create">
                  <Plus className="h-4 w-4 shrink-0" />
                  New match
                </Link>
              </Button>
              <Button
                asChild
                variant="outline"
                className="w-full sm:w-auto"
              >
                <Link href="/tournaments">Tournaments</Link>
              </Button>
              <Button
                asChild
                variant="ghost"
                className="w-full text-muted-foreground hover:text-foreground sm:w-auto"
              >
                <Link href="/teams">Manage teams</Link>
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Quick links */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Link
          href="/matches"
          className="group flex items-center gap-3 rounded-xl border border-border bg-card p-4 transition-colors hover:bg-accent/50"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
              <Radio className="h-5 w-5 shrink-0" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground transition-colors group-hover:text-primary">
                Match center
              </p>
              <p className="text-xs text-muted-foreground">
                {liveMatches.length > 0
                  ? `${liveMatches.length} live now`
                  : "All fixtures and scorecards"}
              </p>
            </div>
          </div>
        </Link>

        <Link
          href="/tournaments"
          className="group flex items-center gap-3 rounded-xl border border-border bg-card p-4 transition-colors hover:bg-accent/50"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
              <Trophy className="h-5 w-5 shrink-0" />
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
        </Link>

        <Link
          href="/overlay/test"
          className="group flex items-center gap-3 rounded-xl border border-border bg-card p-4 transition-colors hover:bg-accent/50"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
              <Tv className="h-5 w-5 shrink-0" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground transition-colors group-hover:text-primary">
                Stream overlays
              </p>
              <p className="text-xs text-muted-foreground">
                Scoreboard for OBS
              </p>
            </div>
          </div>
        </Link>
      </div>

      {/* Additional Live Matches (if more than 1) */}
      {otherLiveMatches.length > 0 && (
        <section className="space-y-4">
          <SectionHeader
            title="Other live matches"
            count={otherLiveMatches.length}
            live
          />
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
        <SectionHeader
          title="Recent results"
          action={
            <Link
              href="/matches?status=completed"
              className="text-sm font-medium text-muted-foreground hover:text-foreground"
            >
              View all
            </Link>
          }
        />

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
            description="Completed matches and their scorecards will appear here."
            primaryAction={{
              label: "New match",
              href: "/matches/create",
              icon: Plus,
            }}
          />
        )}
      </section>
    </PageContainer>
  );
}
