"use client";

import { useState, useMemo } from "react";
import { Swords } from "lucide-react";
import { MatchCard } from "~/components/matches/match-card";
import type { Match } from "~/lib/match-types";
import { Segmented } from "~/components/ds/tabs";
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
  /** All the team's matches, when `matches` is only the latest of them. */
  totalCount?: number;
  /** The team's matches in `tournamentInfo`, likewise. */
  tournamentCount?: number;
}

export function TeamMatchesView({
  currentTeamId,
  matches,
  tournamentInfo,
  totalCount,
  tournamentCount,
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

  return (
    <div className="space-y-4">
      {/* Which matches: this tournament or all, and by status */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        {tournamentInfo && (
          <Segmented
            label="Competition"
            value={scopeFilter}
            onChange={setScopeFilter}
            options={[
              {
                value: "tournament",
                label: `${tournamentInfo.name} (${tournamentCount ?? tournamentMatchesCount})`,
              },
              {
                value: "all",
                label: `All matches (${totalCount ?? matches.length})`,
              },
            ]}
          />
        )}
        <Segmented
          label="Match status"
          value={statusFilter}
          onChange={setStatusFilter}
          options={[
            { value: "all", label: "All" },
            { value: "live", label: "Live" },
            { value: "scheduled", label: "Upcoming" },
            { value: "completed", label: "Results" },
          ]}
        />
      </div>

      {/* Matches Grid */}
      {filteredMatches.length === 0 ? (
        <EmptyState
          icon={Swords}
          title="No matches found"
          description={
            scopeFilter === "tournament" && tournamentInfo
              ? `No matches found for ${tournamentInfo.name} with the selected filter.`
              : "No matches found matching the selected criteria for this team."
          }
          secondaryAction={
            scopeFilter === "tournament"
              ? {
                  label: "Show all matches",
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
          {filteredMatches.map((match) => (
            <MatchCard
              key={match.id}
              match={match as unknown as Match}
              contextQuery={`teamId=${currentTeamId}${
                tournamentInfo ? `&tournamentId=${tournamentInfo.id}` : ""
              }`}
              showActions={false}
            />
          ))}
        </div>
      )}
    </div>
  );
}
