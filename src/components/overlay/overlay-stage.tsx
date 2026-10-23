"use client";

/**
 * Everything the broadcast overlay draws on its 1920x1080 transparent
 * canvas: the score bug (or the graphics-suite view / presentation card
 * the producer put up), lower thirds, event cards, the corner watermark
 * and the ticker. Nothing here is a control: what is drawn goes on air.
 *
 * Rendered by the OBS overlay page and, scaled down, by the control room's
 * preview (positions are `fixed`; inside the preview's transformed canvas
 * that means the canvas, not the window).
 */

import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { BallChip, THEME_STYLES } from "~/app/overlay/[matchId]/theme-styles";
import type { Match } from "~/lib/match-types";
import type { OverlayScene } from "~/lib/overlay-state";
import { BroadcastSuiteOverlay } from "./broadcast-suite-overlay";
import { CornerWatermark } from "./corner-watermark";
import { EventStings } from "./event-stings";
import { LowerThirdStraps } from "./lower-third-straps";
import { NewsTicker } from "./news-ticker";
import { paletteOf } from "./overlay-themes";
import { PresentationCards } from "./presentation-cards";
import type { LiveMatchState } from "./types";
import type { OverlayLayers } from "./use-overlay-state";

/** "13.4": completed overs and balls of the one in progress. */
function oversText(balls: number | null | undefined, bpo: number): string {
  if (!balls) return "0.0";
  return `${Math.floor(balls / bpo)}.${balls % bpo}`;
}

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

