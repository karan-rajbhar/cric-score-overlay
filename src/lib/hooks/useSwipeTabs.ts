"use client";

import { useCallback, useRef } from "react";

/** Shortest horizontal travel (px) that counts as a swipe. */
const MIN_DISTANCE = 60;
/** The swipe must be this much more horizontal than vertical. */
const DIRECTION_RATIO = 1.5;
/** Longest gesture (ms): a slow drag is reading or scrolling, not a flick. */
const MAX_DURATION = 700;

interface Point {
  x: number;
  y: number;
  t: number;
}

/**
 * Which way a touch from `start` to `end` swiped: 1 (to the next tab,
 * finger moving left), -1 (previous), or 0 (not a swipe).
 */
export function swipeDirection(start: Point, end: Point): -1 | 0 | 1 {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  if (end.t - start.t > MAX_DURATION) return 0;
  if (Math.abs(dx) < MIN_DISTANCE) return 0;
  if (Math.abs(dx) < Math.abs(dy) * DIRECTION_RATIO) return 0;
  return dx < 0 ? 1 : -1;
}

/**
 * Whether a touch starting at `target` belongs to something else: a form
 * field, an element marked `data-no-swipe`, or anything between it and
 * `root` that scrolls sideways (a wide scorecard table, a chart).
 */
export function ownsHorizontalGesture(
  target: EventTarget | null,
  root: HTMLElement | null,
): boolean {
  let el = target instanceof Element ? target : null;
  while (el && el !== root) {
    if (el.matches("input, textarea, select, [role='slider'], [data-no-swipe]")) {
      return true;
    }
    if (el instanceof HTMLElement && el.scrollWidth > el.clientWidth + 1) {
      const overflowX = getComputedStyle(el).overflowX;
      if (overflowX === "auto" || overflowX === "scroll") return true;
    }
    el = el.parentElement;
  }
  return false;
}

/**
 * Swipe left / right on the tab panels to move between `tabs` (in order).
 * Returns touch handlers for the panels' container.
 */
export function useSwipeTabs<T extends string>({
  tabs,
  value,
  onChange,
}: {
  tabs: readonly T[];
  value: T;
  onChange: (tab: T) => void;
}) {
  const start = useRef<Point | null>(null);

  const onTouchStart = useCallback((e: React.TouchEvent<HTMLElement>) => {
    const touch = e.touches[0];
    // One finger only (two is a pinch), and not on something that scrolls
    // or slides sideways itself.
    if (
      e.touches.length !== 1 ||
      !touch ||
      ownsHorizontalGesture(e.target, e.currentTarget)
    ) {
      start.current = null;
      return;
    }
    start.current = { x: touch.clientX, y: touch.clientY, t: Date.now() };
  }, []);

  const onTouchEnd = useCallback(
    (e: React.TouchEvent<HTMLElement>) => {
      const from = start.current;
      start.current = null;
      const touch = e.changedTouches[0];
      if (!from || !touch) return;
      const dir = swipeDirection(from, {
        x: touch.clientX,
        y: touch.clientY,
        t: Date.now(),
      });
      if (!dir) return;
      const next = tabs[tabs.indexOf(value) + dir];
      if (next) onChange(next);
    },
    [tabs, value, onChange],
  );

  const onTouchCancel = useCallback(() => {
    start.current = null;
  }, []);

  return { onTouchStart, onTouchEnd, onTouchCancel };
}
