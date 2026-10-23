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
import { matchPositionOf } from "../../match-position";
import {
  applyBallIncrementally,
  isRetirementAtCrease,
  type IncrementalOutput,
} from "./incremental";
import { startsNewPartnership } from "./recompute";
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
  /**
   * On a no-ball: what the completed runs were (`no_ball_runs`). Absent,
   * null or "bat": off the bat, as before the field existed.
   */
  p_no_ball_runs?: string | null;
}

/** What a no-ball's completed runs may be besides off the bat. */
export const NO_BALL_RUNS = new Set(["bye", "leg_bye"]);

export interface CheckedBall {
  extraType: string | null;
  isWicket: boolean;
  dismissalType: string | null;
  dismissedId: string | null;
  /** Byes or leg byes off a no-ball; null: off the bat (or not a no-ball). */
  noBallRuns?: "bye" | "leg_bye" | null;
}

/**
 * A no-ball's `no_ball_runs` from its arguments: null unless the ball is a
 * no-ball whose runs were byes or leg byes. Undefined: an unknown value.
 */
export function noBallRunsOf(
  extraType: string | null,
  value: string | null | undefined,
): "bye" | "leg_bye" | null | undefined {
  if (value == null || value === "bat") return null;
  if (!NO_BALL_RUNS.has(value)) return undefined;
  return extraType === "no_ball" ? (value as "bye" | "leg_bye") : null;
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
  const noBallRuns = noBallRunsOf(extraType, args.p_no_ball_runs);
  if (noBallRuns === undefined) return { ok: false, code: "invalid_input" };
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
    checked: { extraType, isWicket, dismissalType, dismissedId, noBallRuns },
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
    // Only on a no-ball the bat did not touch: other balls stay as before.
    ...(checked.noBallRuns ? { no_ball_runs: checked.noBallRuns } : {}),
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
  | "noball_counts_as_ball_faced"
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
  const sortedOver = sortedOverOf(input.overDoc);
  const seq = Math.max(counter, lastSeqOf(sortedOver)) + 1;
  const ball = newBall(
    args,
    checked,
    innings,
    bpo,
    seq,
    now,
    input.ballRandom,
  );
  return docsAfterEntry(match, innings, sortedOver, ball, now);
}

function sortedOverOf(overDoc: BallDocsInput["overDoc"]): BallByBallRow[] {
  return overDoc ? ballRowsOf(overDoc).sort(bySeq) : [];
}

function lastSeqOf(sortedOver: BallByBallRow[]): number {
  return sortedOver.length ? (sortedOver[sortedOver.length - 1]!.seq ?? 0) : 0;
}

/**
 * The documents after `ball`, a new ball-log entry of the current over, is
 * applied to the running totals of `innings` (at the crease and with the
 * bowler it names, as stored). Null when that would not be exact.
 */
