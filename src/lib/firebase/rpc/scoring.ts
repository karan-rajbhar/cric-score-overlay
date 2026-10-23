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
 * current over, `live_state` and `live_scorecard`, and writes all but the
 * match back. Any case it cannot apply exactly falls back to the full
 * recompute of the innings from its ball log, which every history-editing
 * mutation (undo, update, recompute) uses and which remains the source of
 * truth. Only documents whose values changed are written. When the set of
 * completed innings changes, the match's `player_matches` records are
 * updated too, and with them the career / leaderboard statistics
 * (`stats-sync.ts`), in the same transaction. The match's `innings_summary`
 * follows every innings write that is not a live innings' running total
 * (`innings-summary.ts`). Every mutation refreshes `live_state/{matchId}`
 * (see `live-state.ts`).
 *
 * The match document is written only by structural changes (status,
 * innings change, result, settings). What changes with every ball lives on
 * the current innings: the ball `seq` counter (`last_ball_seq`), the client
 * action ids it applied (`recent_client_actions`) and the position, which
 * is derived from its `total_balls` (`~/lib/match-position`); older
 * matches keep the first two on the match, and readers take both.
 *
 * New delivery ids name their over document (`newBallId`), so `update_ball`
 * reads that over instead of the match's whole ball log.
 */

import "server-only";
import type { Firestore } from "firebase-admin/firestore";
import type { ScoringState } from "~/app/matches/types";
import type { ScoringDelta } from "~/lib/scoring-delta";
import type { DataSource } from "../datasource";
import {
  headerFromCache,
  LIVE_STATE_COLLECTION,
  stageLiveState,
  stagedIds,
  stagedOverIds,
  writeLiveState,
  type LiveStateDoc,
  type LiveStateLastChange,
} from "../live-state";
import { DbQueryError, newId } from "../query-builder";
import { matchPositionOf, positionOf } from "~/lib/match-position";
import {
  ballLogOf,
  ballRowsOf,
  ballsPerOverOf,
  battingRowsOf,
  bowlingRowsOf,
  bySeq,
  carriedPenaltiesOf,
  fallOfWicketRowsOf,
  lastBallRowOf,
  newBallId,
  overDocId,
  overDocIdOfBall,
  OVERS_COLLECTION,
  oversOfBalls,
  partnershipRowsOf,
  scorecardFields,
  seqCounterOf,
  type InningsScorecard,
  type OversRow,
} from "../scorecard";
import {
  ballDocsAfter,
  battingWithCrease,
  bowlingWithBowler,
  canApplyIncrementally,
  checkBallArgs as checkBall,
  DISMISSAL_TYPES,
  EXTRA_TYPES,
  inningsComplete,
  newBall,
  newEventBall,
  penaltyFields,
  retirementFields,
  noBallRunsOf,
  type CheckedBall,
  type RecordBallArgs,
} from "../scoring/ball-docs";
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
import { HIDDEN_COLUMNS } from "../schema";
import { isMatchAdmin } from "./auth-helpers";
import { maybeRecalculateStandings } from "./standings";
import {
  composeScoringState,
  findLastOverBowler,
  recordState,
  scoringStateUserIds,
} from "./state";

export type { RecordBallArgs };

export interface ScoringContext {
  /** Admin Firestore. Without it mutations run on `ds` (tests only). */
  db?: Firestore | null;
  ds: DataSource;
  uid: string | null;
  /** Apply plain deliveries incrementally (default). Tests turn it off. */
  incremental?: boolean;
  /**
   * Idempotency key of the client action behind this call (the offline
   * queue's id). An action the match has already applied is not applied
   * again; see {@link guardClientAction}.
   */
  clientActionId?: string | null;
  /** The caller's display name, for `live_state.last_change`. */
  scorerName?: string | null;
  /**
   * When set, receives the match's documents as committed (see
   * {@link scoringDeltaOf}), so the scoring screen can update itself from
   * the reply instead of re-reading its state.
   */
  delta?: { matchId: string; value: ScoringDelta | null };
}

/**
 * The scoring documents a transaction leaves behind for `matchId`: the
 * match, and every innings / over document it writes, as stored after the
 * commit. Null when one of them cannot be known without a read (deleted,
 * or merged into a document the transaction never read).
 */
