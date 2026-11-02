"use client";

import type * as React from "react";
import { useRef } from "react";
import { TopStrip } from "~/components/ds/screen";
import { useScrolledPast } from "~/lib/hooks/useScrolledPast";

/**
 * Goes at the end of a screen's header: once that has scrolled away, a
 * phone keeps saying what the screen is about in the strip above the pinned
 * tabs (`pinnedPage`, `PinnedTabs`). A client piece, so server pages can
 * use it.
 */
export function PinnedTitle({ children }: { children: React.ReactNode }) {
  const end = useRef<HTMLDivElement>(null);
  const top = useRef<HTMLDivElement>(null);
  const past = useScrolledPast(end, top);
  return (
    <>
      <div ref={end} aria-hidden="true" className="h-px" />
      <div
        ref={top}
        aria-hidden="true"
        className="sticky top-[var(--pinned-top,0px)] h-0"
      />
      <TopStrip show={past}>
        <p
          aria-hidden="true"
          className="truncate text-sm font-semibold text-foreground"
        >
          {children}
        </p>
      </TopStrip>
    </>
  );
}
