"use client";

import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { useOverSummariesQuery } from "~/lib/hooks/useMatchQueries";
import type { Match } from "~/lib/match-types";
import { Loader2 } from "lucide-react";
import {
  CHART_GRID,
  CHART_MUTED,
  CHART_TEAM1,
  CHART_TEAM2,
  CHART_WICKET,
} from "~/lib/match-charts";

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
 * Manhattan chart: per-over runs, visual parity with the exported match
 * report — shared y-scale, gridlines + axes, teal/amber innings, red
 * wicket dots, native tooltips, responsive SVG.
 */
export function MatchManhattan({ match }: { match: Match }) {
  const { data, error, isLoading } = useOverSummariesQuery(match.id);

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

  const w = 550;
  const h = 210;
  const ml = 35;
  const mr = 15;
  const mt = 32;
  const mb = 28;
  const pw = w - ml - mr;
  const ph = h - mt - mb;

  const totalOversMax = Math.max(
    1,
    ...(model ?? []).map((t) => t.overs.length),
  );
  const maxOverRunsRaw = Math.max(
    12,
    ...(model ?? []).flatMap((t) => t.overs.map(overTotal)),
  );
  const maxOverRuns = Math.ceil(maxOverRunsRaw / 6) * 6;
  const getY = (r: number) => mt + ph - (r / maxOverRuns) * ph;

  const gridSteps = [0, 1, 2, 3].map((step) => {
    const val = Math.round((maxOverRuns / 3) * step);
    return { val, y: getY(val) };
  });
  const tickStep = totalOversMax <= 10 ? 1 : totalOversMax <= 20 ? 2 : 5;

  const slotW = pw / totalOversMax;
  const barW = Math.max(3, (slotW - 4) / 2);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-balance text-lg">
          Manhattan · Over-by-Over Runs &amp; Wickets
        </CardTitle>
      </CardHeader>
      <CardContent>
        <style>{`
          @keyframes manhattan-rise { from { transform: scaleY(0); } to { transform: scaleY(1); } }
          @keyframes chart-fade-in { from { opacity: 0; transform: scale(0.4); } to { opacity: 1; transform: scale(1); } }
          .manhattan-bar { transform-box: fill-box; transform-origin: bottom; animation: manhattan-rise 0.5s cubic-bezier(0.22, 1, 0.36, 1) both; }
          .manhattan-wicket { opacity: 0; animation: chart-fade-in 0.3s ease-out forwards; transform-box: fill-box; transform-origin: center; }
          @media (prefers-reduced-motion: reduce) {
            .manhattan-bar, .manhattan-wicket { animation: none; opacity: 1; transform: none; }
          }
        `}</style>
        {model === null ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <p className="text-sm text-muted-foreground">
            {error instanceof Error ? error.message : String(error)}
          </p>
        ) : model.length === 0 ||
          model.every((t) => t.overs.length === 0) ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No overs bowled yet.
          </p>
        ) : (
          <div>
            <svg
              viewBox={`0 0 ${w} ${h}`}
              className="h-auto w-full"
              role="img"
              aria-label={`Manhattan chart: ${model
                .map((t) => `${t.teamName} ${t.overs.length} overs`)
                .join(" vs ")}`}
            >
              {/* Legend */}
              {model[0] && (
                <g>
                  <rect x={ml} y={10} width={10} height={10} rx={2} fill={CHART_TEAM1} />
                  <text x={ml + 15} y={19} fontSize={10} fontWeight={700} fill="currentColor" opacity={0.9}>
                    {model[0].shortName}: {model[0].innings.total_runs}/{model[0].innings.total_wickets}
                  </text>
                </g>
              )}
              {model[1] && (
                <g>
                  <rect x={ml + 150} y={10} width={10} height={10} rx={2} fill={CHART_TEAM2} />
                  <text x={ml + 165} y={19} fontSize={10} fontWeight={700} fill="currentColor" opacity={0.9}>
                    {model[1].shortName}: {model[1].innings.total_runs}/{model[1].innings.total_wickets}
                  </text>
                </g>
              )}
              <circle cx={ml + 300} cy={15} r={3} fill={CHART_WICKET} />
              <text x={ml + 308} y={19} fontSize={9} fill={CHART_MUTED}>
                Wicket
              </text>

              {/* Gridlines + y labels */}
              {gridSteps.map((g) => (
                <g key={g.val}>
                  <line
                    x1={ml}
                    y1={g.y}
                    x2={ml + pw}
                    y2={g.y}
                    stroke={CHART_GRID}
                    strokeWidth={1}
                    strokeDasharray="3,3"
                  />
                  <text
                    x={ml - 6}
                    y={g.y + 3}
                    textAnchor="end"
                    fontSize={8.5}
                    fill={CHART_MUTED}
                    className="tabular-nums"
                  >
                    {g.val}
                  </text>
                </g>
              ))}

              {/* Grouped bars */}
              {Array.from({ length: totalOversMax }, (_, i) => {
                const slotLeft = ml + i * slotW;
                const ovNum = i + 1;
                return (
                  <g key={ovNum}>
                    {model.map((t, ti) => {
                      const o = t.overs[i];
                      if (!o || (overTotal(o) <= 0 && o.wickets <= 0)) return null;
                      const total = overTotal(o);
                      const bh = (total / maxOverRuns) * ph;
                      const by = mt + ph - bh;
                      const bx = slotLeft + 1 + ti * (barW + 1);
                      const color = ti === 0 ? CHART_TEAM1 : CHART_TEAM2;
                      return (
                        <g key={t.innings.id}>
                          {total > 0 && (
                          <rect
                            x={bx.toFixed(1)}
                            y={by.toFixed(1)}
                            width={barW.toFixed(1)}
                            height={Math.max(bh, 2).toFixed(1)}
                            rx={1.5}
                            fill={color}
                            className="manhattan-bar"
                            style={{ animationDelay: `${Math.min(i * 0.04, 0.8)}s` }}
                          >
                            <title>
                              {t.teamName} over {ovNum}: {o.runs} bat +{" "}
                              {(o.extras_total ?? o.extras_off_bat_and_bowler ?? 0)}{" "}
                              extras
                              {o.wickets
                                ? `, ${o.wickets} wicket${o.wickets === 1 ? "" : "s"}`
                                : ""}
                            </title>
                          </rect>
                          )}
                          {o.wickets > 0 && (
                            <circle
                              cx={bx + barW / 2}
                              cy={total > 0 ? Math.max(mt + 4, by - 5) : mt + ph - 4}
                              r={3}
                              fill={CHART_WICKET}
                              className="manhattan-wicket"
                              style={{ animationDelay: `${Math.min(i * 0.04 + 0.35, 1.1)}s` }}
                            >
                              <title>
                                {t.teamName} over {ovNum}: {o.wickets} wicket
                                {o.wickets === 1 ? "" : "s"}
                              </title>
                            </circle>
                          )}
                        </g>
                      );
                    })}
                    {(ovNum % tickStep === 0 || ovNum === 1) && (
                      <text
                        x={slotLeft + slotW / 2}
                        y={mt + ph + 14}
                        textAnchor="middle"
                        fontSize={8}
                        fill={CHART_MUTED}
                        className="tabular-nums"
                      >
                        {ovNum}
                      </text>
                    )}
                  </g>
                );
              })}
            </svg>
            <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
              <span>Over 1</span>
              <span className="tabular-nums">Over {totalOversMax}</span>
            </div>
            {isLoading && (
              <p className="mt-1 text-center text-[11px] text-muted-foreground">
                Syncing latest overs…
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
