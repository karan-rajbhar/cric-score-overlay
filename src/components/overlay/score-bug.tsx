"use client";

/**
 * The persistent score bug, in three layouts and four phases of a match:
 * - layouts: bottom (the full bar: side, score, overs, both batters, the
 *   bowler, this over, with a context strip under it), top (one slim row)
 *   and compact (a corner card);
 * - phases ({@link overlayPhaseOf}): before the first ball (who plays, when
 *   it starts, the toss), in play, the innings break (who bats next, the
 *   chase) and after the match (the result). A super over shows as such,
 *   with its one-over limit.
 *
 * Reads the `live_state` row (and the page's match for the start time,
 * balls per over and the toss). Static: nothing rotates or pulses.
 */

import { useEffect, useState, type ReactNode } from "react";
import type { Match } from "~/lib/match-types";
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

// ---- phases and sides -------------------------------------------------------

/** Where the match is, as far as the score bug is concerned. */
export type OverlayPhase = "pre" | "live" | "break" | "done";

const FINISHED = new Set(["completed", "abandoned", "cancelled"]);

export function overlayPhaseOf(state: LiveMatchState): OverlayPhase {
  if (FINISHED.has(state.status ?? "")) return "done";
  if (state.innings_number === null || state.innings_number === undefined) {
    return "pre";
  }
  if (state.status !== "live" && state.status !== "innings_break") {
    return "pre";
  }
  // The next innings exists from the moment the last one closed, before
  // anyone is at the crease.
  const nobodyIn =
    !state.striker_name &&
    !state.non_striker_name &&
    !state.current_bowler_name;
  if (
    state.status === "innings_break" ||
    ((state.innings_number ?? 1) >= 2 && !state.total_balls && nobodyIn)
  ) {
    return "break";
  }
  return "live";
}

export function inningsLabel(inningsNumber: number | null | undefined): string {
  if ((inningsNumber ?? 1) >= 3) return "Super over";
  return inningsNumber === 2 ? "2nd innings" : "1st innings";
}

export interface Side {
  name: string | null;
  short: string | null;
  logo: string | null;
}

/** The batting side and the other one (named even after the match). */
export function sidesOf(state: LiveMatchState): {
  batting: Side;
  bowling: Side;
} {
  const team1: Side = {
    name: state.team1_name,
    short: state.team1_short_name,
    logo: state.team1_logo_url ?? null,
  };
  const team2: Side = {
    name: state.team2_name,
    short: state.team2_short_name,
    logo: state.team2_logo_url ?? null,
  };
  const battingName = state.batting_team_name;
  const battingIsTeam2 =
    !!battingName &&
    battingName === state.team2_name &&
    battingName !== state.team1_name;
  const batting: Side = battingName
    ? {
        name: battingName,
        short: state.batting_team_short_name,
        logo: battingIsTeam2 ? team2.logo : team1.logo,
      }
    : team1;
  const other = battingIsTeam2 ? team1 : team2;
  const bowling: Side = state.bowling_team_name
    ? {
        ...other,
        name: state.bowling_team_name,
        short: state.bowling_team_short_name,
      }
    : other;
  return { batting, bowling };
}

const codeOfSide = (side: Side) => teamCode(side.short, side.name);

/** Overs per innings shown after the score (1 in a super over). */
function oversLimitOf(state: LiveMatchState): number | null {
  if ((state.innings_number ?? 1) >= 3) return 1;
  return state.overs_per_innings ?? null;
}

/** Legal deliveries per over (live_state does not carry it; the match does). */
export const ballsPerOverOf = (match: Match | null | undefined) =>
  match?.balls_per_over && match.balls_per_over > 0 ? match.balls_per_over : 6;

/** "Riverside won the toss and chose to bat", when both are known. */
export function tossLineOf(
  state: LiveMatchState,
  match: Match | null | undefined,
): string | null {
  if (!state.toss_winner_team_id || !state.toss_decision) return null;
  const winner =
    state.toss_winner_team_id === match?.team1_id
      ? state.team1_name
      : state.toss_winner_team_id === match?.team2_id
        ? state.team2_name
        : null;
  if (!winner) return null;
  return `${winner} won the toss and chose to ${
    state.toss_decision === "bowl" ? "bowl" : "bat"
  }`;
}

