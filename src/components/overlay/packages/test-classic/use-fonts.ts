"use client";

/**
 * The Test classic fonts' class names, loaded on first use.
 *
 * `fonts.ts` holds the next/font declarations. It is imported lazily, so
 * code that only imports the registry (tests, the server's theme checks)
 * never evaluates them: next/font calls exist only under Next's compiler.
 * Until the chunk arrives (a moment, once per page) the fallbacks in
 * {@link FONT_STACKS} draw. Where the import fails (tests) the class is
 * empty and the fallbacks stay.
 */

import { useSyncExternalStore } from "react";

let loaded: string | null = null;
let pending: Promise<void> | null = null;
const listeners = new Set<() => void>();

function load(): Promise<void> {
  pending ??= import("./fonts").then(
    (m) => {
      loaded = m.TEST_CLASSIC_FONT_CLASS;
    },
    () => {
      loaded = "";
    },
  );
  return pending;
}

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  if (loaded === null) {
    void load().then(() => listeners.forEach((l) => l()));
  }
  return () => {
    listeners.delete(onChange);
  };
}

/** The font classes ("" until loaded, and on the server). */
export function useTestClassicFonts(): string {
  return useSyncExternalStore(
    subscribe,
    () => loaded ?? "",
    () => "",
  );
}

/** font-family values: the package's faces, then close system fallbacks. */
export const FONT_STACKS = {
  serif:
    'var(--tc-font-serif, "Libre Baskerville"), Baskerville, "Baskerville Old Face", Georgia, serif',
  sans: 'var(--tc-font-sans, "Fira Sans Condensed"), "Arial Narrow", "Roboto Condensed", sans-serif',
} as const;
