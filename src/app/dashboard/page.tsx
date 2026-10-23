"use client";

import { useSyncExternalStore } from "react";
import { useQuery } from "@tanstack/react-query";
import { getMyUpcomingMatches } from "./actions";
import Link from "next/link";
import { Plus, Search, Trophy } from "lucide-react";
import { useAuth } from "~/lib/auth";
import { Button, buttonVariants } from "~/components/ds/button";
import { Carousel } from "~/components/ds/carousel";
import { cardSurface } from "~/components/ds/card";
import { GreetingBar } from "~/components/ds/app-bar";
import { SectionHeader } from "~/components/ds/list";
import { CompetitionGroup, FixtureCard } from "~/components/ds/match-card";
import { MatchCard, matchStart } from "~/components/matches/match-card";
import { LiveHeroCard } from "~/components/matches/live-hero-card";
import { teamRef } from "~/components/matches/match-hero";
import {
  useMatchesQuery,
  useUserAdminClubIdsQuery,
} from "~/lib/hooks/useMatchQueries";
import { MatchCardSkeleton } from "~/components/ui/skeleton";
import { EmptyState } from "~/components/ui/empty-state";
import { GetStarted } from "~/components/dashboard/get-started";
import { FollowingMatches } from "~/components/follow/following-matches";
import { PageContainer } from "~/components/layout/page";
import type { Match } from "~/lib/match-types";

const noSubscribe = () => () => {};

/** "Good morning" by the device's clock; "Welcome back" while rendering on the server. */
function useGreeting(): string {
  return useSyncExternalStore(
    noSubscribe,
    () => {
      const h = new Date().getHours();
      return h < 12
        ? "Good morning"
        : h < 17
          ? "Good afternoon"
          : "Good evening";
    },
    () => "Welcome back",
  );
}

/** Upcoming matches under their competition, soonest first. */
function UpcomingGroups({ matches }: { matches: Match[] }) {
  const groups = new Map<string, Match[]>();
  for (const m of [...matches].sort((a, b) =>
    (a.scheduled_at ?? "").localeCompare(b.scheduled_at ?? ""),
  )) {
    const name = m.tournament?.name ?? m.club?.name ?? "Friendly matches";
    groups.set(name, [...(groups.get(name) ?? []), m]);
  }
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {Array.from(groups, ([name, items]) => (
        <CompetitionGroup
          key={name}
          name={name}
          aside={`${items[0]!.match_format} · ${items[0]!.overs_per_innings} overs`}
        >
          {items.map((m) => {
            const start = matchStart(m.scheduled_at);
            return (
              <FixtureCard
                key={m.id}
                bare
                href={`/matches/${m.id}?from=dashboard`}
                date={start?.date ?? "Date to be confirmed"}
                time={start?.time ?? "TBC"}
                home={teamRef(m.team1)}
                away={teamRef(m.team2)}
                venue={m.venue}
              />
            );
          })}
        </CompetitionGroup>
      ))}
    </div>
  );
}

/**
 * Home for signed-in users, after the Home screen in /design: the greeting,
 * live matches as big swipeable cards, upcoming fixtures by competition,
 * then recent results.
 */
export default function Dashboard() {
  const { user } = useAuth();
  const greeting = useGreeting();
  const { data: liveData, isLoading: liveLoading } = useMatchesQuery({
    status: "live",
  });
  const { data: upcomingData } = useMatchesQuery({
    status: "scheduled",
    limit: 6,
  });
  const { data: recentData, isLoading: recentLoading } = useMatchesQuery({
    status: "completed",
    limit: 6,
  });
  const { data: adminClubsSet } = useUserAdminClubIdsQuery(user?.id);
  // Your own fixtures first: the global list may not reach them.
  const { data: myUpcomingData } = useQuery({
    queryKey: ["myUpcomingMatches", user?.id ?? "anon"],
    queryFn: async () =>
      ((await getMyUpcomingMatches()) ?? []) as unknown as Match[],
    enabled: Boolean(user),
    staleTime: 30 * 1000,
  });
  const liveMatches = liveData ?? [];
  const myUpcoming = myUpcomingData ?? [];
  const myUpcomingIds = new Set(myUpcoming.map((m) => m.id));
  const upcoming = (upcomingData ?? []).filter(
    (m) => !myUpcomingIds.has(m.id),
  );
  const recentMatches = recentData ?? [];
  const myClubAdminIds = adminClubsSet ?? new Set<string>();

  const canScoreMatch = (match: Match) => {
    if (!user) return false;
    if (match.created_by === user.id) return true;
    if ((match.match_admins ?? []).includes(user.id)) return true;
    const clubId = match.club_id || match.club?.id;
    return Boolean(clubId && myClubAdminIds.has(clubId));
  };

  const fullName = (user?.user_metadata?.full_name as string | undefined) ?? "";
  const firstName = fullName.split(" ")[0] || "there";

  return (
    <PageContainer>
      <GreetingBar
        name={firstName}
        greeting={greeting}
        photoUrl={user?.user_metadata?.avatar_url as string | undefined}
        actions={
          <>
            <Link
              href="/search"
              aria-label="Search"
              className={buttonVariants({ variant: "surface", size: "icon" })}
            >
              <Search />
            </Link>
            <Link
              href="/matches/create"
              aria-label="New match"
              className={buttonVariants({ variant: "primary", size: "icon" })}
            >
              <Plus />
            </Link>
          </>
        }
      />

      {user && <GetStarted userId={user.id} />}

      <section aria-label="Live matches">
        {liveLoading && liveMatches.length === 0 ? (
          <div className={`${cardSurface} h-72 animate-pulse`} />
        ) : liveMatches.length > 0 ? (
          <Carousel label="Live matches" gridFromMd>
            {liveMatches.map((m) => (
              <LiveHeroCard key={m.id} match={m} canScore={canScoreMatch(m)} />
            ))}
          </Carousel>
        ) : (
          <div className={`${cardSurface} p-5`}>
            <h2 className="text-balance text-lg font-semibold text-foreground">
              No live matches right now
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Start a match to score it ball by ball, or follow one when it goes
              live.
            </p>
            <Button asChild className="mt-4 w-full sm:w-auto">
              <Link href="/matches/create">
                <Plus />
                New match
              </Link>
            </Button>
          </div>
        )}
      </section>

      {myUpcoming.length > 0 && (
        <section className="space-y-4">
          <SectionHeader title="Your upcoming matches" />
          <UpcomingGroups matches={myUpcoming} />
        </section>
      )}
      <FollowingMatches />

      {upcoming.length > 0 && (
        <section className="space-y-4">
          <SectionHeader
            title={myUpcoming.length > 0 ? "Other upcoming matches" : "Upcoming"}
            href="/matches"
            actionLabel="See more"
          />
          <UpcomingGroups matches={upcoming} />
        </section>
      )}

      <section className="space-y-4">
        <SectionHeader title="Results" href="/matches" actionLabel="See more" />
        {recentLoading && recentMatches.length === 0 ? (
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
                match={match}
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