/** Local start time, formatted after hydration (the server has no zone). */
function useStartTime(iso: string | null | undefined): string | null {
  const [text, setText] = useState<string | null>(null);
  useEffect(() => {
    if (!iso) return;
    const at = new Date(iso);
    if (Number.isNaN(at.getTime())) return;
    const sameDay = at.toDateString() === new Date().toDateString();
    const time = at.toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit",
    });
    const value = sameDay
      ? time
      : `${at.toLocaleDateString([], { weekday: "short", day: "numeric", month: "short" })}, ${time}`;
    // A timer, not a synchronous set: keeps the effect free of cascades.
    const id = setTimeout(() => setText(value), 0);
    return () => clearTimeout(id);
  }, [iso]);
  return text;
}

// ---- pieces -----------------------------------------------------------------

export interface ScoreBugProps extends OverlayThemeProps {
  state: LiveMatchState;
  /** The page's match: start time, balls per over, the toss. */
  match?: Match | null;
  /** "broadcast" draws the bottom bar too. */
  layout?: LayoutMode;
  /** A sponsor line on the context strip. */
  sponsor?: string | null;
  /** Lift above the bottom edge (OBS safe-zone offset), in px. */
  marginOffsetPx?: number;
}

interface BarProps {
  state: LiveMatchState;
  match?: Match | null;
  phase: OverlayPhase;
  bpo: number;
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
export function contextLine(
  state: LiveMatchState,
  phase: OverlayPhase = "live",
): ReactNode[] {
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
    if (state.required_run_rate !== null && phase === "live") {
      parts.push(
        <span key="rrr">RRR {state.required_run_rate.toFixed(2)}</span>,
      );
    }
  } else if (state.current_run_rate !== null && phase === "live") {
    parts.push(<span key="crr">CRR {state.current_run_rate.toFixed(2)}</span>);
  }
  if (phase === "live" && (state.partnership_runs ?? 0) > 0) {
    parts.push(
      <span key="stand">
        Partnership {state.partnership_runs} ({state.partnership_balls ?? 0})
      </span>,
    );
  }
  return parts;
}

function Chip({ children }: { children: ReactNode }) {
  return (
    <span
      className={cn(
        "shrink-0 rounded px-2 py-0.5 text-sm font-semibold",
        OV.accent,
      )}
    >
      {children}
    </span>
  );
}

function StateChips({ state }: { state: LiveMatchState }) {
  return (
    <>
      {state.free_hit && (
        <span className="shrink-0 rounded bg-extra px-2 py-0.5 text-sm font-semibold text-extra-foreground">
          Free hit
        </span>
      )}
      {state.powerplay && <Chip>Powerplay</Chip>}
    </>
  );
}

function Dotted({ items }: { items: ReactNode[] }) {
  return (
    <>
      {items.map((c, i) => (
        <span key={i} className="flex min-w-0 items-center gap-5">
          {i > 0 && (
            <span aria-hidden="true" className={OV.panelMuted}>
              ·
            </span>
          )}
          {c}
        </span>
      ))}
    </>
  );
}

/** The score and overs block. */
function Score({
  state,
  bpo,
  size = "lg",
}: {
  state: LiveMatchState;
  bpo: number;
  size?: "lg" | "md";
}) {
  const limit = oversLimitOf(state);
  return (
    <div className="flex shrink-0 items-center gap-4 px-6">
      <span
        className={cn(
          "font-bold tabular-nums leading-none",
          size === "lg" ? "text-[3rem]" : "text-[2.25rem]",
        )}
      >
        {state.total_runs ?? 0}/{state.total_wickets ?? 0}
      </span>
      <span className="leading-tight">
        <span className="block text-[1.5rem] font-semibold tabular-nums">
          {oversText(state.total_balls, bpo)}
        </span>
        {limit !== null && (
          <span className={cn("block text-sm", OV.barMuted)}>
            of {limit} {limit === 1 ? "over" : "overs"}
          </span>
        )}
      </span>
    </div>
  );
}

/** What replaces the crease when no innings is in play. */
function phaseText(
  state: LiveMatchState,
  phase: OverlayPhase,
): string | null {
  if (phase === "break") {
    return `${codeOfSide(sidesOf(state).batting)} to bat next`;
  }
  if (phase === "done") return state.result_description ?? "Match finished";
  return null;
}

