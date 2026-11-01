"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { Button } from "~/components/ui/button";
import { MatchCard } from "~/components/matches/match-card";
import type { Match } from "~/lib/match-types";
import { Input } from "~/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { EmptyState } from "~/components/ui/empty-state";
import {
  Calendar,
  Plus,
  Search,
  Filter,
} from "lucide-react";
import { ClubSeasonItem } from "./club-tournaments-tab";

export interface ClubMatchItem {
  id: string;
  title?: string | null;
  match_format?: string | null;
  overs_per_innings?: number | null;
  status: string;
  venue?: string | null;
  scheduled_at?: string | null;
  result_type?: string | null;
  win_margin?: number | null;
  win_margin_type?: string | null;
  result_description?: string | null;
  season_id?: string | null;
  team1?: { id: string; name: string; short_name?: string | null } | null;
  team2?: { id: string; name: string; short_name?: string | null } | null;
  innings?: Array<{
    id: string;
    team_id: string;
    innings_number: number;
    total_runs: number | null;
    total_wickets: number | null;
    total_balls: number | null;
    total_overs: number | null;
  }> | null;
}

interface ClubMatchesTabProps {
  clubId: string;
  matches: ClubMatchItem[];
  seasons: ClubSeasonItem[];
  isAdmin: boolean;
}

export function ClubMatchesTab({
  clubId,
  matches,
  seasons,
  isAdmin,
}: ClubMatchesTabProps) {
  const [selectedSeason, setSelectedSeason] = useState<string>("all");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  const filteredMatches = useMemo(() => {
    return matches.filter((m) => {
      // Season filter
      if (selectedSeason !== "all" && m.season_id !== selectedSeason) {
        return false;
      }
      // Status filter
      if (selectedStatus !== "all" && m.status !== selectedStatus) {
        return false;
      }
      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const t1 = m.team1?.name?.toLowerCase() ?? "";
        const t2 = m.team2?.name?.toLowerCase() ?? "";
        const venue = m.venue?.toLowerCase() ?? "";
        const title = m.title?.toLowerCase() ?? "";
        if (
          !t1.includes(q) &&
          !t2.includes(q) &&
          !venue.includes(q) &&
          !title.includes(q)
        ) {
          return false;
        }
      }
      return true;
    });
  }, [matches, selectedSeason, selectedStatus, searchQuery]);

  return (
    <div className="space-y-6">
      {/* Header with action */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Matches</h2>
          <p className="text-sm text-muted-foreground">
            Matches the club hosts: live, upcoming and results.
          </p>
        </div>
        {isAdmin && (
          <Button asChild size="sm" className="w-full gap-1.5 sm:w-auto">
            <Link href={`/matches/create?clubId=${clubId}`}>
              <Plus className="h-4 w-4 shrink-0" />
              Schedule match
            </Link>
          </Button>
        )}
      </div>

      {/* Filter Controls */}
      {matches.length > 0 && (
        <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-2.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <Input
              autoCorrect="off"
              autoCapitalize="none"
              spellCheck={false}
              placeholder="Search teams, title, or venue..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8"
              aria-label="Search matches"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {seasons.length > 0 && (
              <Select value={selectedSeason} onValueChange={setSelectedSeason}>
                <SelectTrigger
                  className="h-8 w-[140px] text-xs"
                  aria-label="Filter matches by season"
                >
                  <Filter className="mr-1.5 h-3 w-3 shrink-0 text-muted-foreground" />
                  <SelectValue placeholder="Season" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All seasons</SelectItem>
                  {seasons.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name} {s.is_current ? "(Active)" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            <Select value={selectedStatus} onValueChange={setSelectedStatus}>
              <SelectTrigger
                className="h-8 w-[130px] text-xs"
                aria-label="Filter by match status"
              >
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="live">Live now</SelectItem>
                <SelectItem value="scheduled">Upcoming</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      {/* Matches Grid or Empty State */}
      {matches.length === 0 ? (
        <EmptyState
          icon={Calendar}
          title="No matches yet"
          description="Schedule a club match to start scoring it ball by ball."
          primaryAction={
            isAdmin
              ? {
                  label: "Schedule match",
                  href: `/matches/create?clubId=${clubId}`,
                  icon: Plus,
                }
              : undefined
          }
        />
      ) : filteredMatches.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          No matches match the selected season or filter criteria.
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {filteredMatches.map((m) =>
            m.team1 && m.team2 ? (
              <MatchCard
                key={m.id}
                match={m as unknown as Match}
                showActions={false}
              />
            ) : null,
          )}
        </div>
      )}
    </div>
  );
}
