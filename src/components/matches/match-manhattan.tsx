"use client";

import { useMemo } from "react";
import { Card, CardHeader } from "~/components/ds/card";
import { ChartLegend, OverBarsChart } from "~/components/ds/charts";
import { useOverSummariesQuery } from "~/lib/hooks/useMatchQueries";
import type { Match } from "~/lib/match-types";
import { Loader2 } from "lucide-react";

interface OverRow {
  innings_id: string;
  over_number: number;
  runs: number;
  wickets: number;
  extras_off_bat_and_bowler?: number | null;
  extras_total?: number | null;
}

/** Team runs in an over: bat runs + all extras (falls back pre-migration). */
function overTotal(o: OverRow): number {
  const extras =
    o.extras_total ?? o.extras_off_bat_and_bowler ?? 0;
  return (o.runs ?? 0) + (extras ?? 0);
}

/**
 * Runs per over (Manhattan): one bar per side per over on a shared scale,
 * wickets as red dots above the bar, a hover read-out per over.
 */
export function MatchManhattan({ match }: { match: Match }) {
  const { data, error } = useOverSummariesQuery(match.id);

  const model = useMemo(() => {
    if (!data) return null;
    const rows = data as OverRow[];
    const byInnings = new Map<string, OverRow[]>();
    for (const r of rows) {
      if (!byInnings.has(r.innings_id)) byInnings.set(r.innings_id, []);
      byInnings.get(r.innings_id)!.push(r);
    }
    const sortedInnings = [...(match.innings ?? [])].sort(
      (a, b) => a.innings_number - b.innings_number,
    );
    const tables = sortedInnings.map((inn) => {
      const overs = (byInnings.get(inn.id) ?? [])
        .slice()
        .sort((a, b) => a.over_number - b.over_number);
      return {
        innings: inn,
        teamName:
          inn.team_id === match.team1_id ? match.team1.name : match.team2.name,
        shortName:
          (inn.team_id === match.team1_id
            ? match.team1.short_name
            : match.team2.short_name) ??
          (inn.team_id === match.team1_id
            ? match.team1.name
            : match.team2.name),
        overs,
      };
    });
    return tables;
  }, [data, match]);

  const maxOvers = Math.max(
    match.overs_per_innings || 1,
    ...(model ?? []).map((t) => t.overs.length),
    1,
  );

  return (
    <Card>
      <CardHeader
        title="Runs per over"
        description="Each over's runs, both sides on the same scale. Red dots are wickets."
      />
      <div className="space-y-3 px-4 pb-4 sm:px-5 sm:pb-5">
        {model === null ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <p className="text-sm text-muted-foreground">
            {error instanceof Error ? error.message : String(error)}
          </p>
        ) : model.length === 0 || model.every((t) => t.overs.length === 0) ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No overs bowled yet.
          </p>
        ) : (
          <>
            <ChartLegend
              items={[
                ...model.slice(0, 2).map((t, i) => ({
                  label: t.teamName,
                  series: (i + 1) as 1 | 2,
                })),
                { label: "Wicket", swatch: "bg-wicket", shape: "dot" as const },
              ]}
            />
            <OverBarsChart
              label={`Runs per over: ${model
                .map((t) => `${t.teamName} ${t.innings.total_runs}/${t.innings.total_wickets}`)
                .join(" vs ")}`}
              maxOvers={maxOvers}
              series={model.slice(0, 2).map((t, i) => ({
                key: t.innings.id,
                label: t.shortName,
                series: (i + 1) as 1 | 2,
                overs: t.overs.map((o) => ({
                  // over_number is 0-based in the engine; the chart is 1-based
                  over: o.over_number + 1,
                  runs: overTotal(o),
                  wickets: o.wickets ?? 0,
                })),
              }))}
            />
          </>
        )}
      </div>
    </Card>
  );
}
