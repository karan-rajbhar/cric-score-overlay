"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { getOverSummaries } from "~/app/matches/queries";
import type { Match } from "~/lib/match-types";
import { Loader2 } from "lucide-react";

interface OverRow {
  innings_id: string;
  over_number: number;
  runs: number;
  wickets: number;
}

interface InningsBars {
  inningsId: string;
  teamName: string;
  overs: OverRow[];
  max: number;
}

/**
 * Manhattan chart: per-over runs as native DB aggregation
 * (match_over_summaries view) — no ball-log joins.
 */
export function MatchManhattan({ match }: { match: Match }) {
  const [inningsBars, setInningsBars] = useState<InningsBars[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const result = await getOverSummaries(match.id);
      if (cancelled) return;
      if (result.error || !result.data) {
        setError(result.error ?? "Could not load chart");
        setInningsBars([]);
        return;
      }

      const rows = result.data as OverRow[];
      const byInnings = new Map<string, OverRow[]>();
      for (const r of rows) {
        if (!byInnings.has(r.innings_id)) byInnings.set(r.innings_id, []);
        byInnings.get(r.innings_id)!.push(r);
      }

      const bars: InningsBars[] = [...byInnings.entries()].map(
        ([inningsId, overs]) => ({
          inningsId,
          teamName:
            inningsId === match.innings?.find((i) => i.id === inningsId)?.id
              ? match.innings?.find((i) => i.id === inningsId)?.team_id ===
                match.team1_id
                ? match.team1.name
                : match.team2.name
              : "—",
          overs: overs.sort((a, b) => a.over_number - b.over_number),
          max: Math.max(...overs.map((o) => o.runs), 1),
        }),
      );

      setInningsBars(bars);
    })();

    return () => {
      cancelled = true;
    };
  }, [match]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Over by over</CardTitle>
      </CardHeader>
      <CardContent>
        {inningsBars === null ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <p className="text-sm text-muted-foreground">{error}</p>
        ) : inningsBars.length === 0 ? (
          <p className="text-sm text-muted-foreground">No overs bowled yet.</p>
        ) : (
          <div className="space-y-6">
            {inningsBars.map((inn) => (
              <div key={inn.inningsId}>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {inn.teamName}
                </p>
                <div className="no-scrollbar overflow-x-auto pb-2">
                  <div
                    className="flex w-full min-w-0 items-end gap-1"
                    style={{ height: 120 }}
                    role="region"
                    aria-label={`Over-by-over chart for ${inn.teamName}`}
                  >
                    {inn.overs.map((over) => (
                      <div
                        key={over.over_number}
                        className="group relative flex-1 transition-transform hover:scale-x-110"
                        role="img"
                        aria-label={`Over ${over.over_number + 1}: ${over.runs} run${over.runs === 1 ? "" : "s"}${over.wickets ? `, ${over.wickets} wicket${over.wickets === 1 ? "" : "s"}` : ""}`}
                        title={`Over ${over.over_number + 1}: ${over.runs} run${over.runs === 1 ? "" : "s"}${over.wickets ? `, ${over.wickets} wicket${over.wickets === 1 ? "" : "s"}` : ""}`}
                      >
                        {over.wickets > 0 && (
                          <span className="absolute -top-4 left-1/2 flex -translate-x-1/2 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-black leading-tight text-white shadow-sm">
                            W{over.wickets > 1 ? over.wickets : ""}
                          </span>
                        )}
                        <div
                          className={`w-full rounded-t-md transition-all ${
                            over.wickets > 0
                              ? "bg-gradient-to-t from-red-600 to-rose-400 shadow-sm"
                              : over.runs >= 12
                                ? "bg-gradient-to-t from-purple-600 to-violet-400 shadow-sm"
                                : over.runs >= 8
                                  ? "bg-gradient-to-t from-emerald-600 to-teal-400"
                                  : "bg-emerald-500/70"
                          }`}
                          style={{
                            height: `${Math.max((over.runs / inn.max) * 96, 4)}px`,
                          }}
                        />
                      </div>
                    ))}
                  </div>
                  <div className="mt-1 flex w-full min-w-0 justify-between text-[10px] text-muted-foreground">
                    <span>1</span>
                    <span>{inn.overs.length}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
