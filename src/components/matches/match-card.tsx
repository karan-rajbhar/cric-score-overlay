"use client";

import Link from "next/link";
import { Card, CardContent } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { TeamLogo } from "~/components/teams/team-logo";
import { MapPin, CalendarDays, PlayCircle } from "lucide-react";
import type { Team, Innings, Match } from "~/lib/match-types";
import { formatStatus } from "~/lib/cricket";

interface MatchCardProps {
  match: Match;
  showActions?: boolean;
  /** Whether the signed-in user may score this match (creator/admin). */
  canScore?: boolean;
  /** Optional context query params (e.g. from=matches or clubId=xxx) */
  contextQuery?: string;
}

function StatusBadge({ status }: { status: Match["status"] }) {
  switch (status) {
    case "live":
      return <Badge variant="live">Live</Badge>;
    case "completed":
      return <Badge variant="success">Result</Badge>;
    case "scheduled":
      return <Badge variant="outline">Scheduled</Badge>;
    case "abandoned":
      return <Badge variant="warning">Abandoned</Badge>;
    default:
      return <Badge variant="outline">{formatStatus(status)}</Badge>;
  }
}

function TeamRow({
  team,
  innings,
  leading,
}: {
  team: Team;
  innings?: Innings;
  leading: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-3">
        <TeamLogo
          name={team.name}
          shortName={team.short_name}
          logoUrl={team.logo_url}
          className={leading ? "ring-1 ring-primary/60" : undefined}
        />
        <div className="min-w-0">
          <p className="truncate font-medium">{team.name}</p>
          {innings ? (
            <p className="text-xs text-muted-foreground">
              {innings.is_completed ? "Innings closed" : "Innings in progress"}
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">Yet to bat</p>
          )}
        </div>
      </div>
      {innings && (
        <div className="shrink-0 text-right">
          <p className="score-display tabular text-2xl font-semibold leading-none">
            {innings.total_runs}/{innings.total_wickets}
          </p>
          <p className="tabular mt-0.5 text-xs text-muted-foreground">
            {innings.total_overs.toFixed(1)} ov
          </p>
        </div>
      )}
    </div>
  );
}

export function MatchCard({
  match,
  showActions = true,
  canScore = false,
  contextQuery,
}: MatchCardProps) {
  const inningsFor = (teamId: string) =>
    match.innings?.find((i) => i.team_id === teamId);

  const inn1 = inningsFor(match.team1.id);
  const inn2 = inningsFor(match.team2.id);

  // The team currently ahead on the scoreboard gets the accent treatment.
  const team1Leading = (inn1?.total_runs ?? 0) >= (inn2?.total_runs ?? 0);

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

  return (
    <Link
      href={`/matches/${match.id}${contextQuery ? `?${contextQuery}` : ""}`}
      className="group block"
    >
      <Card className="overflow-hidden rounded-2xl border-border/70 transition-all duration-200 group-hover:-translate-y-1 group-hover:border-emerald-500/40 group-hover:shadow-md">
        <CardContent className="p-0">
          {/* Meta strip */}
          <div className="flex items-center justify-between border-b border-border/80 px-4 py-2.5">
            <StatusBadge status={match.status} />
            <span className="text-xs font-medium text-muted-foreground">
              {match.match_format}, {match.overs_per_innings} overs
            </span>
          </div>

          {/* Teams */}
          <div className="space-y-4 px-4 py-4">
            <TeamRow team={match.team1} innings={inn1} leading={team1Leading} />
            <TeamRow
              team={match.team2}
              innings={inn2}
              leading={!team1Leading}
            />
          </div>

          {/* Result / timing */}
          <div className="border-t border-border/80 px-4 py-2.5">
            {match.result_description ? (
              <p className="truncate text-sm font-semibold text-primary">
                {match.result_description}
              </p>
            ) : (
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                {match.venue && (
                  <span className="inline-flex items-center gap-1.5">
                    <MapPin className="h-3.5 w-3.5 text-muted-foreground/70" />
                    <span>{match.venue}</span>
                  </span>
                )}
                <span className="tabular inline-flex items-center gap-1.5">
                  <CalendarDays className="h-3.5 w-3.5 text-muted-foreground/70" />
                  <span>{formatDate(match.scheduled_at)}</span>
                </span>
              </div>
            )}
          </div>

          {/* Actions */}
          {showActions && (
            <div className="flex gap-2 border-t border-border/80 px-4 py-3">
              <Button asChild size="sm" variant="outline" className="flex-1">
                <span>Scorecard</span>
              </Button>
              {canScore &&
                (match.status === "scheduled" || match.status === "live") && (
                  <Button
                    asChild
                    size="sm"
                    variant="secondary"
                    className="flex-1 gap-1.5"
                  >
                    <span>
                      <PlayCircle className="h-3.5 w-3.5" />
                      Score
                    </span>
                  </Button>
                )}
            </div>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}
