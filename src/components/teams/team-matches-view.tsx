"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { Card, CardContent } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { TeamLogo } from "~/components/teams/team-logo";
import {
  CalendarDays,
  MapPin,
  ArrowRight,
  Trophy,
  Filter,
  CheckCircle2,
  XCircle,
  Clock,
  Swords,
} from "lucide-react";
import { formatStatus } from "~/lib/cricket";
import { EmptyState } from "~/components/ui/empty-state";

export interface TeamMatchInnings {
  id: string;
  team_id: string;
  innings_number: number;
  total_runs: number;
  total_wickets: number;
  total_balls?: number;
  total_overs: number;
  is_completed?: boolean;
}

export interface TeamMatchItem {
  id: string;
  title: string;
  match_format: string;
  overs_per_innings: number;
  status: string;
  venue?: string | null;
  scheduled_at?: string | null;
  result_type?: string | null;
  win_margin?: number | null;
  win_margin_type?: string | null;
  result_description?: string | null;
  winning_team_id?: string | null;
  tournament_id?: string | null;
  tournament?: { id: string; name: string } | null;
  team1: {
    id: string;
    name: string;
    short_name?: string | null;
    logo_url?: string | null;
  };
  team2: {
    id: string;
    name: string;
    short_name?: string | null;
    logo_url?: string | null;
  };
  innings?: TeamMatchInnings[];
}

interface TeamMatchesViewProps {
  currentTeamId: string;
  matches: TeamMatchItem[];
  tournamentInfo?: { id: string; name: string } | null;
}

