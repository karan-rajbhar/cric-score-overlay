/**
 * Instant scoring: the scoring screen shows a delivery, a crease change or
 * a bowler change the moment it is made, before the server has it.
 *
 * Each action goes into the offline queue first (`~/lib/offline-queue`,
 * which saves it in order, survives a reload and replays it with its id as
 * the idempotency key). What the screen shows is the server's last
 * confirmed state with the queued actions applied on top of it
 * ({@link foldPending}), computed by the scoring engine's own pure
 * functions (`~/lib/firebase/scoring/ball-docs`) on the documents the
 * screen holds ({@link PredictionBase}): the current innings and its over
 * documents as stored. The prediction is therefore the server's own
 * computation. When the server's reply arrives (the documents it
 * committed), the confirmed state moves on and the remaining queue is
 * folded again; the server always wins.
 *
 * An action the engine would not apply incrementally (an innings without
 * a scorecard, `max_balls_per_over` rules, a crease the documents do not
 * agree with, an over document the screen has not seen) is not predicted:
 * {@link foldPending} stops there and the screen waits for the server, as
 * it did before. So does every other action type (undo, edits, end of
 * innings, retirements, penalties), and so does a delivery that ends the
 * innings: what follows it (the next innings, the result) is the server's
 * to decide.
 */

import {
  ballDocsAfter,
  battingWithCrease,
  bowlingWithBowler,
  checkBallArgs,
  inningsComplete,
  type RecordBallArgs,
} from "./firebase/scoring/ball-docs";
import {
  ballRowsOf,
  ballsPerOverOf,
  overDocId,
  type OversRow,
} from "./firebase/scorecard";
import type { InningsRow, MatchesRow } from "./firebase/types";
import type {
  PendingBallParams,
  QueuedAction,
} from "./offline-queue";
import {
  applyLiveResync,
  scoringPosition,
  type ScoringDelta,
  type ScoringSnapshot,
} from "./scoring-delta";

type UserRef = { id: string; full_name: string | null } | null;
type Names = ReadonlyMap<string, UserRef>;

/** The documents a prediction starts from, as stored on the server. */
export interface PredictionBase {
  /** The current innings document (scorecard arrays included). */
  innings: InningsRow & { id: string };
  /** Over documents of that innings that are at hand. */
  overs: OversRow[];
}

/** A confirmed (or predicted) screen state and the documents behind it. */
export interface ScreenState<M, D> {
  snapshot: ScoringSnapshot<M, D>;
  base: PredictionBase | null;
}

/** Ball ids of predicted deliveries carry this before their random part. */
export const PENDING_BALL_MARK = "~pending-";

/** Whether a ball id is a predicted delivery's (not on the server yet). */
export function isPendingBallId(id: string | null | undefined): boolean {
  return typeof id === "string" && id.includes(PENDING_BALL_MARK);
}

type SnapshotMatch = Parameters<typeof scoringPosition>[0];

function currentInningsId(match: SnapshotMatch): string | null {
  return scoringPosition(match).current?.id ?? null;
}

/**
 * The base after the server committed `innings` / `overs` (a reply's
 * delta, or documents read for a co-scorer's change), for the state
 * `snapshot` now shows. Null when the current innings document is not at
 * hand (a new innings: the next full read brings it).
 */
export function baseWithDocs(
  base: PredictionBase | null,
  snapshot: ScoringSnapshot<SnapshotMatch, unknown>,
  innings: ReadonlyArray<InningsRow & { id: string }>,
  overs: ReadonlyArray<OversRow>,
): PredictionBase | null {
  const currentId = currentInningsId(snapshot.match);
  if (!currentId) return null;
  const doc =
    innings.find((i) => i.id === currentId) ??
    (base?.innings.id === currentId ? base.innings : null);
  if (!doc) return null;
  const kept = (base?.innings.id === currentId ? base.overs : []).filter(
    (o) => !overs.some((w) => w.id === o.id),
  );
  return {
    innings: doc,
    overs: [...kept, ...overs.filter((o) => o.innings_id === currentId)],
  };
}

/** {@link baseWithDocs} for a reply's delta. */
export function baseWithDelta(
  base: PredictionBase | null,
  snapshot: ScoringSnapshot<SnapshotMatch, unknown>,
  delta: ScoringDelta,
): PredictionBase | null {
  return baseWithDocs(base, snapshot, delta.innings, delta.overs);
}

/**
 * The stored over document `overNumber` of the base's innings: the
 * document, null when the over has no ball yet, undefined when unknown.
 */
