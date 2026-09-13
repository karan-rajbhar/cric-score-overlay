"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "~/lib/auth";
import { Button } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/card";
import { MatchCard } from "~/components/matches/match-card";
import { getMatches } from "~/app/matches/queries";
import { MatchCardSkeleton } from "~/components/ui/skeleton";
import { EmptyState } from "~/components/ui/empty-state";
import { Plus, Radio, Tv, Trophy, Shield, Calendar } from "lucide-react";
import type { Match } from "~/lib/match-types";

export default function Dashboard() {
  const { user } = useAuth();
  const [liveMatches, setLiveMatches] = useState<Match[]>([]);
  const [recentMatches, setRecentMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);

  const canScoreMatch = (match: Match) =>
    !!user &&
    (match.created_by === user.id ||
      (match.match_admins ?? []).includes(user.id));

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

  return (
    <div className="space-y-8">
      {/* Greeting Header */}
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-foreground sm:text-3xl">
            {user?.user_metadata?.full_name
              ? `Welcome back, ${user.user_metadata.full_name.split(" ")[0]}`
              : "Dashboard"}
          </h1>
          <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
            Live games, tournament updates, and quick cricket management
            actions.
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
              Manage Teams
            </Link>
          </Button>
          <Button asChild size="sm" className="interactive-button gap-1.5">
            <Link href="/matches/create">
              <Plus className="h-4 w-4" />
              New Match
            </Link>
          </Button>
        </div>
      </header>

      {/* Quick action cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        {[
          {
            href: "/matches",
            icon: Radio,
            title: "Match Center",
            description: "Follow ongoing live games and scorecards",
          },
          {
            href: "/tournaments",
            icon: Trophy,
            title: "Tournaments",
            description: "Standings tables, qualification math & brackets",
          },
          {
            href: "/overlay/test",
            icon: Tv,
            title: "Broadcast Overlay",
            description: "OBS scoreboard with live animation graphics",
          },
        ].map(({ href, icon: Icon, title, description }) => (
          <Link key={href} href={href} className="group">
            <Card className="h-full border-border/80 transition-all duration-200 hover:border-primary/50 hover:shadow-md">
              <CardContent className="flex items-center gap-4 p-5">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary shadow-sm transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                  <Icon className="h-5 w-5" />
                </span>
                <div>
                  <p className="text-sm font-bold text-foreground transition-colors group-hover:text-primary sm:text-base">
                    {title}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {description}
                  </p>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {/* Live Matches Section */}
      <section className="space-y-4">
        <div className="section-heading">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75"></span>
              <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500"></span>
            </span>
            <span>Live Matches Now</span>
          </div>
        </div>

        {loading ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <MatchCardSkeleton />
            <MatchCardSkeleton />
            <MatchCardSkeleton />
          </div>
        ) : liveMatches.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {liveMatches.map((match) => (
              <MatchCard
                key={match.id}
                match={match as never}
                canScore={canScoreMatch(match)}
              />
            ))}
          </div>
        ) : (
          <EmptyState
            icon={Radio}
            title="No Matches Live Right Now"
            description="Matches currently being scored in live mode will stream here in real time with over-by-over updates."
            primaryAction={{
              label: "Score a Match",
              href: "/matches/create",
              icon: Plus,
            }}
            secondaryAction={{
              label: "Browse All Matches",
              href: "/matches",
              icon: Calendar,
              variant: "outline",
            }}
          />
        )}
      </section>

      {/* Recent Results Section */}
      <section className="space-y-4">
        <div className="section-heading">
          <div className="flex items-center gap-2">
            <Trophy className="h-4 w-4 text-amber-500" />
            <span>Recent Completed Results</span>
          </div>
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
                canScore={false}
              />
            ))}
          </div>
        ) : (
          <EmptyState
            icon={Trophy}
            title="No Completed Matches Yet"
            description="Completed matches with final scorecards, top performers, and wagon wheels will appear here."
            primaryAction={{
              label: "Schedule First Match",
              href: "/matches/create",
              icon: Plus,
            }}
          />
        )}
      </section>
    </div>
  );
}
