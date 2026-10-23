"use client";

/**
 * Test classic charts on ivory cards: runs per over (bars, wickets as red
 * balls on top), the worm (cumulative runs, wickets marked on the line),
 * run rates by phase and the wagon wheel (a ground in two greens, the
 * rope in ivory, fours in gold, sixes in white, each zone's runs on a navy
 * rim). Data: the innings' over documents, read when the chart shows (the
 * same reads as Standard's charts; the demo match carries its balls).
 */

import { useMemo, type ReactNode } from "react";
import { phaseBoundaries } from "~/lib/match-report";
import { buildOverTable, type OverPoint } from "~/lib/match-charts";
import type { Innings, Match } from "~/lib/match-types";
import {
  describeDonutSegment,
  polarToCartesian,
  SECTORS,
} from "~/lib/wagon-wheel-utils";
import { useInningsBallLog, useScorecardInnings } from "../../overlay-data";
import { eyebrowOf } from "../../overlay-kit";
import { inningsTeamName } from "../../scorecard-cards";
import type { LiveMatchState } from "../../types";
import type { OverlayElementProps } from "../types";
import {
  CardShell,
  delay,
  Fig,
  FIGS,
  GOLD_LEAF,
  Label,
  SANS,
  SERIF,
  TC,
  TcRoot,
} from "./kit";
import { isMultiInnings, plural, scoreText, strikeRate } from "./logic";

type P<E extends keyof OverlayElementProps> = OverlayElementProps[E];

interface Series {
  innings: Innings;
  name: string;
  table: OverPoint[];
}

/** The two innings the charts compare (the last two of a multi-innings match). */
function useSeries(state: LiveMatchState, match: Match | null): Series[] | null {
  const { innings } = useScorecardInnings(match);
  const shown = useMemo(() => {
    const multi = isMultiInnings(state.match_format ?? match?.match_format);
    return multi ? innings.slice(-2) : innings.filter((i) => i.innings_number <= 2);
  }, [innings, state.match_format, match?.match_format]);
  const log = useInningsBallLog(state, shown, true);
  return useMemo(() => {
    if (!log) return null;
    return shown.map((inn) => ({
      innings: inn,
      name: inningsTeamName(state, inn, match?.team1_id),
      table: buildOverTable(log.get(inn.id) ?? []),
    }));
  }, [shown, log, match, state]);
}

const SERIES_FILL = [
  `url(#tc-navy)`,
  `url(#tc-gold)`,
] as const;
const SERIES_STROKE = [TC.navy, "#b08a3a"] as const;

function Defs() {
  return (
    <defs>
      <linearGradient id="tc-navy" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor={TC.navyHi} />
        <stop offset="1" stopColor={TC.navyLo} />
      </linearGradient>
      <linearGradient id="tc-gold" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#e6c97f" />
        <stop offset="1" stopColor="#a8843a" />
      </linearGradient>
      <radialGradient id="tc-ball" cx="0.35" cy="0.3" r="0.8">
        <stop offset="0" stopColor={TC.claretHi} />
        <stop offset="1" stopColor="#5e121c" />
      </radialGradient>
    </defs>
  );
}

function Legend({ series }: { series: Series[] }) {
  return (
    <ul className="flex items-center gap-10">
      {series.map((s, i) => (
        <li key={s.innings.id} className="tc-a-fade flex items-center gap-3" style={delay(300 + i * 80)}>
          <span
            aria-hidden="true"
            className="h-4 w-8 rounded-[2px]"
            style={{ background: i === 0 ? `linear-gradient(180deg, ${TC.navyHi}, ${TC.navyLo})` : GOLD_LEAF }}
          />
          <span className="text-[1.375rem] font-semibold">{s.name}</span>
          <Fig className="text-[1.375rem]">
            {scoreText(s.innings.total_runs, s.innings.total_wickets)}
          </Fig>
        </li>
      ))}
      <li className="ml-auto flex items-center gap-3">
        <svg width="18" height="18" aria-hidden="true">
          <Defs />
          <circle cx="9" cy="9" r="8" fill="url(#tc-ball)" />
        </svg>
        <span className="text-[1.25rem]" style={{ color: TC.inkMuted }}>
          Wicket
        </span>
      </li>
    </ul>
  );
}

const W = 1540;
const H = 440;
const PAD = { l: 56, r: 16, t: 16, b: 44 };

