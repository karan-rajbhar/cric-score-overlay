"use client";

/**
 * Summer bash corner and crawl: the competition plate with the sponsors
 * one at a time under it (top right), and the ticker along the foot of
 * the frame under the score bug.
 */

import { useEffect, useState, type CSSProperties } from "react";
import { cn } from "~/lib/utils";
import type { OverlayElementProps } from "../types";
import { delay, Frame, neonStyle, s, SAFE_X, SAFE_Y } from "./kit";

export function Sponsors(p: OverlayElementProps["sponsors"]) {
  const { sponsors, title, state } = p;
  const [index, setIndex] = useState(0);
  const count = sponsors.length;
  useEffect(() => {
    if (count <= 1) return;
    const timer = setInterval(() => setIndex((i) => (i + 1) % count), 20_000);
    return () => clearInterval(timer);
  }, [count]);
  if (!title && count === 0) return null;
  const sponsor = count ? sponsors[index % count] : null;
  return (
    <Frame
      state={state}
      className="fixed z-20 flex flex-col items-end gap-2"
      style={{ top: SAFE_Y, right: SAFE_X }}
    >
      {title && (
        <div
          style={{ ...neonStyle("magenta"), "--k": "16px" } as CSSProperties}
          className={cn(s.neon, s.slant, s.label, "flex h-11 max-w-[28rem] items-center px-8 text-[1.0625rem]")}
        >
          <span className="relative z-10 truncate">{title}</span>
        </div>
      )}
      {sponsor && (
        <div
          key={sponsor.id}
          style={{ ...neonStyle("magenta"), "--k": "16px", ...delay(160) } as CSSProperties}
          className={cn(s.glass, s.slant, s.edgeBottom, s.inRight, "flex max-w-[26rem] items-center gap-3 overflow-hidden py-2.5 pl-8 pr-8")}
        >
          <span className={s.streak} style={delay(600)} />
          {sponsor.logoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={sponsor.logoUrl} alt={sponsor.name} className="relative z-10 h-9 max-w-[7rem] object-contain" />
          )}
          <span className="relative z-10 min-w-0 text-right leading-tight">
            <span className={cn(s.semi, "block truncate text-[1.25rem] font-extrabold")}>{sponsor.name}</span>
            {sponsor.tagline && (
              <span className={cn(s.semi, "block truncate text-[1rem] font-semibold text-[color:var(--sb-mist)]")}>
                {sponsor.tagline}
              </span>
            )}
          </span>
        </div>
      )}
    </Frame>
  );
}

export function Ticker(p: OverlayElementProps["ticker"]) {
  const { text, state } = p;
  if (!text.trim()) return null;
  return (
    <Frame
      state={state}
      className="fixed inset-x-0 bottom-0 z-20 flex h-[2.875rem] items-stretch"
    >
      <div className={cn(s.well, s.edgeTop, "absolute inset-0")} style={neonStyle("magenta")} />
      <div
        style={{ ...neonStyle("magenta"), "--k": "14px", marginLeft: SAFE_X } as CSSProperties}
        className={cn(s.neon, s.slant, s.label, "relative z-10 flex shrink-0 items-center px-7 text-[1.0625rem]")}
      >
        <span className="relative z-10">Update</span>
      </div>
      <div className="relative z-10 flex min-w-0 flex-1 items-center overflow-hidden whitespace-nowrap" style={{ marginRight: SAFE_X }}>
        <div className={cn(s.crawl, s.semi, "inline-flex items-center text-[1.375rem] font-bold")}>
          <span className="mx-12">{text}</span>
          <span aria-hidden="true" className="mx-2 h-4 w-[3px] -skew-x-[20deg] bg-[color:var(--sb-magenta)]" />
          <span className="mx-12" aria-hidden="true">
            {text}
          </span>
          <span aria-hidden="true" className="mx-2 h-4 w-[3px] -skew-x-[20deg] bg-[color:var(--sb-magenta)]" />
        </div>
      </div>
    </Frame>
  );
}
