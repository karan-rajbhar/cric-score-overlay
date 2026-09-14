"use client";

import { useEffect } from "react";
import type {
  ActiveLowerThirdStrap,
  LayoutMode,
  LiveMatchState,
  OverlayTheme,
} from "./types";
import {
  User,
  Activity,
  Users,
  Target,
  Shield,
  Coffee,
  Clock,
  CloudRain,
  Hourglass,
  BellRing,
} from "lucide-react";

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
  useEffect(() => {
    if (!strap || strap.type === "none") return;

    const duration =
      strap.durationMs && strap.durationMs > 0 ? strap.durationMs : 8000;
    const timer = setTimeout(() => {
      onDismiss();
    }, duration);

    return () => clearTimeout(timer);
  }, [strap, onDismiss]);

  if (!strap || strap.type === "none") return null;

  // Derive dynamic details based on strap type if not explicitly supplied
  let icon = <BellRing className="h-5 w-5 text-amber-400" />;
  let badge = strap.badge ?? "MATCH NOTICE";
  let title = strap.title;
  let subtitle = strap.subtitle ?? "";
  let detail = strap.detail ?? "";
  let badgeTheme = "bg-gradient-to-r from-amber-600 to-amber-700 text-black";
  let borderColor = "border-amber-400/50";
  let accentColor = "text-amber-300";

  switch (strap.type) {
    case "batsman": {
      icon = <User className="h-5 w-5 text-sky-300" />;
      badge = strap.badge ?? "BATSMAN INNINGS";
      badgeTheme = "bg-gradient-to-r from-sky-600 to-blue-700 text-white";
      borderColor = "border-sky-400/50";
      accentColor = "text-sky-300";
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
        `Strike Rate: ${sr} · Batting for ${state.batting_team_short_name ?? state.batting_team_name ?? "Team"}`;
      break;
    }
    case "bowler": {
      icon = <Activity className="h-5 w-5 text-emerald-300" />;
      badge = strap.badge ?? "CURRENT SPELL";
      badgeTheme = "bg-gradient-to-r from-emerald-600 to-teal-700 text-white";
      borderColor = "border-emerald-400/50";
      accentColor = "text-emerald-300";
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
      detail = detail || `Overs: ${oversFormatted} · Economy: ${econ} rpo`;
      break;
    }
    case "partnership": {
      icon = <Users className="h-5 w-5 text-purple-300" />;
      badge = strap.badge ?? "PARTNERSHIP";
      badgeTheme = "bg-gradient-to-r from-purple-600 to-indigo-700 text-white";
      borderColor = "border-purple-400/50";
      accentColor = "text-purple-300";
      title = title || "CURRENT PARTNERSHIP";
      subtitle =
        subtitle ||
        `${state.partnership_runs ?? 0} Runs off ${state.partnership_balls ?? 0} Balls`;
      detail =
        detail ||
        `${state.striker_name ?? "Batter 1"}: ${state.striker_runs ?? 0}* · ${state.non_striker_name ?? "Batter 2"}: ${state.non_striker_runs ?? 0}*`;
      break;
    }
    case "target": {
      icon = <Target className="h-5 w-5 text-amber-300" />;
      badge = strap.badge ?? "CHASE EQUATION";
      badgeTheme = "bg-gradient-to-r from-amber-500 to-yellow-600 text-black";
      borderColor = "border-amber-400/50";
      accentColor = "text-amber-300";
      title = title || `TARGET: ${state.target_runs ?? "—"} RUNS`;
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
      icon = <Shield className="h-5 w-5 text-yellow-300" />;
      badge = strap.badge ?? "POWERPLAY 1";
      badgeTheme = "bg-gradient-to-r from-yellow-500 to-amber-600 text-black";
      borderColor = "border-yellow-400/50";
      accentColor = "text-yellow-300";
      title = title || "MANDATORY FIELD RESTRICTIONS";
      subtitle = subtitle || "Overs 1 to 6 Active";
      detail =
        detail || "Maximum 2 fielders permitted outside the 30-yard inner ring";
      break;
    }
    case "drinks": {
      icon = <Coffee className="h-5 w-5 text-teal-300" />;
      badge = strap.badge ?? "OFFICIAL INTERVAL";
      badgeTheme = "bg-gradient-to-r from-teal-600 to-cyan-700 text-white";
      borderColor = "border-teal-400/50";
      accentColor = "text-teal-300";
      title = title || "DRINKS BREAK";
      subtitle = subtitle || "Players taking scheduled hydration break";
      detail =
        detail ||
        `${state.batting_team_short_name ?? state.batting_team_name ?? "Batting"}: ${state.total_runs ?? 0}/${state.total_wickets ?? 0}`;
      break;
    }
    case "timeout": {
      icon = <Clock className="h-5 w-5 text-indigo-300" />;
      badge = strap.badge ?? "STRATEGIC TIMEOUT";
      badgeTheme = "bg-gradient-to-r from-indigo-600 to-blue-800 text-white";
      borderColor = "border-indigo-400/50";
      accentColor = "text-indigo-300";
      title = title || "STRATEGIC TIMEOUT (2:30)";
      subtitle = subtitle || "Tactical team discussion in progress";
      detail = detail || "Play resumes shortly";
      break;
    }
    case "rain_delay": {
      icon = <CloudRain className="h-5 w-5 text-sky-300" />;
      badge = strap.badge ?? "WEATHER DELAY";
      badgeTheme = "bg-gradient-to-r from-sky-700 to-blue-900 text-white";
      borderColor = "border-sky-400/50";
      accentColor = "text-sky-300";
      title = title || "RAIN STOPPED PLAY";
      subtitle = subtitle || "Pitch covers are currently on the ground";
      detail = detail || "Waiting for weather clearance and umpire inspection";
      break;
    }
    case "innings_break": {
      icon = <Hourglass className="h-5 w-5 text-orange-300" />;
      badge = strap.badge ?? "MID-MATCH INTERVAL";
      badgeTheme = "bg-gradient-to-r from-orange-600 to-red-700 text-white";
      borderColor = "border-orange-400/50";
      accentColor = "text-orange-300";
      title = title || "INNINGS BREAK";
      subtitle =
        subtitle ||
        `${state.bowling_team_name ?? "Bowling team"} to chase next`;
      detail =
        detail ||
        `Target: ${state.target_runs ?? (state.total_runs ? state.total_runs + 1 : "—")} runs to win`;
      break;
    }
    case "custom": {
      icon = <BellRing className="h-5 w-5 text-amber-300" />;
      badge = strap.badge || "MATCH ALERT";
      badgeTheme = "bg-gradient-to-r from-amber-600 to-yellow-600 text-black";
      borderColor = "border-amber-400/50";
      accentColor = "text-amber-300";
      title = strap.title || "BROADCAST NOTICE";
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

  return (
    <div
      className={`pointer-events-none fixed z-30 w-full max-w-3xl select-none px-4 font-score ${positionClass} duration-300 animate-in fade-in slide-in-from-bottom-5`}
    >
      {/* Authentic Broadcaster Lower-Third Strap */}
      <div
        className={`relative flex items-stretch overflow-hidden backdrop-blur-2xl ${
          theme === "foxcricket"
            ? "clip-slant-right border-2 border-lime-400 bg-[#060a06]/95 font-mono shadow-[0_0_35px_rgba(0,255,102,0.35)]"
            : theme === "sonysports"
              ? "rounded-2xl border-2 border-red-600/70 bg-gradient-to-r from-zinc-950 via-neutral-900 to-zinc-950 shadow-[0_12px_45px_rgba(220,38,38,0.4)]"
              : theme === "skysports"
                ? "border border-b-4 border-white/20 border-b-red-600 bg-[#03081a] text-white shadow-[0_12px_45px_rgba(4,10,28,0.95)]"
                : theme === "thehundred"
                  ? "border-2 border-pink-500 bg-[#100118] shadow-[0_10px_35px_rgba(236,72,153,0.4)]"
                  : theme === "apex"
                    ? "clip-chamfer-both carbon-matrix border-2 border-amber-400/90 text-white shadow-[0_0_45px_rgba(245,158,11,0.4)]"
                    : theme === "volt"
                      ? "clip-slant-right border-2 border-lime-400 bg-[#020904]/95 font-mono text-white shadow-[0_0_40px_rgba(0,255,102,0.4)]"
                      : theme === "agni"
                        ? "clip-notch-card magma-matrix border-2 border-orange-500 text-white shadow-[0_0_45px_rgba(255,69,0,0.5)]"
                        : theme === "thunder"
                          ? "rounded-2xl border-2 border-blue-400 bg-[#030a24]/95 text-white shadow-[0_0_45px_rgba(59,130,246,0.45)]"
                          : theme === "dharma"
                            ? "from-[#200508]/98 via-[#380911]/98 to-[#200508]/98 rounded-2xl border-2 border-amber-400/80 bg-gradient-to-r font-serif text-white shadow-[0_0_45px_rgba(180,83,9,0.4)]"
                            : theme === "nakshatra"
                              ? "from-[#07031e]/98 via-[#15073e]/98 to-[#07031e]/98 rounded-2xl border-2 border-purple-500/80 bg-gradient-to-r text-white shadow-[0_0_45px_rgba(168,85,247,0.4)]"
                              : `border ${borderColor} from-[#03091e]/98 via-[#061435]/98 to-[#03091e]/98 broadcast-bevel bg-gradient-to-r shadow-[0_12px_40px_rgba(0,0,0,0.9)]`
        }`}
      >
        {/* Left Broadcaster Badge Block */}
        <div
          className={`flex shrink-0 items-center gap-2.5 px-5 py-3.5 font-black ${
            theme === "foxcricket"
              ? "clip-slant-right border-r-2 border-lime-400 bg-black text-lime-400"
              : theme === "sonysports"
                ? "rounded-l-xl bg-gradient-to-r from-red-600 to-rose-700 text-white"
                : theme === "skysports"
                  ? "border-r-2 border-red-600 bg-[#040a1c] text-red-500"
                  : theme === "thehundred"
                    ? "bg-pink-600 text-white"
                    : theme === "apex"
                      ? "clip-chamfer-both bg-gradient-to-r from-amber-600 via-yellow-500 to-amber-600 text-black"
                      : theme === "volt"
                        ? "clip-slant-right border-r-2 border-lime-400 bg-black text-lime-400"
                        : theme === "agni"
                          ? "clip-notch-card bg-gradient-to-r from-red-600 via-orange-500 to-amber-500 text-black"
                          : theme === "thunder"
                            ? "rounded-l-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 text-yellow-300"
                            : theme === "dharma"
                              ? "rounded-l-xl border-r border-amber-400/50 bg-gradient-to-r from-red-800 via-rose-900 to-red-950 font-serif text-amber-300"
                              : theme === "nakshatra"
                                ? "rounded-l-xl bg-gradient-to-r from-purple-600 to-indigo-700 text-white"
                                : `clip-slant-right ${badgeTheme} broadcast-gloss`
          }`}
        >
          <div className="flex items-center justify-center">{icon}</div>
          <div className="leading-none">
            <span className="block text-sm font-black uppercase tracking-widest">
              {badge}
            </span>
            <span className="mt-0.5 block text-[10px] font-bold uppercase tracking-wider opacity-80">
              {theme === "foxcricket"
                ? "FOX CRICKET LAB"
                : theme === "sonysports"
                  ? "SONY SPORTS"
                  : theme === "skysports"
                    ? "sky sports cricket"
                    : theme === "thehundred"
                      ? "THE HUNDRED"
                      : theme === "apex"
                        ? "APEX BROADCAST"
                        : theme === "volt"
                          ? "VOLT SPORTS-TECH"
                          : theme === "agni"
                            ? "AGNI INFERNO"
                            : theme === "thunder"
                              ? "THUNDER CRICKET"
                              : theme === "dharma"
                                ? "DHARMA HERITAGE"
                                : theme === "nakshatra"
                                  ? "NAKSHATRA ASTRAL"
                                  : (state.tournament_name ??
                                    state.title ??
                                    "LIVE CRICKET")}
            </span>
          </div>
        </div>

        {/* Center Primary Information Block */}
        <div className="flex flex-1 flex-col justify-center px-5 py-2.5">
          <h3 className="text-xl font-black uppercase leading-tight tracking-wider text-white drop-shadow">
            {title}
          </h3>
          <p
            className={`text-base font-black uppercase tabular-nums leading-tight tracking-wide ${accentColor}`}
          >
            {subtitle}
          </p>
        </div>

        {/* Right Secondary Statistic Block */}
        {detail && (
          <div className="flex shrink-0 items-center border-l border-white/15 bg-black/40 px-5 py-2.5 text-right">
            <p className="max-w-[240px] text-xs font-bold uppercase tabular-nums tracking-wider text-slate-300">
              {detail}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
