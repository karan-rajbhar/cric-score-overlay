/**
 * Applies a replay batch's actions in order through the same server code the
 * scoring screen's server actions run (auth, scoring rights inside the
 * engine's transaction, cache invalidation, live-state refresh): those
 * functions are plain server functions here, called by name, so no build-
 * specific server action id is involved.
 */

import "server-only";
import {
  awardTeamPenalty,
  endInnings,
  reassignCurrentOverBowler,
  recordBall,
  retirePlayer,
  setCurrentBatsmen,
  setCurrentBowler,
  startSuperOver,
  undoLastBall,
  updateBall,
} from "~/app/matches/mutations";
import type { ServerClient } from "~/lib/firebase/server";
import type {
  ReplayActionResult,
  ReplayBatchAction,
} from "~/lib/scoring-replay/protocol";
import {
  parseReplayAction,
  type ValidReplayAction,
} from "~/lib/scoring-replay/schemas";

/**
 * Runs one action; its id goes to the engine as the idempotency key
 * (`p_client_action_id`), so an action it has already applied is not
 * applied again.
 */
async function run(
  matchId: string,
  action: ValidReplayAction,
): Promise<string | null> {
  const id = action.id;
  switch (action.type) {
    case "recordBall": {
      const { bowlerId, batsmanId, nonStrikerId, event } = action.payload;
      return (
        await recordBall({
          matchId,
          bowlerId,
          batsmanId,
          nonStrikerId,
          event,
          clientActionId: id,
        })
      ).error;
    }
    case "undoLastBall":
      return (await undoLastBall(matchId, id)).error;
    case "endInnings":
      return (await endInnings(matchId, id)).error;
    case "startSuperOver":
      return (await startSuperOver(matchId, id)).error;
    case "setBatsmen":
      return (
        await setCurrentBatsmen(
          matchId,
          action.payload.strikerId,
          action.payload.nonStrikerId,
          id,
        )
      ).error;
    case "setBowler":
      return (await setCurrentBowler(matchId, action.payload.bowlerId, id))
        .error;
    case "retireBatter":
      return (
        await retirePlayer(matchId, { ...action.payload, clientActionId: id })
      ).error;
    case "awardPenalty":
      return (
        await awardTeamPenalty(matchId, {
          ...action.payload,
          clientActionId: id,
        })
      ).error;
    case "reassignOverBowler":
      return (
        await reassignCurrentOverBowler(matchId, action.payload.bowlerId, id)
      ).error;
    case "updateBall":
      return (
        await updateBall({ matchId, ...action.payload, clientActionId: id })
      ).error;
  }
}

/**
 * Client action ids the match has already applied (the engine's own
 * memory, `matches.recent_client_actions`), to report a replay as
 * "duplicate". The engine still refuses a duplicate on its own; this read
 * only labels it.
 */
async function appliedActionIds(
  db: ServerClient,
  matchId: string,
): Promise<Set<string>> {
  const { data } = await db
    .from("matches")
    .select("recent_client_actions")
    .eq("id", matchId)
    .maybeSingle();
  const ids = (data as { recent_client_actions?: string[] | null } | null)
    ?.recent_client_actions;
  return new Set(Array.isArray(ids) ? ids : []);
}

/**
 * Applies `actions` in order and stops at the first failure: the actions
 * after it are not attempted (and get no result), so the client keeps them
 * queued in order behind the failed one.
 */
export async function replayActions(
  db: ServerClient,
  matchId: string,
  actions: ReplayBatchAction[],
): Promise<ReplayActionResult[]> {
  const seen = await appliedActionIds(db, matchId);
  const results: ReplayActionResult[] = [];
  for (const raw of actions) {
    const parsed = parseReplayAction(matchId, raw);
    if (!parsed.ok) {
      results.push({
        id: raw.id,
        status: "failed",
        code: parsed.code,
        error: parsed.error,
      });
      break;
    }
    if (seen.has(raw.id)) {
      results.push({ id: raw.id, status: "duplicate" });
      continue;
    }
    let error: string | null;
    try {
      error = await run(matchId, parsed.action);
    } catch (err) {
      console.error(`replay: ${raw.type} failed:`, err);
      error = err instanceof Error ? err.message : String(err);
    }
    if (error) {
      results.push({
        id: raw.id,
        status: "failed",
        code: "action_failed",
        error,
      });
      break;
    }
    seen.add(raw.id);
    results.push({ id: raw.id, status: "applied" });
  }
  return results;
}
