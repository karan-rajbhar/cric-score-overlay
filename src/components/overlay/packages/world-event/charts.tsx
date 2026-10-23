"use client";

/**
 * World event's data graphics: runs per over (Manhattan), the worm, run
 * rates by phase, the wagon wheel, the win predictor and the projected
 * score. Charts read the same ball log Standard's do (`useInningsBallLog`:
 * an innings' over documents when a chart shows), drawn in each side's
 * colour; the predictor and projections come from the live row alone.
 */

import { useMemo, type ReactNode } from "react";
import { phaseBoundaries } from "~/lib/match-report";
import { buildOverTable, type OverPoint } from "~/lib/match-charts";
import type { Innings, Match } from "~/lib/match-types";
import { cn } from "~/lib/utils";
import { describeDonutSegment, polarToCartesian, SECTORS } from "~/lib/wagon-wheel-utils";
import { winPredictorFromLive } from "~/lib/win-predictor";
import { useInningsBallLog, useScorecardInnings } from "../../overlay-data";
import { oversText } from "../../overlay-kit";
import type { LiveMatchState } from "../../types";
import type { OverlayElementProps } from "../types";
import { battingAndBowling, fixed2, projectionsOf, scoreText, sideOfInnings, teamsOf, type SideInfo } from "./data";
import { SplitBar } from "./lower-thirds";
import { CardFrame, Crest, delay, Fig, side } from "./kit";

interface Series {
  innings: Innings;
  team: SideInfo;
  table: OverPoint[];
}

function useSeries(state: LiveMatchState, match: Match | null | undefined): Series[] | null {
  const { innings } = useScorecardInnings(match);
  const main = useMemo(() => innings.filter((i) => i.innings_number <= 2), [innings]);
  const log = useInningsBallLog(state, main, true);
  return useMemo(() => {
    if (!log) return null;
    const teams = teamsOf(state);
    return main.map((inn) => ({
      innings: inn,
      team: teams[sideOfInnings(state, inn, match) - 1]!,
      table: buildOverTable(log.get(inn.id) ?? []),
    }));
  }, [main, log, match, state]);
}

/** A rounded-up axis maximum and its grid step. */
export function axisOf(max: number, steps = 5): { top: number; step: number } {
  const raw = Math.max(1, max) / steps;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? raw;
  return { top: Math.ceil(Math.max(1, max) / step) * step, step };
}

function Legend({ series }: { series: Series[] }) {
  return (
    <span className="flex items-center gap-8">
      {series.map((s) => (
        <span key={s.innings.id} className="flex items-center gap-3" style={side(s.team.n)}>
          <span className="h-[18px] w-[34px]" style={{ background: "var(--we-side-dark)" }} />
          <span className="we-x text-[22px]">{s.team.code}</span>
          <span className="we-fig text-[26px]">{scoreText(s.innings.total_runs, s.innings.total_wickets)}</span>
        </span>
      ))}
    </span>
  );
}

const W = 1560;
const H = 470;
const PAD = { l: 64, r: 24, t: 20, b: 52 };

function Grid({ top, step, label }: { top: number; step: number; label: string }) {
  const lines: number[] = [];
  for (let v = 0; v <= top + 1e-9; v += step) lines.push(v);
  const y = (v: number) => PAD.t + (H - PAD.t - PAD.b) * (1 - v / top);
  return (
    <g>
      {lines.map((v) => (
        <g key={v}>
          <line x1={PAD.l} x2={W - PAD.r} y1={y(v)} y2={y(v)} stroke="rgba(255,255,255,0.12)" strokeWidth={v === 0 ? 2 : 1} />
          <text x={PAD.l - 12} y={y(v)} textAnchor="end" dominantBaseline="central" fill="rgba(255,255,255,0.75)" fontSize="20" fontWeight="700">
            {Math.round(v)}
          </text>
        </g>
      ))}
      <text x={PAD.l} y={H - 8} fill="rgba(255,255,255,0.75)" fontSize="18" fontWeight="800" letterSpacing="1.5">
        {label}
      </text>
    </g>
  );
}

function ChartCard({ state, title, series, children }: { state: LiveMatchState; title: string; series: Series[]; children: ReactNode }) {
  return (
    <CardFrame
      state={state}
      testId={`we-chart-${title.toLowerCase().replace(/\s+/g, "-")}`}
      eyebrow={state.tournament_name ? `Match so far  ·  ${state.tournament_name}` : "Match so far"}
      title={title}
      aside={<Legend series={series} />}
      width={1640}
      bodyClassName="we-night px-6 py-5"
    >
      {children}
    </CardFrame>
  );
}

