/**
 * Realtime over Firestore listeners (browser only).
 *
 * - {@link watchDoc}: listen to one document (1 read for the first snapshot,
 *   1 per change). Live scores use `live_state/{matchId}` this way; see
 *   `~/lib/hooks/useLiveState`. So does the broadcast overlay for what the
 *   control room puts on air (`overlay_state/{matchId}`,
 *   `~/lib/overlay-state`).
 * - {@link readDoc}: one read of one document (the ball log re-reads the
 *   `overs` docs a live change touched).
 *
 * There is deliberately no collection-change listener: its first snapshot
 * bills a read for every matching document (the whole ball log).
 */

import "client-only";
import {
  doc,
  getDoc,
  getDocFromServer,
  onSnapshot,
  type DocumentData,
  type Firestore,
  type Unsubscribe,
} from "firebase/firestore";

/** One read of a document; `null` when it does not exist. */
export async function readDoc<T = DocumentData>(
  db: Firestore,
  table: string,
  id: string,
): Promise<T | null> {
  const snap = await getDoc(doc(db, table, id));
  return snap.exists() ? ({ ...snap.data() } as T) : null;
}

/** Reference to a single document for ad-hoc listeners. */
export function docRef(db: Firestore, table: string, id: string) {
  return doc(db, table, id);
}

const WATCH_RETRY_MS = 30_000;

export type DocWatchStatus = "connecting" | "connected" | "error" | "paused";

export interface DocWatchHandlers<T> {
  /** Every snapshot, including the first; `null` when the doc is missing. */
  next: (data: T | null) => void;
  status?: (status: DocWatchStatus, err?: Error) => void;
}

export interface DocWatchOptions<T = DocumentData> {
  /**
   * Detach after the tab has been hidden this long and re-attach when it
   * is visible again (the fresh first snapshot brings the UI up to date).
   * `null` keeps the listener attached (OBS sources, the control room).
   */
  pauseWhenHiddenMs?: number | null;
  /**
   * Safety net for a listener that stops delivering without an error (a
   * connection a phone killed while the tab was frozen): after `afterMs`
   * with no snapshot while the tab is visible and `when(latest)` holds, read
   * the doc once from the server (1 read). If it differs from the last
   * snapshot the listener is stale: deliver the fresh data and re-attach.
   */
  staleCheck?: { afterMs: number; when?: (data: T | null) => boolean };
}

/**
 * Listen to one document. Billing: 1 read for the first snapshot and 1 per
 * change, so prefer this over collection listeners, whose first snapshot
 * reads every matching document.
 */
export function watchDoc<T = DocumentData>(
  db: Firestore,
  table: string,
  id: string,
  handlers: DocWatchHandlers<T>,
  options: DocWatchOptions<T> = {},
): Unsubscribe {
  const pauseMs = options.pauseWhenHiddenMs ?? null;
  const staleCheck = options.staleCheck ?? null;
  const ref = doc(db, table, id);
  let stop: Unsubscribe | null = null;
  let pauseTimer: ReturnType<typeof setTimeout> | null = null;
  let retryTimer: ReturnType<typeof setTimeout> | null = null;
  let staleTimer: ReturnType<typeof setTimeout> | null = null;
  let hiddenAt: number | null = null;
  let closed = false;
  /** Last delivered data, serialised (for the stale check). */
  let latest: T | null = null;
  let latestKey: string | null = null;

  const deliver = (data: T | null) => {
    latest = data;
    latestKey = JSON.stringify(data);
    handlers.next(data);
  };

  const isHidden = () =>
    typeof document !== "undefined" && document.visibilityState === "hidden";

  const armStaleCheck = () => {
    if (!staleCheck || closed) return;
    if (staleTimer) clearTimeout(staleTimer);
    staleTimer = setTimeout(() => {
      staleTimer = null;
      void checkStale();
    }, staleCheck.afterMs);
  };

  const checkStale = async () => {
    if (closed || !stop) return;
    if (isHidden() || (staleCheck?.when && !staleCheck.when(latest))) {
      armStaleCheck();
      return;
    }
    try {
      const snap = await getDocFromServer(ref);
      if (closed || !stop) return;
      const fresh = snap.exists() ? ({ ...snap.data() } as T) : null;
      if (JSON.stringify(fresh) !== latestKey) {
        console.warn(
          `[realtime] doc listener went stale (${table}/${id}); re-attaching`,
        );
        deliver(fresh);
        detach();
        attach();
        return;
      }
    } catch {
      // Offline or slow: the SDK reconnects on its own; check again later.
    }
    armStaleCheck();
  };

  const attach = () => {
    if (stop || closed) return;
    handlers.status?.("connecting");
    stop = onSnapshot(
      ref,
      (snap) => {
        handlers.status?.("connected");
        deliver(snap.exists() ? ({ ...snap.data() } as T) : null);
        armStaleCheck();
      },
      (err) => {
        console.error(`[realtime] doc listener failed (${table}/${id}):`, err);
        stop = null;
        handlers.status?.("error", err);
        // Listeners end on error; try again later (callers poll meanwhile).
        retryTimer ??= setTimeout(() => {
          retryTimer = null;
          attach();
        }, WATCH_RETRY_MS);
      },
    );
    armStaleCheck();
  };
  const detach = () => {
    stop?.();
    stop = null;
  };
  /** Replace the listener: its first snapshot is current (1 read). */
  const reattach = () => {
    detach();
    attach();
  };

  const onVisibility = () => {
    if (pauseTimer) {
      clearTimeout(pauseTimer);
      pauseTimer = null;
    }
    if (document.visibilityState === "hidden") {
      hiddenAt = Date.now();
      pauseTimer = setTimeout(() => {
        pauseTimer = null;
        if (!stop) return;
        detach();
        handlers.status?.("paused");
      }, pauseMs!);
    } else {
      const away = hiddenAt === null ? 0 : Date.now() - hiddenAt;
      hiddenAt = null;
      // Mobile browsers freeze timers in background tabs, so the pause may
      // never have run while the OS dropped the connection underneath a
      // listener that reports nothing. Start over after a long absence.
      if (stop && away >= pauseMs!) reattach();
      else attach();
    }
  };
  /** Restored from the back/forward cache: its connections are gone. */
  const onPageShow = (event: PageTransitionEvent) => {
    if (event.persisted && !isHidden()) reattach();
  };

  const watchVisibility = pauseMs !== null && typeof document !== "undefined";
  if (watchVisibility) {
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pageshow", onPageShow);
  }
  attach();

  return () => {
    closed = true;
    if (pauseTimer) clearTimeout(pauseTimer);
    if (retryTimer) clearTimeout(retryTimer);
    if (staleTimer) clearTimeout(staleTimer);
    if (watchVisibility) {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pageshow", onPageShow);
    }
    detach();
  };
}