export function scoringDeltaOf(
  t: ScoringTx,
  matchId: string,
): ScoringDelta | null {
  const stored = t.docAfter("matches", matchId);
  if (!stored) return null;
  // As `select("*")` returns it: no storage-only fields.
  const match: Record<string, unknown> = { ...stored };
  for (const c of HIDDEN_COLUMNS.matches ?? []) delete match[c];
  const innings: ScoringDelta["innings"] = [];
  const overs: ScoringDelta["overs"] = [];
  for (const w of t.pendingWrites()) {
    if (w.table !== "innings" && w.table !== OVERS_COLLECTION) continue;
    const doc = t.docAfter(w.table, w.id);
    if (!doc) return null;
    if (w.table === "innings") innings.push(doc as unknown as WithId<InningsRow>);
    else overs.push(doc as unknown as OversRow);
  }
  return { match: match as unknown as WithId<MatchesRow>, innings, overs };
}

/** The `after` hook of a transaction that fills `ctx.delta`. */
function captureDelta(ctx: ScoringContext) {
  const sink = ctx.delta;
  if (!sink) return undefined;
  sink.value = null;
  return (t: ScoringTx) => {
    sink.value = scoringDeltaOf(t, sink.matchId);
  };
}

/** How many recent client action ids a match remembers. */
const CLIENT_ACTION_MEMORY = 20;

/** Thrown inside a transaction (so nothing is written) for a replayed action. */
class ActionAlreadyApplied extends Error {
  constructor() {
    super("action_already_applied");
  }
}

