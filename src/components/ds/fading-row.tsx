"use client";

import type * as React from "react";
import { useEdgeFade } from "~/components/ui/tabs";
import { cn } from "~/lib/utils";

/**
 * One sideways line of chips that fades at an edge with more beyond it,
 * as the tab bars do (T5): a cut chip reads as something to scroll to,
 * not as broken.
 */
export function FadingRow({
  label = "Labels",
  className,
  children,
}: {
  /** The row's name, for a keyboard that scrolls it. */
  label?: string;
  className?: string;
  children: React.ReactNode;
}) {
  const { onScroll, ...fade } = useEdgeFade<HTMLDivElement>(null);
  // While it overflows, a keyboard can reach and scroll it (its chips are
  // not focusable themselves).
  const overflows =
    fade["data-fade-start"] !== undefined || fade["data-fade-end"] !== undefined;
  return (
    <div
      {...fade}
      onScroll={onScroll}
      role="group"
      aria-label={label}
      tabIndex={overflows ? 0 : undefined}
      className={cn(
        "tabs-fade rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        className,
      )}
    >
      {children}
    </div>
  );
}
