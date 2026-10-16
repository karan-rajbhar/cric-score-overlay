/**
 * Realtime channels over Firestore listeners (browser only).
 *
 * Two kinds of subscription are supported, matching how the scoring UI,
 * match pages and the OBS overlay already communicate:
 *
 * - `broadcast`: fire-and-forget messages between clients (score pings,
 *   producer commands). Messages are appended to
 *   `broadcasts/{topic}/messages` and expire via Firestore TTL.
 * - `postgres_changes`: change notifications for a collection, optionally
 *   filtered by `column=eq.value`, delivered from a Firestore listener.
 */

import "client-only";
import {
  addDoc,
  collection,
  doc,
  documentId,
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

export interface ChangesFilter {
  event?: "INSERT" | "UPDATE" | "DELETE" | "*";
  schema?: string;
  table: string;
  filter?: string;
}

export interface ChangePayload<T = DocumentData> {
  eventType: "INSERT" | "UPDATE" | "DELETE";
  schema: string;
  table: string;
  new: T | Record<string, never>;
  old: { id?: string };
}

type BroadcastHandler<P = unknown> = (message: {
  event: string;
  payload: P;
}) => void;
type ChangesHandler = (payload: ChangePayload) => void;

interface Registration {
  start: () => Unsubscribe;
}

function parseFilter(
  filter: string | undefined,
): { field: string; value: string } | null {
  if (!filter) return null;
  const match = /^([\w.]+)=eq\.(.+)$/.exec(filter.trim());
  if (!match) return null;
  return { field: match[1]!, value: match[2]! };
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
    type: "broadcast",
    filter: BroadcastFilter,
    handler: BroadcastHandler<P>,
  ): this;
  on(
    type: "postgres_changes",
    filter: ChangesFilter,
    handler: ChangesHandler,
  ): this;
  on<P>(
    type: "broadcast" | "postgres_changes",
    filter: BroadcastFilter | ChangesFilter,
    handler: BroadcastHandler<P> | ChangesHandler,
  ): this {
    if (type === "broadcast") {
      const { event } = filter as BroadcastFilter;
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

    const spec = filter as ChangesFilter;
    const cb = handler as ChangesHandler;
    const wanted = spec.event ?? "*";
    const parsed = parseFilter(spec.filter);
    this.registrations.push({
      start: () => {
        let initial = true;
        const base = collection(this.db, spec.table);
        const q =
          parsed && parsed.field === "id"
            ? query(base, where(documentId(), "==", parsed.value))
            : parsed
              ? query(base, where(parsed.field, "==", parsed.value))
              : query(base);
        return onSnapshot(
          q,
          (snap) => {
            if (initial) {
              initial = false;
              return;
            }
            for (const change of snap.docChanges()) {
              const eventType =
                change.type === "added"
                  ? "INSERT"
                  : change.type === "modified"
                    ? "UPDATE"
                    : "DELETE";
              if (wanted !== "*" && wanted !== eventType) continue;
              cb({
                eventType,
                schema: spec.schema ?? "public",
                table: spec.table,
                new:
                  eventType === "DELETE"
                    ? {}
                    : { ...change.doc.data(), id: change.doc.id },
                old: eventType === "DELETE" ? { id: change.doc.id } : {},
              });
            }
          },
          (err) =>
            console.error(
              `[realtime] change listener failed (${spec.table}):`,
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

/** Reference to a single document for ad-hoc listeners. */
export function docRef(db: Firestore, table: string, id: string) {
  return doc(db, table, id);
}
