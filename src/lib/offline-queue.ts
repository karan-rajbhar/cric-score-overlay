/**
 * Offline-first action queue for live cricket scoring.
 * Prevents loss of scoring data during intermittent cellular/hotspot drops at match venues.
 *
 * Supports all scoring actions (recordBall, setBatsmen, setBowler, endInnings, undoLastBall,
 * startSuperOver, retireBatter, awardPenalty, reassignOverBowler, updateBall) and ensures
 * strict sequential replay on reconnect to preserve cricket delivery order.
 *
 * The queue replays through `POST /api/scoring/replay` (a stable, versioned route; see
 * `~/lib/scoring-replay/protocol.ts`), never through server actions, whose ids change with
 * every build: a queue recorded on one deploy still replays after the next.
 *
 * Every action's `queueId` doubles as its idempotency key: the server receives it as
 * `p_client_action_id` and ignores an action it has already applied. A replay after a
 * lost response (the server applied the action, the client never heard back) is therefore
 * a no-op instead of a second ball. Only one flush per match runs at a time.
 */

import type { BallEvent } from "~/app/matches/types";
import type { ScoringDelta } from "~/lib/scoring-delta";
import {
  MAX_REPLAY_ACTIONS,
  REPLAY_BATCH_SIZE,
  REPLAY_PATH,
  REPLAY_VERSION,
  type ReplayBatch,
  type ReplayErrorResponse,
  type ReplayResponse,
} from "~/lib/scoring-replay/protocol";

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
  | "startSuperOver"
  | "retireBatter"
  | "awardPenalty"
  | "reassignOverBowler"
  | "updateBall";