export function TeamMatchesView({
  currentTeamId,
  matches,
  tournamentInfo,
}: TeamMatchesViewProps) {
  // Scope filter: "tournament" vs "all" (if tournamentInfo is present, default to tournament)
  const [scopeFilter, setScopeFilter] = useState<"tournament" | "all">(
    tournamentInfo ? "tournament" : "all",
  );
  // Status filter: "all" | "live" | "scheduled" | "completed"
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const tournamentMatchesCount = useMemo(
    () =>
      tournamentInfo
        ? matches.filter((m) => m.tournament_id === tournamentInfo.id).length
        : 0,
    [matches, tournamentInfo],
  );

  const filteredMatches = useMemo(() => {
    return matches.filter((m) => {
      if (scopeFilter === "tournament" && tournamentInfo) {
        if (m.tournament_id !== tournamentInfo.id) return false;
      }
      if (statusFilter !== "all") {
        if (m.status !== statusFilter) return false;
      }
      return true;
    });
  }, [matches, scopeFilter, statusFilter, tournamentInfo]);

  const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return "TBD";
    return new Date(dateStr).toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getTeamOutcomeBadge = (match: TeamMatchItem) => {
    if (match.status === "live") {
      return (
        <Badge className="border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-400">
          <span className="mr-1.5 h-2 w-2 animate-ping rounded-full bg-red-500" />
          Live
        </Badge>
      );
    }
    if (match.status === "scheduled") {
      return (
        <Badge variant="outline" className="gap-1 text-muted-foreground">
          <Clock className="h-3 w-3" />
          Upcoming
        </Badge>
      );
    }
    if (match.status === "completed") {
      if (!match.winning_team_id) {
        return (
          <Badge
            variant="outline"
            className="border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400"
          >
            Tied / NR
          </Badge>
        );
      }
      const isWinner = match.winning_team_id === currentTeamId;
      return isWinner ? (
        <Badge className="border-emerald-500/30 bg-emerald-500/15 font-semibold text-emerald-600 dark:text-emerald-400">
          <CheckCircle2 className="mr-1 h-3 w-3" />
          Won
        </Badge>
      ) : (
        <Badge className="border-rose-500/30 bg-rose-500/15 font-semibold text-rose-600 dark:text-rose-400">
          <XCircle className="mr-1 h-3 w-3" />
          Lost
        </Badge>
      );
    }
    return <Badge variant="outline">{formatStatus(match.status)}</Badge>;
  };

  return (
    <div className="space-y-4">
      {/* Scope & Status Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-card p-3">
        {/* Tournament vs All Toggle (when tournament context exists) */}
        {tournamentInfo ? (
          <div className="flex items-center gap-1.5 rounded-lg bg-muted/60 p-1">
            <Button
              variant={scopeFilter === "tournament" ? "default" : "ghost"}
              size="sm"
              className="h-7 text-xs font-medium"
              onClick={() => setScopeFilter("tournament")}
            >
              <Trophy className="mr-1 h-3 w-3" />
              {tournamentInfo.name} ({tournamentMatchesCount})
            </Button>
            <Button
              variant={scopeFilter === "all" ? "default" : "ghost"}
              size="sm"
              className="h-7 text-xs font-medium"
              onClick={() => setScopeFilter("all")}
            >
              All Matches ({matches.length})
            </Button>
          </div>
        ) : (
          <div className="text-sm font-medium text-muted-foreground">
            Total Matches:{" "}
            <span className="font-semibold text-foreground">
              {matches.length}
            </span>
          </div>
        )}

        {/* Status Filters */}
        <div className="flex flex-wrap items-center gap-1">
          <Filter className="mr-1 h-3.5 w-3.5 text-muted-foreground" />
          {[
            { id: "all", label: "All" },
            { id: "live", label: "Live" },
            { id: "scheduled", label: "Upcoming" },
            { id: "completed", label: "Results" },
          ].map((item) => (
            <Button
              key={item.id}
              variant={statusFilter === item.id ? "secondary" : "ghost"}
              size="sm"
              className="h-7 px-2.5 text-xs font-medium"
              onClick={() => setStatusFilter(item.id)}
            >
              {item.label}
            </Button>
          ))}
        </div>
      </div>

      {/* Matches Grid */}
      {filteredMatches.length === 0 ? (
        <EmptyState
          icon={Swords}
          title="No Matches Found"
          description={
            scopeFilter === "tournament" && tournamentInfo
              ? `No matches found for ${tournamentInfo.name} with the selected filter.`
              : "No matches found matching the selected criteria for this team."
          }
          secondaryAction={
            scopeFilter === "tournament"
              ? {
                  label: "Show All Matches",
                  onClick: () => {
                    setScopeFilter("all");
                    setStatusFilter("all");
                  },
                }
              : undefined
          }
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {filteredMatches.map((match) => {
            const inn1 = match.innings?.find(
              (i) => i.team_id === match.team1.id,
            );
            const inn2 = match.innings?.find(
              (i) => i.team_id === match.team2.id,
            );

            return (
              <Card
                key={match.id}
                className="overflow-hidden transition-all hover:border-primary/50 hover:shadow-sm"
              >
                <CardContent className="p-0">
                  {/* Top metadata strip */}
                  <div className="flex items-center justify-between border-b px-4 py-2.5 text-xs">
                    <div className="flex items-center gap-2">
                      {getTeamOutcomeBadge(match)}
                      {match.tournament && (
                        <Link
                          href={`/tournaments/${match.tournament.id}`}
                          className="flex items-center gap-1 font-medium text-muted-foreground transition-colors hover:text-primary"
                        >
                          <Trophy className="h-3 w-3 text-amber-500" />
                          <span className="max-w-[140px] truncate">
                            {match.tournament.name}
                          </span>
                        </Link>
                      )}
                    </div>
                    <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                      {match.match_format} · {match.overs_per_innings} ov
                    </span>
                  </div>

                  {/* Team vs Team Scores */}
                  <div className="space-y-3 p-4">
                    {/* Team 1 Row */}
                    <div
                      className={`flex items-center justify-between gap-3 rounded-md p-1.5 transition-colors ${
                        match.team1.id === currentTeamId
                          ? "bg-primary/5 font-semibold"
                          : ""
                      }`}
                    >
                      <div className="flex min-w-0 items-center gap-2.5">
                        <TeamLogo
                          name={match.team1.name}
                          shortName={match.team1.short_name}
                          logoUrl={match.team1.logo_url}
                          className="h-7 w-7 text-xs"
                        />
                        <div className="min-w-0">
                          <p className="truncate text-sm">
                            {match.team1.name}
                            {match.team1.id === currentTeamId && (
                              <span className="ml-1.5 text-xs font-normal text-primary">
                                (This Team)
                              </span>
                            )}
                          </p>
                        </div>
                      </div>
                      {inn1 ? (
                        <div className="text-right">
                          <p className="score-display tabular text-base font-semibold leading-none">
                            {inn1.total_runs}/{inn1.total_wickets}
                          </p>
                          <p className="tabular mt-0.5 text-[11px] text-muted-foreground">
                            {inn1.total_overs.toFixed(1)} ov
                          </p>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">
                          Yet to bat
                        </span>
                      )}
                    </div>

                    {/* Team 2 Row */}
                    <div
                      className={`flex items-center justify-between gap-3 rounded-md p-1.5 transition-colors ${
                        match.team2.id === currentTeamId
                          ? "bg-primary/5 font-semibold"
                          : ""
                      }`}
                    >
                      <div className="flex min-w-0 items-center gap-2.5">
                        <TeamLogo
                          name={match.team2.name}
                          shortName={match.team2.short_name}
                          logoUrl={match.team2.logo_url}
                          className="h-7 w-7 text-xs"
                        />
                        <div className="min-w-0">
                          <p className="truncate text-sm">
                            {match.team2.name}
                            {match.team2.id === currentTeamId && (
                              <span className="ml-1.5 text-xs font-normal text-primary">
                                (This Team)
                              </span>
                            )}
                          </p>
                        </div>
                      </div>
                      {inn2 ? (
                        <div className="text-right">
                          <p className="score-display tabular text-base font-semibold leading-none">
                            {inn2.total_runs}/{inn2.total_wickets}
                          </p>
                          <p className="tabular mt-0.5 text-[11px] text-muted-foreground">
                            {inn2.total_overs.toFixed(1)} ov
                          </p>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">
                          Yet to bat
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Result or Timing Info */}
                  <div className="border-t bg-muted/20 px-4 py-2">
                    {match.result_description ? (
                      <p className="truncate text-xs font-medium text-primary">
                        {match.result_description}
                      </p>
                    ) : (
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                        {match.venue && (
                          <span className="inline-flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            {match.venue}
                          </span>
                        )}
                        <span className="tabular inline-flex items-center gap-1">
                          <CalendarDays className="h-3 w-3" />
                          {formatDate(match.scheduled_at)}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Bottom Action */}
                  <div className="border-t px-4 py-2.5">
                    <Button
                      asChild
                      size="sm"
                      variant="ghost"
                      className="h-8 w-full justify-between text-xs font-medium hover:bg-primary/10 hover:text-primary"
                    >
                      <Link
                        href={`/matches/${match.id}?teamId=${currentTeamId}${
                          tournamentInfo
                            ? `&tournamentId=${tournamentInfo.id}`
                            : ""
                        }`}
                      >
                        <span>View Match Scorecard</span>
                        <ArrowRight className="h-3.5 w-3.5" />
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
