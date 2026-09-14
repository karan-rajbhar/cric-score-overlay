"use client";

import { useEffect, useState } from "react";
import type { SponsorItem } from "./types";
import { Shield } from "lucide-react";

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

  useEffect(() => {
    if (!sponsors || sponsors.length <= 1) return;

    const timer = setInterval(
      () => {
        setFade(false);
        setTimeout(() => {
          setCurrentIndex((prev) => (prev + 1) % sponsors.length);
          setFade(true);
        }, 300);
      },
      Math.max(intervalSecs, 5) * 1000,
    );

    return () => clearInterval(timer);
  }, [sponsors, intervalSecs]);

  if (!visible) return null;

  const currentSponsor =
    sponsors && sponsors.length > 0 ? sponsors[currentIndex] : null;

  return (
    <div className="pointer-events-none fixed right-6 top-16 z-20 flex select-none flex-col items-end gap-1.5 font-sans">
      {/* 1. Station / League Watermark */}
      <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-black/60 px-3 py-1.5 shadow-lg backdrop-blur-md">
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logoUrl} alt="Logo" className="h-5 w-5 object-contain" />
        ) : (
          <Shield className="h-4 w-4 text-amber-400" />
        )}
        <span className="text-xs font-black uppercase tracking-wider text-white/90">
          {title ?? "LIVE STREAM"}
        </span>
      </div>

      {/* 2. Rotating Sponsor Carousel */}
      {currentSponsor && (
        <div
          className={`flex items-center gap-2 rounded-md border border-white/10 bg-white/10 px-2.5 py-1 backdrop-blur-sm transition-opacity duration-300 ${
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
          ) : (
            <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
          )}
          <div className="text-right">
            <span className="block text-[10px] font-bold uppercase leading-tight text-amber-300">
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
