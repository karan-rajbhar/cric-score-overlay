/**
 * Scoring engine mutations (server only), ported from the PL/pgSQL
 * functions `record_ball`, `undo_last_ball`, `update_ball`, `end_innings`,
 * `start_super_over`, `recompute_innings`, `set_current_batsmen` and
 * `set_current_bowler`, plus `award_penalty_runs`, `retire_batter` and
 * `reassign_over_bowler` (formerly a ball write followed by a recompute).
 *
 * Each mutation runs inside one Firestore transaction and writes all of its
 * documents together so a crash can never leave half-updated scorecards.
 *
 * Storage (schema stage 2, see `scorecard.ts`): an innings document holds
 * its scorecard (batting / bowling / fall of wickets / partnerships arrays)
 * and the ball log lives in one document per over. The engine works on the
 * legacy row shapes and converts at the storage boundary.
 *
 * `record_ball` applies a normal delivery incrementally (see
 * `scoring/incremental.ts`): it reads the match, the current innings, the
 * current over and `live_state`, and writes those four documents back. Any
 * case it cannot apply exactly falls back to the full recompute of the
 * innings from its ball log, which every history-editing mutation (undo,
 * update, recompute) uses and which remains the source of truth. Only
 * documents whose values changed are written. When the set of completed
 * innings changes, the match's `player_matches` records are updated too,
 * and with them the career / leaderboard statistics (`stats-sync.ts`), in
 * the same transaction. The match's `innings_summary` follows every innings
 * write (`innings-summary.ts`). Every mutation refreshes
 * `live_state/{matchId}` (see `live-state.ts`).
 *
 * New delivery ids name their over document (`newBallId`), so `update_ball`
 * reads that over instead of the match's whole ball log.
 */

import "server-only";
import type { Firestore } from "firebase-admin/firestore";
import type { ScoringState } from "~/app/matches/types";
import type { DataSource } from "../datasource";
import {
  headerFromCache,
  LIVE_STATE_COLLECTION,
  stageLiveState,
  stagedOverIds,
  writeLiveState,
  type LiveStateDoc,
} from "../live-state";
import { DbQueryError, newId } from "../query-builder";
import {
  ballLogOf,
  ballRowsOf,
  ballsPerOverOf,
  battingRowsOf,
  bowlingRowsOf,
  bySeq,
  fallOfWicketRowsOf,
  lastOverBowlerOf,
  newBallId,
  overDocId,
  overDocIdOfBall,
  OVERS_COLLECTION,
  oversOfBalls,
  partnershipRowsOf,
  scorecardFields,
  toBallEntry,
  toBattingEntry,
  toBowlingEntry,
  toFallOfWicketEntry,
  toPartnershipEntry,
  type InningsScorecard,
  type OversRow,
} from "../scorecard";
import {
  applyBallIncrementally,
  startsNewPartnership,
} from "../scoring/incremental";
import {
  penaltyCountsFor,
  recomputeInnings,
  type RecomputeOutput,
} from "../scoring/recompute";
import {
  advanceAfterInnings,
  inningsLimits,
  type AdvanceOutput,
} from "../scoring/result";
import { sameRow } from "../scoring/rows";
import { syncMatchRecords } from "../stats-sync";
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
import {
  liveStateUserIds,
  loadCurrentInnings,
  loadLastBall,
  loadNames,
  loadOverBalls,
} from "../views";
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

const EMPTY_SCORECARD: InningsScorecard = {
  batting: [],
  bowling: [],
  fall_of_wickets: [],
  partnerships: [],
  last_ball: null,
  last_over_bowler_id: null,
};

interface InningsBundle {
  match: WithId<MatchesRow>;
  innings: WithId<InningsRow>;
  /** The innings' over documents as stored. */
  overs: WithId<OversRow>[];
  /** Ball log in `seq` order. */
  balls: BallByBallRow[];
  batting: BattingPerformancesRow[];
  bowling: BowlingPerformancesRow[];
  fallOfWickets: FallOfWicketsRow[];
  partnerships: PartnershipsRow[];
}

function sortBySeq<T extends { seq?: number | null }>(balls: T[]): T[] {
  return [...balls].sort(bySeq);
}

/**
 * Innings documents written before stage 2 carry no scorecard arrays (their
 * rows are still in the legacy collections until migrated). Recomputing
 * from an empty over log would wipe them, so refuse.
 */
function requireScorecard(innings: InningsRow): void {
  if (!Array.isArray(innings.batting) || !Array.isArray(innings.bowling)) {
    throw new DbQueryError("innings_not_migrated", "22000");
  }
}

function bundleOf(
  match: WithId<MatchesRow>,
  innings: WithId<InningsRow>,
  overs: WithId<OversRow>[],
): InningsBundle {
  requireScorecard(innings);
  return {
    match,
    innings,
    overs,
    balls: ballLogOf(overs),
    batting: battingRowsOf(innings),
    bowling: bowlingRowsOf(innings),
    fallOfWickets: fallOfWicketRowsOf(innings),
    partnerships: partnershipRowsOf(innings),
  };
}

