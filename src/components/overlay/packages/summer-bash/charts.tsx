"use client";

/**
 * Summer bash charts: runs per over as lit bars in each side's colour,
 * the worm as glowing lines that draw themselves, run rates by phase as
 * meters, and the wagon wheel on a night field. Data as the Standard
 * charts read it: each innings' ball log when the chart shows.
 */

import { useMemo, type CSSProperties } from "react";
import type { Innings, Match } from "~/lib/match-types";
import { cn } from "~/lib/utils";
import { eyebrowOf } from "../../overlay-kit";
import { scoreOf } from "../../scorecard-cards";
import type { LiveMatchState } from "../../types";
import {
  axisMax,
  chartOvers,
  describeDonutSegment,
  phaseRates,
  polarToCartesian,
  SECTORS,
  sectorTotals,
  teamCode,
  useBatterShots,
  useInningsSeries,
  type OverPoint,
} from "../shared";
import type { OverlayElementProps } from "../types";
import { Card, CardPlace, delay, s, sideOfName, sideStyle, Tag, type SideKey } from "./kit";

interface Series {
  innings: Innings;
  name: string;
  code: string;
  side: SideKey;
  table: OverPoint[];
}

/** The shared ball-log series with this package's side keys and codes. */
function useSeries(state: LiveMatchState, match: Match | null | undefined): Series[] | null {
  const series = useInningsSeries(state, match);
  return useMemo(
    () =>
      series?.map((sr) => {
        const side: SideKey = sr.side === 2 ? "t2" : "t1";
        const short = side === "t2" ? state.team2_short_name : state.team1_short_name;
        return { innings: sr.innings, name: sr.name, code: teamCode(short, sr.name), side, table: sr.table };
      }) ?? null,
    [series, state],
  );
}

/** A legend: each side's code and score in its colour. */
function Legend({ series }: { series: Series[] }) {
  return (
    <div className="mb-4 flex items-center gap-8">
      {series.map((sr, i) => (
        <span key={sr.innings.id} className={cn(s.rise, "flex items-center gap-3")} style={{ ...sideStyle(sr.side), ...delay(200 + i * 80) }}>
          <span className="h-4 w-10 -skew-x-[20deg] rounded-[2px]" style={{ background: "var(--glow)", boxShadow: "0 0 12px var(--glow)" }} />
          <span className={cn(s.display, "text-[1.5rem] uppercase")}>{sr.code}</span>
          <span className={cn(s.figures, "text-[1.5rem]")} style={{ fontWeight: 800 }}>
            {scoreOf(sr.innings)}
          </span>
        </span>
      ))}
    </div>
  );
}

const W = 1420;
const H = 430;
const PAD = { l: 64, r: 16, t: 20, b: 46 };

const niceMax = axisMax;

/** Axes: gridlines with run labels and the over numbers. */
function Axes({ maxY, step, overs }: { maxY: number; step: number; overs: number }) {
  const ih = H - PAD.t - PAD.b;
  const iw = W - PAD.l - PAD.r;
  const lines = Array.from({ length: Math.floor(maxY / step) + 1 }, (_, i) => i * step);
  const every = overs > 20 ? 5 : overs > 10 ? 2 : 1;
  return (
    <g>
      {lines.map((v) => {
        const y = PAD.t + ih - (v / maxY) * ih;
        return (
          <g key={v}>
            <line x1={PAD.l} x2={W - PAD.r} y1={y} y2={y} stroke="rgba(217,208,255,0.16)" strokeWidth={v === 0 ? 2 : 1} />
            <text x={PAD.l - 14} y={y} textAnchor="end" dominantBaseline="central" fontSize={20} fontWeight={700} fill="#d9d0ff" className={s.figures}>
              {v}
            </text>
          </g>
        );
      })}
      {Array.from({ length: overs }, (_, i) => i + 1)
        .filter((o) => o === 1 || o % every === 0)
        .map((o) => (
          <text key={o} x={PAD.l + ((o - 0.5) / overs) * iw} y={H - 14} textAnchor="middle" fontSize={20} fontWeight={700} fill="#d9d0ff" className={s.figures}>
            {o}
          </text>
        ))}
    </g>
  );
}

function maxOversOf(state: LiveMatchState, series: Series[]): number {
  return chartOvers(state.overs_per_innings, series.map((sr) => sr.table));
}