export function WorldEventRunsPerOver(p: OverlayElementProps["runsPerOver"]) {
  const series = useSeries(p.state, p.match)?.slice(0, 2);
  if (!series || !series.some((s) => s.table.length)) return null;
  const overs = Math.max(p.state.overs_per_innings ?? 20, ...series.map((s) => s.table.length), 1);
  const { top, step } = axisOf(Math.max(...series.flatMap((s) => s.table.map((o) => o.runs)), 6));
  const slot = (W - PAD.l - PAD.r) / overs;
  const barW = Math.max(6, (slot * 0.78) / series.length);
  const y = (v: number) => PAD.t + (H - PAD.t - PAD.b) * (1 - v / top);
  return (
    <ChartCard state={p.state} title="Runs per over" series={series}>
      <svg role="img" aria-label="Runs per over" viewBox={`0 0 ${W} ${H}`} className="block w-full">
        <Grid top={top} step={step} label="OVERS" />
        {Array.from({ length: overs }, (_, i) => (
          <text key={i} x={PAD.l + slot * (i + 0.5)} y={H - PAD.b + 24} textAnchor="middle" fill="rgba(255,255,255,0.75)" fontSize="18" fontWeight="700">
            {(i + 1) % (overs > 30 ? 5 : 1) === 0 || overs <= 30 ? i + 1 : ""}
          </text>
        ))}
        {series.map((s, si) =>
          s.table.map((o) => {
            const x = PAD.l + slot * (o.overNumber - 1) + slot * 0.11 + si * barW;
            return (
              <g key={`${s.innings.id}-${o.overNumber}`} style={side(s.team.n)}>
                <rect
                  className="we-a-grow-y"
                  x={x}
                  y={y(o.runs)}
                  width={barW - 2}
                  height={Math.max(0, y(0) - y(o.runs))}
                  style={{ fill: "var(--we-side-dark)", transformBox: "fill-box", ...delay(300 + o.overNumber * 25 + si * 120) }}
                />
                {Array.from({ length: o.wickets }, (_, k) => (
                  <circle key={k} cx={x + (barW - 2) / 2} cy={y(o.runs) - 12 - k * 20} r={8} fill="#ff3b55" stroke="#fff" strokeWidth={2.5} />
                ))}
              </g>
            );
          }),
        )}
      </svg>
    </ChartCard>
  );
}

export function WorldEventWorm(p: OverlayElementProps["worm"]) {
  const series = useSeries(p.state, p.match)?.slice(0, 2);
  if (!series || !series.some((s) => s.table.length)) return null;
  const overs = Math.max(p.state.overs_per_innings ?? 20, ...series.map((s) => s.table.length), 1);
  const max = Math.max(...series.map((s) => s.table.at(-1)?.cumulativeRuns ?? 0), p.state.target_runs ?? 0, 10);
  const { top, step } = axisOf(max);
  const x = (over: number) => PAD.l + ((W - PAD.l - PAD.r) * over) / overs;
  const y = (v: number) => PAD.t + (H - PAD.t - PAD.b) * (1 - v / top);
  return (
    <ChartCard state={p.state} title="Run progression" series={series}>
      <svg role="img" aria-label="Run progression by over" viewBox={`0 0 ${W} ${H}`} className="block w-full">
        <Grid top={top} step={step} label="OVERS" />
        {Array.from({ length: Math.floor(overs / 5) + 1 }, (_, i) => (
          <text key={i} x={x(i * 5)} y={H - PAD.b + 24} textAnchor="middle" fill="rgba(255,255,255,0.75)" fontSize="18" fontWeight="700">
            {i * 5}
          </text>
        ))}
        {p.state.target_runs && (
          <g>
            <line x1={PAD.l} x2={W - PAD.r} y1={y(p.state.target_runs)} y2={y(p.state.target_runs)} stroke="#dc0078" strokeWidth={2} strokeDasharray="10 8" />
            <text x={W - PAD.r} y={y(p.state.target_runs) - 10} textAnchor="end" fill="#ff6fb4" fontSize="18" fontWeight="800" letterSpacing="1.5">
              TARGET {p.state.target_runs}
            </text>
          </g>
        )}
        {series.map((s, si) => {
          const pts = [{ over: 0, runs: 0 }, ...s.table.map((o) => ({ over: o.overNumber, runs: o.cumulativeRuns }))];
          const d = pts.map((q, i) => `${i ? "L" : "M"}${x(q.over).toFixed(1)},${y(q.runs).toFixed(1)}`).join(" ");
          return (
            <g key={s.innings.id} style={side(s.team.n)}>
              <path
                d={d}
                pathLength={1}
                fill="none"
                strokeWidth={6}
                strokeLinejoin="round"
                strokeLinecap="round"
                className="we-a-draw"
                style={{ stroke: "var(--we-side-dark)", strokeDasharray: 1, ["--we-len" as string]: 1, ...delay(300 + si * 300) }}
              />
              {s.table
                .filter((o) => o.wickets > 0)
                .map((o) => (
                  <circle key={o.overNumber} cx={x(o.overNumber)} cy={y(o.cumulativeRuns)} r={9} fill="#ff3b55" stroke="#fff" strokeWidth={2.5} className="we-a-fade" style={delay(1300 + si * 300)} />
                ))}
            </g>
          );
        })}
      </svg>
    </ChartCard>
  );
}