function Axes({
  maxY,
  maxOvers,
  step,
}: {
  maxY: number;
  maxOvers: number;
  step: number;
}) {
  const ih = H - PAD.t - PAD.b;
  const iw = W - PAD.l - PAD.r;
  const ticks: number[] = [];
  for (let v = 0; v <= maxY; v += step) ticks.push(v);
  const overStep = maxOvers > 30 ? 10 : 5;
  const overs: number[] = [];
  for (let o = overStep; o <= maxOvers; o += overStep) overs.push(o);
  return (
    <g>
      {ticks.map((v) => {
        const y = PAD.t + ih - (v / maxY) * ih;
        return (
          <g key={v}>
            <line x1={PAD.l} x2={W - PAD.r} y1={y} y2={y} stroke={v === 0 ? TC.ink : TC.ivoryLine} strokeWidth={v === 0 ? 2 : 1} strokeDasharray={v === 0 ? undefined : "4 6"} />
            <text x={PAD.l - 12} y={y} textAnchor="end" dominantBaseline="central" fontSize="18" fill={TC.inkMuted} style={{ fontFamily: SANS, ...FIGS }}>
              {v}
            </text>
          </g>
        );
      })}
      {overs.map((o) => {
        const x = PAD.l + ((o - 0.5) / maxOvers) * iw;
        return (
          <text key={o} x={x} y={H - 14} textAnchor="middle" fontSize="18" fill={TC.inkMuted} style={{ fontFamily: SANS, ...FIGS }}>
            {o}
          </text>
        );
      })}
    </g>
  );
}

function niceStep(max: number): number {
  if (max <= 12) return 2;
  if (max <= 30) return 5;
  if (max <= 80) return 10;
  if (max <= 200) return 25;
  return 50;
}

function ChartShell({
  state,
  title,
  label,
  children,
  aside,
}: {
  state: LiveMatchState;
  title: string;
  label: string;
  children: ReactNode;
  aside?: ReactNode;
}) {
  return (
    <TcRoot data-card={label} className="fixed inset-0 z-40">
      <CardShell label={title} width={1640} eyebrow={eyebrowOf(state, "Match so far")} title={title} aside={aside}>
        {children}
      </CardShell>
    </TcRoot>
  );
}

function maxOversOf(state: LiveMatchState, series: Series[]): number {
  const played = Math.max(1, ...series.map((s) => s.table.length));
  if (isMultiInnings(state.match_format)) return played;
  return Math.max(state.overs_per_innings ?? 20, played);
}

export function RunsPerOver(p: P<"runsPerOver">) {
  const series = useSeries(p.state, p.match);
  if (!series || !series.some((s) => s.table.length)) return null;
  const shown = series.slice(0, 2);
  const maxOvers = maxOversOf(p.state, shown);
  const maxRuns = Math.max(6, ...shown.flatMap((s) => s.table.map((o) => o.runs)));
  const step = niceStep(maxRuns);
  const maxY = Math.ceil((maxRuns + 2) / step) * step;
  const iw = W - PAD.l - PAD.r;
  const ih = H - PAD.t - PAD.b;
  const slot = iw / maxOvers;
  const barW = Math.max(3, (slot * 0.78) / shown.length);
  return (
    <ChartShell state={p.state} title="Runs per over" label="runs-per-over">
      <Legend series={shown} />
      <svg
        role="img"
        aria-label={`Runs per over: ${shown.map((s) => `${s.name} ${scoreText(s.innings.total_runs, s.innings.total_wickets)}`).join(", ")}`}
        viewBox={`0 0 ${W} ${H}`}
        className="mt-4 w-full"
      >
        <Defs />
        <Axes maxY={maxY} maxOvers={maxOvers} step={step} />
        {shown.map((s, si) =>
          s.table.map((o, i) => {
            const x = PAD.l + (o.overNumber - 1) * slot + slot * 0.11 + si * barW;
            const h = (o.runs / maxY) * ih;
            const y = PAD.t + ih - h;
            return (
              <g key={`${s.innings.id}-${o.overNumber}`}>
                <rect
                  className="tc-a-grow-y"
                  x={x}
                  y={y}
                  width={barW - 1}
                  height={Math.max(0, h)}
                  fill={SERIES_FILL[si]}
                  style={{ transformBox: "fill-box", ...delay(250 + i * 18) }}
                />
                {Array.from({ length: o.wickets }, (_, k) => (
                  <circle
                    key={k}
                    className="tc-a-fade"
                    cx={x + (barW - 1) / 2}
                    cy={y - 11 - k * 18}
                    r={Math.min(8, Math.max(5, barW / 2))}
                    fill="url(#tc-ball)"
                    stroke="#fdf9ef"
                    strokeWidth="1.5"
                    style={delay(700 + i * 18)}
                  />
                ))}
              </g>
            );
          }),
        )}
        <text x={PAD.l} y={H - 14} fontSize="16" fill={TC.inkMuted} style={{ fontFamily: SANS }}>
          Over
        </text>
      </svg>
    </ChartShell>
  );
}