function docsAfterEntry(
  match: BallMatch,
  innings: WithId<InningsRow>,
  sortedOver: BallByBallRow[],
  ball: WithId<BallByBallRow>,
  now: string,
): BallDocs | null {
  const bpo = ballsPerOverOf(match);
  const overNumber = Math.floor((innings.total_balls ?? 0) / bpo);
  if (ball.over_number !== overNumber) return null;

  const battingRows = battingRowsOf(innings);
  const bowlingRows = bowlingRowsOf(innings);
  const partnershipRows = partnershipRowsOf(innings);
  const striker = battingRows.find((b) => b.user_id === ball.batsman_id);
  const nonStriker = battingRows.find(
    (b) => b.user_id === ball.non_striker_id,
  );
  if (!striker || !striker.is_current_batsman || !striker.is_striker)
    return null;
  if (!nonStriker || !nonStriker.is_current_batsman || nonStriker.is_striker)
    return null;
  // A retirement is logged without a bowler.
  const bowler = ball.bowler_id
    ? bowlingRows.find((b) => b.user_id === ball.bowler_id)
    : null;
  if (ball.bowler_id && (!bowler || !bowler.is_current_bowler)) return null;
  const currentPartnerships = partnershipRows.filter(
    (p) => p.is_current === true,
  );
  if (currentPartnerships.length > 1) return null;
  const partnership = currentPartnerships[0] ?? null;

  const out = applyBallIncrementally({
    match,
    innings,
    ball,
    striker,
    nonStriker,
    bowler: bowler ?? null,
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
    last_ball_seq: ball.seq,
  };
  return { ball, overNumber, overDoc, inningsPatch, out };
}

// ---------------------------------------------------------------------------
// Events: retirements and penalty / bonus runs (logged, not deliveries)
// ---------------------------------------------------------------------------

/**
 * A logged event in the current over of `innings` (the current innings):
 * not a delivery, numbered after the match's seq counter. `random` is the
 * last part of its id (`newBallId`).
 */
export function newEventBall(
  match: Pick<
    MatchesRow,
    | "balls_per_over"
    | "current_innings"
    | "current_over"
    | "current_ball"
    | "last_ball_seq"
  > & { id: string },
  innings: WithId<InningsRow>,
  fields: Partial<BallByBallRow>,
  now: string,
  random: string,
): WithId<BallByBallRow> {
  const pos = matchPositionOf(match, innings);
  const overNumber = pos.current_over;
  return {
    id: newBallId(innings.id, overNumber, random),
    match_id: match.id,
    innings_id: innings.id,
    over_number: overNumber,
    ball_number: Math.min(20, Math.max(1, pos.current_ball + 1)),
    bowler_id: null,
    batsman_id: null,
    non_striker_id: null,
    runs_scored: 0,
    extras: 0,
    extra_type: null,
    is_wicket: false,
    dismissal_type: null,
    fielder_id: null,
    dismissed_player_id: null,
    commentary: null,
    shot_zone: null,
    seq: (seqCounterOf(match, innings) ?? 0) + 1,
    created_at: now,
    ...fields,
  };
}

/** The crease and bowler as the innings document holds them. */
function creaseOf(innings: InningsRow) {
  const batting = battingRowsOf(innings);
  return {
    striker: batting.find((b) => b.is_striker === true) ?? null,
    nonStriker:
      batting.find(
        (b) => b.is_current_batsman === true && b.is_striker === false,
      ) ?? null,
    bowler:
      bowlingRowsOf(innings).find((b) => b.is_current_bowler === true) ?? null,
  };
}

/**
 * The log entry of a retirement. At a full crease it names both batters
 * (who retired is `dismissed_player_id`), so the partner stays at their
 * end and the new batter comes in at the retired one's; otherwise (an end
 * already empty, or someone not at the crease) the batter alone.
 */
export function retirementFields(
  innings: InningsRow,
  playerId: string,
  type: "retired_hurt" | "retired_out",
  reason: string | null | undefined,
): Partial<BallByBallRow> {
  const { striker, nonStriker } = creaseOf(innings);
  const atCrease =
    striker?.is_current_batsman === true &&
    nonStriker !== null &&
    (playerId === striker.user_id || playerId === nonStriker.user_id);
  return {
    ...(atCrease
      ? { batsman_id: striker.user_id, non_striker_id: nonStriker.user_id }
      : { batsman_id: playerId }),
    is_wicket: true,
    dismissal_type: type,
    dismissed_player_id: playerId,
    commentary: `Player ${type === "retired_hurt" ? "retired hurt" : "retired out"}${reason ? `: ${reason}` : ""}`,
  };
}

/** The log entry of penalty / bonus runs to the batting side: at the crease. */
export function penaltyFields(
  innings: InningsRow,
  runs: number,
  type: "penalty" | "bonus",
  reason: string | null | undefined,
): Partial<BallByBallRow> {
  const { striker, nonStriker, bowler } = creaseOf(innings);
  return {
    bowler_id: bowler?.user_id ?? null,
    batsman_id: striker?.user_id ?? null,
    non_striker_id: nonStriker?.user_id ?? null,
    extras: runs,
    extra_type: type,
    commentary: `${type === "bonus" ? "Bonus" : "Penalty"}: +${runs} runs awarded to batting team (${reason ?? ""})`,
  };
}

/**
 * The documents after `event` (from {@link newEventBall}: a retirement at a
 * full crease, or penalty / bonus runs to the batting side at a full crease
 * with a bowler) applied to the running totals, as `ballDocsAfter` does for
 * a delivery. Null for any other event or when that would not be exact:
 * the engine then recomputes the innings, and the screen waits for it.
 */
export function eventDocsAfter(input: {
  match: BallMatch;
  innings: WithId<InningsRow>;
  overDoc: BallDocsInput["overDoc"];
  event: WithId<BallByBallRow>;
  now: string;
}): BallDocs | null {
  const { match, innings, event, now } = input;
  if (!canApplyIncrementally(match, innings)) return null;
  const counter = seqCounterOf(match, innings)!;
  const sortedOver = sortedOverOf(input.overDoc);
  // An event is numbered after the counter alone.
  if (lastSeqOf(sortedOver) > counter || event.seq !== counter + 1) return null;
  const penalty =
    !event.penalty_team_id &&
    (event.extra_type === "penalty" || event.extra_type === "bonus") &&
    Boolean(event.bowler_id) &&
    (event.runs_scored ?? 0) === 0 &&
    !event.is_wicket;
  if (!penalty && !isRetirementAtCrease(event)) return null;
  return docsAfterEntry(match, innings, sortedOver, event, now);
}

/**
 * Whether a batter's entry records nothing: no ball faced, no run, not out
 * or retired. Such an entry leaving the crease was a mistaken selection.
 */
function untouched(b: BattingEntry): boolean {
  return (
    !b.is_out &&
    !b.dismissal_type &&
    (b.balls_faced ?? 0) === 0 &&
    (b.runs_scored ?? 0) === 0
  );
}

/**
 * The innings' batting entries with `strikerId` / `nonStrikerId` at the
 * crease, or null when nothing changes. Newcomers are appended at the next
 * batting positions. A batter sent away from the crease
 * before anything happened to them (a wrong pick, corrected) is dropped, so
 * they keep no scorecard row or batting position. Validation (roster,
 * already out) is the caller's.
 */
export function battingWithCrease(
  batting: readonly BattingEntry[],
  strikerId: string,
  nonStrikerId: string,
): BattingEntry[] | null {
  const atCrease = (id: string) => id === strikerId || id === nonStrikerId;
  const kept = batting.filter(
    (b) => atCrease(b.user_id) || !b.is_current_batsman || !untouched(b),
  );
  let changed = kept.length !== batting.length;
  let nextPos = kept.reduce(
    (m, b) => Math.max(m, b.batting_position ?? 0),
    0,
  );
  // Sorted, as the engine always has (its replay fixtures pin it).
  const newcomers = [strikerId, nonStrikerId]
    .filter((id) => !kept.some((b) => b.user_id === id))
    .sort();

  const next = kept.map((b) => {
    const isCurrent = atCrease(b.user_id);
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