function BottomBar({
  state,
  match,
  phase,
  bpo,
  sponsor,
}: BarProps & { sponsor?: string | null }) {
  const side = battingSide(state);
  const { batting, bowling } = sidesOf(state);
  const logo =
    side === 1 ? state.team1_logo_url : side === 2 ? state.team2_logo_url : null;
  const bowlerEcon = economyText(state.bowler_runs, state.bowler_balls);
  const inPlay = phase === "live";
  const context = inPlay || phase === "break" ? contextLine(state, phase) : [];
  if (phase === "done") {
    context.push(
      <span key="sides">
        {codeOfSide(batting)} v {codeOfSide(bowling)}
      </span>,
    );
    const toss = tossLineOf(state, match);
    if (toss) context.push(<span key="toss">{toss}</span>);
  }
  return (
    <div className={cn("overflow-hidden rounded-lg", OV.shadow)}>
      <div className={cn("flex h-[5.5rem] items-stretch", OV.bar)}>
        <TeamBadge
          side={side}
          code={codeOfSide(batting)}
          logoUrl={logo}
          detail={inningsLabel(state.innings_number)}
          className="max-w-[16rem]"
        />
        <Score state={state} bpo={bpo} />
        {inPlay ? (
          <>
            <div
              aria-label="At the crease"
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
                    {oversText(state.bowler_balls, bpo)}
                    {bowlerEcon && ` · Econ ${bowlerEcon}`}
                  </span>
                </span>
              </div>
            )}
            <div
              className={cn(
                "flex min-w-0 flex-1 items-center justify-end border-l px-5",
                OV.line,
              )}
            >
              <BallTrack balls={overTokens(state)} slots={bpo} />
            </div>
          </>
        ) : (
          <div
            className={cn(
              "flex min-w-0 flex-1 items-center border-l px-6",
              OV.line,
            )}
          >
            <span className="truncate text-[1.75rem] font-medium">
              {phaseText(state, phase)}
            </span>
          </div>
        )}
      </div>
      <div
        className={cn(
          "flex h-10 items-center justify-between gap-6 px-5 text-base",
          OV.panel,
        )}
      >
        <div className="flex min-w-0 items-center gap-5 tabular-nums">
          {inPlay && <StateChips state={state} />}
          <Dotted items={context} />
        </div>
        <div
          className={cn(
            "flex min-w-0 items-center gap-5 tabular-nums",
            OV.panelMuted,
          )}
        >
          {inPlay && state.last_wicket?.name && (
            <span className="truncate">
              Last wicket {state.last_wicket.name} {state.last_wicket.runs} (
              {state.last_wicket.balls})
            </span>
          )}
          {sponsor && <span className="truncate">{sponsor}</span>}
        </div>
      </div>
    </div>
  );
}

function TopBar({ state, phase, bpo }: BarProps) {
  const side = battingSide(state);
  const inPlay = phase === "live";
  const chasing = state.target_runs !== null && state.runs_needed !== null;
  return (
    <div
      className={cn(
        "flex h-16 items-stretch overflow-hidden rounded-lg",
        OV.bar,
        OV.shadow,
      )}
    >
      <TeamBadge
        side={side}
        code={codeOfSide(sidesOf(state).batting)}
        className="max-w-[14rem]"
      />
      <div className="flex shrink-0 items-baseline gap-3 self-center px-5">
        <span className="text-[2.25rem] font-bold tabular-nums leading-none">
          {state.total_runs ?? 0}/{state.total_wickets ?? 0}
        </span>
        <span className={cn("text-lg tabular-nums", OV.barMuted)}>
          {oversText(state.total_balls, bpo)} ov
        </span>
      </div>
      {inPlay ? (
        <>
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
              "flex min-w-0 flex-1 items-center justify-end border-l px-4",
              OV.line,
            )}
          >
            <BallTrack balls={overTokens(state)} slots={bpo} size="sm" />
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
        </>
      ) : (
        <div
          className={cn(
            "flex min-w-0 flex-1 items-center border-l px-5",
            OV.line,
          )}
        >
          <span className="truncate text-lg font-medium">
            {phaseText(state, phase)}
          </span>
        </div>
      )}
    </div>
  );
}

