"use client";

import { useMemo } from "react";
import dynamic from "next/dynamic";
import { Disclosure } from "~/components/ds/disclosure";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { useMatchBallLogQuery } from "~/lib/hooks/useMatchQueries";
import type { BallEvent, Match } from "~/lib/match-types";
import {
  inningsBalls as inningsBallCount,
  isWicketFall,
  runRate,
  teamName,
} from "~/lib/cricket";
import { MatchSuperstars } from "./match-superstars";
import { WagonWheel } from "./wagon-wheel";
import { MatchWormChart } from "./match-worm-chart";
import { MatchManhattan } from "./match-manhattan";
import {
  Activity,
  Award,
  BarChart3,
  CircleDot,
  PieChart,
  Swords,
  TrendingUp,
} from "lucide-react";
import {
  bestOver,
  boundaryPct,
  buildOverTable,
  extrasSplit,
  inningsBalls,
  lastNOvers,
  phaseSplits,
} from "~/lib/match-charts";

const HeadToHead = dynamic(
  () => import("./head-to-head").then((m) => m.HeadToHead),
  { ssr: false },
);

type Ball = BallEvent;

interface MatchStatsProps {
  match: Match;
}

/** The sections the jump bar reaches; `wide`: not on phones. */
const JUMPS = [
  { id: "stats-performers", label: "Top performers", icon: Award },
  { id: "stats-wagon-wheel", label: "Field", icon: CircleDot },
  { id: "stats-worm", label: "Worm", icon: TrendingUp },
  { id: "stats-manhattan", label: "Runs / over", icon: BarChart3 },
  { id: "stats-breakdown", label: "Deliveries", icon: PieChart },
  { id: "stats-phases", label: "Phases", icon: Activity, wide: true },
  { id: "stats-head-to-head", label: "Head to head", icon: Swords },
];

/**
 * Where a jump lands: clear of what is pinned above it (the match's tabs and
 * their strip; from tablets up the jump bar too).
 */
const JUMP_MARGIN =
  "scroll-mt-[calc(var(--pinned-top,0px)+var(--pinned-tabs,0px)+0.5rem)] md:scroll-mt-[calc(var(--pinned-top,0px)+var(--pinned-tabs,0px)+3.5rem)]";

