/**
 * The scoring screen's state (`getScoringState`) updated from the documents
 * a scoring mutation committed, so the screen needs no re-read after each
 * ball / crease / bowler change.
 *
 * `record_ball`, `set_current_batsmen` and `set_current_bowler` can answer
 * with a {@link ScoringDelta}: the match document and every innings / over
 * document the transaction wrote, as stored after the commit. Applied to
 * the previous snapshot, it gives exactly what `getScoringState` would now
 * return (`match-cost.profile.test.ts` checks this after every action of a
 * whole match). When it cannot (a new innings, a player whose name is not
 * known yet, an over it did not see), {@link applyScoringDelta} returns
 * null and the screen re-reads as before.
 */

import {
  ballRowsOf,
  battingRowsOf,
  bowlingRowsOf,
  bySeq,
  withoutScorecardStorage,
  type OversRow,
} from "./firebase/scorecard";
import type { InningsRow, MatchesRow } from "./firebase/types";

export interface ScoringDelta {
  match: MatchesRow & { id: string };
  innings: Array<InningsRow & { id: string }>;
  overs: OversRow[];
}

type UserRef = { id: string; full_name: string | null } | null;

interface PerformanceRow {
  user_id: string;
  is_current_batsman?: boolean | null;
  is_striker?: boolean | null;
  is_current_bowler?: boolean | null;
  user?: UserRef;
}

interface SnapshotInnings {
  id: string;
  innings_number: number;
  total_balls?: number | null;
  batting_performances?: PerformanceRow[];
  bowling_performances?: PerformanceRow[];
}

interface SnapshotMatch {
  id: string;
  current_innings?: number | null;
  balls_per_over?: number | null;
  team1_snapshot?: unknown;
  team2_snapshot?: unknown;
  team1?: unknown;
  team2?: unknown;
  innings?: SnapshotInnings[];
}

/** What `getScoringState` returns (`data`). */
export interface ScoringSnapshot<M = SnapshotMatch, D = unknown> {
  match: M;
  strikerId: string | null;
  nonStrikerId: string | null;
  bowlerId: string | null;
  lastOverBowlerId: string | null;
  thisOverDeliveries: D[];
}

/** The ball fields `getScoringState` selects for the current over. */
export const OVER_DELIVERY_FIELDS = [
  "id",
  "over_number",
  "ball_number",
  "runs_scored",
  "extras",
  "extra_type",
  "is_wicket",
  "dismissal_type",
  "bowler_id",
  "batsman_id",
  "dismissed_player_id",
] as const;

/** The current innings' crease and the over shown, as `getScoringState` derives them. */
export function scoringPosition(match: SnapshotMatch) {
  const current =
    match.innings?.find((i) => i.innings_number === match.current_innings) ??
    null;
  const striker =
    current?.batting_performances?.find(
      (p) => p.is_striker && p.is_current_batsman,
    ) ?? null;
  const nonStriker =
    current?.batting_performances?.find(
      (p) => !p.is_striker && p.is_current_batsman,
    ) ?? null;
  const bowler =
    current?.bowling_performances?.find((p) => p.is_current_bowler) ?? null;
  if (!current) {
    return { current, striker, nonStriker, bowler, displayOver: null, lastOver: null };
  }
  const bpo = match.balls_per_over || 6;
  const totalBalls = current.total_balls ?? 0;
  const ongoingOver = Math.floor(totalBalls / bpo);
  const isOverBoundary = totalBalls > 0 && totalBalls % bpo === 0;
  // Before the next over's bowler is chosen, the completed over is shown.
  const displayOver =
    isOverBoundary && !bowler ? ongoingOver - 1 : ongoingOver;
  const lastOver =
    ongoingOver > 0 || isOverBoundary
      ? ongoingOver > 0
        ? ongoingOver - 1
        : 0
      : null;
  return {
    current,
    striker,
    nonStriker,
    bowler,
    displayOver,
    lastOver,
    totalBalls,
    ongoingOver,
    isOverBoundary,
  };
}

function pick(row: object, fields: readonly string[]) {
  const out: Record<string, unknown> = {};
  for (const f of fields) out[f] = (row as Record<string, unknown>)[f] ?? null;
  return out;
}

class UnknownName extends Error {}