function CompactCard({ state, phase, bpo }: BarProps) {
  const side = battingSide(state);
  const inPlay = phase === "live";
  const context = contextLine(state, phase);
  return (
    <div className={cn("w-[24rem] overflow-hidden rounded-lg", OV.shadow)}>
      <div className={cn("flex items-stretch", OV.bar)}>
        <TeamBadge
          side={side}
          code={codeOfSide(sidesOf(state).batting)}
          className="max-w-[10rem] py-3"
        />
        <div className="flex flex-1 items-baseline justify-end gap-3 px-4 py-3">
          <span className="text-[2.25rem] font-bold tabular-nums leading-none">
            {state.total_runs ?? 0}/{state.total_wickets ?? 0}
          </span>
          <span className={cn("text-lg tabular-nums", OV.barMuted)}>
            {oversText(state.total_balls, bpo)}
          </span>
        </div>
      </div>
      <div className={cn("space-y-1 px-4 py-2.5", OV.panel)}>
        {inPlay ? (
          <>
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
          </>
        ) : (
          <div className="truncate text-lg font-medium">
            {phaseText(state, phase)}
          </div>
        )}
        {context.length > 0 && (
          <div className={cn("truncate text-base tabular-nums", OV.panelMuted)}>
            {context[0]}
          </div>
        )}
        {inPlay && (
          <BallTrack
            balls={overTokens(state)}
            slots={bpo}
            size="sm"
            className="pt-1"
          />
        )}
      </div>
    </div>
  );
}

/**
 * Before the first ball (or a match called off before it): who plays, when
 * it starts and the toss once recorded.
 */
function PreMatchBar({ state, match, phase }: BarProps) {
  const startTime = useStartTime(match?.scheduled_at);
  const label =
    phase === "done"
      ? (state.result_description ?? "Match finished")
      : startTime
        ? `Starts ${startTime}`
        : "Coming up";
  const toss = tossLineOf(state, match);
  const source = state.tournament_name ?? state.title;
  const team1 = state.team1_name ?? match?.team1?.name ?? "";
  const team2 = state.team2_name ?? match?.team2?.name ?? "";
  return (
    <div
      className={cn(
        "flex min-h-[5.5rem] items-stretch overflow-hidden rounded-lg",
        OV.bar,
        OV.shadow,
      )}
    >
      <div
        className={cn(
          "flex max-w-[20rem] shrink-0 items-center px-6 text-[1.375rem] font-semibold",
          OV.accent,
        )}
      >
        <span className="truncate">{label}</span>
      </div>
      <div className="min-w-0 flex-1 px-6 py-3 leading-tight">
        {source && (
          <span className={cn("block truncate text-base", OV.barMuted)}>
            {source}
          </span>
        )}
        <span className="block truncate text-[2rem] font-semibold">
          {team1} <span className={OV.barMuted}>v</span> {team2}
        </span>
      </div>
      {(toss || state.venue) && (
        <div
          className={cn(
            "flex min-w-0 max-w-[26rem] items-center px-6 text-lg",
            OV.panel,
          )}
        >
          <span className="line-clamp-2">{toss ?? state.venue}</span>
        </div>
      )}
    </div>
  );
}

/**
 * The score bug. Rendered by `OverlayStage` (the OBS overlay and the
 * control room preview).
 */
export function ScoreBug({
  state,
  match,
  layout = "bottom",
  sponsor,
  marginOffsetPx = 0,
  theme,
  customColors,
}: ScoreBugProps) {
  const phase = overlayPhaseOf(state);
  const bpo = ballsPerOverOf(match);
  const pre = phase === "pre" || state.innings_number == null;
  const top = layout === "top";
  const offset = `${40 + marginOffsetPx}px`;
  const props: BarProps = { state, match, phase, bpo };
  return (
    <OverlayFrame
      state={state}
      theme={theme}
      customColors={customColors}
      data-testid="score-bug"
      data-layout={layout}
      data-phase={phase}
      style={top ? { top: "2rem" } : { bottom: offset }}
      className={cn(
        "pointer-events-none fixed z-20",
        layout === "compact" && !pre
          ? "left-12"
          : "left-1/2 w-[calc(100%-6rem)] max-w-[110rem] -translate-x-1/2",
      )}
    >
      {pre ? (
        <PreMatchBar {...props} />
      ) : top ? (
        <TopBar {...props} />
      ) : layout === "compact" ? (
        <CompactCard {...props} />
      ) : (
        <BottomBar {...props} sponsor={sponsor} />
      )}
    </OverlayFrame>
  );
}
