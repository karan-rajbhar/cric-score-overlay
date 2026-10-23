"use client";

/**
 * Hundred-ball charts, drawn in balls: runs per set as flat block bars,
 * the worm against balls bowled, scoring by phase as runs per 100 balls,
 * and the wagon wheel. Series come from the shared chart helpers (the
 * ball log read the way Standard's cards read it); the drawing is ours.
 */

import type { CSSProperties, ReactNode } from "react";
import type { LiveMatchState } from "../../types";
import {
  axisMax,
  describeDonutSegment,
  inningsBalls,
  phaseRates,
  polarToCartesian,
  runsPerOver,
  SECTORS,
  sectorTotals,
  useBatterShots,
  useInningsSeries,
  wormSeries,
  wormWickets,
  type InningsSeries,
} from "../shared";
import type { ElementBaseProps, OverlayElementProps } from "../types";
import {
  ballsInPhase,
  ballsPerOverFrom,
  ballsWord,
  per100,
  setWordOf,
} from "./balls";
import { teamNumberOf, teamsOf } from "./common";
import { Board, Footer } from "./cards";
import {
  Block,
  Fig,
  FONT,
  Label,
  Name,
  Reveal,
  ScoreFig,
  styles,
  type Tone,
} from "./kit";
import { RunsBalls } from "./straps";

interface Series extends InningsSeries {
  tone: Tone;
  code: string;
}

function withTeams(state: LiveMatchState, series: InningsSeries[]): Series[] {
  const teams = teamsOf(state);
  return series.map((s) => {
    const t = teams[s.side - 1]!;
    return { ...s, tone: t.tone, code: t.code };
  });
}

/** The innings length in balls for the axes. */
function limitOf(state: LiveMatchState, bpo: number, series: Series[]) {
  const limit = inningsBalls({ ...state, innings_number: 1 }, bpo);
  return Math.max(limit ?? 0, ...series.map((s) => s.innings.total_balls), 1);
}

function Legend({ series }: { series: Series[] }) {
  return (
    <Footer>
      {series.map((s) => (
        <span key={s.innings.id} className="flex items-center gap-4">
          <span
            className="flex h-10 min-w-16 items-center justify-center px-3"
            style={{ background: `var(--hb-${s.tone})`, color: `var(--hb-${s.tone}-fg)` }}
          >
            <Label size={20}>{s.code}</Label>
          </span>
          <ScoreFig runs={s.innings.total_runs} wickets={s.innings.total_wickets} size={34} />
          <Label size={18} color="var(--hb-ink-muted)">
            {s.innings.total_balls} {ballsWord(s.innings.total_balls)}
          </Label>
        </span>
      ))}
    </Footer>
  );
}

const W = 1428;
const H = 360;
const PAD = { l: 64, r: 40, t: 24, b: 44 };
const AXIS_TEXT: CSSProperties = { fontFamily: FONT.figures, fontSize: 20, fontWeight: 700 };

/** A wicket: a white square, ink-edged, readable on either team's colour. */
function WicketMark({ x, y, size }: { x: number; y: number; size: number }) {
  return (
    <rect
      x={x - size / 2}
      y={y - size / 2}
      width={size}
      height={size}
      fill="#ffffff"
      stroke="var(--hb-ink2)"
      strokeWidth={3}
    />
  );
}

/** A grid step giving about four lines up to `peak`. */
function niceStep(peak: number, lines = 4) {
  const steps = [1, 2, 5, 10, 20, 25, 50, 100];
  return steps.find((s) => s >= peak / lines) ?? 100;
}

function YAxis({ max, step }: { max: number; step: number }) {
  const ticks: number[] = [];
  for (let v = 0; v <= max; v += step) ticks.push(v);
  const y = (v: number) => PAD.t + (H - PAD.t - PAD.b) * (1 - v / max);
  return (
    <g>
      {ticks.map((v) => (
        <g key={v}>
          <line x1={PAD.l} x2={W - PAD.r} y1={y(v)} y2={y(v)} stroke="rgb(255 255 255 / 0.12)" strokeWidth={2} />
          <text x={PAD.l - 14} y={y(v)} textAnchor="end" dominantBaseline="central" fill="rgb(255 255 255 / 0.74)" style={AXIS_TEXT}>
            {v}
          </text>
        </g>
      ))}
    </g>
  );
}

