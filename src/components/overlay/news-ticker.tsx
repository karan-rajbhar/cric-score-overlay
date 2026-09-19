"use client";

import { Bell } from "lucide-react";

interface NewsTickerProps {
  text?: string;
  badge?: string;
  visible?: boolean;
}

export function NewsTicker({
  text = "Welcome to the Live Match Broadcast · Full scorecard and stats updating in real-time · Follow our channel for tournament highlights and player interviews",
  badge = "UPDATE",
  visible = true,
}: NewsTickerProps) {
  if (!visible || !text.trim()) return null;

  return (
    <div className="pointer-events-none fixed bottom-0 left-0 right-0 z-20 flex h-7 select-none items-center overflow-hidden border-t border-amber-500/30 bg-slate-950/90 text-white shadow-2xl backdrop-blur-md">
      {/* Ticker Badge */}
      <div className="z-10 flex h-full shrink-0 items-center gap-1.5 bg-amber-500 px-3 text-[11px] font-black uppercase tracking-wider text-black">
        <Bell className="h-3 w-3 fill-black" />
        <span>{badge}</span>
      </div>

      {/* Marquee scrolling container */}
      <div className="relative flex w-full overflow-hidden whitespace-nowrap">
        <div className="animate-marquee inline-flex items-center text-xs font-semibold tracking-wide text-slate-200">
          <span className="mx-6 inline-flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
            {text}
            <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
          </span>
          <span className="mx-6 inline-flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
            {text}
            <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
          </span>
        </div>
      </div>
    </div>
  );
}