export function WorldEventRunRates(p: OverlayElementProps["runRates"]) {
  const series = useSeries(p.state, p.match)?.slice(0, 2);
  if (!series || !series.some((s) => s.table.length)) return null;
  const maxOvers = Math.max(p.state.overs_per_innings ?? 20, ...series.map((s) => s.table.length), 1);
  const b = phaseBoundaries(maxOvers);
  const phases = b
    ? [
        { label: "Powerplay", from: 1, to: b.ppEnd },
        { label: "Middle overs", from: b.ppEnd + 1, to: b.midEnd },
        { label: "Death overs", from: b.midEnd + 1, to: maxOvers },
      ]
    : [{ label: "Innings", from: 1, to: maxOvers }];
  const rate = (s: Series, from: number, to: number) => {
    const overs = s.table.filter((o) => o.overNumber >= from && o.overNumber <= to);
    if (!overs.length) return null;
    const runs = overs.reduce((n, o) => n + o.runs, 0);
    return { rr: runs / overs.length, runs, wkts: overs.reduce((n, o) => n + o.wickets, 0) };
  };
  const all = phases.flatMap((ph) => series.map((s) => rate(s, ph.from, ph.to)?.rr ?? 0));
  const max = Math.max(...all, 1);
  return (
    <ChartCard state={p.state} title="Run rates" series={series}>
      <div className="flex flex-col gap-5 py-2">
        {phases.map((ph, pi) => (
          <div key={ph.label} className="grid grid-cols-[280px_1fr] items-center gap-6">
            <span className="flex flex-col">
              <span className="we-x text-[26px]">{ph.label}</span>
              <span className="we-label we-muted">
                Overs {ph.from} to {ph.to}
              </span>
            </span>
            <div className="flex flex-col gap-2">
              {series.map((s, si) => {
                const r = rate(s, ph.from, ph.to);
                return (
                  <div key={s.innings.id} className="flex items-center gap-4" style={side(s.team.n)}>
                    <span className="we-x w-[70px] text-[20px]">{s.team.code}</span>
                    <span className="relative h-[30px] flex-1 bg-white/10">
                      {r && (
                        <span
                          className="we-a-grow-x absolute inset-y-0 left-0"
                          style={{ width: `${(r.rr / max) * 100}%`, background: "var(--we-side-dark)", ...delay(320 + pi * 140 + si * 70) }}
                        />
                      )}
                    </span>
                    <span className="we-fig w-[90px] text-right text-[30px]">{r ? r.rr.toFixed(2) : "–"}</span>
                    <span className="we-figl we-muted w-[90px] text-[20px]">{r ? `${r.runs}-${r.wkts}` : ""}</span>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </ChartCard>
  );
}

// ---- wagon wheel ------------------------------------------------------------

const CX = 260;
const CY = 260;
const R_OUT = 248;
const R_FIELD = 186;
const R_IN = 120;
const DIST: Record<number, number> = { 1: 0.46, 2: 0.62, 3: 0.76, 4: 0.94, 6: 1.0 };
const SHOT = (runs: number) => (runs === 6 ? "#ff3d9a" : runs === 4 ? "#19e0b4" : "#ffffff");

export function WorldEventWagonWheel(p: OverlayElementProps["wagonWheel"]) {
  const s = p.state;
  const id = p.batterId ?? s.striker_id ?? null;
  const nonStriker = !!id && id === s.non_striker_id;
  const name = nonStriker ? s.non_striker_name : s.striker_name;
  const { innings } = useScorecardInnings(p.match);
  const current = useMemo(() => innings.filter((i) => i.innings_number === s.innings_number), [innings, s.innings_number]);
  const log = useInningsBallLog(s, current, true);
  const shots = useMemo(() => {
    const balls = id && current[0] ? (log?.get(current[0].id) ?? []).filter((b) => b.batsman_id === id) : [];
    return balls.flatMap((b, i) => {
      const sector = SECTORS.find((x) => x.id === b.shot_zone);
      const runs = b.runs_scored ?? 0;
      if (!sector || runs <= 0) return [];
      const angle = (sector.midAngle + (((i * 17) % 28) - 14) + 360) % 360;
      const end = polarToCartesian(CX, CY, R_FIELD * (DIST[runs] ?? 0.46), angle);
      return [{ key: b.id, runs, end, sector: sector.id }];
    });
  }, [log, current, id]);
  if (!log || !shots.length || !name) return null;
  const { bat } = battingAndBowling(s);
  const bySector = new Map<string, number>();
  for (const x of shots) bySector.set(x.sector, (bySector.get(x.sector) ?? 0) + x.runs);
  const runs = nonStriker ? s.non_striker_runs : s.striker_runs;
  const balls = nonStriker ? s.non_striker_balls : s.striker_balls;
  const count = (n: number) => shots.filter((x) => x.runs === n).length;
  return (
    <CardFrame
      state={s}
      testId="we-wagon"
      eyebrow={s.tournament_name ? `Wagon wheel  ·  ${s.tournament_name}` : "Wagon wheel"}
      crest={<Crest n={bat.n} logo={bat.logo} code={bat.code} name={bat.name} size={76} className="we-a-pop" style={delay(200)} />}
      title={<span className="we-trunc block">{name}</span>}
      aside={
        <span className="flex items-baseline gap-2">
          <span className="we-fig text-[52px] leading-none">{runs ?? 0}</span>
          <span className="we-figl we-muted text-[24px]">({balls ?? 0})</span>
        </span>
      }
      width={1240}
      bodyClassName="we-night flex items-center gap-12 px-12 py-6"
    >
      <svg role="img" aria-label={`${name}: scoring shots by area`} viewBox="0 0 520 520" className="h-[520px] w-[520px] shrink-0">
        <defs>
          <radialGradient id="we-field" cx="50%" cy="45%" r="60%">
            <stop offset="0%" stopColor="#3a26a8" />
            <stop offset="100%" stopColor="#170b5c" />
          </radialGradient>
        </defs>
        {SECTORS.map((x) => (
          <path key={x.id} d={describeDonutSegment(CX, CY, R_FIELD, R_OUT, x.angleStart, x.angleEnd)} fill="#22137a" stroke="#0a0532" strokeWidth={3} />
        ))}
        {SECTORS.map((x) => {
          const pt = polarToCartesian(CX, CY, (R_OUT + R_FIELD) / 2, x.midAngle);
          return (
            <text key={`t-${x.id}`} x={pt.x} y={pt.y} textAnchor="middle" dominantBaseline="central" fill="#fff" fontSize="26" fontWeight="850">
              {bySector.get(x.id) ?? 0}
            </text>
          );
        })}
        <circle cx={CX} cy={CY} r={R_FIELD} fill="url(#we-field)" />
        <circle cx={CX} cy={CY} r={R_IN} fill="none" stroke="rgba(255,255,255,0.28)" strokeWidth={2} strokeDasharray="6 7" />
        <rect x={CX - 9} y={CY - 30} width={18} height={60} rx={3} fill="#c9b48a" opacity={0.85} />
        {shots.map((x, i) => (
          <line
            key={x.key}
            x1={CX}
            y1={CY - 18}
            x2={x.end.x}
            y2={x.end.y}
            stroke={SHOT(x.runs)}
            strokeWidth={x.runs >= 4 ? 4.5 : 3}
            strokeLinecap="round"
            pathLength={1}
            className="we-a-draw"
            style={{ strokeDasharray: 1, ["--we-len" as string]: 1, animationDuration: "520ms", ...delay(300 + i * 45) }}
          />
        ))}
        <circle cx={CX} cy={CY - 18} r={6} fill="#ffc629" />
      </svg>
      <dl className="flex flex-1 flex-col gap-4">
        {[
          { label: "Runs in these shots", value: shots.reduce((n, x) => n + x.runs, 0), tone: "#fff" },
          { label: "Fours", value: count(4), tone: "#19e0b4" },
          { label: "Sixes", value: count(6), tone: "#ff3d9a" },
          { label: "Ones, twos and threes", value: count(1) + count(2) + count(3), tone: "#ffffff" },
        ].map((r, i) => (
          <div key={r.label} className="we-a-rise flex items-center gap-4 border-b pb-3 we-hair" style={delay(500 + i * 70)}>
            <span className="h-[8px] w-[34px]" style={{ background: r.tone }} />
            <dt className="we-label we-muted flex-1">{r.label}</dt>
            <dd className="we-fig text-[40px] leading-none">{r.value}</dd>
          </div>
        ))}
      </dl>
    </CardFrame>
  );
}

// ---- win predictor and projected score ------------------------------------------

function PredictorSide({ team, pct, at }: { team: SideInfo; pct: number; at: "left" | "right" }) {
  return (
    <div className={cn("flex items-center gap-6", at === "right" && "flex-row-reverse text-right")}>
      <Crest n={team.n} logo={team.logo} code={team.code} name={team.name} size={110} className="we-a-pop" style={delay(280)} />
      <span className="flex flex-col">
        <span className="we-x text-[30px]">{team.code}</span>
        <span className="we-fig text-[96px] leading-[0.9]">
          <Fig value={pct} />
          <span className="text-[0.5em]">%</span>
        </span>
      </span>
    </div>
  );
}

export function WorldEventWinPredictor(p: OverlayElementProps["winPredictor"]) {
  if (p.variant === "strap") return null;
  const est = winPredictorFromLive(p.state);
  if (!est || est.kind !== "chase") return <WorldEventProjectedCard state={p.state} />;
  const { bat, bowl } = battingAndBowling(p.state);
  return (
    <CardFrame
      state={p.state}
      testId="we-win-card"
      eyebrow="Win predictor  ·  Estimate"
      title="Who wins from here"
      aside={
        <span className="we-label text-[20px] text-[#bdf7e8]">
          {bat.code} need {est.runsNeeded} from {est.ballsLeft}
        </span>
      }
      width={1400}
      footer={
        <span className="we-muted text-[19px] font-semibold">
          From the runs needed, balls and wickets left, against the first innings&apos; scoring rate.
        </span>
      }
    >
      <div className="flex items-center justify-between py-4">
        <PredictorSide team={bat} pct={est.battingPct} at="left" />
        <PredictorSide team={bowl} pct={est.bowlingPct} at="right" />
      </div>
      <div className="we-on-paper mt-2 [&_.we-fig]:text-[#120a3d]">
        <SplitBar left={bat} right={bowl} leftPct={est.battingPct} height={28} start={600} />
      </div>
    </CardFrame>
  );
}

function WorldEventProjectedCard({ state }: { state: LiveMatchState }) {
  const est = winPredictorFromLive(state);
  const rows = projectionsOf(state);
  if (!rows || !est || est.kind !== "projection") return null;
  const { bat } = battingAndBowling(state);
  return (
    <CardFrame
      state={state}
      testId="we-projected-card"
      eyebrow={state.tournament_name ? `Projected score  ·  ${state.tournament_name}` : "Projected score"}
      crest={<Crest n={bat.n} logo={bat.logo} code={bat.code} name={bat.name} size={76} className="we-a-pop" style={delay(200)} />}
      title={<span className="we-trunc block">{bat.name}</span>}
      aside={
        <span className="flex items-baseline gap-3">
          <span className="we-fig text-[52px] leading-none">{scoreText(state.total_runs, state.total_wickets)}</span>
          <span className="we-figl we-muted text-[22px]">({oversText(state.total_balls)} ov)</span>
        </span>
      }
      width={1400}
      footer={
        <span className="flex w-full items-baseline gap-5">
          <span className="we-label we-muted">Estimate (runs, overs and wickets left)</span>
          <span className="we-fig ml-auto text-[34px]">
            {est.low} to {est.high}
          </span>
        </span>
      }
    >
      <div className="grid grid-cols-4 gap-4 py-2">
        {rows.map((r, i) => (
          <div
            key={r.label}
            className={cn("we-a-rise relative flex flex-col items-center gap-1 px-4 py-5", r.current ? "we-accent we-sheen" : "bg-[#f2f0fb]")}
            style={delay(320 + i * 70)}
          >
            <span className={cn("we-label text-[16px]", !r.current && "we-ink-muted")}>{r.current ? "Current rate" : "Runs an over"}</span>
            <span className="we-fig text-[30px] leading-none">{r.current ? fixed2(r.rate) : r.rate}</span>
            <span className="we-fig mt-2 text-[72px] leading-none">{r.total}</span>
          </div>
        ))}
      </div>
    </CardFrame>
  );
}

export function WorldEventProjectedScore(p: OverlayElementProps["projectedScore"]) {
  if (p.variant === "strap") return null;
  const est = winPredictorFromLive(p.state);
  if (est?.kind === "chase") return <WorldEventWinPredictor {...p} />;
  return <WorldEventProjectedCard state={p.state} />;
}