/**
 * Over of the innings document's cached last ball: -1 when it has none,
 * Infinity when the document (or its cache) is not at hand.
 */
function lastBallOver(doc: InningsRow | undefined): number {
  if (!doc || doc.last_ball === undefined) return Infinity;
  return doc.last_ball?.over_number ?? -1;
}

/**
 * `prev` updated with `delta`, or null when the delta is not enough (the
 * caller then re-reads). `names` adds player names the previous snapshot
 * does not show yet (e.g. the squads), as `{ id, full_name }`.
 */
export function applyScoringDelta<M extends SnapshotMatch, D>(
  prev: ScoringSnapshot<M, D>,
  delta: ScoringDelta | null | undefined,
  names?: ReadonlyMap<string, UserRef>,
): ScoringSnapshot<M, D> | null {
  if (!delta || delta.match.id !== prev.match.id) return null;
  const prevInnings = prev.match.innings ?? [];
  const written = new Map(delta.innings.map((i) => [i.id, i]));
  // A new innings: its place in the list is the server's to decide.
  for (const id of written.keys()) {
    if (!prevInnings.some((i) => i.id === id)) return null;
  }

  const known = new Map<string, UserRef>(names ?? []);
  for (const inn of prevInnings) {
    for (const row of [
      ...(inn.batting_performances ?? []),
      ...(inn.bowling_performances ?? []),
    ]) {
      if (row.user !== undefined) known.set(row.user_id, row.user ?? null);
    }
  }
  const withUser = <R extends { user_id: string }>(rows: R[]) =>
    rows.map((r) => {
      if (!known.has(r.user_id)) throw new UnknownName();
      return { ...r, user: known.get(r.user_id) ?? null };
    });

  let innings: SnapshotInnings[];
  try {
    innings = prevInnings.map((inn) => {
      const doc = written.get(inn.id);
      if (!doc) return inn;
      return {
        ...withoutScorecardStorage(doc),
        batting_performances: withUser(battingRowsOf(doc)),
        bowling_performances: withUser(bowlingRowsOf(doc)),
      } as unknown as SnapshotInnings;
    });
  } catch (err) {
    if (err instanceof UnknownName) return null;
    throw err;
  }

  const m = delta.match as unknown as SnapshotMatch;
  const match = {
    ...delta.match,
    innings,
    team1: m.team1_snapshot ?? prev.match.team1 ?? null,
    team2: m.team2_snapshot ?? prev.match.team2 ?? null,
  } as unknown as M;

  const pos = scoringPosition(match);
  const before = scoringPosition(prev.match);
  const sameInnings =
    !!pos.current && before.current?.id === pos.current.id;
  const overDoc = (n: number | null) =>
    n === null || !pos.current
      ? undefined
      : delta.overs.find(
          (o) => o.innings_id === pos.current!.id && o.over_number === n,
        );

  let thisOverDeliveries: D[] = [];
  let lastOverBowlerId: string | null = null;
  if (pos.current) {
    const shown = overDoc(pos.displayOver);
    if (shown) {
      thisOverDeliveries = ballRowsOf(shown)
        .sort(bySeq)
        .map((b) => pick(b, OVER_DELIVERY_FIELDS)) as D[];
    } else if (sameInnings && before.displayOver === pos.displayOver) {
      thisOverDeliveries = prev.thisOverDeliveries;
    } else if (
      pos.displayOver !== null &&
      lastBallOver(written.get(pos.current.id)) < pos.displayOver
    ) {
      // Nothing recorded in that over yet (the innings' last ball, which
      // it caches, is in an earlier over).
      thisOverDeliveries = [];
    } else {
      return null;
    }

    if (pos.lastOver !== null) {
      const last = overDoc(pos.lastOver);
      if (last) {
        const balls = ballRowsOf(last).sort(bySeq);
        lastOverBowlerId = balls.at(-1)?.bowler_id ?? null;
      } else if (sameInnings && before.lastOver === pos.lastOver) {
        lastOverBowlerId = prev.lastOverBowlerId;
      } else {
        return null;
      }
    }
  }

  return {
    match,
    strikerId: pos.striker?.user_id ?? null,
    nonStrikerId: pos.nonStriker?.user_id ?? null,
    bowlerId: pos.bowler?.user_id ?? null,
    lastOverBowlerId,
    thisOverDeliveries,
  };
}
