"use client";

/**
 * Realtime scoreboard from the single `live_state/{matchId}` document.
 *
 * Firestore bills one read for a listener's first snapshot of a document
 * and one per change, so this is the cheapest live signal the app has:
 * every scoring mutation (and every server action that changes what viewers
 * see) rewrites the doc and bumps its `version`.
 *
 * - {@link useLiveState} returns the latest row plus its version and the
 *   listener status. Components on the same page share one listener.
 * - {@link useOnLiveChange} runs a debounced callback when the version
 *   moves, which pages use to refetch heavier data at most once per change.
 * - {@link applyLiveState} patches a fetched match with the live totals so
 *   headers stay current without refetching the scorecard.
 */

import { useCallback, useEffect, useRef, useSyncExternalStore } from "react";
import type { QueryClient, QueryKey } from "@tanstack/react-query";
import { getFirebaseDb } from "~/lib/firebase/client";
import { watchDoc, type DocWatchStatus } from "~/lib/firebase/realtime";
import type { LiveMatchState } from "~/components/overlay/types";
import type { Match } from "~/lib/match-types";

/** Mirrors `LIVE_STATE_COLLECTION` in `~/lib/firebase/live-state` (server). */
const LIVE_STATE_COLLECTION = "live_state";

/** Spectator pages drop the listener after this long in a hidden tab. */
export const SPECTATOR_PAUSE_MS = 60_000;

/** Trailing debounce for refetching heavier data after a live change. */
export const LIVE_REFETCH_DELAY_MS = 1500;

export type LiveStatus = DocWatchStatus | "idle";

export interface LiveSnapshot {
  /** Latest scoreboard row; `null` until loaded or when no doc exists. */
  state: LiveMatchState | null;
  /** `live_state.version`, `null` before the first snapshot or when missing. */
  version: number | null;
  /** Whether the first snapshot has arrived. */
  loaded: boolean;
  status: LiveStatus;
}

const IDLE: LiveSnapshot = {
  state: null,
  version: null,
  loaded: false,
  status: "idle",
};

const CONNECTING: LiveSnapshot = { ...IDLE, status: "connecting" };

/** Let a StrictMode remount or quick re-render reuse the listener. */
const RELEASE_DELAY_MS = 2000;

interface Entry {
  snap: LiveSnapshot;
  listeners: Set<() => void>;
  stop: (() => void) | null;
  releaseTimer: ReturnType<typeof setTimeout> | null;
}

const entries = new Map<string, Entry>();

function rowOf(doc: Record<string, unknown>): LiveMatchState {
  const row = { ...doc };
  delete row.updated_at;
  delete row.version;
  delete row.refs;
  return row as unknown as LiveMatchState;
}

function keyOf(matchId: string, pause: boolean): string {
  return `${matchId}|${pause ? "pause" : "keep"}`;
}

/** Get or start the shared listener for a match. Called from subscribe only. */
function entryFor(matchId: string, pause: boolean): Entry {
  const key = keyOf(matchId, pause);
  const existing = entries.get(key);
  if (existing) return existing;
  const entry: Entry = {
    snap: CONNECTING,
    listeners: new Set(),
    stop: null,
    releaseTimer: null,
  };
  entries.set(key, entry);
  const emit = (patch: Partial<LiveSnapshot>) => {
    entry.snap = { ...entry.snap, ...patch };
    for (const listener of entry.listeners) listener();
  };
  const stop = watchDoc<Record<string, unknown>>(
    getFirebaseDb(),
    LIVE_STATE_COLLECTION,
    matchId,
    {
      next: (data) =>
        emit({
          state: data ? rowOf(data) : null,
          version: typeof data?.version === "number" ? data.version : null,
          loaded: true,
        }),
      status: (status) => {
        if (status !== entry.snap.status) emit({ status });
      },
    },
    { pauseWhenHiddenMs: pause ? SPECTATOR_PAUSE_MS : null },
  );
  entry.stop = () => {
    stop();
    entries.delete(key);
  };
  return entry;
}

function subscribe(entry: Entry, listener: () => void): () => void {
  if (entry.releaseTimer) {
    clearTimeout(entry.releaseTimer);
    entry.releaseTimer = null;
  }
  entry.listeners.add(listener);
  return () => {
    entry.listeners.delete(listener);
    if (entry.listeners.size > 0) return;
    entry.releaseTimer = setTimeout(() => {
      entry.releaseTimer = null;
      if (entry.listeners.size === 0) entry.stop?.();
    }, RELEASE_DELAY_MS);
  };
}

