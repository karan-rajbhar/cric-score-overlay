"use client";

import { useCallback, useEffect, useRef } from "react";
import {
  latestLiveVersion,
  liveChangesBetween,
  useLiveState,
  useOnLiveChange,
} from "~/lib/hooks/useLiveState";
import type { LiveChanges } from "~/lib/scoring-delta";

/**
 * A change by this user within this long of this screen's own action is
 * that action's echo (it already synced from the server's reply).
 */
export const OWN_CHANGE_WINDOW_MS = 10_000;

/**
 * Keeps the scoring screen current with changes made elsewhere: spectators
 * who opened the scoring link, and a scorer whose co-scorer (or other
 * device) records a ball. Follows the shared `live_state/{matchId}`
 * listener (1 read per change). Per change (debounced) it hands
 * `syncLive` what changed since the version the screen last caught up
 * with (the `innings` / `overs` docs named by `live_state`, see
 * `liveChangesBetween`), which reads just those; it re-reads the whole
 * scoring state (`sync`) when that fails or the versions in between were
 * not all seen. Never while this screen is busy with its own action or
 * holds queued offline actions; a change seen meanwhile is applied once it
 * is idle again.
 */
export function useLiveResync({
  matchId,
  userId,
  busy,
  sync,
  syncLive,
}: {
  matchId: string;
  userId: string | null | undefined;
  /** Scoring in flight or actions queued offline. */
  busy: boolean;
  sync: () => Promise<unknown>;
  /** Apply `changes` from the documents they name; false: re-read instead. */
  syncLive?: (changes: LiveChanges) => Promise<boolean>;
}) {
  const live = useLiveState(matchId);
  const lastChange = useRef(live.lastChange);
  const syncRef = useRef(sync);
  const syncLiveRef = useRef(syncLive);
  /** live_state version the screen has caught up with (null: unknown). */
  const synced = useRef<number | null>(null);
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
    syncLiveRef.current = syncLive;
  });

  /**
   * Catch up with the latest live_state version: from the changed docs,
   * else (or when `full`) a re-read.
   */
  const catchUp = useCallback(
    async (full: boolean) => {
      const to = latestLiveVersion(matchId);
      const from = synced.current;
      let done = false;
      if (!full && to !== null && from !== null && syncLiveRef.current) {
        if (to === from) done = true;
        else {
          const changes = liveChangesBetween(matchId, from, to);
          if (changes) {
            try {
              done = await syncLiveRef.current(changes);
            } catch {
              done = false;
            }
          }
        }
      }
      if (!done) await syncRef.current();
      synced.current = to;
    },
    [matchId],
  );

  const run = useCallback(async () => {
    if (busyRef.current || running.current) {
      dirty.current = true;
      return;
    }
    running.current = true;
    try {
      let full = false;
      do {
        dirty.current = false;
        const before = ownActions.current;
        try {
          await catchUp(full);
        } catch {
          // Keep what is shown; the next change tries again.
        }
        // An own action started while this read was in flight: its reply
        // may have been overwritten by the older read, so read it all once
        // more (its own live_state change is an echo, not a change to follow).
        full = ownActions.current !== before;
        if (full) dirty.current = true;
      } while (dirty.current && !busyRef.current);
    } finally {
      running.current = false;
    }
  }, [catchUp]);

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
