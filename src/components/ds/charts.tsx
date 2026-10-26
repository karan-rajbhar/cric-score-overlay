"use client";

import * as React from "react";
import { cn } from "~/lib/utils";

/*
 * Charts in the design system. Drawn at the container's real pixel width
 * (no viewBox scaling), so labels stay legible on phones. Colours come
 * from tokens through classes, so dark mode follows: the two sides are
 * `series-1` / `series-2` (a validated, colour-blind-safe pair), wickets
 * `wicket`, structure `border` / `muted-foreground`. Thin marks, quiet
 * horizontal gridlines, a legend with direct values, and a hover layer.
 */

export type SeriesKey = 1 | 2;

const SERIES: Record<SeriesKey, { stroke: string; fill: string; bg: string }> =
  {
    1: { stroke: "stroke-series-1", fill: "fill-series-1", bg: "bg-series-1" },
    2: { stroke: "stroke-series-2", fill: "fill-series-2", bg: "bg-series-2" },
  };

/** Width of an element, kept current with a ResizeObserver. */
function useWidth<T extends HTMLElement>(): [
  React.RefObject<T | null>,
  number,
] {
  const ref = React.useRef<T | null>(null);
  const [width, setWidth] = React.useState(0);
  React.useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    setWidth(el.clientWidth);
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(([entry]) => {
      if (entry) setWidth(Math.round(entry.contentRect.width));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width];
}

/**
 * The drawing box: a fixed width scales like an image (for print, where the
 * page is laid out at A4 width whatever the screen), else the container's.
 * `k` is screen pixels per chart unit, for the hover layer.
 */
function useChartBox(fixed?: number) {
  const [ref, measured] = useWidth<HTMLDivElement>();
  const width = fixed ?? measured;
  const k = fixed && measured ? measured / fixed : 1;
  const svg = (height: number) =>
    fixed
      ? {
          viewBox: `0 0 ${fixed} ${height}`,
          className: "h-auto w-full touch-pan-y",
        }
      : { width, height, className: "touch-pan-y" };
  /** The chart x under the pointer. */
  const pointerX = (e: React.PointerEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    return (e.clientX - rect.left) * (width / Math.max(1, rect.width));
  };
  return { ref, width, k, svg, pointerX };
}

/** "Nice" upper bound and evenly spaced ticks for a value axis. */
function niceTicks(max: number, count = 4): number[] {
  const raw = Math.max(1, max) / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step =
    [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? raw;
  const top = Math.ceil(max / step) * step || step;
  return Array.from({ length: Math.round(top / step) + 1 }, (_, i) => i * step);
}

/** Width one over label needs, so numbers never touch. */
const OVER_LABEL_PX = 18;

/**
 * The overs labelled on the axis. A bars chart passes the width of one
 * over's slot: when every label fits, every over is labelled.
 */
export function overTicks(maxOvers: number, slotW?: number): number[] {
  const step =
    slotW !== undefined && slotW >= OVER_LABEL_PX
      ? 1
      : maxOvers <= 10
        ? 1
        : maxOvers <= 20
          ? 2
          : maxOvers <= 50
            ? 5
            : 10;
  const out: number[] = [];
  for (let o = step; o <= maxOvers; o += step) out.push(o);
  return out;
}

export type LegendItem = {
  label: React.ReactNode;
  value?: React.ReactNode;
  series?: SeriesKey;
  /** Class for the swatch when it is not a series (e.g. "bg-wicket"). */
  swatch?: string;
  shape?: "line" | "square" | "dot";
};

/** One row of legend chips; the value is the direct label (score). */
export function ChartLegend({
  items,
  className,
}: {
  items: readonly LegendItem[];
  className?: string;
}) {
  return (
    <ul
      className={cn("flex flex-wrap items-center gap-x-4 gap-y-1.5", className)}
    >
      {items.map((it, i) => (
        <li key={i} className="inline-flex items-center gap-2 text-sm">
          <span
            aria-hidden="true"
            className={cn(
              "shrink-0",
              it.shape === "line"
                ? "h-[3px] w-4 rounded-full"
                : it.shape === "dot"
                  ? "h-2.5 w-2.5 rounded-full"
                  : "h-3 w-3 rounded-[3px]",
              it.swatch ??
                (it.series ? SERIES[it.series].bg : "bg-muted-foreground"),
            )}
          />
          <span className="text-muted-foreground">{it.label}</span>
          {it.value !== undefined && (
            <span className="font-score font-semibold tabular-nums text-foreground">
              {it.value}
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}

/** Floating tooltip inside a chart frame; flips left near the right edge. */
function ChartTooltip({
  x,
  width,
  children,
}: {
  x: number;
  width: number;
  children: React.ReactNode;
}) {
  const left = x > width * 0.6;
  return (
    <div
      role="status"
      className="pointer-events-none absolute top-2 z-10 min-w-[8.5rem] rounded-xl bg-popover px-3 py-2 text-xs text-popover-foreground shadow-float ring-1 ring-border/60"
      style={left ? { right: width - x + 12 } : { left: x + 12 }}
    >
      {children}
    </div>
  );
}

const axisText = "fill-muted-foreground font-score text-2xs tabular-nums";

/** Horizontal gridlines with their value labels on the left. */
function YGrid({
  ticks,
  y,
  left,
  width,
}: {
  ticks: readonly number[];
  y: (v: number) => number;
  left: number;
  width: number;
}) {
  return (
    <>
      {ticks.map((t) => (
        <g key={t}>
          <line
            x1={left}
            x2={left + width}
            y1={y(t)}
            y2={y(t)}
            className="stroke-border"
          />
          <text x={left - 8} y={y(t) + 4} textAnchor="end" className={axisText}>
            {t}
          </text>
        </g>
      ))}
    </>
  );
}

/** Over numbers along the bottom. */
function OverTicks({
  maxOvers,
  x,
  bottom,
  slotW,
}: {
  maxOvers: number;
  x: (over: number) => number;
  bottom: number;
  slotW?: number;
}) {
  return (
    <>
      {overTicks(maxOvers, slotW).map((o) => (
        <text
          key={o}
          x={x(o)}
          y={bottom}
          textAnchor="middle"
          className={axisText}
        >
          {o}
        </text>
      ))}
    </>
  );
}

/** Tooltip body: "Over N", then one row per side. */
function TooltipRows({
  over,
  rows,
}: {
  over: number;
  rows: readonly {
    key: string;
    label: string;
    series: SeriesKey;
    value: string;
  }[];
}) {
  return (
    <>
      <p className="mb-1 font-semibold text-foreground">Over {over}</p>
      {rows.map((r) => (
        <p key={r.key} className="flex items-center justify-between gap-3">
          <span className="inline-flex items-center gap-1.5 text-muted-foreground">
            <span className={cn("h-2 w-2 rounded-full", SERIES[r.series].bg)} />
            {r.label}
          </span>
          <span className="font-score font-semibold tabular-nums text-foreground">
            {r.value}
          </span>
        </p>
      ))}
    </>
  );
}

export type WormSeries = {
  key: string;
  label: string;
  series: SeriesKey;
  /** One point per over: runs so far and wickets that fell in the over. */
  points: readonly {
    over: number;
    runs: number;
    wicketsSoFar: number;
    wickets: number;
  }[];
};

/** One side's line, its wicket markers and the hovered point. */
function WormLine({
  s,
  x,
  y,
  hover,
}: {
  s: WormSeries;
  x: (o: number) => number;
  y: (r: number) => number;
  hover: number | null;
}) {
  const pts = [{ over: 0, runs: 0 }, ...s.points];
  const d = pts
    .map(
      (p, i) =>
        `${i ? "L" : "M"}${x(p.over).toFixed(1)},${y(p.runs).toFixed(1)}`,
    )
    .join(" ");
  const at = hover !== null && hover > 0 ? s.points[hover - 1] : undefined;
  return (
    <g>
      <path
        d={d}
        fill="none"
        strokeWidth={2}
        strokeLinejoin="round"
        strokeLinecap="round"
        className={SERIES[s.series].stroke}
      />
      {s.points
        .filter((p) => p.wickets > 0)
        .map((p) => (
          <circle
            key={p.over}
            cx={x(p.over)}
            cy={y(p.runs)}
            r={4.5}
            strokeWidth={2}
            className={cn(SERIES[s.series].fill, "stroke-card")}
          />
        ))}
      {at && (
        <circle
          cx={x(at.over)}
          cy={y(at.runs)}
          r={5}
          strokeWidth={2}
          className={cn("fill-card", SERIES[s.series].stroke)}
        />
      )}
    </g>
  );
}

/**
 * Run progression (worm): cumulative runs by over for each side, wickets
 * marked on the line. Hover shows every side's score at that over.
 */
export function WormChart({
  series,
  maxOvers,
  height = 240,
  label,
  width: fixedWidth,
}: {
  series: readonly WormSeries[];
  maxOvers: number;
  height?: number;
  /** Accessible summary of the chart. */
  label: string;
  /** Draw at this width and scale to fit (print). */
  width?: number;
}) {
  const { ref, width, k, svg, pointerX } = useChartBox(fixedWidth);
  const [hover, setHover] = React.useState<number | null>(null);
  const m = { l: 36, r: 12, t: 12, b: 26 };
  const pw = Math.max(1, width - m.l - m.r);
  const ph = height - m.t - m.b;
  const top = Math.max(
    40,
    ...series.flatMap((s) => s.points.map((p) => p.runs)),
  );
  const yTicks = niceTicks(top);
  const yMax = yTicks[yTicks.length - 1] ?? top;
  const x = (o: number) => m.l + (o / Math.max(1, maxOvers)) * pw;
  const y = (r: number) => m.t + ph - (r / yMax) * ph;

  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const o = Math.round(((pointerX(e) - m.l) / pw) * maxOvers);
    setHover(Math.max(0, Math.min(maxOvers, o)));
  };

  return (
    <div ref={ref} className="relative w-full">
      {width > 0 && (
        <svg
          {...svg(height)}
          role="img"
          aria-label={label}
          onPointerMove={onMove}
          onPointerLeave={() => setHover(null)}
        >
          <YGrid ticks={yTicks} y={y} left={m.l} width={pw} />
          <OverTicks maxOvers={maxOvers} x={x} bottom={height - 8} />
          {hover !== null && (
            <line
              x1={x(hover)}
              x2={x(hover)}
              y1={m.t}
              y2={m.t + ph}
              className="stroke-muted-foreground/50"
              strokeDasharray="3 3"
            />
          )}
          {series.map((s) => (
            <WormLine key={s.key} s={s} x={x} y={y} hover={hover} />
          ))}
        </svg>
      )}
      {hover !== null && hover > 0 && (
        <ChartTooltip x={x(hover) * k} width={width * k}>
          <TooltipRows
            over={hover}
            rows={series.map((s) => {
              const p = s.points[hover - 1];
              return {
                key: s.key,
                label: s.label,
                series: s.series,
                value: p ? `${p.runs}/${p.wicketsSoFar}` : "–",
              };
            })}
          />
        </ChartTooltip>
      )}
    </div>
  );
}

export type OverBarsSeries = {
  key: string;
  label: string;
  series: SeriesKey;
  overs: readonly { over: number; runs: number; wickets: number }[];
};

/** A bar with rounded top corners, anchored on the baseline. */
function barPath(bx: number, by: number, bw: number, base: number): string {
  const r = Math.min(4, bw / 2, base - by);
  return `M${bx},${base} V${by + r} Q${bx},${by} ${bx + r},${by} H${bx + bw - r} Q${bx + bw},${by} ${bx + bw},${by + r} V${base} Z`;
}

/** One over's bar for a side, with a red dot per wicket above it. */
function OverBar({
  bx,
  by,
  bw,
  base,
  runs,
  wickets,
  series,
}: {
  bx: number;
  by: number;
  bw: number;
  base: number;
  runs: number;
  wickets: number;
  series: SeriesKey;
}) {
  return (
    <g>
      {runs > 0 && (
        <path d={barPath(bx, by, bw, base)} className={SERIES[series].fill} />
      )}
      {Array.from({ length: Math.min(wickets, 3) }, (_, k) => (
        <circle
          key={k}
          cx={bx + bw / 2}
          cy={by - 6 - k * 8}
          r={Math.min(3.5, bw / 2 + 1)}
          strokeWidth={1.5}
          className="fill-wicket stroke-card"
        />
      ))}
    </g>
  );
}

/** Every side's bars, side by side within each over's slot. */
function BarsLayer({
  series,
  slots,
  slotW,
  bw,
  gap,
  mid,
  y,
  base,
}: {
  series: readonly OverBarsSeries[];
  slots: number;
  slotW: number;
  bw: number;
  gap: number;
  mid: (over: number) => number;
  y: (runs: number) => number;
  base: number;
}) {
  return (
    <>
      {series.map((s, si) =>
        s.overs
          .filter((o) => o.over >= 1 && o.over <= slots)
          .map((o) => (
            <OverBar
              key={`${s.key}-${o.over}`}
              bx={mid(o.over) - slotW / 2 + gap + si * (bw + gap)}
              by={y(o.runs)}
              bw={bw}
              base={base}
              runs={o.runs}
              wickets={o.wickets}
              series={s.series}
            />
          )),
      )}
    </>
  );
}

/** Scales and slot sizes of the over-bars chart. */
function barsGeometry(
  series: readonly OverBarsSeries[],
  maxOvers: number,
  width: number,
  height: number,
) {
  const m = { l: 32, r: 8, t: 22, b: 26 };
  const pw = Math.max(1, width - m.l - m.r);
  const ph = height - m.t - m.b;
  const top = Math.max(
    12,
    ...series.flatMap((s) => s.overs.map((o) => o.runs)),
  );
  const yTicks = niceTicks(top, 3);
  const yMax = yTicks[yTicks.length - 1] ?? top;
  const slots = Math.max(1, maxOvers);
  const slotW = pw / slots;
  const gap = 2;
  const n = Math.max(1, series.length);
  const bw = Math.max(2, (slotW - gap * 2 - gap * (n - 1)) / n);
  const base = m.t + ph;
  return {
    m,
    pw,
    ph,
    yTicks,
    slots,
    slotW,
    gap,
    bw,
    base,
    y: (r: number) => base - (r / yMax) * ph,
    mid: (o: number) => m.l + (o - 0.5) * slotW,
  };
}

/** A side's tooltip row for one over: "12 · 1 wkt". */
function barsRow(s: OverBarsSeries, over: number) {
  const o = s.overs.find((v) => v.over === over);
  return {
    key: s.key,
    label: s.label,
    series: s.series,
    value: o ? `${o.runs}${o.wickets ? ` · ${o.wickets} wkt` : ""}` : "–",
  };
}

/**
 * Runs per over (Manhattan): one bar per side per over, wickets as red
 * dots above the bar. Hover shows the over's runs and wickets per side.
 */
export function OverBarsChart({
  series,
  maxOvers,
  height = 240,
  label,
  width: fixedWidth,
}: {
  series: readonly OverBarsSeries[];
  maxOvers: number;
  height?: number;
  label: string;
  /** Draw at this width and scale to fit (print). */
  width?: number;
}) {
  const { ref, width, k, svg, pointerX } = useChartBox(fixedWidth);
  const [hover, setHover] = React.useState<number | null>(null);
  const g = barsGeometry(series, maxOvers, width, height);
  const { m, pw, ph, yTicks, slots, slotW, gap, bw, base, y, mid } = g;

  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const i = Math.floor((pointerX(e) - m.l) / slotW);
    setHover(i >= 0 && i < slots ? i + 1 : null);
  };

  return (
    <div ref={ref} className="relative w-full">
      {width > 0 && (
        <svg
          {...svg(height)}
          role="img"
          aria-label={label}
          onPointerMove={onMove}
          onPointerLeave={() => setHover(null)}
        >
          {hover !== null && (
            <rect
              x={mid(hover) - slotW / 2}
              y={m.t}
              width={slotW}
              height={ph}
              rx={6}
              className="fill-muted"
            />
          )}
          <YGrid ticks={yTicks} y={y} left={m.l} width={pw} />
          <OverTicks
            maxOvers={maxOvers}
            x={mid}
            bottom={height - 8}
            slotW={slotW}
          />
          <BarsLayer
            series={series}
            slots={slots}
            slotW={slotW}
            bw={bw}
            gap={gap}
            mid={mid}
            y={y}
            base={base}
          />
          <line
            x1={m.l}
            x2={m.l + pw}
            y1={base}
            y2={base}
            className="stroke-muted-foreground/40"
          />
        </svg>
      )}
      {hover !== null && (
        <ChartTooltip x={mid(hover) * k} width={width * k}>
          <TooltipRows
            over={hover}
            rows={series.map((s) => barsRow(s, hover))}
          />
        </ChartTooltip>
      )}
    </div>
  );
}