function ChartBody({ children, label }: { children: ReactNode; label: string }) {
  return (
    <Block tone="ink2" className="px-6 py-5">
      <svg role="img" aria-label={label} viewBox={`0 0 ${W} ${H}`} width="100%" className="block">
        {children}
      </svg>
    </Block>
  );
}

function useChart(p: ElementBaseProps) {
  const raw = useInningsSeries(p.state, p.match);
  const bpo = ballsPerOverFrom(p.state, p.match);
  const series = raw ? withTeams(p.state, raw) : null;
  return {
    series: series && series.some((s) => s.table.length) ? series : null,
    bpo,
  };
}

const describe = (series: Series[]) =>
  series.map((s) => `${s.name} ${s.innings.total_runs}/${s.innings.total_wickets}`).join(", ");

export function HundredRunsPerSet(p: OverlayElementProps["runsPerOver"]) {
  const { series, bpo } = useChart(p);
  if (!series) return null;
  const sets = series.map((s) => runsPerOver(s.table));
  const limit = limitOf(p.state, bpo, series);
  const count = Math.max(Math.ceil(limit / bpo), ...sets.map((x) => x.at(-1)?.over ?? 0));
  const peak = Math.max(6, ...sets.flat().map((x) => x.runs));
  const step = niceStep(peak);
  const max = axisMax(peak, step);
  const word = setWordOf(bpo).toLowerCase();
  const slot = (W - PAD.l - PAD.r) / count;
  const barW = Math.max(6, (slot - 10) / series.length);
  const y = (v: number) => PAD.t + (H - PAD.t - PAD.b) * (1 - v / max);
  return (
    <Board testId="hb-runs-per-set" width={1500} eyebrow="Match so far" title={`Runs per ${word}`}>
      <ChartBody label={`Runs per ${word}: ${describe(series)}`}>
        <YAxis max={max} step={step} />
        {sets.map((list, si) =>
          list.map((x) => {
            const left = PAD.l + (x.over - 1) * slot + 5 + si * barW;
            const top = y(x.runs);
            return (
              <g
                key={`${si}-${x.over}`}
                className={`${styles.anim} ${styles.growY}`}
                style={{ "--d": `${300 + x.over * 18}ms`, transformBox: "fill-box" } as CSSProperties}
              >
                <rect x={left} y={top} width={barW - 2} height={H - PAD.b - top} fill={`var(--hb-${series[si]!.tone}-pop)`} />
                <rect x={left} y={top} width={barW - 2} height={4} fill="rgb(255 255 255 / 0.35)" />
                {Array.from({ length: x.wickets }, (_, k) => (
                  <WicketMark key={k} x={left + (barW - 2) / 2} y={top - 12 - k * 18} size={14} />
                ))}
              </g>
            );
          }),
        )}
        {Array.from({ length: count }, (_, i) => i + 1)
          .filter((n) => count <= 25 || n % 5 === 0 || n === 1)
          .map((n) => (
            <text key={n} x={PAD.l + (n - 0.5) * slot} y={H - 12} textAnchor="middle" fill="rgb(255 255 255 / 0.74)" style={AXIS_TEXT}>
              {n}
            </text>
          ))}
      </ChartBody>
      <Legend series={series} />
    </Board>
  );
}

