/**
 * Scoring engine mutations (server only), ported from the PL/pgSQL
 * functions `record_ball`, `undo_last_ball`, `update_ball`, `end_innings`,
 * `start_super_over`, `recompute_innings`, `set_current_batsmen` and
 * `set_current_bowler`.
 *
 * Each mutation runs inside one Firestore transaction and writes all of its
 * rows together so a crash can never leave half-updated scorecards.
 *
 * `record_ball` applies a normal delivery incrementally (see
 * `scoring/incremental.ts`): it reads only the rows the ball touches. Any
 * case it cannot apply exactly falls back to the full recompute of the
 * innings from its ball log, which every history-editing mutation (undo,
 * update, recompute) uses and which remains the source of truth. Only rows
 * whose values changed are written. Every mutation refreshes
 * `live_state/{matchId}` (see `live-state.ts`).
 */

import "server-only";
import type { Firestore } from "firebase-admin/firestore";
import type { ScoringState } from "~/app/matches/types";
import type { DataSource } from "../datasource";
import {
  headerFromCache,
  LIVE_STATE_COLLECTION,
  stageLiveState,
  writeLiveState,
  type LiveStateDoc,
} from "../live-state";
import { DbQueryError, newId } from "../query-builder";
import {
  applyBallIncrementally,
  startsNewPartnership,
} from "../scoring/incremental";
import { recomputeInnings, type RecomputeOutput } from "../scoring/recompute";
import {
  advanceAfterInnings,
  inningsLimits,
  type AdvanceOutput,
} from "../scoring/result";
import { diffRows, sameRow } from "../scoring/rows";
import {
  runScoringTransaction,
  type ScoringTx,
  type WithId,
} from "../scoring/tx";
import type {
  BallByBallRow,
  BattingPerformancesRow,
  BowlingPerformancesRow,
  FallOfWicketsRow,
  InningsRow,
  MatchesRow,
  PartnershipsRow,
  TeamPlayersRow,
  TeamsRow,
} from "../types";
import { liveStateUserIds, loadCurrentInnings, loadNames } from "../views";
import { isMatchAdmin } from "./auth-helpers";
import { maybeRecalculateStandings } from "./standings";
import {
  composeScoringState,
  findLastOverBowler,
  recordState,
  scoringStateUserIds,
} from "./state";

export interface ScoringContext {
  /** Admin Firestore. Without it mutations run on `ds` (tests only). */
  db?: Firestore | null;
  ds: DataSource;
  uid: string | null;
  /** Apply plain deliveries incrementally (default). Tests turn it off. */
  incremental?: boolean;
}