function RunsPerOver(p: OverlayElementProps["runsPerOver"]) {
  const series = useSeries(p.state, p.match);
  if (!series || !series.some((sr) => sr.table.length > 0)) return null;
  const shown = series.slice(0, 2);
  const overs = maxOversOf(p.state, shown);
  const maxY = niceMax(Math.max(...shown.flatMap((sr) => sr.table.map((o) => o.runs)), 6), 5);
  const ih = H - PAD.t - PAD.b;
  const slot = (W - PAD.l - PAD.r) / overs;
  const bw = Math.min(26, (slot - 10) / shown.length);
  return (
    <CardPlace state={p.state}>
      <Card neon="cyan" width={1520} eyebrow={eyebrowOf(p.state, "Match so far")} title="Runs per over">
        <Legend series={shown} />
        <svg role="img" aria-label={`Runs per over: ${shown.map((sr) => `${sr.name} ${scoreOf(sr.innings)}`).join(", ")}`} viewBox={`0 0 ${W} ${H}`} width={W} height={H} className="block max-w-full">
          <Axes maxY={maxY} step={5} overs={overs} />
          {shown.map((sr, si) =>
            sr.table.map((o) => {
              const h = (o.runs / maxY) * ih;
              const x = PAD.l + (o.overNumber - 1) * slot + (slot - bw * shown.length) / 2 + si * bw;
              const y = PAD.t + ih - h;
              return (
                <g key={`${sr.innings.id}-${o.overNumber}`} style={sideStyle(sr.side)}>
                  <rect
                    x={x + 1}
                    y={y}
                    width={bw - 2}
                    height={Math.max(2, h)}
                    rx={3}
                    fill="var(--glow)"
                    className={s.growY}
                    style={{ filter: "drop-shadow(0 0 6px var(--haze))", transformBox: "fill-box", ...delay(200 + o.overNumber * 30 + si * 15) } as CSSProperties}
                  />
                  {Array.from({ length: o.wickets }, (_, k) => (
                    <circle key={k} cx={x + bw / 2} cy={y - 12 - k * 18} r={7} fill="var(--sb-red)" stroke="#0b0620" strokeWidth={2.5} className={s.pop} style={{ transformBox: "fill-box", transformOrigin: "center", ...delay(700 + o.overNumber * 30) } as CSSProperties} />
                  ))}
                </g>
              );
            }),
          )}
        </svg>
        <p className={cn(s.label, "mt-2 flex items-center gap-2 text-[1rem] text-[color:var(--sb-mist)]")}>
          <span className="inline-block h-3.5 w-3.5 rounded-full border-2 border-[color:var(--sb-ink)] bg-[color:var(--sb-red)]" /> Wicket
        </p>
      </Card>
    </CardPlace>
  );
}

function Worm(p: OverlayElementProps["worm"]) {
  const series = useSeries(p.state, p.match);
  if (!series || !series.some((sr) => sr.table.length > 0)) return null;
  const shown = series.slice(0, 2);
  const overs = maxOversOf(p.state, shown);
  const top = Math.max(...shown.flatMap((sr) => sr.table.map((o) => o.cumulativeRuns)), 20);
  const maxY = niceMax(top, top > 150 ? 50 : 25);
  const ih = H - PAD.t - PAD.b;
  const iw = W - PAD.l - PAD.r;
  const xy = (over: number, runs: number) => ({
    x: PAD.l + (over / overs) * iw,
    y: PAD.t + ih - (runs / maxY) * ih,
  });
  return (
    <CardPlace state={p.state}>
      <Card neon="magenta" width={1520} eyebrow={eyebrowOf(p.state, "Match so far")} title="Run progression">
        <Legend series={shown} />
        <svg role="img" aria-label={`Run progression: ${shown.map((sr) => `${sr.name} ${scoreOf(sr.innings)}`).join(", ")}`} viewBox={`0 0 ${W} ${H}`} width={W} height={H} className="block max-w-full">
          <Axes maxY={maxY} step={top > 150 ? 50 : 25} overs={overs} />
          {shown.map((sr, si) => {
            const pts = [{ x: PAD.l, y: PAD.t + ih }, ...sr.table.map((o) => xy(o.overNumber, o.cumulativeRuns))];
            const d = pts.map((pt, i) => `${i ? "L" : "M"}${pt.x.toFixed(1)},${pt.y.toFixed(1)}`).join(" ");
            return (
              <g key={sr.innings.id} style={sideStyle(sr.side)}>
                <path d={d} pathLength={1} fill="none" stroke="var(--glow)" strokeWidth={6} strokeLinejoin="round" strokeLinecap="round" className={s.draw} style={{ "--len": 1, filter: "drop-shadow(0 0 8px var(--glow))", ...delay(200 + si * 250) } as CSSProperties} />
                {sr.table
                  .filter((o) => o.wickets > 0)
                  .map((o) => {
                    const pt = xy(o.overNumber, o.cumulativeRuns);
                    return (
                      <g key={o.overNumber}>
                        <circle cx={pt.x} cy={pt.y} r={10} fill="var(--sb-red)" stroke="#0b0620" strokeWidth={3} className={s.pop} style={{ transformBox: "fill-box", transformOrigin: "center", ...delay(900 + si * 250 + o.overNumber * 25) } as CSSProperties} />
                        {o.wickets > 1 && (
                          <text x={pt.x} y={pt.y} textAnchor="middle" dominantBaseline="central" fontSize={13} fontWeight={800} fill="#0b0620">
                            {o.wickets}
                          </text>
                        )}
                      </g>
                    );
                  })}
              </g>
            );
          })}
        </svg>
      </Card>
    </CardPlace>
  );
}

