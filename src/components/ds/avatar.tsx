import type * as React from "react";
import { cn, deriveShortName } from "~/lib/utils";

const SIZE = {
  xs: "h-6 w-6 text-2xs",
  sm: "h-8 w-8 text-xs",
  md: "h-10 w-10 text-sm",
  lg: "h-14 w-14 text-base",
  xl: "h-20 w-20 text-xl",
} as const;

type Size = keyof typeof SIZE;

/** Stable hue per name, so a team or player keeps its colour everywhere. */
export function nameHue(name: string): number {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) | 0;
  }
  return Math.abs(hash) % 360;
}

/* A soft tint of that hue in light mode, a deep one in dark mode. */
export const TINT =
  "bg-[hsl(var(--h)_70%_93%)] text-[hsl(var(--h)_55%_28%)] dark:bg-[hsl(var(--h)_35%_20%)] dark:text-[hsl(var(--h)_70%_82%)]";

function initialsOf(name: string, letters: 1 | 2): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  if (letters === 1 || words.length === 1) {
    return (words[0] ?? "?").slice(0, letters).toUpperCase();
  }
  return `${words[0]?.[0] ?? ""}${words.at(-1)?.[0] ?? ""}`.toUpperCase();
}

/** A person: photo when there is one, else initials on their tint. */
export function Avatar({
  name,
  src,
  size = "md",
  className,
}: {
  name: string;
  src?: string | null;
  size?: Size;
  className?: string;
}) {
  const base = cn(
    "inline-flex shrink-0 select-none items-center justify-center overflow-hidden rounded-full font-semibold",
    SIZE[size],
    className,
  );
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt=""
        loading="lazy"
        decoding="async"
        className={cn(base, "object-cover")}
      />
    );
  }
  return (
    <span
      aria-hidden="true"
      className={cn(base, TINT)}
      style={{ "--h": nameHue(name) } as React.CSSProperties}
    >
      {initialsOf(name, 2)}
    </span>
  );
}

/**
 * A team: its uploaded logo as is (Scoreline shows bare crests; on a white
 * disc in dark mode, so dark logos stay visible), or its short code on the
 * team's tint.
 */
export function TeamCrest({
  name,
  shortName,
  logoUrl,
  size = "md",
  className,
}: {
  name: string;
  shortName?: string | null;
  logoUrl?: string | null;
  size?: Size;
  className?: string;
}) {
  const base = cn(
    "inline-flex shrink-0 select-none items-center justify-center overflow-hidden rounded-full font-semibold tracking-wide",
    SIZE[size],
    className,
  );
  if (logoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={logoUrl}
        alt=""
        loading="lazy"
        decoding="async"
        // What the report's PDF shows if the logo cannot be drawn.
        data-initials={deriveShortName(shortName || name)}
        className={cn(base, "object-contain dark:bg-white dark:p-1")}
      />
    );
  }
  return (
    <span
      aria-hidden="true"
      title={name}
      className={cn(base, TINT)}
      style={{ "--h": nameHue(name) } as React.CSSProperties}
    >
      {size === "xs"
        ? deriveShortName(shortName || name).slice(0, 1)
        : deriveShortName(shortName || name)}
    </span>
  );
}
