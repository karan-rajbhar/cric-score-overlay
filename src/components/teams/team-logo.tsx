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
 * Team crest: uploaded logo if present, otherwise auto-generated initials on
 * a stable per-team accent color.
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
          "h-9 w-9 shrink-0 rounded-md border border-border object-cover",
          className,
        )}
      />
    );
  }

  const hue = nameHue(name);
  return (
    <span
      className={cn(
        "flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-md text-xs font-bold tracking-wide",
        className,
      )}
      style={{
        backgroundColor: `hsl(${hue} 45% 22%)`,
        color: `hsl(${hue} 80% 75%)`,
      }}
      title={name}
    >
      {deriveShortName(shortName || name)}
    </span>
  );
}
