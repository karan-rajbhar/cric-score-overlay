"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { MatchCard } from "~/components/matches/match-card";
import {
  useMatchesQuery,
  useUserAdminClubIdsQuery,
} from "~/lib/hooks/useMatchQueries";
import { MatchCardSkeleton } from "~/components/ui/skeleton";
import { EmptyState } from "~/components/ui/empty-state";
import {
  PageContainer,
  PageHeader,
  SectionHeader,
} from "~/components/layout/page";
import { Plus, Search, Radio, RotateCcw } from "lucide-react";
import { useAuth } from "~/lib/auth";
import { cn } from "~/lib/utils";
import type { Match } from "~/lib/match-types";

const statusOptions = [
  { value: "all", label: "All matches" },
  { value: "live", label: "Live now" },
  { value: "scheduled", label: "Upcoming" },
  { value: "completed", label: "Completed" },
] as const;

export default function MatchesPage() {
  const { user, loading: authLoading } = useAuth();
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  const {
    data: matchesData,
    isLoading: matchesLoading,
    error: matchesQueryError,
    refetch,
  } = useMatchesQuery({
    status: statusFilter === "all" ? undefined : statusFilter,
  });
  const { data: adminClubsSet } = useUserAdminClubIdsQuery(user?.id);

  const matches = matchesData ?? [];
  const loading = matchesLoading && matches.length === 0;
  const error = matchesQueryError
    ? matchesQueryError instanceof Error
      ? matchesQueryError.message
      : String(matchesQueryError)
    : null;
  const myClubAdminIds = adminClubsSet ?? new Set<string>();

  const filteredMatches = matches.filter((match) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      match.title.toLowerCase().includes(query) ||
      match.team1?.name.toLowerCase().includes(query) ||
      match.team2?.name.toLowerCase().includes(query) ||
      match.venue?.toLowerCase().includes(query)
    );
  });

  // Group by status for sectioned display.
  const liveMatches = filteredMatches.filter((m) => m.status === "live");
  const scheduledMatches = filteredMatches.filter(
    (m) => m.status === "scheduled",
  );
  const completedMatches = filteredMatches.filter(
    (m) => m.status === "completed",
  );
  const otherMatches = filteredMatches.filter(
    (m) => !["live", "scheduled", "completed"].includes(m.status),
  );

  const renderSection = (title: string, items: Match[], live = false) =>
    items.length > 0 && (
      <section className="space-y-4">
        <SectionHeader title={title} count={items.length} live={live} />
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {items.map((match) => (
            <MatchCard
              key={match.id}
              match={match}
              contextQuery="from=matches"
              canScore={
                !!user &&
                (match.created_by === user.id ||
                  (match.match_admins ?? []).includes(user.id) ||
                  Boolean(
                    (match.club_id || match.club?.id) &&
                      myClubAdminIds.has((match.club_id || match.club?.id)!),
                  ))
              }
            />
          ))}
        </div>
      </section>
    );

  return (
    <PageContainer>
      <PageHeader
        title="Matches"
        description="Live scores, fixtures and results"
        actions={
          user && (
            <Button asChild size="sm">
              <Link href="/matches/create">
                <Plus />
                New match
              </Link>
            </Button>
          )
        }
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground shrink-0" />
          <Input
            autoCorrect="off"
            autoCapitalize="none"
            spellCheck={false}
            aria-label="Search matches"
            placeholder="Search teams, titles or venues…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-9 w-full pl-9"
          />
        </div>

        <div
          role="group"
          aria-label="Filter by status"
          className="no-scrollbar flex w-full gap-1 overflow-x-auto rounded-lg bg-muted p-1 sm:w-auto"
        >
          {statusOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              aria-pressed={statusFilter === option.value}
              onClick={() => setStatusFilter(option.value)}
              className={cn(
                "min-h-9 flex-1 shrink-0 whitespace-nowrap rounded-md px-3 text-center text-sm font-medium transition-colors sm:min-h-8 sm:flex-none",
                statusFilter === option.value
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-background/60 hover:text-foreground",
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {/* Matches List / Skeletons / Empty state */}
      <div className="space-y-8">
        {loading || authLoading ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <MatchCardSkeleton />
            <MatchCardSkeleton />
            <MatchCardSkeleton />
            <MatchCardSkeleton />
            <MatchCardSkeleton />
            <MatchCardSkeleton />
          </div>
        ) : error ? (
          <Card className="mx-auto max-w-md border-destructive/30">
            <CardContent className="space-y-4 p-6 text-center">
              <p className="text-sm font-medium text-destructive">{error}</p>
              <Button
                size="sm"
                onClick={() => void refetch()}
                className="gap-2"
              >
                <RotateCcw className="h-3.5 w-3.5 shrink-0" />
                Try again
              </Button>
            </CardContent>
          </Card>
        ) : filteredMatches.length === 0 ? (
          <EmptyState
            icon={Radio}
            title="No matches found"
            description={
              searchQuery
                ? `No fixtures match "${searchQuery}". Try a different search or clear the status filter.`
                : statusFilter === "live"
                  ? "No matches are being scored right now."
                  : statusFilter === "scheduled"
                    ? "No upcoming matches on the schedule."
                    : "No matches match the selected criteria."
            }
            primaryAction={
              user
                ? {
                    label: "New match",
                    href: "/matches/create",
                    icon: Plus,
                  }
                : {
                    label: "Sign in",
                    href: "/auth/login",
                  }
            }
          />
        ) : (
          <>
            {renderSection("Live matches", liveMatches, true)}
            {renderSection("Upcoming fixtures", scheduledMatches)}
            {renderSection("Completed results", completedMatches)}
            {renderSection("Other fixtures", otherMatches)}
          </>
        )}
      </div>
    </PageContainer>
  );
}
