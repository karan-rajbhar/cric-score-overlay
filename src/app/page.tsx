"use client";

import Link from "next/link";
import { useAuth } from "~/lib/auth";
import { Button } from "~/components/ui/button";
import { LiveHeroCard } from "~/components/matches/live-hero-card";
import { MatchCardSkeleton, Skeleton } from "~/components/ui/skeleton";
import { Carousel } from "~/components/ds/carousel";
import { BrandMark, BrandWordmark } from "~/components/brand";
import { cardSurface } from "~/components/ds/card";
import { useMatchesQuery } from "~/lib/hooks/useMatchQueries";
import { PageContainer, SectionHeader } from "~/components/layout/page";

const FEATURES = [
  {
    title: "Ball-by-ball scoring",
    description:
      "Score runs, extras and wickets from a phone. Strike rotation, partnerships, fall of wickets and run rates are worked out for you.",
  },
  {
    title: "Clubs and tournaments",
    description:
      "Keep club squads, fixtures and points tables in one place, with full scorecards and player records for every match.",
  },
  {
    title: "Stream overlays",
    description:
      "Add a match's overlay URL to OBS as a browser source to show the live score on your stream.",
  },
];

export default function HomePage() {
  const { user, loading } = useAuth();
  const { data: liveData, isLoading: liveLoading } = useMatchesQuery({
    status: "live",
    limit: 6,
  });
  const liveMatches = liveData ?? [];

  return (
    <PageContainer className="space-y-10 pb-8 sm:space-y-12">
      <section className="max-w-2xl pt-2 sm:pt-6">
        {/* Phones have no header: the brand opens the page. */}
        <span className="mb-6 flex items-center gap-2 md:hidden">
          <BrandMark className="h-9 w-9" />
          <BrandWordmark />
        </span>
        <h1 className="text-balance text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
          Cricket scoring for clubs and leagues
        </h1>
        <p className="mt-3 text-pretty text-sm text-muted-foreground sm:text-base">
          Score matches ball by ball, follow live scorecards, and run club
          tournaments. CricScore is invite-only: ask a club admin or match
          scorer for an invite to start scoring.
        </p>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          {loading ? (
            // Not known yet: reserve the buttons' space rather than guess,
            // so a signed-in visitor never sees "Sign in" first.
            <>
              <Skeleton
                className="h-10 w-full rounded-lg sm:w-32"
                aria-hidden="true"
                data-testid="hero-action-loading"
              />
              <Skeleton
                className="h-10 w-full rounded-lg sm:w-40"
                aria-hidden="true"
                data-testid="hero-action-loading"
              />
            </>
          ) : user ? (
            <>
              <Button asChild>
                <Link href="/matches/create">New match</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/dashboard">Dashboard</Link>
              </Button>
            </>
          ) : (
            <>
              <Button asChild>
                <Link href="/auth/login">Sign in</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/matches">Browse matches</Link>
              </Button>
            </>
          )}
        </div>
      </section>

      <section className="space-y-4" aria-labelledby="live-matches-heading">
        <SectionHeader
          id="live-matches-heading"
          title="Live now"
          live
          action={
            <Link
              href="/matches"
              className="text-sm font-medium text-muted-foreground hover:text-foreground"
            >
              All matches
            </Link>
          }
        />
        {liveLoading ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <MatchCardSkeleton />
            <MatchCardSkeleton />
          </div>
        ) : liveMatches.length > 0 ? (
          // Phones: swipe through the live matches; tablets up: a grid.
          <Carousel label="Live matches" gridFromMd>
            {liveMatches.map((match) => (
              <LiveHeroCard key={match.id} match={match} />
            ))}
          </Carousel>
        ) : (
          <p
            className={`${cardSurface} px-4 py-6 text-sm text-muted-foreground`}
          >
            No matches are being scored right now.{" "}
            <Link
              href="/matches"
              className="font-medium text-foreground underline-offset-4 hover:underline"
            >
              See recent results
            </Link>
          </p>
        )}
      </section>

      <section className="space-y-4" aria-labelledby="features-heading">
        <SectionHeader id="features-heading" title="What it does" />
        <div className="grid gap-4 md:grid-cols-3">
          {FEATURES.map(({ title, description }) => (
            <div key={title} className={`${cardSurface} p-5`}>
              <h3 className="text-base font-semibold text-foreground">
                {title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {description}
              </p>
            </div>
          ))}
        </div>
      </section>
    </PageContainer>
  );
}
