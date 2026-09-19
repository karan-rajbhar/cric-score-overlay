"use client";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Swords, Trophy, Calendar, MapPin, Loader2 } from "lucide-react";
import { useHeadToHeadQuery } from "~/lib/hooks/useMatchQueries";
import type { MatchTeam } from "~/lib/match-types";
import Link from "next/link";

interface HeadToHeadProps {
  team1: MatchTeam;
  team2: MatchTeam;
  currentMatchId: string;
}

interface HistoricalMatch {
  id: string;
  title: string;
  scheduled_at: string | null;
  venue: string | null;
  winning_team_id: string | null;
  result_type: string | null;
  result_description: string | null;
  team1_id: string;
  team2_id: string;
  innings?: Array<{
    team_id: string;
    total_runs: number;
    total_wickets: number;
    total_overs: number;
  }>;
}

export function HeadToHead({ team1, team2, currentMatchId }: HeadToHeadProps) {
  const { data, isLoading: loading } = useHeadToHeadQuery(
    team1.id,
    team2.id,
    currentMatchId,
  );
  const matches = (data ?? []) as unknown as HistoricalMatch[];

  const total = matches.length;
  const team1Wins = matches.filter(
    (m) => m.winning_team_id === team1.id,
  ).length;
  const team2Wins = matches.filter(
    (m) => m.winning_team_id === team2.id,
  ).length;
  const tiesOrNr = matches.filter(
    (m) =>
      !m.winning_team_id ||
      m.result_type === "tie" ||
      m.result_type === "no_result",
  ).length;

  const team1Pct = total > 0 ? Math.round((team1Wins / total) * 100) : 0;
  const team2Pct = total > 0 ? Math.round((team2Wins / total) * 100) : 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12 text-muted-foreground">
        <Loader2 className="mr-2 h-6 w-6 animate-spin" />
        <span>Loading head-to-head records...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Overview Card */}
      <Card className="border-border/60 bg-gradient-to-br from-card to-muted/20">
        <CardHeader className="pb-2 text-center">
          <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Swords className="h-5 w-5" />
          </div>
          <CardTitle className="text-2xl">Head-to-Head Record</CardTitle>
          <CardDescription>
            All-time historical clashes between {team1.name} and {team2.name}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Score comparison pill */}
          <div className="mx-auto grid max-w-lg grid-cols-3 items-center rounded-xl border border-border bg-background/80 p-4 text-center">
            <div>
              <p className="text-3xl font-extrabold text-primary">
                {team1Wins}
              </p>
              <p className="mt-1 truncate text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {team1.short_name || team1.name}
              </p>
            </div>
            <div className="border-x border-border/60 px-3">
              <p className="text-xl font-bold text-muted-foreground">{total}</p>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                {total === 1 ? "Match" : "Matches"}
              </p>
              {tiesOrNr > 0 && (
                <p className="mt-0.5 text-[10px] text-muted-foreground/70">
                  {tiesOrNr} Tied/NR
                </p>
              )}
            </div>
            <div>
              <p className="text-3xl font-extrabold text-sky-500">
                {team2Wins}
              </p>
              <p className="mt-1 truncate text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {team2.short_name || team2.name}
              </p>
            </div>
          </div>

          {/* Win percentage bar */}
          {total > 0 && (
            <div className="mx-auto max-w-lg space-y-2">
              <div className="flex justify-between text-xs font-medium text-muted-foreground">
                <span>
                  {team1.short_name || team1.name} ({team1Pct}%)
                </span>
                <span>
                  {team2.short_name || team2.name} ({team2Pct}%)
                </span>
              </div>
              <div className="flex h-3 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="bg-primary transition-all"
                  style={{ width: `${team1Pct}%` }}
                />
                <div
                  className="bg-amber-400 transition-all"
                  style={{ width: `${100 - team1Pct - team2Pct}%` }}
                />
                <div
                  className="bg-sky-500 transition-all"
                  style={{ width: `${team2Pct}%` }}
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Previous Matches Feed */}
      <div className="space-y-3">
        <h3 className="flex items-center gap-2 text-lg font-semibold">
          <Trophy className="h-5 w-5 text-amber-500" />
          Past Encounters ({matches.length})
        </h3>

        {matches.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="py-8 text-center text-muted-foreground">
              <p className="text-sm">
                No previous completed encounters recorded between these two
                sides.
              </p>
              <p className="mt-1 text-xs text-muted-foreground/70">
                This fixture is their inaugural clash!
              </p>
            </CardContent>
          </Card>
        ) : (
          matches.map((m) => {
            const isTeam1Winner = m.winning_team_id === team1.id;
            const isTeam2Winner = m.winning_team_id === team2.id;
            const inn1 = m.innings?.find((i) => i.team_id === team1.id);
            const inn2 = m.innings?.find((i) => i.team_id === team2.id);

            return (
              <Link key={m.id} href={`/matches/${m.id}`}>
                <Card className="cursor-pointer transition-all hover:border-primary/50">
                  <CardContent className="flex flex-col justify-between gap-4 p-4 sm:flex-row sm:items-center">
                    <div className="space-y-2">
                      <div className="flex items-center gap-3">
                        <span
                          className={`text-sm font-semibold ${isTeam1Winner ? "font-bold text-primary" : ""}`}
                        >
                          {team1.name}
                        </span>
                        {inn1 && (
                          <Badge
                            variant="secondary"
                            className="tabular text-xs"
                          >
                            {inn1.total_runs}/{inn1.total_wickets} (
                            {inn1.total_overs} ov)
                          </Badge>
                        )}
                        <span className="text-xs text-muted-foreground">
                          vs
                        </span>
                        <span
                          className={`text-sm font-semibold ${isTeam2Winner ? "font-bold text-sky-500" : ""}`}
                        >
                          {team2.name}
                        </span>
                        {inn2 && (
                          <Badge
                            variant="secondary"
                            className="tabular text-xs"
                          >
                            {inn2.total_runs}/{inn2.total_wickets} (
                            {inn2.total_overs} ov)
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {m.result_description || "Match concluded"}
                      </p>
                    </div>

                    <div className="flex flex-shrink-0 items-center gap-3 text-xs text-muted-foreground">
                      {m.venue && (
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          {m.venue}
                        </span>
                      )}
                      {m.scheduled_at && (
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {new Date(m.scheduled_at).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })
        )}
      </div>
    </div>
  );
}