export interface QueuedActionBase {
  queueId: string;
  matchId: string;
  type: QueuedActionType;
  enqueuedAt: number;
  retryCount?: number;
  lastError?: string | null;
  /**
   * Queued by instant scoring while online (the screen already shows it,
   * see `~/lib/scoring-prediction`), not by offline mode.
   */
  instant?: boolean;
  /** When it was last sent (ms since epoch); set before each attempt. */
  sentAt?: number;
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

export interface RetireBatterPayload {
  playerId: string;
  type: "retired_hurt" | "retired_out";
  reason?: string | null;
}

export interface QueuedRetireBatter extends QueuedActionBase {
  type: "retireBatter";
  payload: RetireBatterPayload;
}

export interface AwardPenaltyPayload {
  teamId: string;
  runs: number;
  reason: string;
  type: "penalty" | "bonus";
}

export interface QueuedAwardPenalty extends QueuedActionBase {
  type: "awardPenalty";
  payload: AwardPenaltyPayload;
}

export interface QueuedReassignOverBowler extends QueuedActionBase {
  type: "reassignOverBowler";
  payload: { bowlerId: string };
}

/** An edit of a delivery the server already has (never an offline-queued one). */
export interface UpdateBallPayload {
  ballId: string;
  runsScored: number;
  extras: number;
  extraType: BallEvent["extraType"] | null;
  isWicket: boolean;
  dismissalType: string | null;
  batsmanId?: string | null;
  bowlerId?: string | null;
}

export interface QueuedUpdateBall extends QueuedActionBase {
  type: "updateBall";
  payload: UpdateBallPayload;
}

export type QueuedAction =
  | QueuedRecordBall
  | QueuedSetBatsmen
  | QueuedSetBowler
  | QueuedEndInnings
  | QueuedUndoLastBall
  | QueuedStartSuperOver
  | QueuedRetireBatter
  | QueuedAwardPenalty
  | QueuedReassignOverBowler
  | QueuedUpdateBall;

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

/**
 * A new action id. Generate it before calling the server directly so that, if the call
 * fails on the network, the action can be queued under the same id (the server then
 * recognises a replay of something it already applied).
 */
export function newActionId(): string {
  return generateQueueId();
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

/** Matches with actions still waiting to be sent from this device. */
export function matchesWithPendingActions(): Set<string> {
  const ids = new Set<string>();
  try {
    if (typeof window === "undefined" || !window.localStorage) return ids;
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      if (key?.startsWith(ACTIONS_KEY_PREFIX)) {
        ids.add(key.slice(ACTIONS_KEY_PREFIX.length));
      } else if (key?.startsWith(STORAGE_KEY_PREFIX)) {
        ids.add(key.slice(STORAGE_KEY_PREFIX.length));
      }
    }
  } catch {
    // Storage unavailable: nothing queued here.
  }
  return new Set([...ids].filter((id) => getPendingCount(id) > 0));
}

/**
 * Pending actions across every match on this device (used to hold back an
 * app update, or a sign-out, while anything is still waiting to sync).
 */
export function getTotalPendingCount(): number {
  let total = 0;
  for (const id of matchesWithPendingActions()) total += getPendingCount(id);
  return total;
}

/**
 * Enqueue any scoring action for offline replay.
 */
export function enqueueAction(
  matchId: string,
  type: QueuedActionType,
  payload: QueuedAction["payload"],
  queueId: string = generateQueueId(),
  options?: { instant?: boolean },
): QueuedAction {
  const current = getPendingActions(matchId);
  const action = {
    queueId,
    matchId,
    type,
    payload,
    enqueuedAt: Date.now(),
    ...(options?.instant ? { instant: true } : {}),
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
export function enqueuePendingBall(
  params: PendingBallParams,
  queueId?: string,
): QueuedBall {
  const action = enqueueAction(
    params.matchId,
    "recordBall",
    params,
    queueId,
  ) as QueuedRecordBall;
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

// ---------------------------------------------------------------------------
// Flushing: replay through POST /api/scoring/replay
// ---------------------------------------------------------------------------

export interface FlushOptions {
  maxRetries?: number;
  /** Actions per request (at most MAX_REPLAY_ACTIONS). */
  batchSize?: number;
}

export interface FlushResult {
  synced: number;
  failed: number;
  /** Ids of the actions the server applied (or had applied), in order. */
  applied?: string[];
  /**
   * The documents the last batch's applied actions committed
   * (`ReplayResponse.delta`); null or absent when not known. Only set
   * when every applied action was in that last batch.
   */
  delta?: ScoringDelta | null;
  /**
   * An instant action the server refused: it and every action queued
   * after it (predicted on top of it) moved to the Dead Letter Queue.
   */
  rejected?: { action: QueuedAction; error: string; dependents: number };
  /**
   * Set when the server refused the whole batch (`unsupported_version`,
   * `not_authenticated`, ...): nothing was applied and the queue is kept
   * as it was, to retry later.
   */
  errorCode?: string;
  errorMessage?: string;
}

/** What a replay request came back with (a network failure throws). */
export type ReplayTransportResult =
  | { ok: true; response: ReplayResponse }
  | { ok: false; status: number; code: string; message: string };

/** Sends one replay batch. The default posts it to the replay route. */
export type ReplayTransport = (
  batch: ReplayBatch,
) => Promise<ReplayTransportResult>;

/** keepalive bodies share a 64 KiB budget per page; stay well inside it. */
const KEEPALIVE_MAX_BYTES = 32 * 1024;

/**
 * How long a replay request may take before it counts as unanswered. A
 * connection that stalls without failing (a phone switching from 5G to LTE,
 * a power saver cutting the radio) would otherwise hold the request, and
 * every flush and action waiting behind it, until the page is reloaded.
 * The actions stay queued and are re-sent under the same ids, so any the
 * server did apply are not applied twice.
 */
export function replayTimeoutMs(actions: number): number {
  return 10_000 + 2_000 * actions;
}

/**
 * POSTs a batch to the replay route. `keepalive` lets a small batch finish
 * when the scorer closes or reloads the page mid-sync. Throws (like a
 * network failure) when no reply comes within {@link replayTimeoutMs}.
 */
export const postReplayBatch: ReplayTransport = async (batch) => {
  const body = JSON.stringify(batch);
  const controller = new AbortController();
  const timer = setTimeout(
    () => controller.abort(),
    replayTimeoutMs(batch.actions.length),
  );
  let res: Response;
  let json: unknown = null;
  try {
    res = await fetch(REPLAY_PATH, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      credentials: "same-origin",
      cache: "no-store",
      keepalive:
        new TextEncoder().encode(body).byteLength <= KEEPALIVE_MAX_BYTES,
      signal: controller.signal,
    });
    try {
      json = await res.json();
    } catch (err) {
      // The body stalled: no reply.
      if (controller.signal.aborted) throw err;
      // Not JSON (a proxy error page): handled below by status.
    }
  } finally {
    clearTimeout(timer);
  }
  const results = (json as Partial<ReplayResponse> | null)?.results;
  if (res.ok && Array.isArray(results)) {
    return { ok: true, response: json as ReplayResponse };
  }
  const error = (json as Partial<ReplayErrorResponse> | null)?.error;
  return {
    ok: false,
    status: res.status,
    code: error?.code ?? `http_${res.status}`,
    message: error?.message ?? (res.statusText || `HTTP ${res.status}`),
  };
};

export function toReplayBatch(
  matchId: string,
  actions: QueuedAction[],
): ReplayBatch {
  return {
    v: REPLAY_VERSION,
    matchId,
    actions: actions.map((a) => ({
      id: a.queueId,
      type: a.type,
      payload: a.payload,
      queuedAt: a.enqueuedAt,
      ...(a.sentAt ? { resent: true } : {}),
    })),
  };
}

/** Flushes in progress, by match: a second flush waits for (and shares) the first. */
const inFlight = new Map<string, Promise<FlushResult>>();

/**
 * Replays all pending actions for a match, in order, through the replay
 * route (not server actions, whose ids change with each deploy). Each
 * action's queue id is its idempotency key, so a batch re-sent after a
 * lost reply is not applied twice.
 *
 * Applied and duplicate actions leave the queue. A failed action is retried
 * on the next flush; a fatal error (see {@link isFatalSyncError}) or more
 * than `maxRetries` (default 3) failures move it to the Dead Letter Queue,
 * unblocking the actions behind it.
 */
export function flushPendingActions(
  matchId: string,
  send: ReplayTransport = postReplayBatch,
  options?: FlushOptions,
): Promise<FlushResult> {
  // Two flushes of one queue at once (the "online" event and a scorer's tap)
  // would each send every pending action.
  const running = inFlight.get(matchId);
  if (running) return running;
  const run = flushSequentially(matchId, send, options).finally(() => {
    inFlight.delete(matchId);
  });
  inFlight.set(matchId, run);
  return run;
}

/**
 * Records a failed attempt of `action`. Returns true when it was moved to
 * the Dead Letter Queue (the queue can move on), false when it stays at
 * the head to be retried.
 */
function recordFailure(
  matchId: string,
  action: QueuedAction,
  error: string,
  maxRetries: number,
  { noReply = false }: { noReply?: boolean } = {},
): boolean {
  const retries = (action.retryCount ?? 0) + 1;
  const updated: QueuedAction = {
    ...action,
    retryCount: retries,
    lastError: error,
  };
  // No reply (offline, a dropped connection): the server may not even have
  // seen it, so it is never given up on; it waits at the head, in order.
  if (noReply) {
    updateAction(matchId, updated);
    return false;
  }
  if (isFatalSyncError(error) || retries >= maxRetries) {
    console.warn(
      `OfflineQueue: Moving action ${action.type} (id: ${action.queueId}) to Dead Letter Queue:`,
      error,
    );
    moveToDeadLetter(matchId, updated, error);
    removeAction(matchId, action.queueId);
    return true;
  }
  updateAction(matchId, updated);
  return false;
}

/**
 * Records that `batch` is being sent (a later send of it is a resend);
 * returns the batch as now stored.
 */
function markSent(matchId: string, batch: QueuedAction[]): QueuedAction[] {
  const ids = new Set(batch.map((a) => a.queueId));
  const now = Date.now();
  const current = getPendingActions(matchId).map((a) =>
    ids.has(a.queueId) ? { ...a, sentAt: now } : a,
  );
  safeSetItem(getActionsKey(matchId), JSON.stringify(current));
  return batch.map((a) => ({ ...a, sentAt: now }));
}

/** Undoes {@link markSent} for a batch the server refused unread. */
function restoreSent(matchId: string, batch: QueuedAction[]): void {
  const before = new Map(batch.map((a) => [a.queueId, a.sentAt]));
  const current = getPendingActions(matchId).map((a) => {
    if (!before.has(a.queueId)) return a;
    const { sentAt: _sent, ...rest } = a;
    void _sent;
    const prev = before.get(a.queueId);
    return (prev ? { ...rest, sentAt: prev } : rest) as QueuedAction;
  });
  safeSetItem(getActionsKey(matchId), JSON.stringify(current));
}

/**
 * Moves `action` and every action queued after it to the Dead Letter
 * Queue (instant actions were predicted on top of the ones before them).
 * Returns how many came after it.
 */
function rejectWithDependents(
  matchId: string,
  action: QueuedAction,
  error: string,
): number {
  const pending = getPendingActions(matchId);
  const at = pending.findIndex((a) => a.queueId === action.queueId);
  const dropped = at >= 0 ? pending.slice(at) : [action];
  for (const a of dropped) {
    moveToDeadLetter(
      matchId,
      a.queueId === action.queueId ? { ...a, lastError: error } : a,
      a.queueId === action.queueId
        ? error
        : `Not sent: an earlier action was refused (${error})`,
    );
  }
  const kept = at >= 0 ? pending.slice(0, at) : pending;
  if (kept.length) safeSetItem(getActionsKey(matchId), JSON.stringify(kept));
  else clearPendingActions(matchId);
  return dropped.length - 1;
}

async function flushSequentially(
  matchId: string,
  send: ReplayTransport,
  options?: FlushOptions,
): Promise<FlushResult> {
  const maxRetries = options?.maxRetries ?? 3;
  const batchSize = Math.min(
    Math.max(1, options?.batchSize ?? REPLAY_BATCH_SIZE),
    MAX_REPLAY_ACTIONS,
  );
  let synced = 0;
  let failed = 0;
  const applied: string[] = [];
  let delta: ScoringDelta | null | undefined;
  let rejected: FlushResult["rejected"];
  const result = (): FlushResult => ({
    synced,
    failed,
    applied,
    delta: synced > 0 ? delta : undefined,
    rejected,
  });

  for (;;) {
    const unsent = getPendingActions(matchId).slice(0, batchSize);
    if (!unsent[0]) break;
    const request = toReplayBatch(matchId, unsent);
    const batch = markSent(matchId, unsent);
    const head = batch[0]!;

    let out: ReplayTransportResult;
    try {
      out = await send(request);
    } catch (err) {
      // No reply (offline, or the reply was lost): the server may have
      // applied some of the batch; the retry is recognised by id.
      const message = err instanceof Error ? err.message : String(err);
      console.error("OfflineQueue: Network error during replay:", err);
      failed++;
      recordFailure(matchId, head, message, maxRetries, { noReply: true });
      break;
    }

    if (!out.ok) {
      if (out.status >= 500) {
        failed++;
        if (recordFailure(matchId, head, out.message, maxRetries)) continue;
        break;
      }
      // The batch itself was refused (nothing applied): keep the queue
      // untouched, as it was before this attempt.
      restoreSent(matchId, unsent);
      console.error(
        `OfflineQueue: Replay refused (${out.status} ${out.code}):`,
        out.message,
      );
      return {
        ...result(),
        errorCode: out.code,
        errorMessage: out.message,
      };
    }

    const byId = new Map(out.response.results.map((r) => [r.id, r]));
    let progressed = false;
    let blocked = false;
    // The response's documents follow every action applied before them
    // only when this batch holds all of them.
    delta = applied.length === 0 ? (out.response.delta ?? null) : null;
    for (const action of batch) {
      const res = byId.get(action.queueId);
      // No result: not attempted (an earlier action failed).
      if (!res) break;
      if (res.status === "applied" || res.status === "duplicate") {
        removeAction(matchId, action.queueId);
        synced++;
        applied.push(action.queueId);
        progressed = true;
        continue;
      }
      const error = res.error ?? "Replay failed";
      console.error(`OfflineQueue: Failed to sync ${action.type}:`, error);
      failed++;
      if (action.instant) {
        // One more try for a transient failure, then give up on it and on
        // what was predicted on top of it: the screen re-reads.
        if (!isFatalSyncError(error) && (action.retryCount ?? 0) < 1) {
          updateAction(matchId, {
            ...action,
            retryCount: (action.retryCount ?? 0) + 1,
            lastError: error,
          });
          progressed = true;
          break;
        }
        const dependents = rejectWithDependents(matchId, action, error);
        rejected = { action, error, dependents };
        blocked = true;
        break;
      }
      // A dead-lettered action unblocks the ones behind it.
      if (recordFailure(matchId, action, error, maxRetries)) progressed = true;
      else blocked = true;
      break;
    }
    if (blocked || !progressed) break;
  }

  return result();
}
