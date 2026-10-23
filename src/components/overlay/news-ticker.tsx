"use client";

import { cn } from "~/lib/utils";
import { OV, OverlayFrame, type OverlayThemeProps } from "./overlay-kit";

interface NewsTickerProps extends OverlayThemeProps {
  text?: string;
  badge?: string;
  visible?: boolean;
}

/** A crawl along the bottom edge (stops under reduced motion). */
export function NewsTicker({
  text = "",
  badge = "Update",
  visible = true,
  theme,
  customColors,
}: NewsTickerProps) {
  if (!visible || !text.trim()) return null;

  return (
    <OverlayFrame
      state={null}
      theme={theme}
      customColors={customColors}
      className={cn(
        "pointer-events-none fixed inset-x-0 bottom-0 z-20 flex h-10 items-center overflow-hidden",
        OV.panel,
      )}
    >
      <div
        className={cn(
          "z-10 flex h-full shrink-0 items-center px-4 text-base font-semibold",
          OV.accent,
        )}
      >
        {badge}
      </div>
      <div className="relative flex w-full overflow-hidden whitespace-nowrap">
        <div className="inline-flex animate-marquee items-center text-lg font-medium motion-reduce:animate-none">
          <span className="mx-10">{text}</span>
          <span className="mx-10" aria-hidden="true">
            {text}
          </span>
        </div>
      </div>
    </OverlayFrame>
  );
}
