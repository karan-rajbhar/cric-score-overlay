/**
 * Server-side validation of replay batches (`POST /api/scoring/replay`).
 * Kept apart from `protocol.ts` so the browser bundle does not load zod.
 * Versioning rules: see `protocol.ts`.
 */

import { z } from "zod";
import type { QueuedActionType } from "~/lib/offline-queue";
import {
  MAX_REPLAY_ACTIONS,
  type ReplayActionErrorCode,
  type ReplayBatchAction,
} from "./protocol";

// ---------------------------------------------------------------------------
// v1
// ---------------------------------------------------------------------------

const id = z.string().min(1).max(128);
const optText = (max: number) => z.string().max(max).nullish();

const extraType = z.enum([
  "wide",
  "no_ball",
  "bye",
  "leg_bye",
  "penalty",
  "bonus",
]);

/** Optional; a stored `null` reads as absent. */
const opt = <T extends z.ZodTypeAny>(schema: T) =>
  schema.nullish().transform((v): z.output<T> | undefined => v ?? undefined);

const runs = z.number().int().min(0).max(99);

const ballEvent = z.object({
  runsScored: opt(runs),
  extras: opt(runs),
  extraType: opt(extraType),
  isWicket: opt(z.boolean()),
  dismissalType: opt(z.string().max(64)),
  fielderId: id.nullish(),
  dismissedPlayerId: id.nullish(),
  commentary: opt(z.string().max(2000)),
  shotZone: optText(64),
});

const empty = z.object({});

/**
 * Payload schema per queued action type (the offline queue's type names,
 * `QueuedActionType`). Unknown keys are dropped, so a newer client adding
 * an optional field still validates here.
 */
export const replayPayloadSchemasV1 = {
  recordBall: z.object({
    /** Stored in queued balls; must match the batch's match when present. */
    matchId: id.optional(),
    bowlerId: id,
    batsmanId: id,
    nonStrikerId: id,
    event: ballEvent,
  }),
  undoLastBall: empty,
  endInnings: empty,
  startSuperOver: empty,
  setBatsmen: z.object({ strikerId: id, nonStrikerId: id }),
  setBowler: z.object({ bowlerId: id }),
  retireBatter: z.object({
    playerId: id,
    type: z.enum(["retired_hurt", "retired_out"]),
    reason: optText(500),
  }),
  awardPenalty: z.object({
    teamId: id,
    runs: z.number().int().min(1).max(99),
    reason: z.string().max(500),
    type: z.enum(["penalty", "bonus"]),
  }),
  reassignOverBowler: z.object({ bowlerId: id }),
  updateBall: z.object({
    ballId: id,
    runsScored: runs,
    extras: runs,
    extraType: extraType.nullish(),
    isWicket: z.boolean(),
    dismissalType: z.string().max(64).nullish(),
    batsmanId: id.nullish(),
    bowlerId: id.nullish(),
  }),
  // Exactly the queue's types: adding one to the queue fails to compile here.
} as const satisfies Record<QueuedActionType, z.ZodTypeAny>;

export type ReplayActionType = keyof typeof replayPayloadSchemasV1;

export type ReplayPayload<T extends ReplayActionType> = z.infer<
  (typeof replayPayloadSchemasV1)[T]
>;

/** A validated action, ready to dispatch. */
export type ValidReplayAction = {
  [T in ReplayActionType]: { id: string; type: T; payload: ReplayPayload<T> };
}[ReplayActionType];

export function isReplayActionType(type: string): type is ReplayActionType {
  return Object.prototype.hasOwnProperty.call(replayPayloadSchemasV1, type);
}

/**
 * The batch envelope. Actions are checked one by one afterwards
 * ({@link parseReplayAction}), so one bad action fails in its place in the
 * order instead of rejecting the whole batch.
 */
export const replayBatchSchemaV1 = z.object({
  v: z.literal(1),
  matchId: id,
  actions: z
    .array(
      z.object({
        id,
        type: z.string().min(1).max(64),
        payload: z.unknown(),
        queuedAt: z.number().optional(),
      }),
    )
    .min(1)
    .max(MAX_REPLAY_ACTIONS),
});

export type ParsedReplayAction =
  | { ok: true; action: ValidReplayAction }
  | { ok: false; code: ReplayActionErrorCode; error: string };

export function parseReplayAction(
  matchId: string,
  raw: ReplayBatchAction,
): ParsedReplayAction {
  if (!isReplayActionType(raw.type)) {
    return {
      ok: false,
      code: "unsupported_action_type",
      error: `unsupported_action_type: ${raw.type}`,
    };
  }
  const parsed = replayPayloadSchemasV1[raw.type].safeParse(raw.payload ?? {});
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const where = issue?.path.join(".") || "payload";
    return {
      ok: false,
      code: "invalid_action",
      error: `invalid_action: ${where} ${issue?.message ?? "is not valid"}`,
    };
  }
  const payload = parsed.data as { matchId?: string };
  if (payload.matchId !== undefined && payload.matchId !== matchId) {
    return {
      ok: false,
      code: "invalid_action",
      error: "invalid_action: payload matchId differs from the batch",
    };
  }
  return {
    ok: true,
    action: {
      id: raw.id,
      type: raw.type,
      payload: parsed.data,
    } as ValidReplayAction,
  };
}
