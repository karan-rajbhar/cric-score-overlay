/**
 * Offline-first action queue for live cricket scoring.
 * Prevents loss of scoring data during intermittent cellular/hotspot drops at match venues.
 *
 * Supports all scoring actions (recordBall, setBatsmen, setBowler, endInnings, undoLastBall)
 * and ensures strict sequential replay on reconnect to preserve cricket delivery order.
 */

import type { BallEvent } from "~/app/matches/types";

// ---------------------------------------------------------------------------
// Ball-specific types (backwards-compatible)
// ---------------------------------------------------------------------------

export interface PendingBallParams {
  matchId: string;
  bowlerId: string;
  batsmanId: string;
  nonStrikerId: string;
  event: BallEvent;
}

export interface QueuedBall extends PendingBallParams {
  queueId: string;
  enqueuedAt: number;
}

// ---------------------------------------------------------------------------
// Generic action types (supports all scoring operations)
// ---------------------------------------------------------------------------

export type QueuedActionType =
  | "recordBall"
  | "setBatsmen"
  | "setBowler"
  | "endInnings"
  | "undoLastBall";

export interface QueuedActionBase {
  queueId: string;
  matchId: string;
  type: QueuedActionType;
  enqueuedAt: number;
}

export interface QueuedRecordBall extends QueuedActionBase {
  type: "recordBall";
  payload: PendingBallParams;
}

export interface QueuedSetBatsmen extends QueuedActionBase {
  type: "setBatsmen";
  payload: { strikerId: string; nonStrikerId: string };
}

export interface QueuedSetBowler extends QueuedActionBase {
  type: "setBowler";
  payload: { bowlerId: string };
}

export interface QueuedEndInnings extends QueuedActionBase {
  type: "endInnings";
  payload: Record<string, never>;
}

export interface QueuedUndoLastBall extends QueuedActionBase {
  type: "undoLastBall";
  payload: Record<string, never>;
}

export type QueuedAction =
  | QueuedRecordBall
  | QueuedSetBatsmen
  | QueuedSetBowler
  | QueuedEndInnings
  | QueuedUndoLastBall;

// ---------------------------------------------------------------------------
// Storage helpers
// ---------------------------------------------------------------------------

const STORAGE_KEY_PREFIX = "cric_pending_balls_";
const ACTIONS_KEY_PREFIX = "cric_pending_actions_";

function getLegacyKey(matchId: string): string {
  return `${STORAGE_KEY_PREFIX}${matchId}`;
}

function getActionsKey(matchId: string): string {
  return `${ACTIONS_KEY_PREFIX}${matchId}`;
}

function safeGetItem(key: string): string | null {
  try {
    if (typeof window === "undefined" || !window.localStorage) return null;
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSetItem(key: string, value: string): void {
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      window.localStorage.setItem(key, value);
    }
  } catch (err) {
    console.warn("OfflineQueue: Failed to persist queue:", err);
  }
}

function safeRemoveItem(key: string): void {
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      window.localStorage.removeItem(key);
    }
  } catch {
    // Ignore
  }
}

