"use client";

/**
 * The persistent score bug in three layouts:
 * - bottom: the full broadcast bar (side, score, overs, both batters, the
 *   bowler, this over) with a context strip under it (the chase, or the
 *   run rate and stand, the powerplay, the last wicket);
 * - top: one slim row along the top edge;
 * - compact: a corner card.
 *
 * Reads only the `live_state` row. Static: nothing rotates or pulses.
 */

import type { ReactNode } from "react";
import { cn } from "~/lib/utils";
import {
  BallTrack,
  battingSide,
  economyText,
  OV,
  OverlayFrame,
  overTokens,
  oversText,
  TeamBadge,
  teamCode,
  type OverlayThemeProps,
} from "./overlay-kit";
import type { LayoutMode, LiveMatchState } from "./types";

export interface ScoreBugProps extends OverlayThemeProps {
  state: LiveMatchState;
  /** "broadcast" draws the bottom bar too. */
  layout?: LayoutMode;
  /** A sponsor line on the context strip. */
  sponsor?: string | null;
  /** Lift above the bottom edge (OBS safe-zone offset), in px. */
  marginOffsetPx?: number;
}

const inningsLabel = (n: number | null | undefined) =>
  n === 2 ? "2nd innings" : n && n > 2 ? "Super over" : "1st innings";

function battingCode(state: LiveMatchState): string {
  return teamCode(state.batting_team_short_name, state.batting_team_name);
}

/** The striker marker: a short bar in the theme's accent. */
function StrikeMark({ on }: { on: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "h-5 w-1.5 shrink-0 rounded-full",
        on ? "bg-[color:var(--ov-accent)]" : "bg-transparent",
      )}
    />
  );
}

function BatterLine({
  name,
  runs,
  balls,
  striker,
}: {
  name: string | null;
  runs: number | null;
  balls: number | null;
  striker: boolean;
}) {
  if (!name) return null;
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      <StrikeMark on={striker} />
      <span
        className={cn(
          "min-w-0 flex-1 truncate text-[1.375rem] leading-tight",
          striker ? "font-semibold" : "font-medium opacity-90",
        )}
      >
        {name}
        {striker && <span className="sr-only"> on strike</span>}
      </span>
      <span className="shrink-0 text-[1.5rem] font-bold tabular-nums leading-tight">
        {runs ?? 0}
      </span>
      <span
        className={cn(
          "w-12 shrink-0 text-base tabular-nums leading-tight",
          OV.barMuted,
        )}
      >
        ({balls ?? 0})
      </span>
    </div>
  );
}

/** The chase, or the innings' rate and stand, for the context strip. */
export function contextLine(state: LiveMatchState): ReactNode[] {
  const parts: ReactNode[] = [];
  const chasing =
    state.target_runs !== null &&
    state.runs_needed !== null &&
    state.balls_remaining !== null &&
    !state.innings_completed;
  if (chasing && (state.runs_needed ?? 0) > 0) {
    parts.push(
      <span key="need" className="font-semibold">
        Need {state.runs_needed} from {state.balls_remaining}{" "}
        {state.balls_remaining === 1 ? "ball" : "balls"}
      </span>,
      <span key="target">Target {state.target_runs}</span>,
    );
    if (state.required_run_rate !== null) {
      parts.push(<span key="rrr">RRR {state.required_run_rate.toFixed(2)}</span>);
    }
  } else if (state.current_run_rate !== null) {
    parts.push(
      <span key="crr">CRR {state.current_run_rate.toFixed(2)}</span>,
    );
  }
  if ((state.partnership_runs ?? 0) > 0) {
    parts.push(
      <span key="stand">
        Partnership {state.partnership_runs} ({state.partnership_balls ?? 0})
      </span>,
    );
  }
  return parts;
}

function LastWicket({ state }: { state: LiveMatchState }) {
  const w = state.last_wicket;
  if (!w?.name) return null;
  return (
    <span className="truncate">
      Last wicket {w.name} {w.runs} ({w.balls})
    </span>
  );
}

function PowerplayChip({ state }: { state: LiveMatchState }) {
  if (!state.powerplay) return null;
  return (
    <span className={cn("rounded px-2 py-0.5 text-sm font-semibold", OV.accent)}>
      Powerplay
    </span>
  );
}

