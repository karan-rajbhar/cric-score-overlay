"use client";

/**
 * Test classic corner plaque (the competition over the sponsor, one
 * sponsor at a time) and the ticker (a navy band along the foot, a gold
 * label, the text crawling at reading speed).
 */

import { useEffect, useState } from "react";
import type { OverlayElementProps } from "../types";
import {
  delay,
  DROP_FILTER,
  GoldRule,
  IVORY,
  Label,
  NAVY,
  RADIUS,
  SAFE,
  SERIF,
  TC,
  TcRoot,
} from "./kit";

const ROTATE_MS = 20_000;

export function SponsorPlaque(p: OverlayElementProps["sponsors"]) {
  const { sponsors, title } = p;
  const [index, setIndex] = useState(0);
  const count = sponsors.length;
  useEffect(() => {
    if (count <= 1) return;
    const t = setInterval(() => setIndex((i) => (i + 1) % count), ROTATE_MS);
    return () => clearInterval(t);
  }, [count]);
  if (!title && !count) return null;
  const sponsor = count ? sponsors[index % count]! : null;
  return (
    <TcRoot
      className="fixed z-20 flex w-[24rem] flex-col items-stretch"
      style={{ top: SAFE.y, right: SAFE.x, filter: DROP_FILTER }}
    >
      {title && (
        <div
          className="tc-a-wipe relative overflow-hidden px-5 py-3"
          style={{ ...NAVY, borderTopLeftRadius: RADIUS, borderTopRightRadius: RADIUS, ...(sponsor ? {} : { borderRadius: RADIUS }) }}
        >
          <GoldRule height={2} className="absolute inset-x-0 top-0" />
          <span className="block truncate text-[1.375rem] font-bold" style={{ fontFamily: SERIF }}>
            {title}
          </span>
        </div>
      )}
      {sponsor && (
        <div
          key={sponsor.id}
          className="tc-a-fade flex items-center gap-3.5 px-5 py-2.5"
          style={{
            ...IVORY,
            borderBottomLeftRadius: RADIUS,
            borderBottomRightRadius: RADIUS,
            ...(title ? {} : { borderRadius: RADIUS }),
            ...delay(200),
          }}
        >
          {sponsor.logoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={sponsor.logoUrl} alt={sponsor.name} className="h-9 max-w-[7rem] object-contain" />
          )}
          <span className="min-w-0 leading-tight">
            <Label style={{ color: TC.inkMuted }}>In association with</Label>
            <span className="mt-1 block truncate text-[1.25rem] font-semibold" style={{ color: TC.ink }}>
              {sponsor.name}
            </span>
            {sponsor.tagline && (
              <span className="block truncate text-[1rem] italic" style={{ fontFamily: SERIF, color: TC.inkMuted }}>
                {sponsor.tagline}
              </span>
            )}
          </span>
        </div>
      )}
    </TcRoot>
  );
}

export function Ticker(p: OverlayElementProps["ticker"]) {
  const text = p.text.trim();
  if (!text) return null;
  // Reading speed: about 110px a second whatever the length.
  const seconds = Math.max(18, Math.round((text.length * 13) / 110) * 2);
  return (
    <TcRoot className="fixed inset-x-0 z-20" style={{ bottom: 8 }}>
      <div className="tc-a-wipe relative flex h-10 items-stretch overflow-hidden" style={NAVY}>
        <GoldRule height={2} className="absolute inset-x-0 top-0 z-10" />
        <div className="relative z-10 flex shrink-0 items-center pl-[96px] pr-5" style={{ background: `linear-gradient(90deg, ${TC.navyLo} 85%, transparent)` }}>
          <span className="rounded-[3px] px-2.5 py-1" style={{ background: TC.gold }}>
            <Label style={{ color: TC.ink }}>Latest</Label>
          </span>
        </div>
        <div className="relative min-w-0 flex-1 overflow-hidden">
          <div
            className="tc-a-crawl absolute inset-y-0 left-0 flex items-center whitespace-nowrap text-[1.3125rem] font-medium"
            style={{ "--tc-crawl": `${seconds}s` } as React.CSSProperties}
          >
            <span className="px-16">{text}</span>
            <span className="px-16" aria-hidden="true">
              {text}
            </span>
          </div>
        </div>
      </div>
    </TcRoot>
  );
}