/** The ids of `lists` in order, each once (at its last place), newest kept. */
export function mergeActionIds(
  ...lists: ReadonlyArray<readonly string[] | null | undefined>
): string[] {
  const all = lists.flatMap((l) => l ?? []);
  const seen = new Set<string>();
  const out: string[] = [];
  for (let i = all.length - 1; i >= 0; i -= 1) {
    const id = all[i]!;
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out.reverse().slice(-CLIENT_ACTION_MEMORY);
}

/** Client action ids a match has applied: its own and its current innings'. */
export function appliedActionIdsOf(
  match: Pick<MatchesRow, "recent_client_actions"> | null,
  current: Pick<InningsRow, "recent_client_actions"> | null,
): string[] {
  return mergeActionIds(
    match?.recent_client_actions,
    current?.recent_client_actions,
  );
}

/**
 * For a call carrying a client action id: refuse (see {@link onceOnly}) when
 * the match already applied it, otherwise remember it with this mutation's
 * writes. The memory is the match's `recent_client_actions` plus its current
 * innings' (`current`; read here when the caller has not), both read by the
 * mutation anyway; the queue replays in order, so a short memory is enough
 * to catch a retry after a lost response.
 *
 * Every mutation calls this, with or without an id: just before commit
 * ({@link stageClientActions}) the id is recorded on the match when the
 * transaction writes it anyway (a structural change, which also takes the
 * current innings' ids along so they outlive a change of current innings),
 * otherwise on the current innings, which a per-ball action writes anyway.
 */
async function guardClientAction(
  t: ScoringTx,
  ctx: ScoringContext,
  match: WithId<MatchesRow>,
  current?: WithId<InningsRow> | null,
): Promise<void> {
  const id = ctx.clientActionId ?? null;
  const innings =
    current !== undefined
      ? current
      : id
        ? ((await loadCurrentInnings(t, match)) as WithId<InningsRow> | null)
        : null;
  if (id && appliedActionIdsOf(match, innings).includes(id)) {
    throw new ActionAlreadyApplied();
  }
  t.beforeCommit(() => stageClientActions(t, match, innings, id));
}

function sameIds(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((x, i) => x === b[i]);
}

/** See {@link guardClientAction}. */
function stageClientActions(
  t: ScoringTx,
  match: WithId<MatchesRow>,
  innings: WithId<InningsRow> | null,
  id: string | null,
): void {
  const matchWrite = t.pending("matches", match.id);
  if (matchWrite?.kind === "delete") return;
  const own = id ? [id] : [];
  if (matchWrite) {
    const next = mergeActionIds(
      match.recent_client_actions,
      innings?.recent_client_actions,
      own,
    );
    if (!sameIds(next, match.recent_client_actions ?? [])) {
      t.patch("matches", match.id, { recent_client_actions: next });
    }
    return;
  }
  if (!id) return;
  if (innings && t.pending("innings", innings.id)?.kind !== "delete") {
    t.patch("innings", innings.id, {
      recent_client_actions: mergeActionIds(innings.recent_client_actions, own),
    });
  } else {
    t.patch("matches", match.id, {
      recent_client_actions: mergeActionIds(match.recent_client_actions, own),
    });
  }
}

/** Runs a mutation; a replayed client action returns `replay()` instead. */
async function onceOnly<R>(
  run: () => Promise<R>,
  replay: () => Promise<R>,
): Promise<R> {
  try {
    return await run();
  } catch (err) {
    if (err instanceof ActionAlreadyApplied) return replay();
    throw err;
  }
}

/** `.catch()` for a mutation with no result: a replayed action is a no-op. */
function ignoreReplayed(err: unknown): void {
  if (!(err instanceof ActionAlreadyApplied)) throw err;
}

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

/**
 * `bundle` with its batters' / bowlers' current flags set to the crease and
 * bowler `ball` was recorded with (unchanged when one of them has no row).
 */
function withCreaseOf(
  bundle: InningsBundle,
  ball: BallByBallRow,
): InningsBundle {
  const { batsman_id: s, non_striker_id: ns, bowler_id: bw } = ball;
  if (
    !s ||
    !ns ||
    !bw ||
    !bundle.batting.some((b) => b.user_id === s) ||
    !bundle.batting.some((b) => b.user_id === ns) ||
    !bundle.bowling.some((b) => b.user_id === bw)
  ) {
    return bundle;
  }
  return {
    ...bundle,
    batting: bundle.batting.map((b) => ({
      ...b,
      is_current_batsman: b.user_id === s || b.user_id === ns,
      is_striker: b.user_id === s,
    })),
    bowling: bundle.bowling.map((b) => ({
      ...b,
      is_current_bowler: b.user_id === bw,
    })),
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

/**
 * Stage the recompute result (innings scorecard and caches, ball log),
 * writing only documents that changed; `extra` adds innings fields (the
 * seq counter). Returns the innings as stored after.
 *
 * The match document is not written: its over / ball position is derived
 * from the current innings (`~/lib/match-position`).
 */
function writeRecompute(
  t: ScoringTx,
  bundle: InningsBundle,
  out: RecomputeOutput,
  balls: BallByBallRow[],
  now: string,
  extra: Partial<InningsRow> = {},
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
    carried_penalties: carriedPenaltiesOf(bundle.innings, sorted),
    ...extra,
  };
  patchInningsIfChanged(t, bundle.innings, patch);
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
  seqCounter: number,
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
  // The new innings holds the match's seq counter from now on; the copies
  // keep their original seq, which the counter already covers.
  let doc: WithId<InningsRow> = {
    ...next,
    ...EMPTY_SCORECARD,
    last_ball_seq: seqCounter,
    carried_penalties: carriedPenaltiesOf(next, carried),
  };
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
 * The penalty events of a closing innings that the next innings may carry:
 * its `carried_penalties` cache, or for innings that predate it, its whole
 * ball log (one read per over).
 */
async function carriedPenaltyBalls(
  t: ScoringTx,
  completed: WithId<InningsRow>,
): Promise<BallByBallRow[]> {
  if (Array.isArray(completed.carried_penalties)) {
    return completed.carried_penalties.map(
      (b) => lastBallRowOf({ ...completed, last_ball: b })!,
    );
  }
  return ballLogOf(
    await t.where<OversRow>(OVERS_COLLECTION, [
      ["innings_id", "==", completed.id],
    ]),
  );
}

/**
 * Close `completed` and open the next innings or finish the match.
 * `completedBalls` is the closed innings' ball log when already loaded;
 * otherwise the penalty runs awarded to the next batting side come from the
 * innings' `carried_penalties` (see {@link carriedPenaltyBalls}).
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
  // The chasing side's squad, for the wickets in hand (one read, when a
  // chase ends; the team document holds the roster).
  const chaseSquadSize =
    completed.innings_number % 2 === 0
      ? ((await t.doc<TeamsRow>("teams", completed.team_id))?.roster?.length ??
        null)
      : null;
  const out = advanceAfterInnings(
    { match, completed, allInnings, teamNames, now, chaseSquadSize },
    newId(),
  );
  t.patch("innings", completed.id, out.completedInningsPatch);
  t.patch("matches", match.id, out.matchPatch);
  let nextInningsDoc: WithId<InningsRow> | null = null;
  let nextBalls: BallByBallRow[] = [];
  if (out.nextInnings) {
    const balls = completedBalls ?? (await carriedPenaltyBalls(t, completed));
    const opened = openNextInnings(
      t,
      match,
      out.nextInnings,
      balls,
      seqCounterOf(match, completed, ...allInnings) ?? 0,
      now,
    );
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

/** Documents a committed mutation wrote (for `live_state`'s change lists). */
interface Changed {
  overs: string[];
  innings: string[];
}

/**
 * {@link runScoringTransaction}, also returning the ids of the `overs` and
 * `innings` documents the committed attempt wrote (for
 * `live_state.overs_changed` / `innings_changed`).
 */
async function runTracked<R>(
  ctx: ScoringContext,
  fn: (t: ScoringTx) => Promise<R>,
): Promise<[R, Changed]> {
  const delta = captureDelta(ctx);
  let changed: Changed = { overs: [], innings: [] };
  const result = await runScoringTransaction(
    ctx,
    async (t) => {
      const out = await fn(t);
      changed = { overs: stagedOverIds(t), innings: [] };
      return out;
    },
    (t) => {
      changed.innings = stagedIds(t, "innings");
      delta?.(t);
    },
  );
  return [result, changed];
}

/**
 * {@link runTracked} for a mutation that calls {@link guardClientAction}:
 * null when the client action had already been applied (nothing written).
 */
async function runOnce<R>(
  ctx: ScoringContext,
  fn: (t: ScoringTx) => Promise<R>,
): Promise<[R, Changed] | null> {
  return onceOnly(
    () => runTracked(ctx, fn),
    async () => null,
  );
}

/**
 * `live_state.last_change` for a ball-log change made by this caller (no
 * read: the name comes from the session), or undefined to keep the
 * previous one.
 */
function lastChangeBy(
  ctx: ScoringContext,
  now: string,
): LiveStateLastChange | undefined {
  return ctx.uid
    ? { uid: ctx.uid, name: ctx.scorerName ?? null, at: now }
    : undefined;
}

async function finishWithState(
  ctx: ScoringContext,
  matchId: string,
  before: MatchesRow | null,
  changed: Changed,
  lastChange?: LiveStateLastChange,
  /** A delivery recorded through the full path (live_state events). */
  delivery = false,
): Promise<ScoringState> {
  const after = (await ctx.ds.getById(
    "matches",
    matchId,
  )) as unknown as MatchesRow | null;
  await maybeRecalculateStandings(ctx.ds, before, after);
  await writeLiveState(
    ctx.ds,
    matchId,
    ctx.db,
    changed.overs,
    lastChange,
    changed.innings,
    delivery,
  );
  return recordState(ctx.ds, matchId, after);
}

/** After a mutation that returns nothing: standings + live_state. */
async function finishQuietly(
  ctx: ScoringContext,
  matchId: string,
  before: MatchesRow | null,
  changed: Changed,
): Promise<void> {
  const after = (await ctx.ds.getById(
    "matches",
    matchId,
  )) as unknown as MatchesRow | null;
  await maybeRecalculateStandings(ctx.ds, before, after);
  await writeLiveState(
    ctx.ds,
    matchId,
    ctx.db,
    changed.overs,
    undefined,
    changed.innings,
  );
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
  const overNumber = positionOf(innings.total_balls, bpo).current_over;
  // Within an innings, `seq` order never goes back an over: when the cached
  // last ball is in an earlier over (or there is none), the current over
  // has no balls yet (a new over or innings), so it is not read.
  const overIsEmpty =
    innings.last_ball !== undefined &&
    (innings.last_ball === null || innings.last_ball.over_number < overNumber);
  const [prevLive, thisOver, lastBall] = await Promise.all([
    t.doc<LiveStateDoc>(LIVE_STATE_COLLECTION, match.id),
    overIsEmpty
      ? Promise.resolve([] as BallByBallRow[])
      : loadOverBalls(t, innings.id, overNumber),
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
    undefined,
    undefined,
    undefined,
    { kind: "crease" },
  );
}

// ---------------------------------------------------------------------------
// record_ball
// ---------------------------------------------------------------------------

/** {@link checkBall}, raising the engine's error. */
function checkBallArgs(args: RecordBallArgs): CheckedBall {
  const res = checkBall(args);
  if (!res.ok) throw new DbQueryError(res.code, "22000");
  return res.checked;
}

interface RecordOutcome {
  before: MatchesRow;
  /** Set by the incremental path, which also builds the state in the tx. */
  after: MatchesRow | null;
  state: ScoringState | null;
}

/**
 * Fast path: apply this delivery to the running totals held by the current
 * innings document. Reads the match and the innings (already read by the
 * caller), the current over document and `live_state` (and, before commit,
 * `live_scorecard`); writes all but the match, which a delivery that does
 * not end the innings leaves alone. Returns null when the ball must go
 * through a full recompute instead (including every validation failure, so
 * the full path raises the usual error).
 */
async function recordBallIncremental(
  t: ScoringTx,
  match: WithId<MatchesRow>,
  innings: WithId<InningsRow> | null,
  args: RecordBallArgs,
  checked: CheckedBall,
  now: string,
  lastChange?: LiveStateLastChange,
): Promise<RecordOutcome | null> {
  if (!canApplyIncrementally(match, innings)) return null;

  const bpo = ballsPerOverOf(match);
  const overNumber = Math.floor((innings.total_balls ?? 0) / bpo);
  const [overDoc, prevLive] = await Promise.all([
    t.doc<OversRow>(OVERS_COLLECTION, overDocId(innings.id, overNumber)),
    t.doc<LiveStateDoc>(LIVE_STATE_COLLECTION, match.id),
  ]);

  const docs = ballDocsAfter({
    match,
    innings,
    overDoc,
    args,
    checked,
    ballRandom: newId(),
    now,
  });
  if (!docs) return null;
  const { ball, out, inningsPatch } = docs;

  // ---- writes (buffered until the callback returns) ----
  const overBalls = ballRowsOf(docs.overDoc);
  t.put(OVERS_COLLECTION, overDocId(innings.id, overNumber), docs.overDoc);
  patchInningsIfChanged(t, innings, inningsPatch);
  const batting = out.batting;
  const partnershipsAfter = out.partnerships;
  const bowlerAfter = out.bowling[0]!;

  // ---- innings / match completion ----
  let matchAfter: MatchesRow = match;
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
  await stageLiveState(t, liveParts, prevLive, now, header, names, lastChange, {
    kind: "delivery",
    ball,
    innings: inningsAfter,
    overBalls,
  });

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
  const seq = Math.max(seqCounterOf(match, innings) ?? 0, maxSeq) + 1;
  const ball = newBall(args, checked, innings, bpo, seq, now, newId());
  const balls = [...bundle.balls, ball];

  const out = runRecompute(bundle, balls, now);
  const updatedInnings = writeRecompute(t, bundle, out, balls, now, {
    last_ball_seq: seq,
  });

  if (inningsComplete(match, updatedInnings)) {
    await applyAdvance(
      t,
      match,
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
  const lastChange = lastChangeBy(ctx, now);
  const tracked = await onceOnly(
    () =>
      runTracked(ctx, async (t) => {
        const match = await t.doc<MatchesRow>("matches", matchId);
        await requireAdminOf(ctx, matchId, match);
        const checked = checkBallArgs(args);
        if (!match) throw new DbQueryError("match_not_found", "22000");
        const innings = (await loadCurrentInnings(
          t,
          match,
        )) as WithId<InningsRow> | null;
        // Before the status check: the replayed ball may be the one that
        // finished the match.
        await guardClientAction(t, ctx, match, innings);
        if (match.status !== "live")
          throw new DbQueryError("match_not_live", "22000");

        if (ctx.incremental !== false) {
          const fast = await recordBallIncremental(
            t,
            match,
            innings,
            args,
            checked,
            now,
            lastChange,
          );
          if (fast) return fast;
        }
        return recordBallFull(t, match, args, checked, now);
      }),
    async () => null,
  );
  // Already recorded (a replay after a lost response): the current state.
  if (!tracked) return recordState(ctx.ds, matchId);
  const [outcome, overs] = tracked;

  const { before } = outcome;
  let state: ScoringState;
  if (outcome.state && outcome.after) {
    await maybeRecalculateStandings(ctx.ds, before, outcome.after);
    state = outcome.state;
  } else {
    state = await finishWithState(
      ctx,
      matchId,
      before,
      overs,
      lastChange,
      true,
    );
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

  const tracked = await onceOnly(
    () => runTracked(ctx, (t) => undoInTransaction(t, ctx, matchId, now)),
    async () => null,
  );
  if (!tracked) return recordState(ctx.ds, matchId);
  const [before, overs] = tracked;
  return finishWithState(ctx, matchId, before, overs, lastChangeBy(ctx, now));
}

async function undoInTransaction(
  t: ScoringTx,
  ctx: ScoringContext,
  matchId: string,
  now: string,
): Promise<WithId<MatchesRow>> {
  const match = await t.doc<MatchesRow>("matches", matchId);
  if (!match) throw new DbQueryError("match_not_found", "22000");
  const { all, current } = await currentInningsOf(t, match);
  await guardClientAction(t, ctx, match, current);

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
          current.target_runs - ((last.runs_scored ?? 0) + (last.extras ?? 0)),
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
      ? t.where<OversRow>(OVERS_COLLECTION, [["innings_id", "==", current.id]])
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
  // The crease and bowler the undone ball was bowled with are the ones
  // chosen since the ball before it: where the remaining log leaves an end
  // empty (a wicket, an over's end, no ball left), the recompute keeps them.
  const out = runRecompute(withCreaseOf(bundle, last), remaining, now);
  // Removing the ball that closed an innings (or finished the match) reopens
  // that innings so scoring can resume from it.
  if (crossingBoundary || target.is_completed) {
    out.inningsPatch.is_completed = false;
  }
  // The innings holding the match's last ball is (or becomes) current, and
  // with it the holder of the seq counter.
  const counter = crossingBoundary ? seqCounterOf(match, ...all) : null;
  const targetAfter = writeRecompute(
    t,
    bundle,
    out,
    remaining,
    now,
    counter === null ? {} : { last_ball_seq: counter },
  );

  if (target.is_completed || (crossingBoundary && current?.is_completed)) {
    const after = replaceInnings(
      all.filter((i) => !(crossingBoundary && i.id === current?.id)),
      [targetAfter],
    );
    await syncMatchRecords(t, matchId, match, after, now);
  }
  return match;
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
  /** On a no-ball: byes / leg byes rather than runs off the bat. */
  p_no_ball_runs?: string | null;
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
  const noBallRuns = noBallRunsOf(extraType, args.p_no_ball_runs);
  if (noBallRuns === undefined) throw new DbQueryError("invalid_input", "22000");
  const now = new Date().toISOString();

  const tracked = await runOnce(ctx, async (t) => {
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
    // A replayed edit (offline queue) is not applied again over a later one.
    await guardClientAction(t, ctx, match);
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
    const balls = bundle.balls.map((b) => {
      if (b.id !== ball.id) return b;
      const edited: BallByBallRow = { ...ball, ...patch };
      if (noBallRuns) edited.no_ball_runs = noBallRuns;
      else delete edited.no_ball_runs;
      return edited;
    });
    const out = runRecompute(bundle, balls, now);
    const after = writeRecompute(t, bundle, out, balls, now);
    await syncIfCompleted(t, match, innings, after, now);
    return match;
  });
  if (!tracked) return recordState(ctx.ds, matchId);
  const [before, overs] = tracked;

  return finishWithState(ctx, matchId, before, overs, lastChangeBy(ctx, now));
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

  const tracked = await runOnce(ctx, async (t) => {
    const match = await t.doc<MatchesRow>("matches", matchId);
    if (!match) throw new DbQueryError("match_not_found", "22000");
    const { all, current } = await currentInningsOf(t, match);
    await guardClientAction(t, ctx, match, current);
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
  if (!tracked) return recordState(ctx.ds, matchId);
  const [before, overs] = tracked;

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

  const tracked = await runOnce(ctx, async (t) => {
    const match = await t.doc<MatchesRow>("matches", matchId);
    if (!match) throw new DbQueryError("match_not_found", "22000");
    const { all, current } = await currentInningsOf(t, match);
    await guardClientAction(t, ctx, match, current);
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
      last_ball_seq: seqCounterOf(match, ...all) ?? 0,
      carried_penalties: [],
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
  if (!tracked) return recordState(ctx.ds, matchId);
  const [before, overs] = tracked;

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
  }) => {
    balls: BallByBallRow[];
    /** The seq assigned to an appended event (the new counter). */
    seq?: number;
  },
): Promise<null> {
  const now = new Date().toISOString();
  const tracked = await runOnce(ctx, async (t) => {
    const match = await t.doc<MatchesRow>("matches", matchId);
    await requireAdminOf(ctx, matchId, match);
    if (!match) throw new DbQueryError("match_not_found", "22000");
    const innings = (await loadCurrentInnings(
      t,
      match,
    )) as WithId<InningsRow> | null;
    await guardClientAction(t, ctx, match, innings);
    if (!innings) throw new DbQueryError("no_open_innings", "22000");
    const bundle = await loadInningsBundle(t, match, innings);
    const { balls, seq } = edit({ match, innings, bundle, now });
    const out = runRecompute(bundle, balls, now);
    const after = writeRecompute(
      t,
      bundle,
      out,
      balls,
      now,
      seq === undefined ? {} : { last_ball_seq: seq },
    );
    await syncIfCompleted(t, match, innings, after, now);
    return match;
  });
  if (tracked) await finishQuietly(ctx, matchId, tracked[0], tracked[1]);
  return null;
}

/**
 * A logged event in the current over (not a delivery) of `innings`, the
 * current innings, numbered after the match's seq counter.
 */
function eventBall(
  match: WithId<MatchesRow>,
  innings: WithId<InningsRow>,
  fields: Partial<BallByBallRow>,
  now: string,
): BallByBallRow {
  return newEventBall(match, innings, fields, now, newId());
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
  const tracked = await runOnce(ctx, async (t) => {
    const match = await t.doc<MatchesRow>("matches", matchId);
    await requireAdminOf(ctx, matchId, match);
    if (!match) throw new DbQueryError("match_not_found", "22000");
    const { all, current } = await currentInningsOf(t, match);
    await guardClientAction(t, ctx, match, current);
    if (args.p_team_id !== match.team1_id && args.p_team_id !== match.team2_id)
      throw new DbQueryError("invalid_input", "22000");
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
        seqCounterOf(match, current, inningsOf) ?? 0,
        bundle.balls.reduce((m, b) => Math.max(m, b.seq ?? 0), 0),
      ) + 1;
    const at = matchPositionOf(match, current);
    const position = theirs
      ? {
          over: lastLogged?.over_number ?? 0,
          ball: lastLogged?.ball_number ?? 1,
        }
      : {
          over: at.current_over,
          ball: Math.min(20, Math.max(1, at.current_ball + 1)),
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
    // The current innings holds the seq counter.
    const inningsAfter = writeRecompute(
      t,
      bundle,
      out,
      balls,
      now,
      theirs ? {} : { last_ball_seq: seq },
    );
    if (theirs) {
      t.patch("innings", current.id, { last_ball_seq: seq });
      if (current.target_runs !== null && current.target_runs !== undefined) {
        t.patch("innings", current.id, {
          target_runs: current.target_runs + args.p_runs,
          updated_at: now,
        });
      }
    }
    await syncIfCompleted(t, match, inningsOf, inningsAfter, now, all);
    return match;
  });
  if (tracked) await finishQuietly(ctx, matchId, tracked[0], tracked[1]);
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
      // At the current crease (the entry `ball-docs` builds, which the
      // scoring screen predicts).
      const ball = eventBall(
        match,
        innings,
        penaltyFields(innings, args.p_runs, type, args.p_reason),
        now,
      );
      return { balls: [...bundle.balls, ball], seq: ball.seq ?? undefined };
    },
  );
}

/**
 * Retire a batter (hurt: not out; out: a wicket), logged in the ball log
 * with both batters (`retirementFields`): the partner stays at their end.
 */
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
        retirementFields(innings, args.p_player_id, type, args.p_reason),
        now,
      );
      return { balls: [...bundle.balls, ball], seq: ball.seq ?? undefined };
    },
  );
}

/** Credit every ball of the current over to another bowler. */
export async function reassignOverBowler(
  ctx: ScoringContext,
  args: { p_match_id: string; p_bowler_id: string },
): Promise<null> {
  return editCurrentInnings(
    ctx,
    args.p_match_id,
    ({ match, innings, bundle }) => {
      const { current_over } = matchPositionOf(match, innings);
      return {
        // Fielding-side penalty events in the over are not deliveries.
        balls: bundle.balls.map((b) =>
          b.over_number === current_over && !b.penalty_team_id
            ? { ...b, bowler_id: args.p_bowler_id }
            : b,
        ),
      };
    },
  );
}

/**
 * The wrong player was recorded as batting: credit everything the log has
 * for `from` in the current innings (balls faced, runs, the crease, a
 * retirement) to `to`, who takes their place in the batting order. Not a
 * substitution: `from` never batted, so their row goes. `to` must be in the
 * batting side and not have batted in this innings.
 */
export async function replaceBatter(
  ctx: ScoringContext,
  args: { p_match_id: string; p_from_id: string; p_to_id: string },
): Promise<null> {
  const { p_match_id: matchId, p_from_id: from, p_to_id: to } = args;
  if (!from || !to || from === to)
    throw new DbQueryError("invalid_input", "22000");
  const now = new Date().toISOString();
  const tracked = await runOnce(ctx, async (t) => {
    const match = await t.doc<MatchesRow>("matches", matchId);
    await requireAdminOf(ctx, matchId, match);
    if (!match) throw new DbQueryError("match_not_found", "22000");
    const innings = (await loadCurrentInnings(
      t,
      match,
    )) as WithId<InningsRow> | null;
    await guardClientAction(t, ctx, match, innings);
    if (!innings) throw new DbQueryError("no_open_innings", "22000");
    if (match.status === "completed" || match.status === "abandoned")
      throw new DbQueryError("match_not_live", "22000");
    if (innings.is_completed)
      throw new DbQueryError("innings_already_completed", "22000");
    requireScorecard(innings);
    const [bundle, roster] = await Promise.all([
      loadInningsBundle(t, match, innings),
      t.where<TeamPlayersRow>("team_players", [
        ["team_id", "==", innings.team_id],
        ["user_id", "==", to],
      ]),
    ]);
    if (roster.length === 0)
      throw new DbQueryError("player_not_in_batting_team", "22000");

    const names = (b: BallByBallRow, id: string) =>
      b.batsman_id === id ||
      b.non_striker_id === id ||
      b.dismissed_player_id === id;
    // Nothing logged for them yet: an ordinary change of batter.
    if (!bundle.balls.some((b) => names(b, from)))
      throw new DbQueryError("player_not_batted", "22000");
    const toRow = bundle.batting.find((b) => b.user_id === to);
    if (
      bundle.balls.some((b) => names(b, to)) ||
      (toRow &&
        (toRow.is_out ||
          toRow.dismissal_type ||
          (toRow.balls_faced ?? 0) > 0 ||
          (toRow.runs_scored ?? 0) > 0))
    )
      throw new DbQueryError("player_already_batted", "22000");

    const swap = (id: string | null | undefined) => (id === from ? to : id);
    const balls = bundle.balls.map((b) =>
      names(b, from)
        ? {
            ...b,
            batsman_id: swap(b.batsman_id) ?? b.batsman_id,
            non_striker_id: swap(b.non_striker_id) ?? null,
            dismissed_player_id: swap(b.dismissed_player_id) ?? null,
          }
        : b,
    );
    // `to` takes `from`'s row (batting position, crease flags).
    const batting = bundle.batting
      .filter((b) => b.user_id !== to)
      .map((b) =>
        b.user_id === from
          ? { ...b, id: `${innings.id}_${to}`, user_id: to }
          : b,
      );
    const edited = { ...bundle, batting };
    const out = runRecompute(edited, balls, now);
    const after = writeRecompute(t, edited, out, balls, now);
    await syncIfCompleted(t, match, innings, after, now);
    return match;
  });
  if (tracked) await finishQuietly(ctx, matchId, tracked[0], tracked[1]);
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
    // A replayed change (offline queue) is not applied again: later
    // actions may have moved the crease on since.
    await guardClientAction(t, ctx, match, current);
    if (!current) throw new DbQueryError("no_open_innings", "22000");
    // A finished match or innings has no crease to change.
    if (match.status === "completed" || match.status === "abandoned")
      throw new DbQueryError("match_not_live", "22000");
    if (current.is_completed)
      throw new DbQueryError("innings_already_completed", "22000");
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

    const next = battingWithCrease(batting, strikerId, nonStrikerId);
    if (!next) return;
    t.patch("innings", current.id, { batting: next });
    await stageCurrentLiveState(t, match, { ...current, batting: next }, now);
  }, captureDelta(ctx)).catch(ignoreReplayed);

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
    // A replayed change (offline queue) is not applied again: the next
    // over may have started since, with another bowler.
    await guardClientAction(t, ctx, match, current);
    if (!current) throw new DbQueryError("no_open_innings", "22000");
    // A finished match or innings has no crease to change.
    if (match.status === "completed" || match.status === "abandoned")
      throw new DbQueryError("match_not_live", "22000");
    if (current.is_completed)
      throw new DbQueryError("innings_already_completed", "22000");
    requireScorecard(current);

    const currentOver = matchPositionOf(match, current).current_over;
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

    const next = bowlingWithBowler(current.bowling ?? [], bowlerId);
    if (!next) return;
    t.patch("innings", current.id, { bowling: next });
    await stageCurrentLiveState(t, match, { ...current, bowling: next }, now);
  }, captureDelta(ctx)).catch(ignoreReplayed);

  return { ok: true };
}
