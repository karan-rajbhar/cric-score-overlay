"use client";

import { useEffect, useState } from "react";
import { cn } from "~/lib/utils";
import { OV, OverlayFrame, type OverlayThemeProps } from "./overlay-kit";
import type { SponsorItem } from "./types";

interface CornerWatermarkProps extends OverlayThemeProps {
  title?: string | null;
  logoUrl?: string | null;
  sponsors?: SponsorItem[];
  intervalSecs?: number;
  visible?: boolean;
}

/**
 * Top-right corner: the competition (logo and name) and, under it, the
 * sponsors one at a time (every `intervalSecs`, at least 5 s).
 */
export function CornerWatermark({
  title,
  logoUrl,
  sponsors = [],
  intervalSecs = 20,
  visible = true,
  theme,
  customColors,
}: CornerWatermarkProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const sponsorsLength = sponsors.length;

  useEffect(() => {
    if (sponsorsLength <= 1) return;
    const timer = setInterval(
      () => setCurrentIndex((prev) => (prev + 1) % sponsorsLength),
      Math.max(intervalSecs, 5) * 1000,
    );
    return () => clearInterval(timer);
  }, [sponsorsLength, intervalSecs]);

  if (!visible || (!title && sponsorsLength === 0)) return null;
  const sponsor = sponsorsLength
    ? sponsors[currentIndex % sponsorsLength]
    : null;

  return (
    <OverlayFrame
      state={null}
      theme={theme}
      customColors={customColors}
      className="pointer-events-none fixed right-12 top-10 z-20 flex flex-col items-end gap-2"
    >
      {title && (
        <div
          className={cn(
            "flex max-w-[26rem] items-center gap-2.5 rounded-md px-3.5 py-2",
            OV.bar,
            OV.shadow,
          )}
        >
          {logoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt="" className="h-6 w-6 object-contain" />
          )}
          <span className="truncate text-lg font-medium">{title}</span>
        </div>
      )}
      {sponsor && (
        <div
          key={sponsor.id}
          className={cn(
            "flex max-w-[22rem] items-center gap-2.5 rounded-md px-3 py-1.5 duration-300 animate-in fade-in motion-reduce:animate-none",
            OV.card,
            OV.shadow,
          )}
        >
          {sponsor.logoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={sponsor.logoUrl}
              alt={sponsor.name}
              className="h-7 max-w-[6rem] object-contain"
            />
          )}
          <span className="min-w-0 text-right leading-tight">
            <span className="block truncate text-base font-semibold">
              {sponsor.name}
            </span>
            {sponsor.tagline && (
              <span className={cn("block truncate text-sm", OV.cardMuted)}>
                {sponsor.tagline}
              </span>
            )}
          </span>
        </div>
      )}
    </OverlayFrame>
  );
}
