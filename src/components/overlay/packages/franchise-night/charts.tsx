"use client";

/**
 * Franchise night's charts: runs per over (bars per side with wicket
 * marks), the worm (running totals) and run rates by phase, plus the
 * wagon wheel. The series come from `packages/shared` (the ball log as
 * the Standard cards read it); the drawing is the package's.
 */

import { cn } from "~/lib/utils";
import { withAlpha } from "../../overlay-themes";
import { teamCode } from "../../overlay-kit";
import type { OverlayElementProps } from "../types";
import {
  axisMax,
  chartOvers,
  describeDonutSegment,
  favouriteSector,
  phaseRates,
  polarToCartesian,
  runsPerOver,
  sectorTotals,
  wormSeries,
  wormWickets,
} from "../shared/charts";
import { useBatterShots, useInningsSeries, type InningsSeries } from "../shared/use-chart-data";
import {
  CardFrame,
  Crest,
  DISPLAY,
  FIGURE,
  Stat,
  TEXT,
  chamfer,
  deepGlass,
  delay,
  rowStyle,
} from "./kit";
import { FN, matchTones, type MatchTones, type TeamTone } from "./theme";

export type ChartKind = "manhattan" | "worm" | "run_rate";

const TITLE: Record<ChartKind, string> = {
  manhattan: "Runs per over",
  worm: "Run progression",
  run_rate: "Run rates",
};

interface Drawn extends InningsSeries {
  code: string;
  logo: string | null;
  tone: TeamTone;
  /** The series colour (the two sides told apart). */
  colour: string;
}

function drawn(series: InningsSeries[], state: OverlayElementProps["worm"]["state"], tones: MatchTones): Drawn[] {
  return series.map((s) => ({
    ...s,
    code: teamCode(s.side === 1 ? state.team1_short_name : state.team2_short_name, s.name),
    logo: (s.side === 1 ? state.team1_logo_url : state.team2_logo_url) ?? null,
    tone: s.side === 1 ? tones.team1 : tones.team2,
    colour: s.side === 1 ? tones.team1.light : tones.team2Contrast,
  }));
}

const W = 1300;
const H = 440;
const PAD = { l: 64, r: 16, t: 16, b: 48 };
const IH = H - PAD.t - PAD.b;
const IW = W - PAD.l - PAD.r;

function Axis({ max, step, maxOvers, every = 1, onTicks = false }: { max: number; step: number; maxOvers: number; every?: number; onTicks?: boolean }) {
  const ticks = Array.from({ length: Math.floor(max / step) + 1 }, (_, i) => i * step);
  return (
    <g>
      {ticks.map((t) => {
        const y = PAD.t + IH - (t / max) * IH;
        return (
          <g key={t}>
            <line x1={PAD.l} x2={W - PAD.r} y1={y} y2={y} stroke="rgba(255,255,255,0.12)" strokeWidth={t === 0 ? 2 : 1} />
            <text x={PAD.l - 14} y={y} textAnchor="end" dominantBaseline="central" fill={FN.muted} fontSize="20" fontWeight="600" className={FIGURE}>
              {t}
            </text>
          </g>
        );
      })}
      {Array.from({ length: maxOvers }, (_, i) => i + 1)
        .filter((o) => o === 1 || o % every === 0)
        .map((o) => (
          <text
            key={o}
            x={PAD.l + ((onTicks ? o : o - 0.5) / maxOvers) * IW}
            y={H - PAD.b + 30}
            textAnchor="middle"
            fill={FN.muted}
            fontSize="20"
            fontWeight="600"
            className={FIGURE}
          >
            {o}
          </text>
        ))}
    </g>
  );
}

