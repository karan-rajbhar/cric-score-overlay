"use client";

import { useEffect, useRef } from "react";
import type {
  ActiveLowerThirdStrap,
  LayoutMode,
  LiveMatchState,
  LowerThirdStrapType,
  OverlayTheme,
} from "./types";
import { THEME_ACCENT } from "./theme-accent";

interface LowerThirdStrapsProps {
  strap: ActiveLowerThirdStrap | null;
  state: LiveMatchState;
  layout: LayoutMode;
  onDismiss: () => void;
  theme?: OverlayTheme;
}

interface StrapText {
  badge: string;
  title: string;
  subtitle: string;
  detail: string;
}

const teamOf = (state: LiveMatchState, fallback: string) =>
  state.batting_team_short_name ?? state.batting_team_name ?? fallback;

/** Each strap type's text when the producer gives none, from the live score. */
const STRAP_DEFAULTS: Partial<
  Record<LowerThirdStrapType, (state: LiveMatchState) => StrapText>
> = {
  batsman: (state) => {
    const sr =
      state.striker_runs && state.striker_balls && state.striker_balls > 0
        ? ((state.striker_runs / state.striker_balls) * 100).toFixed(1)
        : "0.0";
    return {
      badge: "Batsman innings",
      title: state.striker_name || "Striker",
      subtitle: `${state.striker_runs ?? 0} runs off ${state.striker_balls ?? 0} balls`,
      detail: `Strike rate: ${sr} · Batting for ${teamOf(state, "Team")}`,
    };
  },
  bowler: (state) => {
    const balls = state.bowler_balls ?? 0;
    const econ =
      state.bowler_runs !== null && state.bowler_runs !== undefined && balls > 0
        ? (state.bowler_runs / (balls / 6)).toFixed(2)
        : "0.00";
    return {
      badge: "Current spell",
      title: state.current_bowler_name || "Bowler",
      subtitle: `${state.bowler_wickets ?? 0} wickets for ${state.bowler_runs ?? 0} runs`,
      detail: `Overs: ${Math.floor(balls / 6)}.${balls % 6} · Economy: ${econ}`,
    };
  },
  partnership: (state) => ({
    badge: "Partnership",
    title: "Current partnership",
    subtitle: `${state.partnership_runs ?? 0} runs off ${state.partnership_balls ?? 0} balls`,
    detail: `${state.striker_name ?? "Batter 1"}: ${state.striker_runs ?? 0}* · ${state.non_striker_name ?? "Batter 2"}: ${state.non_striker_runs ?? 0}*`,
  }),
  target: (state) => ({
    badge: "Chase equation",
    title: `Target: ${state.target_runs ?? "—"} runs`,
    subtitle:
      state.runs_needed !== null
        ? `Need ${state.runs_needed} runs from ${state.balls_remaining} deliveries`
        : "Chasing target",
    detail: `Required RR: ${state.required_run_rate ?? "—"} · Current RR: ${state.current_run_rate ?? "—"}`,
  }),
  powerplay: () => ({
    badge: "Powerplay 1",
    title: "Fielding restrictions",
    subtitle: "Overs 1 to 6",
    detail: "Maximum 2 fielders outside the 30-yard circle",
  }),
  drinks: (state) => ({
    badge: "Interval",
    title: "Drinks break",
    subtitle: "Scheduled drinks break",
    detail: `${teamOf(state, "Batting")}: ${state.total_runs ?? 0}/${state.total_wickets ?? 0}`,
  }),
  timeout: () => ({
    badge: "Strategic timeout",
    title: "Strategic timeout (2:30)",
    subtitle: "Teams in discussion",
    detail: "Play resumes shortly",
  }),
  rain_delay: () => ({
    badge: "Weather delay",
    title: "Rain stopped play",
    subtitle: "Covers are on",
    detail: "Awaiting an inspection by the umpires",
  }),
  innings_break: (state) => ({
    badge: "Interval",
    title: "Innings break",
    subtitle: `${state.bowling_team_name ?? "Bowling team"} to chase next`,
    detail: `Target: ${state.target_runs ?? (state.total_runs ? state.total_runs + 1 : "—")} runs to win`,
  }),
};

