"use client";

import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { useMatchBallLogQuery } from "~/lib/hooks/useMatchQueries";
import type { BallEvent, Match } from "~/lib/match-types";
import { teamName, runRate, inningsBalls as inningsBallCount } from "~/lib/cricket";
import { WagonWheel } from "./wagon-wheel";
import { MatchWormChart } from "./match-worm-chart";
import { MatchManhattan } from "./match-manhattan";
import { Activity, BarChart3, CircleDot, PieChart, TrendingUp } from "lucide-react";
import {
  CHART_TEAM1,
  CHART_TEAM2,
  bestOver,
  boundaryPct,
  buildOverTable,
  extrasSplit,
  inningsBalls,
  lastNOvers,
  phaseSplits,
} from "~/lib/match-charts";

type Ball = BallEvent;

interface MatchStatsProps {
  match: Match;
}

export function MatchStats({ match }: MatchStatsProps) {
  const { data } = useMatchBallLogQuery(match.id);
  // Pass through `undefined` while loading so the worm shows its spinner
  // instead of a "no deliveries" flash; same query key = shared cache.
  const ballLog = (data ?? undefined) as Ball[] | null | undefined;

  const sortedInnings = useMemo(
    () => [...(match.innings || [])].sort((a, b) => a.innings_number - b.innings_number),
    [match.innings],
  );

  const tables = useMemo(
    () =>
      sortedInnings.map((inn) => ({
        innings: inn,
        table: buildOverTable(inningsBalls(inn, ballLog)),
      })),
    [sortedInnings, ballLog],
  );

  return (
    <div className="w-full space-y-6">
      {/* Broadcast Quick Jump Bar */}
      <div className="sticky top-2 z-20 flex flex-wrap items-center gap-1.5 rounded-xl border border-border bg-card p-1.5 shadow-sm">
        <span className="hidden px-2 text-xs font-medium text-muted-foreground sm:inline-block">
          Jump:
        </span>
        <button
          type="button"
          onClick={() =>
            document
              .getElementById("stats-wagon-wheel")
              ?.scrollIntoView({ behavior: "smooth" })
          }
          className="inline-flex items-center gap-1.5 rounded-lg bg-muted/60 px-2.5 py-1 text-xs font-semibold text-foreground transition-colors hover:bg-muted"
        >
          <CircleDot className="h-3.5 w-3.5 text-primary" />
          Field
        </button>
        <button
          type="button"
          onClick={() =>
            document
              .getElementById("stats-worm")
              ?.scrollIntoView({ behavior: "smooth" })
          }
          className="inline-flex items-center gap-1.5 rounded-lg bg-muted/60 px-2.5 py-1 text-xs font-semibold text-foreground transition-colors hover:bg-muted"
        >
          <TrendingUp className="h-3.5 w-3.5 text-sky-500" />
          Worm
        </button>
        <button
          type="button"
          onClick={() =>
            document
              .getElementById("stats-manhattan")
              ?.scrollIntoView({ behavior: "smooth" })
          }
          className="inline-flex items-center gap-1.5 rounded-lg bg-muted/60 px-2.5 py-1 text-xs font-semibold text-foreground transition-colors hover:bg-muted"
        >
          <BarChart3 className="h-3.5 w-3.5 text-amber-500" />
          Runs / over
        </button>
        <button
          type="button"
          onClick={() =>
            document
              .getElementById("stats-breakdown")
              ?.scrollIntoView({ behavior: "smooth" })
          }
          className="inline-flex items-center gap-1.5 rounded-lg bg-muted/60 px-2.5 py-1 text-xs font-semibold text-foreground transition-colors hover:bg-muted"
        >
          <PieChart className="h-3.5 w-3.5 text-purple-500" />
          Deliveries
        </button>
        {sortedInnings.length > 0 && (
          <button
            type="button"
            onClick={() =>
              document
                .getElementById("stats-phases")
                ?.scrollIntoView({ behavior: "smooth" })
            }
            className="hidden sm:inline-flex items-center gap-1.5 rounded-lg bg-muted/60 px-2.5 py-1 text-xs font-semibold text-foreground transition-colors hover:bg-muted"
          >
            <Activity className="h-3.5 w-3.5 text-emerald-500" />
            Phases
          </button>
        )}
      </div>

      {/* 1. Wagon wheel stays on top — deferred off-screen */}
      <div id="stats-wagon-wheel" className="chart-defer scroll-mt-16">
        <WagonWheel match={match} />
      </div>

      {/* 2. Worm chart — deferred off-screen */}
      <div id="stats-worm" className="chart-defer scroll-mt-16">
        <MatchWormChart match={match} ballLog={ballLog} />
      </div>

      {/* 3. Manhattan — deferred off-screen */}
      <div id="stats-manhattan" className="chart-defer scroll-mt-16">
        <MatchManhattan match={match} />
      </div>

      {/* 5. Phase splits + momentum per innings */}
      {sortedInnings.length > 0 && (
        <div id="stats-phases" className="grid gap-4 md:grid-cols-2 scroll-mt-16">
          {sortedInnings.map((innings, ii) => {
            const table = tables[ii]?.table ?? [];
            const best = bestOver(table);
            const last5 = lastNOvers(table, 5);
            const phases = phaseSplits(
              inningsBalls(innings, ballLog),
              match.overs_per_innings,
            );
            return (
              <Card key={innings.id} className="overflow-hidden border-border bg-card">
                <div
                  className="h-1 w-full"
                  style={{
                    background: ii === 0 ? CHART_TEAM1 : CHART_TEAM2,
                  }}
                />
                <CardContent className="space-y-3.5 py-4">
                  <div className="flex items-center justify-between">
                    <p className="font-semibold text-foreground text-sm sm:text-base">
                      {teamName(match, innings.team_id)} ·{" "}
                      <span className="font-score font-bold tabular-nums">
                        {innings.total_runs}/{innings.total_wickets}
                      </span>
                    </p>
                    <span className="text-xs text-muted-foreground font-medium">
                      Innings {innings.innings_number}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs sm:text-sm">
                    <div className="rounded-lg border border-border/50 bg-muted/20 p-2">
                      <span className="text-muted-foreground block text-2xs">Best over</span>
                      <span className="font-semibold tabular-nums text-foreground">
                        {best ? `Over ${best.over} (${best.runs} runs)` : "—"}
                      </span>
                    </div>
                    <div className="rounded-lg border border-border/50 bg-muted/20 p-2">
                      <span className="text-muted-foreground block text-2xs">Run rate</span>
                      <span className="font-semibold tabular-nums text-foreground">
                        {runRate(innings.total_runs, inningsBallCount(innings))}
                      </span>
                    </div>
                    <div className="rounded-lg border border-border/50 bg-muted/20 p-2">
                      <span className="text-muted-foreground block text-2xs">Last 5 ov</span>
                      <span className="font-semibold tabular-nums text-foreground">
                        {last5.runs}/{last5.wickets}
                      </span>
                    </div>
                    <div className="rounded-lg border border-border/50 bg-muted/20 p-2">
                      <span className="text-muted-foreground block text-2xs">Extras</span>
                      <span className="font-semibold tabular-nums text-foreground">
                        {extrasSplit(innings).total}
                      </span>
                    </div>
                  </div>
                  <div className="space-y-2 border-t border-border/50 pt-3">
                    <span className="text-2xs font-medium text-muted-foreground block">
                      Phase analysis
                    </span>
                    {phases.map((p) => {
                      const maxPhase = Math.max(
                        ...phases.map((x) => x.runs),
                        1,
                      );
                      return (
                        <div
                          key={p.label}
                          className="flex items-center gap-2 text-xs"
                        >
                          <span className="w-20 shrink-0 font-medium text-foreground">
                            {p.label}
                          </span>
                          <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                            <div
                              className="h-full rounded-full transition-[width] duration-700 ease-out"
                              style={{
                                width: `${(p.runs / maxPhase) * 100}%`,
                                background:
                                  ii === 0 ? CHART_TEAM1 : CHART_TEAM2,
                              }}
                            />
                          </div>
                          <span className="w-24 shrink-0 text-right tabular-nums text-muted-foreground font-medium">
                            {p.runs}/{p.wickets} · {p.overs}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* 6. Delivery breakdown */}
      <Card id="stats-breakdown" className="scroll-mt-16 border-border">
        <CardHeader className="border-b border-border/50 pb-3">
          <CardTitle className="text-balance text-base sm:text-lg">Delivery breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6 md:grid-cols-2">
            {sortedInnings.map((innings) => {
              const balls = inningsBalls(innings, ballLog);
                // Mutually exclusive buckets — every ball lands in exactly
                // one, so counts sum to balls.length and the bar never
                // overflows (a no-ball with bat runs counts as an extras
                // ball, not twice).
                const isWkt = (b: (typeof balls)[number]) => b.is_wicket;
                const hasEx = (b: (typeof balls)[number]) => (b.extras ?? 0) > 0;
                const batRuns = (b: (typeof balls)[number]) => b.runs_scored ?? 0;
                const wickets = balls.filter(isWkt).length;
                const noWkt = balls.filter((b) => !isWkt(b));
                const extras = noWkt.filter(hasEx).length;
                const legal = noWkt.filter((b) => !hasEx(b));
                const dots = legal.filter((b) => batRuns(b) === 0).length;
                const ones = legal.filter((b) => batRuns(b) === 1).length;
                const twos = legal.filter((b) => batRuns(b) === 2).length;
                const threes = legal.filter((b) => batRuns(b) === 3).length;
                const fours = legal.filter((b) => batRuns(b) === 4).length;
                const fives = legal.filter((b) => batRuns(b) === 5).length;
                const sixes = legal.filter((b) => batRuns(b) === 6).length;
                const total = Math.max(1, balls.length);
                // Boundary share counts bat runs even on no-balls.
                const batFours = balls.filter((b) => batRuns(b) === 4).length;
                const batSixes = balls.filter((b) => batRuns(b) === 6).length;
                const bpct = boundaryPct(batFours, batSixes, innings.total_runs);
              const dotPct = (dots / total) * 100;
              const ex = extrasSplit(innings);

                const segs = [
                  { label: "Dots", count: dots, cls: "bg-slate-400" },
                  { label: "1s", count: ones, cls: "bg-sky-400" },
                  { label: "2s", count: twos, cls: "bg-blue-500" },
                  { label: "3s", count: threes, cls: "bg-violet-500" },
                  { label: "4s", count: fours, cls: "bg-yellow-400" },
                  ...(fives > 0
                    ? [{ label: "5s", count: fives, cls: "bg-amber-500" }]
                    : []),
                  { label: "6s", count: sixes, cls: "bg-orange-500" },
                  { label: "Ex", count: extras, cls: "bg-rose-400" },
                  { label: "Wk", count: wickets, cls: "bg-red-500" },
                ];

              return (
                <Card key={innings.id}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-balance text-base">
                      {teamName(match, innings.team_id)} · {innings.total_runs}/
                      {innings.total_wickets}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-4 gap-2">
                      <div className="rounded-lg bg-muted p-3 text-center">
                        <p className="tabular-nums text-2xl font-bold">{dots}</p>
                        <p className="text-xs text-muted-foreground">Dots</p>
                      </div>
                      <div className="rounded-lg bg-muted p-3 text-center">
                        <p className="tabular-nums text-2xl font-bold">{ones}</p>
                        <p className="text-xs text-muted-foreground">Singles</p>
                      </div>
                      <div className="rounded-lg bg-muted p-3 text-center">
                        <p className="tabular-nums text-2xl font-bold">{twos}</p>
                        <p className="text-xs text-muted-foreground">Doubles</p>
                      </div>
                      <div className="rounded-lg bg-muted p-3 text-center">
                        <p className="tabular-nums text-2xl font-bold">{threes}</p>
                        <p className="text-xs text-muted-foreground">Threes</p>
                      </div>
                      <div className="rounded-lg bg-yellow-500/15 p-3 text-center">
                        <p className="tabular-nums text-2xl font-bold text-yellow-600 dark:text-yellow-400">
                          {fours}
                        </p>
                        <p className="text-xs text-muted-foreground">Fours</p>
                      </div>
                      <div className="rounded-lg bg-orange-500/15 p-3 text-center">
                        <p className="tabular-nums text-2xl font-bold text-orange-600 dark:text-orange-400">
                          {sixes}
                        </p>
                        <p className="text-xs text-muted-foreground">Sixes</p>
                      </div>
                      <div className="rounded-lg bg-rose-500/10 p-3 text-center">
                        <p className="tabular-nums text-2xl font-bold text-rose-500">
                          {extras}
                        </p>
                        <p className="text-xs text-muted-foreground">Extras</p>
                      </div>
                      <div className="rounded-lg bg-red-500/10 p-3 text-center">
                        <p className="tabular-nums text-2xl font-bold text-red-500">
                          {wickets}
                        </p>
                        <p className="text-xs text-muted-foreground">Wickets</p>
                      </div>
                    </div>

                    <div
                      className="mt-4 flex h-2.5 w-full overflow-hidden rounded-full bg-muted"
                      role="img"
                      aria-label={`Ball composition for ${teamName(match, innings.team_id)}`}
                    >
                      {segs.map((s) =>
                        s.count > 0 ? (
                          <div
                            key={s.label}
                            className={s.cls}
                            style={{ width: `${(s.count / total) * 100}%` }}
                            title={`${s.label}: ${s.count}`}
                          />
                        ) : null,
                      )}
                    </div>

                    <div className="mt-4 space-y-3">
                      <div>
                        <div className="mb-1 flex justify-between text-sm">
                          <span>Boundary %</span>
                          <span className="tabular-nums font-medium">
                            {bpct.toFixed(1)}%
                          </span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-muted">
                          <div
                            className="h-full bg-amber-500"
                            style={{ width: `${bpct}%` }}
                          />
                        </div>
                      </div>
                      <div>
                        <div className="mb-1 flex justify-between text-sm">
                          <span>Dot-ball %</span>
                          <span className="tabular-nums font-medium">
                            {dotPct.toFixed(1)}%
                          </span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-muted">
                          <div
                            className="h-full bg-slate-400 transition-[width] duration-700 ease-out"
                            style={{ width: `${dotPct}%` }}
                          />
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-1.5 text-2xs text-muted-foreground">
                      <span className="rounded-full bg-muted px-2 py-0.5 tabular-nums">
                        Wd {ex.wides}
                      </span>
                      <span className="rounded-full bg-muted px-2 py-0.5 tabular-nums">
                        Nb {ex.noBalls}
                      </span>
                      <span className="rounded-full bg-muted px-2 py-0.5 tabular-nums">
                        B {ex.byes}
                      </span>
                      <span className="rounded-full bg-muted px-2 py-0.5 tabular-nums">
                        Lb {ex.legByes}
                      </span>
                      {ex.penalties > 0 && (
                        <span className="rounded-full bg-muted px-2 py-0.5 tabular-nums">
                          Pen {ex.penalties}
                        </span>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