async function loadInningsBundle(
  t: ScoringTx,
  match: WithId<MatchesRow>,
  innings: WithId<InningsRow>,
): Promise<InningsBundle> {
  const overs = await t.where<OversRow>(OVERS_COLLECTION, [
    ["innings_id", "==", innings.id],
  ]);
  return bundleOf(match, innings, overs);
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

/** Stage the innings patch unless nothing but timestamps would change. */
function patchInningsIfChanged(
  t: ScoringTx,
  innings: WithId<InningsRow>,
  patch: Partial<InningsRow>,
): void {
  if (!sameRow({ ...innings, ...patch }, innings)) {
    t.patch("innings", innings.id, patch);
  }
}

/** Write the over documents that differ from `loaded`; delete emptied ones. */
function writeOvers(
  t: ScoringTx,
  matchId: string,
  inningsId: string,
  balls: BallByBallRow[],
  loaded: readonly WithId<OversRow>[],
  now: string,
): void {
  const stored = new Map(loaded.map((o) => [o.id, o]));
  for (const over of oversOfBalls(matchId, inningsId, balls, now)) {
    const prev = stored.get(over.id);
    stored.delete(over.id);
    if (!prev || !sameRow(over, prev)) t.put(OVERS_COLLECTION, over.id, over);
  }
  for (const id of stored.keys()) t.delete(OVERS_COLLECTION, id);
}

/** Whether `innings` is the match's current innings. */
function isCurrentInnings(match: MatchesRow, innings: InningsRow): boolean {
  return innings.innings_number === (match.current_innings ?? 1);
}

/**
 * Stage the recompute result (innings scorecard, ball log, match position),
 * writing only documents that changed. Returns the innings as stored after.
 *
 * The match's over / ball position belongs to the current innings: editing
 * an earlier (completed) innings must leave it alone. `current` overrides
 * the check for callers that make this innings the current one in the same
 * transaction (undo across an innings boundary).
 */
function writeRecompute(
  t: ScoringTx,
  bundle: InningsBundle,
  out: RecomputeOutput,
  balls: BallByBallRow[],
  now: string,
  current: boolean = isCurrentInnings(bundle.match, bundle.innings),
): WithId<InningsRow> {
  const sorted = sortBySeq(balls);
  const patch: Partial<InningsRow> = {
    ...out.inningsPatch,
    ...scorecardFields({
      batting: out.batting,
      bowling: out.bowling,
      fallOfWickets: out.fallOfWickets,
      partnerships: out.partnerships,
      balls: sorted,
      totalBalls: out.inningsPatch.total_balls ?? 0,
      ballsPerOver: ballsPerOverOf(bundle.match),
    }),
  };
  patchInningsIfChanged(t, bundle.innings, patch);
  t.patch(
    "matches",
    bundle.match.id,
    current ? { ...out.matchPatch, updated_at: now } : { updated_at: now },
  );
  writeOvers(
    t,
    bundle.innings.match_id ?? bundle.match.id,
    bundle.innings.id,
    sorted,
    bundle.overs,
    now,
  );
  return { ...bundle.innings, ...patch };
}

function replaceInnings(
  all: readonly WithId<InningsRow>[],
  updated: readonly WithId<InningsRow>[],
): WithId<InningsRow>[] {
  const byId = new Map(updated.map((i) => [i.id, i]));
  const out = all.map((i) => byId.get(i.id) ?? i);
  for (const u of updated) if (!all.some((i) => i.id === u.id)) out.push(u);
  return out;
}

/**
 * After an innings' scorecard changed outside the fast path: refresh the
 * player records when that innings is (or was) a completed one.
 */
async function syncIfCompleted(
  t: ScoringTx,
  match: WithId<MatchesRow>,
  before: WithId<InningsRow>,
  after: WithId<InningsRow>,
  now: string,
  all?: WithId<InningsRow>[],
): Promise<void> {
  if (!before.is_completed && !after.is_completed) return;
  const innings =
    all ??
    (await t.where<InningsRow>("innings", [["match_id", "==", match.id]]));
  await syncMatchRecords(
    t,
    match.id,
    match,
    replaceInnings(innings, [after]),
    now,
  );
}

interface AppliedAdvance extends AdvanceOutput {
  /** The next innings as written (with any carried penalty runs). */
  nextInningsDoc: WithId<InningsRow> | null;
  /** Its ball log: the carried penalty events, if any. */
  nextBalls: BallByBallRow[];
}

/**
 * Write the new innings, starting with copies of the penalty events awarded
 * to its batting side while they were fielding and had not batted yet
 * (Law 41.17: credited to their next innings).
 */
function openNextInnings(
  t: ScoringTx,
  match: MatchesRow,
  next: InningsRow,
  completedBalls: readonly BallByBallRow[],
  now: string,
): { doc: WithId<InningsRow>; balls: BallByBallRow[] } {
  const carried: BallByBallRow[] = completedBalls
    .filter((b) => penaltyCountsFor(b, next))
    .map((b) => ({
      ...b,
      id: newBallId(next.id, 0, newId()),
      innings_id: next.id,
      over_number: 0,
      ball_number: 1,
      created_at: now,
    }));
  let doc: WithId<InningsRow> = { ...next, ...EMPTY_SCORECARD };
  if (carried.length) {
    const out = recomputeInnings({
      match,
      innings: next,
      balls: carried,
      existingBatting: [],
      existingBowling: [],
      now,
    });
    doc = {
      ...doc,
      ...out.inningsPatch,
      ...scorecardFields({
        batting: out.batting,
        bowling: out.bowling,
        fallOfWickets: out.fallOfWickets,
        partnerships: out.partnerships,
        balls: carried,
        totalBalls: 0,
        ballsPerOver: ballsPerOverOf(match),
      }),
    };
    writeOvers(t, next.match_id ?? match.id, next.id, carried, [], now);
  }
  t.put("innings", next.id, doc);
  return { doc, balls: carried };
}

/**
 * Close `completed` and open the next innings or finish the match.
 * `completedBalls` is the closed innings' ball log when already loaded;
 * otherwise it is read only when a next innings starts (to carry penalty
 * runs awarded to its batting side).
 */
async function applyAdvance(
  t: ScoringTx,
  match: MatchesRow,
  completed: WithId<InningsRow>,
  allInnings: WithId<InningsRow>[],
  teamNames: Record<string, string | undefined>,
  now: string,
  completedBalls?: readonly BallByBallRow[],
): Promise<AppliedAdvance> {
  const out = advanceAfterInnings(
    { match, completed, allInnings, teamNames, now },
    newId(),
  );
  t.patch("innings", completed.id, out.completedInningsPatch);
  t.patch("matches", match.id, out.matchPatch);
  let nextInningsDoc: WithId<InningsRow> | null = null;
  let nextBalls: BallByBallRow[] = [];
  if (out.nextInnings) {
    const balls =
      completedBalls ??
      ballLogOf(
        await t.where<OversRow>(OVERS_COLLECTION, [
          ["innings_id", "==", completed.id],
        ]),
      );
    const opened = openNextInnings(t, match, out.nextInnings, balls, now);
    nextInningsDoc = opened.doc;
    nextBalls = opened.balls;
  }
  // The completed innings joins the player records (and statistics).
  await syncMatchRecords(
    t,
    match.id,
    match,
    replaceInnings(allInnings, [
      { ...completed, ...out.completedInningsPatch },
    ]),
    now,
  );
  return { ...out, nextInningsDoc, nextBalls };
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

/**
 * {@link runScoringTransaction}, also returning the ids of the `overs`
 * documents the committed attempt wrote (for `live_state.overs_changed`).
 */
async function runTracked<R>(
  ctx: ScoringContext,
  fn: (t: ScoringTx) => Promise<R>,
): Promise<[R, string[]]> {
  let overs: string[] = [];
  const result = await runScoringTransaction(ctx, async (t) => {
    const out = await fn(t);
    overs = stagedOverIds(t);
    return out;
  });
  return [result, overs];
}

async function finishWithState(
  ctx: ScoringContext,
  matchId: string,
  before: MatchesRow | null,
  overs: string[],
): Promise<ScoringState> {
  const after = (await ctx.ds.getById(
    "matches",
    matchId,
  )) as unknown as MatchesRow | null;
  await maybeRecalculateStandings(ctx.ds, before, after);
  await writeLiveState(ctx.ds, matchId, ctx.db, overs);
  return recordState(ctx.ds, matchId, after);
}

/** After a mutation that returns nothing: standings + live_state. */
async function finishQuietly(
  ctx: ScoringContext,
  matchId: string,
  before: MatchesRow | null,
  overs: string[],
): Promise<void> {
  const after = (await ctx.ds.getById(
    "matches",
    matchId,
  )) as unknown as MatchesRow | null;
  await maybeRecalculateStandings(ctx.ds, before, after);
  await writeLiveState(ctx.ds, matchId, ctx.db, overs);
}

/**
 * Stage `live_state` for a mutation that changed only the current
 * innings' scorecard flags (crease / bowler), from the documents already
 * read in the transaction: reads the previous live doc and the current over.
 */
async function stageCurrentLiveState(
  t: ScoringTx,
  match: WithId<MatchesRow>,
  innings: WithId<InningsRow>,
  now: string,
): Promise<void> {
  const bpo = inningsLimits(match, innings.innings_number).ballsPerOver;
  const overNumber = Math.floor((innings.total_balls ?? 0) / bpo);
  const [prevLive, thisOver, lastBall] = await Promise.all([
    t.doc<LiveStateDoc>(LIVE_STATE_COLLECTION, match.id),
    loadOverBalls(t, innings.id, overNumber),
    loadLastBall(t, innings),
  ]);
  const batting = battingRowsOf(innings).filter(
    (b) => b.is_current_batsman === true,
  );
  await stageLiveState(
    t,
    {
      match,
      innings,
      striker: batting.find((b) => b.is_striker) ?? null,
      nonStriker: batting.find((b) => !b.is_striker) ?? null,
      bowler:
        bowlingRowsOf(innings).find((b) => b.is_current_bowler === true) ??
        null,
      partnership:
        partnershipRowsOf(innings).find((p) => p.is_current === true) ?? null,
      thisOver,
      lastBall,
    },
    prevLive,
    now,
  );
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
  const overNumber = Math.floor(totalBalls / bpo);
  return {
    id: newBallId(innings.id, overNumber, newId()),
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

/** Whether the innings document carries the stage 2 scorecard fields. */
function hasScorecard(innings: InningsRow): boolean {
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
function upsertByUser<E extends { user_id: string }>(
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

interface RecordOutcome {
  before: MatchesRow;
  /** Set by the incremental path, which also builds the state in the tx. */
  after: MatchesRow | null;
  state: ScoringState | null;
}

/**
 * Fast path: apply this delivery to the running totals held by the current
 * innings document. Reads the match (already read by the caller), the
 * innings, the current over document and `live_state`; writes the same
 * four. Returns null when the ball must go through a full recompute
 * instead (including every validation failure, so the full path raises the
 * usual error).
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
  if (!innings || innings.is_completed || !hasScorecard(innings)) return null;

  const bpo = ballsPerOverOf(match);
  const overNumber = Math.floor((innings.total_balls ?? 0) / bpo);
  const [overDoc, prevLive] = await Promise.all([
    t.doc<OversRow>(OVERS_COLLECTION, overDocId(innings.id, overNumber)),
    t.doc<LiveStateDoc>(LIVE_STATE_COLLECTION, match.id),
  ]);

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

  const sortedOver = overDoc ? sortBySeq(ballRowsOf(overDoc)) : [];
  const maxOverSeq = sortedOver.length
    ? (sortedOver[sortedOver.length - 1]!.seq ?? 0)
    : 0;
  const seq = Math.max(match.last_ball_seq, maxOverSeq) + 1;
  const ball = newBall(args, checked, innings, bpo, seq, now);

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

  // ---- writes (buffered until the callback returns) ----
  const overBalls = [...sortedOver, ball];
  t.put(OVERS_COLLECTION, overDocId(innings.id, overNumber), {
    match_id: innings.match_id ?? match.id,
    innings_id: innings.id,
    over_number: overNumber,
    balls: overBalls.map(toBallEntry),
    updated_at: now,
  } satisfies Omit<OversRow, "id">);

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
  };
  patchInningsIfChanged(t, innings, inningsPatch);
  const matchPatch: Partial<MatchesRow> = {
    ...out.matchPatch,
    last_ball_seq: seq,
    updated_at: now,
  };
  t.patch("matches", match.id, matchPatch);
  const batting = out.batting;
  const partnershipsAfter = out.partnerships;
  const bowlerAfter = out.bowling[0]!;

  // ---- innings / match completion ----
  let matchAfter: MatchesRow = { ...match, ...matchPatch };
  let inningsAfter: WithId<InningsRow> = { ...innings, ...inningsPatch };
  let header: Awaited<ReturnType<typeof headerFromCache>> | undefined;
  let advance: AppliedAdvance | null = null;
  if (inningsComplete(match, inningsAfter)) {
    const all = await t.where<InningsRow>("innings", [
      ["match_id", "==", match.id],
    ]);
    header = await headerFromCache(t, match, prevLive);
    const teamNames: Record<string, string | undefined> = {};
    for (const [id, team] of header.teams)
      teamNames[id] = team.name ?? undefined;
    advance = await applyAdvance(
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
  const nextInnings = advance?.nextInningsDoc ?? null;
  const currentInnings: InningsRow = nextInnings ?? inningsAfter;
  const sameInnings = !nextInnings;
  const curStriker = sameInnings
    ? (batting.find((b) => b.is_current_batsman && b.is_striker) ?? null)
    : null;
  const curNonStriker = sameInnings
    ? (batting.find((b) => b.is_current_batsman && !b.is_striker) ?? null)
    : null;
  const curBowler =
    sameInnings && bowlerAfter.is_current_bowler ? bowlerAfter : null;
  const curPartnership = sameInnings
    ? (partnershipsAfter.find((p) => p.is_current) ?? null)
    : null;
  const thisOverNumber = Math.floor((currentInnings.total_balls ?? 0) / bpo);
  // A new innings starts with nothing but any carried penalty events.
  const nextBalls = advance?.nextBalls ?? [];
  const thisOver = sameInnings
    ? thisOverNumber === overNumber
      ? overBalls
      : []
    : nextBalls;
  const lastBall = sameInnings ? ball : (nextBalls.at(-1) ?? null);

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
    findLastOverBowler(t, currentInnings, bpo, lastBall),
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

  const bpo = ballsPerOverOf(match);
  const maxSeq = bundle.balls.reduce((m, b) => Math.max(m, b.seq ?? 0), 0);
  const seq = Math.max(match.last_ball_seq ?? 0, maxSeq) + 1;
  const ball = newBall(args, checked, innings, bpo, seq, now);
  const balls = [...bundle.balls, ball];

  const out = runRecompute(bundle, balls, now);
  const updatedInnings = writeRecompute(t, bundle, out, balls, now);
  t.patch("matches", matchId, { last_ball_seq: seq });

  if (inningsComplete(match, updatedInnings)) {
    await applyAdvance(
      t,
      { ...match, ...out.matchPatch },
      updatedInnings,
      all.map((i) => (i.id === innings.id ? updatedInnings : i)),
      await teamNamesOf(t, match),
      now,
      balls,
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
  const [outcome, overs] = await runTracked(ctx, async (t) => {
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
    state = await finishWithState(ctx, matchId, before, overs);
  }
  if (state.current_innings !== (before.current_innings ?? 1)) {
    state.innings_break = true;
  }
  return state;
}

// ---------------------------------------------------------------------------
// undo_last_ball
// ---------------------------------------------------------------------------

/** The innings' last ball (its cache, or its over documents). */
async function lastBallIn(
  t: ScoringTx,
  innings: WithId<InningsRow>,
): Promise<BallByBallRow | null> {
  return loadLastBall(t, innings);
}

export async function undoLastBall(
  ctx: ScoringContext,
  matchId: string,
): Promise<ScoringState> {
  await requireAdmin(ctx, matchId);
  const now = new Date().toISOString();

  const [before, overs] = await runTracked(ctx, async (t) => {
    const match = await t.doc<MatchesRow>("matches", matchId);
    if (!match) throw new DbQueryError("match_not_found", "22000");

    const { all, current } = await currentInningsOf(t, match);
    // The match's last ball: the highest `seq` across its innings. A penalty
    // event carried into the next innings keeps its original `seq`; on a
    // tie the original (earlier innings) wins, so undoing it reopens that
    // innings and drops the copy with the innings that followed.
    let last: BallByBallRow | null = null;
    let lastInnings = Infinity;
    for (const inn of all) {
      const candidate = await lastBallIn(t, inn);
      if (!candidate) continue;
      const seq = candidate.seq ?? 0;
      const best = last?.seq ?? 0;
      if (
        !last ||
        seq > best ||
        (seq === best && inn.innings_number < lastInnings)
      ) {
        last = candidate;
        lastInnings = inn.innings_number;
      }
    }
    if (!last || !last.innings_id)
      throw new DbQueryError("nothing_to_undo", "22000");
    const target = all.find((i) => i.id === last.innings_id);
    if (!target) throw new DbQueryError("nothing_to_undo", "22000");

    // Penalty runs awarded to the fielding side after their own innings
    // (Law 41.17) live in that earlier innings: undoing them removes the
    // event and gives back the runs added to the current target, without
    // reopening that innings.
    if (current && current.id !== target.id && penaltyCountsFor(last, target)) {
      const bundle = await loadInningsBundle(t, match, target);
      const remaining = bundle.balls.filter((b) => b.id !== last.id);
      const out = runRecompute(bundle, remaining, now);
      const targetAfter = writeRecompute(t, bundle, out, remaining, now);
      if (current.target_runs !== null && current.target_runs !== undefined) {
        t.patch("innings", current.id, {
          target_runs: Math.max(
            1,
            current.target_runs -
              ((last.runs_scored ?? 0) + (last.extras ?? 0)),
          ),
          updated_at: now,
        });
      }
      await syncIfCompleted(t, match, target, targetAfter, now, all);
      return match;
    }

    const crossingBoundary = current !== null && current.id !== last.innings_id;
    const [bundle, staleOvers] = await Promise.all([
      loadInningsBundle(t, match, target),
      crossingBoundary && current
        ? t.where<OversRow>(OVERS_COLLECTION, [
            ["innings_id", "==", current.id],
          ])
        : Promise.resolve([] as WithId<OversRow>[]),
    ]);

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

    if (crossingBoundary && current) {
      // The innings the undone ball closed is reopened; the one that
      // followed it (and its scorecard) goes.
      for (const over of staleOvers) t.delete(OVERS_COLLECTION, over.id);
      t.delete("innings", current.id);
      t.patch("matches", matchId, {
        current_innings: target.innings_number,
        updated_at: now,
      });
    }

    const remaining = bundle.balls.filter((b) => b.id !== last.id);
    const out = runRecompute(bundle, remaining, now);
    // Removing the ball that closed an innings (or finished the match) reopens
    // that innings so scoring can resume from it.
    if (crossingBoundary || target.is_completed) {
      out.inningsPatch.is_completed = false;
    }
    // The innings holding the match's last ball is (or becomes) current.
    const targetAfter = writeRecompute(t, bundle, out, remaining, now, true);

    if (target.is_completed || (crossingBoundary && current?.is_completed)) {
      const after = replaceInnings(
        all.filter((i) => !(crossingBoundary && i.id === current?.id)),
        [targetAfter],
      );
      await syncMatchRecords(t, matchId, match, after, now);
    }
    return match;
  });

  return finishWithState(ctx, matchId, before, overs);
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
  /** Re-assign the delivery to another striker / bowler. */
  p_batsman_id?: string | null;
  p_bowler_id?: string | null;
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

  const [before, overs] = await runTracked(ctx, async (t) => {
    // New ball ids name their over document (1 read); older ones are
    // found by reading the match's ball log (one document per over).
    const hinted = overDocIdOfBall(args.p_ball_id);
    const [match, hintedOver] = await Promise.all([
      t.doc<MatchesRow>("matches", matchId),
      hinted
        ? t.doc<OversRow>(OVERS_COLLECTION, hinted)
        : Promise.resolve(null),
    ]);
    if (!match) throw new DbQueryError("match_not_found", "22000");
    const holds = (o: OversRow | null): o is WithId<OversRow> =>
      !!o &&
      o.match_id === matchId &&
      (o.balls ?? []).some((b) => b.id === args.p_ball_id);
    const matchOvers = holds(hintedOver)
      ? null
      : await t.where<OversRow>(OVERS_COLLECTION, [
          ["match_id", "==", matchId],
        ]);
    const over = holds(hintedOver)
      ? hintedOver
      : (matchOvers ?? []).find(holds);
    const found = over
      ? ballRowsOf(over).find((b) => b.id === args.p_ball_id)
      : undefined;
    if (!over || !found || !found.innings_id) {
      throw new DbQueryError("ball_not_found", "22000");
    }
    const ball: BallByBallRow = {
      ...found,
      ...(args.p_batsman_id ? { batsman_id: args.p_batsman_id } : {}),
      ...(args.p_bowler_id ? { bowler_id: args.p_bowler_id } : {}),
    };
    const innings = await t.doc<InningsRow>("innings", over.innings_id);
    if (!innings) throw new DbQueryError("ball_not_found", "22000");
    const bundle = matchOvers
      ? bundleOf(
          match,
          innings,
          matchOvers.filter((o) => o.innings_id === innings.id),
        )
      : await loadInningsBundle(t, match, innings);

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
    const balls = bundle.balls.map((b) =>
      b.id === ball.id ? { ...ball, ...patch } : b,
    );
    const out = runRecompute(bundle, balls, now);
    const after = writeRecompute(t, bundle, out, balls, now);
    await syncIfCompleted(t, match, innings, after, now);
    return match;
  });

  return finishWithState(ctx, matchId, before, overs);
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

  const [before, overs] = await runTracked(ctx, async (t) => {
    const match = await t.doc<MatchesRow>("matches", matchId);
    if (!match) throw new DbQueryError("match_not_found", "22000");
    const { all, current } = await currentInningsOf(t, match);
    if (!current || current.is_completed)
      throw new DbQueryError("no_open_innings", "22000");
    await applyAdvance(
      t,
      match,
      current,
      all,
      await teamNamesOf(t, match),
      now,
    );
    return match;
  });

  return finishWithState(ctx, matchId, before, overs);
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

  const [before, overs] = await runTracked(ctx, async (t) => {
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
      ...EMPTY_SCORECARD,
      created_at: now,
      updated_at: now,
    };
    t.put("innings", innings.id, innings);
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

  return finishWithState(ctx, matchId, before, overs);
}

// ---------------------------------------------------------------------------
// recompute_innings (standalone)
// ---------------------------------------------------------------------------

export async function recomputeInningsRpc(
  ctx: ScoringContext,
  inningsId: string,
): Promise<null> {
  const now = new Date().toISOString();
  const [before, overs] = await runTracked(ctx, async (t) => {
    const innings = await t.doc<InningsRow>("innings", inningsId);
    if (!innings?.match_id) return null;
    const match = await t.doc<MatchesRow>("matches", innings.match_id);
    if (!match) return null;
    const bundle = await loadInningsBundle(t, match, innings);
    const out = runRecompute(bundle, bundle.balls, now);
    const after = writeRecompute(t, bundle, out, bundle.balls, now);
    await syncIfCompleted(t, match, innings, after, now);
    return match;
  });
  if (before) await finishQuietly(ctx, before.id, before, overs);
  return null;
}

// ---------------------------------------------------------------------------
// Ball-log edits outside record_ball: penalties, retirements, re-assigning
// the current over's bowler. Each appends to / edits the ball log and
// recomputes the innings, without the innings-completion check (as before).
// ---------------------------------------------------------------------------

async function editCurrentInnings(
  ctx: ScoringContext,
  matchId: string,
  edit: (input: {
    match: WithId<MatchesRow>;
    innings: WithId<InningsRow>;
    bundle: InningsBundle;
    now: string;
  }) => { balls: BallByBallRow[]; matchPatch?: Partial<MatchesRow> },
): Promise<null> {
  const now = new Date().toISOString();
  const [before, overs] = await runTracked(ctx, async (t) => {
    const match = await t.doc<MatchesRow>("matches", matchId);
    await requireAdminOf(ctx, matchId, match);
    if (!match) throw new DbQueryError("match_not_found", "22000");
    const innings = (await loadCurrentInnings(
      t,
      match,
    )) as WithId<InningsRow> | null;
    if (!innings) throw new DbQueryError("no_open_innings", "22000");
    const bundle = await loadInningsBundle(t, match, innings);
    const { balls, matchPatch } = edit({ match, innings, bundle, now });
    const out = runRecompute(bundle, balls, now);
    const after = writeRecompute(t, bundle, out, balls, now);
    if (matchPatch) t.patch("matches", matchId, matchPatch);
    await syncIfCompleted(t, match, innings, after, now);
    return match;
  });
  await finishQuietly(ctx, matchId, before, overs);
  return null;
}

/** A logged event in the current over (not a delivery). */
function eventBall(
  match: MatchesRow,
  innings: InningsRow,
  fields: Partial<BallByBallRow>,
  now: string,
): BallByBallRow {
  const overNumber = match.current_over ?? 0;
  return {
    id: newBallId(innings.id, overNumber, newId()),
    match_id: match.id,
    innings_id: innings.id,
    over_number: overNumber,
    ball_number: Math.min(20, Math.max(1, (match.current_ball ?? 0) + 1)),
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
    seq: (match.last_ball_seq ?? 0) + 1,
    created_at: now,
    ...fields,
  };
}

/**
 * Penalty runs to the fielding side (Law 41.17), logged in the ball log as
 * an event carrying `penalty_team_id`:
 *
 * - when that team has already batted, in its most recent innings, whose
 *   total goes up (and with it the current target, by the same runs);
 * - otherwise in the current innings, where it adds nothing; starting that
 *   team's innings carries it into their ball log (see `openNextInnings`).
 *
 * Undo removes the event like any other last ball.
 */
async function awardToFieldingSide(
  ctx: ScoringContext,
  args: { p_match_id: string; p_runs: number; p_team_id: string },
  type: "penalty" | "bonus",
  reason: string | null,
): Promise<null> {
  const matchId = args.p_match_id;
  const now = new Date().toISOString();
  const [before, overs] = await runTracked(ctx, async (t) => {
    const match = await t.doc<MatchesRow>("matches", matchId);
    await requireAdminOf(ctx, matchId, match);
    if (!match) throw new DbQueryError("match_not_found", "22000");
    if (args.p_team_id !== match.team1_id && args.p_team_id !== match.team2_id)
      throw new DbQueryError("invalid_input", "22000");
    const { all, current } = await currentInningsOf(t, match);
    if (!current || current.is_completed)
      throw new DbQueryError("no_open_innings", "22000");
    if (current.team_id === args.p_team_id)
      throw new DbQueryError("invalid_input", "22000");

    const theirs = all
      .filter(
        (i) =>
          i.team_id === args.p_team_id &&
          i.innings_number < current.innings_number,
      )
      .sort((a, b) => b.innings_number - a.innings_number)[0];
    const inningsOf = theirs ?? current;
    const bundle = await loadInningsBundle(t, match, inningsOf);
    const lastLogged = bundle.balls.at(-1);
    const seq =
      Math.max(
        match.last_ball_seq ?? 0,
        bundle.balls.reduce((m, b) => Math.max(m, b.seq ?? 0), 0),
      ) + 1;
    const position = theirs
      ? {
          over: lastLogged?.over_number ?? 0,
          ball: lastLogged?.ball_number ?? 1,
        }
      : {
          over: match.current_over ?? 0,
          ball: Math.min(20, Math.max(1, (match.current_ball ?? 0) + 1)),
        };
    const event: BallByBallRow = {
      ...eventBall(match, inningsOf, {}, now),
      id: newBallId(inningsOf.id, position.over, newId()),
      over_number: position.over,
      ball_number: position.ball,
      extras: args.p_runs,
      extra_type: type,
      penalty_team_id: args.p_team_id,
      seq,
      commentary: `${type === "bonus" ? "Bonus" : "Penalty"}: +${args.p_runs} runs awarded to fielding team (${reason ?? ""})`,
    };
    const balls = [...bundle.balls, event];
    const out = runRecompute(bundle, balls, now);
    const inningsAfter = writeRecompute(t, bundle, out, balls, now);
    t.patch("matches", matchId, { last_ball_seq: seq, updated_at: now });
    if (
      theirs &&
      current.target_runs !== null &&
      current.target_runs !== undefined
    ) {
      t.patch("innings", current.id, {
        target_runs: current.target_runs + args.p_runs,
        updated_at: now,
      });
    }
    await syncIfCompleted(t, match, inningsOf, inningsAfter, now, all);
    return match;
  });
  await finishQuietly(ctx, matchId, before, overs);
  return null;
}

/**
 * Penalty / bonus runs. To the batting side (default) they are logged at
 * the current crease; with `p_team_id` naming the fielding side, see
 * {@link awardToFieldingSide}.
 */
export async function awardPenaltyRuns(
  ctx: ScoringContext,
  args: {
    p_match_id: string;
    p_runs: number;
    p_type: string;
    p_reason?: string | null;
    p_team_id?: string | null;
  },
): Promise<null> {
  const type = args.p_type === "bonus" ? "bonus" : "penalty";
  if (!Number.isFinite(args.p_runs) || args.p_runs <= 0)
    throw new DbQueryError("invalid_input", "22000");
  if (args.p_team_id) {
    const match = (await ctx.ds.getById(
      "matches",
      args.p_match_id,
    )) as unknown as MatchesRow | null;
    const current = match
      ? ((await loadCurrentInnings(ctx.ds, match)) as InningsRow | null)
      : null;
    if (current && current.team_id !== args.p_team_id) {
      return awardToFieldingSide(
        ctx,
        {
          p_match_id: args.p_match_id,
          p_runs: args.p_runs,
          p_team_id: args.p_team_id,
        },
        type,
        args.p_reason ?? null,
      );
    }
  }
  return editCurrentInnings(
    ctx,
    args.p_match_id,
    ({ match, innings, bundle, now }) => {
      const striker = bundle.batting.find((b) => b.is_striker === true);
      const nonStriker = bundle.batting.find(
        (b) => b.is_current_batsman === true && b.is_striker === false,
      );
      const bowler = bundle.bowling.find((b) => b.is_current_bowler === true);
      const ball = eventBall(
        match,
        innings,
        {
          bowler_id: bowler?.user_id ?? null,
          batsman_id: striker?.user_id ?? null,
          non_striker_id: nonStriker?.user_id ?? null,
          extras: args.p_runs,
          extra_type: type,
          commentary: `${type === "bonus" ? "Bonus" : "Penalty"}: +${args.p_runs} runs awarded to batting team (${args.p_reason ?? ""})`,
        },
        now,
      );
      return {
        balls: [...bundle.balls, ball],
        matchPatch: { last_ball_seq: ball.seq },
      };
    },
  );
}

/** Retire a batter (hurt: not out; out: a wicket), logged in the ball log. */
export async function retireBatter(
  ctx: ScoringContext,
  args: {
    p_match_id: string;
    p_player_id: string;
    p_type: string;
    p_reason?: string | null;
  },
): Promise<null> {
  const type = args.p_type;
  if (type !== "retired_hurt" && type !== "retired_out")
    throw new DbQueryError("invalid_input", "22000");
  return editCurrentInnings(
    ctx,
    args.p_match_id,
    ({ match, innings, bundle, now }) => {
      const ball = eventBall(
        match,
        innings,
        {
          batsman_id: args.p_player_id,
          is_wicket: true,
          dismissal_type: type,
          dismissed_player_id: args.p_player_id,
          commentary: `Player ${type === "retired_hurt" ? "retired hurt" : "retired out"}${args.p_reason ? `: ${args.p_reason}` : ""}`,
        },
        now,
      );
      return {
        balls: [...bundle.balls, ball],
        matchPatch: { last_ball_seq: ball.seq },
      };
    },
  );
}

/** Credit every ball of the current over to another bowler. */
export async function reassignOverBowler(
  ctx: ScoringContext,
  args: { p_match_id: string; p_bowler_id: string },
): Promise<null> {
  return editCurrentInnings(ctx, args.p_match_id, ({ match, bundle }) => ({
    balls: bundle.balls.map((b) =>
      b.over_number === match.current_over
        ? { ...b, bowler_id: args.p_bowler_id }
        : b,
    ),
  }));
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
  const now = new Date().toISOString();

  await runScoringTransaction(ctx, async (t) => {
    const match = await t.doc<MatchesRow>("matches", matchId);
    await requireAdminOf(ctx, matchId, match);
    if (strikerId === nonStrikerId)
      throw new DbQueryError("invalid_input", "22000");
    if (!match) throw new DbQueryError("match_not_found", "22000");
    const current = (await loadCurrentInnings(
      t,
      match,
    )) as WithId<InningsRow> | null;
    if (!current) throw new DbQueryError("no_open_innings", "22000");
    requireScorecard(current);

    const roster = await t.where<TeamPlayersRow>("team_players", [
      ["team_id", "==", current.team_id],
      ["user_id", "in", [strikerId, nonStrikerId]],
    ]);
    const batting = current.batting ?? [];
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
    if (!changed) return;
    t.patch("innings", current.id, { batting: next });
    await stageCurrentLiveState(t, match, { ...current, batting: next }, now);
  });

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
  const now = new Date().toISOString();

  await runScoringTransaction(ctx, async (t) => {
    const match = await t.doc<MatchesRow>("matches", matchId);
    await requireAdminOf(ctx, matchId, match);
    if (!match) throw new DbQueryError("match_not_found", "22000");
    const current = (await loadCurrentInnings(
      t,
      match,
    )) as WithId<InningsRow> | null;
    if (!current) throw new DbQueryError("no_open_innings", "22000");
    requireScorecard(current);

    const currentOver = match.current_over ?? 0;
    const [bowlerTeams, previousOver] = await Promise.all([
      t.where<TeamPlayersRow>("team_players", [["user_id", "==", bowlerId]]),
      currentOver > 0
        ? loadOverBalls(t, current.id, currentOver - 1)
        : Promise.resolve([] as BallByBallRow[]),
    ]);

    if (
      (current.batting ?? []).some(
        (b) => b.is_current_batsman === true && b.user_id === bowlerId,
      )
    ) {
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

    if (previousOver.some((b) => b.bowler_id === bowlerId)) {
      throw new DbQueryError("same_bowler_next_over", "22000");
    }

    // Only entries whose flag flips change: the bowlers currently flagged
    // and the chosen bowler's own entry.
    const bowling = current.bowling ?? [];
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
    if (!changed) return;
    t.patch("innings", current.id, { bowling: next });
    await stageCurrentLiveState(t, match, { ...current, bowling: next }, now);
  });

  return { ok: true };
}
