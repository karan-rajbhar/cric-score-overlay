"use client";

import { useEffect, useRef, useState } from "react";
import type { Match } from "~/lib/match-types";
import { cn } from "~/lib/utils";
import { OverlayStage } from "./overlay-stage";
import type { LiveMatchState } from "./types";
import type { OverlayLayers } from "./use-overlay-state";

const FRAME_W = 1920;
const FRAME_H = 1080;

interface OverlayPreviewProps {
  state: LiveMatchState | null;
  match: Match | null;
  layers: OverlayLayers;
  /** Accessible name, e.g. "Overlay preview: what is on air". */
  label: string;
  className?: string;
  onDismissSting?: () => void;
  onDismissStrap?: () => void;
}

const noop = () => {};

/**
 * The overlay's 1920x1080 frame drawn at the width of its box, over a
 * checkerboard that stands for "transparent" (the camera shows through
 * there on the stream).
 */
export function OverlayPreview({
  state,
  match,
  layers,
  label,
  className,
  onDismissSting = noop,
  onDismissStrap = noop,
}: OverlayPreviewProps) {
  const box = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0);

  useEffect(() => {
    const el = box.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(([entry]) => {
      const width = entry?.contentRect.width ?? el.clientWidth;
      setScale(width / FRAME_W);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div
      ref={box}
      role="img"
      aria-label={label}
      className={cn(
        "relative aspect-video w-full overflow-hidden rounded-lg border border-white/10 bg-[#141821] [background-image:repeating-conic-gradient(#1c212c_0%_25%,#141821_0%_50%)] [background-size:24px_24px]",
        className,
      )}
    >
      {scale > 0 && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute left-0 top-0 origin-top-left"
          style={{
            width: FRAME_W,
            height: FRAME_H,
            transform: `scale(${scale})`,
          }}
        >
          <OverlayStage
            state={state}
            match={match}
            layers={layers}
            onDismissSting={onDismissSting}
            onDismissStrap={onDismissStrap}
            preview
          />
        </div>
      )}
    </div>
  );
}
