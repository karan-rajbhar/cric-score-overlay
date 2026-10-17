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
 * - {@link useLiveScorecard} follows `live_scorecard/{matchId}` (every
 *   innings' scorecard, ~4 KB) on the tabs that render it.
 * - {@link overChangesBetween} lists the `overs` docs changed between two
 *   versions (from each snapshot's `overs_changed`), so the ball log can
 *   re-read just those.
 */

import { useCallback, useEffect, useRef, useSyncExternalStore } from "react";
import type { QueryClient, QueryKey } from "@tanstack/react-query";
import { getFirebaseDb } from "~/lib/firebase/client";
import { watchDoc, type DocWatchStatus } from "~/lib/firebase/realtime";
import {
  LIVE_SCORECARD_COLLECTION,
  liveScorecardView,
  type LiveScorecardDoc,
  type LiveScorecardView,
} from "~/lib/firebase/live-scorecard";
import type { LiveMatchState } from "~/components/overlay/types";
import type { Innings, Match } from "~/lib/match-types";

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
  /** `live_state.match_rev`: changes with settings / toss / result, not balls. */
  matchRev: string | null;
  /** `live_state.last_change`: who made the latest ball-log change, when. */
  lastChange: LiveLastChange | null;
}

/** Mirrors `LiveStateLastChange` in `~/lib/firebase/live-state` (server). */
export interface LiveLastChange {
  uid: string;
  name: string | null;
  /** ISO timestamp. */
  at: string;
}

function lastChangeOf(value: unknown): LiveLastChange | null {
  if (!value || typeof value !== "object") return null;
  const v = value as Record<string, unknown>;
  if (typeof v.uid !== "string" || typeof v.at !== "string") return null;
  return {
    uid: v.uid,
    name: typeof v.name === "string" ? v.name : null,
    at: v.at,
  };
}

const IDLE: LiveSnapshot = {
  state: null,
  version: null,
  loaded: false,
  status: "idle",
  matchRev: null,
  lastChange: null,
};

const CONNECTING: LiveSnapshot = { ...IDLE, status: "connecting" };

/** Let a StrictMode remount or quick re-render reuse the listener. */
const RELEASE_DELAY_MS = 2000;

interface Entry<S> {
  snap: S;
  listeners: Set<() => void>;
  stop: (() => void) | null;
  releaseTimer: ReturnType<typeof setTimeout> | null;
}

const entries = new Map<string, Entry<LiveSnapshot>>();

/** live_state's doc-only fields (not part of the scoreboard row). */
const DOC_ONLY_FIELDS = [
  "updated_at",
  "version",
  "refs",
  "overs_changed",
  "match_rev",
  "last_change",
] as const;

function rowOf(doc: Record<string, unknown>): LiveMatchState {
  const row = { ...doc };
  for (const k of DOC_ONLY_FIELDS) delete row[k];
  return row as unknown as LiveMatchState;
}

function keyOf(matchId: string, pause: boolean): string {
  return `${matchId}|${pause ? "pause" : "keep"}`;
}

// ---- over changes per live_state version (for the ball log) ----

const JOURNAL_SIZE = 64;
/** matchId -> version -> `overs_changed` of that version (null: unknown). */
const journals = new Map<string, Map<number, string[] | null>>();

function record(matchId: string, data: Record<string, unknown> | null): void {
  const version = data?.version;
  if (typeof version !== "number") return;
  let journal = journals.get(matchId);
  if (!journal) {
    journal = new Map();
    journals.set(matchId, journal);
  }
  const changed = data?.overs_changed;
  journal.set(
    version,
    Array.isArray(changed) && changed.every((x) => typeof x === "string")
      ? (changed as string[])
      : null,
  );
  while (journal.size > JOURNAL_SIZE) {
    journal.delete(journal.keys().next().value!);
  }
}

/**
 * The `overs` doc ids changed by versions `from + 1 .. to` of a match's
 * live_state, or null when any of those versions was not observed (paused
 * listener, coalesced snapshots) or did not say.
 */
export function overChangesBetween(
  matchId: string,
  from: number,
  to: number,
): string[] | null {
  if (to < from) return null;
  const journal = journals.get(matchId);
  const out = new Set<string>();
  for (let v = from + 1; v <= to; v += 1) {
    const changed = journal?.get(v);
    if (!changed) return null;
    for (const id of changed) out.add(id);
  }
  return [...out];
}

/** The latest live_state version any listener on this page has seen. */
export function latestLiveVersion(matchId: string): number | null {
  let best: number | null = null;
  for (const pause of [true, false]) {
    const v = entries.get(keyOf(matchId, pause))?.snap.version ?? null;
    if (v !== null && (best === null || v > best)) best = v;
  }
  return best;
}

/** A shared listener on `collection/{id}`, started on first subscribe. */
function startEntry<S>(
  map: Map<string, Entry<S>>,
  key: string,
  initial: S,
  collection: string,
  id: string,
  pause: boolean,
  onData: (data: Record<string, unknown> | null) => Partial<S>,
  statusOf: (snap: S) => LiveStatus,
): Entry<S> {
  const existing = map.get(key);
  if (existing) return existing;
  const entry: Entry<S> = {
    snap: initial,
    listeners: new Set(),
    stop: null,
    releaseTimer: null,
  };
  map.set(key, entry);
  const emit = (patch: Partial<S>) => {
    entry.snap = { ...entry.snap, ...patch };
    for (const listener of entry.listeners) listener();
  };
  const stop = watchDoc<Record<string, unknown>>(
    getFirebaseDb(),
    collection,
    id,
    {
      next: (data) => emit(onData(data)),
      status: (status) => {
        if (status !== statusOf(entry.snap))
          emit({ status } as unknown as Partial<S>);
      },
    },
    { pauseWhenHiddenMs: pause ? SPECTATOR_PAUSE_MS : null },
  );
  entry.stop = () => {
    stop();
    map.delete(key);
  };
  return entry;
}

/** Get or start the shared listener for a match. Called from subscribe only. */
function entryFor(matchId: string, pause: boolean): Entry<LiveSnapshot> {
  return startEntry(
    entries,
    keyOf(matchId, pause),
    CONNECTING,
    LIVE_STATE_COLLECTION,
    matchId,
    pause,
    (data) => {
      record(matchId, data);
      return {
        state: data ? rowOf(data) : null,
        version: typeof data?.version === "number" ? data.version : null,
        matchRev: typeof data?.match_rev === "string" ? data.match_rev : null,
        lastChange: lastChangeOf(data?.last_change),
        loaded: true,
      };
    },
    (snap) => snap.status,
  );
}

function subscribe<S>(entry: Entry<S>, listener: () => void): () => void {
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

export interface LiveScorecardSnapshot {
  /** Latest doc; `null` until loaded or when no doc exists. */
  doc: LiveScorecardDoc | null;
  loaded: boolean;
  status: LiveStatus;
}

const SCORECARD_IDLE: LiveScorecardSnapshot = {
  doc: null,
  loaded: false,
  status: "idle",
};
const SCORECARD_CONNECTING: LiveScorecardSnapshot = {
  ...SCORECARD_IDLE,
  status: "connecting",
};

const scorecards = new Map<string, Entry<LiveScorecardSnapshot>>();

/**
 * Subscribe to `live_scorecard/{matchId}` (1 read + 1 per change, ~4 KB).
 * Shared between components; paused in hidden tabs like spectator pages.
 */
export function useLiveScorecard(
  matchId: string | null | undefined,
  options: { enabled?: boolean } = {},
): LiveScorecardSnapshot {
  const id = (options.enabled ?? true) && matchId ? matchId : null;
  return useSyncExternalStore(
    useCallback(
      (listener: () => void) =>
        id
          ? subscribe(
              startEntry(
                scorecards,
                id,
                SCORECARD_CONNECTING,
                LIVE_SCORECARD_COLLECTION,
                id,
                true,
                (data) => ({
                  doc: data as unknown as LiveScorecardDoc | null,
                  loaded: true,
                }),
                (snap) => snap.status,
              ),
              listener,
            )
          : () => {},
      [id],
    ),
    () => (id ? (scorecards.get(id)?.snap ?? SCORECARD_CONNECTING) : SCORECARD_IDLE),
    () => SCORECARD_IDLE,
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

const views = new WeakMap<LiveScorecardDoc, LiveScorecardView>();

/** {@link liveScorecardView}, computed once per snapshot. */
export function liveScorecardViewOf(doc: LiveScorecardDoc): LiveScorecardView {
  let view = views.get(doc);
  if (!view) {
    view = liveScorecardView(doc);
    views.set(doc, view);
  }
  return view;
}

/**
 * Replace a fetched match's innings with the live scorecard's (same rows
 * `getMatch` returns), keeping any other fields of the fetched innings.
 */
export function applyLiveScorecard(
  match: Match,
  doc: LiveScorecardDoc | null,
): Match {
  if (!doc || doc.match_id !== match.id) return match;
  const fetched = new Map((match.innings ?? []).map((i) => [i.id, i]));
  const innings = liveScorecardViewOf(doc).innings.map(
    (inn) =>
      ({
        ...(fetched.get(inn.id as string) ?? {}),
        ...inn,
      }) as unknown as Innings,
  );
  return { ...match, innings };
}
