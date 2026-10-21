"use client";

import { useMemo } from "react";
import { Card, CardHeader } from "~/components/ds/card";
import { ChartLegend, WormChart } from "~/components/ds/charts";
import type { BallEvent, Match } from "~/lib/match-types";
import { useMatchBallLogQuery } from "~/lib/hooks/useMatchQueries";
import { Loader2 } from "lucide-react";
import { buildOverTable, inningsBalls } from "~/lib/match-charts";

interface MatchWormChartProps {
  match: Match;
  ballLog?: BallEvent[] | null;
}

/**
 * Run progression (worm): each side's runs over by over, wickets marked on
 * the line, a legend with the scores and a hover read-out per over.
 */
export function MatchWormChart({ match, ballLog: ballLogProp }: MatchWormChartProps) {
  const { data: fetched, isLoading } = useMatchBallLogQuery(match.id);
  // Prefer whichever copy has more balls (parent-embedded vs just-fetched
  // can disagree for one invalidation cycle during live scoring).
  // `undefined` = not provided → use fetched; explicit null = known empty.
  const fetchedArr = (fetched ?? null) as BallEvent[] | null;
  const ballLog =
    ballLogProp !== undefined && ballLogProp !== null
      ? fetchedArr && fetchedArr.length > ballLogProp.length
        ? fetchedArr
        : ballLogProp
      : (fetchedArr ?? ballLogProp ?? null);

  const series = useMemo(() => {
    const sorted = [...(match.innings ?? [])].sort(
      (a, b) => a.innings_number - b.innings_number,
    );
    return sorted.map((inn) => ({
      innings: inn,
      teamName:
        inn.team_id === match.team1_id ? match.team1.name : match.team2.name,
      shortName:
        (inn.team_id === match.team1_id
          ? match.team1.short_name
          : match.team2.short_name) ??
        (inn.team_id === match.team1_id ? match.team1.name : match.team2.name),
      table: buildOverTable(inningsBalls(inn, ballLog)),
    }));
  }, [match, ballLog]);

  const hasData = series.some((s) => s.table.length > 0);
  const maxOvers = Math.max(
    match.overs_per_innings || 20,
    ...series.map((s) => s.table.length),
    1,
  );
  const label = `Run progression: ${series
    .map((s) => `${s.teamName} ${s.innings.total_runs}/${s.innings.total_wickets}`)
    .join(" vs ")}`;

  return (
    <Card>
      <CardHeader
        title="Run progression"
        description="Runs over by over. Dots mark the overs where wickets fell."
      />
      <div className="space-y-3 px-4 pb-4 sm:px-5 sm:pb-5">
        {ballLog === null && isLoading && ballLogProp === undefined ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : !hasData ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No deliveries yet. The chart builds as overs are bowled.
          </p>
        ) : (
          <>
            <ChartLegend
              items={series.slice(0, 2).map((s, i) => ({
                label: s.teamName,
                value: `${s.innings.total_runs}/${s.innings.total_wickets}`,
                series: (i + 1) as 1 | 2,
                shape: "line" as const,
              }))}
            />
            <WormChart
              label={label}
              maxOvers={maxOvers}
              series={series.slice(0, 2).map((s, i) => ({
                key: s.innings.id,
                label: s.shortName,
                series: (i + 1) as 1 | 2,
                points: s.table.map((o) => ({
                  over: o.overNumber,
                  runs: o.cumulativeRuns,
                  wicketsSoFar: o.cumulativeWickets,
                  wickets: o.wickets,
                })),
              }))}
            />
          </>
        )}
      </div>
    </Card>
  );
}