interface Side {
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

/** Short code if the team has one, else its name. */
const codeOf = (side: Side, fallback: string) =>
  side.short || side.name || fallback;

/** Overs per innings shown after the score ("/ 20 ov"; 1 in a super over). */
function oversLimitOf(state: LiveMatchState): number | null {
  if ((state.innings_number ?? 1) >= 3) return 1;
  return state.overs_per_innings ?? null;
}

/** Legal deliveries per over (live_state does not carry it; the match does). */
const ballsPerOverOf = (match: Match | null) =>
  match?.balls_per_over && match.balls_per_over > 0 ? match.balls_per_over : 6;

function strikeRate(runs: number | null, balls: number | null): string | null {
  return runs !== null && balls ? ((runs / balls) * 100).toFixed(1) : null;
}

function economy(state: LiveMatchState, bpo: number): string | null {
  const balls = state.bowler_balls ?? 0;
  if (!balls || state.bowler_runs === null) return null;
  return ((state.bowler_runs * bpo) / balls).toFixed(1);
}

/** "Riverside won the toss and chose to bat", when both are known. */
function tossLineOf(state: LiveMatchState, match: Match | null): string | null {
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

const RIBBON_SLIDE_MS = 8000;

/** One of `slides`, changing every 8 s while there is more than one. */
function RotatingRibbon({ slides }: { slides: ReactNode[] }) {
  const [index, setIndex] = useState(0);
  const count = slides.length;
  useEffect(() => {
    if (count <= 1) return;
    const timer = setInterval(
      () => setIndex((i) => (i + 1) % count),
      RIBBON_SLIDE_MS,
    );
    return () => clearInterval(timer);
  }, [count]);
  if (!count) return null;
  const at = index % count;
  return (
    <div
      key={at}
      className="flex min-w-0 items-center justify-between gap-4 duration-300 animate-in fade-in motion-reduce:animate-none"
    >
      {slides[at]}
    </div>
  );
}

const Sep = () => <span className="text-white/30">|</span>;

function ribbonSlides(
  state: LiveMatchState,
  match: Match | null,
  phase: OverlayPhase,
): ReactNode[] {
  if (phase === "done") {
    // The result is on the bar itself; the toss, if known, here.
    const toss = tossLineOf(state, match);
    return toss
      ? [
          <span key="toss" className="truncate text-white/80">
            {toss}
          </span>,
        ]
      : [];
  }
  const slides: ReactNode[] = [];
  const chasing = state.runs_needed !== null && state.balls_remaining !== null;
  if (chasing) {
    slides.push(
      <div key="chase" className="flex min-w-0 items-center gap-3">
        {state.target_runs !== null && (
          <span className="rounded bg-amber-400 px-2 py-0.5 text-black">
            Target {state.target_runs}
          </span>
        )}
        <span className="truncate text-white">
          Need {state.runs_needed} from {state.balls_remaining}{" "}
          {state.balls_remaining === 1 ? "ball" : "balls"}
        </span>
        {state.required_run_rate !== null && (
          <>
            <Sep />
            <span className="text-amber-300">
              Required rate {state.required_run_rate}
            </span>
          </>
        )}
      </div>,
    );
  } else if (phase === "break") {
    slides.push(
      <span key="break" className="text-white">
        Innings break
      </span>,
    );
  }
  if (
    phase === "live" &&
    state.partnership_runs !== null &&
    state.partnership_balls
  ) {
    slides.push(
      <div key="stand" className="flex min-w-0 items-center gap-3">
        <span className="text-white/70">Partnership</span>
        <span className="tabular-nums text-white">
          {state.partnership_runs} ({state.partnership_balls})
        </span>
        {state.current_run_rate !== null && (
          <>
            <Sep />
            <span className="text-white/70">Run rate</span>
            <span className="tabular-nums text-white">
              {state.current_run_rate}
            </span>
          </>
        )}
      </div>,
    );
  }
  const toss = tossLineOf(state, match);
  if (toss) {
    slides.push(
      <span key="toss" className="truncate text-white/80">
        {toss}
      </span>,
    );
  }
  if (!slides.length && state.venue) {
    slides.push(
      <span key="venue" className="truncate text-white/80">
        {state.venue}
      </span>,
    );
  }
  return slides;
}

interface BugProps {
  state: LiveMatchState;
  match: Match | null;
  scene: OverlayScene;
  phase: OverlayPhase;
}

const paletteFor = (scene: OverlayScene) =>
  THEME_STYLES[paletteOf(scene.theme)] ?? THEME_STYLES.starsports;

/** The default lower-third score bar. */
function BottomBug({ state, match, scene, phase }: BugProps) {
  const theme = paletteFor(scene);
  const { batting, bowling } = sidesOf(state);
  const bpo = ballsPerOverOf(match);
  const limit = oversLimitOf(state);
  const balls = (state.this_over_balls ?? "").split(" ").filter(Boolean);
  const sr = strikeRate(state.striker_runs, state.striker_balls);
  const econ = economy(state, bpo);
  const inPlay = phase === "live";
  const source = state.tournament_name ?? state.title;
  const slides = ribbonSlides(state, match, phase);

  return (
    <div
      style={{ bottom: `${20 + scene.marginOffsetPx}px` }}
      className="absolute left-1/2 w-[1100px] max-w-[calc(100%-48px)] -translate-x-1/2 font-score"
    >
      {/* Header strip: competition, sides, venue, run rate */}
      <div className="flex min-w-0 items-center justify-between gap-4 border-x border-t border-white/20 bg-black/95 px-4 py-1 text-sm font-medium text-slate-300">
        <div className="flex min-w-0 items-center gap-2.5">
          {source && (
            <span className="max-w-[420px] truncate font-semibold text-amber-400">
              {source}
            </span>
          )}
          {source && <Sep />}
          <span className="truncate text-white/80">
            {codeOf(batting, "Batting")} v {codeOf(bowling, "Bowling")}
            {state.venue ? ` · ${state.venue}` : ""}
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {scene.sponsor && (
            <span className="max-w-[260px] truncate rounded border border-white/15 bg-white/5 px-2 py-0.5 text-white/80">
              {scene.sponsor}
            </span>
          )}
          {state.current_run_rate !== null && phase !== "pre" && (
            <span className="rounded border border-white/15 bg-white/5 px-2 py-0.5 tabular-nums text-white/80">
              Run rate {state.current_run_rate}
            </span>
          )}
        </div>
      </div>

      {/* Main bar */}
      <div
        className={`relative flex min-w-0 items-stretch border border-white/20 ${theme.mainBarBg} ${theme.outerBorder}`}
      >
        <div
          className={`flex max-w-[260px] shrink-0 items-center gap-3 px-5 py-2 ${theme.teamBadge}`}
        >
          {batting.logo && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={batting.logo}
              alt=""
              className="h-9 w-9 shrink-0 object-contain"
            />
          )}
          <div className="min-w-0 text-left leading-none">
            <span className="block truncate text-3xl font-semibold">
              {codeOf(batting, "Batting")}
            </span>
            <span className="mt-1 block text-sm font-medium opacity-90">
              {inningsLabel(state.innings_number)}
            </span>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-3 border-r border-white/15 bg-black/40 px-4 py-1.5">
          <span className="font-score text-5xl font-bold tabular-nums leading-none text-white">
            {state.total_runs ?? 0}
            <span className="text-3xl text-amber-400">
              /{state.total_wickets ?? 0}
            </span>
          </span>
          <span className="border-l border-white/10 pl-3 text-right leading-tight">
            <span className="block text-xl font-bold tabular-nums text-white">
              {oversText(state.total_balls, bpo)}
            </span>
            {limit !== null && (
              <span className="block text-sm font-medium tabular-nums text-slate-400">
                of {limit} {limit === 1 ? "over" : "overs"}
              </span>
            )}
          </span>
        </div>

        {inPlay ? (
          <>
            <div className="flex min-w-0 items-center divide-x divide-white/10 border-r border-white/15">
              {state.striker_name && (
                <div className="min-w-0 max-w-[230px] px-4 py-1.5 leading-tight">
                  <div className="flex min-w-0 items-center gap-1.5">
                    <span
                      aria-hidden="true"
                      className={`text-sm ${theme.strikeChevron}`}
                    >
                      ▶
                    </span>
                    <span className="truncate text-lg font-semibold text-white">
                      {state.striker_name}
                    </span>
                  </div>
                  <div className="mt-0.5 flex items-baseline gap-2">
                    <span className="text-xl font-bold tabular-nums text-amber-300">
                      {state.striker_runs ?? 0}*
                    </span>
                    <span className="text-sm tabular-nums text-slate-400">
                      ({state.striker_balls ?? 0})
                    </span>
                    {sr && (
                      <span className="text-sm tabular-nums text-white/60">
                        SR {sr}
                      </span>
                    )}
                  </div>
                </div>
              )}
              {state.non_striker_name && (
                <div className="min-w-0 max-w-[200px] px-4 py-1.5 leading-tight">
                  <span className="block truncate text-lg font-medium text-slate-300">
                    {state.non_striker_name}
                  </span>
                  <div className="mt-0.5 flex items-baseline gap-2">
                    <span className="text-xl font-bold tabular-nums text-slate-200">
                      {state.non_striker_runs ?? 0}
                    </span>
                    <span className="text-sm tabular-nums text-slate-400">
                      ({state.non_striker_balls ?? 0})
                    </span>
                  </div>
                </div>
              )}
            </div>

            {state.current_bowler_name && (
              <div className="min-w-0 max-w-[230px] border-r border-white/15 px-4 py-1.5 leading-tight">
                <span className="block truncate text-lg font-semibold text-white">
                  {state.current_bowler_name}
                </span>
                <div className="mt-0.5 flex items-baseline gap-2">
                  <span className="text-xl font-bold tabular-nums text-sky-300">
                    {state.bowler_wickets ?? 0}-{state.bowler_runs ?? 0}
                  </span>
                  <span className="text-sm tabular-nums text-slate-400">
                    ({oversText(state.bowler_balls, bpo)})
                  </span>
                  {econ && (
                    <span className="text-sm tabular-nums text-white/60">
                      Econ {econ}
                    </span>
                  )}
                </div>
              </div>
            )}

            <div
              aria-label="This over"
              className="flex min-w-0 flex-1 items-center justify-end gap-1 px-4 py-1.5"
            >
              {balls.length > 0 ? (
                <>
                  {balls.map((b, i) => (
                    <BallChip key={i} label={b} />
                  ))}
                  {Array.from({ length: Math.max(0, bpo - balls.length) }).map(
                    (_, i) => (
                      <span
                        key={`empty-${i}`}
                        className="inline-flex h-8 w-8 rounded border border-dashed border-white/20 bg-white/5"
                      />
                    ),
                  )}
                </>
              ) : (
                <span className="text-sm text-slate-400">New over</span>
              )}
            </div>
          </>
        ) : (
          <div className="flex min-w-0 flex-1 items-center px-5 py-1.5">
            <span className="truncate text-xl font-medium text-white/80">
              {phase === "break"
                ? `${codeOf(batting, "Batting")} to bat next`
                : (state.result_description ?? "Match finished")}
            </span>
          </div>
        )}
      </div>

      {slides.length > 0 && (
        <div
          className={`overflow-hidden px-4 py-1.5 text-base font-medium ${theme.subBarBg}`}
        >
          <RotatingRibbon slides={slides} />
        </div>
      )}
    </div>
  );
}

/** A slim bar across the top of the frame. */
function TopBug({ state, match, scene, phase }: BugProps) {
  const theme = paletteFor(scene);
  const { batting } = sidesOf(state);
  const bpo = ballsPerOverOf(match);
  const balls = (state.this_over_balls ?? "").split(" ").filter(Boolean);
  const inPlay = phase === "live";
  return (
    <div className="absolute left-1/2 top-6 w-[1100px] max-w-[calc(100%-48px)] -translate-x-1/2 font-score">
      <div
        className={`flex min-w-0 items-stretch border border-white/20 ${theme.mainBarBg} ${theme.outerBorder}`}
      >
        <div
          className={`flex max-w-[240px] shrink-0 items-center px-5 py-2 ${theme.teamBadge}`}
        >
          <span className="truncate text-2xl font-semibold">
            {codeOf(batting, "Batting")}
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-3 border-r border-white/15 bg-black/40 px-4">
          <span className="text-3xl font-bold tabular-nums text-white">
            {state.total_runs ?? 0}/{state.total_wickets ?? 0}
          </span>
          <span className="text-base font-medium tabular-nums text-slate-300">
            ({oversText(state.total_balls, bpo)} ov)
          </span>
        </div>
        {inPlay && state.striker_name && (
          <div className="flex min-w-0 max-w-[260px] items-center gap-2 border-r border-white/15 px-4">
            <span
              aria-hidden="true"
              className={`text-sm ${theme.strikeChevron}`}
            >
              ▶
            </span>
            <span className="truncate text-lg font-semibold text-white">
              {state.striker_name}
            </span>
            <span className="text-lg font-bold tabular-nums text-amber-300">
              {state.striker_runs ?? 0}*
            </span>
          </div>
        )}
        {inPlay && state.current_bowler_name && (
          <div className="flex min-w-0 max-w-[260px] items-center gap-2 border-r border-white/15 px-4">
            <span className="truncate text-lg font-medium text-slate-200">
              {state.current_bowler_name}
            </span>
            <span className="text-lg font-bold tabular-nums text-sky-300">
              {state.bowler_wickets ?? 0}-{state.bowler_runs ?? 0}
            </span>
          </div>
        )}
        <div className="flex min-w-0 flex-1 items-center justify-end gap-1 px-4 py-2">
          {inPlay ? (
            balls.slice(-bpo * 2).map((b, i) => <BallChip key={i} label={b} />)
          ) : (
            <span className="truncate text-base text-white/80">
              {phase === "done"
                ? (state.result_description ?? "Match finished")
                : "Innings break"}
            </span>
          )}
        </div>
        {inPlay &&
          state.runs_needed !== null &&
          state.balls_remaining !== null && (
            <div className="flex shrink-0 items-center border-l border-white/15 bg-black/40 px-4">
              <span className="text-base font-semibold tabular-nums text-amber-300">
                Need {state.runs_needed} off {state.balls_remaining}
              </span>
            </div>
          )}
      </div>
    </div>
  );
}

/** A small corner card. */
function CompactBug({ state, match, scene, phase }: BugProps) {
  const theme = paletteFor(scene);
  const { batting } = sidesOf(state);
  const bpo = ballsPerOverOf(match);
  const limit = oversLimitOf(state);
  const balls = (state.this_over_balls ?? "").split(" ").filter(Boolean);
  const inPlay = phase === "live";
  const source = state.tournament_name ?? state.title;
  return (
    <div
      style={{ bottom: `${24 + scene.marginOffsetPx}px` }}
      className="absolute left-6 w-[400px] font-score"
    >
      <div
        className={`overflow-hidden border border-white/20 ${theme.mainBarBg} ${theme.outerBorder}`}
      >
        {source && (
          <div className="border-b border-white/15 bg-black/80 px-3 py-1.5">
            <span className="block truncate text-sm font-semibold text-amber-400">
              {source}
            </span>
          </div>
        )}
        <div className="flex items-center justify-between gap-3 p-3.5">
          <div className="flex min-w-0 items-center gap-3">
            <div
              className={`max-w-[150px] truncate rounded px-3 py-1.5 text-2xl font-semibold ${theme.teamBadge}`}
            >
              {codeOf(batting, "Batting")}
            </div>
            <div>
              <p className="text-3xl font-bold tabular-nums leading-none text-white">
                {state.total_runs ?? 0}/{state.total_wickets ?? 0}
              </p>
              <span className="mt-1 block text-sm tabular-nums text-slate-300">
                {oversText(state.total_balls, bpo)}
                {limit !== null ? ` of ${limit} ov` : " ov"}
              </span>
            </div>
          </div>
          {inPlay && state.runs_needed !== null && (
            <div className="shrink-0 text-right">
              <span className="block text-sm text-slate-400">
                Target {state.target_runs}
              </span>
              <span className="block text-base font-semibold tabular-nums text-amber-300">
                Need {state.runs_needed}
              </span>
            </div>
          )}
        </div>
        {inPlay ? (
          <div className="flex items-center justify-between gap-3 border-t border-white/10 bg-black/50 px-3 py-2 text-base">
            <span className="min-w-0 truncate font-semibold text-white">
              {state.striker_name
                ? `${state.striker_name} ${state.striker_runs ?? 0}*`
                : ""}
            </span>
            <span className="min-w-0 truncate tabular-nums text-sky-300">
              {state.current_bowler_name
                ? `${state.current_bowler_name} ${state.bowler_wickets ?? 0}-${state.bowler_runs ?? 0}`
                : ""}
            </span>
          </div>
        ) : (
          <div className="border-t border-white/10 bg-black/50 px-3 py-2 text-base text-white/80">
            <span className="block truncate">
              {phase === "done"
                ? (state.result_description ?? "Match finished")
                : "Innings break"}
            </span>
          </div>
        )}
        {inPlay && balls.length > 0 && (
          <div className="flex flex-wrap items-center gap-1 border-t border-white/10 bg-black/70 px-3 py-1.5">
            {balls.map((b, i) => (
              <BallChip key={i} label={b} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Before the first ball: who is playing, and when or how the toss went
 * (also a match called off before it started).
 */
function PreMatchBar({ state, match, scene, phase }: BugProps) {
  const theme = paletteFor(scene);
  const startTime = useStartTime(match?.scheduled_at);
  const label =
    phase === "done"
      ? (state.result_description ?? "Match finished")
      : startTime
        ? `Starts ${startTime}`
        : "Coming up";
  const toss = tossLineOf(state, match);
  const source = state.tournament_name ?? state.title;
  const team1 = state.team1_name ?? match?.team1?.name ?? "Team 1";
  const team2 = state.team2_name ?? match?.team2?.name ?? "Team 2";
  const top = scene.layout === "top";
  return (
    <div
      style={top ? undefined : { bottom: `${20 + scene.marginOffsetPx}px` }}
      className={`absolute left-1/2 w-[1000px] max-w-[calc(100%-48px)] -translate-x-1/2 font-score ${
        top ? "top-6" : ""
      }`}
    >
      <div
        className={`flex min-w-0 items-stretch border border-white/20 ${theme.mainBarBg} ${theme.outerBorder}`}
      >
        <div
          className={`flex max-w-[320px] shrink-0 items-center px-5 py-3 ${theme.teamBadge}`}
        >
          <span className="truncate text-lg font-semibold">{label}</span>
        </div>
        <div className="min-w-0 flex-1 px-5 py-2 leading-tight">
          {source && (
            <span className="block truncate text-sm font-medium text-amber-400">
              {source}
            </span>
          )}
          <span className="block truncate text-3xl font-semibold text-white">
            {team1} <span className="text-white/50">v</span> {team2}
          </span>
        </div>
        {(toss || state.venue) && (
          <div className="flex min-w-0 max-w-[380px] items-center border-l border-white/15 bg-black/40 px-5">
            <span className="line-clamp-2 text-base text-white/80">
              {toss ?? state.venue}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

/** `list` starting at item `from` (wrapping round). */
function rotate<T>(list: T[], from: number): T[] {
  if (list.length < 2) return list;
  const at = ((from % list.length) + list.length) % list.length;
  return [...list.slice(at), ...list.slice(0, at)];
}

export interface OverlayStageProps {
  /** Latest score; null while there is none to show. */
  state: LiveMatchState | null;
  match: Match | null;
  layers: OverlayLayers;
  /** The link names no match: a small note instead of a blank source. */
  notFound?: boolean;
  /** 1920x1080 action / title safe guides (setting up only). */
  showSafeZone?: boolean;
  onDismissSting: () => void;
  onDismissStrap: () => void;
}

export function OverlayStage({
  state,
  match,
  layers,
  notFound = false,
  showSafeZone = false,
  onDismissSting,
  onDismissStrap,
}: OverlayStageProps) {
  const { scene } = layers;
  const palette = paletteOf(scene.theme);
  const style = {
    "--overlay-custom-primary": scene.customColors.primary,
    "--overlay-custom-accent": scene.customColors.accent,
  } as CSSProperties;

  if (!state) {
    return (
      <div className="pointer-events-none fixed inset-0 select-none bg-transparent font-sans">
        {notFound && (
          <p className="absolute bottom-6 left-6 rounded-md bg-black/80 px-4 py-2 text-base text-white">
            This overlay link does not match a CricScore match. Copy it again
            from the match page.
          </p>
        )}
      </div>
    );
  }

  const phase = overlayPhaseOf(state);
  const bugProps: BugProps = { state, match, scene, phase };
  // A full-screen card or graphics-suite view replaces the bug.
  const suite = scene.view !== null;
  // Lower thirds sit just above the score bug (the strap's own offset is
  // 128px for the bottom layout, 208px for the compact one).
  const bugShown = scene.showBug && !suite && scene.layout !== "top";
  const strapLift = !bugShown
    ? 0
    : scene.layout === "compact"
      ? 60 + scene.marginOffsetPx
      : 50 + scene.marginOffsetPx;

  return (
    <div
      style={style}
      data-phase={phase}
      className="pointer-events-none fixed inset-0 select-none overflow-hidden bg-transparent font-sans"
    >
      <EventStings
        sting={layers.sting}
        theme={palette}
        onDismiss={onDismissSting}
      />

      <PresentationCards
        card={layers.card}
        state={state}
        match={match}
        theme={palette}
      />

      {/* Lifted clear of the score bug: a transformed box is where its
          fixed-position strap is placed. */}
      <div
        className="pointer-events-none fixed inset-0"
        style={{ transform: `translateY(-${strapLift}px)` }}
      >
        <LowerThirdStraps
          strap={layers.strap}
          state={state}
          layout={scene.layout}
          theme={palette}
          onDismiss={onDismissStrap}
        />
      </div>

      {/* Only with sponsors to show: the bug already names the event. */}
      <CornerWatermark
        // "Next sponsor" starts the rotation over from the next one.
        key={scene.sponsorIndex}
        title={state.tournament_name ?? state.title}
        sponsors={rotate(scene.sponsors, scene.sponsorIndex)}
        visible={scene.sponsors.length > 0}
      />

      <NewsTicker text={scene.tickerText} visible={scene.tickerVisible} />

      {showSafeZone && (
        <div
          className="pointer-events-none fixed inset-0 z-50"
          role="img"
          aria-label="Safe-zone guides: action safe 90 percent, title safe 80 percent"
        >
          <div className="absolute inset-[5%] border border-dashed border-amber-400/60 p-2 text-sm text-amber-300">
            Action safe (90%)
          </div>
          <div className="absolute inset-[10%] border border-dashed border-sky-400/60 p-2 text-sm text-sky-300">
            Title safe (80%)
          </div>
        </div>
      )}

      {scene.showBug &&
        (suite ? (
          <BroadcastSuiteOverlay
            state={state}
            match={match}
            activeView={scene.view!}
            theme={palette}
          />
        ) : phase === "pre" || state.innings_number == null ? (
          <PreMatchBar {...bugProps} />
        ) : scene.layout === "top" ? (
          <TopBug {...bugProps} />
        ) : scene.layout === "compact" ? (
          <CompactBug {...bugProps} />
        ) : (
          <BottomBug {...bugProps} />
        ))}
    </div>
  );
}
