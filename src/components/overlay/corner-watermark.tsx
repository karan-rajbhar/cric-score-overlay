"use client";

import { useEffect, useState } from "react";
import type { SponsorItem } from "./types";

interface CornerWatermarkProps {
  title?: string | null;
  logoUrl?: string | null;
  sponsors?: SponsorItem[];
  intervalSecs?: number;
  visible?: boolean;
}

export function CornerWatermark({
  title = "Cricket Live",
  logoUrl,
  sponsors = [],
  intervalSecs = 20,
  visible = true,
}: CornerWatermarkProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [fade, setFade] = useState(true);

  const sponsorsLength = sponsors?.length ?? 0;

  useEffect(() => {
    if (sponsorsLength <= 1) return;

    const timer = setInterval(
      () => {
        setFade(false);
        setTimeout(() => {
          setCurrentIndex((prev) => (prev + 1) % sponsorsLength);
          setFade(true);
        }, 300);
      },
      Math.max(intervalSecs, 5) * 1000,
    );

    return () => clearInterval(timer);
  }, [sponsorsLength, intervalSecs]);

  if (!visible) return null;

  const currentSponsor =
    sponsors && sponsors.length > 0 ? sponsors[currentIndex] : null;

  return (
    <div className="pointer-events-none fixed right-6 top-16 z-20 flex select-none flex-col items-end gap-1.5 font-sans">
      {/* 1. Station / League Watermark */}
      <div className="flex items-center gap-2 rounded-md border border-white/10 bg-[#0b0f17]/90 px-3 py-1.5">
        {logoUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logoUrl} alt="Logo" className="h-5 w-5 object-contain" />
        )}
        <span className="text-xs font-semibold text-white/90">
          {title ?? "Live"}
        </span>
      </div>

      {/* 2. Rotating Sponsor Carousel */}
      {currentSponsor && (
        <div
          className={`flex items-center gap-2 rounded-md border border-white/10 bg-[#0b0f17]/90 px-2.5 py-1 transition-opacity duration-300 ${
            fade ? "opacity-100" : "opacity-0"
          }`}
        >
          {currentSponsor.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={currentSponsor.logoUrl}
              alt={currentSponsor.name}
              className="h-4 w-4 object-contain"
            />
          ) : null}
          <div className="text-right">
            <span className="block text-[11px] font-semibold leading-tight text-white">
              {currentSponsor.name}
            </span>
            {currentSponsor.tagline && (
              <span className="block text-[9px] leading-tight text-white/60">
                {currentSponsor.tagline}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