/** Scrolls to a section, opening it first if it is folded. */
function jumpTo(id: string) {
  const section = document.getElementById(id);
  if (section instanceof HTMLDetailsElement) section.open = true;
  section?.scrollIntoView({ behavior: "smooth" });
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
      {/* Jump bar: from tablets up it pins under the match's tabs. A phone
          has no room for a third pinned row, so there it stays here. */}
      <div className="no-scrollbar flex items-center gap-1 rounded-full bg-card/90 p-1 shadow-soft ring-1 ring-border/40 backdrop-blur max-md:overflow-x-auto md:sticky md:top-[calc(var(--pinned-top,0px)+var(--pinned-tabs,0px)+0.25rem)] md:z-10 md:flex-wrap">
        <span className="hidden px-2.5 text-xs text-muted-foreground sm:inline-block">
          Jump to
        </span>
        {JUMPS.map(({ id, label, icon: Icon, wide }) =>
          wide && sortedInnings.length === 0 ? null : (
            <button
              key={id}
              type="button"
              onClick={() => jumpTo(id)}
              className={`min-h-9 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3 text-xs font-medium text-foreground transition-colors hover:bg-accent ${wide ? "hidden sm:inline-flex" : "inline-flex"}`}
            >
              <Icon className="h-3.5 w-3.5 text-muted-foreground max-sm:hidden" aria-hidden="true" />
              {label}
            </button>
          ),
        )}
      </div>

      {/* Who shaped the match, before the charts of how. */}
      <section
        id="stats-performers"
        aria-labelledby="stats-performers-title"
        className={`space-y-3 ${JUMP_MARGIN}`}
      >
        <h3
          id="stats-performers-title"
          className="text-base font-semibold text-foreground"
        >
          Top performers
        </h3>
        <MatchSuperstars match={match} />
      </section>

      {/* 1. Wagon wheel stays on top — deferred off-screen */}
      <div id="stats-wagon-wheel" className={`chart-defer ${JUMP_MARGIN}`}>
        <WagonWheel match={match} />
      </div>

      {/* 2. Worm chart — deferred off-screen */}
      <div id="stats-worm" className={`chart-defer ${JUMP_MARGIN}`}>
        <MatchWormChart match={match} ballLog={ballLog} />
      </div>

      {/* 3. Manhattan — deferred off-screen */}
      <div id="stats-manhattan" className={`chart-defer ${JUMP_MARGIN}`}>
        <MatchManhattan match={match} />
      </div>

      {/* 5. Phase splits + momentum per innings */}
      {sortedInnings.length > 0 && (
        <div
          id="stats-phases"
          className={`grid gap-2 md:grid-cols-2 md:gap-4 ${JUMP_MARGIN}`}
        >
          {sortedInnings.map((innings, ii) => {
            const table = tables[ii]?.table ?? [];
            const best = bestOver(table);
            const last5 = lastNOvers(table, 5);
            const phases = phaseSplits(
              inningsBalls(innings, ballLog),
              match.overs_per_innings,
            );
            return (
              <Disclosure
                key={innings.id}
                title={
                  <span className="flex items-center gap-2 text-sm sm:text-base">
                    <span
                      aria-hidden="true"
                      className={`h-2.5 w-2.5 shrink-0 rounded-full ${ii === 0 ? "bg-series-1" : "bg-series-2"}`}
                    />
                    <span className="min-w-0 truncate">
                      {teamName(match, innings.team_id)} ·{" "}
                      <span className="font-score font-bold tabular-nums">
                        {innings.total_runs}/{innings.total_wickets}
                      </span>
                    </span>
                  </span>
                }
                aside={
                  <span className="text-xs font-medium text-muted-foreground">
                    Innings {innings.innings_number} phases
                  </span>
                }
              >
                <div className="space-y-3.5 px-4 pb-4">
                  <div className="grid grid-cols-2 gap-2 text-xs sm:text-sm">
                    <div className="rounded-xl bg-muted p-2.5">
                      <span className="text-muted-foreground block text-2xs">Best over</span>
                      <span className="font-semibold tabular-nums text-foreground">
                        {best ? `Over ${best.over} (${best.runs} runs)` : "—"}
                      </span>
                    </div>
                    <div className="rounded-xl bg-muted p-2.5">
                      <span className="text-muted-foreground block text-2xs">Run rate</span>
                      <span className="font-semibold tabular-nums text-foreground">
                        {runRate(innings.total_runs, inningsBallCount(innings))}
                      </span>
                    </div>
                    <div className="rounded-xl bg-muted p-2.5">
                      <span className="text-muted-foreground block text-2xs">Last 5 overs</span>
                      <span className="font-semibold tabular-nums text-foreground">
                        {last5.runs}/{last5.wickets}
                      </span>
                    </div>
                    <div className="rounded-xl bg-muted p-2.5">
                      <span className="text-muted-foreground block text-2xs">Extras (runs)</span>
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
                              className={`h-full rounded-full ${ii === 0 ? "bg-series-1" : "bg-series-2"}`}
                              style={{ width: `${(p.runs / maxPhase) * 100}%` }}
                            />
                          </div>
                          <span className="w-24 shrink-0 text-right tabular-nums text-muted-foreground font-medium">
                            {p.runs}/{p.wickets} · {p.overs}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </Disclosure>
            );
          })}
        </div>
      )}

      {/* 6. Delivery breakdown */}
      <Disclosure
        id="stats-breakdown"
        title="Delivery breakdown"
        className={JUMP_MARGIN}
      >
        <div className="px-4 pb-4">
          <div className="grid gap-6 md:grid-cols-2">
            {sortedInnings.map((innings) => {
              // A retirement hurt is neither a ball nor a wicket.
              const balls = inningsBalls(innings, ballLog).filter(
                (b) => !(b.is_wicket && b.dismissal_type === "retired_hurt"),
              );
                // Mutually exclusive buckets — every ball lands in exactly
                // one, so counts sum to balls.length and the bar never
                // overflows (a no-ball with bat runs counts as an extras
                // ball, not twice).
                const isWkt = isWicketFall;
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

                // Runs 0-3 as a grey ramp; boundaries, extras and wickets
                // in their delivery colours (the tiles below are the key).
                const segs = [
                  { label: "Dots", count: dots, cls: "bg-muted-foreground/25" },
                  { label: "1s", count: ones, cls: "bg-muted-foreground/45" },
                  { label: "2s", count: twos, cls: "bg-muted-foreground/70" },
                  { label: "3s", count: threes, cls: "bg-muted-foreground" },
                  { label: "4s", count: fours, cls: "bg-four" },
                  ...(fives > 0
                    ? [{ label: "5s", count: fives, cls: "bg-four/60" }]
                    : []),
                  { label: "6s", count: sixes, cls: "bg-six" },
                  { label: "Balls with extras", count: extras, cls: "bg-extra" },
                  { label: "Wickets", count: wickets, cls: "bg-wicket" },
                ];

              return (
                <Card
                  key={innings.id}
                  className="max-md:border-0 max-md:bg-transparent max-md:shadow-none max-md:ring-0"
                >
                  <CardHeader className="pb-2 max-md:p-0 max-md:pb-2">
                    <CardTitle className="text-balance text-base">
                      {teamName(match, innings.team_id)} · {innings.total_runs}/
                      {innings.total_wickets}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="max-md:p-0">
                    <div className="grid grid-cols-4 gap-1.5 md:gap-2">
                      {(
                        [
                          ["Dots", dots, "bg-muted-foreground/25", ""],
                          ["Singles", ones, "bg-muted-foreground/45", ""],
                          ["Doubles", twos, "bg-muted-foreground/70", ""],
                          ["Threes", threes, "bg-muted-foreground", ""],
                          ["Fours", fours, "bg-four", "text-four"],
                          ["Sixes", sixes, "bg-six", "text-six"],
                          // Deliveries, like the tiles beside it (the
                          // extras' runs are the chips below).
                          ["Balls with extras", extras, "bg-extra", "text-extra"],
                          ["Wickets", wickets, "bg-wicket", "text-wicket"],
                        ] as const
                      ).map(([label, count, swatch, tone]) => (
                        <div key={label} className="rounded-xl bg-muted p-2 text-center md:p-3">
                          <p className={`font-score text-2xl font-semibold tabular-nums ${tone}`}>
                            {count}
                          </p>
                          <p className="mt-0.5 inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                            <span aria-hidden="true" className={`h-2 w-2 rounded-full ${swatch}`} />
                            {label}
                          </p>
                        </div>
                      ))}
                    </div>

                    <div
                      className="mt-4 flex h-2.5 w-full gap-[2px] overflow-hidden rounded-full"
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
                            className="h-full rounded-full bg-primary"
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
                            className="h-full rounded-full bg-muted-foreground/60"
                            style={{ width: `${dotPct}%` }}
                          />
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-1.5 text-2xs text-muted-foreground">
                      <span className="rounded-full bg-muted px-2 py-0.5 tabular-nums">
                        Wides {ex.wides}
                      </span>
                      <span className="rounded-full bg-muted px-2 py-0.5 tabular-nums">
                        No-balls {ex.noBalls}
                      </span>
                      <span className="rounded-full bg-muted px-2 py-0.5 tabular-nums">
                        Byes {ex.byes}
                      </span>
                      <span className="rounded-full bg-muted px-2 py-0.5 tabular-nums">
                        Leg byes {ex.legByes}
                      </span>
                      {ex.penalties > 0 && (
                        <span className="rounded-full bg-muted px-2 py-0.5 tabular-nums">
                          Penalty runs {ex.penalties}
                        </span>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </Disclosure>

      {/* Reads the two sides' past meetings, so only once it is opened. */}
      <Disclosure
        id="stats-head-to-head"
        title="Head to head"
        below={
          <span className="text-xs text-muted-foreground">
            {match.team1.name} and {match.team2.name} in past meetings
          </span>
        }
        lazy
        className={JUMP_MARGIN}
      >
        <div className="px-3 pb-3">
          <HeadToHead
            team1={match.team1}
            team2={match.team2}
            currentMatchId={match.id}
          />
        </div>
      </Disclosure>
    </div>
  );
}
