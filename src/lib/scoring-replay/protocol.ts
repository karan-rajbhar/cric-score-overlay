/**
 * Wire format of `POST /api/scoring/replay`, shared by the offline queue
 * (client) and the route (server). Validation lives in `schemas.ts`
 * (server only, so the browser does not load zod).
 *
 * Queued offline actions are replayed through this stable route rather than
 * through server actions, whose ids change with every build: a client from
 * build A (or a score page reopened from the service-worker cache) can
 * replay its queue against build B.
 *
 * Versioning: `v` is the batch format. A server accepts every version in
 * {@link SUPPORTED_REPLAY_VERSIONS}; an unknown one gets a 400 with code
 * `unsupported_version` (the client keeps its queue). To change a payload
 * shape incompatibly, add v2 schemas next to the v1 ones, accept both
 * (upgrading v1 actions to the v2 shape before dispatch), then have the
 * client send v2. Never drop v1 while an old client may still hold a queue:
 * a device left offline can come back long after a deploy. Adding an
 * optional field, or a new action type, needs no new version (an older
 * server answers a type it does not know with `unsupported_action_type`).
 */

export const REPLAY_PATH = "/api/scoring/replay";

/** The version this client sends. */
export const REPLAY_VERSION = 1;
/** Versions this server accepts. */
export const SUPPORTED_REPLAY_VERSIONS: readonly number[] = [1];

/**
 * Most actions in one batch. A match remembers its last 20 client action
 * ids (`CLIENT_ACTION_MEMORY` in the scoring engine); a batch whose reply is
 * lost is re-sent whole, so it must fit in that memory for every action in
 * it to be recognised. The client sends {@link REPLAY_BATCH_SIZE}.
 */
export const MAX_REPLAY_ACTIONS = 20;
/** Actions per request sent by the offline queue (headroom for other scorers). */
export const REPLAY_BATCH_SIZE = 10;
/** Largest accepted request body. */
export const MAX_REPLAY_BODY_BYTES = 64 * 1024;

/** Codes of a rejected batch (non-2xx `{ error: { code, message } }`). */
export type ReplayErrorCode =
  | "bad_origin"
  | "unsupported_media_type"
  | "payload_too_large"
  | "invalid_json"
  | "invalid_batch"
  | "unsupported_version"
  | "not_authenticated"
  | "server_error";

/** Codes of a single failed action (`results[i].code`). */
export type ReplayActionErrorCode =
  | "invalid_action"
  | "unsupported_action_type"
  | "action_failed";

// ---------------------------------------------------------------------------
// Requests
// ---------------------------------------------------------------------------

/** One queued action; `id` (the queue id) is its idempotency key. */
export interface ReplayBatchAction {
  id: string;
  /** The offline queue's action type, e.g. "recordBall". */
  type: string;
  /** Absent reads as `{}` (actions without arguments). */
  payload?: unknown;
  /** When it was queued (ms since epoch); informational. */
  queuedAt?: number;
}

export interface ReplayBatch {
  v: number;
  matchId: string;
  actions: ReplayBatchAction[];
}

// ---------------------------------------------------------------------------
// Responses
// ---------------------------------------------------------------------------

export type ReplayActionStatus = "applied" | "duplicate" | "failed";

export interface ReplayActionResult {
  id: string;
  status: ReplayActionStatus;
  error?: string;
  code?: ReplayActionErrorCode;
}

/**
 * 200: one result per action, in order, up to and including the first
 * failure; the actions after it were not attempted and have no result.
 */
export interface ReplayResponse {
  v: number;
  results: ReplayActionResult[];
}

export interface ReplayErrorResponse {
  error: { code: ReplayErrorCode; message: string };
  supportedVersions?: readonly number[];
}
