/**
 * The pages this visit has been through inside the app, so Back can follow
 * the real history without leaving the app. `history.length` cannot tell:
 * it counts other sites too and never shrinks, and `document.referrer` does
 * not change on client-side navigation. Kept in memory: a reload forgets it
 * and Back falls back to the page's natural parent, which is always safe.
 *
 * `noteVisit` runs on every change of path (`useTrackVisits`, the app
 * shell); going back is a `popstate`, which takes the last step off.
 */

import { useEffect } from "react";

let trail: string[] = [];
let goingBack = false;
let listening = false;

const onPopState = () => {
  goingBack = true;
};

export function noteVisit(pathname: string): void {
  if (!listening && typeof window !== "undefined") {
    window.addEventListener("popstate", onPopState);
    listening = true;
  }
  if (goingBack) {
    goingBack = false;
    trail = trail.slice(0, -1);
  }
  if (trail[trail.length - 1] !== pathname) trail = [...trail, pathname];
}

/** The page before this one in this visit, or null on the first. */
export function previousPath(): string | null {
  return trail[trail.length - 2] ?? null;
}

/** Starts a fresh trail (tests). */
export function resetVisits(): void {
  trail = [];
  goingBack = false;
}

export function useTrackVisits(pathname: string | null): void {
  useEffect(() => {
    if (pathname) noteVisit(pathname);
  }, [pathname]);
}
