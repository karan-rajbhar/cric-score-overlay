"use client";

/**
 * Motion for broadcast packages: Web Animations API only (no animation
 * dependency).
 *
 * - {@link MOTION}: ready-made enter / exit / update specs to compose.
 * - {@link playMotion}: runs a spec on an element.
 * - {@link AnimatedNumber}: a figure that rolls or flips when it changes.
 * - {@link MotionPreferenceContext}: the control room's preview honours
 *   `prefers-reduced-motion`; the OBS output always animates (a viewer's
 *   setting cannot reach a stream).
 */

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  type ReactNode,
} from "react";
import { cn } from "~/lib/utils";
import type { ElementMotion, MotionSpec } from "./types";

export const MotionPreferenceContext = createContext({
  /** True in previews: reduced motion turns animations off there. */
  respectReducedMotion: false,
});

/** Whether to animate now (always, unless a preview asks to respect the setting). */
export function motionAllowed(respectReducedMotion: boolean): boolean {
  if (!respectReducedMotion || typeof window === "undefined") return true;
  return !window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Play `spec` on `el` (null when it cannot: no element, no WAAPI, or
 * reduced motion in a preview).
 */
export function playMotion(
  el: Element | null,
  spec: MotionSpec | undefined,
  respectReducedMotion: boolean,
): Animation | null {
  if (!el || !spec || typeof (el as HTMLElement).animate !== "function") {
    return null;
  }
  if (!motionAllowed(respectReducedMotion)) return null;
  return (el as HTMLElement).animate(spec.keyframes, {
    duration: spec.durationMs,
    easing: spec.easing ?? "cubic-bezier(0.2, 0.7, 0.2, 1)",
    delay: spec.delayMs ?? 0,
    fill: "both",
  });
}

const EASE_OUT = "cubic-bezier(0.16, 1, 0.3, 1)";
const EASE_IN = "cubic-bezier(0.7, 0, 0.84, 0)";

/** Building blocks: `MOTION.slideUp(400)` etc. */
export const MOTION = {
  fadeIn: (durationMs = 250): MotionSpec => ({
    keyframes: [{ opacity: 0 }, { opacity: 1 }],
    durationMs,
    easing: EASE_OUT,
  }),
  fadeOut: (durationMs = 200): MotionSpec => ({
    keyframes: [{ opacity: 1 }, { opacity: 0 }],
    durationMs,
    easing: EASE_IN,
  }),
  slideUp: (durationMs = 450, distance = "48px"): MotionSpec => ({
    keyframes: [
      { opacity: 0, transform: `translateY(${distance})` },
      { opacity: 1, transform: "translateY(0)" },
    ],
    durationMs,
    easing: EASE_OUT,
  }),
  slideDown: (durationMs = 300, distance = "48px"): MotionSpec => ({
    keyframes: [
      { opacity: 1, transform: "translateY(0)" },
      { opacity: 0, transform: `translateY(${distance})` },
    ],
    durationMs,
    easing: EASE_IN,
  }),
  /** Reveals left to right (a wipe). */
  wipeIn: (durationMs = 500): MotionSpec => ({
    keyframes: [
      { clipPath: "inset(0 100% 0 0)" },
      { clipPath: "inset(0 0 0 0)" },
    ],
    durationMs,
    easing: EASE_OUT,
  }),
  wipeOut: (durationMs = 350): MotionSpec => ({
    keyframes: [
      { clipPath: "inset(0 0 0 0)" },
      { clipPath: "inset(0 0 0 100%)" },
    ],
    durationMs,
    easing: EASE_IN,
  }),
  scaleIn: (durationMs = 400): MotionSpec => ({
    keyframes: [
      { opacity: 0, transform: "scale(0.92)" },
      { opacity: 1, transform: "scale(1)" },
    ],
    durationMs,
    easing: EASE_OUT,
  }),
  /** A short flash for updates (a new score, a new strap). */
  pulse: (durationMs = 400): MotionSpec => ({
    keyframes: [
      { filter: "brightness(1)" },
      { filter: "brightness(1.6)" },
      { filter: "brightness(1)" },
    ],
    durationMs,
  }),
} as const;

/** A whole element's motion from two building blocks. */
export function elementMotion(
  enter: MotionSpec,
  exit: MotionSpec,
  update?: MotionSpec,
): ElementMotion {
  return { enter, exit, ...(update ? { update } : {}) };
}

const ROLL = (durationMs: number): MotionSpec => ({
  keyframes: [
    { transform: "translateY(55%)", opacity: 0 },
    { transform: "translateY(0)", opacity: 1 },
  ],
  durationMs,
  easing: EASE_OUT,
});

const FLIP = (durationMs: number): MotionSpec => ({
  keyframes: [
    { transform: "perspective(400px) rotateX(-90deg)", opacity: 0 },
    { transform: "perspective(400px) rotateX(0deg)", opacity: 1 },
  ],
  durationMs,
  easing: EASE_OUT,
});

/**
 * A figure (score, overs) that animates when it changes: "roll" slides the
 * new value up into place, "flip" turns it over like a board.
 */
export function AnimatedNumber({
  value,
  variant = "roll",
  durationMs = 420,
  className,
}: {
  value: ReactNode;
  variant?: "roll" | "flip";
  durationMs?: number;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const { respectReducedMotion } = useContext(MotionPreferenceContext);
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const spec = variant === "flip" ? FLIP(durationMs) : ROLL(durationMs);
    playMotion(ref.current, spec, respectReducedMotion);
  }, [value, variant, durationMs, respectReducedMotion]);
  return (
    <span
      ref={ref}
      data-animated-number=""
      className={cn("inline-block tabular-nums", className)}
    >
      {value}
    </span>
  );
}
