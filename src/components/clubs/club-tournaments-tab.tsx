"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { Button } from "~/components/ui/button";
import { TournamentCard } from "~/components/tournaments/tournament-card";
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
          <h2 className="text-lg font-semibold text-foreground">Tournaments</h2>
          <p className="text-sm text-muted-foreground">
            Leagues and cups {clubName} runs.
          </p>
        </div>
        {isAdmin && (
          <Button asChild size="sm" className="w-full gap-1.5 sm:w-auto">
            <Link href={`/tournaments/create?clubId=${clubId}`}>
              <Plus className="h-4 w-4 shrink-0" />
              Host tournament
            </Link>
          </Button>
        )}
      </div>

      {/* Filter Controls */}
      {tournaments.length > 0 && (
        <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-2.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <Input
              autoCorrect="off"
              autoCapitalize="none"
              spellCheck={false}
              placeholder="Search tournaments or venues..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8"
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
                aria-label="Filter by tournament status"
              >
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
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
          title="No tournaments yet"
          description="Run a league or cup with fixtures and a points table."
          primaryAction={
            isAdmin
              ? {
                  label: "Host tournament",
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
              <TournamentCard
                key={t.id}
                href={`/tournaments/${t.id}?clubId=${clubId}`}
                tournament={t}
                extra={seasonName}
                actions={
                  isAdmin ? (
                    <>
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
                    </>
                  ) : undefined
                }
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