function RunRates(p: OverlayElementProps["runRates"]) {
  const series = useSeries(p.state, p.match);
  if (!series || !series.some((sr) => sr.table.length > 0)) return null;
  const shown = series.slice(0, 2);
  const overs = maxOversOf(p.state, shown);
  // Each side's phases, from the shared phase maths.
  const bySide = new Map(shown.map((sr) => [sr.innings.id, phaseRates(sr.table, overs)]));
  const phases = phaseRates([], overs);
  const rate = (sr: Series, index: number) => {
    const ph = bySide.get(sr.innings.id)?.[index];
    return ph && ph.runRate !== null
      ? { rr: ph.runRate, runs: ph.runs, wkts: ph.wickets }
      : null;
  };
  const all = phases.flatMap((_, i) => shown.map((sr) => rate(sr, i)?.rr ?? 0));
  const top = Math.max(12, ...all);
  return (
    <CardPlace state={p.state}>
      <Card neon="lime" width={1400} eyebrow={eyebrowOf(p.state, "Match so far")} title="Run rates">
        <Legend series={shown} />
        <div className="space-y-5">
          {phases.map((ph, pi) => (
            <div key={ph.label} className={cn(s.rise, "grid grid-cols-[16rem_minmax(0,1fr)] items-center gap-6")} style={delay(260 + pi * 140)}>
              <span>
                <span className={cn(s.display, "block text-[1.625rem] uppercase")}>{ph.label}</span>
                <span className={cn(s.label, "text-[1rem] text-[color:var(--sb-mist)]")}>
                  Overs {ph.from} to {ph.to}
                </span>
              </span>
              <div className="space-y-2">
                {shown.map((sr) => {
                  const r = rate(sr, pi);
                  return (
                    <div key={sr.innings.id} className="flex items-center gap-4" style={sideStyle(sr.side)}>
                      <span className={cn(s.display, "w-20 text-[1.25rem]")}>{sr.code}</span>
                      <div className="relative h-9 flex-1 overflow-hidden rounded-[3px] bg-white/[0.06]">
                        {r && (
                          <span
                            className={cn(s.growX, "absolute inset-y-0 left-0 -skew-x-[16deg] rounded-[2px]")}
                            style={{ width: `${(r.rr / top) * 100}%`, background: "linear-gradient(90deg, var(--plate), var(--glow))", boxShadow: "0 0 14px var(--haze)", ...delay(380 + pi * 140) }}
                          />
                        )}
                      </div>
                      <span className="w-48 text-right">
                        {r ? (
                          <>
                            <span className={cn(s.figures, "text-[1.75rem]")} style={{ fontWeight: 800 }}>
                              {r.rr.toFixed(2)}
                            </span>
                            <span className={cn(s.figures, "ml-3 text-[1.125rem] text-[color:var(--sb-mist)]")} style={{ fontWeight: 500 }}>
                              {r.runs}/{r.wkts}
                            </span>
                          </>
                        ) : (
                          <span className="text-[color:var(--sb-mist)]">–</span>
                        )}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </Card>
    </CardPlace>
  );
}

// ---- wagon wheel ---------------------------------------------------------------------

const CX = 250;
const CY = 250;
const R_OUTER = 236;
const R_GRASS = 172;
const R_30YD = 116;
const R_TEXT = (R_OUTER + R_GRASS) / 2;
const BATTER_Y = CY - 16;

function shotColour(runs: number): string {
  if (runs >= 6) return "var(--sb-magenta)";
  if (runs === 4) return "var(--sb-cyan)";
  if (runs >= 2) return "var(--sb-lime)";
  return "#ffffff";
}

function WagonWheel(p: OverlayElementProps["wagonWheel"]) {
  const { state, match, batterId } = p;
  const { name, shots: placed, loaded } = useBatterShots(state, match, batterId);
  const shots = useMemo(
    () =>
      placed.map((sh) => ({
        ...sh,
        end: polarToCartesian(CX, CY, R_GRASS * sh.reach, sh.angle),
      })),
    [placed],
  );
  if (!loaded || shots.length === 0) return null;
  const bySector = new Map(sectorTotals(placed).map((t) => [t.id, t.runs]));
  const runs = shots.reduce((n, sh) => n + sh.runs, 0);
  const fours = shots.filter((sh) => sh.runs === 4).length;
  const sixes = shots.filter((sh) => sh.runs === 6).length;
  const side = sideOfName(state, state.batting_team_name) ?? "t1";
  return (
    <CardPlace state={state}>
      <Card side={side} width={1240} eyebrow={eyebrowOf(state, "Wagon wheel")} title={name ?? ""}>
        <div className="flex items-center gap-10">
          <svg role="img" aria-label={`${name ?? "Batter"}: ${runs} runs from placed shots`} viewBox="0 0 500 500" className={cn(s.pop, "h-[34rem] w-[34rem] shrink-0")} style={delay(120)}>
            <defs>
              <radialGradient id="sb-field" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#1e5a3a" />
                <stop offset="100%" stopColor="#0f3324" />
              </radialGradient>
            </defs>
            {SECTORS.map((sc) => (
              <path key={sc.id} d={describeDonutSegment(CX, CY, R_GRASS, R_OUTER, sc.angleStart, sc.angleEnd)} fill={sc.side === "off" ? "#241257" : "#1b0d47"} stroke="#0b0620" strokeWidth={3} />
            ))}
            <circle cx={CX} cy={CY} r={R_OUTER} fill="none" stroke="var(--glow)" strokeWidth={3} style={{ filter: "drop-shadow(0 0 8px var(--glow))" }} />
            {SECTORS.map((sc) => {
              const pt = polarToCartesian(CX, CY, R_TEXT, sc.midAngle);
              const v = bySector.get(sc.id) ?? 0;
              return (
                <text key={`t-${sc.id}`} x={pt.x} y={pt.y} fontSize={24} fontWeight={800} textAnchor="middle" dominantBaseline="central" fill={v ? "#ffffff" : "#8f84c7"} className={s.figures}>
                  {v}
                </text>
              );
            })}
            <circle cx={CX} cy={CY} r={R_GRASS} fill="url(#sb-field)" />
            <circle cx={CX} cy={CY} r={R_30YD} fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth={1.5} strokeDasharray="5 6" />
            <rect x={CX - 8} y={CY - 26} width={16} height={52} rx={2.5} fill="#c9b48a" opacity={0.85} />
            {shots.map((sh, i) => (
              <line
                key={sh.key}
                x1={CX}
                y1={BATTER_Y}
                x2={sh.end.x}
                y2={sh.end.y}
                pathLength={1}
                stroke={shotColour(sh.runs)}
                strokeWidth={sh.runs >= 4 ? 4.5 : 2.5}
                strokeLinecap="round"
                className={s.draw}
                style={{ "--len": 1, filter: sh.runs >= 4 ? `drop-shadow(0 0 5px ${shotColour(sh.runs)})` : undefined, ...delay(300 + i * 40) } as CSSProperties}
              />
            ))}
            <circle cx={CX} cy={BATTER_Y} r={5} fill="#fff" />
          </svg>
          <div className="min-w-0 flex-1 space-y-4">
            <div className={cn(s.rise, "flex items-baseline gap-3")} style={delay(300)}>
              <span className={cn(s.figures, "text-[4.5rem] leading-none")} style={{ fontWeight: 800 }}>
                {runs}
              </span>
              <span className={cn(s.label, "text-[1.125rem] text-[color:var(--sb-mist)]")}>runs from placed shots</span>
            </div>
            <div className="flex flex-wrap gap-3">
              <Tag neon="cyan" className={s.rise} style={delay(380)}>
                {fours} {fours === 1 ? "four" : "fours"}
              </Tag>
              <Tag neon="magenta" className={s.rise} style={delay(440)}>
                {sixes} {sixes === 1 ? "six" : "sixes"}
              </Tag>
            </div>
            <ul className={cn(s.rise, "space-y-2 pt-2")} style={delay(520)}>
              {[
                { c: "var(--sb-magenta)", l: "Six" },
                { c: "var(--sb-cyan)", l: "Four" },
                { c: "var(--sb-lime)", l: "Two or three" },
                { c: "#ffffff", l: "Single" },
              ].map((k) => (
                <li key={k.l} className={cn(s.semi, "flex items-center gap-3 text-[1.25rem] font-bold")}>
                  <span className="h-1.5 w-10 rounded-full" style={{ background: k.c, boxShadow: `0 0 8px ${k.c}` }} />
                  {k.l}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Card>
    </CardPlace>
  );
}

export { RunRates, RunsPerOver, WagonWheel, Worm };
