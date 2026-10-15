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
  | "undoLastBall"
  | "startSuperOver";

export interface QueuedActionBase {
  queueId: string;
  matchId: string;
  type: QueuedActionType;
  enqueuedAt: number;
  retryCount?: number;
  lastError?: string | null;
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

export interface QueuedStartSuperOver extends QueuedActionBase {
  type: "startSuperOver";
  payload: Record<string, never>;
}

export type QueuedAction =
  | QueuedRecordBall
  | QueuedSetBatsmen
  | QueuedSetBowler
  | QueuedEndInnings
  | QueuedUndoLastBall
  | QueuedStartSuperOver;

// ---------------------------------------------------------------------------
// Storage helpers
// ---------------------------------------------------------------------------

const STORAGE_KEY_PREFIX = "cric_pending_balls_";
const ACTIONS_KEY_PREFIX = "cric_pending_actions_";
const DLQ_KEY_PREFIX = "cric_dead_letter_actions_";

function getDlqKey(matchId: string): string {
  return `${DLQ_KEY_PREFIX}${matchId}`;
}

export interface DeadLetterItem {
  action: QueuedAction;
  failedAt: number;
  error: string;
  retryCount: number;
}

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
 * Retrieve all dead-letter actions for a match.
 */
export function getDeadLetterActions(matchId: string): DeadLetterItem[] {
  const raw = safeGetItem(getDlqKey(matchId));
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Total count of dead-letter actions.
 */
export function getDeadLetterCount(matchId: string): number {
  return getDeadLetterActions(matchId).length;
}

/**
 * Clear all dead-letter actions for a match.
 */
export function clearDeadLetterActions(matchId: string): void {
  safeRemoveItem(getDlqKey(matchId));
}

/**
 * Move a failing action to the dead-letter queue and persist it.
 */
export function moveToDeadLetter(
  matchId: string,
  action: QueuedAction,
  error: string,
): void {
  const current = getDeadLetterActions(matchId);
  current.push({
    action,
    failedAt: Date.now(),
    error,
    retryCount: (action.retryCount ?? 0) + 1,
  });
  safeSetItem(getDlqKey(matchId), JSON.stringify(current));
}

/**
 * Manually skip and discard the current head-of-queue action,
 * moving it to the Dead Letter Queue so subsequent queued actions can flush.
 */
export function skipHeadAction(matchId: string): QueuedAction | null {
  const pending = getPendingActions(matchId);
  if (pending.length === 0) return null;
  const head = pending[0]!;
  moveToDeadLetter(matchId, head, "Manually skipped by scorer");
  removeAction(matchId, head.queueId);
  return head;
}

/**
 * Update an existing queued action in place (e.g. to increment retryCount).
 */
export function updateAction(matchId: string, updated: QueuedAction): void {
  const current = getPendingActions(matchId);
  const idx = current.findIndex((a) => a.queueId === updated.queueId);
  if (idx !== -1) {
    current[idx] = updated;
    safeSetItem(getActionsKey(matchId), JSON.stringify(current));
  }
}

/**
 * Determines whether a sync error is fatal/unrecoverable (meaning retrying the
 * exact same action will never succeed) or transient (e.g. network timeout).
 */
export function isFatalSyncError(error: string): boolean {
  const lower = error.toLowerCase();
  return (
    lower.includes("not_authorized") ||
    lower.includes("not authorized") ||
    lower.includes("permission") ||
    lower.includes("logged in") ||
    lower.includes("invalid") ||
    lower.includes("unrecoverable") ||
    lower.includes("match_not_found") ||
    lower.includes("no_innings_found") ||
    lower.includes("innings_already_completed") ||
    lower.includes("cannot_score_after_match_complete") ||
    lower.includes("striker_mismatch") ||
    lower.includes("awaiting_new_batsman") ||
    lower.includes("p0001") ||
    lower.includes("42501") ||
    lower.includes("22000")
  );
}

/**
 * Clear everything for a match (pending queue and dead letter queue).
 */
export function clearAllPending(matchId: string): void {
  clearPendingActions(matchId);
  clearDeadLetterActions(matchId);
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

export interface FlushOptions {
  maxRetries?: number;
}

/**
 * Sequentially flushes all pending offline balls to the server.
 */
export async function flushPendingBalls(
  matchId: string,
  submitFn: (ball: PendingBallParams) => Promise<{ error: string | null }>,
  options?: FlushOptions,
): Promise<{ synced: number; failed: number }> {
  return flushPendingActions(
    matchId,
    {
      recordBall: submitFn,
      setBatsmen: async () => ({ error: null }),
      setBowler: async () => ({ error: null }),
      endInnings: async () => ({ error: null }),
      undoLastBall: async () => ({ error: null }),
      startSuperOver: async () => ({ error: null }),
    },
    options,
  );
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
  startSuperOver?: () => Promise<{ error: string | null }>;
}

/**
 * Sequentially flush all pending actions to the server.
 * Each action type is dispatched to the appropriate server action via the handlers map.
 *
 * Implements a Dead Letter Queue (DLQ): If an action encounters an unrecoverable
 * fatal validation error or exceeds maxRetries (default 3), it is moved to DLQ
 * and removed from pending queue, unblocking subsequent valid deliveries.
 */
export async function flushPendingActions(
  matchId: string,
  handlers: ActionFlushHandlers,
  options?: FlushOptions,
): Promise<{ synced: number; failed: number }> {
  const maxRetries = options?.maxRetries ?? 3;
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
        case "startSuperOver":
          res = handlers.startSuperOver
            ? await handlers.startSuperOver()
            : { error: null };
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
        const retries = (action.retryCount ?? 0) + 1;
        const updated: QueuedAction = {
          ...action,
          retryCount: retries,
          lastError: res.error,
        };

        if (isFatalSyncError(res.error) || retries >= maxRetries) {
          console.warn(
            `OfflineQueue: Moving unrecoverable action ${action.type} (id: ${action.queueId}) to Dead Letter Queue:`,
            res.error,
          );
          moveToDeadLetter(matchId, updated, res.error);
          removeAction(matchId, action.queueId);
          failed++;
          continue; // Unblock subsequent actions in queue
        } else {
          updateAction(matchId, updated);
          failed++;
          break; // Preserve sequential order on transient errors
        }
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      console.error(
        `OfflineQueue: Network error during ${action.type} flush:`,
        err,
      );
      const retries = (action.retryCount ?? 0) + 1;
      const updated: QueuedAction = {
        ...action,
        retryCount: retries,
        lastError: errorMsg,
      };

      if (isFatalSyncError(errorMsg) || retries >= maxRetries) {
        console.warn(
          `OfflineQueue: Moving action ${action.type} (id: ${action.queueId}) to Dead Letter Queue after max retries/fatal error:`,
          errorMsg,
        );
        moveToDeadLetter(matchId, updated, errorMsg);
        removeAction(matchId, action.queueId);
        failed++;
        continue; // Unblock subsequent actions
      } else {
        updateAction(matchId, updated);
        failed++;
        break;
      }
    }
  }

  return { synced, failed };
}