function Manhattan({ series, maxOvers }: { series: Drawn[]; maxOvers: number }) {
  const bars = series.map((s) => runsPerOver(s.table));
  const max = axisMax(Math.max(6, ...bars.flat().map((b) => b.runs)) + 2, 5);
  const slot = IW / maxOvers;
  const bw = Math.min(26, (slot - 8) / series.length);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img" aria-label={`Runs per over: ${series.map((s) => `${s.name} ${s.innings.total_runs}`).join(", ")}`}>
      <defs>
        {series.map((s, i) => (
          <linearGradient key={i} id={`fn-bar-${i}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={s.colour} />
            <stop offset="100%" stopColor={withAlpha(s.colour, 0.55)} />
          </linearGradient>
        ))}
      </defs>
      <Axis max={max} step={5} maxOvers={maxOvers} />
      {bars.map((list, si) =>
        list.map((o) => {
          const x = PAD.l + (o.over - 1) * slot + (slot - bw * series.length) / 2 + si * bw;
          const h = (o.runs / max) * IH;
          const y = PAD.t + IH - h;
          return (
            <g key={`${si}-${o.over}`}>
              <rect
                x={x + 1}
                y={y}
                width={bw - 2}
                height={Math.max(0, h)}
                fill={`url(#fn-bar-${si})`}
                className="fn-a-grow-y"
                style={delay(200 + o.over * 25 + si * 60)}
              />
              {Array.from({ length: o.wickets }, (_, k) => (
                <circle key={k} cx={x + bw / 2} cy={y - 12 - k * 20} r={8} fill={FN.wicket} stroke={FN.white} strokeWidth={2} />
              ))}
            </g>
          );
        }),
      )}
    </svg>
  );
}

function Worm({ series, maxOvers }: { series: Drawn[]; maxOvers: number }) {
  const lines = series.map((s) => wormSeries(s.table));
  const max = axisMax(Math.max(20, ...lines.flat().map((p) => p.runs)) + 10, 25);
  const x = (over: number) => PAD.l + (over / maxOvers) * IW;
  const y = (runs: number) => PAD.t + IH - (runs / max) * IH;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img" aria-label={`Run progression: ${series.map((s) => `${s.name} ${s.innings.total_runs}`).join(", ")}`}>
      <Axis max={max} step={25} maxOvers={maxOvers} every={maxOvers > 20 ? 5 : 2} onTicks />
      {lines.map((pts, si) => {
        const d = pts.map((p, i) => `${i === 0 ? "M" : "L"}${x(p.over).toFixed(1)},${y(p.runs).toFixed(1)}`).join(" ");
        return (
          <g key={si}>
            <path
              d={d}
              fill="none"
              stroke={series[si]!.colour}
              strokeWidth={6}
              strokeLinejoin="round"
              strokeLinecap="round"
              pathLength={1000}
              className="fn-a-draw"
              style={{ ...delay(200 + si * 250), ["--fn-len" as string]: "1000" }}
            />
            {wormWickets(pts).map((p) => (
              <circle
                key={p.over}
                cx={x(p.over)}
                cy={y(p.runs)}
                r={9}
                fill={FN.white}
                stroke={FN.wicket}
                strokeWidth={4}
                className="fn-a-rise"
                style={delay(900 + si * 250)}
              />
            ))}
          </g>
        );
      })}
    </svg>
  );
}

function PhaseRates({ series, maxOvers }: { series: Drawn[]; maxOvers: number }) {
  const rates = series.map((s) => phaseRates(s.table, maxOvers));
  const phases = rates[0] ?? [];
  const top = Math.max(12, ...rates.flat().map((r) => r.runRate ?? 0));
  return (
    <div className="space-y-5">
      {phases.map((p, pi) => (
        <div key={p.label} className="fn-a-rise grid grid-cols-[17rem_1fr] items-center gap-8 px-4 py-4" style={{ ...rowStyle(pi), ...delay(180 + pi * 100) }}>
          <span>
            <span className={cn(DISPLAY, "block")} style={{ fontSize: "2rem" }}>
              {p.label}
            </span>
            <span className={cn(TEXT, "block font-semibold")} style={{ fontSize: "1.125rem", color: FN.muted }}>
              Overs {p.from} to {p.to}
            </span>
          </span>
          <span className="space-y-2.5">
            {series.map((s, si) => {
              const r = rates[si]![pi]!;
              return (
                <span key={si} className="flex items-center gap-4">
                  <span className={DISPLAY} style={{ fontSize: "1.375rem", width: "4rem", color: FN.muted }}>
                    {s.code}
                  </span>
                  <span className="relative block h-7 flex-1" style={{ background: "rgba(255,255,255,0.06)", clipPath: chamfer(5) }}>
                    {r.runRate !== null && (
                      <span
                        className="fn-a-grow-x absolute inset-y-0 left-0 block"
                        style={{ width: `${(r.runRate / top) * 100}%`, background: `linear-gradient(180deg, ${s.colour}, ${withAlpha(s.colour, 0.6)})`, ...delay(300 + pi * 100 + si * 80) }}
                      />
                    )}
                  </span>
                  <span className={FIGURE} style={{ fontSize: "1.75rem", width: "4.5rem", textAlign: "right" }}>
                    {r.runRate === null ? "-" : r.runRate.toFixed(2)}
                  </span>
                  <span className={FIGURE} style={{ fontSize: "1.125rem", width: "4.5rem", color: FN.muted, fontWeight: 600 }}>
                    {r.overs ? `${r.runs}/${r.wickets}` : ""}
                  </span>
                </span>
              );
            })}
          </span>
        </div>
      ))}
    </div>
  );
}

