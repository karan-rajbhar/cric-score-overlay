"use client";

import { useEffect, useRef } from "react";
import type {
  ActiveLowerThirdStrap,
  LayoutMode,
  LiveMatchState,
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

  // Derive dynamic details based on strap type if not explicitly supplied
  let badge = strap.badge ?? "Match notice";
  let title = strap.title;
  let subtitle = strap.subtitle ?? "";
  let detail = strap.detail ?? "";

  switch (strap.type) {
    case "batsman": {
      badge = strap.badge ?? "Batsman innings";
      title = title || state.striker_name || "Striker";
      const sr =
        state.striker_runs && state.striker_balls && state.striker_balls > 0
          ? ((state.striker_runs / state.striker_balls) * 100).toFixed(1)
          : "0.0";
      subtitle =
        subtitle ||
        `${state.striker_runs ?? 0} runs off ${state.striker_balls ?? 0} balls`;
      detail =
        detail ||
        `Strike rate: ${sr} · Batting for ${state.batting_team_short_name ?? state.batting_team_name ?? "Team"}`;
      break;
    }
    case "bowler": {
      badge = strap.badge ?? "Current spell";
      title = title || state.current_bowler_name || "Bowler";
      const balls = state.bowler_balls ?? 0;
      const oversFormatted = `${Math.floor(balls / 6)}.${balls % 6}`;
      const econ =
        state.bowler_runs !== null &&
        state.bowler_runs !== undefined &&
        balls > 0
          ? (state.bowler_runs / (balls / 6)).toFixed(2)
          : "0.00";
      subtitle =
        subtitle ||
        `${state.bowler_wickets ?? 0} wickets for ${state.bowler_runs ?? 0} runs`;
      detail = detail || `Overs: ${oversFormatted} · Economy: ${econ}`;
      break;
    }
    case "partnership": {
      badge = strap.badge ?? "Partnership";
      title = title || "Current partnership";
      subtitle =
        subtitle ||
        `${state.partnership_runs ?? 0} runs off ${state.partnership_balls ?? 0} balls`;
      detail =
        detail ||
        `${state.striker_name ?? "Batter 1"}: ${state.striker_runs ?? 0}* · ${state.non_striker_name ?? "Batter 2"}: ${state.non_striker_runs ?? 0}*`;
      break;
    }
    case "target": {
      badge = strap.badge ?? "Chase equation";
      title = title || `Target: ${state.target_runs ?? "—"} runs`;
      subtitle =
        subtitle ||
        (state.runs_needed !== null
          ? `Need ${state.runs_needed} runs from ${state.balls_remaining} deliveries`
          : "Chasing target");
      detail =
        detail ||
        `Required RR: ${state.required_run_rate ?? "—"} · Current RR: ${state.current_run_rate ?? "—"}`;
      break;
    }
    case "powerplay": {
      badge = strap.badge ?? "Powerplay 1";
      title = title || "Fielding restrictions";
      subtitle = subtitle || "Overs 1 to 6";
      detail = detail || "Maximum 2 fielders outside the 30-yard circle";
      break;
    }
    case "drinks": {
      badge = strap.badge ?? "Interval";
      title = title || "Drinks break";
      subtitle = subtitle || "Scheduled drinks break";
      detail =
        detail ||
        `${state.batting_team_short_name ?? state.batting_team_name ?? "Batting"}: ${state.total_runs ?? 0}/${state.total_wickets ?? 0}`;
      break;
    }
    case "timeout": {
      badge = strap.badge ?? "Strategic timeout";
      title = title || "Strategic timeout (2:30)";
      subtitle = subtitle || "Teams in discussion";
      detail = detail || "Play resumes shortly";
      break;
    }
    case "rain_delay": {
      badge = strap.badge ?? "Weather delay";
      title = title || "Rain stopped play";
      subtitle = subtitle || "Covers are on";
      detail = detail || "Awaiting an inspection by the umpires";
      break;
    }
    case "innings_break": {
      badge = strap.badge ?? "Interval";
      title = title || "Innings break";
      subtitle =
        subtitle ||
        `${state.bowling_team_name ?? "Bowling team"} to chase next`;
      detail =
        detail ||
        `Target: ${state.target_runs ?? (state.total_runs ? state.total_runs + 1 : "—")} runs to win`;
      break;
    }
    case "custom": {
      badge = strap.badge || "Match alert";
      title = strap.title || "Notice";
      subtitle = strap.customText || strap.subtitle || "";
      detail = strap.detail || "";
      break;
    }
  }

  // Positioning relative to the layout mode
  const positionClass =
    layout === "top"
      ? "top-24 left-1/2 -translate-x-1/2"
      : layout === "compact"
        ? "bottom-52 left-6"
        : "bottom-32 left-1/2 -translate-x-1/2";

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
