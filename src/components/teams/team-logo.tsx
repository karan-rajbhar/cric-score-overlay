import type * as React from "react";
import { cn } from "~/lib/utils";
import { deriveShortName } from "~/lib/utils";

/**
 * Deterministic accent hue for a team name so every team gets a stable,
 * distinct color without storing anything.
 */
function nameHue(name: string): number {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) | 0;
  }
  return Math.abs(hash) % 360;
}

interface TeamLogoProps {
  name: string;
  shortName?: string | null;
  logoUrl?: string | null;
  className?: string;
}

/**
 * Team crest, round: uploaded logo if present, otherwise the short code on a
 * soft tint of a stable per-team hue.
 */
export function TeamLogo({
  name,
  shortName,
  logoUrl,
  className,
}: TeamLogoProps) {
  if (logoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={logoUrl}
        alt={`${name} logo`}
        loading="lazy"
        decoding="async"
        width={36}
        height={36}
        className={cn(
          "h-9 w-9 shrink-0 rounded-full object-cover ring-1 ring-border/60",
          className,
        )}
      />
    );
  }

  // A soft tint of the team's hue in light mode, a deep one in dark mode.
  return (
    <span
      className={cn(
        "flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[hsl(var(--h)_70%_93%)] text-xs font-semibold tracking-wide text-[hsl(var(--h)_55%_28%)] dark:bg-[hsl(var(--h)_35%_20%)] dark:text-[hsl(var(--h)_70%_82%)]",
        className,
      )}
      style={{ "--h": nameHue(name) } as React.CSSProperties}
      title={name}
    >
      {deriveShortName(shortName || name)}
    </span>
  );
}
