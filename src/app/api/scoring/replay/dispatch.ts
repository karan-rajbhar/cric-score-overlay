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
import { mergeScoringDeltas, type ScoringDelta } from "~/lib/scoring-delta";
import type {
  ReplayActionResult,
  ReplayBatchAction,
} from "~/lib/scoring-replay/protocol";
import {
  parseReplayAction,
  type ValidReplayAction,
} from "~/lib/scoring-replay/schemas";

/** What running one action came back with. */
interface RunOutcome {
  error: string | null;
  /** The documents it committed, when the mutation answers with them. */
  delta: ScoringDelta | null;
}

const withoutDelta = (res: { error: string | null }): RunOutcome => ({
  error: res.error,
  delta: null,
});

const withDelta = (res: {
  error: string | null;
  delta?: ScoringDelta | null;
}): RunOutcome => ({ error: res.error, delta: res.delta ?? null });

/**
 * Runs one action; its id goes to the engine as the idempotency key
 * (`p_client_action_id`), so an action it has already applied is not
 * applied again.
 */
async function run(
  matchId: string,
  action: ValidReplayAction,
): Promise<RunOutcome> {
  const id = action.id;
  switch (action.type) {
    case "recordBall": {
      const { bowlerId, batsmanId, nonStrikerId, event } = action.payload;
      return withDelta(
        await recordBall({
          matchId,
          bowlerId,
          batsmanId,
          nonStrikerId,
          event,
          clientActionId: id,
        }),
      );
    }
    case "undoLastBall":
      return withDelta(await undoLastBall(matchId, id));
    case "endInnings":
      return withoutDelta(await endInnings(matchId, id));
    case "startSuperOver":
      return withoutDelta(await startSuperOver(matchId, id));
    case "setBatsmen":
      return withDelta(
        await setCurrentBatsmen(
          matchId,
          action.payload.strikerId,
          action.payload.nonStrikerId,
          id,
        ),
      );
    case "setBowler":
      return withDelta(
        await setCurrentBowler(matchId, action.payload.bowlerId, id),
      );
    case "retireBatter":
      return withoutDelta(
        await retirePlayer(matchId, { ...action.payload, clientActionId: id }),
      );
    case "awardPenalty":
      return withoutDelta(
        await awardTeamPenalty(matchId, {
          ...action.payload,
          clientActionId: id,
        }),
      );
    case "reassignOverBowler":
      return withoutDelta(
        await reassignCurrentOverBowler(matchId, action.payload.bowlerId, id),
      );
    case "updateBall":
      return withoutDelta(
        await updateBall({ matchId, ...action.payload, clientActionId: id }),
      );
  }
}

type ActionMemory = {
  recent_client_actions?: string[] | null;
  current_innings?: number | null;
};

/**
 * Client action ids the match has already applied (the engine's own
 * memory: `recent_client_actions` on the match and on its current innings),
 * to report a replay as "duplicate". The engine still refuses a duplicate
 * on its own; these reads only label it.
 */
async function appliedActionIds(
  db: ServerClient,
  matchId: string,
): Promise<Set<string>> {
  const { data } = await db
    .from("matches")
    .select("recent_client_actions, current_innings")
    .eq("id", matchId)
    .maybeSingle();
  const match = data as ActionMemory | null;
  const { data: innings } = await db
    .from("innings")
    .select("recent_client_actions")
    .eq("match_id", matchId)
    .eq("innings_number", match?.current_innings ?? 1)
    .maybeSingle();
  const ids = [
    ...(match?.recent_client_actions ?? []),
    ...((innings as ActionMemory | null)?.recent_client_actions ?? []),
  ];
  return new Set(ids);
}

/**
 * Applies `actions` in order and stops at the first failure: the actions
 * after it are not attempted (and get no result), so the client keeps them
 * queued in order behind the failed one. `delta`: the documents the applied
 * actions committed (see `ReplayResponse.delta`).
 */
export async function replayActions(
  db: ServerClient,
  matchId: string,
  actions: ReplayBatchAction[],
): Promise<{ results: ReplayActionResult[]; delta: ScoringDelta | null }> {
  // Only an action sent before can have been applied already.
  const seen = actions.some((a) => a.resent)
    ? await appliedActionIds(db, matchId)
    : new Set<string>();
  const results: ReplayActionResult[] = [];
  const deltas: Array<ScoringDelta | null> = [];
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
    let outcome: RunOutcome;
    try {
      outcome = await run(matchId, parsed.action);
    } catch (err) {
      console.error(`replay: ${raw.type} failed:`, err);
      outcome = {
        error: err instanceof Error ? err.message : String(err),
        delta: null,
      };
    }
    if (outcome.error) {
      results.push({
        id: raw.id,
        status: "failed",
        code: "action_failed",
        error: outcome.error,
      });
      break;
    }
    seen.add(raw.id);
    deltas.push(outcome.delta);
    results.push({ id: raw.id, status: "applied" });
  }
  // A duplicate wrote nothing this time, so its documents are unknown.
  const delta = results.some((r) => r.status === "duplicate")
    ? null
    : mergeScoringDeltas(deltas);
  return { results, delta };
}
