import { useSyncExternalStore } from "react";

const noop = () => undefined;

/**
 * Tracks a CSS media query. Returns `false` on the server and in environments
 * without `matchMedia` (such as jsdom), so markup stays stable across hydration.
 */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      if (typeof window === "undefined" || !window.matchMedia) return noop;
      const mql = window.matchMedia(query);
      mql.addEventListener("change", onChange);
      return () => mql.removeEventListener("change", onChange);
    },
    () =>
      typeof window !== "undefined" && window.matchMedia
        ? window.matchMedia(query).matches
        : false,
    () => false,
  );
}
