/**
 * Offline-first ball queue for live cricket scoring.
 * Prevents loss of scoring data during intermittent cellular/hotspot drops at match venues.
 */

import type { BallEvent } from "~/app/matches/types";

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

const STORAGE_KEY_PREFIX = "cric_pending_balls_";

function getStorageKey(matchId: string): string {
  return `${STORAGE_KEY_PREFIX}${matchId}`;
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
    console.warn("OfflineQueue: Failed to persist ball queue:", err);
  }
}

/**
 * Get all pending queued balls for a specific match.
 */
export function getPendingBalls(matchId: string): QueuedBall[] {
  const raw = safeGetItem(getStorageKey(matchId));
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
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
  const current = getPendingBalls(params.matchId);
  const queuedBall: QueuedBall = {
    ...params,
    queueId: `${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
    enqueuedAt: Date.now(),
  };

  current.push(queuedBall);
  safeSetItem(getStorageKey(params.matchId), JSON.stringify(current));
  return queuedBall;
}

/**
 * Remove a specific queued ball by its unique queue ID.
 */
export function removePendingBall(matchId: string, queueId: string): void {
  const current = getPendingBalls(matchId);
  const filtered = current.filter((b) => b.queueId !== queueId);
  if (filtered.length === 0) {
    clearPendingBalls(matchId);
  } else {
    safeSetItem(getStorageKey(matchId), JSON.stringify(filtered));
  }
}

/**
 * Clear all pending balls for a match.
 */
export function clearPendingBalls(matchId: string): void {
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      window.localStorage.removeItem(getStorageKey(matchId));
    }
  } catch {
    // Ignore storage clear errors
  }
}

/**
 * Sequentially flushes all pending offline balls to the server.
 */
export async function flushPendingBalls(
  matchId: string,
  submitFn: (ball: PendingBallParams) => Promise<{ error: string | null }>,
): Promise<{ synced: number; failed: number }> {
  const pending = getPendingBalls(matchId);
  if (pending.length === 0) return { synced: 0, failed: 0 };

  let synced = 0;
  let failed = 0;

  for (const item of pending) {
    try {
      const res = await submitFn({
        matchId: item.matchId,
        bowlerId: item.bowlerId,
        batsmanId: item.batsmanId,
        nonStrikerId: item.nonStrikerId,
        event: item.event,
      });

      if (!res.error) {
        removePendingBall(matchId, item.queueId);
        synced++;
      } else {
        console.error("OfflineQueue: Failed to sync ball:", res.error);
        failed++;
        break; // Stop sequential processing on error to preserve cricket delivery order
      }
    } catch (err) {
      console.error("OfflineQueue: Network error during flush:", err);
      failed++;
      break;
    }
  }

  return { synced, failed };
}