function generateQueueId(): string {
  return `${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

// ---------------------------------------------------------------------------
// Unified actions queue
// ---------------------------------------------------------------------------

/**
 * Get all pending queued actions for a specific match in strict FIFO order.
 */
export function getPendingActions(matchId: string): QueuedAction[] {
  const raw = safeGetItem(getActionsKey(matchId));
  const legacyRaw = safeGetItem(getLegacyKey(matchId));

  let actions: QueuedAction[] = [];
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) actions = parsed;
    } catch {
      actions = [];
    }
  }

  // Migrate any legacy balls from cric_pending_balls_${matchId}
  if (legacyRaw) {
    try {
      const legacyBalls: QueuedBall[] = JSON.parse(legacyRaw);
      if (Array.isArray(legacyBalls) && legacyBalls.length > 0) {
        const converted: QueuedAction[] = legacyBalls.map((b) => ({
          type: "recordBall",
          queueId: b.queueId,
          matchId: b.matchId,
          enqueuedAt: b.enqueuedAt,
          payload: {
            matchId: b.matchId,
            bowlerId: b.bowlerId,
            batsmanId: b.batsmanId,
            nonStrikerId: b.nonStrikerId,
            event: b.event,
          },
        }));
        actions = [...converted, ...actions];
        safeRemoveItem(getLegacyKey(matchId));
        safeSetItem(getActionsKey(matchId), JSON.stringify(actions));
      }
    } catch {
      // Ignore migration errors
    }
  }

  return actions;
}

/**
 * Check if there are any pending offline actions.
 */
export function hasPendingActions(matchId: string): boolean {
  return getPendingActions(matchId).length > 0;
}

/**
 * Total count of all pending items.
 */
export function getPendingCount(matchId: string): number {
  return getPendingActions(matchId).length;
}

/**
 * Enqueue any scoring action for offline replay.
 */
export function enqueueAction(
  matchId: string,
  type: QueuedActionType,
  payload: QueuedAction["payload"],
): QueuedAction {
  const current = getPendingActions(matchId);
  const action = {
    queueId: generateQueueId(),
    matchId,
    type,
    payload,
    enqueuedAt: Date.now(),
  } as QueuedAction;

  current.push(action);
  safeSetItem(getActionsKey(matchId), JSON.stringify(current));
  return action;
}

/**
 * Remove a specific action by its unique queue ID.
 */
export function removeAction(matchId: string, queueId: string): void {
  const current = getPendingActions(matchId);
  const filtered = current.filter((a) => a.queueId !== queueId);
  if (filtered.length === 0) {
    clearPendingActions(matchId);
  } else {
    safeSetItem(getActionsKey(matchId), JSON.stringify(filtered));
  }
}

/**
 * Pop the last queued action (for undo support).
 */
export function popLastAction(matchId: string): QueuedAction | null {
  const current = getPendingActions(matchId);
  if (current.length === 0) return null;
  const last = current.pop()!;
  if (current.length === 0) {
    clearPendingActions(matchId);
  } else {
    safeSetItem(getActionsKey(matchId), JSON.stringify(current));
  }
  return last;
}

/**
 * Clear all pending actions for a match.
 */
export function clearPendingActions(matchId: string): void {
  safeRemoveItem(getActionsKey(matchId));
  safeRemoveItem(getLegacyKey(matchId));
}

/**
 * Clear everything for a match.
 */
export function clearAllPending(matchId: string): void {
  clearPendingActions(matchId);
}

// ---------------------------------------------------------------------------
// Ball queue (backwards-compatible wrappers that use the unified actions store)
// ---------------------------------------------------------------------------

/**
 * Get all pending queued balls for a specific match.
 */
export function getPendingBalls(matchId: string): QueuedBall[] {
  return getPendingActions(matchId)
    .filter((a): a is QueuedRecordBall => a.type === "recordBall")
    .map((a) => ({
      matchId: a.matchId,
      bowlerId: a.payload.bowlerId,
      batsmanId: a.payload.batsmanId,
      nonStrikerId: a.payload.nonStrikerId,
      event: a.payload.event,
      queueId: a.queueId,
      enqueuedAt: a.enqueuedAt,
    }));
}

/**
 * Check if there are any pending offline deliveries.
 */
export function hasPendingBalls(matchId: string): boolean {
  return getPendingBalls(matchId).length > 0;
}

/**
 * Enqueue a ball delivery when network is unreachable.
 */
export function enqueuePendingBall(params: PendingBallParams): QueuedBall {
  const action = enqueueAction(params.matchId, "recordBall", params) as QueuedRecordBall;
  return {
    ...params,
    queueId: action.queueId,
    enqueuedAt: action.enqueuedAt,
  };
}

/**
 * Remove a specific queued ball by its unique queue ID.
 */
export function removePendingBall(matchId: string, queueId: string): void {
  removeAction(matchId, queueId);
}

/**
 * Clear all pending balls for a match.
 */
export function clearPendingBalls(matchId: string): void {
  const remaining = getPendingActions(matchId).filter((a) => a.type !== "recordBall");
  if (remaining.length === 0) {
    clearPendingActions(matchId);
  } else {
    safeSetItem(getActionsKey(matchId), JSON.stringify(remaining));
  }
  safeRemoveItem(getLegacyKey(matchId));
}

/**
 * Sequentially flushes all pending offline balls to the server.
 */
export async function flushPendingBalls(
  matchId: string,
  submitFn: (ball: PendingBallParams) => Promise<{ error: string | null }>,
): Promise<{ synced: number; failed: number }> {
  return flushPendingActions(matchId, {
    recordBall: submitFn,
    setBatsmen: async () => ({ error: null }),
    setBowler: async () => ({ error: null }),
    endInnings: async () => ({ error: null }),
    undoLastBall: async () => ({ error: null }),
  });
}

// ---------------------------------------------------------------------------
// Flushing handlers
// ---------------------------------------------------------------------------

export interface ActionFlushHandlers {
  recordBall: (p: PendingBallParams) => Promise<{ error: string | null }>;
  setBatsmen: (strikerId: string, nonStrikerId: string) => Promise<{ error: string | null }>;
  setBowler: (bowlerId: string) => Promise<{ error: string | null }>;
  endInnings: () => Promise<{ error: string | null }>;
  undoLastBall: () => Promise<{ error: string | null }>;
}

/**
 * Sequentially flush all pending actions to the server.
 * Each action type is dispatched to the appropriate server action via the handlers map.
 */
export async function flushPendingActions(
  matchId: string,
  handlers: ActionFlushHandlers,
): Promise<{ synced: number; failed: number }> {
  const pending = getPendingActions(matchId);
  if (pending.length === 0) return { synced: 0, failed: 0 };

  let synced = 0;
  let failed = 0;

  for (const action of pending) {
    try {
      let res: { error: string | null };

      switch (action.type) {
        case "recordBall":
          res = await handlers.recordBall(action.payload);
          break;
        case "setBatsmen":
          res = await handlers.setBatsmen(
            action.payload.strikerId,
            action.payload.nonStrikerId,
          );
          break;
        case "setBowler":
          res = await handlers.setBowler(action.payload.bowlerId);
          break;
        case "endInnings":
          res = await handlers.endInnings();
          break;
        case "undoLastBall":
          res = await handlers.undoLastBall();
          break;
        default:
          console.warn("OfflineQueue: Unknown action type:", action);
          res = { error: null }; // Skip unknown actions
      }

      if (!res.error) {
        removeAction(matchId, action.queueId);
        synced++;
      } else {
        console.error(
          `OfflineQueue: Failed to sync ${action.type}:`,
          res.error,
        );
        failed++;
        break; // Preserve sequential order
      }
    } catch (err) {
      console.error(
        `OfflineQueue: Network error during ${action.type} flush:`,
        err,
      );
      failed++;
      break;
    }
  }

  return { synced, failed };
}
