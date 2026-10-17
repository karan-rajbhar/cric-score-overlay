"use client";

import { useEffect, useRef } from "react";
import { THEME_ACCENT } from "./theme-accent";
import type { ActiveEventSting, OverlayTheme } from "./types";

interface EventStingsProps {
  sting: ActiveEventSting | null;
  onDismiss: () => void;
  theme?: OverlayTheme;
}

const EVENT_LABEL: Record<ActiveEventSting["type"], string> = {
  four: "Boundary",
  six: "Six",
  wicket: "Wicket",
  milestone: "Milestone",
  free_hit: "Free hit",
};

/**
 * Event card for FOUR / SIX / WICKET / milestone / free hit moments.
 * A single flat strap with a coloured side bar, a short slide-up entry and an
 * auto-dismiss timer. Wickets always use red so they read the same on every theme.
 */
export function EventStings({
  sting,
  onDismiss,
  theme = "starsports",
}: EventStingsProps) {
  const onDismissRef = useRef(onDismiss);
  useEffect(() => {
    onDismissRef.current = onDismiss;
  });

  const stingId = sting?.id;
  const duration = sting?.durationMs || 4500;

  useEffect(() => {
    if (!stingId) return;

    const timer = setTimeout(() => {
      onDismissRef.current();
    }, duration);

    return () => clearTimeout(timer);
  }, [stingId, duration]);

  if (!sting) return null;

  const accent =
    sting.type === "wicket"
      ? "#dc2626"
      : (sting.accentColor ?? THEME_ACCENT[theme] ?? THEME_ACCENT.starsports);

  return (
    <div className="pointer-events-none fixed inset-0 z-50 flex select-none items-center justify-center px-4 font-score">
      <div
        role="status"
        aria-live="polite"
        data-theme={theme}
        data-sting-type={sting.type}
        className="flex w-full max-w-2xl overflow-hidden rounded-md border border-white/10 bg-[#0b0f17]/95 text-white shadow-[0_8px_24px_rgba(0,0,0,0.6)] duration-300 animate-in fade-in slide-in-from-bottom-4 motion-reduce:animate-none"
      >
        <div
          aria-hidden="true"
          className="w-2 shrink-0"
          style={{ background: accent }}
        />
        <div className="flex min-w-0 flex-1 flex-col gap-1 px-6 py-4">
          <span className="text-sm font-medium text-white/60">
            {EVENT_LABEL[sting.type]}
          </span>
          <h2 className="text-balance text-4xl font-semibold leading-tight">
            {sting.title}
          </h2>
          {sting.subtitle && (
            <p className="mt-1 truncate text-xl font-medium text-white/90">
              {sting.subtitle}
            </p>
          )}
          {sting.type === "free_hit" && (
            <p className="text-sm font-medium text-white/70">
              No dismissals except run out
            </p>
          )}
        </div>
        {sting.detail && (
          <div className="flex shrink-0 items-center border-l border-white/10 bg-black/30 px-6">
            <span className="text-lg font-bold tabular-nums text-white">
              {sting.detail}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