export function HundredWorm(p: OverlayElementProps["worm"]) {
  const { series, bpo } = useChart(p);
  if (!series) return null;
  // The shared worm is a point an over; drawn against balls bowled (the
  // last, unfinished over at the innings' own ball count).
  const worms = series.map((s) => {
    const points = wormSeries(s.table).map((pt) => ({
      ...pt,
      ball: Math.min(pt.over * bpo, s.innings.total_balls),
    }));
    return { points, wickets: wormWickets(points) as typeof points };
  });
  const limit = limitOf(p.state, bpo, series);
  const target = p.state.target_runs;
  const peak = Math.max(20, target ?? 0, ...worms.map((w) => w.points.at(-1)?.runs ?? 0));
  const step = niceStep(peak);
  const max = axisMax(peak, step);
  const x = (ball: number) => PAD.l + ((W - PAD.l - PAD.r) * ball) / limit;
  const y = (v: number) => PAD.t + (H - PAD.t - PAD.b) * (1 - v / max);
  const xStep = limit <= 60 ? 10 : limit <= 120 ? 20 : 50;
  return (
    <Board testId="hb-worm" width={1500} eyebrow="Match so far" title="Runs by ball">
      <ChartBody label={`Runs by ball: ${describe(series)}`}>
        <YAxis max={max} step={step} />
        {Array.from({ length: Math.floor(limit / xStep) + 1 }, (_, i) => i * xStep).map((b) => (
          <text key={b} x={x(b)} y={H - 12} textAnchor="middle" fill="rgb(255 255 255 / 0.74)" style={AXIS_TEXT}>
            {b}
          </text>
        ))}
        {target !== null && target !== undefined && (
          <g>
            <line x1={PAD.l} x2={W - PAD.r} y1={y(target)} y2={y(target)} stroke="var(--hb-volt)" strokeWidth={3} strokeDasharray="12 8" />
            <text x={W - PAD.r - 8} y={y(target) - 12} textAnchor="end" fill="var(--hb-volt)" style={{ fontFamily: FONT.display, fontSize: 20, fontWeight: 800 }}>
              TARGET {target}
            </text>
          </g>
        )}
        {worms.map((w, i) => (
          <g
            key={series[i]!.innings.id}
            className={`${styles.anim} ${styles.wipeRight}`}
            style={{ "--d": `${300 + i * 200}ms`, "--t": "900ms" } as CSSProperties}
          >
            <polyline
              points={w.points.map((pt) => `${x(pt.ball)},${y(pt.runs)}`).join(" ")}
              fill="none"
              stroke={`var(--hb-${series[i]!.tone}-pop)`}
              strokeWidth={7}
              strokeLinejoin="miter"
            />
            {w.wickets.map((wk, k) => (
              <WicketMark key={k} x={x(wk.ball)} y={y(wk.runs)} size={18} />
            ))}
          </g>
        ))}
      </ChartBody>
      <Legend series={series} />
    </Board>
  );
}

export function HundredRunRates(p: OverlayElementProps["runRates"]) {
  const { series, bpo } = useChart(p);
  if (!series) return null;
  const limit = limitOf(p.state, bpo, series);
  const overs = Math.round(limit / bpo);
  // The shared phases are in overs; shown here in balls.
  const phases = series.map((s) =>
    phaseRates(s.table, overs).map((ph) => {
      const from = (ph.from - 1) * bpo + 1;
      const to = ph.to * bpo;
      return {
        label: ph.label.replace(" overs", ""),
        from,
        to,
        runs: ph.runs,
        wickets: ph.wickets,
        bowled: ph.overs > 0,
        balls: ballsInPhase(s.innings.total_balls, from, to),
      };
    }),
  );
  const rows = phases[0] ?? [];
  return (
    <Board testId="hb-run-rates" width={1400} eyebrow="Runs per 100 balls" title="Scoring by phase">
      {rows.map((ph, pi) => (
        <div key={ph.label} className="flex" style={{ gap: 6 }}>
          <Block tone="ink" className="flex w-[21rem] shrink-0 flex-col justify-center gap-2 px-8" style={{ height: 120 }}>
            <Reveal delay={240 + pi * 80}>
              <Name size={36}>{ph.label}</Name>
            </Reveal>
            <Label size={20} color="var(--hb-ink-muted)">
              Balls {ph.from} to {ph.to}
            </Label>
          </Block>
          {series.map((s, si) => {
            const t = phases[si]![pi];
            return (
              <Block key={s.innings.id} tone={si === 0 ? "paper" : "paper2"} className="flex min-w-0 flex-1 items-center justify-between gap-6 px-8" style={{ height: 120 }}>
                <span className="flex items-center gap-4">
                  <span className="flex h-11 min-w-14 items-center justify-center px-2" style={{ background: `var(--hb-${s.tone})`, color: `var(--hb-${s.tone}-fg)` }}>
                    <Label size={20}>{s.code}</Label>
                  </span>
                  {t?.bowled ? (
                    <ScoreFig runs={t.runs} wickets={t.wickets} size={48} />
                  ) : (
                    <Label color="var(--hb-paper-muted)">Not reached</Label>
                  )}
                </span>
                {t?.bowled && (
                  <span className="flex flex-col items-end gap-1">
                    <Fig value={per100(t.runs, t.balls) ?? "–"} size={56} roll={false} />
                    <Label size={18} color="var(--hb-paper-muted)">
                      per 100 · {t.balls} {ballsWord(t.balls)}
                    </Label>
                  </span>
                )}
              </Block>
            );
          })}
        </div>
      ))}
    </Board>
  );
}

