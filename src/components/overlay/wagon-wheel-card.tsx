"use client";

/**
 * Wagon wheel card: one batter's scoring shots this innings, drawn with the
 * match page's wagon wheel pieces (`SECTORS`, the field classes, shot
 * colours) as a still graphic: no pickers or filters on air. Available
 * when the batter has a shot with a recorded direction.
 */

import { useMemo } from "react";
import {
  FIELD,
  shotStyle,
} from "~/components/matches/wagon-wheel-field";
import type { Match } from "~/lib/match-types";
import { cn } from "~/lib/utils";
import {
  describeDonutSegment,
  polarToCartesian,
  SECTORS,
} from "~/lib/wagon-wheel-utils";
import { useInningsBallLog, useScorecardInnings } from "./overlay-data";
import { CardShell, eyebrowOf, OV, type OverlayThemeProps } from "./overlay-kit";
import type { LiveMatchState } from "./types";

const CX = 250;
const CY = 250;
const R_OUTER = 236;
const R_GRASS = 172;
const R_30YD = 116;
const R_TEXT = (R_OUTER + R_GRASS) / 2;
const BATTER_Y = CY - 16;

const DISTANCE: Record<number, number> = { 1: 0.46, 2: 0.62, 3: 0.76, 4: 0.92, 6: 0.98 };

export function WagonWheelCard({
  state,
  match,
  batterId,
}: OverlayThemeProps & {
  state: LiveMatchState;
  match?: Match | null;
  /** Defaults to the striker. */
  batterId?: string | null;
}) {
  const id = batterId ?? state.striker_id ?? null;
  const name =
    id && id === state.non_striker_id ? state.non_striker_name : state.striker_name;
  const { innings } = useScorecardInnings(state, match, true);
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
        const end = polarToCartesian(CX, CY, R_GRASS * (DISTANCE[runs] ?? 0.46), angle);
        return [{ key: b.id, runs, end, sector: sector.id, wicket: !!b.is_wicket }];
      }),
    [balls],
  );
  if (!log || shots.length === 0) return null;

  const bySector = new Map<string, number>();
  for (const s of shots) bySector.set(s.sector, (bySector.get(s.sector) ?? 0) + s.runs);
  const runs = shots.reduce((n, s) => n + s.runs, 0);
  const fours = shots.filter((s) => s.runs === 4).length;
  const sixes = shots.filter((s) => s.runs === 6).length;

  return (
    <CardShell
      className="max-w-[46rem]"
      eyebrow={eyebrowOf(state, "Wagon wheel")}
      title={name ?? ""}
      aside={
        <span className={cn("text-lg tabular-nums", OV.barMuted)}>
          {fours} fours · {sixes} sixes
        </span>
      }
    >
      <svg
        role="img"
        aria-label={`${name ?? "Batter"}: ${runs} runs from placed shots`}
        viewBox="0 0 500 500"
        className="mx-auto h-[30rem] w-[30rem]"
      >
        {SECTORS.map((s) => (
          <path
            key={s.id}
            d={describeDonutSegment(CX, CY, R_GRASS, R_OUTER, s.angleStart, s.angleEnd)}
            strokeWidth="2"
            className={FIELD.ring}
          />
        ))}
        <circle cx={CX} cy={CY} r={R_OUTER} fill="none" className={FIELD.rim} />
        {SECTORS.map((s) => {
          const p = polarToCartesian(CX, CY, R_TEXT, s.midAngle);
          return (
            <text
              key={`t-${s.id}`}
              x={p.x}
              y={p.y}
              fontSize="22"
              fontWeight="600"
              textAnchor="middle"
              dominantBaseline="central"
              className={cn("font-score tabular-nums", FIELD.label)}
            >
              {bySector.get(s.id) ?? 0}
            </text>
          );
        })}
        <circle cx={CX} cy={CY} r={R_GRASS} className={FIELD.grass} />
        <circle
          cx={CX}
          cy={CY}
          r={R_30YD}
          strokeWidth="1.2"
          strokeDasharray="4 4"
          className={FIELD.ring30}
        />
        <rect
          x={CX - 8}
          y={CY - 26}
          width={16}
          height={52}
          rx={2.5}
          className={FIELD.pitch}
        />
        {shots.map((s) => {
          const style = shotStyle(s.runs, s.wicket);
          return (
            <line
              key={s.key}
              x1={CX}
              y1={BATTER_Y}
              x2={s.end.x}
              y2={s.end.y}
              strokeWidth={style.width * 1.4}
              strokeLinecap="round"
              className={style.cls}
            />
          );
        })}
        <circle cx={CX} cy={BATTER_Y} r={4} className={FIELD.batter} />
      </svg>
    </CardShell>
  );
}

/** Whether the wagon wheel has a batter to draw (shots load when shown). */
export function wagonWheelAvailable(state: LiveMatchState): boolean {
  return !!state.striker_id && (state.striker_runs ?? 0) > 0;
}