/** The strap's text: what the producer set, else its type's default. */
export function strapText(
  strap: ActiveLowerThirdStrap,
  state: LiveMatchState,
): StrapText {
  if (strap.type === "custom") {
    return {
      badge: strap.badge || "Match alert",
      title: strap.title || "Notice",
      subtitle: strap.customText || strap.subtitle || "",
      detail: strap.detail || "",
    };
  }
  const defaults = STRAP_DEFAULTS[strap.type]?.(state);
  return {
    badge: strap.badge ?? defaults?.badge ?? "Match notice",
    title: strap.title || defaults?.title || strap.title,
    subtitle: strap.subtitle || defaults?.subtitle || "",
    detail: strap.detail || defaults?.detail || "",
  };
}

const POSITION_CLASS: Partial<Record<LayoutMode, string>> = {
  top: "top-24 left-1/2 -translate-x-1/2",
  compact: "bottom-52 left-6",
};

export function LowerThirdStraps({
  strap,
  state,
  layout,
  onDismiss,
  theme = "starsports",
}: LowerThirdStrapsProps) {
  const onDismissRef = useRef(onDismiss);
  useEffect(() => {
    onDismissRef.current = onDismiss;
  });

  const strapId = strap?.id;
  const isInfinite = strap?.durationMs === -1 || strap?.durationMs === 0;
  const duration =
    strap?.durationMs && strap.durationMs > 0 ? strap.durationMs : 8000;

  useEffect(() => {
    if (!strapId || strap?.type === "none" || isInfinite) return;

    const timer = setTimeout(() => {
      onDismissRef.current();
    }, duration);

    return () => clearTimeout(timer);
  }, [strapId, strap?.type, duration, isInfinite]);

  if (!strap || strap.type === "none") return null;

  const { badge, title, subtitle, detail } = strapText(strap, state);

  // Positioning relative to the layout mode
  const positionClass =
    POSITION_CLASS[layout] ?? "bottom-32 left-1/2 -translate-x-1/2";

  const accent = THEME_ACCENT[theme] ?? THEME_ACCENT.starsports;
  const source = state.tournament_name ?? state.title;

  return (
    <div
      className={`pointer-events-none fixed z-30 w-full max-w-3xl select-none px-4 font-score ${positionClass} duration-300 animate-in fade-in slide-in-from-bottom-4 motion-reduce:animate-none`}
    >
      <div
        data-theme={theme}
        className="flex items-stretch overflow-hidden rounded-md border border-white/10 bg-[#0b0f17]/95 text-white shadow-[0_8px_24px_rgba(0,0,0,0.6)]"
      >
        <div
          aria-hidden="true"
          className="w-1.5 shrink-0"
          style={{ background: accent }}
        />

        <div className="flex shrink-0 flex-col justify-center border-r border-white/10 px-5 py-3 leading-tight">
          <span className="text-sm font-semibold text-white">{badge}</span>
          {source && (
            <span className="mt-0.5 max-w-[180px] truncate text-xs text-white/60">
              {source}
            </span>
          )}
        </div>

        <div className="flex min-w-0 flex-1 flex-col justify-center px-5 py-2.5">
          <h3 className="truncate text-xl font-semibold leading-tight text-white">
            {title}
          </h3>
          <p className="text-base font-medium tabular-nums leading-tight text-white/80">
            {subtitle}
          </p>
        </div>

        {detail && (
          <div className="flex shrink-0 items-center border-l border-white/10 bg-black/30 px-5 py-2.5 text-right">
            <p className="max-w-[240px] text-sm tabular-nums text-white/70">
              {detail}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
