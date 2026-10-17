/**
 * Realtime over Firestore listeners (browser only).
 *
 * - {@link watchDoc}: listen to one document (1 read for the first snapshot,
 *   1 per change). Live scores use `live_state/{matchId}` this way; see
 *   `~/lib/hooks/useLiveState`.
 * - {@link readDoc}: one read of one document (the ball log re-reads the
 *   `overs` docs a live change touched).
 * - {@link RealtimeChannel} `broadcast`: fire-and-forget messages between
 *   clients that are not stored anywhere else (overlay producer commands).
 *   Messages are appended to `broadcasts/{topic}/messages` and expire via
 *   Firestore TTL; each send is a document write plus a read per listener.
 *
 * There is deliberately no collection-change listener: its first snapshot
 * bills a read for every matching document (the whole ball log).
 */

import "client-only";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  onSnapshot,
  query,
  serverTimestamp,
  Timestamp,
  where,
  type DocumentData,
  type Firestore,
  type Unsubscribe,
} from "firebase/firestore";
import { BROADCAST_COLLECTION, BROADCAST_TTL_MS } from "./config";

export type ChannelStatus =
  | "SUBSCRIBED"
  | "CLOSED"
  | "CHANNEL_ERROR"
  | "TIMED_OUT";

export interface BroadcastFilter {
  event: string;
}

type BroadcastHandler<P = unknown> = (message: {
  event: string;
  payload: P;
}) => void;

interface Registration {
  start: () => Unsubscribe;
}

export class RealtimeChannel {
  private registrations: Registration[] = [];
  private unsubscribers: Unsubscribe[] = [];
  private subscribed = false;

  constructor(
    private readonly db: Firestore,
    readonly topic: string,
  ) {}

  on<P>(
    _type: "broadcast",
    filter: BroadcastFilter,
    handler: BroadcastHandler<P>,
  ): this {
    const { event } = filter;
    const cb = handler as BroadcastHandler<unknown>;
    this.registrations.push({
      start: () => {
        // Small backwards margin absorbs clock skew between client and server.
        const since = Timestamp.fromMillis(Date.now() - 2000);
        const q = query(
          collection(this.db, BROADCAST_COLLECTION, this.topic, "messages"),
          where("ts", ">", since),
        );
        return onSnapshot(
          q,
          (snap) => {
            for (const change of snap.docChanges()) {
              if (change.type !== "added") continue;
              const data = change.doc.data();
              if (data.ts === null || data.ts === undefined) continue;
              if (event !== "*" && data.event !== event) continue;
              cb({ event: String(data.event), payload: data.payload });
            }
          },
          (err) =>
            console.error(
              `[realtime] broadcast listener failed (${this.topic}):`,
              err,
            ),
        );
      },
    });
    return this;
  }

  subscribe(callback?: (status: ChannelStatus, err?: Error) => void): this {
    if (this.subscribed) {
      callback?.("SUBSCRIBED");
      return this;
    }
    this.subscribed = true;
    try {
      for (const registration of this.registrations) {
        this.unsubscribers.push(registration.start());
      }
      queueMicrotask(() => callback?.("SUBSCRIBED"));
    } catch (err) {
      callback?.(
        "CHANNEL_ERROR",
        err instanceof Error ? err : new Error(String(err)),
      );
    }
    return this;
  }

  async send(message: {
    type: "broadcast";
    event: string;
    payload?: unknown;
  }): Promise<"ok" | "error"> {
    try {
      await addDoc(
        collection(this.db, BROADCAST_COLLECTION, this.topic, "messages"),
        {
          event: message.event,
          payload: message.payload ?? null,
          ts: serverTimestamp(),
          expires_at: Timestamp.fromMillis(Date.now() + BROADCAST_TTL_MS),
        },
      );
      return "ok";
    } catch (err) {
      console.error(`[realtime] broadcast send failed (${this.topic}):`, err);
      return "error";
    }
  }

  async unsubscribe(): Promise<"ok"> {
    for (const stop of this.unsubscribers) stop();
    this.unsubscribers = [];
    this.subscribed = false;
    return "ok";
  }
}

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

export interface DocWatchOptions {
  /**
   * Detach after the tab has been hidden this long and re-attach when it
   * is visible again (the fresh first snapshot brings the UI up to date).
   * `null` keeps the listener attached (OBS sources, the control room).
   */
  pauseWhenHiddenMs?: number | null;
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
  options: DocWatchOptions = {},
): Unsubscribe {
  const pauseMs = options.pauseWhenHiddenMs ?? null;
  let stop: Unsubscribe | null = null;
  let pauseTimer: ReturnType<typeof setTimeout> | null = null;
  let retryTimer: ReturnType<typeof setTimeout> | null = null;
  let closed = false;

  const attach = () => {
    if (stop || closed) return;
    handlers.status?.("connecting");
    stop = onSnapshot(
      doc(db, table, id),
      (snap) => {
        handlers.status?.("connected");
        handlers.next(snap.exists() ? ({ ...snap.data() } as T) : null);
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
  };
  const detach = () => {
    stop?.();
    stop = null;
  };

  const onVisibility = () => {
    if (pauseTimer) {
      clearTimeout(pauseTimer);
      pauseTimer = null;
    }
    if (document.visibilityState === "hidden") {
      pauseTimer = setTimeout(() => {
        pauseTimer = null;
        if (!stop) return;
        detach();
        handlers.status?.("paused");
      }, pauseMs!);
    } else {
      attach();
    }
  };

  const watchVisibility = pauseMs !== null && typeof document !== "undefined";
  if (watchVisibility) {
    document.addEventListener("visibilitychange", onVisibility);
  }
  attach();

  return () => {
    closed = true;
    if (pauseTimer) clearTimeout(pauseTimer);
    if (retryTimer) clearTimeout(retryTimer);
    if (watchVisibility) {
      document.removeEventListener("visibilitychange", onVisibility);
    }
    detach();
  };
}
