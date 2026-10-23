"use client";

/**
 * The event card's visual (the Standard package's sting element): a flat
 * card in the theme's bar colours with the event's state colour down its
 * left edge. `event-stings.tsx` decides when it is on air.
 */

import { cn } from "~/lib/utils";
import { OV, OverlayFrame, type OverlayThemeProps } from "./overlay-kit";
import type { ActiveEventSting } from "./types";

const EVENT_LABEL: Record<ActiveEventSting["type"], string> = {
  four: "Boundary",
  six: "Six",
  wicket: "Wicket",
  milestone: "Milestone",
  free_hit: "Free hit",
};

/** The state colour of each event (the app's delivery tokens). */
const EDGE: Record<ActiveEventSting["type"], string> = {
  four: "bg-four",
  six: "bg-six",
  wicket: "bg-wicket",
  milestone: "bg-[color:var(--ov-accent)]",
  free_hit: "bg-extra",
};

export function StingCard({
  sting,
  theme,
  customColors,
}: OverlayThemeProps & { sting: ActiveEventSting }) {
  return (
    <OverlayFrame
      state={null}
      theme={theme}
      customColors={customColors}
      className="pointer-events-none fixed inset-x-0 bottom-[11rem] z-50 flex justify-center px-12"
    >
      <div
        role="status"
        aria-live="polite"
        data-sting-type={sting.type}
        className={cn(
          "flex w-full max-w-[52rem] overflow-hidden rounded-lg duration-300 animate-in fade-in slide-in-from-bottom-4 motion-reduce:animate-none",
          OV.bar,
          OV.shadow,
        )}
      >
        <div
          aria-hidden="true"
          className={cn("w-3 shrink-0", EDGE[sting.type])}
        />
        <div className="flex min-w-0 flex-1 flex-col justify-center gap-0.5 px-7 py-4">
          {EVENT_LABEL[sting.type].toLowerCase() !==
            sting.title.toLowerCase() && (
            <span className={cn("text-base font-medium", OV.barMuted)}>
              {EVENT_LABEL[sting.type]}
            </span>
          )}
          <h2 className="truncate text-[2.75rem] font-semibold leading-tight">
            {sting.title}
          </h2>
          {sting.subtitle && (
            <p className="truncate text-[1.5rem] font-medium">
              {sting.subtitle}
            </p>
          )}
          {sting.type === "free_hit" && (
            <p className={cn("text-base", OV.barMuted)}>
              No dismissals except run out
            </p>
          )}
        </div>
        {sting.detail && (
          <div
            className={cn(
              "flex max-w-[22rem] shrink-0 items-center px-7",
              OV.panel,
            )}
          >
            <span className="text-[1.5rem] font-semibold tabular-nums">
              {sting.detail}
            </span>
          </div>
        )}
      </div>
    </OverlayFrame>
  );
}
