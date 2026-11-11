import { useSyncExternalStore } from "react";

/**
 * A new version waiting to take over: the service worker registrar sets it,
 * the app shell shows it as a thin strip at the top of the page (N12), not
 * a toast that covers the screen.
 */
export interface UpdateOffer {
  /** Swap to the new version (reloads the page), or say why not yet. */
  reload: () => void;
  /** Why the reload waits ("after your offline balls have synced"). */
  note?: string | null;
}

let offer: UpdateOffer | null = null;
const listeners = new Set<() => void>();

export function setUpdateOffer(next: UpdateOffer | null): void {
  offer = next;
  for (const l of listeners) l();
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
};

export function useUpdateOffer(): UpdateOffer | null {
  return useSyncExternalStore(
    subscribe,
    () => offer,
    () => null,
  );
}
