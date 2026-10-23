"use client";

/**
 * World event's persistent pieces outside the bar: the event plate in the
 * top-right corner (the competition, then its sponsors one at a time) and
 * the news ticker along the bottom edge.
 */

import { useEffect, useState } from "react";
import type { OverlayElementProps } from "../types";
import { delay, Root } from "./kit";
import { SAFE } from "../shared/layout";

const ROTATE_MS = 20_000;

export function WorldEventSponsors(p: OverlayElementProps["sponsors"]) {
  const [at, setAt] = useState(0);
  const count = p.sponsors.length;
  useEffect(() => {
    if (count < 2) return;
    const id = setInterval(() => setAt((i) => (i + 1) % count), ROTATE_MS);
    return () => clearInterval(id);
  }, [count]);
  if (!p.title && count === 0) return null;
  const sponsor = count ? p.sponsors[at % count] : null;
  return (
    <Root state={p.state} data-testid="we-sponsors" className="flex flex-col items-end" style={{ right: SAFE.x, top: SAFE.y }}>
      {p.title && (
        <div className="we-lift flex h-[50px] max-w-[460px] items-stretch">
          <span className="we-accent w-[10px] shrink-0" />
          <span className="we-night we-a-wipe-l flex min-w-0 items-center px-5">
            <span className="we-label we-trunc text-[19px]">{p.title}</span>
          </span>
        </div>
      )}
      {sponsor && (
        <div key={sponsor.id} className="we-paper we-lift we-a-drop mt-2 flex h-[64px] max-w-[400px] items-center gap-3 px-4" style={delay(200)}>
          {sponsor.logoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={sponsor.logoUrl} alt={sponsor.name} className="h-[40px] max-w-[120px] object-contain" />
          )}
          <span className="flex min-w-0 flex-col items-end text-right">
            <span className="we-name we-trunc max-w-full text-[20px]">{sponsor.name}</span>
            {sponsor.tagline && <span className="we-ink-muted we-trunc max-w-full text-[16px] font-semibold">{sponsor.tagline}</span>}
          </span>
        </div>
      )}
    </Root>
  );
}

export function WorldEventTicker(p: OverlayElementProps["ticker"]) {
  if (!p.text.trim()) return null;
  return (
    <Root state={p.state} data-testid="we-ticker" className="inset-x-0 bottom-0 flex h-[46px] items-stretch overflow-hidden">
      <span className="we-accent we-label we-cut-r z-10 flex shrink-0 items-center pr-10 text-[19px]" style={{ paddingLeft: SAFE.x, ["--we-cut" as string]: "18px" }}>
        Latest
      </span>
      <div className="we-night -ml-[18px] flex min-w-0 flex-1 items-center overflow-hidden whitespace-nowrap">
        <div className="we-marquee inline-flex items-center text-[21px] font-bold">
          <span className="px-14">{p.text}</span>
          <span className="px-14" aria-hidden="true">
            {p.text}
          </span>
        </div>
      </div>
    </Root>
  );
}
