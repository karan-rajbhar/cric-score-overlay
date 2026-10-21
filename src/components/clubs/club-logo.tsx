import type React from "react";
import { cn } from "~/lib/utils";
import { deriveShortName } from "~/lib/utils";
import { Shield } from "lucide-react";
import { nameHue, TINT } from "~/components/ds/avatar";

interface ClubLogoProps {
  name: string;
  shortName?: string | null;
  logoUrl?: string | null;
  className?: string;
}

/**
 * Club crest, like a team's: the uploaded logo, else its initials on the
 * club's own soft tint, round.
 */
export function ClubLogo({
  name,
  shortName,
  logoUrl,
  className,
}: ClubLogoProps) {
  if (logoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={logoUrl}
        alt={`${name} logo`}
        loading="lazy"
        decoding="async"
        className={cn(
          "h-12 w-12 shrink-0 rounded-full bg-card object-contain",
          className,
        )}
      />
    );
  }

  const initials = deriveShortName(shortName || name);

  return (
    <div
      className={cn(
        "flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full",
        TINT,
        className,
      )}
      style={{ "--h": nameHue(name) } as React.CSSProperties}
      title={name}
      aria-label={`${name} emblem`}
    >
      {initials ? (
        <span className="font-semibold">{initials}</span>
      ) : (
        <Shield className="h-5 w-5" />
      )}
    </div>
  );
}