export function Worm(p: P<"worm">) {
  const series = useSeries(p.state, p.match);
  if (!series || !series.some((s) => s.table.length)) return null;
  const shown = series.slice(0, 2);
  const maxOvers = maxOversOf(p.state, shown);
  const maxRuns = Math.max(10, ...shown.flatMap((s) => s.table.map((o) => o.cumulativeRuns)));
  const step = niceStep(maxRuns);
  const maxY = Math.ceil((maxRuns + 1) / step) * step;
  const iw = W - PAD.l - PAD.r;
  const ih = H - PAD.t - PAD.b;
  const x = (over: number) => PAD.l + (over / maxOvers) * iw;
  const y = (runs: number) => PAD.t + ih - (runs / maxY) * ih;
  return (
    <ChartShell state={p.state} title="Run progression" label="worm">
      <Legend series={shown} />
      <svg
        role="img"
        aria-label={`Run progression: ${shown.map((s) => `${s.name} ${scoreText(s.innings.total_runs, s.innings.total_wickets)}`).join(", ")}`}
        viewBox={`0 0 ${W} ${H}`}
        className="mt-4 w-full"
      >
        <Defs />
        <Axes maxY={maxY} maxOvers={maxOvers} step={step} />
        {shown.map((s, si) => {
          const pts = [{ over: 0, runs: 0 }, ...s.table.map((o) => ({ over: o.overNumber, runs: o.cumulativeRuns }))];
          const d = pts.map((pt, i) => `${i ? "L" : "M"} ${x(pt.over).toFixed(1)} ${y(pt.runs).toFixed(1)}`).join(" ");
          return (
            <g key={s.innings.id}>
              <path
                className="tc-a-draw"
                d={d}
                pathLength={1}
                fill="none"
                stroke={SERIES_STROKE[si]}
                strokeWidth={si === 0 ? 4.5 : 4}
                strokeLinejoin="round"
                strokeLinecap="round"
                style={delay(250 + si * 200)}
              />
              {s.table.flatMap((o) =>
                Array.from({ length: o.wickets }, (_, k) => (
                  <circle
                    key={`${o.overNumber}-${k}`}
                    className="tc-a-fade"
                    cx={x(o.overNumber)}
                    cy={y(o.cumulativeRuns) - k * 16}
                    r="8"
                    fill="url(#tc-ball)"
                    stroke="#fdf9ef"
                    strokeWidth="1.5"
                    style={delay(1100 + si * 200)}
                  />
                )),
              )}
            </g>
          );
        })}
      </svg>
    </ChartShell>
  );
}

