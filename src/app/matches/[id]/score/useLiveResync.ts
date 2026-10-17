"use client";

import { useCallback, useEffect, useRef } from "react";
import { useLiveState, useOnLiveChange } from "~/lib/hooks/useLiveState";

/**
 * A change by this user within this long of this screen's own action is
 * that action's echo (it already synced from the server's reply).
 */
export const OWN_CHANGE_WINDOW_MS = 10_000;

/**
 * Keeps the scoring screen current with changes made elsewhere: spectators
 * who opened the scoring link, and a scorer whose co-scorer (or other
 * device) records a ball. Follows the shared `live_state/{matchId}`
 * listener (1 read per change) and re-reads the scoring state once per
 * change (debounced). Never while this screen is busy with its own action
 * or holds queued offline actions; a change seen meanwhile is applied once
 * it is idle again.
 */
export function useLiveResync({
  matchId,
  userId,
  busy,
  sync,
}: {
  matchId: string;
  userId: string | null | undefined;
  /** Scoring in flight or actions queued offline. */
  busy: boolean;
  sync: () => Promise<unknown>;
}) {
  const live = useLiveState(matchId);
  const lastChange = useRef(live.lastChange);
  const syncRef = useRef(sync);
  const busyRef = useRef(busy);
  /** When this screen last ran an action of its own. */
  const lastOwnAction = useRef(0);
  /** Bumped by each own action, to spot one that overlapped a resync. */
  const ownActions = useRef(0);
  const dirty = useRef(false);
  const running = useRef(false);

  useEffect(() => {
    lastChange.current = live.lastChange;
    syncRef.current = sync;
  });

  const run = useCallback(async () => {
    if (busyRef.current || running.current) {
      dirty.current = true;
      return;
    }
    running.current = true;
    try {
      do {
        dirty.current = false;
        const before = ownActions.current;
        try {
          await syncRef.current();
        } catch {
          // Keep what is shown; the next change tries again.
        }
        // An own action started while this read was in flight: its reply
        // may have been overwritten by the older read, so read once more.
        if (ownActions.current !== before) dirty.current = true;
      } while (dirty.current && !busyRef.current);
    } finally {
      running.current = false;
    }
  }, []);

  useEffect(() => {
    busyRef.current = busy;
    if (busy) {
      lastOwnAction.current = Date.now();
      ownActions.current += 1;
    } else {
      if (lastOwnAction.current) lastOwnAction.current = Date.now();
      if (dirty.current) void run();
    }
  }, [busy, run]);

  useOnLiveChange(live, () => {
    const change = lastChange.current;
    const echo =
      !!userId &&
      change?.uid === userId &&
      Date.now() - lastOwnAction.current < OWN_CHANGE_WINDOW_MS;
    if (!echo) void run();
  });
}
