"use client";

import Link from "next/link";
import { ChevronRight, Loader2 } from "lucide-react";
import { TeamCrest } from "~/components/ds/avatar";
import { Card, CardHeader } from "~/components/ds/card";
import { ListCard } from "~/components/ds/list";
import { useHeadToHeadQuery } from "~/lib/hooks/useMatchQueries";
import type { MatchTeam } from "~/lib/match-types";
import { formatDecimalOvers } from "~/lib/cricket";
import { teamRef } from "./match-hero";

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

function Side({
  team,
  wins,
  align,
}: {
  team: MatchTeam;
  wins: number;
  align: "start" | "end";
}) {
  return (
    <div
      className={
        align === "start"
          ? "flex min-w-0 items-center gap-3"
          : "flex min-w-0 flex-row-reverse items-center gap-3 text-right"
      }
    >
      <TeamCrest {...teamRef(team)} size="md" />
      <span className="min-w-0">
        <span className="block font-score text-3xl font-semibold tabular-nums leading-none text-foreground">
          {wins}
        </span>
        <span className="mt-1 block truncate text-xs text-muted-foreground">
          {team.short_name || team.name}
        </span>
      </span>
    </div>
  );
}

/**
 * The two sides' record against each other (wins either side, ties and no
 * results in the middle) and their past meetings, the latest first.
 */
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
  const others = total - team1Wins - team2Wins;
  const pct = (n: number) => (total > 0 ? (n / total) * 100 : 0);

  if (loading) {
    return (
      <Card className="flex items-center justify-center gap-2 p-10 text-sm text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
        Loading head-to-head records…
      </Card>
    );
  }

  const score = (m: HistoricalMatch, teamId: string) => {
    const inn = m.innings?.find((i) => i.team_id === teamId);
    return inn
      ? `${inn.total_runs}/${inn.total_wickets} (${formatDecimalOvers(inn.total_overs)})`
      : "–";
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader
          title="Head-to-head record"
          description={`Every completed match between ${team1.name} and ${team2.name}.`}
        />
        <div className="space-y-4 px-4 pb-4 sm:px-5 sm:pb-5">
          <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3">
            <Side team={team1} wins={team1Wins} align="start" />
            <div className="text-center">
              <span className="block font-score text-lg font-semibold tabular-nums text-muted-foreground">
                {total}
              </span>
              <span className="block text-xs text-muted-foreground">
                {total === 1 ? "match" : "matches"}
                {others > 0 && `, ${others} tied or no result`}
              </span>
            </div>
            <Side team={team2} wins={team2Wins} align="end" />
          </div>
          {total > 0 && (
            <div
              className="flex h-2.5 gap-[2px] overflow-hidden rounded-full bg-muted"
              role="img"
              aria-label={`${team1.name} ${team1Wins} wins, ${team2.name} ${team2Wins} wins${others ? `, ${others} tied or no result` : ""}`}
            >
              <div
                className="bg-series-1"
                style={{ width: `${pct(team1Wins)}%` }}
              />
              <div
                className="bg-muted-foreground/25"
                style={{ width: `${pct(others)}%` }}
              />
              <div
                className="bg-series-2"
                style={{ width: `${pct(team2Wins)}%` }}
              />
            </div>
          )}
        </div>
      </Card>

      <section aria-labelledby="past-meetings" className="space-y-2">
        <h3
          id="past-meetings"
          className="px-1 text-base font-semibold text-foreground"
        >
          Past meetings
        </h3>
        {matches.length === 0 ? (
          <Card className="px-4 py-8 text-center text-sm text-muted-foreground">
            No previous completed encounters between these two sides: this is
            their first meeting.
          </Card>
        ) : (
          <ListCard>
            {matches.map((m) => (
              <Link
                key={m.id}
                href={`/matches/${m.id}`}
                className="flex min-h-14 items-center gap-3 px-4 py-3 transition-colors hover:bg-accent focus-visible:bg-accent focus-visible:outline-none"
              >
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium text-foreground">
                    {m.result_description || "Match completed"}
                  </span>
                  <span className="block font-score text-xs tabular-nums text-muted-foreground">
                    {team1.short_name || team1.name} {score(m, team1.id)} ·{" "}
                    {team2.short_name || team2.name} {score(m, team2.id)}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {m.venue && <span>{m.venue}</span>}
                    {m.venue && m.scheduled_at && " · "}
                    {m.scheduled_at &&
                      new Date(m.scheduled_at).toLocaleDateString("en-GB", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                  </span>
                </span>
                <ChevronRight
                  className="h-4 w-4 shrink-0 text-muted-foreground"
                  aria-hidden="true"
                />
              </Link>
            ))}
          </ListCard>
        )}
      </section>
    </div>
  );
}