export function RunRates(p: P<"runRates">) {
  const series = useSeries(p.state, p.match);
  if (!series || !series.some((s) => s.table.length)) return null;
  const shown = series.slice(0, 2);
  const maxOvers = maxOversOf(p.state, shown);
  const bounds = isMultiInnings(p.state.match_format) ? null : phaseBoundaries(maxOvers);
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
    return { rr: runs / overs.length, runs, wkts };
  };
  const all = phases.flatMap((ph) => shown.map((s) => rate(s, ph.from, ph.to)?.rr ?? 0));
  const maxRr = Math.max(6, ...all);
  return (
    <ChartShell state={p.state} title="Run rates" label="run-rates">
      <Legend series={shown} />
      <div className="mt-6 space-y-6">
        {phases.map((ph, pi) => (
          <div key={ph.label} className="grid grid-cols-[20rem_minmax(0,1fr)] items-center gap-8" style={{ borderTop: pi ? `1px solid ${TC.ivoryLine}` : undefined, paddingTop: pi ? 22 : 0 }}>
            <div>
              <span className="block text-[1.75rem] font-bold" style={{ fontFamily: SERIF }}>
                {ph.label}
              </span>
              <span className="text-[1.125rem]" style={{ color: TC.inkMuted, ...FIGS }}>
                Overs {ph.from} to {ph.to}
              </span>
            </div>
            <div className="space-y-2.5">
              {shown.map((s, si) => {
                const r = rate(s, ph.from, ph.to);
                return (
                  <div key={s.innings.id} className="flex items-center gap-5">
                    <div className="h-7 flex-1 overflow-hidden rounded-[2px]" style={{ background: "rgba(110,90,50,0.08)" }}>
                      {r && (
                        <div
                          className="tc-a-grow h-full"
                          style={{
                            width: `${(r.rr / maxRr) * 100}%`,
                            background: si === 0 ? `linear-gradient(180deg, ${TC.navyHi}, ${TC.navyLo})` : GOLD_LEAF,
                            ...delay(300 + pi * 120 + si * 60),
                          }}
                        />
                      )}
                    </div>
                    <span className="w-[13rem] shrink-0 text-right">
                      {r ? (
                        <>
                          <Fig className="text-[1.75rem]">{r.rr.toFixed(2)}</Fig>
                          <span className="ml-3 text-[1.125rem]" style={{ color: TC.inkMuted, ...FIGS }}>
                            {r.runs}-{r.wkts}
                          </span>
                        </>
                      ) : (
                        <span style={{ color: TC.inkMuted }}>–</span>
                      )}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </ChartShell>
  );
}

// ---- wagon wheel ---------------------------------------------------------------

const CX = 260;
const CY = 260;
const R_RIM = 250;
const R_ROPE = 196;
const R_IN = 128;
const BATTER_Y = CY - 16;
const DISTANCE: Record<number, number> = { 1: 0.46, 2: 0.62, 3: 0.76, 4: 0.97, 6: 1.04 };

function shotStroke(runs: number): { stroke: string; width: number } {
  if (runs >= 6) return { stroke: "#ffffff", width: 4 };
  if (runs >= 4) return { stroke: "#f0d38a", width: 3.5 };
  return { stroke: "rgba(255,255,255,0.55)", width: 2 };
}

export function WagonWheel(p: P<"wagonWheel">) {
  const { state, match } = p;
  const id = p.batterId ?? state.striker_id ?? null;
  const name = id && id === state.non_striker_id ? state.non_striker_name : state.striker_name;
  const { innings } = useScorecardInnings(match);
  const current = useMemo(
    () => innings.filter((i) => i.innings_number === state.innings_number),
    [innings, state.innings_number],
  );
  const log = useInningsBallLog(state, current, true);
  const balls = useMemo(
    () =>
      id && current[0]
        ? (log?.get(current[0].id) ?? []).filter((b) => b.batsman_id === id)
        : [],
    [log, current, id],
  );
  const shots = useMemo(
    () =>
      balls.flatMap((b, i) => {
        const sector = SECTORS.find((s) => s.id === b.shot_zone);
        if (!sector || (b.runs_scored ?? 0) <= 0) return [];
        const spread = ((i * 17) % 28) - 14;
        const angle = (sector.midAngle + spread + 360) % 360;
        const runs = b.runs_scored ?? 0;
        const end = polarToCartesian(CX, CY, R_ROPE * (DISTANCE[runs] ?? 0.46), angle);
        return [{ key: b.id, runs, end, sector }];
      }),
    [balls],
  );
  if (!log || !shots.length) return null;
  const bySector = new Map<string, number>();
  for (const s of shots) bySector.set(s.sector.id, (bySector.get(s.sector.id) ?? 0) + s.runs);
  const runs = shots.reduce((n, s) => n + s.runs, 0);
  const off = shots.filter((s) => s.sector.side === "off").reduce((n, s) => n + s.runs, 0);
  const leg = runs - off;
  const fours = shots.filter((s) => s.runs === 4).length;
  const sixes = shots.filter((s) => s.runs >= 6).length;
  const faced = id === state.striker_id ? state.striker_balls : id === state.non_striker_id ? state.non_striker_balls : null;
  const total = id === state.striker_id ? state.striker_runs : id === state.non_striker_id ? state.non_striker_runs : null;
  return (
    <TcRoot data-card="wagon-wheel" className="fixed inset-0 z-40">
      <CardShell
        label={`${name ?? "Batter"} wagon wheel`}
        width={1280}
        eyebrow={eyebrowOf(state, "Wagon wheel")}
        title={name ?? ""}
        aside={
          total !== null && total !== undefined ? (
            <span className="flex flex-col items-end gap-2">
              <Fig className="text-[3rem]" style={{ color: TC.ivoryHi }}>
                {total}
              </Fig>
              <span className="text-[1.125rem]" style={{ color: "rgba(243,236,218,0.75)", ...FIGS }}>
                {plural(faced ?? 0, "ball")}
              </span>
            </span>
          ) : undefined
        }
      >
        <div className="grid grid-cols-[34rem_minmax(0,1fr)] items-center gap-12">
          <svg role="img" aria-label={`${name ?? "Batter"}: ${runs} runs from placed shots`} viewBox="0 0 520 520" className="h-[34rem] w-[34rem]">
            <defs>
              <radialGradient id="tc-grass" cx="0.5" cy="0.5" r="0.5">
                <stop offset="0" stopColor="#4f8a4a" />
                <stop offset="1" stopColor="#2d5e33" />
              </radialGradient>
            </defs>
            {SECTORS.map((s, i) => (
              <path
                key={s.id}
                d={describeDonutSegment(CX, CY, R_ROPE + 6, R_RIM, s.angleStart, s.angleEnd)}
                fill={i % 2 ? TC.navy : TC.navyLo}
                stroke={TC.gold}
                strokeWidth="1.5"
              />
            ))}
            <circle cx={CX} cy={CY} r={R_ROPE + 6} fill={TC.ivory} />
            <circle cx={CX} cy={CY} r={R_ROPE} fill="url(#tc-grass)" />
            {/* Mown stripes. */}
            {Array.from({ length: 9 }, (_, i) => (
              <rect key={i} x={CX - R_ROPE + i * 44} y={CY - R_ROPE} width="22" height={R_ROPE * 2} fill="rgba(255,255,255,0.05)" clipPath="url(#tc-field)" />
            ))}
            <clipPath id="tc-field">
              <circle cx={CX} cy={CY} r={R_ROPE} />
            </clipPath>
            <circle cx={CX} cy={CY} r={R_IN} fill="none" stroke="rgba(255,255,255,0.45)" strokeWidth="1.5" strokeDasharray="5 6" />
            <rect x={CX - 9} y={CY - 30} width="18" height="60" rx="2" fill="#d9c79b" />
            {SECTORS.map((s) => {
              const pt = polarToCartesian(CX, CY, (R_ROPE + 6 + R_RIM) / 2, s.midAngle);
              return (
                <text key={`t-${s.id}`} x={pt.x} y={pt.y} textAnchor="middle" dominantBaseline="central" fontSize="22" fontWeight="700" fill={TC.goldText} style={{ fontFamily: SANS, ...FIGS }}>
                  {bySector.get(s.id) ?? 0}
                </text>
              );
            })}
            {shots.map((s, i) => {
              const st = shotStroke(s.runs);
              return (
                <line
                  key={s.key}
                  className="tc-a-draw"
                  pathLength={1}
                  x1={CX}
                  y1={BATTER_Y}
                  x2={s.end.x}
                  y2={s.end.y}
                  stroke={st.stroke}
                  strokeWidth={st.width}
                  strokeLinecap="round"
                  style={{ filter: "drop-shadow(0 1px 1px rgba(0,0,0,0.45))", ...delay(300 + i * 30) }}
                />
              );
            })}
            <circle cx={CX} cy={BATTER_Y} r="5" fill={TC.ink} stroke="#fff" strokeWidth="1.5" />
          </svg>
          <div className="space-y-6">
            <dl className="grid grid-cols-2 gap-x-10 gap-y-6">
              {[
                ["Off side", off],
                ["Leg side", leg],
                ["Fours", fours],
                ["Sixes", sixes],
              ].map(([k, v], i) => (
                <div key={k} className="tc-a-rise" style={delay(350 + i * 70)}>
                  <dt>
                    <Label style={{ color: TC.inkMuted }}>{k}</Label>
                  </dt>
                  <dd className="mt-2">
                    <Fig className="text-[2.75rem]">{v}</Fig>
                  </dd>
                </div>
              ))}
            </dl>
            {total !== null && total !== undefined && faced ? (
              <p className="tc-a-fade text-[1.375rem]" style={{ color: TC.ink, ...FIGS, ...delay(700) }}>
                Strike rate <strong>{strikeRate(total, faced)}</strong>
              </p>
            ) : null}
            <ul className="flex items-center gap-6 border-t pt-5 text-[1.125rem]" style={{ borderColor: TC.ivoryLine, color: TC.inkMuted }}>
              {[
                ["#f0d38a", "Fours"],
                ["#ffffff", "Sixes"],
                ["rgba(255,255,255,0.7)", "Ones to threes"],
              ].map(([c, l]) => (
                <li key={l} className="flex items-center gap-2.5">
                  <span aria-hidden="true" className="h-1.5 w-8 rounded-full" style={{ background: c, boxShadow: "0 0 0 1px rgba(19,32,59,0.35)" }} />
                  {l}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </CardShell>
    </TcRoot>
  );
}
