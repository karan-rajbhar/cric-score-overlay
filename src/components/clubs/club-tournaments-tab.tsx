"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
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
  Trophy,
  Plus,
  MapPin,
  Calendar,
  Search,
  Filter,
} from "lucide-react";
import { TournamentManageDialog } from "~/components/tournaments/tournament-manage-dialog";
import { RegisterClubTeamDialog } from "~/components/tournaments/register-club-team-dialog";

export interface ClubTournamentItem {
  id: string;
  name: string;
  description?: string | null;
  status?: string | null;
  tournament_format?: string | null;
  match_format?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  venue?: string | null;
  season_id?: string | null;
  overs_per_innings?: number | null;
}

export interface ClubSeasonItem {
  id: string;
  name: string;
  is_current?: boolean | null;
}

export interface ClubTeamItem {
  id: string;
  name: string;
  short_name?: string | null;
  team_type?: string | null;
}

interface ClubTournamentsTabProps {
  clubId: string;
  clubName: string;
  tournaments: ClubTournamentItem[];
  seasons: ClubSeasonItem[];
  teams: ClubTeamItem[];
  isAdmin: boolean;
}

function formatStatus(status?: string | null) {
  if (!status) return "Upcoming";
  return status
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function formatTournamentFormat(fmt?: string | null) {
  if (!fmt) return "League";
  return fmt
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export function ClubTournamentsTab({
  clubId,
  clubName,
  tournaments,
  seasons,
  teams,
  isAdmin,
}: ClubTournamentsTabProps) {
  const [selectedSeason, setSelectedSeason] = useState<string>("all");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  const seasonMap = useMemo(() => {
    const map = new Map<string, string>();
    seasons.forEach((s) => map.set(s.id, s.name));
    return map;
  }, [seasons]);

  const filteredTournaments = useMemo(() => {
    return tournaments.filter((t) => {
      // Season filter
      if (selectedSeason !== "all" && t.season_id !== selectedSeason) {
        return false;
      }
      // Status filter
      if (selectedStatus !== "all" && t.status !== selectedStatus) {
        return false;
      }
      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = t.name.toLowerCase().includes(q);
        const matchesVenue = t.venue?.toLowerCase().includes(q) ?? false;
        if (!matchesName && !matchesVenue) return false;
      }
      return true;
    });
  }, [tournaments, selectedSeason, selectedStatus, searchQuery]);

  return (
    <div className="space-y-6">
      {/* Header with action */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-bold sm:text-lg">Hosted Tournaments</h2>
          <p className="text-xs text-muted-foreground">
            Cricket leagues, knockout tournaments, and events organized by {clubName}.
          </p>
        </div>
        {isAdmin && (
          <Button asChild size="sm" className="w-full gap-1.5 sm:w-auto">
            <Link href={`/tournaments/create?clubId=${clubId}`}>
              <Plus className="h-4 w-4" />
              Host Tournament
            </Link>
          </Button>
        )}
      </div>

      {/* Filter Controls */}
      {tournaments.length > 0 && (
        <div className="flex flex-col gap-2.5 rounded-xl border border-border/80 bg-card/60 p-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Search tournaments or venues..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-8 pl-8 text-xs"
              aria-label="Search tournaments"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {seasons.length > 0 && (
              <Select value={selectedSeason} onValueChange={setSelectedSeason}>
                <SelectTrigger
                  className="h-8 w-[140px] text-xs"
                  aria-label="Filter by season"
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
                aria-label="Filter by tournament status"
              >
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="upcoming">Upcoming</SelectItem>
                <SelectItem value="ongoing">Ongoing</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      {/* Tournaments Grid or Empty State */}
      {tournaments.length === 0 ? (
        <EmptyState
          icon={Trophy}
          title="No Tournaments Hosted Yet"
          description="Organize a tournament under your club with automated points tables, fixtures, and leaderboards."
          primaryAction={
            isAdmin
              ? {
                  label: "Host Tournament",
                  href: `/tournaments/create?clubId=${clubId}`,
                  icon: Plus,
                }
              : undefined
          }
        />
      ) : filteredTournaments.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          No tournaments match the selected season or filter criteria.
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {filteredTournaments.map((t) => {
            const seasonName = t.season_id ? seasonMap.get(t.season_id) : null;
            return (
              <Card
                key={t.id}
                className="flex flex-col justify-between transition-colors hover:border-primary/40"
              >
                <div>
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <Link
                          href={`/tournaments/${t.id}?clubId=${clubId}`}
                          className="font-bold text-foreground transition-colors hover:text-primary"
                        >
                          <CardTitle className="text-base">{t.name}</CardTitle>
                        </Link>
                        <CardDescription className="mt-0.5 text-xs">
                          {formatTournamentFormat(t.tournament_format)} format,{" "}
                          {t.match_format ?? "T20"}
                        </CardDescription>
                      </div>

                      <div className="flex flex-col items-end gap-1">
                        <Badge variant="outline" className="text-[11px]">
                          {formatStatus(t.status)}
                        </Badge>
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
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-2 text-xs text-muted-foreground">
                    {t.description && (
                      <p className="line-clamp-2 text-xs text-foreground/80">
                        {t.description}
                      </p>
                    )}
                    {t.venue && (
                      <div className="flex items-center gap-1.5">
                        <MapPin className="h-3.5 w-3.5 text-primary" />
                        <span>{t.venue}</span>
                      </div>
                    )}
                    {(t.start_date || t.end_date) && (
                      <div className="flex items-center gap-1.5">
                        <Calendar className="h-3.5 w-3.5 text-primary" />
                        <span>
                          {t.start_date ?? "TBD"}
                          {t.end_date ? ` to ${t.end_date}` : ""}
                        </span>
                      </div>
                    )}
                  </CardContent>
                </div>

                {/* Footer Actions */}
                <div className="flex items-center justify-between border-t border-border/50 p-3">
                  <Button variant="secondary" size="sm" asChild className="h-7 text-xs">
                    <Link href={`/tournaments/${t.id}?clubId=${clubId}`}>
                      View Tournament
                    </Link>
                  </Button>

                  {isAdmin && (
                    <div className="flex items-center gap-1.5">
                      {teams.length > 0 && (
                        <RegisterClubTeamDialog
                          tournament={{ id: t.id, name: t.name }}
                          clubTeams={teams}
                        />
                      )}
                      <TournamentManageDialog
                        tournament={{
                          id: t.id,
                          name: t.name,
                          description: t.description,
                          tournament_format: t.tournament_format,
                          match_format: t.match_format,
                          overs_per_innings: t.overs_per_innings,
                          venue: t.venue,
                          start_date: t.start_date,
                          end_date: t.end_date,
                          season_id: t.season_id,
                        }}
                        seasons={seasons}
                        clubId={clubId}
                      />
                    </div>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
