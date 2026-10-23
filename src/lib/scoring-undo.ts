/**
 * Instant undo on the scoring screen.
 *
 * The server's undo removes the match's last ball-log entry and restores the
 * crease and bowler that ball was recorded with: the state just before the
 * ball. The screen keeps that state for the recent balls it has seen happen
 * ({@link UndoEntry}), so an undo can show it at once while the undo is
 * saved in the background (`UndoTargets` in `~/lib/scoring-prediction`).
 *
 * An entry is only used for the ball it was made for: the match's last
 * entry must still be that ball (its `seq`), and the scorecard after it must
 * still be what it was (a fingerprint of the figures, crease and bowler
 * choices aside), so an edit, a penalty or another scorer's ball in between
 * makes the screen wait for the server instead of showing a stale state.
 */

import type { BallEvent } from "~/app/matches/types";
import type { LastBall } from "./firebase/scorecard";
import { seqCounterOf } from "./firebase/scorecard";
import type { PredictionBase } from "./scoring-prediction";

/** The ball an undo takes back, for showing it and for redo. */
export interface UndoneBall {
  seq: number;
  /** 0-based over and the ball's position in it, as the over strip shows. */
  over: number;
  ball: number;
  bowlerId: string | null;
  batsmanId: string | null;
  nonStrikerId: string | null;
  event: BallEvent;
  /** A penalty / retirement entry rather than a delivery (no redo). */
  isEvent: boolean;
}

interface StateLike {
  snapshot: {
    match: {
      id: string;
      last_ball_seq?: number | null;
      innings?: Array<{
        id: string;
        total_runs?: number | null;
        total_wickets?: number | null;
        total_balls?: number | null;
        extras_total?: number | null;
        batting_performances?: unknown[];
        bowling_performances?: unknown[];
      }>;
    };
  };
  base: PredictionBase | null;
}

export interface UndoEntry<S extends StateLike = StateLike> {
  /** The ball-log entry this undoes (unique in the match). */
  ballSeq: number;
  /** The innings that entry is in. */
  inningsId: string;
  /** {@link scorecardFingerprint} of that innings right after it. */
  afterFp: string;
  /** The screen state just before it: what the undo shows. */
  before: S;
  ball: UndoneBall | null;
}

type Row = Record<string, unknown>;
const num = (v: unknown) => (typeof v === "number" ? v : 0);

/**
 * The figures of an innings on the screen: totals and every batter / bowler
 * with something recorded. Crease and bowler choices are left out (they
 * change between balls without changing what an undo restores).
 */
export function scorecardFingerprint(
  snapshot: StateLike["snapshot"],
  inningsId: string,
): string | null {
  const inn = snapshot.match.innings?.find((i) => i.id === inningsId);
  if (!inn) return null;
  const batting = ((inn.batting_performances ?? []) as Row[])
    .filter(
      (b) =>
        num(b.balls_faced) > 0 ||
        num(b.runs_scored) > 0 ||
        Boolean(b.is_out) ||
        Boolean(b.dismissal_type),
    )
    .map((b) => [
      b.user_id,
      num(b.runs_scored),
      num(b.balls_faced),
      num(b.fours),
      num(b.sixes),
      Boolean(b.is_out),
      b.dismissal_type ?? null,
    ])
    .sort((a, b) => String(a[0]).localeCompare(String(b[0])));
  const bowling = ((inn.bowling_performances ?? []) as Row[])
    .filter(
      (b) =>
        num(b.balls_bowled) > 0 ||
        num(b.runs_conceded) > 0 ||
        num(b.wides) > 0 ||
        num(b.no_balls) > 0,
    )
    .map((b) => [
      b.user_id,
      num(b.balls_bowled),
      num(b.runs_conceded),
      num(b.wickets_taken),
      num(b.maidens),
      num(b.wides),
      num(b.no_balls),
    ])
    .sort((a, b) => String(a[0]).localeCompare(String(b[0])));
  return JSON.stringify([
    num(inn.total_runs),
    num(inn.total_wickets),
    num(inn.total_balls),
    num(inn.extras_total),
    batting,
    bowling,
  ]);
}

/** The match's ball `seq` counter as the state holds it. */
function counterOf(state: StateLike): number | null {
  if (!state.base) return null;
  return seqCounterOf(
    { last_ball_seq: state.snapshot.match.last_ball_seq ?? null },
    state.base.innings,
  );
}

/**
 * The seq of the ball-log entry an undo would take back now, and its
 * innings: the current innings' last ball, or, at the start of an innings
 * (nothing logged in it yet), the entry that closed the previous one (the
 * counter carried over). Null when that cannot be told.
 */