function overDocOf(
  base: PredictionBase,
  overNumber: number,
): OversRow | null | undefined {
  const doc = base.overs.find(
    (o) => o.innings_id === base.innings.id && o.over_number === overNumber,
  );
  if (doc) return doc;
  // The innings caches its last ball: an over after it has none yet.
  const last = base.innings.last_ball;
  if (last === undefined) return undefined;
  return (last?.over_number ?? -1) < overNumber ? null : undefined;
}

export type Prediction<M, D> =
  | {
      ok: true;
      state: ScreenState<M, D> & { base: PredictionBase };
      /** The delivery ends the innings (or the match). */
      endsInnings: boolean;
    }
  | { ok: false; reason: string };

function fail<M, D>(reason: string): Prediction<M, D> {
  return { ok: false, reason };
}

/** The record_ball arguments of a queued delivery (as `recordBall` sends them). */
export function recordBallArgsOf(
  matchId: string,
  p: PendingBallParams,
): RecordBallArgs {
  return {
    p_match_id: matchId,
    p_bowler_id: p.bowlerId,
    p_batsman_id: p.batsmanId,
    p_non_striker_id: p.nonStrikerId,
    p_runs_scored: p.event.runsScored ?? 0,
    p_extras: p.event.extras ?? 0,
    p_extra_type: p.event.extraType ?? null,
    p_is_wicket: p.event.isWicket ?? false,
    p_dismissal_type: p.event.dismissalType ?? null,
    p_fielder_id: p.event.fielderId ?? null,
    p_commentary: p.event.commentary ?? null,
    p_dismissed_player_id: p.event.dismissedPlayerId ?? null,
    p_shot_zone: p.event.shotZone ?? null,
  };
}

/** The base's innings, when it is the snapshot's current one. */
function currentBase<M extends SnapshotMatch, D>(
  state: ScreenState<M, D>,
): PredictionBase | null {
  const base = state.base;
  if (!base) return null;
  return currentInningsId(state.snapshot.match) === base.innings.id
    ? base
    : null;
}

function withInnings<M extends SnapshotMatch, D>(
  state: ScreenState<M, D>,
  base: PredictionBase,
  innings: InningsRow & { id: string },
  over: OversRow | null,
  names: Names,
): ScreenState<M, D> & { base: PredictionBase } {
  const snapshot = applyLiveResync(
    state.snapshot,
    [innings],
    over ? [[over.id, over] as const] : [],
    names,
  );
  if (!snapshot) throw new Unpredictable("snapshot");
  return {
    snapshot,
    base: {
      innings,
      overs: over
        ? [...base.overs.filter((o) => o.id !== over.id), over]
        : base.overs,
    },
  };
}

class Unpredictable extends Error {}

/** A delivery applied to `state` (see the module comment). */
export function predictBall<M extends SnapshotMatch, D>(
  state: ScreenState<M, D>,
  action: { queueId: string; payload: PendingBallParams },
  names: Names,
  now: string,
): Prediction<M, D> {
  const base = currentBase(state);
  if (!base) return fail("no_base");
  const match = state.snapshot.match as unknown as MatchesRow & {
    id: string;
    status?: string | null;
  };
  if (match.status !== "live") return fail("match_not_live");
  const args = recordBallArgsOf(match.id, action.payload);
  const checked = checkBallArgs(args);
  if (!checked.ok) return fail(checked.code);
  const innings = base.innings;
  const overNumber = Math.floor(
    (innings.total_balls ?? 0) / ballsPerOverOf(match),
  );
  const overDoc = overDocOf(base, overNumber);
  if (overDoc === undefined) return fail("over_unknown");
  const docs = ballDocsAfter({
    match,
    innings,
    overDoc,
    args,
    checked: checked.checked,
    ballRandom: `pending-${action.queueId}`,
    now,
  });
  if (!docs) return fail("not_incremental");
  const inningsAfter = { ...innings, ...docs.inningsPatch };
  const overAfter: OversRow = {
    ...docs.overDoc,
    id: overDocId(innings.id, overNumber),
  };
  try {
    return {
      ok: true,
      state: withInnings(state, base, inningsAfter, overAfter, names),
      endsInnings: inningsComplete(match, inningsAfter),
    };
  } catch (err) {
    if (err instanceof Unpredictable) return fail(err.message);
    throw err;
  }
}

