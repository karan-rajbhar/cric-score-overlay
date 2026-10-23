"use client";

import { useEffect, useRef } from "react";
import type { OverlayThemeProps } from "./overlay-kit";
import { OverlayElement } from "./packages/element";
import type { StingKind } from "./packages/types";
import type { ActiveEventSting, LiveMatchState } from "./types";

interface EventStingsProps extends OverlayThemeProps {
  sting: ActiveEventSting | null;
  onDismiss: () => void;
  /** The live row, for packages whose stings show the score. */
  state?: LiveMatchState | null;
}

const MILESTONE_KIND: Record<string, StingKind> = {
  fifty: "fifty",
  hundred: "hundred",
  "double hundred": "hundred",
  "150": "hundred",
  "three wickets": "three_for",
  "five wickets": "five_for",
  "hat-trick": "hat_trick",
};

/** What a sting celebrates, for packages that draw each kind its own way. */
export function stingKindOf(sting: ActiveEventSting): StingKind {
  if (sting.kind) return sting.kind;
  if (sting.type !== "milestone") return sting.type;
  return MILESTONE_KIND[sting.title.trim().toLowerCase()] ?? "milestone";
}

/**
 * The event card on air (four / six / wicket / milestone / free hit): the
 * package's sting element, and its auto-dismiss timer.
 */
export function EventStings({
  sting,
  onDismiss,
  theme = "standard",
  customColors = null,
  state = null,
}: EventStingsProps) {
  const onDismissRef = useRef(onDismiss);
  useEffect(() => {
    onDismissRef.current = onDismiss;
  });

  const stingId = sting?.id;
  const duration = sting?.durationMs || 4500;

  useEffect(() => {
    if (!stingId) return;
    const timer = setTimeout(() => onDismissRef.current(), duration);
    return () => clearTimeout(timer);
  }, [stingId, duration]);

  return (
    <OverlayElement
      id="sting"
      present={!!sting}
      motionKey={sting?.id}
      props={
        sting
          ? {
              state,
              match: null,
              snapshots: null,
              theme,
              customColors,
              layout: "bottom",
              sting,
              kind: stingKindOf(sting),
            }
          : undefined
      }
    />
  );
}
