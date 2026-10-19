/**
 * What a delivery, a crease change or a bowler change does to the current
 * innings document and its over document, as pure functions.
 *
 * The scoring engine (`rpc/scoring.ts`) runs them inside its transactions;
 * the scoring screen runs the same functions on the documents it holds to
 * show the change before the server has confirmed it
 * (`~/lib/scoring-prediction`). One implementation, so what the screen
 * shows first is the server's own computation, not a second engine that
 * could drift from it.
 *
 * No reads, no writes, no server-only imports: everything here is safe to
 * load in the browser.
 */

import {
  ballRowsOf,
  ballsPerOverOf,
  battingRowsOf,
  bowlingRowsOf,
  bySeq,
  lastOverBowlerOf,
  newBallId,
  partnershipRowsOf,
  seqCounterOf,
  toBallEntry,
  toBattingEntry,
  toBowlingEntry,
  toFallOfWicketEntry,
  toPartnershipEntry,
  type BattingEntry,
  type BowlingEntry,
  type OversRow,
} from "../scorecard";
import type { BallByBallRow, InningsRow, MatchesRow } from "../types";
import {
  applyBallIncrementally,
  startsNewPartnership,
  type IncrementalOutput,
} from "./incremental";
import { inningsLimits } from "./result";

type WithId<T> = T & { id: string };

export const EXTRA_TYPES = new Set([
  "wide",
  "no_ball",
  "bye",
  "leg_bye",
  "penalty",
  "bonus",
]);

export const DISMISSAL_TYPES = new Set([
  "bowled",
  "caught",
  "lbw",
  "stumped",
  "run_out",
  "hit_wicket",
  "obstructing",
  "timed_out",
  "handled_ball",
  "retired_hurt",
  "retired_out",
]);

export interface RecordBallArgs {
  p_match_id: string;
  p_bowler_id: string;
  p_batsman_id: string;
  p_non_striker_id: string;
  p_runs_scored?: number | null;
  p_extras?: number | null;
  p_extra_type?: string | null;
  p_is_wicket?: boolean | null;
  p_dismissal_type?: string | null;
  p_fielder_id?: string | null;
  p_commentary?: string | null;
  p_dismissed_player_id?: string | null;
  p_shot_zone?: string | null;
}

export interface CheckedBall {
  extraType: string | null;
  isWicket: boolean;
  dismissalType: string | null;
  dismissedId: string | null;
}

/**
 * The delivery's arguments checked, or the engine's error code
 * (`invalid_input`, `dismissed_player_not_at_crease`).
 */
export function checkBallArgs(
  args: RecordBallArgs,
): { ok: true; checked: CheckedBall } | { ok: false; code: string } {
  const extraType = args.p_extra_type ?? null;
  if (extraType && !EXTRA_TYPES.has(extraType))
    return { ok: false, code: "invalid_input" };
  const isWicket = Boolean(args.p_is_wicket);
  const dismissalType = args.p_dismissal_type ?? null;
  if (isWicket && dismissalType && !DISMISSAL_TYPES.has(dismissalType)) {
    return { ok: false, code: "invalid_input" };
  }
  let dismissedId: string | null = null;
  if (isWicket) {
    dismissedId = args.p_dismissed_player_id ?? args.p_batsman_id;
    if (
      dismissedId !== args.p_batsman_id &&
      dismissedId !== args.p_non_striker_id
    ) {
      return { ok: false, code: "dismissed_player_not_at_crease" };
    }
  }
  return {
    ok: true,
    checked: { extraType, isWicket, dismissalType, dismissedId },
  };
}

/** A new ball-log row; `random` is the last part of its id (`newBallId`). */
export function newBall(
  args: RecordBallArgs,
  checked: CheckedBall,
  innings: WithId<InningsRow>,
  bpo: number,
  seq: number,
  now: string,
  random: string,
): WithId<BallByBallRow> {
  const totalBalls = innings.total_balls ?? 0;
  const overNumber = Math.floor(totalBalls / bpo);
  return {
    id: newBallId(innings.id, overNumber, random),
    match_id: args.p_match_id,
    innings_id: innings.id,
    over_number: overNumber,
    ball_number: (totalBalls % bpo) + 1,
    bowler_id: args.p_bowler_id,
    batsman_id: args.p_batsman_id,
    non_striker_id: args.p_non_striker_id,
    runs_scored: args.p_runs_scored ?? 0,
    extras: args.p_extras ?? 0,
    extra_type: checked.extraType,
    is_wicket: checked.isWicket,
    dismissal_type: checked.isWicket ? checked.dismissalType : null,
    fielder_id: args.p_fielder_id ?? null,
    dismissed_player_id: checked.dismissedId,
    commentary: args.p_commentary ?? null,
    shot_zone: args.p_shot_zone ?? null,
    seq,
    created_at: now,
  };
}