function BottomBar({
  state,
  sponsor,
}: {
  state: LiveMatchState;
  sponsor?: string | null;
}) {
  const side = battingSide(state);
  const logo =
    side === 1 ? state.team1_logo_url : side === 2 ? state.team2_logo_url : null;
  const balls = overTokens(state);
  const bowlerEcon = economyText(state.bowler_runs, state.bowler_balls);
  const context = contextLine(state);
  return (
    <div className={cn("overflow-hidden rounded-lg", OV.shadow)}>
      <div className={cn("flex h-[5.5rem] items-stretch", OV.bar)}>
        <TeamBadge
          side={side}
          code={battingCode(state)}
          logoUrl={logo}
          detail={inningsLabel(state.innings_number)}
        />
        <div className="flex shrink-0 items-center gap-4 px-6">
          <span className="text-[3rem] font-bold tabular-nums leading-none">
            {state.total_runs ?? 0}/{state.total_wickets ?? 0}
          </span>
          <span className="leading-tight">
            <span className="block text-[1.5rem] font-semibold tabular-nums">
              {oversText(state.total_balls)}
            </span>
            <span className={cn("block text-sm", OV.barMuted)}>
              of {state.overs_per_innings ?? "–"} overs
            </span>
          </span>
        </div>
        <div
          className={cn(
            "flex w-[27rem] min-w-0 flex-col justify-center gap-1 border-l px-5",
            OV.line,
          )}
        >
          <BatterLine
            name={state.striker_name}
            runs={state.striker_runs}
            balls={state.striker_balls}
            striker
          />
          <BatterLine
            name={state.non_striker_name}
            runs={state.non_striker_runs}
            balls={state.non_striker_balls}
            striker={false}
          />
        </div>
        {state.current_bowler_name && (
          <div
            className={cn(
              "flex w-[18rem] min-w-0 flex-col justify-center border-l px-5",
              OV.line,
            )}
          >
            <span className="truncate text-[1.375rem] font-medium leading-tight">
              {state.current_bowler_name}
            </span>
            <span className="flex items-baseline gap-2 leading-tight">
              <span className="text-[1.5rem] font-bold tabular-nums">
                {state.bowler_wickets ?? 0}-{state.bowler_runs ?? 0}
              </span>
              <span className={cn("text-base tabular-nums", OV.barMuted)}>
                {oversText(state.bowler_balls)}
                {bowlerEcon && ` · Econ ${bowlerEcon}`}
              </span>
            </span>
          </div>
        )}
        <div
          className={cn(
            "flex flex-1 items-center justify-end border-l px-5",
            OV.line,
          )}
        >
          <BallTrack balls={balls} slots={6} />
        </div>
      </div>
      <div
        className={cn(
          "flex h-10 items-center justify-between gap-6 px-5 text-base",
          OV.panel,
        )}
      >
        <div className="flex min-w-0 items-center gap-5 tabular-nums">
          <PowerplayChip state={state} />
          {context.map((c, i) => (
            <span key={i} className="flex items-center gap-5">
              {i > 0 && (
                <span aria-hidden="true" className={OV.panelMuted}>
                  ·
                </span>
              )}
              {c}
            </span>
          ))}
        </div>
        <div
          className={cn(
            "flex min-w-0 items-center gap-5 tabular-nums",
            OV.panelMuted,
          )}
        >
          <LastWicket state={state} />
          {sponsor && <span className="truncate">{sponsor}</span>}
        </div>
      </div>
    </div>
  );
}

