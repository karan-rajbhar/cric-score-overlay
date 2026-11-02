"use client";

import { useEffect, useState, type RefObject } from "react";

/**
 * True once `anchor` has scrolled up past what is pinned at the top of the
 * screen: `pinned`'s CSS `top`, so the two agree on every screen size.
 */
export function useScrolledPast(
  anchor: RefObject<HTMLElement | null>,
  pinned: RefObject<HTMLElement | null>,
): boolean {
  const [past, setPast] = useState(false);
  useEffect(() => {
    const el = anchor.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const top = pinned.current
      ? Number.parseFloat(getComputedStyle(pinned.current).top) || 0
      : 0;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry) {
          setPast(
            !entry.isIntersecting && entry.boundingClientRect.top <= top,
          );
        }
      },
      { rootMargin: `-${top}px 0px 0px 0px` },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [anchor, pinned]);
  return past;
}
