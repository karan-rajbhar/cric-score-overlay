import React from "react";
import { cn } from "~/lib/utils";
import { deriveShortName } from "~/lib/utils";
import { Shield } from "lucide-react";

/**
 * Deterministic accent hue for a club name so every club gets a stable,
 * distinctive brand color when no custom logo is uploaded.
 */
function clubHue(name: string): number {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) | 0;
  }
  return Math.abs(hash) % 360;
}

interface ClubLogoProps {
  name: string;
  shortName?: string | null;
  logoUrl?: string | null;
  className?: string;
}

/**
 * Club crest: uploaded logo if present, otherwise auto-generated initials
 * on a distinct, stable club accent shield.
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
          "h-12 w-12 shrink-0 rounded-2xl border border-border object-cover shadow-sm",
          className,
        )}
      />
    );
  }

  const hue = clubHue(name);
  const initials = deriveShortName(shortName || name);

  return (
    <div
      className={cn(
        "flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-2xl border shadow-inner transition-all",
        className,
      )}
      style={{
        backgroundColor: `hsl(${hue} 40% 18%)`,
        borderColor: `hsl(${hue} 50% 32%)`,
        color: `hsl(${hue} 85% 75%)`,
      }}
      title={name}
      aria-label={`${name} emblem`}
    >
      {initials ? (
        <span className="font-black tracking-wider">{initials}</span>
      ) : (
        <Shield className="h-5 w-5" />
      )}
    </div>
  );
}
