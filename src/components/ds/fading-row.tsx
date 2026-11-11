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
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  const { onScroll, ...fade } = useEdgeFade<HTMLDivElement>(null);
  return (
    <div {...fade} onScroll={onScroll} className={cn("tabs-fade", className)}>
      {children}
    </div>
  );
}
