/**
 * The pages this visit has been through inside the app, so Back can follow
 * the real history without leaving the app. `history.length` alone cannot
 * tell: it counts other sites too and never shrinks, and `document.referrer`
 * does not change on client-side navigation. Kept in memory: a reload forgets
 * it and Back falls back to the page's natural parent, which is always safe.
 *
 * `noteVisit` runs on every change of path (`useTrackVisits`, the app shell).
 * Going back is a `popstate`, which takes the last step off. A `replace`
 * (a redirect, deleting the match on screen) adds no history entry, so
 * `history.length` stays put and the new page takes the old one's place: the
 * trail must match the browser's history, or Back could walk out of the app.
 * When unsure the trail comes out shorter, which only sends Back to the
 * parent, never further than it should go.
 */

import { useEffect } from "react";

let trail: string[] = [];
let goingBack = false;
let listening = false;
let lastLength = 0;

const onPopState = () => {
  goingBack = true;
};

export function noteVisit(
  pathname: string,
  historyLength: number = window.history.length,
): void {
  if (!listening && typeof window !== "undefined") {
    window.addEventListener("popstate", onPopState);
    listening = true;
  }
  if (goingBack) {
    goingBack = false;
    trail = trail.slice(0, -1);
  } else if (trail.length > 0 && historyLength <= lastLength) {
    trail = trail.slice(0, -1);
  }
  lastLength = historyLength;
  if (trail[trail.length - 1] !== pathname) trail = [...trail, pathname];
}

/**
 * Pages Back should not return to: a form already used (it would offer to
 * create the same thing again) and sign-in.
 */
const SPENT = /\/create$|^\/auth\//;

/**
 * Where Back can safely go through history, or null to use the page's
 * parent: the first page of the visit, a spent page, or `avoid`.
 */
export function backTarget(avoid?: string): string | null {
  const previous = trail[trail.length - 2] ?? null;
  if (!previous || previous === avoid || SPENT.test(previous)) return null;
  return previous;
}

/** Starts a fresh trail (tests). */
export function resetVisits(): void {
  trail = [];
  goingBack = false;
  lastLength = 0;
}

export function useTrackVisits(pathname: string | null): void {
  useEffect(() => {
    if (pathname) noteVisit(pathname);
  }, [pathname]);
}
