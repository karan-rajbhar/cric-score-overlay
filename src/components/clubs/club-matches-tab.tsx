"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { Button } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
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
  Radio,
  ExternalLink,
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

function formatStatus(status: string) {
  return status
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
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

  const seasonMap = useMemo(() => {
    const map = new Map<string, string>();
    seasons.forEach((s) => map.set(s.id, s.name));
    return map;
  }, [seasons]);

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
          <h2 className="text-base font-bold sm:text-lg">Club Matches</h2>
          <p className="text-xs text-muted-foreground">
            Live scores, schedules, and past results for matches hosted by this club.
          </p>
        </div>
        {isAdmin && (
          <Button asChild size="sm" className="w-full gap-1.5 sm:w-auto">
            <Link href={`/matches/create?clubId=${clubId}`}>
              <Plus className="h-4 w-4" />
              Schedule Match
            </Link>
          </Button>
        )}
      </div>

      {/* Filter Controls */}
      {matches.length > 0 && (
        <div className="flex flex-col gap-2.5 rounded-xl border border-border/80 bg-card/60 p-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Search teams, title, or venue..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-8 pl-8 text-xs"
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
                  <Filter className="mr-1.5 h-3 w-3 text-muted-foreground" />
                  <SelectValue placeholder="Season" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Seasons</SelectItem>
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
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="live">Live Now</SelectItem>
                <SelectItem value="upcoming">Upcoming</SelectItem>
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
          title="No Matches Scheduled"
          description="Schedule club matches to start tracking live scores, wagon wheels, and broadcast overlays."
          primaryAction={
            isAdmin
              ? {
                  label: "Schedule Match",
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
          {filteredMatches.map((m) => {
            const isLive = m.status === "live";
            const isCompleted = m.status === "completed";
            const inn1 = m.innings?.find((i) => i.team_id === m.team1?.id);
            const inn2 = m.innings?.find((i) => i.team_id === m.team2?.id);
            const seasonName = m.season_id ? seasonMap.get(m.season_id) : null;

            return (
              <Card
                key={m.id}
                className={`transition-colors hover:border-primary/40 ${
                  isLive ? "border-emerald-500/50 bg-emerald-500/5" : ""
                }`}
              >
                <CardContent className="p-5">
                  <div className="mb-3 flex items-center justify-between text-xs text-muted-foreground">
                    <div className="flex items-center gap-1.5">
                      <span>{m.venue ?? "Venue TBD"}</span>
                      {seasonName && (
                        <Badge
                          variant="secondary"
                          className="gap-1 text-[10px]"
                        >
                          <Calendar className="h-2.5 w-2.5" />
                          {seasonName}
                        </Badge>
                      )}
                    </div>
                    <Badge
                      variant={
                        isLive
                          ? "default"
                          : isCompleted
                            ? "secondary"
                            : "outline"
                      }
                    >
                      {isLive && (
                        <Radio className="mr-1 h-3 w-3 animate-pulse text-emerald-400" />
                      )}
                      {formatStatus(m.status)}
                    </Badge>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-foreground">
                        {m.team1?.name ?? "Team 1"}
                      </span>
                      {inn1?.total_runs !== undefined &&
                      inn1.total_runs !== null ? (
                        <span className="tabular-nums text-sm font-bold">
                          {inn1.total_runs}/{inn1.total_wickets ?? 0}
                          <span className="ml-1 text-xs text-muted-foreground">
                            ({inn1.total_overs ?? 0} ov)
                          </span>
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-foreground">
                        {m.team2?.name ?? "Team 2"}
                      </span>
                      {inn2?.total_runs !== undefined &&
                      inn2.total_runs !== null ? (
                        <span className="tabular-nums text-sm font-bold">
                          {inn2.total_runs}/{inn2.total_wickets ?? 0}
                          <span className="ml-1 text-xs text-muted-foreground">
                            ({inn2.total_overs ?? 0} ov)
                          </span>
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </div>
                  </div>

                  {m.result_description && (
                    <div className="mt-3 rounded-md bg-muted/60 p-2 text-xs font-medium text-primary">
                      {m.result_description}
                    </div>
                  )}

                  <div className="mt-4 flex items-center justify-between border-t border-border/50 pt-3">
                    <Button
                      variant="ghost"
                      size="sm"
                      asChild
                      className="h-7 gap-1 text-xs"
                    >
                      <Link href={`/overlay/${m.id}`} target="_blank">
                        <ExternalLink className="h-3 w-3" />
                        Overlay
                      </Link>
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      asChild
                      className="h-7 text-xs"
                    >
                      <Link href={`/matches/${m.id}?clubId=${clubId}`}>
                        {isLive ? "Match Center" : "View Scorecard"}
                      </Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
