"use client";

/**
 * Chart cards: Manhattan (runs per over), worm (runs so far by over) and
 * run rates by phase, drawn with the design system's charts at a fixed
 * width for the 1920×1080 canvas.
 *
 * Data: each innings' over documents (`useInningsBallLog`: read when a
 * chart shows and the innings has moved since; a finished innings once).
 * Available once an over has been bowled.
 */

import { useMemo } from "react";
import {
  ChartLegend,
  OverBarsChart,
  WormChart,
  type SeriesKey,
} from "~/components/ds/charts";
import { phaseBoundaries } from "~/lib/match-report";
import { buildOverTable, type OverPoint } from "~/lib/match-charts";
import type { Innings, Match } from "~/lib/match-types";
import { cn } from "~/lib/utils";
import { useInningsBallLog, useScorecardInnings } from "./overlay-data";
import { CardShell, eyebrowOf, OV, type OverlayThemeProps } from "./overlay-kit";
import { inningsTeamName } from "./scorecard-cards";
import type { LiveMatchState } from "./types";

export type ChartKind = "manhattan" | "worm" | "run_rate";

const TITLE: Record<ChartKind, string> = {
  manhattan: "Runs per over",
  worm: "Run progression",
  run_rate: "Run rates",
};

/** Whether a chart has anything to draw: an over bowled in this match. */
export function chartAvailable(
  _kind: ChartKind,
  state: LiveMatchState,
): boolean {
  return (state.innings_number ?? 0) > 1 || (state.total_balls ?? 0) >= 6;
}

interface Series {
  innings: Innings;
  name: string;
  table: OverPoint[];
}

function useSeries(
  state: LiveMatchState,
  match: Match | null | undefined,
): Series[] | null {
  const { innings } = useScorecardInnings(match);
  const main = useMemo(
    () => innings.filter((i) => i.innings_number <= 2),
    [innings],
  );
  const log = useInningsBallLog(state, main, true);
  return useMemo(() => {
    if (!log) return null;
    return main.map((inn) => ({
      innings: inn,
      name: inningsTeamName(state, inn, match?.team1_id),
      table: buildOverTable(log.get(inn.id) ?? []),
    }));
  }, [main, log, match, state]);
}

const CHART_WIDTH = 1180;

function PhaseRates({ series, maxOvers }: { series: Series[]; maxOvers: number }) {
  const bounds = phaseBoundaries(maxOvers);
  const phases = bounds
    ? [
        { label: "Powerplay", from: 1, to: bounds.ppEnd },
        { label: "Middle overs", from: bounds.ppEnd + 1, to: bounds.midEnd },
        { label: "Death overs", from: bounds.midEnd + 1, to: maxOvers },
      ]
    : [{ label: "Innings", from: 1, to: maxOvers }];
  const rate = (s: Series, from: number, to: number) => {
    const overs = s.table.filter((o) => o.overNumber >= from && o.overNumber <= to);
    if (!overs.length) return null;
    const runs = overs.reduce((n, o) => n + o.runs, 0);
    const wkts = overs.reduce((n, o) => n + o.wickets, 0);
    return { rr: (runs / overs.length).toFixed(2), runs, wkts };
  };
  return (
    <table className="w-full text-lg">
      <thead>
        <tr className={cn("border-b", OV.cardLine, OV.cardMuted)}>
          <th className="px-3 py-2 text-left text-base font-medium">Phase</th>
          {series.map((s) => (
            <th key={s.innings.id} className="px-3 py-2 text-right text-base font-medium">
              {s.name}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {phases.map((p) => (
          <tr key={p.label} className={cn("border-b last:border-0", OV.cardLine)}>
            <td className="px-3 py-2 font-medium">
              {p.label}
              <span className={cn("ml-2 text-base", OV.cardMuted)}>
                overs {p.from} to {p.to}
              </span>
            </td>
            {series.map((s) => {
              const r = rate(s, p.from, p.to);
              return (
                <td key={s.innings.id} className="px-3 py-2 text-right tabular-nums">
                  {r ? (
                    <>
                      <span className="font-bold">{r.rr}</span>
                      <span className={cn("ml-2 text-base", OV.cardMuted)}>
                        {r.runs}/{r.wkts}
                      </span>
                    </>
                  ) : (
                    "–"
                  )}
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function ChartCard({
  state,
  match,
  kind,
}: OverlayThemeProps & {
  state: LiveMatchState;
  match?: Match | null;
  kind: ChartKind;
}) {
  const series = useSeries(state, match);
  if (!series || !series.some((s) => s.table.length > 0)) return null;
  const maxOvers = Math.max(
    state.overs_per_innings ?? 20,
    ...series.map((s) => s.table.length),
    1,
  );
  const shown = series.slice(0, 2);
  const legend = shown.map((s, i) => ({
    label: s.name,
    value: `${s.innings.total_runs}/${s.innings.total_wickets}`,
    series: (i + 1) as SeriesKey,
    shape: kind === "worm" ? ("line" as const) : ("square" as const),
  }));
  const label = `${TITLE[kind]}: ${legend.map((l) => `${l.label} ${l.value}`).join(", ")}`;
  return (
    <CardShell
      className="max-w-[80rem]"
      eyebrow={eyebrowOf(state, "Match so far")}
      title={TITLE[kind]}
    >
      {kind !== "run_rate" && <ChartLegend items={legend} className="mb-3 text-lg" />}
      {kind === "manhattan" && (
        <OverBarsChart
          label={label}
          width={CHART_WIDTH}
          height={360}
          maxOvers={maxOvers}
          series={shown.map((s, i) => ({
            key: s.innings.id,
            label: s.name,
            series: (i + 1) as SeriesKey,
            overs: s.table.map((o) => ({
              over: o.overNumber,
              runs: o.runs,
              wickets: o.wickets,
            })),
          }))}
        />
      )}
      {kind === "worm" && (
        <WormChart
          label={label}
          width={CHART_WIDTH}
          height={360}
          maxOvers={maxOvers}
          series={shown.map((s, i) => ({
            key: s.innings.id,
            label: s.name,
            series: (i + 1) as SeriesKey,
            points: s.table.map((o) => ({
              over: o.overNumber,
              runs: o.cumulativeRuns,
              wicketsSoFar: o.cumulativeWickets,
              wickets: o.wickets,
            })),
          }))}
        />
      )}
      {kind === "run_rate" && <PhaseRates series={shown} maxOvers={maxOvers} />}
    </CardShell>
  );
}
