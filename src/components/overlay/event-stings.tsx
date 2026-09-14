"use client";

import { useEffect } from "react";
import type { ActiveEventSting, OverlayTheme } from "./types";

interface EventStingsProps {
  sting: ActiveEventSting | null;
  onDismiss: () => void;
  theme?: OverlayTheme;
}

export function EventStings({
  sting,
  onDismiss,
  theme = "starsports",
}: EventStingsProps) {
  useEffect(() => {
    if (!sting) return;

    const timer = setTimeout(() => {
      onDismiss();
    }, sting.durationMs || 4500);

    return () => clearTimeout(timer);
  }, [sting, onDismiss]);

  if (!sting) return null;

  return (
    <div className="pointer-events-none fixed inset-0 z-50 flex select-none items-center justify-center font-score">
      {/* =================================================================== */}
      {/* 1. FOX CRICKET AUSTRALIA (CYBER HUD / RAZOR CUT / NEON LIME)        */}
      {/* =================================================================== */}
      {theme === "foxcricket" && (
        <div className="animate-stinger-entry relative flex w-full max-w-4xl flex-col items-center px-4">
          {/* FOUR */}
          {sting.type === "four" && (
            <div className="clip-slant-right relative w-full overflow-hidden border-2 border-lime-400 bg-[#050905]/95 shadow-[0_0_70px_rgba(0,255,102,0.5)] backdrop-blur-2xl">
              <div className="flex items-center justify-between border-b border-lime-400/40 bg-black px-6 py-1.5 font-mono text-[11px] font-bold uppercase tracking-widest text-lime-400">
                <div className="flex items-center gap-2">
                  <span className="inline-block h-2.5 w-2.5 rotate-45 bg-lime-400" />
                  <span>FOX CRICKET · FOX SPORTS LAB</span>
                </div>
                <div className="flex items-center gap-2 text-white/80">
                  <span className="font-black text-lime-300">
                    RADAR EXIT: 148.4 KM/H
                  </span>
                  <span>•</span>
                  <span>TRACE BULLET 4</span>
                </div>
              </div>

              <div className="relative flex flex-col items-center justify-center bg-gradient-to-b from-black/80 via-neutral-950 to-black/80 px-8 py-6">
                <div className="flex items-center justify-center gap-4">
                  <span className="font-mono text-2xl font-black tracking-tighter text-lime-400">
                    [// FOX 4 //]
                  </span>
                  <h2 className="bg-gradient-to-r from-lime-300 via-white to-cyan-300 bg-clip-text text-7xl font-black italic tracking-wider text-transparent drop-shadow-[0_0_35px_rgba(163,230,53,0.95)] md:text-8xl">
                    FOUR!
                  </h2>
                  <span className="font-mono text-2xl font-black tracking-tighter text-lime-400">
                    [// FOX 4 //]
                  </span>
                </div>

                {sting.subtitle && (
                  <p className="mt-1 font-mono text-2xl font-black uppercase tracking-wide text-white drop-shadow">
                    {sting.subtitle}
                  </p>
                )}
              </div>

              {sting.detail && (
                <div className="flex items-center justify-center gap-3 border-t border-lime-400/30 bg-black px-6 py-2 font-mono">
                  <span className="rounded bg-lime-400 px-2.5 py-0.5 text-xs font-black uppercase tracking-widest text-black">
                    FOX SPEED
                  </span>
                  <span className="text-base font-black tabular-nums tracking-wider text-lime-300">
                    {sting.detail}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* SIX */}
          {sting.type === "six" && (
            <div className="clip-slant-right relative w-full overflow-hidden border-2 border-lime-400 bg-[#050905]/95 shadow-[0_0_80px_rgba(0,255,102,0.6)] backdrop-blur-2xl">
              <div className="flex items-center justify-between border-b border-lime-400/40 bg-black px-6 py-1.5 font-mono text-[11px] font-bold uppercase tracking-widest text-lime-400">
                <div className="flex items-center gap-2">
                  <span className="inline-block h-2.5 w-2.5 rotate-45 animate-spin bg-lime-400" />
                  <span>FOX CRICKET · FOX SPORTS LAB</span>
                </div>
                <div className="flex items-center gap-2 text-cyan-300">
                  <span className="font-black">
                    PREDICTED DISTANCE: 104 METRES
                  </span>
                  <span>•</span>
                  <span>APEX: 32M</span>
                </div>
              </div>

              <div className="relative flex flex-col items-center justify-center bg-gradient-to-b from-black via-neutral-950 to-black px-8 py-6">
                <div className="flex items-center justify-center gap-4">
                  <span className="font-mono text-3xl font-black text-cyan-400">
                    &lt; 6 &gt;
                  </span>
                  <h2 className="bg-gradient-to-r from-lime-300 via-yellow-200 to-cyan-300 bg-clip-text text-7xl font-black italic tracking-widest text-transparent drop-shadow-[0_0_40px_rgba(0,255,102,0.95)] md:text-8xl">
                    MAXIMUM!
                  </h2>
                  <span className="font-mono text-3xl font-black text-cyan-400">
                    &lt; 6 &gt;
                  </span>
                </div>

                <p className="mt-1 font-mono text-2xl font-black uppercase tracking-widest text-lime-400 drop-shadow">
                  THAT&apos;S A HUGE SIX!
                </p>

                {sting.subtitle && (
                  <p className="mt-1 font-mono text-xl font-bold tracking-wide text-white drop-shadow">
                    {sting.subtitle}
                  </p>
                )}
              </div>

              {sting.detail && (
                <div className="flex items-center justify-center gap-3 border-t border-lime-400/30 bg-black px-6 py-2 font-mono">
                  <span className="rounded bg-cyan-400 px-2.5 py-0.5 text-xs font-black uppercase tracking-widest text-black">
                    FOX RADAR
                  </span>
                  <span className="text-base font-black tabular-nums tracking-wider text-cyan-300">
                    {sting.detail}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* WICKET */}
          {sting.type === "wicket" && (
            <div className="clip-slant-right relative w-full overflow-hidden border-2 border-red-500 bg-[#0c0202]/95 shadow-[0_0_80px_rgba(239,68,68,0.7)] backdrop-blur-2xl">
              <div className="flex items-center justify-between border-b border-red-500/40 bg-black px-6 py-1.5 font-mono text-[11px] font-bold uppercase tracking-widest text-red-400">
                <div className="flex items-center gap-2">
                  <span className="inline-block h-2.5 w-2.5 animate-ping bg-red-500" />
                  <span>FOX CRICKET · HAWKEYE DISMISSAL CONFIRMED</span>
                </div>
                <div className="font-bold text-white/80">
                  DECISION REVIEW OVERTURNED
                </div>
              </div>

              <div className="relative flex flex-col items-center justify-center bg-gradient-to-b from-red-950/40 via-black to-red-950/40 px-8 py-6">
                <div className="flex items-center justify-center gap-4">
                  <span className="font-mono text-3xl font-black text-red-500">
                    {"/// OUT ///"}
                  </span>
                  <h2 className="bg-gradient-to-r from-red-400 via-white to-red-500 bg-clip-text text-7xl font-black italic tracking-widest text-transparent drop-shadow-[0_0_35px_rgba(239,68,68,0.95)] md:text-8xl">
                    WICKET!
                  </h2>
                  <span className="font-mono text-3xl font-black text-red-500">
                    {"/// OUT ///"}
                  </span>
                </div>

                {sting.subtitle && (
                  <p className="mt-1 font-mono text-2xl font-black uppercase tracking-wider text-white drop-shadow">
                    {sting.subtitle}
                  </p>
                )}
              </div>

              {sting.detail && (
                <div className="flex items-center justify-center gap-3 border-t border-red-500/40 bg-black px-6 py-2.5 font-mono">
                  <span className="rounded bg-red-600 px-3 py-0.5 text-xs font-black uppercase tracking-widest text-white shadow">
                    FOX HAWKEYE
                  </span>
                  <span className="text-lg font-black tracking-wide text-amber-300">
                    {sting.detail}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* MILESTONE */}
          {sting.type === "milestone" && (
            <div className="clip-slant-right relative w-full overflow-hidden border-2 border-lime-400 bg-black/95 shadow-[0_0_70px_rgba(163,230,53,0.6)] backdrop-blur-2xl">
              <div className="flex items-center justify-between border-b border-lime-400/40 bg-black px-6 py-1.5 font-mono text-[11px] font-bold uppercase tracking-widest text-lime-400">
                <span>FOX CRICKET · BATTER TELEMETRY MILESTONE</span>
                <span>ACHIEVEMENT UNLOCKED</span>
              </div>
              <div className="relative flex flex-col items-center justify-center px-8 py-6">
                <h2 className="font-mono text-6xl font-black tracking-wider text-lime-400 drop-shadow-[0_0_30px_rgba(163,230,53,0.9)] md:text-7xl">
                  {sting.title}
                </h2>
                {sting.subtitle && (
                  <p className="mt-1 font-mono text-2xl font-black uppercase tracking-wide text-white drop-shadow">
                    {sting.subtitle}
                  </p>
                )}
              </div>
              {sting.detail && (
                <div className="flex items-center justify-center gap-3 border-t border-lime-400/30 bg-neutral-950 px-6 py-2 font-mono">
                  <span className="rounded bg-lime-400 px-2.5 py-0.5 text-xs font-black uppercase tracking-widest text-black">
                    FOX STATS
                  </span>
                  <span className="text-base font-black tabular-nums tracking-wider text-white">
                    {sting.detail}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* FREE HIT */}
          {sting.type === "free_hit" && (
            <div className="clip-slant-right relative w-full overflow-hidden border-2 border-cyan-400 bg-black/95 shadow-[0_0_60px_rgba(6,182,212,0.8)] backdrop-blur-2xl">
              <div className="flex items-center justify-between bg-cyan-400 px-6 py-1.5 font-mono text-[11px] font-black uppercase tracking-widest text-black">
                <span>FOX CRICKET · UMPIRE CAUTION PROTOCOL</span>
                <span>PENALTY DELIVERY</span>
              </div>
              <div className="relative flex flex-col items-center justify-center px-8 py-6">
                <h2 className="animate-pulse font-mono text-7xl font-black italic tracking-wider text-cyan-300 drop-shadow-[0_0_30px_rgba(6,182,212,0.9)] md:text-8xl">
                  FREE HIT!
                </h2>
                <p className="mt-2 font-mono text-sm font-black uppercase tracking-widest text-white/90 md:text-base">
                  Bowler Overstepped · No Dismissals Except Run Out
                </p>
              </div>
              <div className="border-t border-cyan-400/40 bg-cyan-500/20 px-6 py-2 text-center font-mono">
                <span className="text-xs font-black uppercase tracking-wider text-cyan-300">
                  NEXT DELIVERY IS A FREE HIT
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* =================================================================== */}
      {/* 2. SONY SPORTS NETWORK (CURVED CAPSULE / SONY RED / SONY LIV)       */}
      {/* =================================================================== */}
      {theme === "sonysports" && (
        <div className="animate-stinger-entry relative flex w-full max-w-4xl flex-col items-center px-4">
          {/* FOUR */}
          {sting.type === "four" && (
            <div className="relative w-full overflow-hidden rounded-3xl border-2 border-red-600/80 bg-gradient-to-r from-zinc-950 via-neutral-900 to-zinc-950 shadow-[0_0_70px_rgba(220,38,38,0.7)] backdrop-blur-2xl">
              <div className="flex items-center justify-between bg-gradient-to-r from-red-600 via-rose-600 to-red-700 px-6 py-1.5 text-xs font-black uppercase tracking-wider text-white">
                <div className="flex items-center gap-2">
                  <span className="inline-block h-2.5 w-2.5 animate-pulse rounded-full bg-white" />
                  <span>SONY SPORTS NETWORK · LIVE STREAMING ON SONY LIV</span>
                </div>
                <span>CRACKING BOUNDARY · 4 RUNS</span>
              </div>

              <div className="relative flex flex-col items-center justify-center px-8 py-6">
                <div className="flex items-center justify-center gap-4">
                  <span className="flex h-14 w-14 items-center justify-center rounded-full bg-red-600 text-3xl font-black text-white shadow-[0_0_20px_#ef4444]">
                    4
                  </span>
                  <h2 className="bg-gradient-to-r from-red-200 via-white to-rose-400 bg-clip-text text-7xl font-black italic tracking-wider text-transparent drop-shadow-[0_4px_24px_rgba(220,38,38,0.9)] md:text-8xl">
                    FOUR!
                  </h2>
                </div>

                {sting.subtitle && (
                  <p className="mt-2 text-2xl font-black uppercase tracking-wide text-white drop-shadow">
                    {sting.subtitle}
                  </p>
                )}
              </div>

              {sting.detail && (
                <div className="flex items-center justify-center gap-3 border-t border-red-600/40 bg-zinc-950 px-6 py-2.5">
                  <span className="rounded-full bg-red-600 px-3 py-0.5 text-xs font-black uppercase tracking-widest text-white shadow">
                    SONY LIV
                  </span>
                  <span className="text-base font-black tabular-nums tracking-wider text-white">
                    {sting.detail}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* SIX */}
          {sting.type === "six" && (
            <div className="relative w-full overflow-hidden rounded-3xl border-2 border-red-500/80 bg-gradient-to-r from-zinc-950 via-red-950/80 to-zinc-950 shadow-[0_0_80px_rgba(239,68,68,0.8)] backdrop-blur-2xl">
              <div className="flex items-center justify-between bg-gradient-to-r from-red-600 via-rose-600 to-red-700 px-6 py-1.5 text-xs font-black uppercase tracking-wider text-white">
                <div className="flex items-center gap-2">
                  <span className="inline-block h-2.5 w-2.5 animate-pulse rounded-full bg-white" />
                  <span>SONY SPORTS NETWORK · MAXIMUM SIX</span>
                </div>
                <span>SUPER SIXER · 6 RUNS OVER THE ROPES</span>
              </div>

              <div className="relative flex flex-col items-center justify-center px-8 py-6">
                <div className="flex items-center justify-center gap-4">
                  <span className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-tr from-amber-500 via-red-600 to-rose-600 text-3xl font-black text-white shadow-[0_0_25px_#f59e0b]">
                    6
                  </span>
                  <h2 className="bg-gradient-to-r from-amber-200 via-white to-red-400 bg-clip-text text-7xl font-black italic tracking-widest text-transparent drop-shadow-[0_4px_28px_rgba(239,68,68,0.95)] md:text-8xl">
                    MAXIMUM!
                  </h2>
                </div>

                <p className="mt-1 text-2xl font-black uppercase tracking-widest text-amber-300 drop-shadow">
                  THAT&apos;S A HUGE SIX!
                </p>

                {sting.subtitle && (
                  <p className="mt-1 text-xl font-bold tracking-wide text-white drop-shadow">
                    {sting.subtitle}
                  </p>
                )}
              </div>

              {sting.detail && (
                <div className="flex items-center justify-center gap-3 border-t border-red-600/40 bg-zinc-950 px-6 py-2.5">
                  <span className="rounded-full bg-amber-500 px-3 py-0.5 text-xs font-black uppercase tracking-widest text-black">
                    SUPER SIX
                  </span>
                  <span className="text-base font-black tabular-nums tracking-wider text-white">
                    {sting.detail}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* WICKET */}
          {sting.type === "wicket" && (
            <div className="relative w-full overflow-hidden rounded-3xl border-2 border-red-600 bg-gradient-to-r from-zinc-950 via-neutral-900 to-zinc-950 shadow-[0_0_80px_rgba(220,38,38,0.9)] backdrop-blur-2xl">
              <div className="flex items-center justify-between bg-gradient-to-r from-red-700 via-red-600 to-red-800 px-6 py-1.5 text-xs font-black uppercase tracking-wider text-white">
                <div className="flex items-center gap-2">
                  <span className="inline-block h-2.5 w-2.5 animate-ping rounded-full bg-white" />
                  <span>SONY SPORTS NETWORK · WICKET FALLS</span>
                </div>
                <span>DEPARTURE CONFIRMED</span>
              </div>

              <div className="relative flex flex-col items-center justify-center px-8 py-6">
                <h2 className="bg-gradient-to-r from-red-400 via-white to-red-500 bg-clip-text text-7xl font-black italic tracking-widest text-transparent drop-shadow-[0_4px_28px_rgba(239,68,68,0.95)] md:text-8xl">
                  WICKET!
                </h2>

                {sting.subtitle && (
                  <p className="mt-1 text-2xl font-black uppercase tracking-wider text-white drop-shadow">
                    {sting.subtitle}
                  </p>
                )}
              </div>

              {sting.detail && (
                <div className="flex items-center justify-center gap-3 border-t border-red-600/40 bg-zinc-950 px-6 py-2.5">
                  <span className="rounded-full bg-red-600 px-3 py-0.5 text-xs font-black uppercase tracking-widest text-white shadow">
                    DISMISSAL
                  </span>
                  <span className="text-lg font-black tracking-wide text-amber-300">
                    {sting.detail}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* MILESTONE */}
          {sting.type === "milestone" && (
            <div className="relative w-full overflow-hidden rounded-3xl border-2 border-amber-400 bg-gradient-to-r from-zinc-950 via-amber-950/40 to-zinc-950 shadow-[0_0_70px_rgba(245,158,11,0.6)] backdrop-blur-2xl">
              <div className="flex items-center justify-between bg-gradient-to-r from-amber-600 to-amber-700 px-6 py-1.5 text-xs font-black uppercase tracking-wider text-black">
                <span>SONY SPORTS NETWORK · MILESTONE MOMENT</span>
                <span>BATTING GLORY</span>
              </div>
              <div className="relative flex flex-col items-center justify-center px-8 py-6">
                <h2 className="bg-gradient-to-r from-amber-200 via-yellow-100 to-amber-400 bg-clip-text text-6xl font-black tracking-wider text-transparent drop-shadow-[0_4px_24px_rgba(245,158,11,0.9)] md:text-7xl">
                  {sting.title}
                </h2>
                {sting.subtitle && (
                  <p className="mt-1 text-2xl font-black uppercase tracking-wide text-white drop-shadow">
                    {sting.subtitle}
                  </p>
                )}
              </div>
              {sting.detail && (
                <div className="flex items-center justify-center gap-3 border-t border-amber-400/40 bg-zinc-950 px-6 py-2.5">
                  <span className="rounded-full bg-amber-400 px-3 py-0.5 text-xs font-black uppercase tracking-widest text-black">
                    MILESTONE
                  </span>
                  <span className="text-base font-black tabular-nums tracking-wider text-white">
                    {sting.detail}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* FREE HIT */}
          {sting.type === "free_hit" && (
            <div className="relative w-full overflow-hidden rounded-3xl border-2 border-amber-400 bg-gradient-to-r from-zinc-950 via-neutral-900 to-zinc-950 shadow-[0_0_60px_rgba(250,204,21,0.6)] backdrop-blur-2xl">
              <div className="flex items-center justify-between bg-amber-400 px-6 py-1.5 text-xs font-black uppercase tracking-widest text-black">
                <span>SONY SPORTS NETWORK · UMPIRE CALL</span>
                <span>PENALTY DELIVERY</span>
              </div>
              <div className="relative flex flex-col items-center justify-center px-8 py-6">
                <h2 className="animate-pulse text-7xl font-black italic tracking-wider text-yellow-300 drop-shadow-[0_4px_24px_rgba(250,204,21,0.9)] md:text-8xl">
                  FREE HIT!
                </h2>
                <p className="mt-2 text-sm font-black uppercase tracking-widest text-white/90 md:text-base">
                  Bowler Overstepped · No Dismissals Except Run Out
                </p>
              </div>
              <div className="border-t border-amber-400/40 bg-zinc-950 px-6 py-2 text-center">
                <span className="text-xs font-black uppercase tracking-wider text-yellow-300">
                  NEXT DELIVERY IS A FREE HIT
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* =================================================================== */}
      {/* 3. SKY SPORTS CRICKET UK / THE ASHES (BRITISH ARCHITECTURAL / NAVY) */}
      {/* =================================================================== */}
      {theme === "skysports" && (
        <div className="animate-stinger-entry relative flex w-full max-w-4xl flex-col items-center px-4">
          {/* FOUR */}
          {sting.type === "four" && (
            <div className="relative w-full overflow-hidden border border-b-4 border-white/20 border-b-red-600 bg-[#03081a] text-white shadow-[0_12px_60px_rgba(4,10,28,0.95)] backdrop-blur-2xl">
              <div className="flex items-center justify-between border-b-2 border-red-600 bg-[#040a1c] px-6 py-1.5 text-xs font-bold uppercase tracking-wider text-slate-300">
                <div className="flex items-center gap-2">
                  <span className="font-black text-red-500">
                    sky sports cricket
                  </span>
                  <span className="text-white/40">·</span>
                  <span className="font-bold text-white">THE ASHES LIVE</span>
                </div>
                <span>BOUNDARY · FOUR RUNS</span>
              </div>

              <div className="relative flex flex-col items-center justify-center bg-gradient-to-b from-[#040b20] to-[#020510] px-8 py-6">
                <h2 className="text-7xl font-black tracking-tight text-white drop-shadow md:text-8xl">
                  FOUR!
                </h2>

                {sting.subtitle && (
                  <p className="mt-2 text-xl font-bold uppercase tracking-wide text-slate-200">
                    {sting.subtitle}
                  </p>
                )}
              </div>

              {sting.detail && (
                <div className="flex items-center justify-between border-t border-white/10 bg-[#020510] px-6 py-2 text-xs font-bold">
                  <span className="uppercase tracking-wider text-red-400">
                    BOUNDARY FOUR RUNS
                  </span>
                  <span className="tabular-nums tracking-wide text-white">
                    {sting.detail}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* SIX */}
          {sting.type === "six" && (
            <div className="relative w-full overflow-hidden border border-b-4 border-white/20 border-b-red-600 bg-[#03081a] text-white shadow-[0_12px_60px_rgba(4,10,28,0.95)] backdrop-blur-2xl">
              <div className="flex items-center justify-between border-b-2 border-red-600 bg-[#040a1c] px-6 py-1.5 text-xs font-bold uppercase tracking-wider text-slate-300">
                <div className="flex items-center gap-2">
                  <span className="font-black text-red-500">
                    sky sports cricket
                  </span>
                  <span className="text-white/40">·</span>
                  <span className="font-bold text-white">MAXIMUM SIX</span>
                </div>
                <span>CLEARS THE BOUNDARY</span>
              </div>

              <div className="relative flex flex-col items-center justify-center bg-gradient-to-b from-[#040b20] to-[#020510] px-8 py-6">
                <h2 className="text-7xl font-black tracking-tight text-amber-300 drop-shadow md:text-8xl">
                  MAXIMUM!
                </h2>

                <p className="mt-1 text-2xl font-black uppercase tracking-widest text-slate-300">
                  THAT&apos;S A HUGE SIX!
                </p>

                {sting.subtitle && (
                  <p className="mt-1 text-lg font-bold tracking-wide text-white">
                    {sting.subtitle}
                  </p>
                )}
              </div>

              {sting.detail && (
                <div className="flex items-center justify-between border-t border-white/10 bg-[#020510] px-6 py-2 text-xs font-bold">
                  <span className="uppercase tracking-wider text-red-400">
                    SIX RUNS
                  </span>
                  <span className="tabular-nums tracking-wide text-white">
                    {sting.detail}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* WICKET */}
          {sting.type === "wicket" && (
            <div className="relative w-full overflow-hidden border border-b-4 border-red-600/60 border-b-red-600 bg-[#03081a] text-white shadow-[0_12px_60px_rgba(4,10,28,0.95)] backdrop-blur-2xl">
              <div className="flex items-center justify-between border-b-2 border-red-600 bg-[#040a1c] px-6 py-1.5 text-xs font-bold uppercase tracking-wider text-slate-300">
                <div className="flex items-center gap-2">
                  <span className="font-black text-red-500">
                    sky sports cricket
                  </span>
                  <span className="text-white/40">·</span>
                  <span className="font-bold text-white">WICKET</span>
                </div>
                <span>DISMISSAL CONFIRMED</span>
              </div>

              <div className="relative flex flex-col items-center justify-center bg-gradient-to-b from-[#0c0410] via-[#040b20] to-[#020510] px-8 py-6">
                <h2 className="text-7xl font-black tracking-tight text-red-500 drop-shadow md:text-8xl">
                  WICKET!
                </h2>

                {sting.subtitle && (
                  <p className="mt-1 text-2xl font-black uppercase tracking-wider text-white">
                    {sting.subtitle}
                  </p>
                )}
              </div>

              {sting.detail && (
                <div className="flex items-center justify-between border-t border-white/10 bg-[#020510] px-6 py-2 text-xs font-bold">
                  <span className="uppercase tracking-wider text-red-500">
                    DISMISSAL
                  </span>
                  <span className="tabular-nums tracking-wide text-amber-300">
                    {sting.detail}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* MILESTONE */}
          {sting.type === "milestone" && (
            <div className="relative w-full overflow-hidden border border-b-4 border-amber-400/40 border-b-amber-500 bg-[#03081a] text-white shadow-[0_12px_60px_rgba(4,10,28,0.95)] backdrop-blur-2xl">
              <div className="flex items-center justify-between border-b-2 border-amber-500 bg-[#040a1c] px-6 py-1.5 text-xs font-bold uppercase tracking-wider text-amber-300">
                <span className="font-black text-red-500">
                  sky sports cricket
                </span>
                <span>TEST MILESTONE</span>
              </div>
              <div className="relative flex flex-col items-center justify-center px-8 py-6">
                <h2 className="text-6xl font-black tracking-tight text-amber-300 md:text-7xl">
                  {sting.title}
                </h2>
                {sting.subtitle && (
                  <p className="mt-1 text-xl font-bold uppercase tracking-wide text-white">
                    {sting.subtitle}
                  </p>
                )}
              </div>
              {sting.detail && (
                <div className="flex items-center justify-between border-t border-white/10 bg-[#020510] px-6 py-2 text-xs font-bold text-slate-300">
                  <span className="text-amber-400">MILESTONE</span>
                  <span>{sting.detail}</span>
                </div>
              )}
            </div>
          )}

          {/* FREE HIT */}
          {sting.type === "free_hit" && (
            <div className="relative w-full overflow-hidden border border-b-4 border-white/20 border-b-red-600 bg-[#03081a] text-white shadow-[0_12px_60px_rgba(4,10,28,0.95)]">
              <div className="flex items-center justify-between border-b-2 border-red-600 bg-[#040a1c] px-6 py-1.5 text-xs font-bold uppercase tracking-wider text-slate-300">
                <span className="font-black text-red-500">
                  sky sports cricket
                </span>
                <span>NO BALL</span>
              </div>
              <div className="relative flex flex-col items-center justify-center px-8 py-6">
                <h2 className="text-7xl font-black tracking-tight text-red-500 md:text-8xl">
                  FREE HIT!
                </h2>
                <p className="mt-2 text-sm font-bold uppercase tracking-widest text-slate-200 md:text-base">
                  Bowler Overstepped · No Dismissals Except Run Out
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* =================================================================== */}
      {/* 4. THE HUNDRED (POP-ART / NEON PINK & CYAN / COMIC EXPLOSION)       */}
      {/* =================================================================== */}
      {theme === "thehundred" && (
        <div className="animate-stinger-entry relative flex w-full max-w-4xl flex-col items-center px-4">
          {/* FOUR */}
          {sting.type === "four" && (
            <div className="relative w-full overflow-hidden border-4 border-pink-500 bg-[#0d0114] text-white shadow-[0_0_70px_rgba(236,72,153,0.7)]">
              <div className="flex items-center justify-between bg-pink-600 px-6 py-1.5 text-xs font-black uppercase tracking-wider text-white">
                <span>THE HUNDRED · BALLS COUNTDOWN CRICKET</span>
                <span>OH YEAH! 4 RUNS!</span>
              </div>

              <div className="relative flex flex-col items-center justify-center bg-black px-8 py-6">
                <div className="flex items-center justify-center gap-3">
                  <span className="text-4xl text-pink-500">⚡</span>
                  <h2 className="text-8xl font-black italic tracking-tighter text-cyan-300 drop-shadow-[5px_5px_0px_#ec4899] md:text-9xl">
                    FOUR!
                  </h2>
                  <span className="text-4xl text-pink-500">⚡</span>
                </div>

                {sting.subtitle && (
                  <p className="mt-2 text-2xl font-black uppercase tracking-wide text-white">
                    {sting.subtitle}
                  </p>
                )}
              </div>

              {sting.detail && (
                <div className="bg-cyan-400 px-6 py-2 text-center text-sm font-black text-black">
                  {sting.detail}
                </div>
              )}
            </div>
          )}

          {/* SIX */}
          {sting.type === "six" && (
            <div className="relative w-full overflow-hidden border-4 border-yellow-400 bg-[#0d0114] text-white shadow-[0_0_80px_rgba(250,204,21,0.8)]">
              <div className="flex items-center justify-between bg-yellow-400 px-6 py-1.5 text-xs font-black uppercase tracking-wider text-black">
                <span>THE HUNDRED · MAXIMUM OVER THE ROPES</span>
                <span>6 RUNS!</span>
              </div>

              <div className="relative flex flex-col items-center justify-center bg-black px-8 py-6">
                <h2 className="text-8xl font-black italic tracking-tighter text-yellow-300 drop-shadow-[6px_6px_0px_#ec4899] md:text-9xl">
                  MAXIMUM!
                </h2>

                <p className="mt-1 text-2xl font-black uppercase tracking-widest text-pink-500">
                  THAT&apos;S A HUGE SIX!
                </p>

                {sting.subtitle && (
                  <p className="mt-1 text-xl font-black tracking-wide text-white">
                    {sting.subtitle}
                  </p>
                )}
              </div>

              {sting.detail && (
                <div className="bg-pink-600 px-6 py-2 text-center text-sm font-black text-white">
                  {sting.detail}
                </div>
              )}
            </div>
          )}

          {/* WICKET */}
          {sting.type === "wicket" && (
            <div className="relative w-full overflow-hidden border-4 border-pink-600 bg-black text-white shadow-[0_0_80px_rgba(236,72,153,0.8)]">
              <div className="flex items-center justify-between bg-pink-600 px-6 py-1.5 text-xs font-black uppercase tracking-wider text-white">
                <span>THE HUNDRED · OUT!</span>
                <span>BATTER WALKS</span>
              </div>

              <div className="relative flex flex-col items-center justify-center px-8 py-6">
                <h2 className="text-8xl font-black italic tracking-tighter text-pink-500 drop-shadow-[6px_6px_0px_#ffffff] md:text-9xl">
                  WICKET!
                </h2>

                {sting.subtitle && (
                  <p className="mt-1 text-2xl font-black uppercase tracking-wider text-white">
                    {sting.subtitle}
                  </p>
                )}
              </div>

              {sting.detail && (
                <div className="border-t border-pink-500/40 bg-neutral-900 px-6 py-2.5 text-center text-base font-black text-yellow-300">
                  {sting.detail}
                </div>
              )}
            </div>
          )}

          {/* MILESTONE */}
          {sting.type === "milestone" && (
            <div className="relative w-full overflow-hidden border-4 border-yellow-300 bg-[#0d0114] text-white">
              <div className="flex items-center justify-between bg-yellow-300 px-6 py-1.5 text-xs font-black uppercase tracking-wider text-black">
                <span>THE HUNDRED · MILESTONE</span>
                <span>50 UP!</span>
              </div>
              <div className="relative flex flex-col items-center justify-center px-8 py-6">
                <h2 className="text-7xl font-black tracking-tight text-yellow-300 drop-shadow-[5px_5px_0px_#ec4899] md:text-8xl">
                  {sting.title}
                </h2>
                {sting.subtitle && (
                  <p className="mt-1 text-2xl font-black uppercase tracking-wide text-white">
                    {sting.subtitle}
                  </p>
                )}
              </div>
              {sting.detail && (
                <div className="bg-cyan-400 px-6 py-2 text-center text-sm font-black text-black">
                  {sting.detail}
                </div>
              )}
            </div>
          )}

          {/* FREE HIT */}
          {sting.type === "free_hit" && (
            <div className="relative w-full overflow-hidden border-4 border-cyan-400 bg-black text-white">
              <div className="flex items-center justify-between bg-cyan-400 px-6 py-1.5 text-xs font-black uppercase tracking-widest text-black">
                <span>THE HUNDRED · FREE HIT!</span>
                <span>NEXT BALL COUNTS</span>
              </div>
              <div className="relative flex flex-col items-center justify-center px-8 py-6">
                <h2 className="text-8xl font-black italic tracking-wider text-cyan-300 drop-shadow-[5px_5px_0px_#ec4899] md:text-9xl">
                  FREE HIT!
                </h2>
                <p className="mt-2 text-sm font-black uppercase tracking-widest text-white/90 md:text-base">
                  Bowler Overstepped · No Dismissals Except Run Out
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* =================================================================== */}
      {/* 5. APEX FRANCHISE GOLD (24K GOLD CHROME / CARBON WEAVE / EMBERS)    */}
      {/* =================================================================== */}
      {theme === "apex" && (
        <div className="animate-stinger-entry relative flex w-full max-w-4xl flex-col items-center px-4">
          {/* FOUR */}
          {sting.type === "four" && (
            <div className="clip-chamfer-both carbon-matrix relative w-full overflow-hidden border-2 border-amber-400/90 shadow-[0_0_80px_rgba(245,158,11,0.5)] backdrop-blur-2xl">
              <div className="animate-light-sweep pointer-events-none absolute inset-0 -skew-x-12 bg-gradient-to-r from-transparent via-amber-300/30 to-transparent" />
              <div className="flex items-center justify-between bg-gradient-to-r from-amber-600 via-yellow-500 to-amber-600 px-6 py-1.5 text-[11px] font-black uppercase tracking-widest text-black">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-black text-black">✦</span>
                  <span>APEX BROADCAST · 24K GOLD BOUNDARY</span>
                </div>
                <div className="flex items-center gap-1.5 font-black">
                  <span>CRACKING FOUR</span>
                  <span>•</span>
                  <span>SWEPT PAST EXTRA COVER</span>
                </div>
              </div>
              <div className="relative flex flex-col items-center justify-center px-8 py-6">
                <div className="flex items-center justify-center gap-4">
                  <span className="animate-sparkle text-3xl font-black text-amber-300">
                    ✦
                  </span>
                  <h2 className="bg-gradient-to-r from-yellow-200 via-amber-400 to-yellow-100 bg-clip-text text-7xl font-black tracking-widest text-transparent drop-shadow-[0_4px_30px_rgba(245,158,11,0.95)] md:text-8xl">
                    APEX 4!
                  </h2>
                  <span className="animate-sparkle text-3xl font-black text-amber-300 [animation-delay:0.5s]">
                    ✦
                  </span>
                </div>
                {sting.subtitle && (
                  <p className="mt-1 text-2xl font-black uppercase tracking-widest text-amber-200 drop-shadow">
                    {sting.subtitle}
                  </p>
                )}
              </div>
              {sting.detail && (
                <div className="flex items-center justify-center gap-3 border-t border-amber-400/40 bg-black/90 px-6 py-2">
                  <span className="rounded bg-gradient-to-r from-amber-500 to-yellow-400 px-2.5 py-0.5 text-xs font-black uppercase tracking-widest text-black">
                    EXIT SPEED
                  </span>
                  <span className="text-base font-black tabular-nums tracking-wider text-amber-300">
                    {sting.detail}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* SIX */}
          {sting.type === "six" && (
            <div className="clip-chamfer-both carbon-matrix relative w-full overflow-hidden border-2 border-yellow-400 shadow-[0_0_100px_rgba(234,179,8,0.7)] backdrop-blur-2xl">
              <div className="animate-light-sweep pointer-events-none absolute inset-0 -skew-x-12 bg-gradient-to-r from-transparent via-yellow-200/40 to-transparent" />
              <div className="flex items-center justify-between bg-gradient-to-r from-yellow-500 via-amber-400 to-yellow-600 px-6 py-1.5 text-[11px] font-black uppercase tracking-widest text-black">
                <div className="flex items-center gap-2">
                  <span className="text-base">🏆</span>
                  <span>APEX FRANCHISE · MAXIMUM IMPACT</span>
                </div>
                <div className="flex items-center gap-1.5 font-black">
                  <span>DISPATCHED OVER THE STANDS</span>
                  <span>•</span>
                  <span>108 METRES</span>
                </div>
              </div>
              <div className="relative flex flex-col items-center justify-center px-8 py-7">
                <div className="flex items-center justify-center gap-4">
                  <span className="animate-sparkle text-4xl text-yellow-300">
                    ★
                  </span>
                  <h2 className="bg-gradient-to-r from-yellow-100 via-amber-300 to-yellow-200 bg-clip-text text-7xl font-black tracking-widest text-transparent drop-shadow-[0_4px_35px_rgba(250,204,21,1)] md:text-9xl">
                    MAXIMUM!
                  </h2>
                  <span className="animate-sparkle text-4xl text-yellow-300 [animation-delay:0.7s]">
                    ★
                  </span>
                </div>
                <p className="mt-1 text-2xl font-black uppercase tracking-widest text-amber-300 drop-shadow">
                  MONSTER SIX INTO THE TOP TIER!
                </p>
                {sting.subtitle && (
                  <p className="mt-1 text-xl font-bold tracking-wide text-white/90 drop-shadow">
                    {sting.subtitle}
                  </p>
                )}
              </div>
              {sting.detail && (
                <div className="flex items-center justify-center gap-3 border-t border-yellow-400/40 bg-black/90 px-6 py-2">
                  <span className="rounded bg-yellow-400 px-2.5 py-0.5 text-xs font-black uppercase tracking-widest text-black">
                    APEX STATS
                  </span>
                  <span className="text-base font-black tabular-nums tracking-wider text-yellow-300">
                    {sting.detail}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* WICKET */}
          {sting.type === "wicket" && (
            <div className="clip-chamfer-both carbon-matrix relative w-full overflow-hidden border-2 border-red-500 shadow-[0_0_90px_rgba(239,68,68,0.7)] backdrop-blur-2xl">
              <div className="flex items-center justify-between bg-gradient-to-r from-red-600 via-rose-600 to-red-700 px-6 py-1.5 text-[11px] font-black uppercase tracking-widest text-white">
                <div className="flex items-center gap-2">
                  <span className="inline-block h-2.5 w-2.5 rotate-45 animate-ping bg-white" />
                  <span>APEX FRANCHISE · DISMISSAL CONFIRMED</span>
                </div>
                <div className="font-black">STUMP CARTWHEELED</div>
              </div>
              <div className="relative flex flex-col items-center justify-center bg-gradient-to-b from-red-950/40 via-black/80 to-red-950/40 px-8 py-7">
                <div className="flex items-center justify-center gap-4">
                  <span className="text-4xl font-black text-red-500">†</span>
                  <h2 className="bg-gradient-to-r from-red-400 via-white to-red-500 bg-clip-text text-7xl font-black tracking-widest text-transparent drop-shadow-[0_4px_35px_rgba(239,68,68,0.95)] md:text-9xl">
                    WICKET!
                  </h2>
                  <span className="text-4xl font-black text-red-500">†</span>
                </div>
                {sting.subtitle && (
                  <p className="mt-1 text-2xl font-black uppercase tracking-wider text-white drop-shadow">
                    {sting.subtitle}
                  </p>
                )}
              </div>
              {sting.detail && (
                <div className="flex items-center justify-center gap-3 border-t border-red-500/40 bg-black px-6 py-2">
                  <span className="rounded bg-red-600 px-2.5 py-0.5 text-xs font-black uppercase tracking-widest text-white">
                    FALL OF WICKET
                  </span>
                  <span className="text-base font-black tabular-nums tracking-wider text-red-300">
                    {sting.detail}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* MILESTONE */}
          {sting.type === "milestone" && (
            <div className="clip-chamfer-both carbon-matrix relative w-full overflow-hidden border-2 border-amber-400 shadow-[0_0_90px_rgba(245,158,11,0.7)] backdrop-blur-2xl">
              <div className="animate-light-sweep pointer-events-none absolute inset-0 -skew-x-12 bg-gradient-to-r from-transparent via-amber-300/30 to-transparent" />
              <div className="flex items-center justify-between bg-gradient-to-r from-amber-600 via-yellow-500 to-amber-600 px-6 py-1.5 text-[11px] font-black uppercase tracking-widest text-black">
                <div className="flex items-center gap-2">
                  <span className="text-base">👑</span>
                  <span>APEX GOLD · MILESTONE HONOURS</span>
                </div>
                <div className="font-black">WORLD CLASS KNOCK</div>
              </div>
              <div className="relative flex flex-col items-center justify-center px-8 py-6">
                <div className="flex items-center justify-center gap-4">
                  <span className="text-4xl text-amber-300">♛</span>
                  <h2 className="bg-gradient-to-r from-yellow-200 via-white to-amber-300 bg-clip-text text-6xl font-black tracking-widest text-transparent drop-shadow-[0_4px_30px_rgba(245,158,11,0.95)] md:text-8xl">
                    {sting.title}
                  </h2>
                  <span className="text-4xl text-amber-300">♛</span>
                </div>
                {sting.subtitle && (
                  <p className="mt-1 text-2xl font-black uppercase tracking-wide text-amber-200 drop-shadow">
                    {sting.subtitle}
                  </p>
                )}
              </div>
              {sting.detail && (
                <div className="flex items-center justify-center gap-3 border-t border-amber-400/40 bg-black px-6 py-2">
                  <span className="rounded bg-amber-400 px-2.5 py-0.5 text-xs font-black uppercase tracking-widest text-black">
                    MILESTONE
                  </span>
                  <span className="text-base font-black tabular-nums tracking-wider text-amber-300">
                    {sting.detail}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* FREE HIT */}
          {sting.type === "free_hit" && (
            <div className="clip-chamfer-both relative w-full overflow-hidden border-2 border-yellow-400 bg-black/95 shadow-[0_0_80px_rgba(250,204,21,0.8)] backdrop-blur-2xl">
              <div className="flex items-center justify-between bg-yellow-400 px-6 py-1.5 text-[11px] font-black uppercase tracking-widest text-black">
                <div className="flex items-center gap-2">
                  <span className="inline-block h-2.5 w-2.5 rotate-45 animate-ping bg-black" />
                  <span>APEX UMPIRE CALL · NO-BALL</span>
                </div>
                <div className="font-black">OVERSTEPPING PENALTY</div>
              </div>
              <div className="relative flex flex-col items-center justify-center px-8 py-6">
                <div className="flex items-center justify-center gap-4">
                  <span className="text-4xl text-yellow-400">⚡</span>
                  <h2 className="animate-pulse text-7xl font-black italic tracking-widest text-yellow-300 drop-shadow-[0_4px_30px_rgba(250,204,21,0.95)] md:text-8xl">
                    FREE HIT!
                  </h2>
                  <span className="text-4xl text-yellow-400">⚡</span>
                </div>
                <p className="mt-1 text-base font-black uppercase tracking-widest text-white/90">
                  Free Hit Awarded · Striker Cannot Be Dismissed
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* =================================================================== */}
      {/* 6. VOLT SPORTS-TECH (CYBER NEON / HIGH VOLTAGE / LIGHTNING BOLTS)    */}
      {/* =================================================================== */}
      {theme === "volt" && (
        <div className="animate-stinger-entry relative flex w-full max-w-4xl flex-col items-center px-4 font-mono">
          {/* FOUR */}
          {sting.type === "four" && (
            <div className="bg-[#020904]/98 clip-slant-right relative w-full overflow-hidden border-2 border-lime-400 shadow-[0_0_80px_rgba(0,255,102,0.5)] backdrop-blur-2xl">
              <div className="animate-lightning-flash pointer-events-none absolute inset-0 bg-gradient-to-r from-lime-500/10 via-cyan-400/20 to-lime-500/10" />
              <div className="flex items-center justify-between border-b border-lime-400/40 bg-black px-6 py-1.5 font-mono text-[11px] font-black uppercase tracking-widest text-lime-400">
                <div className="flex items-center gap-2">
                  <svg
                    className="animate-lightning-flash h-4 w-4 fill-lime-400"
                    viewBox="0 0 24 24"
                  >
                    <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
                  </svg>
                  <span>VOLT SPORTS-TECH · HIGH-VOLTAGE BOUNDARY</span>
                </div>
                <div className="flex items-center gap-2 text-cyan-300">
                  <span>[ EXIT: 151.2 KM/H ]</span>
                  <span>•</span>
                  <span>TRACE LASER 4</span>
                </div>
              </div>
              <div className="relative flex flex-col items-center justify-center bg-neutral-950/80 px-8 py-6">
                <div className="flex items-center justify-center gap-4">
                  <span className="font-mono text-2xl font-black text-cyan-400">
                    &lt;// VOLT //&gt;
                  </span>
                  <h2 className="bg-gradient-to-r from-lime-300 via-white to-cyan-300 bg-clip-text text-7xl font-black italic tracking-wider text-transparent drop-shadow-[0_0_40px_rgba(0,255,102,1)] md:text-9xl">
                    FOUR!
                  </h2>
                  <span className="font-mono text-2xl font-black text-cyan-400">
                    &lt;// VOLT //&gt;
                  </span>
                </div>
                {sting.subtitle && (
                  <p className="mt-1 font-mono text-2xl font-black uppercase tracking-wide text-white drop-shadow">
                    {sting.subtitle}
                  </p>
                )}
              </div>
              {sting.detail && (
                <div className="flex items-center justify-center gap-3 border-t border-lime-400/30 bg-black px-6 py-2">
                  <span className="rounded bg-lime-400 px-2.5 py-0.5 font-mono text-xs font-black uppercase tracking-widest text-black">
                    VOLT RADAR
                  </span>
                  <span className="text-base font-black tabular-nums tracking-wider text-lime-300">
                    {sting.detail}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* SIX */}
          {sting.type === "six" && (
            <div className="bg-[#01080d]/98 clip-slant-right relative w-full overflow-hidden border-2 border-cyan-400 shadow-[0_0_90px_rgba(0,240,255,0.6)] backdrop-blur-2xl">
              <div className="animate-lightning-flash pointer-events-none absolute inset-0 bg-gradient-to-r from-cyan-500/15 via-lime-400/25 to-cyan-500/15" />
              <div className="flex items-center justify-between border-b border-cyan-400/40 bg-black px-6 py-1.5 font-mono text-[11px] font-black uppercase tracking-widest text-cyan-400">
                <div className="flex items-center gap-2">
                  <svg
                    className="animate-lightning-flash h-4 w-4 fill-cyan-400"
                    viewBox="0 0 24 24"
                  >
                    <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
                  </svg>
                  <span>VOLT TELEMETRY · MAXIMUM VOLTAGE</span>
                </div>
                <div className="flex items-center gap-2 text-lime-400">
                  <span>[ DISTANCE: 114 METRES ]</span>
                  <span>•</span>
                  <span>LAUNCH ANGLE: 31°</span>
                </div>
              </div>
              <div className="relative flex flex-col items-center justify-center bg-neutral-950/80 px-8 py-7">
                <div className="flex items-center justify-center gap-4">
                  <span className="font-mono text-3xl font-black text-lime-400">
                    ⚡
                  </span>
                  <h2 className="bg-gradient-to-r from-cyan-300 via-lime-300 to-white bg-clip-text text-7xl font-black italic tracking-widest text-transparent drop-shadow-[0_0_45px_rgba(0,240,255,1)] md:text-9xl">
                    MAXIMUM!
                  </h2>
                  <span className="font-mono text-3xl font-black text-lime-400">
                    ⚡
                  </span>
                </div>
                <p className="mt-1 font-mono text-2xl font-black uppercase tracking-widest text-lime-300 drop-shadow">
                  OVER THE STADIUM ROOF!
                </p>
                {sting.subtitle && (
                  <p className="mt-1 font-mono text-xl font-bold tracking-wide text-white drop-shadow">
                    {sting.subtitle}
                  </p>
                )}
              </div>
              {sting.detail && (
                <div className="flex items-center justify-center gap-3 border-t border-cyan-400/30 bg-black px-6 py-2">
                  <span className="rounded bg-cyan-400 px-2.5 py-0.5 font-mono text-xs font-black uppercase tracking-widest text-black">
                    POWER RATING
                  </span>
                  <span className="text-base font-black tabular-nums tracking-wider text-cyan-300">
                    {sting.detail}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* WICKET */}
          {sting.type === "wicket" && (
            <div className="bg-[#0d0202]/98 clip-slant-right relative w-full overflow-hidden border-2 border-red-500 shadow-[0_0_90px_rgba(239,68,68,0.7)] backdrop-blur-2xl">
              <div className="flex items-center justify-between border-b border-red-500/40 bg-black px-6 py-1.5 font-mono text-[11px] font-black uppercase tracking-widest text-red-400">
                <div className="flex items-center gap-2">
                  <span className="inline-block h-2.5 w-2.5 animate-ping bg-red-500" />
                  <span>VOLT SENSORS · CIRCUIT BREAKER TRIPPED</span>
                </div>
                <div className="text-white/90">DISMISSAL CONFIRMED</div>
              </div>
              <div className="relative flex flex-col items-center justify-center bg-black/80 px-8 py-7">
                <div className="flex items-center justify-center gap-4">
                  <span className="font-mono text-3xl font-black text-red-500">
                    [// OUT //]
                  </span>
                  <h2 className="bg-gradient-to-r from-red-400 via-white to-red-500 bg-clip-text text-7xl font-black italic tracking-widest text-transparent drop-shadow-[0_0_40px_rgba(239,68,68,1)] md:text-9xl">
                    WICKET!
                  </h2>
                  <span className="font-mono text-3xl font-black text-red-500">
                    [// OUT //]
                  </span>
                </div>
                {sting.subtitle && (
                  <p className="mt-1 font-mono text-2xl font-black uppercase tracking-wide text-white drop-shadow">
                    {sting.subtitle}
                  </p>
                )}
              </div>
              {sting.detail && (
                <div className="flex items-center justify-center gap-3 border-t border-red-500/30 bg-black px-6 py-2">
                  <span className="rounded bg-red-600 px-2.5 py-0.5 font-mono text-xs font-black uppercase tracking-widest text-white">
                    SYSTEM TRIP
                  </span>
                  <span className="text-base font-black tabular-nums tracking-wider text-red-300">
                    {sting.detail}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* MILESTONE */}
          {sting.type === "milestone" && (
            <div className="bg-[#030905]/98 clip-slant-right relative w-full overflow-hidden border-2 border-lime-400 shadow-[0_0_90px_rgba(0,255,102,0.6)] backdrop-blur-2xl">
              <div className="flex items-center justify-between border-b border-lime-400/40 bg-black px-6 py-1.5 font-mono text-[11px] font-black uppercase tracking-widest text-lime-400">
                <div className="flex items-center gap-2">
                  <span className="text-base">⚡</span>
                  <span>VOLT HIGH SCORE · BATSMAN TELEMETRY</span>
                </div>
                <div className="font-bold text-cyan-300">
                  50+ BENCHMARK EXCEEDED
                </div>
              </div>
              <div className="relative flex flex-col items-center justify-center bg-black/80 px-8 py-6">
                <div className="flex items-center justify-center gap-4">
                  <span className="font-mono text-3xl font-black text-lime-400">
                    ✦
                  </span>
                  <h2 className="bg-gradient-to-r from-lime-300 via-white to-cyan-300 bg-clip-text text-6xl font-black italic tracking-widest text-transparent drop-shadow-[0_0_35px_rgba(0,255,102,0.95)] md:text-8xl">
                    {sting.title}
                  </h2>
                  <span className="font-mono text-3xl font-black text-lime-400">
                    ✦
                  </span>
                </div>
                {sting.subtitle && (
                  <p className="mt-1 font-mono text-2xl font-black uppercase tracking-wide text-white drop-shadow">
                    {sting.subtitle}
                  </p>
                )}
              </div>
              {sting.detail && (
                <div className="flex items-center justify-center gap-3 border-t border-lime-400/30 bg-black px-6 py-2">
                  <span className="rounded bg-lime-400 px-2.5 py-0.5 font-mono text-xs font-black uppercase tracking-widest text-black">
                    ANALYSIS
                  </span>
                  <span className="text-base font-black tabular-nums tracking-wider text-lime-300">
                    {sting.detail}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* FREE HIT */}
          {sting.type === "free_hit" && (
            <div className="bg-black/98 clip-slant-right relative w-full overflow-hidden border-2 border-yellow-400 shadow-[0_0_80px_rgba(250,204,21,0.8)] backdrop-blur-2xl">
              <div className="flex items-center justify-between bg-yellow-400 px-6 py-1.5 font-mono text-[11px] font-black uppercase tracking-widest text-black">
                <div className="flex items-center gap-2">
                  <span className="inline-block h-2.5 w-2.5 rotate-45 animate-ping bg-black" />
                  <span>VOLT SAFETY PROTOCOL · NO BALL</span>
                </div>
                <div className="font-black">FREE HIT ENGAGED</div>
              </div>
              <div className="relative flex flex-col items-center justify-center px-8 py-6">
                <div className="flex items-center justify-center gap-4">
                  <span className="font-mono text-3xl font-black text-yellow-400">
                    ⚡
                  </span>
                  <h2 className="animate-pulse text-7xl font-black italic tracking-widest text-yellow-300 drop-shadow-[0_0_35px_rgba(250,204,21,0.95)] md:text-8xl">
                    FREE HIT!
                  </h2>
                  <span className="font-mono text-3xl font-black text-yellow-400">
                    ⚡
                  </span>
                </div>
                <p className="mt-1 font-mono text-sm font-bold uppercase tracking-widest text-white/90">
                  Bowler Exceeded Line · Free Swing Authorized
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* =================================================================== */}
      {/* 7. THUNDER VELOCITY (LIGHTNING SHOCKWAVES / COBALT STORM)           */}
      {/* =================================================================== */}
      {theme === "thunder" && (
        <div className="animate-stinger-entry relative flex w-full max-w-4xl flex-col items-center px-4">
          {/* Shockwave Aura Rings */}
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="animate-shockwave h-80 w-80 rounded-full border-2 border-blue-400/40" />
            <div className="animate-shockwave h-96 w-96 rounded-full border border-yellow-400/30 [animation-delay:0.5s]" />
          </div>

          {/* FOUR */}
          {sting.type === "four" && (
            <div className="from-[#030a24]/98 via-[#091a4f]/98 to-[#030a24]/98 relative w-full overflow-hidden rounded-2xl border-2 border-blue-400 bg-gradient-to-r shadow-[0_0_80px_rgba(59,130,246,0.6)] backdrop-blur-2xl">
              <div className="flex items-center justify-between bg-blue-600 px-6 py-1.5 text-[11px] font-black uppercase tracking-widest text-white">
                <div className="flex items-center gap-2">
                  <span className="text-yellow-300">⚡</span>
                  <span>THUNDER VELOCITY · LIGHTNING FOUR</span>
                </div>
                <div className="font-black text-yellow-300">
                  BULLET BOUNDARY
                </div>
              </div>
              <div className="relative flex flex-col items-center justify-center px-8 py-6">
                <div className="flex items-center justify-center gap-4">
                  <span className="text-3xl font-black text-yellow-300">
                    ⚡
                  </span>
                  <h2 className="bg-gradient-to-r from-yellow-300 via-white to-blue-300 bg-clip-text text-7xl font-black italic tracking-widest text-transparent drop-shadow-[0_4px_35px_rgba(59,130,246,1)] md:text-9xl">
                    FOUR!
                  </h2>
                  <span className="text-3xl font-black text-yellow-300">
                    ⚡
                  </span>
                </div>
                {sting.subtitle && (
                  <p className="mt-1 text-2xl font-black uppercase tracking-wider text-white drop-shadow">
                    {sting.subtitle}
                  </p>
                )}
              </div>
              {sting.detail && (
                <div className="flex items-center justify-center gap-3 border-t border-blue-400/30 bg-black/80 px-6 py-2">
                  <span className="rounded bg-yellow-400 px-2.5 py-0.5 text-xs font-black uppercase tracking-widest text-black">
                    THUNDER SPEED
                  </span>
                  <span className="text-base font-black tabular-nums tracking-wider text-blue-200">
                    {sting.detail}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* SIX */}
          {sting.type === "six" && (
            <div className="from-[#030a24]/98 via-[#0c2266]/98 to-[#030a24]/98 relative w-full overflow-hidden rounded-2xl border-2 border-yellow-400 bg-gradient-to-r shadow-[0_0_100px_rgba(250,204,21,0.8)] backdrop-blur-2xl">
              <div className="flex items-center justify-between bg-gradient-to-r from-yellow-500 via-amber-400 to-yellow-500 px-6 py-1.5 text-[11px] font-black uppercase tracking-widest text-black">
                <div className="flex items-center gap-2">
                  <span className="text-base">⚡</span>
                  <span>THUNDER VELOCITY · MAXIMUM BLAST</span>
                </div>
                <div className="font-black">OUT OF THE STADIUM</div>
              </div>
              <div className="relative flex flex-col items-center justify-center px-8 py-7">
                <div className="flex items-center justify-center gap-4">
                  <span className="animate-bounce text-4xl text-yellow-300">
                    ⚡
                  </span>
                  <h2 className="bg-gradient-to-r from-yellow-200 via-white to-yellow-400 bg-clip-text text-7xl font-black italic tracking-widest text-transparent drop-shadow-[0_4px_40px_rgba(250,204,21,1)] md:text-9xl">
                    MAXIMUM!
                  </h2>
                  <span className="animate-bounce text-4xl text-yellow-300">
                    ⚡
                  </span>
                </div>
                <p className="mt-1 text-2xl font-black uppercase tracking-widest text-yellow-300 drop-shadow">
                  MONSTER THUNDERBOLT SIX!
                </p>
                {sting.subtitle && (
                  <p className="mt-1 text-xl font-bold tracking-wide text-white drop-shadow">
                    {sting.subtitle}
                  </p>
                )}
              </div>
              {sting.detail && (
                <div className="flex items-center justify-center gap-3 border-t border-yellow-400/40 bg-black/80 px-6 py-2">
                  <span className="rounded bg-yellow-400 px-2.5 py-0.5 text-xs font-black uppercase tracking-widest text-black">
                    STRIKE METRICS
                  </span>
                  <span className="text-base font-black tabular-nums tracking-wider text-yellow-300">
                    {sting.detail}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* WICKET */}
          {sting.type === "wicket" && (
            <div className="bg-[#0e0204]/98 relative w-full overflow-hidden rounded-2xl border-2 border-red-500 shadow-[0_0_90px_rgba(239,68,68,0.8)] backdrop-blur-2xl">
              <div className="flex items-center justify-between bg-red-600 px-6 py-1.5 text-[11px] font-black uppercase tracking-widest text-white">
                <div className="flex items-center gap-2">
                  <span className="inline-block h-2.5 w-2.5 rotate-45 animate-ping bg-white" />
                  <span>THUNDER CRICKET · TIMBER SHATTERED</span>
                </div>
                <div className="font-black">CLEAN BOWLED!</div>
              </div>
              <div className="relative flex flex-col items-center justify-center bg-black/70 px-8 py-7">
                <div className="flex items-center justify-center gap-4">
                  <span className="text-4xl font-black text-red-500">⚡</span>
                  <h2 className="bg-gradient-to-r from-red-400 via-white to-red-500 bg-clip-text text-7xl font-black italic tracking-widest text-transparent drop-shadow-[0_4px_35px_rgba(239,68,68,1)] md:text-9xl">
                    WICKET!
                  </h2>
                  <span className="text-4xl font-black text-red-500">⚡</span>
                </div>
                {sting.subtitle && (
                  <p className="mt-1 text-2xl font-black uppercase tracking-wide text-white drop-shadow">
                    {sting.subtitle}
                  </p>
                )}
              </div>
              {sting.detail && (
                <div className="flex items-center justify-center gap-3 border-t border-red-500/30 bg-black px-6 py-2">
                  <span className="rounded bg-red-600 px-2.5 py-0.5 text-xs font-black uppercase tracking-widest text-white">
                    DISMISSAL
                  </span>
                  <span className="text-base font-black tabular-nums tracking-wider text-red-300">
                    {sting.detail}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* MILESTONE */}
          {sting.type === "milestone" && (
            <div className="bg-[#030a24]/98 relative w-full overflow-hidden rounded-2xl border-2 border-yellow-400 shadow-[0_0_90px_rgba(250,204,21,0.7)] backdrop-blur-2xl">
              <div className="flex items-center justify-between bg-yellow-400 px-6 py-1.5 text-[11px] font-black uppercase tracking-widest text-black">
                <div className="flex items-center gap-2">
                  <span className="text-base">👑</span>
                  <span>THUNDER VELOCITY · MILESTONE KNOCK</span>
                </div>
                <div className="font-black">SENSATIONAL INNINGS</div>
              </div>
              <div className="relative flex flex-col items-center justify-center px-8 py-6">
                <div className="flex items-center justify-center gap-4">
                  <span className="text-4xl text-yellow-400">♛</span>
                  <h2 className="bg-gradient-to-r from-yellow-200 via-white to-yellow-400 bg-clip-text text-6xl font-black tracking-widest text-transparent drop-shadow-[0_4px_30px_rgba(250,204,21,0.95)] md:text-8xl">
                    {sting.title}
                  </h2>
                  <span className="text-4xl text-yellow-400">♛</span>
                </div>
                {sting.subtitle && (
                  <p className="mt-1 text-2xl font-black uppercase tracking-wide text-white drop-shadow">
                    {sting.subtitle}
                  </p>
                )}
              </div>
              {sting.detail && (
                <div className="flex items-center justify-center gap-3 border-t border-yellow-400/30 bg-black px-6 py-2">
                  <span className="rounded bg-yellow-400 px-2.5 py-0.5 text-xs font-black uppercase tracking-widest text-black">
                    RECORD
                  </span>
                  <span className="text-base font-black tabular-nums tracking-wider text-yellow-300">
                    {sting.detail}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* FREE HIT */}
          {sting.type === "free_hit" && (
            <div className="relative w-full overflow-hidden rounded-2xl border-2 border-yellow-400 bg-black/95 shadow-[0_0_80px_rgba(250,204,21,0.8)] backdrop-blur-2xl">
              <div className="flex items-center justify-between bg-yellow-400 px-6 py-1.5 text-[11px] font-black uppercase tracking-widest text-black">
                <div className="flex items-center gap-2">
                  <span className="inline-block h-2.5 w-2.5 rotate-45 animate-ping bg-black" />
                  <span>THUNDER WARNING · NO-BALL</span>
                </div>
                <div className="font-black">FREE HIT AVAILABLE</div>
              </div>
              <div className="relative flex flex-col items-center justify-center px-8 py-6">
                <div className="flex items-center justify-center gap-4">
                  <span className="text-4xl text-yellow-400">⚡</span>
                  <h2 className="animate-pulse text-7xl font-black italic tracking-widest text-yellow-300 drop-shadow-[0_0_35px_rgba(250,204,21,0.95)] md:text-8xl">
                    FREE HIT!
                  </h2>
                  <span className="text-4xl text-yellow-400">⚡</span>
                </div>
                <p className="mt-1 text-base font-black uppercase tracking-widest text-white/90">
                  Unrestricted Strike · Batsman Free to Attack
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* =================================================================== */}
      {/* 8. DHARMA HERITAGE ROYALE (CRIMSON & SAFFRON GOLD ORNAMENTAL)       */}
      {/* =================================================================== */}
      {theme === "dharma" && (
        <div className="animate-banner-unfurl relative flex w-full max-w-4xl flex-col items-center px-4 font-serif">
          {/* Rotating Mandala Background Orbit */}
          <div className="animate-cosmic-orbit pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full border border-dashed border-amber-400/20" />

          {/* FOUR */}
          {sting.type === "four" && (
            <div className="relative w-full overflow-hidden rounded-3xl border-2 border-amber-400/90 bg-gradient-to-r from-[#200508] via-[#380911] to-[#200508] shadow-[0_0_70px_rgba(153,27,27,0.7)] backdrop-blur-2xl">
              <div className="flex items-center justify-between bg-gradient-to-r from-amber-600 via-yellow-500 to-amber-600 px-6 py-1.5 text-[11px] font-black uppercase tracking-widest text-black">
                <div className="flex items-center gap-2">
                  <span className="text-base">⚜</span>
                  <span>DHARMA HERITAGE · ROYAL BOUNDARY</span>
                </div>
                <div className="font-black">RAJASTHAN FOUR</div>
              </div>
              <div className="relative flex flex-col items-center justify-center px-8 py-6">
                <div className="flex items-center justify-center gap-4">
                  <span className="text-3xl text-amber-300">⚜</span>
                  <h2 className="bg-gradient-to-r from-yellow-200 via-amber-300 to-yellow-100 bg-clip-text text-7xl font-black italic tracking-widest text-transparent drop-shadow-[0_4px_30px_rgba(245,158,11,0.95)] md:text-9xl">
                    FOUR!
                  </h2>
                  <span className="text-3xl text-amber-300">⚜</span>
                </div>
                {sting.subtitle && (
                  <p className="mt-1 text-2xl font-black uppercase tracking-wider text-amber-200 drop-shadow">
                    {sting.subtitle}
                  </p>
                )}
              </div>
              {sting.detail && (
                <div className="flex items-center justify-center gap-3 border-t border-amber-400/30 bg-black/80 px-6 py-2">
                  <span className="rounded bg-amber-400 px-2.5 py-0.5 text-xs font-black uppercase tracking-widest text-black">
                    SHAHI SHOT
                  </span>
                  <span className="text-base font-black tabular-nums tracking-wider text-amber-300">
                    {sting.detail}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* SIX */}
          {sting.type === "six" && (
            <div className="relative w-full overflow-hidden rounded-3xl border-2 border-amber-300 bg-gradient-to-r from-[#200508] via-[#4d0c18] to-[#200508] shadow-[0_0_90px_rgba(245,158,11,0.8)] backdrop-blur-2xl">
              <div className="flex items-center justify-between bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500 px-6 py-1.5 text-[11px] font-black uppercase tracking-widest text-black">
                <div className="flex items-center gap-2">
                  <span className="text-base">👑</span>
                  <span>DHARMA HERITAGE · MAHARAJA SIX</span>
                </div>
                <div className="font-black">MAGNIFICENT MAXIMUM</div>
              </div>
              <div className="relative flex flex-col items-center justify-center px-8 py-7">
                <div className="flex items-center justify-center gap-4">
                  <span className="text-4xl text-amber-300">♛</span>
                  <h2 className="bg-gradient-to-r from-yellow-100 via-amber-300 to-yellow-200 bg-clip-text text-7xl font-black italic tracking-widest text-transparent drop-shadow-[0_4px_35px_rgba(250,204,21,1)] md:text-9xl">
                    MAXIMUM!
                  </h2>
                  <span className="text-4xl text-amber-300">♛</span>
                </div>
                <p className="mt-1 text-2xl font-black uppercase tracking-widest text-amber-300 drop-shadow">
                  ROYAL SHOT INTO THE HEAVENS!
                </p>
                {sting.subtitle && (
                  <p className="mt-1 text-xl font-bold tracking-wide text-white drop-shadow">
                    {sting.subtitle}
                  </p>
                )}
              </div>
              {sting.detail && (
                <div className="flex items-center justify-center gap-3 border-t border-amber-400/40 bg-black/80 px-6 py-2">
                  <span className="rounded bg-amber-400 px-2.5 py-0.5 text-xs font-black uppercase tracking-widest text-black">
                    MAHARAJA HIT
                  </span>
                  <span className="text-base font-black tabular-nums tracking-wider text-amber-300">
                    {sting.detail}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* WICKET */}
          {sting.type === "wicket" && (
            <div className="relative w-full overflow-hidden rounded-3xl border-2 border-red-600 bg-gradient-to-r from-[#200408] via-[#38070e] to-[#200408] shadow-[0_0_80px_rgba(220,38,38,0.8)] backdrop-blur-2xl">
              <div className="flex items-center justify-between bg-red-800 px-6 py-1.5 text-[11px] font-black uppercase tracking-widest text-amber-200">
                <div className="flex items-center gap-2">
                  <span className="inline-block h-2.5 w-2.5 rotate-45 animate-ping bg-amber-300" />
                  <span>DHARMA HERITAGE · SHAHI DISMISSAL</span>
                </div>
                <div className="font-black">BATSMAN DEPARTS</div>
              </div>
              <div className="relative flex flex-col items-center justify-center bg-black/60 px-8 py-7">
                <div className="flex items-center justify-center gap-4">
                  <span className="text-4xl font-black text-red-500">†</span>
                  <h2 className="bg-gradient-to-r from-red-400 via-white to-red-500 bg-clip-text text-7xl font-black italic tracking-widest text-transparent drop-shadow-[0_4px_35px_rgba(239,68,68,1)] md:text-9xl">
                    WICKET!
                  </h2>
                  <span className="text-4xl font-black text-red-500">†</span>
                </div>
                {sting.subtitle && (
                  <p className="mt-1 text-2xl font-black uppercase tracking-wide text-white drop-shadow">
                    {sting.subtitle}
                  </p>
                )}
              </div>
              {sting.detail && (
                <div className="flex items-center justify-center gap-3 border-t border-red-600/40 bg-black px-6 py-2">
                  <span className="rounded bg-red-700 px-2.5 py-0.5 text-xs font-black uppercase tracking-widest text-white">
                    FALL OF WICKET
                  </span>
                  <span className="text-base font-black tabular-nums tracking-wider text-red-300">
                    {sting.detail}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* MILESTONE */}
          {sting.type === "milestone" && (
            <div className="relative w-full overflow-hidden rounded-3xl border-2 border-amber-400 bg-gradient-to-r from-[#200508] via-[#4d0c18] to-[#200508] shadow-[0_0_90px_rgba(245,158,11,0.8)] backdrop-blur-2xl">
              <div className="flex items-center justify-between bg-gradient-to-r from-amber-600 via-yellow-500 to-amber-600 px-6 py-1.5 text-[11px] font-black uppercase tracking-widest text-black">
                <div className="flex items-center gap-2">
                  <span className="text-base">👑</span>
                  <span>DHARMA HERITAGE · CENTURY HONOURS</span>
                </div>
                <div className="font-black">ROYAL PERFORMANCE</div>
              </div>
              <div className="relative flex flex-col items-center justify-center px-8 py-6">
                <div className="flex items-center justify-center gap-4">
                  <span className="text-4xl text-amber-300">♛</span>
                  <h2 className="bg-gradient-to-r from-yellow-200 via-white to-amber-300 bg-clip-text text-6xl font-black tracking-widest text-transparent drop-shadow-[0_4px_30px_rgba(245,158,11,0.95)] md:text-8xl">
                    {sting.title}
                  </h2>
                  <span className="text-4xl text-amber-300">♛</span>
                </div>
                {sting.subtitle && (
                  <p className="mt-1 text-2xl font-black uppercase tracking-wide text-amber-200 drop-shadow">
                    {sting.subtitle}
                  </p>
                )}
              </div>
              {sting.detail && (
                <div className="flex items-center justify-center gap-3 border-t border-amber-400/40 bg-black px-6 py-2">
                  <span className="rounded bg-amber-400 px-2.5 py-0.5 text-xs font-black uppercase tracking-widest text-black">
                    MILESTONE
                  </span>
                  <span className="text-base font-black tabular-nums tracking-wider text-amber-300">
                    {sting.detail}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* FREE HIT */}
          {sting.type === "free_hit" && (
            <div className="relative w-full overflow-hidden rounded-3xl border-2 border-yellow-400 bg-black/95 shadow-[0_0_80px_rgba(250,204,21,0.8)] backdrop-blur-2xl">
              <div className="flex items-center justify-between bg-yellow-400 px-6 py-1.5 text-[11px] font-black uppercase tracking-widest text-black">
                <div className="flex items-center gap-2">
                  <span className="inline-block h-2.5 w-2.5 rotate-45 animate-ping bg-black" />
                  <span>DHARMA UMPIRE DECLARATION · NO-BALL</span>
                </div>
                <div className="font-black">FREE HIT PERMITTED</div>
              </div>
              <div className="relative flex flex-col items-center justify-center px-8 py-6">
                <div className="flex items-center justify-center gap-4">
                  <span className="text-4xl text-yellow-400">⚠</span>
                  <h2 className="animate-pulse text-7xl font-black italic tracking-widest text-yellow-300 drop-shadow-[0_0_35px_rgba(250,204,21,0.95)] md:text-8xl">
                    FREE HIT!
                  </h2>
                  <span className="text-4xl text-yellow-400">⚠</span>
                </div>
                <p className="mt-1 text-base font-black uppercase tracking-widest text-white/90">
                  Free Delivery Granted By Umpire
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* =================================================================== */}
      {/* 9. NAKSHATRA ASTRAL (COSMIC NEBULA / CELESTIAL ORBITS / STARBURST)  */}
      {/* =================================================================== */}
      {theme === "nakshatra" && (
        <div className="animate-stinger-entry relative flex w-full max-w-4xl flex-col items-center px-4">
          {/* Cosmic Spinning Orbit */}
          <div className="animate-cosmic-orbit pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="h-80 w-80 rounded-full border border-dashed border-purple-400/30" />
            <div className="h-96 w-96 rounded-full border border-dotted border-cyan-400/20" />
          </div>

          {/* FOUR */}
          {sting.type === "four" && (
            <div className="from-[#07031e]/98 via-[#15073e]/98 to-[#07031e]/98 relative w-full overflow-hidden rounded-3xl border-2 border-purple-500/80 bg-gradient-to-r shadow-[0_0_80px_rgba(168,85,247,0.6)] backdrop-blur-2xl">
              <div className="flex items-center justify-between bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-700 px-6 py-1.5 text-[11px] font-black uppercase tracking-widest text-white">
                <div className="flex items-center gap-2">
                  <span className="text-cyan-300">✦</span>
                  <span>NAKSHATRA ASTRAL · STELLAR BOUNDARY</span>
                </div>
                <div className="font-black text-cyan-300">COSMIC 4</div>
              </div>
              <div className="relative flex flex-col items-center justify-center px-8 py-6">
                <div className="flex items-center justify-center gap-4">
                  <span className="text-3xl text-purple-300">✦</span>
                  <h2 className="bg-gradient-to-r from-purple-300 via-white to-cyan-300 bg-clip-text text-7xl font-black italic tracking-widest text-transparent drop-shadow-[0_4px_35px_rgba(168,85,247,1)] md:text-9xl">
                    FOUR!
                  </h2>
                  <span className="text-3xl text-purple-300">✦</span>
                </div>
                {sting.subtitle && (
                  <p className="mt-1 text-2xl font-black uppercase tracking-wider text-cyan-200 drop-shadow">
                    {sting.subtitle}
                  </p>
                )}
              </div>
              {sting.detail && (
                <div className="flex items-center justify-center gap-3 border-t border-purple-400/30 bg-black/80 px-6 py-2">
                  <span className="rounded bg-purple-500 px-2.5 py-0.5 text-xs font-black uppercase tracking-widest text-white">
                    ASTRAL METRICS
                  </span>
                  <span className="text-base font-black tabular-nums tracking-wider text-cyan-300">
                    {sting.detail}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* SIX */}
          {sting.type === "six" && (
            <div className="from-[#07031e]/98 via-[#1f0a5c]/98 to-[#07031e]/98 relative w-full overflow-hidden rounded-3xl border-2 border-cyan-400 bg-gradient-to-r shadow-[0_0_100px_rgba(56,189,248,0.7)] backdrop-blur-2xl">
              <div className="flex items-center justify-between bg-gradient-to-r from-cyan-500 via-indigo-500 to-purple-600 px-6 py-1.5 text-[11px] font-black uppercase tracking-widest text-white">
                <div className="flex items-center gap-2">
                  <span className="text-base">🚀</span>
                  <span>NAKSHATRA ASTRAL · LAUNCHED INTO ORBIT</span>
                </div>
                <div className="font-black text-cyan-200">
                  INTERSTELLAR MAXIMUM
                </div>
              </div>
              <div className="relative flex flex-col items-center justify-center px-8 py-7">
                <div className="flex items-center justify-center gap-4">
                  <span className="text-4xl text-cyan-300">★</span>
                  <h2 className="bg-gradient-to-r from-cyan-200 via-white to-purple-300 bg-clip-text text-7xl font-black italic tracking-widest text-transparent drop-shadow-[0_4px_40px_rgba(56,189,248,1)] md:text-9xl">
                    MAXIMUM!
                  </h2>
                  <span className="text-4xl text-cyan-300">★</span>
                </div>
                <p className="mt-1 text-2xl font-black uppercase tracking-widest text-cyan-300 drop-shadow">
                  SUPERNOVA HIT INTO DEEP SPACE!
                </p>
                {sting.subtitle && (
                  <p className="mt-1 text-xl font-bold tracking-wide text-white drop-shadow">
                    {sting.subtitle}
                  </p>
                )}
              </div>
              {sting.detail && (
                <div className="flex items-center justify-center gap-3 border-t border-cyan-400/40 bg-black/80 px-6 py-2">
                  <span className="rounded bg-cyan-400 px-2.5 py-0.5 text-xs font-black uppercase tracking-widest text-black">
                    ORBIT RADIUS
                  </span>
                  <span className="text-base font-black tabular-nums tracking-wider text-cyan-200">
                    {sting.detail}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* WICKET */}
          {sting.type === "wicket" && (
            <div className="bg-[#0d0208]/98 relative w-full overflow-hidden rounded-3xl border-2 border-red-500 shadow-[0_0_90px_rgba(239,68,68,0.8)] backdrop-blur-2xl">
              <div className="flex items-center justify-between bg-red-600 px-6 py-1.5 text-[11px] font-black uppercase tracking-widest text-white">
                <div className="flex items-center gap-2">
                  <span className="inline-block h-2.5 w-2.5 rotate-45 animate-ping bg-white" />
                  <span>NAKSHATRA ASTRAL · SUPERNOVA COLLAPSE</span>
                </div>
                <div className="font-black">TIMBER IN ORBIT</div>
              </div>
              <div className="relative flex flex-col items-center justify-center bg-black/70 px-8 py-7">
                <div className="flex items-center justify-center gap-4">
                  <span className="text-4xl font-black text-red-500">✦</span>
                  <h2 className="bg-gradient-to-r from-red-400 via-white to-red-500 bg-clip-text text-7xl font-black italic tracking-widest text-transparent drop-shadow-[0_4px_35px_rgba(239,68,68,1)] md:text-9xl">
                    WICKET!
                  </h2>
                  <span className="text-4xl font-black text-red-500">✦</span>
                </div>
                {sting.subtitle && (
                  <p className="mt-1 text-2xl font-black uppercase tracking-wide text-white drop-shadow">
                    {sting.subtitle}
                  </p>
                )}
              </div>
              {sting.detail && (
                <div className="flex items-center justify-center gap-3 border-t border-red-500/30 bg-black px-6 py-2">
                  <span className="rounded bg-red-600 px-2.5 py-0.5 text-xs font-black uppercase tracking-widest text-white">
                    DISMISSAL
                  </span>
                  <span className="text-base font-black tabular-nums tracking-wider text-red-300">
                    {sting.detail}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* MILESTONE */}
          {sting.type === "milestone" && (
            <div className="from-[#07031e]/98 via-[#1c0852]/98 to-[#07031e]/98 relative w-full overflow-hidden rounded-3xl border-2 border-purple-400 bg-gradient-to-r shadow-[0_0_90px_rgba(168,85,247,0.7)] backdrop-blur-2xl">
              <div className="flex items-center justify-between bg-gradient-to-r from-purple-600 via-fuchsia-600 to-purple-700 px-6 py-1.5 text-[11px] font-black uppercase tracking-widest text-white">
                <div className="flex items-center gap-2">
                  <span className="text-base">✦</span>
                  <span>NAKSHATRA ASTRAL · STELLAR MILESTONE</span>
                </div>
                <div className="font-black text-cyan-200">ASTRAL CENTURY</div>
              </div>
              <div className="relative flex flex-col items-center justify-center px-8 py-6">
                <div className="flex items-center justify-center gap-4">
                  <span className="text-4xl text-purple-300">♛</span>
                  <h2 className="bg-gradient-to-r from-purple-200 via-white to-cyan-300 bg-clip-text text-6xl font-black tracking-widest text-transparent drop-shadow-[0_4px_30px_rgba(168,85,247,0.95)] md:text-8xl">
                    {sting.title}
                  </h2>
                  <span className="text-4xl text-purple-300">♛</span>
                </div>
                {sting.subtitle && (
                  <p className="mt-1 text-2xl font-black uppercase tracking-wide text-cyan-200 drop-shadow">
                    {sting.subtitle}
                  </p>
                )}
              </div>
              {sting.detail && (
                <div className="flex items-center justify-center gap-3 border-t border-purple-400/30 bg-black px-6 py-2">
                  <span className="rounded bg-purple-500 px-2.5 py-0.5 text-xs font-black uppercase tracking-widest text-white">
                    RECORD
                  </span>
                  <span className="text-base font-black tabular-nums tracking-wider text-cyan-300">
                    {sting.detail}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* FREE HIT */}
          {sting.type === "free_hit" && (
            <div className="relative w-full overflow-hidden rounded-3xl border-2 border-yellow-400 bg-black/95 shadow-[0_0_80px_rgba(250,204,21,0.8)] backdrop-blur-2xl">
              <div className="flex items-center justify-between bg-yellow-400 px-6 py-1.5 text-[11px] font-black uppercase tracking-widest text-black">
                <div className="flex items-center gap-2">
                  <span className="inline-block h-2.5 w-2.5 rotate-45 animate-ping bg-black" />
                  <span>NAKSHATRA WARNING · NO-BALL</span>
                </div>
                <div className="font-black">FREE HIT FLIGHT</div>
              </div>
              <div className="relative flex flex-col items-center justify-center px-8 py-6">
                <div className="flex items-center justify-center gap-4">
                  <span className="text-4xl text-yellow-400">⚡</span>
                  <h2 className="animate-pulse text-7xl font-black italic tracking-widest text-yellow-300 drop-shadow-[0_0_35px_rgba(250,204,21,0.95)] md:text-8xl">
                    FREE HIT!
                  </h2>
                  <span className="text-4xl text-yellow-400">⚡</span>
                </div>
                <p className="mt-1 text-base font-black uppercase tracking-widest text-white/90">
                  Bowler Overstepped · Batter Free to Launch
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* =================================================================== */}
      {/* 9B. AGNI INFERNO (FIERY MAGMA / VOLCANIC EMBERS / BROADCAST PREMIUM) */}
      {/* =================================================================== */}
      {theme === "agni" && (
        <div className="animate-stinger-entry relative flex w-full max-w-4xl flex-col items-center px-4">
          {/* FOUR */}
          {sting.type === "four" && (
            <div className="clip-notch-card magma-matrix relative w-full overflow-hidden border-2 border-orange-500 shadow-[0_0_85px_rgba(255,69,0,0.75)] backdrop-blur-2xl">
              <div className="animate-flame-flicker pointer-events-none absolute inset-0 bg-gradient-to-r from-orange-500/10 via-red-500/20 to-amber-500/10" />
              <div className="flex items-center justify-between bg-gradient-to-r from-red-600 via-orange-500 to-amber-500 px-6 py-1.5 text-[11px] font-black uppercase tracking-widest text-black">
                <div className="flex items-center gap-2">
                  <span className="animate-flame-flicker text-base">🔥</span>
                  <span>AGNI INFERNO · BLAZING BOUNDARY</span>
                </div>
                <div className="flex items-center gap-2 font-black">
                  <span>[ CORE TEMP: 1850°C ]</span>
                  <span>•</span>
                  <span>CRACKING FOUR</span>
                </div>
              </div>
              <div className="relative flex flex-col items-center justify-center bg-neutral-950/70 px-8 py-6">
                <div className="flex items-center justify-center gap-4">
                  <span className="animate-flame-flicker text-3xl">🔥</span>
                  <h2 className="bg-gradient-to-r from-yellow-200 via-orange-400 to-red-500 bg-clip-text text-7xl font-black italic tracking-wider text-transparent drop-shadow-[0_0_35px_rgba(255,69,0,1)] md:text-9xl">
                    BLAZING 4!
                  </h2>
                  <span className="animate-flame-flicker text-3xl [animation-delay:0.4s]">
                    🔥
                  </span>
                </div>
                {sting.subtitle && (
                  <p className="mt-1 text-2xl font-black uppercase tracking-wide text-amber-200 drop-shadow">
                    {sting.subtitle}
                  </p>
                )}
              </div>
              {sting.detail && (
                <div className="flex items-center justify-center gap-3 border-t border-orange-500/40 bg-black/90 px-6 py-2">
                  <span className="rounded bg-gradient-to-r from-orange-500 to-amber-500 px-2.5 py-0.5 text-xs font-black uppercase tracking-widest text-black">
                    EXIT HEAT
                  </span>
                  <span className="text-base font-black tabular-nums tracking-wider text-orange-300">
                    {sting.detail}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* SIX */}
          {sting.type === "six" && (
            <div className="clip-notch-card magma-matrix relative w-full overflow-hidden border-2 border-red-500 shadow-[0_0_100px_rgba(255,30,0,0.85)] backdrop-blur-2xl">
              <div className="animate-flame-flicker pointer-events-none absolute inset-0 bg-gradient-to-r from-red-600/15 via-orange-500/25 to-yellow-500/15" />
              <div className="flex items-center justify-between bg-gradient-to-r from-orange-600 via-red-600 to-amber-500 px-6 py-1.5 text-[11px] font-black uppercase tracking-widest text-black">
                <div className="flex items-center gap-2">
                  <span className="text-base">🌋</span>
                  <span>AGNI INFERNO · MAXIMUM VOLCANIC BLAST</span>
                </div>
                <div className="flex items-center gap-2 font-black text-black">
                  <span>DISPATCHED OVER THE ROOF</span>
                  <span>•</span>
                  <span>112 METRES</span>
                </div>
              </div>
              <div className="relative flex flex-col items-center justify-center bg-neutral-950/70 px-8 py-7">
                <div className="flex items-center justify-center gap-4">
                  <span className="animate-flame-flicker text-4xl">🔥</span>
                  <h2 className="bg-gradient-to-r from-yellow-100 via-amber-300 to-red-500 bg-clip-text text-7xl font-black italic tracking-widest text-transparent drop-shadow-[0_0_50px_rgba(255,69,0,1)] md:text-9xl">
                    MAXIMUM 6!
                  </h2>
                  <span className="animate-flame-flicker text-4xl [animation-delay:0.5s]">
                    🔥
                  </span>
                </div>
                <p className="mt-1 text-2xl font-black uppercase tracking-widest text-orange-300 drop-shadow">
                  BLOWN TO ASHES OVER THE STANDS!
                </p>
                {sting.subtitle && (
                  <p className="mt-0.5 text-lg font-bold text-white/90">
                    {sting.subtitle}
                  </p>
                )}
              </div>
              {sting.detail && (
                <div className="flex items-center justify-center gap-3 border-t border-orange-500/40 bg-black/90 px-6 py-2">
                  <span className="rounded bg-gradient-to-r from-red-500 to-orange-500 px-2.5 py-0.5 text-xs font-black uppercase tracking-widest text-white">
                    BALL TRAJECTORY
                  </span>
                  <span className="text-base font-black tabular-nums tracking-wider text-orange-300">
                    {sting.detail}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* WICKET */}
          {sting.type === "wicket" && (
            <div className="clip-notch-card magma-matrix relative w-full overflow-hidden border-2 border-red-600 shadow-[0_0_110px_rgba(220,38,38,0.9)] backdrop-blur-2xl">
              <div className="animate-flame-flicker pointer-events-none absolute inset-0 bg-red-600/15" />
              <div className="flex items-center justify-between bg-red-700 px-6 py-1.5 text-[11px] font-black uppercase tracking-widest text-white">
                <div className="flex items-center gap-2">
                  <span className="inline-block h-2.5 w-2.5 animate-ping rounded-full bg-white" />
                  <span>AGNI INFERNO · TIMBER SCORCHED</span>
                </div>
                <div className="flex items-center gap-2">
                  <span>DISMISSAL CONFIRMED</span>
                  <span>•</span>
                  <span>BATTER OUT</span>
                </div>
              </div>
              <div className="relative flex flex-col items-center justify-center bg-neutral-950/75 px-8 py-6">
                <div className="flex items-center justify-center gap-4">
                  <span className="text-3xl text-red-500">💥</span>
                  <h2 className="bg-gradient-to-r from-red-400 via-orange-200 to-red-600 bg-clip-text text-7xl font-black italic tracking-widest text-transparent drop-shadow-[0_0_40px_rgba(239,68,68,1)] md:text-9xl">
                    WICKET!
                  </h2>
                  <span className="text-3xl text-red-500">💥</span>
                </div>
                {sting.subtitle && (
                  <p className="mt-1 text-2xl font-black uppercase tracking-wide text-white drop-shadow">
                    {sting.subtitle}
                  </p>
                )}
              </div>
              {sting.detail && (
                <div className="flex items-center justify-center gap-3 border-t border-red-600/40 bg-red-950/80 px-6 py-2.5">
                  <span className="rounded bg-red-600 px-2.5 py-0.5 text-xs font-black uppercase tracking-widest text-white">
                    DISMISSAL
                  </span>
                  <span className="text-lg font-black tracking-wide text-orange-200">
                    {sting.detail}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* MILESTONE */}
          {sting.type === "milestone" && (
            <div className="clip-notch-card magma-matrix relative w-full overflow-hidden border-2 border-amber-500 shadow-[0_0_80px_rgba(245,158,11,0.7)] backdrop-blur-2xl">
              <div className="animate-light-sweep pointer-events-none absolute inset-0 -skew-x-12 bg-gradient-to-r from-transparent via-amber-300/25 to-transparent" />
              <div className="flex items-center justify-between bg-gradient-to-r from-amber-500 via-orange-500 to-yellow-400 px-6 py-1.5 text-[11px] font-black uppercase tracking-widest text-black">
                <div className="flex items-center gap-2">
                  <span className="text-base">☀️</span>
                  <span>AGNI INFERNO · SOLAR MILESTONE</span>
                </div>
                <span>BLAZING ACHIEVEMENT</span>
              </div>
              <div className="relative flex flex-col items-center justify-center bg-neutral-950/70 px-8 py-6">
                <div className="flex items-center justify-center gap-4">
                  <span className="animate-flame-flicker text-3xl">☀️</span>
                  <h2 className="bg-gradient-to-r from-yellow-200 via-amber-400 to-orange-400 bg-clip-text text-6xl font-black tracking-wider text-transparent drop-shadow-[0_0_35px_rgba(245,158,11,0.95)] md:text-8xl">
                    {sting.title}
                  </h2>
                  <span className="animate-flame-flicker text-3xl [animation-delay:0.5s]">
                    ☀️
                  </span>
                </div>
                {sting.subtitle && (
                  <p className="mt-1 text-2xl font-black uppercase tracking-wide text-white drop-shadow">
                    {sting.subtitle}
                  </p>
                )}
              </div>
              {sting.detail && (
                <div className="flex items-center justify-center gap-3 border-t border-amber-500/40 bg-black/90 px-6 py-2">
                  <span className="rounded border border-amber-400/50 bg-amber-500/30 px-2.5 py-0.5 text-xs font-black uppercase tracking-widest text-amber-300">
                    SOLAR ANALYSIS
                  </span>
                  <span className="text-base font-black tabular-nums tracking-wider text-white">
                    {sting.detail}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* FREE HIT */}
          {sting.type === "free_hit" && (
            <div className="clip-notch-card magma-matrix relative w-full overflow-hidden border-2 border-orange-400 shadow-[0_0_90px_rgba(255,140,0,0.8)] backdrop-blur-2xl">
              <div className="flex items-center justify-between bg-orange-500 px-6 py-1.5 text-[11px] font-black uppercase tracking-widest text-black">
                <div className="flex items-center gap-2">
                  <span className="animate-flame-flicker text-base">🔥</span>
                  <span>AGNI INFERNO · UMPIRE PENALTY PROTOCOL</span>
                </div>
                <span>FREE HIT DELIVERED</span>
              </div>
              <div className="relative flex flex-col items-center justify-center bg-neutral-950/75 px-8 py-6">
                <div className="flex items-center justify-center gap-4">
                  <span className="animate-flame-flicker text-3xl">🔥</span>
                  <h2 className="animate-pulse text-7xl font-black italic tracking-wider text-orange-300 drop-shadow-[0_0_35px_rgba(255,140,0,1)] md:text-9xl">
                    FREE HIT!
                  </h2>
                  <span className="animate-flame-flicker text-3xl">🔥</span>
                </div>
                <p className="mt-2 text-sm font-black uppercase tracking-widest text-white/90 md:text-base">
                  Bowler Overstepped · Unleash The Magma Blast
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* =================================================================== */}
      {/* 10. STAR SPORTS / IPL (METALLIC BEVELS / 14° PARALLELOGRAM / GOLD)  */}
      {/* (DEFAULT AND FALLBACK FOR BROADCAST, DARK, EMERALD)                 */}
      {/* =================================================================== */}
      {(theme === "starsports" ||
        theme === "broadcast" ||
        theme === "dark" ||
        theme === "emerald" ||
        theme === "minimal" ||
        theme === "custom") && (
        <div className="animate-stinger-entry relative flex w-full max-w-4xl flex-col items-center px-4">
          {/* FOUR */}
          {sting.type === "four" && (
            <div className="relative w-full overflow-hidden border-y-2 border-cyan-400 bg-gradient-to-r from-blue-950/95 via-cyan-950/95 to-blue-950/95 shadow-[0_0_60px_rgba(6,182,212,0.6)] backdrop-blur-2xl">
              <div className="animate-light-sweep pointer-events-none absolute inset-0 -skew-x-12 bg-gradient-to-r from-transparent via-cyan-300/25 to-transparent" />

              <div className="flex items-center justify-between border-b border-cyan-500/30 bg-cyan-950/80 px-6 py-1 text-[11px] font-black uppercase tracking-widest text-cyan-300">
                <div className="flex items-center gap-2">
                  <span className="inline-block h-2 w-2 rotate-45 bg-cyan-400" />
                  <span>STAR SPORTS · TATA IPL FOUR</span>
                </div>
                <div className="flex items-center gap-1.5 font-bold text-white/70">
                  <span>FOUR RUNS</span>
                  <span>•</span>
                  <span>BALL TO THE FENCE</span>
                </div>
              </div>

              <div className="relative flex flex-col items-center justify-center px-8 py-5">
                <div className="flex items-center justify-center gap-4">
                  <span className="text-3xl font-black italic tracking-tighter text-cyan-400">
                    &gt;&gt;&gt;
                  </span>
                  <h2 className="bg-gradient-to-r from-cyan-200 via-white to-cyan-400 bg-clip-text text-7xl font-black italic tracking-wider text-transparent drop-shadow-[0_4px_24px_rgba(6,182,212,0.9)] md:text-8xl">
                    FOUR!
                  </h2>
                  <span className="text-3xl font-black italic tracking-tighter text-cyan-400">
                    &lt;&lt;&lt;
                  </span>
                </div>

                {sting.subtitle && (
                  <p className="mt-1 text-2xl font-black uppercase tracking-wide text-white drop-shadow">
                    {sting.subtitle}
                  </p>
                )}
              </div>

              {sting.detail && (
                <div className="flex items-center justify-center gap-3 border-t border-cyan-500/30 bg-black/60 px-6 py-2">
                  <span className="rounded border border-cyan-400/40 bg-cyan-500/20 px-2.5 py-0.5 text-xs font-black uppercase tracking-widest text-cyan-300">
                    BATTER STATS
                  </span>
                  <span className="text-base font-black tabular-nums tracking-wider text-white">
                    {sting.detail}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* SIX */}
          {sting.type === "six" && (
            <div className="relative w-full overflow-hidden border-y-2 border-amber-400 bg-gradient-to-r from-amber-950/95 via-orange-950/95 to-amber-950/95 shadow-[0_0_80px_rgba(245,158,11,0.7)] backdrop-blur-2xl">
              <div className="animate-light-sweep pointer-events-none absolute inset-0 -skew-x-12 bg-gradient-to-r from-transparent via-amber-200/30 to-transparent" />

              <div className="flex items-center justify-between border-b border-amber-500/30 bg-amber-950/80 px-6 py-1 text-[11px] font-black uppercase tracking-widest text-amber-300">
                <div className="flex items-center gap-2">
                  <span className="inline-block h-2 w-2 rotate-45 animate-pulse bg-amber-400" />
                  <span>STAR SPORTS · MAXIMUM SIX</span>
                </div>
                <div className="flex items-center gap-1.5 font-bold text-amber-200/80">
                  <span>OUT OF THE PARK</span>
                  <span>•</span>
                  <span>6 RUNS</span>
                </div>
              </div>

              <div className="relative flex flex-col items-center justify-center px-8 py-5">
                <div className="flex items-center justify-center gap-4">
                  <span className="animate-pulse text-3xl font-black italic tracking-tighter text-amber-400">
                    ★ ★ ★
                  </span>
                  <h2 className="bg-gradient-to-r from-amber-200 via-yellow-100 to-amber-400 bg-clip-text text-7xl font-black italic tracking-widest text-transparent drop-shadow-[0_4px_28px_rgba(245,158,11,0.95)] md:text-8xl">
                    MAXIMUM!
                  </h2>
                  <span className="animate-pulse text-3xl font-black italic tracking-tighter text-amber-400">
                    ★ ★ ★
                  </span>
                </div>

                <p className="mt-1 text-2xl font-black uppercase tracking-widest text-amber-300 drop-shadow">
                  THAT&apos;S A HUGE SIX!
                </p>

                {sting.subtitle && (
                  <p className="mt-1 text-xl font-bold tracking-wide text-white drop-shadow">
                    {sting.subtitle}
                  </p>
                )}
              </div>

              {sting.detail && (
                <div className="flex items-center justify-center gap-3 border-t border-amber-500/30 bg-black/60 px-6 py-2">
                  <span className="rounded border border-amber-400/40 bg-amber-500/20 px-2.5 py-0.5 text-xs font-black uppercase tracking-widest text-amber-300">
                    BOUNDARY ANALYSIS
                  </span>
                  <span className="text-base font-black tabular-nums tracking-wider text-white">
                    {sting.detail}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* WICKET */}
          {sting.type === "wicket" && (
            <div className="relative w-full overflow-hidden border-y-2 border-red-500 bg-gradient-to-r from-neutral-950 via-red-950/95 to-neutral-950 shadow-[0_0_80px_rgba(239,68,68,0.8)] backdrop-blur-2xl">
              <div className="pointer-events-none absolute inset-0 animate-pulse bg-red-600/10" />

              <div className="flex items-center justify-between border-b border-red-500/40 bg-red-950/80 px-6 py-1 text-[11px] font-black uppercase tracking-widest text-red-300">
                <div className="flex items-center gap-2">
                  <span className="inline-block h-2.5 w-2.5 animate-ping rounded-full bg-red-500" />
                  <span>STAR SPORTS · DISMISSAL CONFIRMED</span>
                </div>
                <div className="flex items-center gap-1.5 font-bold text-red-200/80">
                  <span>WICKET FALLS</span>
                  <span>•</span>
                  <span>BATTER OUT</span>
                </div>
              </div>

              <div className="relative flex flex-col items-center justify-center px-8 py-5">
                <div className="flex items-center justify-center gap-4">
                  <span className="text-3xl font-black tracking-tighter text-red-500">
                    {"///"}
                  </span>
                  <h2 className="bg-gradient-to-r from-red-400 via-white to-red-500 bg-clip-text text-7xl font-black italic tracking-widest text-transparent drop-shadow-[0_4px_28px_rgba(239,68,68,0.95)] md:text-8xl">
                    WICKET!
                  </h2>
                  <span className="text-3xl font-black tracking-tighter text-red-500">
                    {"///"}
                  </span>
                </div>

                {sting.subtitle && (
                  <p className="mt-1 text-2xl font-black uppercase tracking-wider text-white drop-shadow">
                    {sting.subtitle}
                  </p>
                )}
              </div>

              {sting.detail && (
                <div className="flex items-center justify-center gap-3 border-t border-red-500/40 bg-red-950/60 px-6 py-2.5">
                  <span className="rounded bg-red-600 px-3 py-0.5 text-xs font-black uppercase tracking-widest text-white shadow">
                    DISMISSAL
                  </span>
                  <span className="text-lg font-black tracking-wide text-amber-300">
                    {sting.detail}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* MILESTONE */}
          {sting.type === "milestone" && (
            <div className="relative w-full overflow-hidden border-y-2 border-amber-300 bg-gradient-to-r from-amber-950 via-neutral-950 to-amber-950 shadow-[0_0_70px_rgba(252,211,77,0.6)] backdrop-blur-2xl">
              <div className="animate-light-sweep pointer-events-none absolute inset-0 -skew-x-12 bg-gradient-to-r from-transparent via-amber-200/30 to-transparent" />

              <div className="flex items-center justify-between border-b border-amber-500/30 bg-amber-950/80 px-6 py-1 text-[11px] font-black uppercase tracking-widest text-amber-300">
                <div className="flex items-center gap-2">
                  <span className="inline-block h-2 w-2 rotate-45 bg-amber-300" />
                  <span>STAR SPORTS · BATTING MILESTONE</span>
                </div>
                <div className="flex items-center gap-1.5 font-bold text-amber-200/80">
                  <span>PERSONAL ACHIEVEMENT</span>
                </div>
              </div>

              <div className="relative flex flex-col items-center justify-center px-8 py-5">
                <div className="flex items-center justify-center gap-4">
                  <span className="text-3xl font-black text-amber-400">♛</span>
                  <h2 className="bg-gradient-to-r from-amber-200 via-yellow-100 to-amber-400 bg-clip-text text-6xl font-black tracking-wider text-transparent drop-shadow-[0_4px_24px_rgba(245,158,11,0.9)] md:text-7xl">
                    {sting.title}
                  </h2>
                  <span className="text-3xl font-black text-amber-400">♛</span>
                </div>

                {sting.subtitle && (
                  <p className="mt-1 text-2xl font-black uppercase tracking-wide text-white drop-shadow">
                    {sting.subtitle}
                  </p>
                )}
              </div>

              {sting.detail && (
                <div className="flex items-center justify-center gap-3 border-t border-amber-500/30 bg-black/60 px-6 py-2">
                  <span className="rounded border border-amber-400/40 bg-amber-400/20 px-2.5 py-0.5 text-xs font-black uppercase tracking-widest text-amber-300">
                    MILESTONE ANALYSIS
                  </span>
                  <span className="text-base font-black tabular-nums tracking-wider text-white">
                    {sting.detail}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* FREE HIT */}
          {sting.type === "free_hit" && (
            <div className="relative w-full overflow-hidden border-y-2 border-yellow-400 bg-black/95 shadow-[0_0_60px_rgba(250,204,21,0.6)] backdrop-blur-2xl">
              <div className="flex items-center justify-between bg-yellow-400 px-6 py-1 text-[11px] font-black uppercase tracking-widest text-black">
                <div className="flex items-center gap-2">
                  <span className="inline-block h-2 w-2 rotate-45 animate-ping bg-black" />
                  <span>STAR SPORTS · OFFICIAL UMPIRE CALL</span>
                </div>
                <div className="flex items-center gap-1.5 font-black">
                  <span>NO-BALL OVERSTEPPED</span>
                  <span>•</span>
                  <span>PENALTY DELIVERY</span>
                </div>
              </div>

              <div className="relative flex flex-col items-center justify-center px-8 py-6">
                <div className="flex items-center justify-center gap-4">
                  <span className="text-3xl font-black text-yellow-400">
                    ⚠
                  </span>
                  <h2 className="animate-pulse text-7xl font-black italic tracking-wider text-yellow-300 drop-shadow-[0_4px_24px_rgba(250,204,21,0.9)] md:text-8xl">
                    FREE HIT!
                  </h2>
                  <span className="text-3xl font-black text-yellow-400">
                    ⚠
                  </span>
                </div>

                <p className="mt-2 text-sm font-black uppercase tracking-widest text-white/90 md:text-base">
                  Bowler Overstepped · No Dismissals Except Run Out
                </p>
              </div>

              <div className="border-t border-yellow-400/40 bg-yellow-400/20 px-6 py-1.5 text-center">
                <span className="text-xs font-black uppercase tracking-wider text-yellow-300">
                  NEXT DELIVERY IS A REGULATION FREE HIT FOR THE BATTER
                </span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
