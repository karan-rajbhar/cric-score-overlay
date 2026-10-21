import type * as React from "react";
import { cn } from "~/lib/utils";

/** Stable hue per name, so a person keeps their colour everywhere. */
function nameHue(name: string): number {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) | 0;
  }
  return Math.abs(hash) % 360;
}

/**
 * Round initials avatar for people (players, members, scorers), on a soft
 * tint of a stable per-name hue. Size it with h-/w-/text- classes; the
 * default is 32px.
 */
export function Initials({
  name,
  fallback = "?",
  letters = 1,
  className,
}: {
  name: string | null | undefined;
  fallback?: string;
  letters?: 1 | 2;
  className?: string;
}) {
  const text = (name?.trim() || fallback).slice(0, letters).toUpperCase();
  return (
    <span
      aria-hidden="true"
      className={cn(
        "flex h-8 w-8 shrink-0 select-none items-center justify-center rounded-full bg-[hsl(var(--h)_70%_93%)] text-xs font-semibold text-[hsl(var(--h)_55%_28%)] dark:bg-[hsl(var(--h)_35%_20%)] dark:text-[hsl(var(--h)_70%_82%)]",
        className,
      )}
      style={{ "--h": nameHue(name?.trim() || fallback) } as React.CSSProperties}
    >
      {text}
    </span>
  );
}