export function inningsComplete(
  match: MatchesRow,
  innings: InningsRow,
): boolean {
  const limits = inningsLimits(match, innings.innings_number);
  const targetReached =
    innings.target_runs !== null &&
    innings.target_runs !== undefined &&
    (innings.total_runs ?? 0) >= innings.target_runs;
  return (
    targetReached ||
    (innings.total_wickets ?? 0) >= limits.wicketsCap ||
    (innings.total_balls ?? 0) >= limits.maxBalls
  );
}

/** Whether the innings document carries the stage 2 scorecard fields. */
export function hasScorecard(innings: InningsRow): boolean {
  return (
    Array.isArray(innings.batting) &&
    Array.isArray(innings.bowling) &&
    Array.isArray(innings.fall_of_wickets) &&
    Array.isArray(innings.partnerships) &&
    innings.last_ball !== undefined &&
    innings.last_over_bowler_id !== undefined
  );
}

/** Replace entries by user id (or append) without reordering the array. */
export function upsertByUser<E extends { user_id: string }>(
  entries: readonly E[],
  updated: readonly E[],
): E[] {
  const out = [...entries];
  for (const e of updated) {
    const i = out.findIndex((x) => x.user_id === e.user_id);
    if (i >= 0) out[i] = e;
    else out.push(e);
  }
  return out;
}

type BallMatch = Pick<
  MatchesRow,
  | "balls_per_over"
  | "max_balls_per_over"
  | "wide_runs_to_batsman"
  | "noball_extras_to_batsman"
  | "wide_counts_as_ball_faced"
  | "last_ball_seq"
> & { id: string };

/**
 * Whether a delivery on this innings can be applied to its running totals
 * (checked before the over document is read; {@link ballDocsAfter} has the
 * rest of the conditions).
 */
export function canApplyIncrementally(
  match: BallMatch,
  innings: WithId<InningsRow> | null,
): innings is WithId<InningsRow> {
  if (
    match.max_balls_per_over !== null &&
    match.max_balls_per_over !== undefined
  )
    return false;
  if (!innings || innings.is_completed || !hasScorecard(innings)) return false;
  return seqCounterOf(match, innings) !== null;
}

export interface BallDocsInput {
  match: BallMatch;
  innings: WithId<InningsRow>;
  /** The stored over document the delivery goes into (null: none yet). */
  overDoc: Pick<OversRow, "match_id" | "innings_id" | "over_number" | "balls"> | null;
  args: RecordBallArgs;
  checked: CheckedBall;
  /** The random part of the new ball's id. */
  ballRandom: string;
  now: string;
}

export interface BallDocs {
  ball: WithId<BallByBallRow>;
  overNumber: number;
  /** The over document after the delivery (its `id` is `overDocId`). */
  overDoc: Omit<OversRow, "id">;
  /** Every innings field the delivery changes. */
  inningsPatch: Partial<InningsRow>;
  out: IncrementalOutput;
}

/**
 * The innings and over documents after one delivery applied to the running
 * totals of `innings` (exactly what a recompute of the whole ball log would
 * give; see `incremental.ts`). Null when it cannot be applied that way: the
 * engine then recomputes the innings, and the screen waits for the server.
 */