export interface LiveStateOptions {
  /** Default true. When false no listener is attached. */
  enabled?: boolean;
  /**
   * Default true: drop the listener after the tab has been hidden for
   * {@link SPECTATOR_PAUSE_MS} and resume (with a fresh snapshot) when it is
   * shown again. Turn off for OBS sources and the control room.
   */
  pauseWhenHidden?: boolean;
}

/** Subscribe to `live_state/{matchId}` (1 read + 1 per change). */
export function useLiveState(
  matchId: string | null | undefined,
  options: LiveStateOptions = {},
): LiveSnapshot {
  const enabled = (options.enabled ?? true) && Boolean(matchId);
  const pause = options.pauseWhenHidden ?? true;
  const id = enabled ? matchId! : null;

  return useSyncExternalStore(
    useCallback(
      (listener: () => void) =>
        id ? subscribe(entryFor(id, pause), listener) : () => {},
      [id, pause],
    ),
    () => (id ? (entries.get(keyOf(id, pause))?.snap ?? CONNECTING) : IDLE),
    () => IDLE,
  );
}

/**
 * Run `onChange` (trailing-debounced) whenever the live version moves after
 * the first snapshot. Includes the catch-up after a paused tab resumes.
 */
export function useOnLiveChange(
  live: Pick<LiveSnapshot, "version" | "state">,
  onChange: (state: LiveMatchState | null) => void,
  delayMs: number = LIVE_REFETCH_DELAY_MS,
): void {
  const callback = useRef(onChange);
  const prevVersion = useRef<number | null | undefined>(undefined);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef(live.state);

  useEffect(() => {
    callback.current = onChange;
  });

  useEffect(() => {
    latest.current = live.state;
    const prev = prevVersion.current;
    prevVersion.current = live.version;
    // First snapshot (or no doc yet) is the baseline, not a change.
    if (prev === undefined || prev === null || live.version === null) return;
    if (live.version === prev) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      timer.current = null;
      callback.current(latest.current);
    }, delayMs);
  }, [live.version, live.state, delayMs]);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );
}

const pendingInvalidations = new Map<string, ReturnType<typeof setTimeout>>();

/**
 * Invalidate `queryKey` once per burst, however many mounted components ask
 * (the ball log is read by five charts on one tab). Only active queries
 * refetch, and an in-flight fetch is reused rather than cancelled.
 */
export function scheduleInvalidate(
  queryClient: QueryClient,
  queryKey: QueryKey,
  delayMs: number = 0,
): void {
  const hash = JSON.stringify(queryKey);
  if (pendingInvalidations.has(hash)) return;
  pendingInvalidations.set(
    hash,
    setTimeout(() => {
      pendingInvalidations.delete(hash);
      void queryClient.invalidateQueries({ queryKey }, { cancelRefetch: false });
    }, delayMs),
  );
}

/**
 * Patch a fetched match with the live totals for the current innings and
 * the match status, so headers and summaries move with every ball without
 * refetching the full scorecard.
 */
export function applyLiveState(
  match: Match,
  live: LiveMatchState | null,
): Match {
  if (!live || live.match_id !== match.id) return match;
  const patched: Match = {
    ...match,
    status: live.status ?? match.status,
    current_innings: live.current_innings ?? match.current_innings,
    current_over: live.current_over ?? match.current_over,
    current_ball: live.current_ball ?? match.current_ball,
    result_type: live.result_type ?? match.result_type,
    result_description: live.result_description ?? match.result_description,
  };
  if (live.innings_number == null || !match.innings) return patched;
  let changed = false;
  const innings = match.innings.map((inn) => {
    if (inn.innings_number !== live.innings_number) return inn;
    changed = true;
    return {
      ...inn,
      total_runs: live.total_runs ?? inn.total_runs,
      total_wickets: live.total_wickets ?? inn.total_wickets,
      total_balls: live.total_balls ?? inn.total_balls,
      total_overs: live.total_overs ?? inn.total_overs,
      extras_total: live.extras_total ?? inn.extras_total,
      target_runs: live.target_runs ?? inn.target_runs,
      is_completed: live.innings_completed ?? inn.is_completed,
    };
  });
  return changed ? { ...patched, innings } : patched;
}