const CX = 250;
const CY = 250;
const R_OUT = 238;
const R_GRASS = 176;
const R_RING = 120;
const BAT_Y = CY - 14;

const shotColour = (r: number) =>
  r === 6 ? "var(--hb-six)" : r === 4 ? "var(--hb-four)" : "#ffffff";

export function HundredWagonWheel(p: OverlayElementProps["wagonWheel"]) {
  const { state, match, batterId } = p;
  const { name, shots, loaded } = useBatterShots(state, match, batterId);
  if (!loaded || !shots.length) return null;
  const id = batterId ?? state.striker_id ?? null;
  const nonStriker = !!id && id === state.non_striker_id;
  const totals = sectorTotals(shots);
  const fours = shots.filter((s) => s.runs === 4).length;
  const sixes = shots.filter((s) => s.runs === 6).length;
  const runs = nonStriker ? state.non_striker_runs : state.striker_runs;
  const balls = nonStriker ? state.non_striker_balls : state.striker_balls;
  const side = teamsOf(state)[(teamNumberOf(state, state.batting_team_name) ?? 1) - 1]!;
  return (
    <Board
      testId="hb-wagon-wheel"
      width={1240}
      side={{ tone: side.tone, logo: side.logo, code: side.code }}
      eyebrow="Wagon wheel"
      title={name ?? ""}
      hero={<RunsBalls runs={runs} balls={balls} size={72} color="var(--hb-paper-muted)" />}
      heroLabel="Runs"
    >
      <div className="flex" style={{ gap: 6 }}>
        <Block tone="ink2" className="flex flex-1 items-center justify-center py-4">
          <svg role="img" aria-label={`${name ?? "Batter"}: scoring shots by zone`} viewBox="0 0 500 500" className="block h-[30rem] w-[30rem]">
            {SECTORS.map((s, i) => (
              <path key={s.id} d={describeDonutSegment(CX, CY, R_GRASS, R_OUT, s.angleStart, s.angleEnd)} fill={i % 2 ? "#26402a" : "#2d4a31"} stroke="var(--hb-ink2)" strokeWidth={4} />
            ))}
            <circle cx={CX} cy={CY} r={R_GRASS} fill="#3a6b3f" />
            <circle cx={CX} cy={CY} r={R_RING} fill="#447a49" stroke="rgb(255 255 255 / 0.35)" strokeWidth={2} strokeDasharray="6 6" />
            <rect x={CX - 9} y={CY - 28} width={18} height={56} fill="#c9b48a" />
            {totals.map((t) => {
              const pt = polarToCartesian(CX, CY, (R_OUT + R_GRASS) / 2, t.midAngle);
              return (
                <text key={`t-${t.id}`} x={pt.x} y={pt.y} textAnchor="middle" dominantBaseline="central" fill={t.runs ? "#ffffff" : "rgb(255 255 255 / 0.45)"} style={{ fontFamily: FONT.figures, fontSize: 24, fontWeight: 800 }}>
                  {t.runs}
                </text>
              );
            })}
            <g className={`${styles.anim} ${styles.fade}`} style={{ "--d": "380ms", "--t": "600ms" } as CSSProperties}>
              {shots.map((s) => {
                const end = polarToCartesian(CX, CY, R_GRASS * s.reach, s.angle);
                return (
                  <line key={s.key} x1={CX} y1={BAT_Y} x2={end.x} y2={end.y} stroke={shotColour(s.runs)} strokeWidth={s.runs >= 4 ? 6 : 3.5} strokeLinecap="square" />
                );
              })}
            </g>
            <rect x={CX - 6} y={BAT_Y - 6} width={12} height={12} fill="var(--hb-volt)" />
          </svg>
        </Block>
        <div className="flex w-[22rem] shrink-0 flex-col" style={{ gap: 6 }}>
          <Block tone="four" className="flex flex-1 flex-col justify-between px-7 py-5">
            <Label color="var(--hb-four-muted)">Fours</Label>
            <Fig value={fours} size={96} roll={false} />
          </Block>
          <Block tone="six" className="flex flex-1 flex-col justify-between px-7 py-5">
            <Label color="var(--hb-six-muted)">Sixes</Label>
            <Fig value={sixes} size={96} roll={false} />
          </Block>
        </div>
      </div>
    </Board>
  );
}