export function ballDocsAfter(input: BallDocsInput): BallDocs | null {
  const { match, innings, args, checked, now } = input;
  if (!canApplyIncrementally(match, innings)) return null;
  const counter = seqCounterOf(match, innings)!;
  const bpo = ballsPerOverOf(match);
  const overNumber = Math.floor((innings.total_balls ?? 0) / bpo);

  const battingRows = battingRowsOf(innings);
  const bowlingRows = bowlingRowsOf(innings);
  const partnershipRows = partnershipRowsOf(innings);
  const striker = battingRows.find((b) => b.user_id === args.p_batsman_id);
  const nonStriker = battingRows.find(
    (b) => b.user_id === args.p_non_striker_id,
  );
  const bowler = bowlingRows.find((b) => b.user_id === args.p_bowler_id);
  if (!striker || !striker.is_current_batsman || !striker.is_striker)
    return null;
  if (!nonStriker || !nonStriker.is_current_batsman || nonStriker.is_striker)
    return null;
  if (!bowler || !bowler.is_current_bowler) return null;
  const currentPartnerships = partnershipRows.filter(
    (p) => p.is_current === true,
  );
  if (currentPartnerships.length > 1) return null;
  const partnership = currentPartnerships[0] ?? null;

  const sortedOver = input.overDoc
    ? ballRowsOf(input.overDoc).sort(bySeq)
    : [];
  const maxOverSeq = sortedOver.length
    ? (sortedOver[sortedOver.length - 1]!.seq ?? 0)
    : 0;
  const seq = Math.max(counter, maxOverSeq) + 1;
  const ball = newBall(
    args,
    checked,
    innings,
    bpo,
    seq,
    now,
    input.ballRandom,
  );

  const out = applyBallIncrementally({
    match,
    innings,
    ball,
    striker,
    nonStriker,
    bowler,
    partnership,
    partnershipCount: startsNewPartnership(ball, partnership)
      ? partnershipRows.length
      : null,
    overBalls: sortedOver,
    now,
  });
  if (!out) return null;

  const overBalls = [...sortedOver, ball];
  const overDoc: Omit<OversRow, "id"> = {
    match_id: innings.match_id ?? match.id,
    innings_id: innings.id,
    over_number: overNumber,
    balls: overBalls.map(toBallEntry),
    updated_at: now,
  };

  const partnerships = (innings.partnerships ?? []).slice();
  for (const p of out.partnerships) {
    const index = Number(p.id.slice(p.id.lastIndexOf("_p") + 2)) - 1;
    partnerships[index] = toPartnershipEntry(p);
  }
  const inningsPatch: Partial<InningsRow> = {
    ...out.inningsPatch,
    batting: upsertByUser(
      innings.batting ?? [],
      out.batting.map(toBattingEntry),
    ),
    bowling: upsertByUser(
      innings.bowling ?? [],
      out.bowling.map(toBowlingEntry),
    ),
    fall_of_wickets: [
      ...(innings.fall_of_wickets ?? []),
      ...out.fallOfWickets.map(toFallOfWicketEntry),
    ],
    partnerships,
    last_ball: { ...toBallEntry(ball), over_number: ball.over_number },
    last_over_bowler_id: out.overJustEnded
      ? lastOverBowlerOf(overBalls, out.inningsPatch.total_balls ?? 0, bpo)
      : (innings.last_over_bowler_id ?? null),
    last_ball_seq: seq,
  };
  return { ball, overNumber, overDoc, inningsPatch, out };
}

/**
 * The innings' batting entries with `strikerId` / `nonStrikerId` at the
 * crease (newcomers appended at the next batting positions), or null when
 * nothing changes. Validation (roster, already out) is the caller's.
 */
export function battingWithCrease(
  batting: readonly BattingEntry[],
  strikerId: string,
  nonStrikerId: string,
): BattingEntry[] | null {
  let nextPos = batting.reduce(
    (m, b) => Math.max(m, b.batting_position ?? 0),
    0,
  );
  const newcomers = [strikerId, nonStrikerId]
    .filter((id) => !batting.some((b) => b.user_id === id))
    .sort();

  let changed = false;
  const next = batting.map((b) => {
    const isCurrent = b.user_id === strikerId || b.user_id === nonStrikerId;
    const isStriker = b.user_id === strikerId;
    if (
      Boolean(b.is_current_batsman) === isCurrent &&
      Boolean(b.is_striker) === isStriker
    )
      return b;
    changed = true;
    return { ...b, is_current_batsman: isCurrent, is_striker: isStriker };
  });
  for (const userId of newcomers) {
    nextPos += 1;
    changed = true;
    next.push({
      user_id: userId,
      batting_position: nextPos,
      runs_scored: 0,
      balls_faced: 0,
      minutes_batted: 0,
      fours: 0,
      sixes: 0,
      is_out: false,
      dismissal_type: null,
      bowler_id: null,
      fielder_id: null,
      is_current_batsman: true,
      is_striker: userId === strikerId,
    });
  }
  return changed ? next : null;
}

/**
 * The innings' bowling entries with `bowlerId` as the current bowler (a new
 * entry when they have not bowled yet), or null when nothing changes.
 * Validation (team, previous over) is the caller's.
 */
export function bowlingWithBowler(
  bowling: readonly BowlingEntry[],
  bowlerId: string,
): BowlingEntry[] | null {
  // Only entries whose flag flips change: the bowlers currently flagged
  // and the chosen bowler's own entry.
  let changed = false;
  const next = bowling.map((b) => {
    const isCurrent = b.user_id === bowlerId;
    const touched = b.is_current_bowler === true || isCurrent;
    if (!touched || Boolean(b.is_current_bowler) === isCurrent) return b;
    changed = true;
    return { ...b, is_current_bowler: isCurrent };
  });
  if (!bowling.some((b) => b.user_id === bowlerId)) {
    changed = true;
    next.push({
      user_id: bowlerId,
      overs_bowled: 0,
      balls_bowled: 0,
      runs_conceded: 0,
      wickets_taken: 0,
      maidens: 0,
      wides: 0,
      no_balls: 0,
      is_current_bowler: true,
    });
  }
  return changed ? next : null;
}