const EXTRA_TYPES = new Set([
  "wide",
  "no_ball",
  "bye",
  "leg_bye",
  "penalty",
  "bonus",
]);
const DISMISSAL_TYPES = new Set([
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

interface InningsBundle {
  match: WithId<MatchesRow>;
  innings: WithId<InningsRow>;
  balls: WithId<BallByBallRow>[];
  batting: WithId<BattingPerformancesRow>[];
  bowling: WithId<BowlingPerformancesRow>[];
  fallOfWickets: WithId<FallOfWicketsRow>[];
  partnerships: WithId<PartnershipsRow>[];
}

function sortBySeq<T extends { seq?: number | null }>(balls: T[]): T[] {
  return [...balls].sort((a, b) => (a.seq ?? 0) - (b.seq ?? 0));
}

async function loadInningsBundle(
  t: ScoringTx,
  match: WithId<MatchesRow>,
  innings: WithId<InningsRow>,
): Promise<InningsBundle> {
  const [balls, batting, bowling, fallOfWickets, partnerships] =
    await Promise.all([
      t.where<BallByBallRow>("ball_by_ball", [
        ["innings_id", "==", innings.id],
      ]),
      t.where<BattingPerformancesRow>("batting_performances", [
        ["innings_id", "==", innings.id],
      ]),
      t.where<BowlingPerformancesRow>("bowling_performances", [
        ["innings_id", "==", innings.id],
      ]),
      t.where<FallOfWicketsRow>("fall_of_wickets", [
        ["innings_id", "==", innings.id],
      ]),
      t.where<PartnershipsRow>("partnerships", [
        ["innings_id", "==", innings.id],
      ]),
    ]);
  return {
    match,
    innings,
    balls: sortBySeq(balls),
    batting,
    bowling,
    fallOfWickets,
    partnerships,
  };
}

function runRecompute(
  bundle: InningsBundle,
  balls: BallByBallRow[],
  now: string,
): RecomputeOutput {
  return recomputeInnings({
    match: bundle.match,
    innings: bundle.innings,
    balls: sortBySeq(balls),
    existingBatting: bundle.batting,
    existingBowling: bundle.bowling,
    now,
  });
}

/** Stage rows that differ from the loaded ones (timestamps ignored). */
function writeChangedRows<T extends { id: string }>(
  t: ScoringTx,
  table: string,
  next: T[],
  loaded: readonly T[],
): T[] {
  const { changed, merged } = diffRows(next, loaded);
  for (const row of changed) t.put(table, row.id, row);
  return merged;
}

function patchInningsIfChanged(
  t: ScoringTx,
  innings: WithId<InningsRow>,
  patch: Partial<InningsRow>,
): void {
  if (!sameRow({ ...innings, ...patch }, innings)) {
    t.patch("innings", innings.id, patch);
  }
}

/**
 * Stage the recompute result, writing only rows that changed. Returns the
 * output with unchanged rows replaced by their stored versions.
 */
function writeRecompute(
  t: ScoringTx,
  bundle: InningsBundle,
  out: RecomputeOutput,
  now: string,
): RecomputeOutput {
  patchInningsIfChanged(t, bundle.innings, out.inningsPatch);
  t.patch("matches", bundle.match.id, { ...out.matchPatch, updated_at: now });
  const batting = writeChangedRows(
    t,
    "batting_performances",
    out.batting,
    bundle.batting,
  );
  const bowling = writeChangedRows(
    t,
    "bowling_performances",
    out.bowling,
    bundle.bowling,
  );

  const keepFow = new Set(out.fallOfWickets.map((f) => f.id));
  for (const existing of bundle.fallOfWickets) {
    if (!keepFow.has(existing.id)) t.delete("fall_of_wickets", existing.id);
  }
  const fallOfWickets = writeChangedRows(
    t,
    "fall_of_wickets",
    out.fallOfWickets,
    bundle.fallOfWickets,
  );

  const keepPartnerships = new Set(out.partnerships.map((p) => p.id));
  for (const existing of bundle.partnerships) {
    if (!keepPartnerships.has(existing.id))
      t.delete("partnerships", existing.id);
  }
  const partnerships = writeChangedRows(
    t,
    "partnerships",
    out.partnerships,
    bundle.partnerships,
  );
  return { ...out, batting, bowling, fallOfWickets, partnerships };
}

function applyAdvance(
  t: ScoringTx,
  match: MatchesRow,
  completed: InningsRow,
  allInnings: InningsRow[],
  teamNames: Record<string, string | undefined>,
  now: string,
): AdvanceOutput {
  const out = advanceAfterInnings(
    { match, completed, allInnings, teamNames, now },
    newId(),
  );
  t.patch("innings", completed.id, out.completedInningsPatch);
  t.patch("matches", match.id, out.matchPatch);
  if (out.nextInnings) {
    t.put("innings", out.nextInnings.id, out.nextInnings);
  }
  return out;
}

/**
 * Team names for the result text, from the match's snapshots when present
 * (no reads), otherwise from the team docs.
 */
async function teamNamesOf(
  t: ScoringTx,
  match: MatchesRow,
): Promise<Record<string, string | undefined>> {
  const names: Record<string, string | undefined> = {};
  for (const snap of [match.team1_snapshot, match.team2_snapshot]) {
    if (snap?.id) names[snap.id] = snap.name;
  }
  const missing = [match.team1_id, match.team2_id].filter(
    (id) => !!id && !(id in names),
  );
  if (missing.length) {
    for (const team of await t.docs<TeamsRow>("teams", missing)) {
      names[team.id] = team.name;
    }
  }
  return names;
}

async function requireAdmin(
  ctx: ScoringContext,
  matchId: string,
): Promise<void> {
  if (!(await isMatchAdmin(ctx.ds, matchId, ctx.uid))) {
    throw new DbQueryError("not_authorized", "42501");
  }
}

/**
 * Same rule as `isMatchAdmin`, answered from the match row already read in
 * the transaction when possible (creator / listed admin), so the hot path
 * does not read the match twice.
 */
async function requireAdminOf(
  ctx: ScoringContext,
  matchId: string,
  match: MatchesRow | null,
): Promise<void> {
  if (match && ctx.uid) {
    if (match.created_by === ctx.uid) return;
    if ((match.match_admins ?? []).includes(ctx.uid)) return;
  }
  if (!match) throw new DbQueryError("not_authorized", "42501");
  await requireAdmin(ctx, matchId);
}

async function currentInningsOf(
  t: ScoringTx,
  match: WithId<MatchesRow>,
): Promise<{ all: WithId<InningsRow>[]; current: WithId<InningsRow> | null }> {
  const all = await t.where<InningsRow>("innings", [
    ["match_id", "==", match.id],
  ]);
  const current =
    all.find((i) => i.innings_number === (match.current_innings ?? 1)) ?? null;
  return { all, current };
}

async function finishWithState(
  ctx: ScoringContext,
  matchId: string,
  before: MatchesRow | null,
): Promise<ScoringState> {
  const after = (await ctx.ds.getById(
    "matches",
    matchId,
  )) as unknown as MatchesRow | null;
  await maybeRecalculateStandings(ctx.ds, before, after);
  await writeLiveState(ctx.ds, matchId, ctx.db);
  return recordState(ctx.ds, matchId, after);
}

// ---------------------------------------------------------------------------
// record_ball
// ---------------------------------------------------------------------------

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

interface CheckedBall {
  extraType: string | null;
  isWicket: boolean;
  dismissalType: string | null;
  dismissedId: string | null;
}

function checkBallArgs(args: RecordBallArgs): CheckedBall {
  const extraType = args.p_extra_type ?? null;
  if (extraType && !EXTRA_TYPES.has(extraType))
    throw new DbQueryError("invalid_input", "22000");
  const isWicket = Boolean(args.p_is_wicket);
  const dismissalType = args.p_dismissal_type ?? null;
  if (isWicket && dismissalType && !DISMISSAL_TYPES.has(dismissalType)) {
    throw new DbQueryError("invalid_input", "22000");
  }
  let dismissedId: string | null = null;
  if (isWicket) {
    dismissedId = args.p_dismissed_player_id ?? args.p_batsman_id;
    if (
      dismissedId !== args.p_batsman_id &&
      dismissedId !== args.p_non_striker_id
    ) {
      throw new DbQueryError("dismissed_player_not_at_crease", "22000");
    }
  }
  return { extraType, isWicket, dismissalType, dismissedId };
}

function newBall(
  args: RecordBallArgs,
  checked: CheckedBall,
  innings: WithId<InningsRow>,
  bpo: number,
  seq: number,
  now: string,
): WithId<BallByBallRow> {
  const totalBalls = innings.total_balls ?? 0;
  return {
    id: newId(),
    match_id: args.p_match_id,
    innings_id: innings.id,
    over_number: Math.floor(totalBalls / bpo),
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

function inningsComplete(match: MatchesRow, innings: InningsRow): boolean {
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

interface RecordOutcome {
  before: MatchesRow;
  /** Set by the incremental path, which also builds the state in the tx. */
  after: MatchesRow | null;
  state: ScoringState | null;
}

/**
 * Fast path: read only the rows this delivery touches and apply it to the
 * running totals. Returns null when the ball must go through a full
 * recompute instead (including every validation failure, so the full path
 * raises the usual error).
 */
async function recordBallIncremental(
  t: ScoringTx,
  match: WithId<MatchesRow>,
  args: RecordBallArgs,
  checked: CheckedBall,
  now: string,
): Promise<RecordOutcome | null> {
  if (
    match.max_balls_per_over !== null &&
    match.max_balls_per_over !== undefined
  )
    return null;
  if (match.last_ball_seq === null || match.last_ball_seq === undefined)
    return null;

  const innings = (await loadCurrentInnings(
    t,
    match,
  )) as WithId<InningsRow> | null;
  if (!innings || innings.is_completed) return null;

  const bpo =
    match.balls_per_over && match.balls_per_over > 0 ? match.balls_per_over : 6;
  const overNumber = Math.floor((innings.total_balls ?? 0) / bpo);
  const strikerId = `${innings.id}_${args.p_batsman_id}`;
  const nonStrikerId = `${innings.id}_${args.p_non_striker_id}`;
  const [battingRows, bowlingRows, currentPartnerships, overBalls, prevLive] =
    await Promise.all([
      t.docs<BattingPerformancesRow>("batting_performances", [
        strikerId,
        nonStrikerId,
      ]),
      t.docs<BowlingPerformancesRow>("bowling_performances", [
        `${innings.id}_${args.p_bowler_id}`,
      ]),
      t.where<PartnershipsRow>("partnerships", [
        ["innings_id", "==", innings.id],
        ["is_current", "==", true],
      ]),
      t.where<BallByBallRow>("ball_by_ball", [
        ["innings_id", "==", innings.id],
        ["over_number", "==", overNumber],
      ]),
      t.doc<LiveStateDoc>(LIVE_STATE_COLLECTION, match.id),
    ]);

  const striker = battingRows.find((b) => b.id === strikerId);
  const nonStriker = battingRows.find((b) => b.id === nonStrikerId);
  const bowler = bowlingRows[0];
  if (
    !striker ||
    striker.innings_id !== innings.id ||
    striker.user_id !== args.p_batsman_id ||
    !striker.is_current_batsman ||
    !striker.is_striker
  )
    return null;
  if (
    !nonStriker ||
    nonStriker.innings_id !== innings.id ||
    nonStriker.user_id !== args.p_non_striker_id ||
    !nonStriker.is_current_batsman ||
    nonStriker.is_striker
  )
    return null;
  if (
    !bowler ||
    bowler.innings_id !== innings.id ||
    bowler.user_id !== args.p_bowler_id ||
    !bowler.is_current_bowler
  )
    return null;
  if (currentPartnerships.length > 1) return null;
  const partnership = currentPartnerships[0] ?? null;

  const sortedOver = sortBySeq(overBalls);
  const maxOverSeq = sortedOver.length
    ? (sortedOver[sortedOver.length - 1]!.seq ?? 0)
    : 0;
  const seq = Math.max(match.last_ball_seq, maxOverSeq) + 1;
  const ball = newBall(args, checked, innings, bpo, seq, now);

  let partnershipCount: number | null = null;
  if (startsNewPartnership(ball, partnership)) {
    partnershipCount = (
      await t.where<PartnershipsRow>("partnerships", [
        ["innings_id", "==", innings.id],
      ])
    ).length;
  }

  const out = applyBallIncrementally({
    match,
    innings,
    ball,
    striker,
    nonStriker,
    bowler,
    partnership,
    partnershipCount,
    overBalls: sortedOver,
    now,
  });
  if (!out) return null;

  // ---- writes (buffered until the callback returns) ----
  t.put("ball_by_ball", ball.id, ball);
  patchInningsIfChanged(t, innings, out.inningsPatch);
  const matchPatch: Partial<MatchesRow> = {
    ...out.matchPatch,
    last_ball_seq: seq,
    updated_at: now,
  };
  t.patch("matches", match.id, matchPatch);
  const batting = writeChangedRows(t, "batting_performances", out.batting, [
    striker,
    nonStriker,
  ]);
  const bowling = writeChangedRows(t, "bowling_performances", out.bowling, [
    bowler,
  ]);
  for (const f of out.fallOfWickets) t.put("fall_of_wickets", f.id, f);
  const partnerships = writeChangedRows(
    t,
    "partnerships",
    out.partnerships,
    partnership ? [partnership] : [],
  );

  // ---- innings / match completion ----
  let matchAfter: MatchesRow = { ...match, ...matchPatch };
  let inningsAfter: WithId<InningsRow> = { ...innings, ...out.inningsPatch };
  let header: Awaited<ReturnType<typeof headerFromCache>> | undefined;
  let advance: AdvanceOutput | null = null;
  if (inningsComplete(match, inningsAfter)) {
    const all = await t.where<InningsRow>("innings", [
      ["match_id", "==", match.id],
    ]);
    header = await headerFromCache(t, match, prevLive);
    const teamNames: Record<string, string | undefined> = {};
    for (const [id, team] of header.teams)
      teamNames[id] = team.name ?? undefined;
    advance = applyAdvance(
      t,
      matchAfter,
      inningsAfter,
      all.map((i) => (i.id === innings.id ? inningsAfter : i)),
      teamNames,
      now,
    );
    matchAfter = { ...matchAfter, ...advance.matchPatch };
    inningsAfter = { ...inningsAfter, ...advance.completedInningsPatch };
  }

  // ---- live state + returned scoring state ----
  const nextInnings = advance?.nextInnings ?? null;
  const currentInnings: InningsRow = nextInnings ?? inningsAfter;
  const sameInnings = !nextInnings;
  const curStriker = sameInnings
    ? (batting.find((b) => b.is_current_batsman && b.is_striker) ?? null)
    : null;
  const curNonStriker = sameInnings
    ? (batting.find((b) => b.is_current_batsman && !b.is_striker) ?? null)
    : null;
  const bowlerAfter = bowling[0]!;
  const curBowler =
    sameInnings && bowlerAfter.is_current_bowler ? bowlerAfter : null;
  const curPartnership = sameInnings
    ? (partnerships.find((p) => p.is_current) ?? null)
    : null;
  const thisOverNumber = Math.floor((currentInnings.total_balls ?? 0) / bpo);
  const thisOver =
    sameInnings && thisOverNumber === overNumber ? [...sortedOver, ball] : [];
  const lastBall = sameInnings ? ball : null;

  const liveParts = {
    match: matchAfter,
    innings: currentInnings,
    striker: curStriker,
    nonStriker: curNonStriker,
    bowler: curBowler,
    partnership: curPartnership,
    thisOver,
    lastBall,
  };
  const ids = Array.from(
    new Set([
      ...liveStateUserIds(liveParts),
      ...scoringStateUserIds(liveParts),
    ]),
  );
  const [names, lastOverBowlerId] = await Promise.all([
    loadNames(t, ids, prevLive?.refs?.names ?? {}),
    findLastOverBowler(
      t,
      currentInnings.id,
      currentInnings.total_balls ?? 0,
      bpo,
      lastBall,
    ),
  ]);
  await stageLiveState(t, liveParts, prevLive, now, header, names);

  const state = composeScoringState({
    match: matchAfter,
    innings: currentInnings,
    striker: curStriker,
    nonStriker: curNonStriker,
    currentBatsmen: (curStriker ? 1 : 0) + (curNonStriker ? 1 : 0),
    bowler: curBowler,
    lastBall,
    lastBowlerPerf: sameInnings ? bowlerAfter : null,
    lastOverBowlerId,
    nameOf: (id) => (id ? (names[id] ?? null) : null),
  });
  return { before: match, after: matchAfter, state };
}

/** Full path: recompute the whole innings from its ball log. */
async function recordBallFull(
  t: ScoringTx,
  match: WithId<MatchesRow>,
  args: RecordBallArgs,
  checked: CheckedBall,
  now: string,
): Promise<RecordOutcome> {
  const matchId = match.id;
  const { all, current: innings } = await currentInningsOf(t, match);
  if (!innings || innings.is_completed)
    throw new DbQueryError("no_open_innings", "22000");

  const bundle = await loadInningsBundle(t, match, innings);

  if (bundle.batting.filter((b) => b.is_current_batsman).length < 2) {
    throw new DbQueryError("awaiting_new_batsman", "22000");
  }
  if (
    !bundle.bowling.some(
      (b) => b.is_current_bowler && b.user_id === args.p_bowler_id,
    )
  ) {
    throw new DbQueryError("bowler_not_set", "22000");
  }
  if (
    !bundle.batting.some(
      (b) =>
        b.is_current_batsman && b.is_striker && b.user_id === args.p_batsman_id,
    )
  ) {
    throw new DbQueryError("striker_mismatch", "22000");
  }
  if (
    !bundle.batting.some(
      (b) =>
        b.is_current_batsman &&
        !b.is_striker &&
        b.user_id === args.p_non_striker_id,
    )
  ) {
    throw new DbQueryError("non_striker_mismatch", "22000");
  }

  const bpo =
    match.balls_per_over && match.balls_per_over > 0 ? match.balls_per_over : 6;
  const maxSeq = bundle.balls.reduce((m, b) => Math.max(m, b.seq ?? 0), 0);
  const seq = Math.max(match.last_ball_seq ?? 0, maxSeq) + 1;
  const ball = newBall(args, checked, innings, bpo, seq, now);
  t.put("ball_by_ball", ball.id, ball);

  const out = runRecompute(bundle, [...bundle.balls, ball], now);
  writeRecompute(t, bundle, out, now);
  t.patch("matches", matchId, { last_ball_seq: seq });

  const updatedInnings: WithId<InningsRow> = {
    ...innings,
    ...out.inningsPatch,
  };
  if (inningsComplete(match, updatedInnings)) {
    applyAdvance(
      t,
      { ...match, ...out.matchPatch },
      updatedInnings,
      all.map((i) => (i.id === innings.id ? updatedInnings : i)),
      await teamNamesOf(t, match),
      now,
    );
  }
  return { before: match, after: null, state: null };
}

export async function recordBall(
  ctx: ScoringContext,
  args: RecordBallArgs,
): Promise<ScoringState> {
  const matchId = args.p_match_id;
  const now = new Date().toISOString();
  const outcome = await runScoringTransaction(ctx, async (t) => {
    const match = await t.doc<MatchesRow>("matches", matchId);
    await requireAdminOf(ctx, matchId, match);
    const checked = checkBallArgs(args);
    if (!match) throw new DbQueryError("match_not_found", "22000");
    if (match.status !== "live")
      throw new DbQueryError("match_not_live", "22000");

    if (ctx.incremental !== false) {
      const fast = await recordBallIncremental(t, match, args, checked, now);
      if (fast) return fast;
    }
    return recordBallFull(t, match, args, checked, now);
  });

  const { before } = outcome;
  let state: ScoringState;
  if (outcome.state && outcome.after) {
    await maybeRecalculateStandings(ctx.ds, before, outcome.after);
    state = outcome.state;
  } else {
    state = await finishWithState(ctx, matchId, before);
  }
  if (state.current_innings !== (before.current_innings ?? 1)) {
    state.innings_break = true;
  }
  return state;
}

// ---------------------------------------------------------------------------
// undo_last_ball
// ---------------------------------------------------------------------------

export async function undoLastBall(
  ctx: ScoringContext,
  matchId: string,
): Promise<ScoringState> {
  await requireAdmin(ctx, matchId);
  const now = new Date().toISOString();

  const before = await runScoringTransaction(ctx, async (t) => {
    const match = await t.doc<MatchesRow>("matches", matchId);
    if (!match) throw new DbQueryError("match_not_found", "22000");

    const allBalls = sortBySeq(
      await t.where<BallByBallRow>("ball_by_ball", [
        ["match_id", "==", matchId],
      ]),
    );
    const last = allBalls.length ? allBalls[allBalls.length - 1]! : null;
    if (!last || !last.innings_id)
      throw new DbQueryError("nothing_to_undo", "22000");

    const { all, current } = await currentInningsOf(t, match);
    const target = all.find((i) => i.id === last.innings_id);
    if (!target) throw new DbQueryError("nothing_to_undo", "22000");

    const crossingBoundary = current !== null && current.id !== last.innings_id;
    const staleChildren =
      crossingBoundary && current
        ? await Promise.all([
            t.where<BattingPerformancesRow>("batting_performances", [
              ["innings_id", "==", current.id],
            ]),
            t.where<BowlingPerformancesRow>("bowling_performances", [
              ["innings_id", "==", current.id],
            ]),
            t.where<FallOfWicketsRow>("fall_of_wickets", [
              ["innings_id", "==", current.id],
            ]),
            t.where<PartnershipsRow>("partnerships", [
              ["innings_id", "==", current.id],
            ]),
          ])
        : null;

    const bundle = await loadInningsBundle(t, match, target);

    // ---- writes ----
    if (match.status === "completed") {
      t.patch("matches", matchId, {
        status: "live",
        actual_end_time: null,
        result_type: null,
        result_description: null,
        winning_team_id: null,
        win_margin: null,
        win_margin_type: null,
        player_of_the_match_id: null,
        updated_at: now,
      });
    }

    t.delete("ball_by_ball", last.id);

    if (crossingBoundary && current && staleChildren) {
      for (const group of staleChildren) {
        for (const doc of group) {
          const table =
            group === staleChildren[0]
              ? "batting_performances"
              : group === staleChildren[1]
                ? "bowling_performances"
                : group === staleChildren[2]
                  ? "fall_of_wickets"
                  : "partnerships";
          t.delete(table, doc.id);
        }
      }
      for (const ball of allBalls) {
        if (ball.innings_id === current.id && ball.id !== last.id)
          t.delete("ball_by_ball", ball.id);
      }
      t.delete("innings", current.id);
      t.patch("matches", matchId, {
        current_innings: target.innings_number,
        updated_at: now,
      });
    }

    const remaining = bundle.balls.filter((b) => b.id !== last.id);
    const out = runRecompute({ ...bundle, innings: target }, remaining, now);
    // Removing the ball that closed an innings (or finished the match) reopens
    // that innings so scoring can resume from it.
    if (crossingBoundary || target.is_completed) {
      out.inningsPatch.is_completed = false;
    }
    writeRecompute(t, { ...bundle, innings: target }, out, now);
    return match;
  });

  return finishWithState(ctx, matchId, before);
}

// ---------------------------------------------------------------------------
// update_ball
// ---------------------------------------------------------------------------

export interface UpdateBallArgs {
  p_match_id: string;
  p_ball_id: string;
  p_runs_scored?: number | null;
  p_extras?: number | null;
  p_extra_type?: string | null;
  p_is_wicket?: boolean | null;
  p_dismissal_type?: string | null;
  p_fielder_id?: string | null;
  p_dismissed_player_id?: string | null;
}

export async function updateBall(
  ctx: ScoringContext,
  args: UpdateBallArgs,
): Promise<ScoringState> {
  const matchId = args.p_match_id;
  await requireAdmin(ctx, matchId);

  const extraType = args.p_extra_type ?? null;
  if (extraType && !EXTRA_TYPES.has(extraType))
    throw new DbQueryError("invalid_input", "22000");
  const isWicket = Boolean(args.p_is_wicket);
  if (
    isWicket &&
    args.p_dismissal_type &&
    !DISMISSAL_TYPES.has(args.p_dismissal_type)
  ) {
    throw new DbQueryError("invalid_input", "22000");
  }
  const now = new Date().toISOString();

  const before = await runScoringTransaction(ctx, async (t) => {
    const [match, ball] = await Promise.all([
      t.doc<MatchesRow>("matches", matchId),
      t.doc<BallByBallRow>("ball_by_ball", args.p_ball_id),
    ]);
    if (!match) throw new DbQueryError("match_not_found", "22000");
    if (!ball || ball.match_id !== matchId || !ball.innings_id) {
      throw new DbQueryError("ball_not_found", "22000");
    }
    const innings = await t.doc<InningsRow>("innings", ball.innings_id);
    if (!innings) throw new DbQueryError("ball_not_found", "22000");
    const bundle = await loadInningsBundle(t, match, innings);

    const patch: Partial<BallByBallRow> = {
      runs_scored: args.p_runs_scored ?? 0,
      extras: args.p_extras ?? 0,
      extra_type: extraType,
      is_wicket: isWicket,
      dismissal_type: isWicket ? (args.p_dismissal_type ?? null) : null,
      fielder_id: isWicket ? (args.p_fielder_id ?? null) : null,
      dismissed_player_id: isWicket
        ? (args.p_dismissed_player_id ?? ball.batsman_id ?? null)
        : null,
    };
    t.patch("ball_by_ball", ball.id, patch as Record<string, unknown>);

    const balls = bundle.balls.map((b) =>
      b.id === ball.id ? { ...b, ...patch } : b,
    );
    const out = runRecompute(bundle, balls, now);
    writeRecompute(t, bundle, out, now);
    return match;
  });

  return finishWithState(ctx, matchId, before);
}

// ---------------------------------------------------------------------------
// end_innings
// ---------------------------------------------------------------------------

export async function endInnings(
  ctx: ScoringContext,
  matchId: string,
): Promise<ScoringState> {
  await requireAdmin(ctx, matchId);
  const now = new Date().toISOString();

  const before = await runScoringTransaction(ctx, async (t) => {
    const match = await t.doc<MatchesRow>("matches", matchId);
    if (!match) throw new DbQueryError("match_not_found", "22000");
    const { all, current } = await currentInningsOf(t, match);
    if (!current || current.is_completed)
      throw new DbQueryError("no_open_innings", "22000");
    applyAdvance(t, match, current, all, await teamNamesOf(t, match), now);
    return match;
  });

  return finishWithState(ctx, matchId, before);
}

// ---------------------------------------------------------------------------
// start_super_over
// ---------------------------------------------------------------------------

export async function startSuperOver(
  ctx: ScoringContext,
  matchId: string,
): Promise<ScoringState> {
  await requireAdmin(ctx, matchId);
  const now = new Date().toISOString();

  const before = await runScoringTransaction(ctx, async (t) => {
    const match = await t.doc<MatchesRow>("matches", matchId);
    if (!match) throw new DbQueryError("match_not_found", "22000");
    const { all } = await currentInningsOf(t, match);
    if (all.length === 0) throw new DbQueryError("no_innings_found", "22000");

    const last = all.reduce(
      (m, i) => (i.innings_number > m.innings_number ? i : m),
      all[0]!,
    );
    const nextNumber = last.innings_number + 1;
    const second = all.find((i) => i.innings_number === 2);
    const battingTeam = second?.team_id ?? match.team2_id;

    const innings: InningsRow = {
      id: newId(),
      match_id: matchId,
      team_id: battingTeam,
      innings_number: nextNumber,
      total_runs: 0,
      total_wickets: 0,
      total_overs: 0,
      total_balls: 0,
      extras_total: 0,
      extras_byes: 0,
      extras_leg_byes: 0,
      extras_wides: 0,
      extras_no_balls: 0,
      extras_penalties: 0,
      extras_bonuses: 0,
      is_completed: false,
      target_runs: null,
      created_at: now,
      updated_at: now,
    };
    t.put("innings", innings.id, innings as unknown as Record<string, unknown>);
    t.patch("matches", matchId, {
      status: "live",
      current_innings: nextNumber,
      current_over: 0,
      current_ball: 0,
      winning_team_id: null,
      result_type: null,
      result_description: "Super Over in progress",
      actual_end_time: null,
      updated_at: now,
    });
    return match;
  });

  return finishWithState(ctx, matchId, before);
}

// ---------------------------------------------------------------------------
// recompute_innings (standalone)
// ---------------------------------------------------------------------------

export async function recomputeInningsRpc(
  ctx: ScoringContext,
  inningsId: string,
): Promise<null> {
  const now = new Date().toISOString();
  const matchId = await runScoringTransaction(ctx, async (t) => {
    const innings = await t.doc<InningsRow>("innings", inningsId);
    if (!innings?.match_id) return null;
    const match = await t.doc<MatchesRow>("matches", innings.match_id);
    if (!match) return null;
    const bundle = await loadInningsBundle(t, match, innings);
    const out = runRecompute(bundle, bundle.balls, now);
    writeRecompute(t, bundle, out, now);
    return match.id;
  });
  if (matchId) {
    const match = (await ctx.ds.getById(
      "matches",
      matchId,
    )) as unknown as MatchesRow | null;
    await maybeRecalculateStandings(ctx.ds, match, match);
    await writeLiveState(ctx.ds, matchId, ctx.db);
  }
  return null;
}

// ---------------------------------------------------------------------------
// set_current_batsmen
// ---------------------------------------------------------------------------

export async function setCurrentBatsmen(
  ctx: ScoringContext,
  matchId: string,
  strikerId: string,
  nonStrikerId: string,
): Promise<{ ok: true }> {
  await requireAdmin(ctx, matchId);
  if (strikerId === nonStrikerId)
    throw new DbQueryError("invalid_input", "22000");
  const now = new Date().toISOString();

  await runScoringTransaction(ctx, async (t) => {
    const match = await t.doc<MatchesRow>("matches", matchId);
    if (!match) throw new DbQueryError("match_not_found", "22000");
    const { current } = await currentInningsOf(t, match);
    if (!current) throw new DbQueryError("no_open_innings", "22000");

    const [roster, batting] = await Promise.all([
      t.where<TeamPlayersRow>("team_players", [
        ["team_id", "==", current.team_id],
      ]),
      t.where<BattingPerformancesRow>("batting_performances", [
        ["innings_id", "==", current.id],
      ]),
    ]);
    const rosterIds = new Set(roster.map((r) => r.user_id));
    if (!rosterIds.has(strikerId) || !rosterIds.has(nonStrikerId)) {
      throw new DbQueryError("player_not_in_batting_team", "22000");
    }
    if (
      batting.some(
        (b) =>
          b.is_out && (b.user_id === strikerId || b.user_id === nonStrikerId),
      )
    ) {
      throw new DbQueryError("player_already_out", "22000");
    }
    const distinct = new Set(batting.map((b) => b.user_id));
    const anyExisting = batting.some(
      (b) => b.user_id === strikerId || b.user_id === nonStrikerId,
    );
    if (distinct.size >= 11 && !anyExisting) {
      throw new DbQueryError("too_many_batsmen", "22000");
    }

    let nextPos = batting.reduce(
      (m, b) => Math.max(m, b.batting_position ?? 0),
      0,
    );
    const newcomers = [strikerId, nonStrikerId]
      .filter((id) => !batting.some((b) => b.user_id === id))
      .sort();

    for (const b of batting) {
      const isCurrent = b.user_id === strikerId || b.user_id === nonStrikerId;
      const isStriker = b.user_id === strikerId;
      if (
        Boolean(b.is_current_batsman) === isCurrent &&
        Boolean(b.is_striker) === isStriker
      )
        continue;
      t.patch("batting_performances", b.id, {
        is_current_batsman: isCurrent,
        is_striker: isStriker,
        updated_at: now,
      });
    }
    for (const userId of newcomers) {
      nextPos += 1;
      const row: BattingPerformancesRow = {
        id: `${current.id}_${userId}`,
        match_id: matchId,
        innings_id: current.id,
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
        created_at: now,
        updated_at: now,
      };
      t.put(
        "batting_performances",
        row.id,
        row as unknown as Record<string, unknown>,
      );
    }
  });

  await writeLiveState(ctx.ds, matchId, ctx.db);
  return { ok: true };
}

// ---------------------------------------------------------------------------
// set_current_bowler
// ---------------------------------------------------------------------------

export async function setCurrentBowler(
  ctx: ScoringContext,
  matchId: string,
  bowlerId: string,
): Promise<{ ok: true }> {
  await requireAdmin(ctx, matchId);
  const now = new Date().toISOString();

  await runScoringTransaction(ctx, async (t) => {
    const match = await t.doc<MatchesRow>("matches", matchId);
    if (!match) throw new DbQueryError("match_not_found", "22000");
    const { current } = await currentInningsOf(t, match);
    if (!current) throw new DbQueryError("no_open_innings", "22000");

    const currentOver = match.current_over ?? 0;
    const [batting, bowlerTeams, previousOverBalls, currentBowlers, own] =
      await Promise.all([
        t.where<BattingPerformancesRow>("batting_performances", [
          ["innings_id", "==", current.id],
          ["is_current_batsman", "==", true],
        ]),
        t.where<TeamPlayersRow>("team_players", [["user_id", "==", bowlerId]]),
        currentOver > 0
          ? t.where<BallByBallRow>("ball_by_ball", [
              ["innings_id", "==", current.id],
              ["over_number", "==", currentOver - 1],
              ["bowler_id", "==", bowlerId],
            ])
          : Promise.resolve([]),
        t.where<BowlingPerformancesRow>("bowling_performances", [
          ["innings_id", "==", current.id],
          ["is_current_bowler", "==", true],
        ]),
        t.where<BowlingPerformancesRow>("bowling_performances", [
          ["innings_id", "==", current.id],
          ["user_id", "==", bowlerId],
        ]),
      ]);

    if (batting.some((b) => b.is_current_batsman && b.user_id === bowlerId)) {
      throw new DbQueryError("bowler_is_current_batsman", "22000");
    }
    const battingTeam = current.team_id;
    const bowlingTeam =
      battingTeam === match.team1_id ? match.team2_id : match.team1_id;
    const inBattingTeam = bowlerTeams.some((tp) => tp.team_id === battingTeam);
    const inBowlingTeam = bowlerTeams.some((tp) => tp.team_id === bowlingTeam);
    if (inBattingTeam && !inBowlingTeam) {
      throw new DbQueryError("bowler_in_batting_team", "22000");
    }

    if (previousOverBalls.length > 0) {
      throw new DbQueryError("same_bowler_next_over", "22000");
    }

    // Only rows whose flag flips are written: the bowlers currently flagged
    // and the chosen bowler's own row.
    const existing = own[0];
    const touched = new Map(currentBowlers.map((b) => [b.id, b]));
    for (const b of own) touched.set(b.id, b);
    for (const b of touched.values()) {
      const isCurrent = b.user_id === bowlerId;
      if (Boolean(b.is_current_bowler) === isCurrent) continue;
      t.patch("bowling_performances", b.id, {
        is_current_bowler: isCurrent,
        updated_at: now,
      });
    }
    if (!existing) {
      const row: BowlingPerformancesRow = {
        id: `${current.id}_${bowlerId}`,
        match_id: matchId,
        innings_id: current.id,
        user_id: bowlerId,
        overs_bowled: 0,
        balls_bowled: 0,
        runs_conceded: 0,
        wickets_taken: 0,
        maidens: 0,
        wides: 0,
        no_balls: 0,
        is_current_bowler: true,
        created_at: now,
        updated_at: now,
      };
      t.put(
        "bowling_performances",
        row.id,
        row as unknown as Record<string, unknown>,
      );
    }
  });

  await writeLiveState(ctx.ds, matchId, ctx.db);
  return { ok: true };
}
