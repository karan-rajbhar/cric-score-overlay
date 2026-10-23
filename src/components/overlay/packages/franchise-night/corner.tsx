"use client";

/**
 * Franchise night's corner plate (the event's name and the sponsors, one
 * at a time) and the crawl along the bottom edge.
 */

import { useEffect, useState } from "react";
import { cn } from "~/lib/utils";
import type { OverlayElementProps } from "../types";
import {
  DISPLAY,
  FnRoot,
  GoldRule,
  Kicker,
  LIFT,
  SAFE,
  SAFE_WIDTH,
  TEXT,
  chamfer,
  deepGlass,
  glass,
  goldFill,
} from "./kit";
import { FN } from "./theme";

/** Every 20 seconds, the next sponsor. */
const ROTATE_MS = 20_000;

export function FranchiseSponsors(p: OverlayElementProps["sponsors"]) {
  const [index, setIndex] = useState(0);
  const count = p.sponsors.length;
  useEffect(() => {
    if (count <= 1) return;
    const t = setInterval(() => setIndex((i) => (i + 1) % count), ROTATE_MS);
    return () => clearInterval(t);
  }, [count]);
  const sponsor = count ? p.sponsors[index % count] : null;
  if (!p.title && !sponsor) return null;
  return (
    <FnRoot className="fixed z-20 flex flex-col items-end gap-2" style={{ right: SAFE.x, top: SAFE.y }}>
      {p.title && (
        <div style={LIFT}>
          <div className="fn-a-wipe flex h-12 max-w-[30rem] items-center gap-3 px-5" style={{ ...glass(), clipPath: chamfer(10) }}>
            <span aria-hidden="true" className="block h-6 w-[5px] shrink-0" style={goldFill()} />
            <span className={cn(DISPLAY, "truncate")} style={{ fontSize: "1.5rem", letterSpacing: "0.03em" }}>
              {p.title}
            </span>
          </div>
        </div>
      )}
      {sponsor && (
        <div key={sponsor.id} style={LIFT} className="fn-a-slide-r">
          <div className="flex max-w-[26rem] items-stretch" style={{ clipPath: chamfer(10) }}>
            <span className={cn(TEXT, "flex items-center px-3 font-semibold uppercase")} style={{ ...goldFill(), fontSize: "0.9375rem", letterSpacing: "0.08em", writingMode: "vertical-rl", transform: "rotate(180deg)" }}>
              Partner
            </span>
            <div className="flex min-w-0 items-center gap-3 px-4 py-2" style={{ background: "linear-gradient(180deg, #ffffff 0%, #eef0f6 100%)", color: "#10131d" }}>
              {sponsor.logoUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={sponsor.logoUrl} alt={sponsor.name} className="h-10 max-w-[8rem] object-contain" />
              )}
              <span className="min-w-0 text-right leading-tight">
                <span className={cn(DISPLAY, "block truncate")} style={{ fontSize: "1.375rem" }}>
                  {sponsor.name}
                </span>
                {sponsor.tagline && (
                  <span className={cn(TEXT, "block truncate font-semibold")} style={{ fontSize: "1rem", color: "#4b5068" }}>
                    {sponsor.tagline}
                  </span>
                )}
              </span>
            </div>
          </div>
        </div>
      )}
    </FnRoot>
  );
}

/** A crawl: the text twice, scrolled half its width per lap. */
export function FranchiseTicker(p: OverlayElementProps["ticker"]) {
  const text = p.text.trim();
  if (!text) return null;
  // About 110 px a second whatever the length.
  const lap = Math.max(18, Math.round((text.length * 15 + 160) / 110));
  return (
    <FnRoot className="fixed z-20" style={{ left: SAFE.x, bottom: 6, width: SAFE_WIDTH }}>
      <div style={LIFT}>
        <GoldRule />
        <div className="flex h-11 items-stretch overflow-hidden" style={deepGlass()}>
          <span className="relative z-10 flex shrink-0 items-center px-1">
            <Kicker size="sm">Latest</Kicker>
          </span>
          <div className="relative min-w-0 flex-1 overflow-hidden">
            <div
              className="fn-a-crawl absolute inset-y-0 left-0 flex items-center whitespace-nowrap"
              style={{ ["--fn-crawl" as string]: `${lap}s` }}
            >
              {[0, 1].map((k) => (
                <span key={k} aria-hidden={k === 1} className={cn(TEXT, "flex items-center gap-6 pr-24 font-semibold")} style={{ fontSize: "1.375rem" }}>
                  <span aria-hidden="true" className="block h-2.5 w-2.5 rotate-45" style={{ background: FN.gold }} />
                  {text}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </FnRoot>
  );
}
