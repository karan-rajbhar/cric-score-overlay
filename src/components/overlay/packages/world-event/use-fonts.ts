"use client";

/**
 * The package's font class, loaded on first use.
 *
 * Why not `BroadcastPackage.fonts.className`: a `next/font` call only works
 * after Next's compiler rewrites it, and Vitest has no such step (the call
 * throws "is not a function"). The registry imports every package, so a
 * font module imported up front would break every test that renders the
 * overlay. Imported here on first render instead, it loads in the app (a
 * small chunk with the font's CSS) and simply stays unloaded in tests;
 * until it arrives the system sans in `FONT_STACK` stands in.
 */

import { useEffect, useSyncExternalStore } from "react";

let fontClass = "";
let started = false;
const listeners = new Set<() => void>();

function load(): void {
  if (started) return;
  started = true;
  import("./fonts")
    .then((m) => {
      fontClass = m.WORLD_EVENT_FONT_CLASS;
      listeners.forEach((fn) => fn());
    })
    .catch(() => {
      // Tests (no font compiler): keep the system stack.
    });
}

function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

/** `--we-font`'s defining class ("" until loaded). */
export function useWorldEventFont(): string {
  const cls = useSyncExternalStore(
    subscribe,
    () => fontClass,
    () => "",
  );
  useEffect(load, []);
  return cls;
}

/** The family every World event element uses. */
export const FONT_STACK =
  'var(--we-font, "Figtree"), "Helvetica Neue", Arial, system-ui, sans-serif';
