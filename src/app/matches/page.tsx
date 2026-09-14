"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { MatchCard } from "~/components/matches/match-card";
import { getMatches } from "./queries";
import { MatchCardSkeleton } from "~/components/ui/skeleton";
import { EmptyState } from "~/components/ui/empty-state";
import { Plus, Search, Radio, RotateCcw } from "lucide-react";
import { useAuth } from "~/lib/auth";
import { createClient } from "~/lib/supabase/client";
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
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
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

  useEffect(() => {
    let cancelled = false;

    const fetchMatches = async () => {
      setLoading(true);
      const filters: { status?: string } = {};
      if (statusFilter !== "all") {
        filters.status = statusFilter;
      }

      const result = await getMatches(filters);
      if (cancelled) return;
      if (result.error) {
        setError(result.error);
      } else {
        setMatches((result.data ?? []) as unknown as Match[]);
      }
      setLoading(false);
    };

    void fetchMatches();
    return () => {
      cancelled = true;
    };
  }, [statusFilter]);

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
        <div className="section-heading">
          <div className="flex items-center gap-2">
            {live ? (
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75"></span>
                <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500"></span>
              </span>
            ) : null}
            <span
              className={cn(
                live
                  ? "font-bold text-red-600 dark:text-red-400"
                  : "font-bold text-foreground",
              )}
            >
              {title}
            </span>
            <span className="tabular rounded-full bg-muted/80 px-2 py-0.5 text-xs font-semibold text-muted-foreground">
              {items.length}
            </span>
          </div>
        </div>
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
    <div className="space-y-8">
      {/* Header + search & filter controls */}
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-foreground sm:text-3xl">
            Match Center
          </h1>
          <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
            Real-time scores, upcoming fixtures, and archived scorecards
          </p>
        </div>
        {user && (
          <Button asChild size="sm" className="interactive-button gap-1.5">
            <Link href="/matches/create">
              <Plus className="h-4 w-4" />
              Score New Match
            </Link>
          </Button>
        )}
      </div>

      <div className="flex flex-col gap-3 border-b border-border/70 pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search teams, titles or venues…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-9 pl-9 text-xs"
          />
        </div>

        <div className="flex flex-wrap gap-1 rounded-xl border border-border/80 bg-muted/40 p-1">
          {statusOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setStatusFilter(option.value)}
              className={cn(
                "interactive-button rounded-lg px-3 py-1.5 text-xs font-semibold transition-all",
                statusFilter === option.value
                  ? "bg-primary text-primary-foreground shadow-sm"
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
                onClick={() => setStatusFilter(statusFilter)}
                className="interactive-button gap-2"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Try Again
              </Button>
            </CardContent>
          </Card>
        ) : filteredMatches.length === 0 ? (
          <EmptyState
            icon={Radio}
            title="No Matches Found"
            description={
              searchQuery
                ? `No fixtures match "${searchQuery}". Try refining your search query or reset status filters.`
                : statusFilter === "live"
                  ? "There are currently no active live matches being scored."
                  : statusFilter === "scheduled"
                    ? "No upcoming matches on the schedule."
                    : "No matches match the selected criteria."
            }
            primaryAction={
              user
                ? {
                    label: "Score First Match",
                    href: "/matches/create",
                    icon: Plus,
                  }
                : {
                    label: "Sign in to Create",
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
    </div>
  );
}