export function undoableSeq(
  state: StateLike,
): { seq: number; sameInnings: boolean } | null {
  const inn = state.base?.innings;
  if (!inn || inn.last_ball === undefined) return null;
  if (inn.last_ball) return { seq: inn.last_ball.seq ?? -1, sameInnings: true };
  const counter = counterOf(state);
  return counter === null ? null : { seq: counter, sameInnings: false };
}

/** A logged ball as the undo shows (and redoes) it. */
export function undoneBallOf(b: LastBall): UndoneBall {
  return {
    seq: b.seq ?? -1,
    over: b.over_number,
    ball: b.ball_number ?? 0,
    bowlerId: b.bowler_id ?? null,
    batsmanId: b.batsman_id ?? null,
    nonStrikerId: b.non_striker_id ?? null,
    isEvent: Boolean(b.penalty_team_id) || !b.bowler_id,
    event: {
      runsScored: b.runs_scored ?? 0,
      extras: b.extras ?? 0,
      ...(b.extra_type ? { extraType: b.extra_type as BallEvent["extraType"] } : {}),
      ...(b.is_wicket
        ? {
            isWicket: true,
            dismissalType: b.dismissal_type ?? undefined,
            fielderId: b.fielder_id ?? null,
            dismissedPlayerId: b.dismissed_player_id ?? null,
          }
        : {}),
      ...(b.commentary ? { commentary: b.commentary } : {}),
      ...(b.shot_zone ? { shotZone: b.shot_zone } : {}),
      // Restoring the ball keeps byes off a no-ball as byes.
      ...(b.no_ball_runs ? { noBallRuns: b.no_ball_runs } : {}),
    },
  };
}

/**
 * The undo entry for a change from `before` to `after` that added exactly
 * one ball-log entry (the counter moved by one) which is now the match's
 * last: a ball the screen predicted, or one it saw confirmed (its own on the
 * waiting path, a co-scorer's, a retirement). Null for anything else.
 */
export function entryForChange<S extends StateLike>(
  before: S,
  after: S,
): UndoEntry<S> | null {
  const from = counterOf(before);
  const to = counterOf(after);
  if (from === null || to === null || to !== from + 1) return null;
  const now = undoableSeq(after);
  if (!now || now.seq !== to) return null;
  // The entry is in the innings `before` was batting (it may have closed it).
  const inningsId = now.sameInnings
    ? after.base!.innings.id
    : before.base!.innings.id;
  if (!now.sameInnings && before.base!.innings.id === after.base!.innings.id) {
    return null;
  }
  const afterFp = scorecardFingerprint(after.snapshot, inningsId);
  if (!afterFp) return null;
  const last = now.sameInnings ? after.base!.innings.last_ball : null;
  return {
    ballSeq: to,
    inningsId,
    afterFp,
    before,
    ball: last ? undoneBallOf(last) : null,
  };
}

/** Most entries kept (and saved on the device). */
export const UNDO_HISTORY_LIMIT = 12;

/** `stack` with `entry` on top (replacing an entry for the same ball). */
export function pushEntry<S extends StateLike>(
  stack: readonly UndoEntry<S>[],
  entry: UndoEntry<S>,
): UndoEntry<S>[] {
  const kept = stack.filter((e) => e.ballSeq !== entry.ballSeq);
  return [...kept, entry]
    .sort((a, b) => a.ballSeq - b.ballSeq)
    .slice(-UNDO_HISTORY_LIMIT);
}

/**
 * The entry that undoes the match's last ball in `current`, and the stack
 * without it (and without entries for balls no longer in the log). Null
 * entry when the screen cannot vouch for the state before that ball.
 */
export function takeUndo<S extends StateLike>(
  stack: readonly UndoEntry<S>[],
  current: S,
): { entry: UndoEntry<S> | null; stack: UndoEntry<S>[] } {
  const now = undoableSeq(current);
  if (!now) return { entry: null, stack: [...stack] };
  // Balls after the last one were undone (on the server's path) or never
  // happened here: their entries can go.
  const kept = stack.filter((e) => e.ballSeq <= now.seq);
  const top = kept.at(-1);
  if (!top || top.ballSeq !== now.seq) return { entry: null, stack: kept };
  if (now.sameInnings && top.inningsId !== current.base!.innings.id) {
    return { entry: null, stack: kept };
  }
  if (!now.sameInnings && top.inningsId === current.base!.innings.id) {
    return { entry: null, stack: kept };
  }
  if (scorecardFingerprint(current.snapshot, top.inningsId) !== top.afterFp) {
    // Something changed the scorecard since (an edit): that entry's state
    // is stale, and so are those below it.
    return { entry: null, stack: [] };
  }
  return { entry: top, stack: kept.slice(0, -1) };
}
