"use client";

import * as React from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "~/lib/utils";

import { cardSurface } from "./card";

/**
 * A card that folds on phones: a native `<details>`, so the keyboard, screen
 * readers and the browser's find-in-page work (a match opens it). For
 * secondary content only: what people came for stays open. Closed on phones
 * unless `defaultOpen`; open from `md` up, where there is room. `aside` sits
 * at the end of the title row and `below` under it, both visible while
 * closed, so the fold says what it holds. Pass nothing interactive in them:
 * the whole row is the toggle.
 */
export function Disclosure({
  title,
  aside,
  below,
  defaultOpen = false,
  lazy = false,
  id,
  className,
  children,
}: {
  title: React.ReactNode;
  aside?: React.ReactNode;
  below?: React.ReactNode;
  defaultOpen?: boolean;
  /** Mount the content on first opening: for content that reads data. */
  lazy?: boolean;
  id?: string;
  className?: string;
  children: React.ReactNode;
}) {
  const ref = React.useRef<HTMLDetailsElement>(null);
  const [opened, setOpened] = React.useState(defaultOpen);
  // After mount, so the server's HTML matches on every screen; these sit
  // below the fold, so nothing visibly moves.
  React.useEffect(() => {
    if (ref.current && window.matchMedia?.("(min-width: 768px)").matches) {
      ref.current.open = true;
    }
  }, [defaultOpen]);
  return (
    <details
      ref={ref}
      id={id}
      open={defaultOpen}
      onToggle={(e) => {
        if (e.currentTarget.open) setOpened(true);
      }}
      className={cn(cardSurface, "group overflow-hidden", className)}
    >
      <summary className="block min-h-11 cursor-pointer list-none rounded-xl px-4 py-3 transition-colors hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
        <span className="flex items-center gap-3">
          <h3 className="min-w-0 flex-1 text-base font-semibold text-foreground">
            {title}
          </h3>
          {aside && <span className="shrink-0">{aside}</span>}
          <ChevronDown
            className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180 motion-reduce:transition-none"
            aria-hidden="true"
          />
        </span>
        {below && <span className="mt-2 block">{below}</span>}
      </summary>
      {(!lazy || opened) && children}
    </details>
  );
}