function Legend({ series }: { series: Drawn[] }) {
  return (
    <div className="mb-4 flex items-center gap-10">
      {series.map((s, i) => (
        <span key={i} className="flex items-center gap-3">
          <span aria-hidden="true" className="block h-3 w-10" style={{ background: s.colour, clipPath: chamfer(3) }} />
          <Crest logo={s.logo} code={s.code} name={s.name} tone={s.tone} size={36} />
          <span className={DISPLAY} style={{ fontSize: "1.5rem" }}>
            {s.name}
          </span>
          <span className={FIGURE} style={{ fontSize: "1.5rem", color: FN.muted }}>
            {s.innings.total_runs}/{s.innings.total_wickets}
          </span>
        </span>
      ))}
    </div>
  );
}

export function ChartElement(p: OverlayElementProps["runsPerOver"] & { kind: ChartKind }) {
  const tones = matchTones(p.state);
  const loaded = useInningsSeries(p.state, p.match);
  if (!loaded || !loaded.some((s) => s.table.length > 0)) return null;
  const shown = drawn(loaded.slice(0, 2), p.state, tones);
  const maxOvers = chartOvers(p.state.overs_per_innings, shown.map((s) => s.table));
  return (
    <CardFrame
      label={TITLE[p.kind]}
      kicker={p.state.tournament_name ? `${p.state.tournament_name} · Match so far` : "Match so far"}
      title={TITLE[p.kind]}
      tone={tones.bat}
      width={1400}
    >
      {p.kind !== "run_rate" && <Legend series={shown} />}
      {p.kind === "manhattan" && <Manhattan series={shown} maxOvers={maxOvers} />}
      {p.kind === "worm" && <Worm series={shown} maxOvers={maxOvers} />}
      {p.kind === "run_rate" && <PhaseRates series={shown} maxOvers={maxOvers} />}
    </CardFrame>
  );
}

// ---- wagon wheel ------------------------------------------------------------------

const CX = 280;
const CY = 280;
const R_OUTER = 266;
const R_GRASS = 196;
const R_IN = 128;
const R_TEXT = (R_OUTER + R_GRASS) / 2;
const BATTER_Y = CY - 18;

function shotColour(runs: number) {
  if (runs >= 6) return FN.six;
  if (runs === 4) return FN.four;
  return "#f4f6fb";
}

