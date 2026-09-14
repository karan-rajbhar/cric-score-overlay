"use client";

import { useState } from "react";
import type {
  LiveMatchState,
  PresentationCardType,
  OverlayTheme,
} from "./types";
import type { Match, Innings } from "~/lib/match-types";
import { formatDecimalOvers } from "~/lib/cricket";
import {
  Award,
  Trophy,
  Users,
  Shield,
  X,
  Activity,
  MapPin,
} from "lucide-react";

interface PresentationCardsProps {
  card: PresentationCardType;
  state: LiveMatchState;
  match: Match | null;
  onClose?: () => void;
  theme?: OverlayTheme;
}

export function PresentationCards({
  card,
  state,
  match,
  onClose,
  theme = "starsports",
}: PresentationCardsProps) {
  const inningsList: Innings[] = match?.innings || [];
  const currentInningsNumber = state.innings_number ?? 1;
  const initialIdx = Math.min(
    Math.max(0, currentInningsNumber - 1),
    Math.max(0, inningsList.length - 1),
  );
  const [selectedInningsIdx, setSelectedInningsIdx] =
    useState<number>(initialIdx);

  if (card === "none") return null;

  const team1Name = state.team1_name ?? "Team 1";
  const team2Name = state.team2_name ?? "Team 2";

  const selectedInnings =
    inningsList.length > 0
      ? inningsList[selectedInningsIdx] || inningsList[0]
      : null;

  const activeBattingTeamName =
    selectedInnings?.team_id === match?.team1_id
      ? team1Name
      : selectedInnings?.team_id === match?.team2_id
        ? team2Name
        : (state.batting_team_name ?? team1Name);

  const getCardFrameClass = (fallbackAccent: string) => {
    if (theme === "foxcricket") {
      return "border-2 border-lime-400 bg-neutral-950/98 shadow-[0_0_60px_rgba(0,255,102,0.3)] clip-slant-right font-mono";
    }
    if (theme === "sonysports") {
      return "rounded-3xl border-2 border-red-600/70 bg-gradient-to-b from-zinc-950/98 via-neutral-900/98 to-zinc-950/98 shadow-[0_20px_60px_rgba(220,38,38,0.4)]";
    }
    if (theme === "skysports") {
      return "border border-white/20 border-b-4 border-b-red-600 bg-[#03081a]/98 shadow-[0_20px_60px_rgba(4,10,28,0.95)]";
    }
    if (theme === "thehundred") {
      return "border-4 border-pink-500 bg-[#0d0114]/98 shadow-[0_0_60px_rgba(236,72,153,0.5)]";
    }
    if (theme === "apex") {
      return "clip-chamfer-both border-2 border-amber-400/90 carbon-matrix shadow-[0_0_80px_rgba(245,158,11,0.35)]";
    }
    if (theme === "volt") {
      return "border-2 border-lime-400 bg-[#020904]/98 shadow-[0_0_70px_rgba(0,255,102,0.4)] clip-slant-right font-mono";
    }
    if (theme === "agni") {
      return "clip-notch-card border-2 border-orange-500 magma-matrix shadow-[0_0_80px_rgba(255,69,0,0.5)]";
    }
    if (theme === "thunder") {
      return "rounded-3xl border-2 border-blue-400 bg-gradient-to-b from-[#030a24]/98 via-[#081845]/98 to-[#030a24]/98 shadow-[0_0_70px_rgba(59,130,246,0.5)]";
    }
    if (theme === "dharma") {
      return "rounded-3xl border-2 border-amber-400/80 bg-gradient-to-b from-[#1a0505]/98 via-[#2d0a0a]/98 to-[#1a0505]/98 shadow-[0_20px_60px_rgba(153,27,27,0.6)] font-serif";
    }
    if (theme === "nakshatra") {
      return "rounded-3xl border-2 border-purple-400/70 bg-gradient-to-b from-[#07031e]/98 via-[#15073e]/98 to-[#07031e]/98 shadow-[0_0_70px_rgba(168,85,247,0.4)]";
    }
    return `rounded-3xl border-2 ${fallbackAccent} bg-gradient-to-b from-slate-950/95 via-neutral-950/95 to-slate-950/95 shadow-[0_20px_60px_rgba(0,0,0,0.9)] ring-1 ring-amber-500/20`;
  };

  const broadcasterBadge =
    theme === "foxcricket"
      ? "FOX CRICKET · FOX SPORTS LAB"
      : theme === "sonysports"
        ? "SONY SPORTS NETWORK · SONY LIV"
        : theme === "skysports"
          ? "sky sports cricket · THE ASHES LIVE"
          : theme === "thehundred"
            ? "THE HUNDRED · LIVE BROADCAST"
            : theme === "apex"
              ? "APEX BROADCAST · 24K FRANCHISE GOLD"
              : theme === "volt"
                ? "VOLT SPORTS-TECH · HIGH VOLTAGE LIVE"
                : theme === "agni"
                  ? "AGNI INFERNO · BLAZING PASSION CRICKET"
                  : theme === "thunder"
                    ? "THUNDER VELOCITY · LIGHTNING CRICKET"
                    : theme === "dharma"
                      ? "DHARMA HERITAGE · RAJASTHAN ROYALE"
                      : theme === "nakshatra"
                        ? "NAKSHATRA ASTRAL · COSMIC CRICKET"
                        : (state.tournament_name ??
                          state.title ??
                          "STAR SPORTS · TATA IPL LIVE");

  return (
    <div className="pointer-events-auto fixed inset-0 z-50 flex select-none items-center justify-center bg-black/85 p-4 font-score backdrop-blur-xl duration-300 animate-in fade-in md:p-8">
      {onClose && (
        <button
          onClick={onClose}
          className="absolute right-6 top-6 flex h-11 w-11 items-center justify-center rounded-full border border-white/20 bg-black/80 text-white shadow-xl transition hover:scale-105 hover:bg-red-600"
          aria-label="Close presentation card"
        >
          <X className="h-5 w-5" />
        </button>
      )}

      {/* ========================================================= */}
      {/* 1. TOSS PRESENTATION CARD                                 */}
      {/* ========================================================= */}
      {card === "toss" && (
        <div
          className={`w-full max-w-2xl overflow-hidden p-8 text-white duration-300 animate-in zoom-in-95 ${getCardFrameClass("border-amber-500/40")}`}
        >
          <div className="text-center">
            <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-4 py-1 text-xs font-black uppercase tracking-widest text-amber-300 shadow-sm">
              {broadcasterBadge}
            </span>
            <h2 className="mt-3 bg-gradient-to-r from-amber-200 via-white to-amber-300 bg-clip-text text-4xl font-black tracking-wider text-transparent drop-shadow">
              TOSS RESULT
            </h2>
            {state.venue && (
              <p className="mt-1 flex items-center justify-center gap-1.5 text-xs uppercase tracking-widest text-white/60">
                <MapPin className="h-3.5 w-3.5 text-amber-400" />
                <span>{state.venue}</span>
              </p>
            )}
          </div>

          <div className="mt-8 flex items-center justify-around gap-6 border-y border-white/10 py-6">
            <div className="text-center">
              <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-2xl border border-white/10 bg-white/5 p-4 shadow-[0_0_30px_rgba(255,255,255,0.05)]">
                {state.team1_logo_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={state.team1_logo_url}
                    alt={team1Name}
                    className="max-h-full max-w-full object-contain"
                  />
                ) : (
                  <Shield className="h-12 w-12 text-amber-400/80" />
                )}
              </div>
              <p className="mt-3 text-lg font-bold text-white">{team1Name}</p>
            </div>

            <div className="flex flex-col items-center">
              <span className="rounded-full border border-amber-500/30 bg-amber-500/20 px-3 py-1 text-xl font-black italic text-amber-400">
                VS
              </span>
              <span className="mt-1 text-[10px] font-semibold uppercase tracking-widest text-white/40">
                {state.match_format ?? "Match"}
              </span>
            </div>

            <div className="text-center">
              <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-2xl border border-white/10 bg-white/5 p-4 shadow-[0_0_30px_rgba(255,255,255,0.05)]">
                {state.team2_logo_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={state.team2_logo_url}
                    alt={team2Name}
                    className="max-h-full max-w-full object-contain"
                  />
                ) : (
                  <Shield className="h-12 w-12 text-sky-400/80" />
                )}
              </div>
              <p className="mt-3 text-lg font-bold text-white">{team2Name}</p>
            </div>
          </div>

          <div className="mt-6 rounded-2xl border border-amber-500/30 bg-gradient-to-r from-amber-500/15 via-amber-500/25 to-amber-500/15 p-5 text-center shadow-inner">
            <p className="text-xl font-extrabold text-amber-300">
              {state.toss_winner_team_id
                ? `${state.toss_winner_team_id === match?.team1_id ? team1Name : team2Name} won the toss and elected to ${state.toss_decision === "bowl" ? "BOWL" : "BAT"} first.`
                : "Toss completed. Match underway."}
            </p>
            {state.umpire1_name && (
              <p className="mt-2 text-xs uppercase tracking-wider text-white/60">
                Umpires: {state.umpire1_name}
                {state.umpire2_name ? ` & ${state.umpire2_name}` : ""}
              </p>
            )}
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 2. PLAYING XI TEAM LINEUPS CARD                           */}
      {/* ========================================================= */}
      {card === "playing_xi" && (
        <div
          className={`w-full max-w-5xl overflow-hidden p-8 text-white shadow-2xl backdrop-blur-2xl duration-300 animate-in zoom-in-95 ${getCardFrameClass("border-white/20")}`}
        >
          <div className="border-b border-white/10 pb-4 text-center">
            <span className="rounded-full border border-sky-500/30 bg-sky-500/20 px-4 py-1 text-xs font-black uppercase tracking-widest text-sky-300">
              {broadcasterBadge}
            </span>
            <h2 className="mt-2 text-4xl font-black tracking-wide text-white">
              PLAYING XI TEAM LINEUPS
            </h2>
            <p className="mt-1 text-xs uppercase tracking-widest text-white/60">
              {team1Name} vs {team2Name}
            </p>
          </div>

          <div className="mt-6 grid max-h-[65vh] grid-cols-1 gap-6 overflow-y-auto pr-1 md:grid-cols-2">
            {/* Team 1 Squad */}
            <div className="rounded-2xl border border-sky-500/30 bg-slate-900/60 p-5">
              <div className="flex items-center gap-3 border-b border-white/10 pb-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/10 p-2">
                  {state.team1_logo_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={state.team1_logo_url}
                      alt={team1Name}
                      className="h-9 w-9 object-contain"
                    />
                  ) : (
                    <Shield className="h-6 w-6 text-sky-400" />
                  )}
                </div>
                <div>
                  <h3 className="text-xl font-extrabold uppercase text-sky-300">
                    {team1Name}
                  </h3>
                  <span className="text-[10px] font-semibold uppercase text-white/60">
                    Official Playing XI
                  </span>
                </div>
              </div>
              <ul className="mt-3 space-y-1.5 text-xs">
                {(match?.team1.team_players || []).length > 0 ? (
                  (match?.team1.team_players || []).map((tp, idx) => (
                    <li
                      key={idx}
                      className="flex items-center justify-between rounded-lg border border-white/5 bg-white/5 px-3 py-2"
                    >
                      <span className="font-semibold text-white">
                        {idx + 1}. {tp.user?.full_name ?? "Player"}
                      </span>
                      {tp.role_in_team && (
                        <span className="rounded border border-sky-500/20 bg-sky-500/10 px-2 py-0.5 text-[10px] font-bold uppercase text-sky-300">
                          {tp.role_in_team}
                        </span>
                      )}
                    </li>
                  ))
                ) : (
                  <li className="py-4 text-center text-xs italic text-white/50">
                    Squad details confirmed at toss.
                  </li>
                )}
              </ul>
            </div>

            {/* Team 2 Squad */}
            <div className="rounded-2xl border border-amber-500/30 bg-slate-900/60 p-5">
              <div className="flex items-center gap-3 border-b border-white/10 pb-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/10 p-2">
                  {state.team2_logo_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={state.team2_logo_url}
                      alt={team2Name}
                      className="h-9 w-9 object-contain"
                    />
                  ) : (
                    <Shield className="h-6 w-6 text-amber-400" />
                  )}
                </div>
                <div>
                  <h3 className="text-xl font-extrabold uppercase text-amber-300">
                    {team2Name}
                  </h3>
                  <span className="text-[10px] font-semibold uppercase text-white/60">
                    Official Playing XI
                  </span>
                </div>
              </div>
              <ul className="mt-3 space-y-1.5 text-xs">
                {(match?.team2.team_players || []).length > 0 ? (
                  (match?.team2.team_players || []).map((tp, idx) => (
                    <li
                      key={idx}
                      className="flex items-center justify-between rounded-lg border border-white/5 bg-white/5 px-3 py-2"
                    >
                      <span className="font-semibold text-white">
                        {idx + 1}. {tp.user?.full_name ?? "Player"}
                      </span>
                      {tp.role_in_team && (
                        <span className="rounded border border-amber-500/20 bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-300">
                          {tp.role_in_team}
                        </span>
                      )}
                    </li>
                  ))
                ) : (
                  <li className="py-4 text-center text-xs italic text-white/50">
                    Squad details confirmed at toss.
                  </li>
                )}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 3. BROADCAST FULL-SCREEN SCORECARD (INNINGS TABS & FOW)   */}
      {/* ========================================================= */}
      {card === "scorecard" && (
        <div
          className={`max-h-[90vh] w-full max-w-5xl overflow-hidden overflow-y-auto p-6 text-white backdrop-blur-2xl duration-300 animate-in zoom-in-95 md:p-8 ${getCardFrameClass("border-amber-500/40")}`}
        >
          {/* Header & Innings Switcher */}
          <div className="flex flex-col items-start justify-between gap-4 border-b border-white/15 pb-4 sm:flex-row sm:items-center">
            <div>
              <div className="flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-emerald-400">
                <span className="opacity-80">{broadcasterBadge} ·</span>
                <span>Match Scorecard</span>
              </div>
              <h2 className="text-3xl font-black uppercase tracking-tight text-white">
                {activeBattingTeamName} ·{" "}
                {selectedInnings?.total_runs ?? state.total_runs ?? 0}/
                {selectedInnings?.total_wickets ?? state.total_wickets ?? 0}
              </h2>
              <p className="text-xs text-slate-300">
                Overs:{" "}
                {selectedInnings
                  ? `${Math.floor(selectedInnings.total_balls / 6)}.${selectedInnings.total_balls % 6}`
                  : `${state.current_over}.${state.current_ball}`}{" "}
                / {state.overs_per_innings} ov
              </p>
            </div>

            {/* Innings Selector Tabs */}
            {inningsList.length > 0 && (
              <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/10 p-1.5">
                {inningsList.map((inn, idx) => {
                  const innTeamName =
                    inn.team_id === match?.team1_id ? team1Name : team2Name;
                  const isSelected = selectedInningsIdx === idx;
                  return (
                    <button
                      key={inn.id || idx}
                      onClick={() => setSelectedInningsIdx(idx)}
                      className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                        isSelected
                          ? "bg-amber-500 font-black text-black shadow-md"
                          : "text-white/70 hover:bg-white/10"
                      }`}
                    >
                      <span>{idx === 0 ? "1st Innings" : "2nd Innings"}:</span>
                      <span className="font-mono tabular-nums">
                        {innTeamName} {inn.total_runs}/{inn.total_wickets}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Batting Performances Table */}
          <div className="mt-5">
            <div className="mb-2 flex items-center justify-between">
              <h4 className="flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-slate-300">
                <Users className="h-4 w-4 text-amber-400" />
                <span>Batting Card</span>
              </h4>
            </div>

            <div className="overflow-x-auto rounded-xl border border-white/10 bg-slate-900/60 shadow-inner">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-white/10 bg-white/5 text-[10px] font-black uppercase tracking-wider text-white/60">
                    <th className="px-3 py-2.5">Batter</th>
                    <th className="px-3 py-2.5">Dismissal</th>
                    <th className="px-3 py-2.5 text-right">R</th>
                    <th className="px-3 py-2.5 text-right">B</th>
                    <th className="px-3 py-2.5 text-right">4s</th>
                    <th className="px-3 py-2.5 text-right">6s</th>
                    <th className="px-3 py-2.5 text-right">SR</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {(
                    selectedInnings?.batting_performances ||
                    match?.innings?.[0]?.batting_performances ||
                    []
                  ).map((bp, idx) => {
                    const sr =
                      bp.balls_faced > 0
                        ? ((bp.runs_scored * 100) / bp.balls_faced).toFixed(1)
                        : "0.0";
                    const srNum = Number(sr);
                    const srBadgeColor =
                      srNum >= 150
                        ? "text-emerald-400 font-bold"
                        : srNum >= 120
                          ? "text-sky-300 font-medium"
                          : srNum >= 100
                            ? "text-amber-300"
                            : "text-slate-400";

                    return (
                      <tr key={idx} className="transition hover:bg-white/5">
                        <td className="flex items-center gap-1.5 px-3 py-2.5 font-semibold text-white">
                          <span>{bp.user?.full_name ?? "Batter"}</span>
                          {!bp.is_out && (
                            <span className="font-bold text-amber-400">*</span>
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-[11px] italic text-slate-400">
                          {!bp.is_out ? (
                            <span className="font-bold uppercase tracking-wider text-emerald-400">
                              not out
                            </span>
                          ) : (
                            <span>{bp.dismissal_type ?? "out"}</span>
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-right font-bold tabular-nums text-white">
                          {bp.runs_scored}
                        </td>
                        <td className="px-3 py-2.5 text-right tabular-nums text-slate-300">
                          {bp.balls_faced}
                        </td>
                        <td className="px-3 py-2.5 text-right tabular-nums text-slate-400">
                          {bp.fours}
                        </td>
                        <td className="px-3 py-2.5 text-right tabular-nums text-slate-400">
                          {bp.sixes}
                        </td>
                        <td
                          className={`px-3 py-2.5 text-right tabular-nums ${srBadgeColor}`}
                        >
                          {sr}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Extras Strip */}
            {selectedInnings && (
              <div className="mt-2.5 flex items-center justify-between rounded-lg border border-white/5 bg-white/5 px-3 py-1.5 text-xs text-slate-300">
                <span className="font-bold text-amber-300">
                  Extras: {selectedInnings.extras_total}
                </span>
                <span className="font-mono text-[11px] text-slate-400">
                  (b {selectedInnings.extras_byes}, lb{" "}
                  {selectedInnings.extras_leg_byes}, w{" "}
                  {selectedInnings.extras_wides}, nb{" "}
                  {selectedInnings.extras_no_balls})
                </span>
              </div>
            )}
          </div>

          {/* Bowling Figures Table */}
          <div className="mt-6 border-t border-white/10 pt-4">
            <h4 className="mb-2 flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-slate-300">
              <Activity className="h-4 w-4 text-sky-400" />
              <span>Bowling Figures</span>
            </h4>
            <div className="overflow-x-auto rounded-xl border border-white/10 bg-slate-900/60 shadow-inner">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-white/10 bg-white/5 text-[10px] font-black uppercase tracking-wider text-white/60">
                    <th className="px-3 py-2.5">Bowler</th>
                    <th className="px-3 py-2.5 text-right">O</th>
                    <th className="px-3 py-2.5 text-right">M</th>
                    <th className="px-3 py-2.5 text-right">R</th>
                    <th className="px-3 py-2.5 text-right">W</th>
                    <th className="px-3 py-2.5 text-right">Econ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {(
                    selectedInnings?.bowling_performances ||
                    match?.innings?.[0]?.bowling_performances ||
                    []
                  ).map((bw, idx) => {
                    const ovText = `${Math.floor(bw.balls_bowled / 6)}.${bw.balls_bowled % 6}`;
                    const econ =
                      bw.balls_bowled > 0
                        ? ((bw.runs_conceded * 6) / bw.balls_bowled).toFixed(2)
                        : "0.00";
                    const econNum = Number(econ);
                    const econBadge =
                      econNum <= 6.5
                        ? "text-emerald-400 font-bold"
                        : econNum <= 8.5
                          ? "text-sky-300"
                          : "text-amber-400";

                    return (
                      <tr key={idx} className="transition hover:bg-white/5">
                        <td className="flex items-center gap-1.5 px-3 py-2.5 font-semibold text-white">
                          <span>{bw.user?.full_name ?? "Bowler"}</span>
                          {bw.is_current_bowler && (
                            <span className="py-0.2 rounded border border-sky-500/30 bg-sky-500/20 px-1 text-[10px] font-black text-sky-400">
                              BOWLING ●
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-right tabular-nums text-slate-300">
                          {ovText}
                        </td>
                        <td className="px-3 py-2.5 text-right tabular-nums text-slate-300">
                          {bw.maidens}
                        </td>
                        <td className="px-3 py-2.5 text-right tabular-nums text-slate-300">
                          {bw.runs_conceded}
                        </td>
                        <td className="px-3 py-2.5 text-right text-sm font-black tabular-nums text-amber-300">
                          {bw.wickets_taken}
                        </td>
                        <td
                          className={`px-3 py-2.5 text-right tabular-nums ${econBadge}`}
                        >
                          {econ}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Fall of Wickets Timeline (If present) */}
          {selectedInnings?.fall_of_wickets &&
            selectedInnings.fall_of_wickets.length > 0 && (
              <div className="mt-5 border-t border-white/10 pt-3">
                <h5 className="mb-2 text-[10px] font-black uppercase tracking-wider text-slate-400">
                  Fall of Wickets
                </h5>
                <div className="flex flex-wrap items-center gap-2">
                  {selectedInnings.fall_of_wickets.map((fow, idx) => (
                    <span
                      key={idx}
                      className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-[11px] font-medium tabular-nums text-slate-300"
                    >
                      <strong className="text-amber-400">
                        {fow.runs_at_fall}/{fow.wicket_number}
                      </strong>{" "}
                      ({fow.batsman?.full_name ?? "Batter"},{" "}
                      {formatDecimalOvers(fow.overs_at_fall)} ov)
                    </span>
                  ))}
                </div>
              </div>
            )}
        </div>
      )}

      {/* ========================================================= */}
      {/* 4. PARTNERSHIP CARD                                       */}
      {/* ========================================================= */}
      {card === "partnership" && (
        <div
          className={`w-full max-w-xl overflow-hidden p-7 text-white shadow-2xl backdrop-blur-2xl duration-300 animate-in zoom-in-95 ${getCardFrameClass("border-amber-500/40")}`}
        >
          <div className="border-b border-white/10 pb-3 text-center">
            <span className="rounded-full border border-amber-500/30 bg-amber-500/20 px-3 py-1 text-xs font-black uppercase tracking-widest text-amber-300">
              {broadcasterBadge} · Active Partnership
            </span>
            <h3 className="mt-2 text-4xl font-black tabular-nums text-white">
              {state.partnership_runs ?? 0} RUNS
            </h3>
            <p className="mt-0.5 text-xs text-white/60">
              Off {state.partnership_balls ?? 0} deliveries
            </p>
          </div>

          <div className="mt-6 grid grid-cols-2 items-center gap-4">
            <div className="rounded-2xl border border-sky-500/30 bg-slate-900/60 p-4 text-center">
              <p className="text-xs font-bold uppercase tracking-wider text-sky-400">
                Striker
              </p>
              <p className="mt-1 text-lg font-black text-white">
                {state.striker_name ?? "Striker"} *
              </p>
              <p className="mt-1 text-3xl font-black tabular-nums text-sky-300">
                {state.striker_runs ?? 0}
                <span className="ml-1 text-xs font-normal text-white/60">
                  ({state.striker_balls ?? 0}b)
                </span>
              </p>
            </div>

            <div className="rounded-2xl border border-emerald-500/30 bg-slate-900/60 p-4 text-center">
              <p className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                Non-Striker
              </p>
              <p className="mt-1 text-lg font-black text-white">
                {state.non_striker_name ?? "Non-Striker"}
              </p>
              <p className="mt-1 text-3xl font-black tabular-nums text-emerald-300">
                {state.non_striker_runs ?? 0}
                <span className="ml-1 text-xs font-normal text-white/60">
                  ({state.non_striker_balls ?? 0}b)
                </span>
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 5. OVER SUMMARY CARD (Transition)                         */}
      {/* ========================================================= */}
      {card === "over_summary" && (
        <div
          className={`w-full max-w-xl overflow-hidden p-7 text-white shadow-2xl backdrop-blur-2xl duration-300 animate-in zoom-in-95 ${getCardFrameClass("border-emerald-500/40")}`}
        >
          <div className="flex items-center justify-between border-b border-white/10 pb-3">
            <div>
              <span className="rounded-full border border-emerald-500/30 bg-emerald-500/20 px-3 py-1 text-[11px] font-black uppercase tracking-widest text-emerald-300">
                {broadcasterBadge} · Over Summary
              </span>
              <h3 className="mt-1 text-3xl font-black text-white">
                End of Over {state.current_over}
              </h3>
            </div>
            <div className="text-right">
              <p className="text-3xl font-black tabular-nums text-white">
                {state.total_runs ?? 0}/{state.total_wickets ?? 0}
              </p>
              <p className="text-xs tabular-nums text-white/60">
                CRR {state.current_run_rate ?? "—"}
              </p>
            </div>
          </div>

          <div className="mt-5 flex items-center justify-between rounded-xl border border-white/5 bg-white/5 p-3.5">
            <p className="text-xs font-bold uppercase tracking-wide text-white/70">
              This Over:
            </p>
            <div className="flex items-center gap-2">
              {(state.this_over_balls ?? "")
                .split(" ")
                .filter(Boolean)
                .map((ball, idx) => (
                  <span
                    key={idx}
                    className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-black tabular-nums shadow ${
                      ball === "W"
                        ? "animate-pulse bg-red-600 text-white"
                        : ball === "4"
                          ? "bg-sky-500 text-white"
                          : ball === "6"
                            ? "bg-amber-400 font-black text-black"
                            : "bg-white/15 text-white"
                    }`}
                  >
                    {ball}
                  </span>
                ))}
            </div>
          </div>

          {state.current_bowler_name && (
            <div className="mt-4 flex items-center justify-between rounded-xl border border-white/10 bg-slate-900/60 p-3.5 text-xs">
              <span className="font-bold text-white/90">
                Bowler: {state.current_bowler_name}
              </span>
              <span className="font-black tabular-nums text-amber-300">
                {state.bowler_wickets ?? 0}-{state.bowler_runs ?? 0} (
                {state.bowler_balls
                  ? `${Math.floor(state.bowler_balls / 6)}.${state.bowler_balls % 6}`
                  : "0.0"}{" "}
                ov)
              </span>
            </div>
          )}
        </div>
      )}

      {/* ========================================================= */}
      {/* 6. MATCH RESULT & PLAYER OF THE MATCH                     */}
      {/* ========================================================= */}
      {card === "result" && (
        <div
          className={`w-full max-w-2xl overflow-hidden p-8 text-center text-white shadow-2xl duration-300 animate-in zoom-in-95 ${getCardFrameClass("border-amber-400/50")}`}
        >
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-amber-400/30 bg-amber-400/20 text-amber-300">
            <Trophy className="h-9 w-9 text-amber-300" />
          </div>

          <span className="mt-4 inline-block rounded-full border border-amber-500/30 bg-amber-500/20 px-4 py-1 text-xs font-black uppercase tracking-widest text-amber-300">
            {broadcasterBadge} · Match Result
          </span>
          <h2 className="mt-2 text-3xl font-black text-white">
            {state.result_description ?? "Match Completed"}
          </h2>

          <div className="mt-6 flex items-center justify-around border-y border-white/10 py-5">
            <div>
              <p className="text-base font-bold text-white/80">{team1Name}</p>
              <p className="mt-1 text-3xl font-black tabular-nums text-white">
                {match?.innings?.[0]?.total_runs ?? state.total_runs}/
                {match?.innings?.[0]?.total_wickets ?? state.total_wickets}
              </p>
            </div>
            <div className="text-xl font-black italic text-amber-400">VS</div>
            <div>
              <p className="text-base font-bold text-white/80">{team2Name}</p>
              <p className="mt-1 text-3xl font-black tabular-nums text-white">
                {match?.innings?.[1]?.total_runs ?? "—"}/
                {match?.innings?.[1]?.total_wickets ?? "—"}
              </p>
            </div>
          </div>

          {match?.player_of_the_match && (
            <div className="mt-6 flex items-center justify-center gap-3 rounded-2xl border border-amber-500/40 bg-gradient-to-r from-amber-500/15 via-amber-500/25 to-amber-500/15 p-4">
              <Award className="h-7 w-7 text-amber-400" />
              <div className="text-left">
                <span className="block text-[10px] font-black uppercase tracking-widest text-amber-400">
                  Player of the Match
                </span>
                <p className="text-lg font-black text-white">
                  {match.player_of_the_match.full_name}
                </p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
