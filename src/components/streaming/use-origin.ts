"use client";

import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

/** `window.location.origin` once in the browser ("" on the server). */
export function useOrigin(): string {
  return useSyncExternalStore(
    subscribe,
    () => window.location.origin,
    () => "",
  );
}
