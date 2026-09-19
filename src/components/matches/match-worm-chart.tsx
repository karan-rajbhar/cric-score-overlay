"use client";

import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import type { BallEvent, Match } from "~/lib/match-types";
import { useMatchBallLogQuery } from "~/lib/hooks/useMatchQueries";
import { Loader2 } from "lucide-react";
import {
  CHART_GRID,
  CHART_MUTED,
  CHART_TEAM1,
  CHART_TEAM2,
  buildOverTable,
  inningsBalls,
} from "~/lib/match-charts";

interface MatchWormChartProps {
  match: Match;
  ballLog?: BallEvent[] | null;
}

/**
 * Worm chart — cumulative run progression, visual parity with the exported
 * match report (shared teal/amber palette, gridlines, axes, wicket dots).
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

  // ---- SVG geometry (mirrors generateWormChartSvg in match-report.ts) ----
  const w = 550;
  const h = 210;
  const ml = 45;
  const mr = 20;
  const mt = 32;
  const mb = 28;
  const pw = w - ml - mr;
  const ph = h - mt - mb;

  const totalOversMax = Math.max(
    match.overs_per_innings || 20,
    ...series.map((s) => s.table.length),
    1,
  );
  const maxRunsRaw = Math.max(
    ...series.map((s) => s.innings.total_runs ?? 0),
    ...series.flatMap((s) => s.table.map((o) => o.cumulativeRuns)),
    40,
  );
  const maxRuns = Math.ceil(maxRunsRaw / 25) * 25;

  const getX = (ov: number) => ml + (ov / totalOversMax) * pw;
  const getY = (r: number) => mt + ph - (r / maxRuns) * ph;

  const gridSteps = [0, 1, 2, 3, 4].map((step) => {
    const val = Math.round((maxRuns / 4) * step);
    return { val, y: getY(val) };
  });
  const tickStep =
    totalOversMax <= 10 ? 2 : totalOversMax <= 20 ? 5 : 10;
  const xTicks: number[] = [];
  for (let ov = tickStep; ov <= totalOversMax; ov += tickStep) xTicks.push(ov);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-balance text-lg">
          Worm Chart · Cumulative Run Progression
        </CardTitle>
      </CardHeader>
      <CardContent>
        <style>{`
          @keyframes worm-draw { from { stroke-dashoffset: var(--worm-len, 1200); } to { stroke-dashoffset: 0; } }
          @keyframes chart-fade-in { from { opacity: 0; transform: scale(0.4); } to { opacity: 1; transform: scale(1); } }
          .worm-path {
            stroke-dasharray: var(--worm-len, 1200);
            stroke-dashoffset: var(--worm-len, 1200);
            animation: worm-draw 1.2s ease-out forwards;
          }
          .worm-wicket { opacity: 0; animation: chart-fade-in 0.35s ease-out forwards; transform-box: fill-box; transform-origin: center; }
          @media (prefers-reduced-motion: reduce) {
            .worm-path, .worm-wicket { animation: none; stroke-dashoffset: 0; opacity: 1; }
          }
        `}</style>
        {ballLog === null && isLoading && ballLogProp === undefined ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : !hasData ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No deliveries yet — the worm builds as overs are bowled.
          </p>
        ) : (
          <div>
            <svg
              viewBox={`0 0 ${w} ${h}`}
              className="h-auto w-full"
              role="img"
              aria-label={`Worm chart: ${series
                .map(
                  (s) =>
                    `${s.teamName} ${s.innings.total_runs}/${s.innings.total_wickets}`,
                )
                .join(" vs ")}`}
            >
              {/* Legend */}
              {series[0] && (
                <g>
                  <rect x={ml} y={10} width={10} height={10} rx={2} fill={CHART_TEAM1} />
                  <text
                    x={ml + 15}
                    y={19}
                    fontSize={10}
                    fontWeight={700}
                    fill="currentColor"
                    opacity={0.9}
                  >
                    {series[0].shortName}: {series[0].innings.total_runs}/
                    {series[0].innings.total_wickets}
                  </text>
                </g>
              )}
              {series[1] && (
                <g>
                  <rect
                    x={ml + 180}
                    y={10}
                    width={10}
                    height={10}
                    rx={2}
                    fill={CHART_TEAM2}
                  />
                  <text
                    x={ml + 195}
                    y={19}
                    fontSize={10}
                    fontWeight={700}
                    fill="currentColor"
                    opacity={0.9}
                  >
                    {series[1].shortName}: {series[1].innings.total_runs}/
                    {series[1].innings.total_wickets}
                  </text>
                </g>
              )}
              <circle cx={ml + 350} cy={15} r={3.5} fill="#64748b" />
              <text x={ml + 360} y={19} fontSize={9} fill={CHART_MUTED}>
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
              {xTicks.map((ov) => (
                <text
                  key={ov}
                  x={getX(ov)}
                  y={mt + ph + 14}
                  textAnchor="middle"
                  fontSize={8.5}
                  fill={CHART_MUTED}
                  className="tabular-nums"
                >
                  Ov {ov}
                </text>
              ))}

              {/* Lines + wicket dots */}
              {series.map((s, si) => {
                const pts = [
                  {
                    overNumber: 0,
                    runs: 0,
                    wickets: 0,
                    cumulativeRuns: 0,
                    cumulativeWickets: 0,
                  },
                  ...s.table,
                ];
                const d = pts
                  .map(
                    (p, idx) =>
                      `${idx === 0 ? "M" : "L"} ${getX(p.overNumber).toFixed(1)} ${getY(p.cumulativeRuns).toFixed(1)}`,
                  )
                  .join(" ");
                const color = si === 0 ? CHART_TEAM1 : CHART_TEAM2;
                return (
                  <g key={s.innings.id}>
                    <path
                      d={d}
                      fill="none"
                      stroke={color}
                      strokeWidth={2.5}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="worm-path"
                      style={{ ["--worm-len" as string]: 1200, animationDelay: `${si * 0.15}s` }}
                    >
                      <title>
                        {s.teamName}: {s.innings.total_runs}/
                        {s.innings.total_wickets}
                      </title>
                    </path>
                    {s.table
                      .filter((o) => o.wickets > 0)
                      .map((o, wi) => (
                        <circle
                          key={`${s.innings.id}-${o.overNumber}`}
                          cx={getX(o.overNumber)}
                          cy={getY(o.cumulativeRuns)}
                          r={4}
                          fill={color}
                          stroke="#ffffff"
                          strokeWidth={1.5}
                          className="worm-wicket"
                          style={{ animationDelay: `${0.9 + wi * 0.06 + si * 0.15}s` }}
                        >
                          <title>
                            {s.teamName} over {o.overNumber}:{" "}
                            {o.cumulativeRuns}/{o.cumulativeWickets} —{" "}
                            {o.wickets} wicket{o.wickets === 1 ? "" : "s"} fell
                          </title>
                        </circle>
                      ))}
                  </g>
                );
              })}
              {/* Wicket fallback dots in red when overlapping not needed — kept subtle */}
            </svg>
            <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
              <span>Over 1</span>
              <span className="tabular-nums">Over {totalOversMax}</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