/** A crease change (`set_current_batsmen`) applied to `state`. */
export function predictBatsmen<M extends SnapshotMatch, D>(
  state: ScreenState<M, D>,
  payload: { strikerId: string; nonStrikerId: string },
  names: Names,
): Prediction<M, D> {
  const base = currentBase(state);
  if (!base) return fail("no_base");
  const { strikerId, nonStrikerId } = payload;
  if (strikerId === nonStrikerId) return fail("invalid_input");
  const batting = base.innings.batting;
  if (!Array.isArray(batting)) return fail("no_scorecard");
  // The engine's checks that need no read (the roster is checked by the
  // screen against its squads, and by the server).
  if (
    batting.some(
      (b) =>
        b.is_out && (b.user_id === strikerId || b.user_id === nonStrikerId),
    )
  ) {
    return fail("player_already_out");
  }
  const distinct = new Set(batting.map((b) => b.user_id));
  const anyExisting = batting.some(
    (b) => b.user_id === strikerId || b.user_id === nonStrikerId,
  );
  if (distinct.size >= 11 && !anyExisting) return fail("too_many_batsmen");
  const next = battingWithCrease(batting, strikerId, nonStrikerId);
  if (!next) return { ok: true, state: { ...state, base }, endsInnings: false };
  try {
    return {
      ok: true,
      state: withInnings(
        state,
        base,
        { ...base.innings, batting: next },
        null,
        names,
      ),
      endsInnings: false,
    };
  } catch (err) {
    if (err instanceof Unpredictable) return fail(err.message);
    throw err;
  }
}

/** A bowler change (`set_current_bowler`) applied to `state`. */
export function predictBowler<M extends SnapshotMatch, D>(
  state: ScreenState<M, D>,
  payload: { bowlerId: string },
  names: Names,
): Prediction<M, D> {
  const base = currentBase(state);
  if (!base) return fail("no_base");
  const { bowlerId } = payload;
  const innings = base.innings;
  if (!Array.isArray(innings.bowling)) return fail("no_scorecard");
  if (
    (innings.batting ?? []).some(
      (b) => b.is_current_batsman === true && b.user_id === bowlerId,
    )
  ) {
    return fail("bowler_is_current_batsman");
  }
  // The engine refuses a bowler who bowled in the previous over; that over
  // must be at hand to tell.
  const match = state.snapshot.match as unknown as MatchesRow;
  const currentOver = Math.floor(
    (innings.total_balls ?? 0) / ballsPerOverOf(match),
  );
  if (currentOver > 0) {
    const previous = overDocOf(base, currentOver - 1);
    if (previous === undefined) return fail("over_unknown");
    if (previous && ballRowsOf(previous).some((b) => b.bowler_id === bowlerId))
      return fail("same_bowler_next_over");
  }
  const next = bowlingWithBowler(innings.bowling, bowlerId);
  if (!next) return { ok: true, state: { ...state, base }, endsInnings: false };
  try {
    return {
      ok: true,
      state: withInnings(state, base, { ...innings, bowling: next }, null, names),
      endsInnings: false,
    };
  } catch (err) {
    if (err instanceof Unpredictable) return fail(err.message);
    throw err;
  }
}

/** One queued action applied to `state`, when it can be predicted. */
export function predictAction<M extends SnapshotMatch, D>(
  state: ScreenState<M, D>,
  action: QueuedAction,
  names: Names,
  now: string,
): Prediction<M, D> {
  switch (action.type) {
    case "recordBall":
      return predictBall(state, action, names, now);
    case "setBatsmen":
      return predictBatsmen(state, action.payload, names);
    case "setBowler":
      return predictBowler(state, action.payload, names);
    default:
      return fail(`unpredicted_${action.type}`);
  }
}

export interface Folded<M, D> {
  /** The confirmed state with every predicted action applied. */
  state: ScreenState<M, D>;
  /** How many of the actions it applied (from the first). */
  applied: number;
  /**
   * The actions after the applied ones cannot be shown before the server
   * has them (see the module comment): the screen waits for it.
   */
  waiting: boolean;
  /** The last applied delivery ends the innings. */
  endsInnings: boolean;
  /** Why the action at `applied` could not be predicted. */
  reason: string | null;
}

/**
 * `confirmed` with the queued `actions` applied in order, up to the first
 * that cannot be predicted (or a delivery that ends the innings).
 */
export function foldPending<M extends SnapshotMatch, D>(
  confirmed: ScreenState<M, D>,
  actions: readonly QueuedAction[],
  names: Names,
  now: string = new Date().toISOString(),
): Folded<M, D> {
  let state = confirmed;
  for (let i = 0; i < actions.length; i += 1) {
    const p = predictAction(state, actions[i]!, names, now);
    if (!p.ok) {
      return {
        state,
        applied: i,
        waiting: true,
        endsInnings: false,
        reason: p.reason,
      };
    }
    state = p.state;
    if (p.endsInnings) {
      return {
        state,
        applied: i + 1,
        waiting: true,
        endsInnings: true,
        reason: i + 1 < actions.length ? "after_innings_end" : null,
      };
    }
  }
  return {
    state,
    applied: actions.length,
    waiting: false,
    endsInnings: false,
    reason: null,
  };
}