export function FranchiseWagonWheel(p: OverlayElementProps["wagonWheel"]) {
  const s = p.state;
  const { name, shots, loaded } = useBatterShots(s, p.match, p.batterId);
  if (!loaded || shots.length === 0) return null;
  const tone = matchTones(s).bat;
  const totals = sectorTotals(shots);
  const best = favouriteSector(totals);
  const runs = shots.reduce((n, x) => n + x.runs, 0);
  const fours = shots.filter((x) => x.runs === 4).length;
  const sixes = shots.filter((x) => x.runs >= 6).length;
  const id = p.batterId ?? s.striker_id ?? null;
  const inns =
    id && id === s.non_striker_id
      ? { r: s.non_striker_runs, b: s.non_striker_balls }
      : id && id === s.striker_id
        ? { r: s.striker_runs, b: s.striker_balls }
        : null;
  return (
    <CardFrame label="Wagon wheel" kicker={s.tournament_name ? `${s.tournament_name} · Wagon wheel` : "Wagon wheel"} title={name ?? "Wagon wheel"} tone={tone} width={1300}>
      <div className="grid grid-cols-[560px_1fr] items-center gap-12">
        <svg viewBox="0 0 560 560" width={560} height={560} role="img" aria-label={`${name ?? "Batter"}: ${runs} runs from placed shots`}>
          <defs>
            <radialGradient id="fn-grass" cx="50%" cy="45%" r="60%">
              <stop offset="0%" stopColor="#2f7d3a" />
              <stop offset="100%" stopColor="#174d22" />
            </radialGradient>
          </defs>
          {totals.map((x, i) => (
            <path
              key={x.id}
              d={describeDonutSegment(CX, CY, R_GRASS, R_OUTER, x.angleStart, x.angleEnd)}
              fill={x.id === best?.id ? withAlpha(FN.gold, 0.32) : i % 2 ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.09)"}
              stroke="rgba(255,255,255,0.18)"
              strokeWidth={2}
            />
          ))}
          {totals.map((x) => {
            const pt = polarToCartesian(CX, CY, R_TEXT, x.midAngle);
            return (
              <text key={`t-${x.id}`} x={pt.x} y={pt.y} textAnchor="middle" dominantBaseline="central" fontSize="26" fontWeight="800" fill={FN.white} className={FIGURE}>
                {x.runs}
              </text>
            );
          })}
          <circle cx={CX} cy={CY} r={R_GRASS} fill="url(#fn-grass)" stroke="rgba(255,255,255,0.5)" strokeWidth={2} />
          <circle cx={CX} cy={CY} r={R_IN} fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth={1.5} strokeDasharray="5 6" />
          <rect x={CX - 9} y={CY - 30} width={18} height={60} rx={3} fill="#c9b48a" />
          {shots.map((x, i) => {
            const end = polarToCartesian(CX, CY, R_GRASS * x.reach, x.angle);
            return (
              <line
                key={x.key}
                x1={CX}
                y1={BATTER_Y}
                x2={end.x}
                y2={end.y}
                stroke={shotColour(x.runs)}
                strokeWidth={x.runs >= 4 ? 4.5 : 3}
                strokeLinecap="round"
                pathLength={1000}
                className="fn-a-draw"
                style={{ ...delay(200 + i * 25), ["--fn-len" as string]: "1000" }}
              />
            );
          })}
          <circle cx={CX} cy={BATTER_Y} r={6} fill={FN.gold} />
        </svg>
        <div className="space-y-6">
          {inns && (
            <div className="fn-a-rise" style={delay(200)}>
              <span className={cn(TEXT, "block font-semibold uppercase")} style={{ fontSize: "1.125rem", letterSpacing: "0.08em", color: FN.gold }}>
                This innings
              </span>
              <span className={cn(FIGURE, "block")} style={{ fontSize: "5rem" }}>
                {inns.r ?? 0}
                <span style={{ fontSize: "2rem", color: FN.muted, fontWeight: 600 }}> ({inns.b ?? 0})</span>
              </span>
            </div>
          )}
          <div className="fn-a-rise flex gap-12" style={delay(280)}>
            <Stat label="Placed runs" value={runs} />
            <Stat label="Fours" value={fours} />
            <Stat label="Sixes" value={sixes} />
          </div>
          {best && (
            <div className="fn-a-rise px-5 py-4" style={{ ...deepGlass(), clipPath: chamfer(10), ...delay(360) }}>
              <span className={cn(TEXT, "block font-semibold uppercase")} style={{ fontSize: "1rem", letterSpacing: "0.08em", color: FN.muted }}>
                Favourite area
              </span>
              <span className={cn(DISPLAY, "mt-1 block")} style={{ fontSize: "2.25rem" }}>
                {best.label} <span className={FIGURE} style={{ color: FN.gold }}>{best.runs}</span>
              </span>
            </div>
          )}
          <div className="flex items-center gap-6">
            {[
              { c: "#f4f6fb", l: "1 to 3" },
              { c: FN.four, l: "Four" },
              { c: FN.six, l: "Six" },
            ].map((k) => (
              <span key={k.l} className="flex items-center gap-2.5">
                <span aria-hidden="true" className="block h-[5px] w-8 rounded-full" style={{ background: k.c }} />
                <span className={cn(TEXT, "font-semibold")} style={{ fontSize: "1.125rem", color: FN.muted }}>
                  {k.l}
                </span>
              </span>
            ))}
          </div>
        </div>
      </div>
    </CardFrame>
  );
}