function TopBar({ state }: { state: LiveMatchState }) {
  const side = battingSide(state);
  const chasing = state.target_runs !== null && state.runs_needed !== null;
  return (
    <div
      className={cn(
        "flex h-16 items-stretch overflow-hidden rounded-lg",
        OV.bar,
        OV.shadow,
      )}
    >
      <TeamBadge side={side} code={battingCode(state)} />
      <div className="flex shrink-0 items-baseline gap-3 self-center px-5">
        <span className="text-[2.25rem] font-bold tabular-nums leading-none">
          {state.total_runs ?? 0}/{state.total_wickets ?? 0}
        </span>
        <span className={cn("text-lg tabular-nums", OV.barMuted)}>
          {oversText(state.total_balls)} ov
        </span>
      </div>
      {state.striker_name && (
        <div
          className={cn(
            "flex min-w-0 max-w-[18rem] items-center gap-2 border-l px-4",
            OV.line,
          )}
        >
          <StrikeMark on />
          <span className="truncate text-lg font-semibold">
            {state.striker_name}
          </span>
          <span className="text-lg font-bold tabular-nums">
            {state.striker_runs ?? 0}
          </span>
        </div>
      )}
      {state.current_bowler_name && (
        <div
          className={cn(
            "flex min-w-0 max-w-[16rem] items-center gap-2 border-l px-4",
            OV.line,
          )}
        >
          <span className="truncate text-lg font-medium">
            {state.current_bowler_name}
          </span>
          <span className="text-lg font-bold tabular-nums">
            {state.bowler_wickets ?? 0}-{state.bowler_runs ?? 0}
          </span>
        </div>
      )}
      <div
        className={cn(
          "flex flex-1 items-center justify-end border-l px-4",
          OV.line,
        )}
      >
        <BallTrack balls={overTokens(state)} slots={6} size="sm" />
      </div>
      {chasing && (state.runs_needed ?? 0) > 0 && (
        <div
          className={cn(
            "flex items-center px-5 text-lg font-semibold tabular-nums",
            OV.panel,
          )}
        >
          Need {state.runs_needed} from {state.balls_remaining}
        </div>
      )}
    </div>
  );
}

function CompactCard({ state }: { state: LiveMatchState }) {
  const side = battingSide(state);
  const context = contextLine(state);
  return (
    <div className={cn("w-[24rem] overflow-hidden rounded-lg", OV.shadow)}>
      <div className={cn("flex items-stretch", OV.bar)}>
        <TeamBadge side={side} code={battingCode(state)} className="py-3" />
        <div className="flex flex-1 items-baseline justify-end gap-3 px-4 py-3">
          <span className="text-[2.25rem] font-bold tabular-nums leading-none">
            {state.total_runs ?? 0}/{state.total_wickets ?? 0}
          </span>
          <span className={cn("text-lg tabular-nums", OV.barMuted)}>
            {oversText(state.total_balls)}
          </span>
        </div>
      </div>
      <div className={cn("space-y-1 px-4 py-2.5", OV.panel)}>
        {state.striker_name && (
          <div className="flex items-center gap-2 text-lg">
            <StrikeMark on />
            <span className="min-w-0 flex-1 truncate font-semibold">
              {state.striker_name}
            </span>
            <span className="font-bold tabular-nums">
              {state.striker_runs ?? 0} ({state.striker_balls ?? 0})
            </span>
          </div>
        )}
        {state.current_bowler_name && (
          <div className="flex items-center gap-2 pl-3.5 text-lg">
            <span className="min-w-0 flex-1 truncate font-medium">
              {state.current_bowler_name}
            </span>
            <span className="font-bold tabular-nums">
              {state.bowler_wickets ?? 0}-{state.bowler_runs ?? 0}
            </span>
          </div>
        )}
        {context.length > 0 && (
          <div className={cn("truncate text-base tabular-nums", OV.panelMuted)}>
            {context[0]}
          </div>
        )}
        <BallTrack balls={overTokens(state)} slots={6} size="sm" className="pt-1" />
      </div>
    </div>
  );
}

/**
 * The score bug. Wiring (overlay-client): replace the inline bottom / top /
 * compact JSX with `<ScoreBug state={state} layout={layout} theme={theme}
 * customColors={customColors} sponsor={sponsor}
 * marginOffsetPx={marginOffsetPx} />` inside the `showBug` branch.
 */
export function ScoreBug({
  state,
  layout = "bottom",
  sponsor,
  marginOffsetPx = 0,
  theme,
  customColors,
}: ScoreBugProps) {
  const offset = `${40 + marginOffsetPx}px`;
  return (
    <OverlayFrame
      state={state}
      theme={theme}
      customColors={customColors}
      data-testid="score-bug"
      data-layout={layout}
      style={layout === "top" ? { top: "2rem" } : { bottom: offset }}
      className={cn(
        "pointer-events-none fixed z-20",
        layout === "compact"
          ? "left-12"
          : "left-1/2 w-[calc(100%-6rem)] max-w-[110rem] -translate-x-1/2",
      )}
    >
      {layout === "top" ? (
        <TopBar state={state} />
      ) : layout === "compact" ? (
        <CompactCard state={state} />
      ) : (
        <BottomBar state={state} sponsor={sponsor} />
      )}
    </OverlayFrame>
  );
}
