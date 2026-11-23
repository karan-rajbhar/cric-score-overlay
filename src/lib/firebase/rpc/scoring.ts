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
import { dismissesEitherBatter } from "~/lib/cricket";
import {
  battedOnAfter,
  battingAfterOut,
  laterBallsTo,
  overBowlerFixes,
  swapBattersFixes,
  type BallPlayersFix,
  type CorrectionNote,
} from "~/lib/scoring-correction";

export type { BallPlayersFix };
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
  replaceDeep,
  SCORECARD_FIELDS,
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
  creaseChangeError,
  DISMISSAL_TYPES,
  editedBall,
  EXTRA_TYPES,
  fielderOf,
  inningsComplete,
  newBall,
  newEventBall,
  overBowlingOf,
  penaltyFields,
  retirementFields,
  noBallRunsOf,
  type CheckedBall,
  type RecordBallArgs,
} from "../scoring/ball-docs";
import {
  penaltyCountsFor,
  recomputeInnings,
  type CreaseOverride,
  type RecomputeOutput,
} from "../scoring/recompute";
import {
  advanceAfterInnings,
  expectedTarget,
  inningsLimits,
  isDecidingInnings,
  isSuperOverInnings,
  type AdvanceOutput,
} from "../scoring/result";
import {
  followOnOf,
  isTwoInningsMatch,
  type FollowOnOption,
} from "../../multi-innings";
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

function runRecompute(
  bundle: InningsBundle,
  balls: BallByBallRow[],
  now: string,
  crease?: CreaseOverride,
): RecomputeOutput {
  return recomputeInnings({
    match: bundle.match,
    innings: bundle.innings,
    balls: sortBySeq(balls),
    existingBatting: bundle.batting,
    existingBowling: bundle.bowling,
    now,
    crease,
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
/**
 * The chasing side's squad size, for the wickets in hand (one read, when a
 * chase ends; the team document holds the roster). Null for a first innings.
 */
async function chaseSquadSizeOf(
  t: ScoringTx,
  match: MatchesRow,
  completed: InningsRow,
): Promise<number | null> {
  if (!isDecidingInnings(match, completed.innings_number)) return null;
  return (
    (await t.doc<TeamsRow>("teams", completed.team_id))?.roster?.length ?? null
  );
}

async function applyAdvance(
  t: ScoringTx,
  match: MatchesRow,
  completed: WithId<InningsRow>,
  allInnings: WithId<InningsRow>[],
  teamNames: Record<string, string | undefined>,
  now: string,
  completedBalls?: readonly BallByBallRow[],
): Promise<AppliedAdvance> {
  const chaseSquadSize = await chaseSquadSizeOf(t, match, completed);
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

/** A finished match back in play (undo, or an edit its last innings no longer ends with). */
function reopenedMatchPatch(now: string): Partial<MatchesRow> {
  return {
    status: "live",
    actual_end_time: null,
    result_type: null,
    result_description: null,
    winning_team_id: null,
    win_margin: null,
    win_margin_type: null,
    player_of_the_match_id: null,
    updated_at: now,
  };
}

const RESULT_FIELDS = [
  "status",
  "result_type",
  "winning_team_id",
  "win_margin_type",
  "win_margin",
  "result_description",
] as const;

/**
 * After a change to the ball log outside `record_ball` (an edit, penalty
 * runs, a retirement) recomputed an innings to `after` (`before` as stored,
 * `balls` its log): what a delivery would have done.
 *
 * - An open innings the change completes (target reached, last wicket,
 *   last ball) closes, and the next innings opens or the match ends
 *   (`applyAdvance`).
 * - A completed innings that sets a chase moves that chase's target with
 *   its total, unless the target was revised (DLS, by hand); the chase may
 *   then be complete too.
 * - A finished match whose last innings changed (or its target) gets its
 *   result again; when that innings no longer ends by the rules (a target
 *   it no longer reaches, a wicket edited away) and did before, the match
 *   reopens as after an undo. One ended by hand stays ended.
 *
 * The player records follow a completed innings' change.
 */
async function settleAfterEdit(
  t: ScoringTx,
  match: WithId<MatchesRow>,
  before: WithId<InningsRow>,
  after: WithId<InningsRow>,
  balls: readonly BallByBallRow[],
  now: string,
): Promise<void> {
  const readAll = () =>
    t.where<InningsRow>("innings", [["match_id", "==", match.id]]);
  if (!before.is_completed) {
    if (completesInnings(match, after)) {
      const all = replaceInnings(await readAll(), [after]);
      await closeInnings(t, match, after, all, now, balls);
    }
    return;
  }
  const stored = await readAll();
  let all = replaceInnings(stored, [after]);
  const moved = movedChase(match, before, after, all, now);
  if (moved) {
    t.patch("innings", moved.id, {
      target_runs: moved.target_runs,
      updated_at: now,
    });
    all = replaceInnings(all, [moved]);
    if (!moved.is_completed && completesInnings(match, moved)) {
      // It syncs the records, with this innings' change.
      await closeInnings(t, match, moved, all, now);
      return;
    }
  }
  const changed = [after.id, moved?.id];
  all = await settleResult(t, match, stored, all, changed, now);
  await syncMatchRecords(t, match.id, match, all, now);
}

/** Whether `open`, the innings in play, is now complete (it closes). */
function completesInnings(match: MatchesRow, open: InningsRow): boolean {
  return (
    match.status === "live" &&
    open.innings_number === (match.current_innings ?? 1) &&
    inningsComplete(match, open)
  );
}

async function closeInnings(
  t: ScoringTx,
  match: MatchesRow,
  open: WithId<InningsRow>,
  all: WithId<InningsRow>[],
  now: string,
  openBalls?: readonly BallByBallRow[],
): Promise<void> {
  const names = await teamNamesOf(t, match);
  await applyAdvance(t, match, open, all, names, now, openBalls);
}

/**
 * The chase `after` (a completed innings that sets one) sets, with its
 * target moved to the new total: null when the total did not change, or
 * the target no longer follows it (revised by DLS or by hand). In a
 * two-innings match every earlier innings sets the fourth innings' target.
 */
function movedChase(
  match: MatchesRow,
  before: InningsRow,
  after: InningsRow,
  all: readonly WithId<InningsRow>[],
  now: string,
): WithId<InningsRow> | null {
  if (after.total_runs === before.total_runs) return null;
  const chaseNumber = chaseSetBy(match, after.innings_number);
  if (chaseNumber === null) return null;
  const next = all.find((i) => i.innings_number === chaseNumber);
  if (!next) return null;
  const stored = all.map((i) => (i.id === after.id ? before : i));
  if (next.target_runs !== expectedTarget(match, stored, next)) return null;
  if (match.dls_revision?.innings_number === next.innings_number) return null;
  const target = expectedTarget(match, all, next);
  return { ...next, target_runs: target, updated_at: now };
}

/**
 * The chase whose target innings `inningsNumber` sets: the next innings of
 * a pair (a limited-overs match, a super over), or a two-innings match's
 * fourth innings for any innings before it. Null when it sets none.
 */
function chaseSetBy(match: MatchesRow, inningsNumber: number): number | null {
  if (isTwoInningsMatch(match) && !isSuperOverInnings(match, inningsNumber)) {
    return inningsNumber < 4 ? 4 : null;
  }
  return inningsNumber % 2 === 1 ? inningsNumber + 1 : null;
}

/**
 * A finished match whose last innings is among `changed` (as stored in
 * `stored`, now in `all`): its result again, or back in play when that
 * innings ended by the rules and no longer does. Returns `all` as it will
 * be stored.
 */
async function settleResult(
  t: ScoringTx,
  match: WithId<MatchesRow>,
  stored: readonly WithId<InningsRow>[],
  all: WithId<InningsRow>[],
  changed: readonly (string | undefined)[],
  now: string,
): Promise<WithId<InningsRow>[]> {
  const last = all.reduce((m, i) => (i.innings_number > m.innings_number ? i : m));
  const lastBefore = stored.find((i) => i.id === last.id);
  if (match.status !== "completed" || !last.is_completed) return all;
  // In a two-innings match every innings counts towards the result (a win
  // by an innings is decided on all three).
  const counts = changed.includes(last.id) || isTwoInningsMatch(match);
  if (!lastBefore || !counts) return all;
  if (inningsComplete(match, lastBefore) && !inningsComplete(match, last)) {
    t.patch("matches", match.id, reopenedMatchPatch(now));
    t.patch("innings", last.id, { is_completed: false, updated_at: now });
    return replaceInnings(all, [{ ...last, is_completed: false }]);
  }
  const { matchPatch, nextInnings } = advanceAfterInnings(
    {
      match,
      completed: last,
      allInnings: all,
      teamNames: await teamNamesOf(t, match),
      now,
      chaseSquadSize: await chaseSquadSizeOf(t, match, last),
    },
    newId(),
  );
  if (nextInnings) {
    return continueMatch(t, match, all, matchPatch, nextInnings, now);
  }
  const result = (k: (typeof RESULT_FIELDS)[number]) => matchPatch[k] ?? null;
  if (RESULT_FIELDS.some((k) => result(k) !== (match[k] ?? null))) {
    const patch: Partial<MatchesRow> = { updated_at: now };
    for (const k of RESULT_FIELDS) Object.assign(patch, { [k]: result(k) });
    t.patch("matches", match.id, patch);
  }
  return all;
}

/**
 * A win by an innings an edit took away: the match goes on, as after an
 * undo, with the innings that follows. Returns `all` with it.
 */
function continueMatch(
  t: ScoringTx,
  match: WithId<MatchesRow>,
  all: WithId<InningsRow>[],
  matchPatch: Partial<MatchesRow>,
  next: InningsRow,
  now: string,
): WithId<InningsRow>[] {
  t.patch("matches", match.id, { ...reopenedMatchPatch(now), ...matchPatch });
  const opened = openNextInnings(
    t,
    match,
    next,
    [],
    seqCounterOf(match, ...all) ?? 0,
    now,
  );
  return replaceInnings(all, [opened.doc]);
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
  correction?: CorrectionNote | null,
): LiveStateLastChange | undefined {
  if (!ctx.uid) return undefined;
  return {
    uid: ctx.uid,
    name: ctx.scorerName ?? null,
    at: now,
    ...(correction ? { correction } : {}),
  };
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

/**
 * After a mutation that returns nothing: standings + live_state.
 * `lastChange`: a correction's author and note (else the previous one stays).
 */
async function finishQuietly(
  ctx: ScoringContext,
  matchId: string,
  before: MatchesRow | null,
  changed: Changed,
  lastChange?: LiveStateLastChange,
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
    lastChange,
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
    t.patch("matches", matchId, reopenedMatchPatch(now));
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
  // The crease and bowler the undone entry was recorded with (a retirement
  // has no bowler) are the state just before it, whatever the remaining log
  // would give: a strike or a bowler changed by hand since the ball before.
  const out = runRecompute(bundle, remaining, now, {
    striker: last.batsman_id ?? null,
    nonStriker: last.non_striker_id ?? null,
    bowler: last.bowler_id ?? null,
  });
  // Removing the ball that closed an innings (or finished the match) reopens
  // that innings so scoring can resume from it.
  if (crossingBoundary || target.is_completed) {
    out.inningsPatch.is_completed = false;
    // Back in play: a declaration that closed it no longer stands.
    if (target.declared) out.inningsPatch.declared = null;
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
  /**
   * The edit makes this ball a wicket of a batter the log has batting on
   * after it: the batter who came in, who takes those later entries
   * (`laterBallsTo`). Without it such an edit is refused.
   */
  p_later_batter_id?: string | null;
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
  let note: CorrectionNote | null = null;

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
    const ball = editedBall(found, {
      runsScored: args.p_runs_scored,
      extras: args.p_extras,
      extraType,
      isWicket,
      dismissalType: args.p_dismissal_type,
      fielderId: args.p_fielder_id,
      dismissedPlayerId: args.p_dismissed_player_id,
      batsmanId: args.p_batsman_id,
      bowlerId: args.p_bowler_id,
      noBallRuns,
    });
    const innings = await t.doc<InningsRow>("innings", over.innings_id);
    if (!innings) throw new DbQueryError("ball_not_found", "22000");
    const bundle = matchOvers
      ? bundleOf(
          match,
          innings,
          matchOvers.filter((o) => o.innings_id === innings.id),
        )
      : await loadInningsBundle(t, match, innings);

    let balls = bundle.balls.map((b) => (b.id === ball.id ? ball : b));
    if (args.p_later_batter_id) {
      // A wicket added after the batter batted on: the later entries were
      // the batter who came in.
      const sorted = sortBySeq(balls);
      const on = battedOnAfter(sorted, ball);
      if (!on) throw new DbQueryError("invalid_input", "22000");
      await requireInSquad(t, innings.team_id, new Set([args.p_later_batter_id]));
      balls = laterBallsTo(sorted, ball.id, on.outId, args.p_later_batter_id);
    }
    // Never a batter at the crease after they were out (a wicket added on
    // a ball the batter batted on after, without saying who came in).
    const already = battingAfterOut(sortBySeq(bundle.balls));
    if ([...battingAfterOut(sortBySeq(balls))].some((k) => !already.has(k)))
      throw new DbQueryError("batter_already_out", "22000");
    const out = runRecompute(bundle, balls, now);
    const after = writeRecompute(t, bundle, out, balls, now);
    await settleAfterEdit(t, match, innings, after, sortBySeq(balls), now);
    note = {
      kind: "edit_ball",
      innings_number: innings.innings_number,
      over: ball.over_number,
      ball: ball.ball_number,
    };
    return match;
  });
  if (!tracked) return recordState(ctx.ds, matchId);
  const [before, overs] = tracked;

  return finishWithState(
    ctx,
    matchId,
    before,
    overs,
    lastChangeBy(ctx, now, note),
  );
}

// ---------------------------------------------------------------------------
// correct_ball_players
// ---------------------------------------------------------------------------

/** The innings a correction works on, as read in its transaction. */
interface CorrectionTarget {
  match: WithId<MatchesRow>;
  innings: WithId<InningsRow>;
  /** Its ball log, in `seq` order. */
  balls: BallByBallRow[];
}

/**
 * What a correction changes: the fixes per entry (empty: nothing to do)
 * and the note for `live_state.last_change`.
 */
interface CorrectionPlan {
  fixes: BallPlayersFix[];
  note: CorrectionNote;
}

/**
 * Runs a correction of who took part in entries of one innings' ball log:
 * `plan` reads the log and says which entries change, then the innings is
 * recomputed from the corrected log as after Edit ball (records, statistics
 * and live documents follow, and a finished match is settled again). When
 * batters change, the batting order follows the log (each batter's first
 * ball, the openers keeping theirs). Refused: a player outside the squad
 * of the side they played for, a batter at both ends, a striker-only
 * dismissal given to the non-striker, and a batter named after they were
 * out (unless the log already had that). A replayed client action is not
 * applied twice.
 */
async function correctBalls(
  ctx: ScoringContext,
  matchId: string,
  inningsId: string,
  plan: (target: CorrectionTarget) => CorrectionPlan,
): Promise<ScoringState> {
  await requireAdmin(ctx, matchId);
  const now = new Date().toISOString();
  let note: CorrectionNote | null = null;
  const tracked = await runOnce(ctx, async (t) => {
    const [match, innings] = await Promise.all([
      t.doc<MatchesRow>("matches", matchId),
      t.doc<InningsRow>("innings", inningsId),
    ]);
    if (!match) throw new DbQueryError("match_not_found", "22000");
    if (!innings || innings.match_id !== matchId)
      throw new DbQueryError("innings_not_found", "22000");
    await guardClientAction(t, ctx, match);
    requireScorecard(innings);
    const bundle = await loadInningsBundle(t, match, innings);
    const planned = plan({ match, innings, balls: sortBySeq(bundle.balls) });
    if (planned.fixes.length === 0) return null;
    const fixes = new Map(planned.fixes.map((f) => [f.ball_id, f]));
    if (fixes.size !== planned.fixes.length)
      throw new DbQueryError("invalid_input", "22000");

    let found = 0;
    const balls = bundle.balls.map((b) => {
      const fix = fixes.get(b.id);
      if (!fix) return b;
      found += 1;
      return correctedBall(b, fix);
    });
    if (found !== fixes.size) throw new DbQueryError("ball_not_found", "22000");
    await requireSquadsHold(t, match, innings, planned.fixes);
    const already = battingAfterOut(sortBySeq(bundle.balls));
    if ([...battingAfterOut(sortBySeq(balls))].some((k) => !already.has(k)))
      throw new DbQueryError("batter_already_out", "22000");

    const out = runRecompute(bundle, balls, now);
    const battersChanged = planned.fixes.some(
      (f) => f.batsman_id !== undefined || f.non_striker_id !== undefined,
    );
    const after = writeRecompute(
      t,
      bundle,
      battersChanged
        ? { ...out, batting: inLogOrder(out.batting, balls) }
        : out,
      balls,
      now,
    );
    await settleAfterEdit(t, match, innings, after, sortBySeq(balls), now);
    note = { ...planned.note, innings_number: innings.innings_number };
    return match;
  });
  if (!tracked || !tracked[0]) return recordState(ctx.ds, matchId);
  const [before, changed] = tracked;
  return finishWithState(
    ctx,
    matchId,
    before,
    changed,
    lastChangeBy(ctx, now, note),
  );
}

/**
 * Corrects who took part in entries of one innings' ball log, entry by
 * entry: the striker, non-striker, batter out, bowler and fielder, with the
 * runs, extras and everything else left as recorded (see
 * {@link correctBalls}). For a repair nothing else expresses; the scoring
 * screen uses {@link swapBatters} and {@link correctOverBowler}.
 */
export async function correctBallPlayers(
  ctx: ScoringContext,
  args: {
    p_match_id: string;
    p_innings_id: string;
    p_balls: BallPlayersFix[];
  },
): Promise<ScoringState> {
  if (args.p_balls.length === 0)
    throw new DbQueryError("invalid_input", "22000");
  return correctBalls(ctx, args.p_match_id, args.p_innings_id, ({ balls }) => {
    const first = balls.find((b) => b.id === args.p_balls[0]!.ball_id);
    return {
      fixes: args.p_balls,
      note: {
        kind: "edit_ball",
        over: first?.over_number ?? null,
        ball: first?.ball_number ?? null,
      },
    };
  });
}

/**
 * The batters were at the wrong ends: from `p_from_ball_id` to
 * `p_to_ball_id` (null: the end of the innings), the two batters at the
 * crease on the first ball change places wherever the log names them, as
 * striker, non-striker or batter out. A wicket in the range moves with
 * them, so after it the batter left in carries on under their own name:
 * this also fixes a wicket given to the wrong batter (from that ball to
 * the end of the innings).
 */
export async function swapBatters(
  ctx: ScoringContext,
  args: {
    p_match_id: string;
    p_innings_id: string;
    p_from_ball_id: string;
    p_to_ball_id?: string | null;
  },
): Promise<ScoringState> {
  return correctBalls(ctx, args.p_match_id, args.p_innings_id, ({ balls }) => {
    if (!balls.some((b) => b.id === args.p_from_ball_id))
      throw new DbQueryError("ball_not_found", "22000");
    if (args.p_to_ball_id && !balls.some((b) => b.id === args.p_to_ball_id))
      throw new DbQueryError("ball_not_found", "22000");
    const range = swapBattersFixes(
      balls,
      args.p_from_ball_id,
      args.p_to_ball_id ?? null,
    );
    if (!range) throw new DbQueryError("invalid_input", "22000");
    const { fixes, a, b, first, last } = range;
    return {
      fixes,
      note: {
        kind: "swap_batters",
        over: first.over_number,
        ball: first.ball_number,
        to_over: last?.over_number ?? null,
        to_ball: last?.ball_number ?? null,
        from_id: a,
        to_id: b,
      },
    };
  });
}

/**
 * Someone else bowled a whole over: every ball of over `p_over_number`
 * (0-based) goes to `p_bowler_id`, with its figures, wickets and maidens.
 * Fielders stay as they are; entries without a bowler (events) too.
 */
export async function correctOverBowler(
  ctx: ScoringContext,
  args: {
    p_match_id: string;
    p_innings_id: string;
    p_over_number: number;
    p_bowler_id: string;
  },
): Promise<ScoringState> {
  if (!args.p_bowler_id || !Number.isInteger(args.p_over_number))
    throw new DbQueryError("invalid_input", "22000");
  return correctBalls(ctx, args.p_match_id, args.p_innings_id, ({ balls }) => {
    const over = overBowlerFixes(balls, args.p_over_number, args.p_bowler_id);
    if (!over) throw new DbQueryError("over_not_found", "22000");
    return {
      fixes: over.fixes,
      note: {
        kind: "over_bowler",
        over: args.p_over_number,
        from_id: over.from,
        to_id: args.p_bowler_id,
      },
    };
  });
}


/** One entry with `fix` applied, refused when it no longer makes sense. */
function correctedBall(ball: BallByBallRow, fix: BallPlayersFix): BallByBallRow {
  const next: BallByBallRow = { ...ball };
  if (fix.batsman_id !== undefined) next.batsman_id = fix.batsman_id;
  if (fix.non_striker_id !== undefined) next.non_striker_id = fix.non_striker_id;
  if (fix.bowler_id !== undefined) next.bowler_id = fix.bowler_id;
  if (ball.is_wicket) {
    if (fix.dismissed_player_id !== undefined)
      next.dismissed_player_id = fix.dismissed_player_id;
    if (fix.fielder_id !== undefined)
      next.fielder_id = fielderOf(ball.dismissal_type, fix.fielder_id);
    const out = next.dismissed_player_id ?? next.batsman_id;
    const atCrease = out === next.batsman_id || out === next.non_striker_id;
    if (
      !atCrease ||
      (out !== next.batsman_id && !dismissesEitherBatter(ball.dismissal_type))
    ) {
      throw new DbQueryError("invalid_input", "22000");
    }
  } else if (
    fix.dismissed_player_id !== undefined ||
    fix.fielder_id !== undefined
  ) {
    throw new DbQueryError("invalid_input", "22000");
  }
  if (!next.batsman_id || next.batsman_id === next.non_striker_id)
    throw new DbQueryError("invalid_input", "22000");
  return next;
}

/** The players a correction names are in the squads they played for. */
async function requireSquadsHold(
  t: ScoringTx,
  match: MatchesRow,
  innings: InningsRow,
  fixes: readonly BallPlayersFix[],
): Promise<void> {
  const fieldingTeam =
    innings.team_id === match.team1_id ? match.team2_id : match.team1_id;
  const named = (keys: (keyof BallPlayersFix)[]) =>
    new Set(fixes.flatMap((f) => keys.map((k) => f[k]).filter(isId)));
  await requireInSquad(
    t,
    innings.team_id,
    named(["batsman_id", "non_striker_id", "dismissed_player_id"]),
  );
  await requireInSquad(t, fieldingTeam, named(["bowler_id", "fielder_id"]));
}

function isId(v: unknown): v is string {
  return typeof v === "string" && v !== "";
}

async function requireInSquad(
  t: ScoringTx,
  teamId: string | null | undefined,
  ids: Set<string>,
): Promise<void> {
  if (ids.size === 0) return;
  if (!teamId) throw new DbQueryError("player_not_in_team", "22000");
  const roster = await t.where<TeamPlayersRow>("team_players", [
    ["team_id", "==", teamId],
  ]);
  const squad = new Set(roster.map((r) => r.user_id));
  if ([...ids].some((id) => !squad.has(id)))
    throw new DbQueryError("player_not_in_team", "22000");
}

/**
 * The batting rows numbered in the order the log brings each batter in:
 * their first entry at either end, ties (the openers) in their stored
 * order; rows the log does not name come after.
 */
function inLogOrder(
  rows: BattingPerformancesRow[],
  balls: readonly BallByBallRow[],
): BattingPerformancesRow[] {
  const first = new Map<string, number>();
  sortBySeq([...balls]).forEach((b, i) => {
    for (const id of [b.batsman_id, b.non_striker_id])
      if (id && !first.has(id)) first.set(id, i);
  });
  const rank = (r: BattingPerformancesRow) =>
    first.get(r.user_id) ?? Number.POSITIVE_INFINITY;
  return [...rows]
    .sort(
      (a, b) =>
        rank(a) - rank(b) ||
        (a.batting_position ?? 0) - (b.batting_position ?? 0),
    )
    .map((r, i) => ({ ...r, batting_position: i + 1 }));
}

// ---------------------------------------------------------------------------
// end_innings
// ---------------------------------------------------------------------------

/**
 * Ends the current innings. `inningsNumber`, when given, is the innings the
 * scorer meant: once it has ended (the last ball closed it before a queued
 * End innings arrived) or is not the current one, nothing is done and the
 * current state is returned, so a replayed End innings never ends the next
 * innings. Without it (actions queued by older clients), as before.
 * `declared`: in a two-innings match, the batting side declared (Law 15;
 * before a ball, a forfeit), which the scorecard marks; ignored otherwise.
 */
export async function endInnings(
  ctx: ScoringContext,
  matchId: string,
  inningsNumber?: number | null,
  declared = false,
): Promise<ScoringState> {
  await requireAdmin(ctx, matchId);
  const now = new Date().toISOString();

  const tracked = await runOnce(ctx, async (t) => {
    const match = await t.doc<MatchesRow>("matches", matchId);
    if (!match) throw new DbQueryError("match_not_found", "22000");
    const { all, current } = await currentInningsOf(t, match);
    await guardClientAction(t, ctx, match, current);
    if (
      inningsNumber != null &&
      (current?.innings_number !== inningsNumber || current.is_completed)
    ) {
      // Nothing written, like an action already applied.
      throw new ActionAlreadyApplied();
    }
    if (!current || current.is_completed)
      throw new DbQueryError("no_open_innings", "22000");
    const declares = declared && isTwoInningsMatch(match);
    if (declares) t.patch("innings", current.id, { declared: true });
    await applyAdvance(
      t,
      match,
      declares ? { ...current, declared: true } : current,
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
// draw_match
// ---------------------------------------------------------------------------

/**
 * Ends a two-innings match as a draw (Law 16.3: not won or tied when time
 * ran out). The innings in play closes where it stands, so its batters'
 * and bowlers' figures join their records as any finished innings does; an
 * innings opened but not started (no ball, no event) is dropped, as it was
 * never played. Only a live two-innings match.
 */
export async function drawMatch(
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
    if (!isTwoInningsMatch(match)) {
      throw new DbQueryError("draw_needs_two_innings", "22000");
    }
    if (match.status !== "live") {
      throw new DbQueryError("match_not_live", "22000");
    }
    const { innings, currentNumber } = closeForDraw(t, match, all, current, now);
    t.patch("matches", matchId, {
      status: "completed",
      current_innings: currentNumber,
      actual_end_time: now,
      result_type: "draw",
      winning_team_id: null,
      win_margin_type: null,
      win_margin: null,
      result_description: "Match drawn",
      play_break: null,
      updated_at: now,
    });
    await syncMatchRecords(t, match.id, match, innings, now);
    return match;
  });
  if (!tracked) return recordState(ctx.ds, matchId);
  const [before, overs] = tracked;

  return finishWithState(ctx, matchId, before, overs);
}

/**
 * The third innings and the follow-on it can still take: it is the
 * innings in play of a live match and has no ball yet. Refused otherwise.
 */
function followOnInPlay(
  match: MatchesRow,
  all: WithId<InningsRow>[],
  current: WithId<InningsRow> | null,
): { third: WithId<InningsRow>; option: FollowOnOption } {
  const third = all.find((i) => i.innings_number === 3);
  const started =
    !!third && ((third.total_balls ?? 0) > 0 || !!third.last_ball);
  const option = followOnOf(match, all, started);
  const inPlay = match.status === "live" && !!third && current?.id === third.id;
  if (!option || !third || !inPlay) {
    throw new DbQueryError("follow_on_unavailable", "22000");
  }
  return { third, option };
}

/**
 * The innings in play when a match is drawn: closed where it stands, or
 * dropped when opened but not started (never the first). The innings as
 * they will be stored, and the match's current innings after.
 */
function closeForDraw(
  t: ScoringTx,
  match: MatchesRow,
  all: WithId<InningsRow>[],
  current: WithId<InningsRow> | null,
  now: string,
): { innings: WithId<InningsRow>[]; currentNumber: number } {
  if (!current || current.is_completed) {
    return { innings: all, currentNumber: match.current_innings ?? 1 };
  }
  const untouched =
    (current.total_balls ?? 0) === 0 &&
    !current.last_ball &&
    current.innings_number > 1;
  if (untouched) {
    t.delete("innings", current.id);
    return {
      innings: all.filter((i) => i.id !== current.id),
      currentNumber: current.innings_number - 1,
    };
  }
  t.patch("innings", current.id, { is_completed: true, updated_at: now });
  return {
    innings: replaceInnings(all, [{ ...current, is_completed: true }]),
    currentNumber: current.innings_number,
  };
}

// ---------------------------------------------------------------------------
// set_follow_on
// ---------------------------------------------------------------------------

/**
 * The follow-on (Law 14) in a two-innings match: the side that batted
 * first, ahead by at least the lead the match's days need, makes the other
 * side bat again (`enforce`), or bats itself (the third innings as opened).
 * Only before the third innings' first ball, which is still to be decided
 * then; a crease picked for the side that no longer bats is cleared.
 */
export async function setFollowOn(
  ctx: ScoringContext,
  matchId: string,
  enforce: boolean,
): Promise<ScoringState> {
  await requireAdmin(ctx, matchId);
  const now = new Date().toISOString();

  const tracked = await runOnce(ctx, async (t) => {
    const match = await t.doc<MatchesRow>("matches", matchId);
    if (!match) throw new DbQueryError("match_not_found", "22000");
    const { all, current } = await currentInningsOf(t, match);
    await guardClientAction(t, ctx, match, current);
    const { third, option } = followOnInPlay(match, all, current);
    const teamId = enforce ? option.trailerId : option.leaderId;
    if (third.team_id === teamId && Boolean(third.follow_on) === enforce) {
      throw new ActionAlreadyApplied();
    }
    t.patch("innings", third.id, {
      team_id: teamId,
      follow_on: enforce ? true : null,
      ...(third.team_id === teamId ? {} : EMPTY_SCORECARD),
      updated_at: now,
    });
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
    // Only from a tie: not again once one has started (a second scorer, a
    // queued start replayed), nor while an innings is in play.
    if (
      match.status !== "completed" ||
      match.result_type !== "tie" ||
      isTwoInningsMatch(match)
    )
      throw new DbQueryError("super_over_needs_tie", "22000");

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
// recomputes the innings, then settles it as a delivery would
// (`settleAfterEdit`: an innings now complete closes).
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
    await settleAfterEdit(t, match, innings, after, sortBySeq(balls), now);
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
 * - when that team has already batted in this pair of innings (the match,
 *   or the same super over), in that innings, whose total goes up (and with
 *   it the current target, by the same runs);
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

    // Their innings in the same pair (the match, or this super over): a
    // super over's runs never reach the main match's innings. A two-innings
    // match is one pair: their latest innings takes them (Law 41.17).
    const pairStart =
      isTwoInningsMatch(match) && !isSuperOverInnings(match, current.innings_number)
        ? 1
        : current.innings_number % 2 === 1
          ? current.innings_number
          : current.innings_number - 1;
    const theirs = all
      .filter(
        (i) =>
          i.team_id === args.p_team_id &&
          i.innings_number >= pairStart &&
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

/**
 * The wrong bowler was recorded: credit what the over's latest bowler
 * (`overBowlingOf`) has in the current over to another. A bowler who left
 * the over before them keeps theirs, and events without a bowler (a
 * retirement, a fielding-side penalty) stay events.
 */
export async function reassignOverBowler(
  ctx: ScoringContext,
  args: { p_match_id: string; p_bowler_id: string },
): Promise<null> {
  return editCurrentInnings(
    ctx,
    args.p_match_id,
    ({ match, innings, bundle }) => {
      const { current_over } = matchPositionOf(match, innings);
      const from = overBowlingOf(bundle.balls, current_over)?.bowlerId;
      return {
        balls: bundle.balls.map((b) =>
          from && b.over_number === current_over && b.bowler_id === from
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
  let inningsNumber: number | null = null;
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
    inningsNumber = innings.innings_number;
    return match;
  });
  if (tracked) {
    await finishQuietly(
      ctx,
      matchId,
      tracked[0],
      tracked[1],
      lastChangeBy(ctx, now, {
        kind: "replace_batter",
        innings_number: inningsNumber,
        from_id: from,
        to_id: to,
      }),
    );
  }
  return null;
}

// ---------------------------------------------------------------------------
// replace_player
// ---------------------------------------------------------------------------

/**
 * The team a player played for in a match: the batting side of an innings
 * they batted in, else the fielding side of one they bowled or fielded in.
 */
function teamOfPlayer(
  match: Pick<MatchesRow, "team1_id" | "team2_id">,
  innings: readonly InningsRow[],
  playerId: string,
): string | null {
  for (const inn of innings) {
    if ((inn.batting ?? []).some((b) => b.user_id === playerId)) {
      return inn.team_id;
    }
  }
  for (const inn of innings) {
    const fielded =
      (inn.bowling ?? []).some((b) => b.user_id === playerId) ||
      (inn.fall_of_wickets ?? []).some((f) => f.fielder_id === playerId);
    if (!fielded) continue;
    if (inn.team_id === match.team1_id) return match.team2_id;
    if (inn.team_id === match.team2_id) return match.team1_id;
  }
  return null;
}

/**
 * A player recorded by mistake, replaced throughout the match (NV Play's
 * Replace, Play-Cricket's replacement player): every mention of `from` in
 * the match's scorecards and ball log (batting, bowling, fielding, the
 * crease) and as player of the match becomes `to`, during the match or
 * after it, whether or not they are out or still bowling. `to` must be in
 * the squad of the team `from` played for and appear nowhere in the match
 * (two people's figures would merge). Only ids change, so the figures stay
 * as scored; the player records and statistics follow
 * (`syncMatchRecords`), and the transaction stages the summaries, the live
 * documents and the ball-log archives (`finalize`).
 */
export async function replacePlayer(
  ctx: ScoringContext,
  args: { p_match_id: string; p_from_id: string; p_to_id: string },
): Promise<{ team_id: string }> {
  const { p_match_id: matchId, p_from_id: from, p_to_id: to } = args;
  if (!from || !to || from === to)
    throw new DbQueryError("invalid_input", "22000");
  const teamId = await movePlayer(ctx, matchId, from, to, { asScorer: true });
  return { team_id: teamId! };
}

/**
 * Moves `from`'s whole part in a match to `to`, as `replacePlayer` does.
 * `asScorer`: a scorer's correction, who must score the match, for a player
 * in it, with `to` in that team's squad. Without it (merging two profiles,
 * whose caller is checked there): a match `from` has no part in is left
 * alone and answers null, and `to` need not be in the squad.
 */
export async function movePlayer(
  ctx: ScoringContext,
  matchId: string,
  from: string,
  to: string,
  { asScorer }: { asScorer: boolean },
): Promise<string | null> {
  const now = new Date().toISOString();
  const [[match, teamId], changed] = await runTracked(ctx, async (t) => {
    const match = await t.doc<MatchesRow>("matches", matchId);
    if (asScorer) await requireAdminOf(ctx, matchId, match);
    if (!match) throw new DbQueryError("match_not_found", "22000");
    const [innings, overs] = await Promise.all([
      t.where<InningsRow>("innings", [["match_id", "==", matchId]]),
      t.where<OversRow>(OVERS_COLLECTION, [["match_id", "==", matchId]]),
    ]);
    const mentions = (id: string) => {
      const needle = JSON.stringify(id);
      return (
        innings.some((inn) =>
          SCORECARD_FIELDS.some((f) => JSON.stringify(inn[f] ?? null).includes(needle)),
        ) || overs.some((o) => JSON.stringify(o.balls ?? []).includes(needle))
      );
    };
    if (!mentions(from)) {
      if (asScorer) throw new DbQueryError("player_not_in_match", "22000");
      return [match, null] as const;
    }
    if (mentions(to)) throw new DbQueryError("player_already_in_match", "22000");
    const teamId = teamOfPlayer(match, innings, from);
    if (!teamId) throw new DbQueryError("player_not_in_match", "22000");
    if (asScorer) {
      const roster = await t.where<TeamPlayersRow>("team_players", [
        ["team_id", "==", teamId],
        ["user_id", "==", to],
      ]);
      if (roster.length === 0)
        throw new DbQueryError("player_not_in_team", "22000");
    }

    const after = innings.map((inn) => {
      const patch: Record<string, unknown> = {};
      for (const field of SCORECARD_FIELDS) {
        if (!(field in inn)) continue;
        const next = replaceDeep(inn[field], from, to);
        if (JSON.stringify(next) !== JSON.stringify(inn[field]))
          patch[field] = next;
      }
      if (Object.keys(patch).length) t.patch("innings", inn.id, patch);
      return { ...inn, ...patch } as WithId<InningsRow>;
    });
    for (const over of overs) {
      const balls = replaceDeep(over.balls, from, to);
      if (JSON.stringify(balls) !== JSON.stringify(over.balls))
        t.patch(OVERS_COLLECTION, over.id, { balls });
    }
    const matchAfter =
      match.player_of_the_match_id === from
        ? { ...match, player_of_the_match_id: to }
        : match;
    if (matchAfter !== match) {
      t.patch("matches", matchId, { player_of_the_match_id: to });
    }
    await syncMatchRecords(t, matchId, matchAfter, after, now);
    return [match, teamId] as const;
  });
  if (teamId) {
    // A scorer's Replace tells the other scorer; a merge of profiles is not
    // a scoring change.
    const lastChange = asScorer
      ? lastChangeBy(ctx, now, {
          kind: "replace_player",
          from_id: from,
          to_id: to,
        })
      : undefined;
    await finishQuietly(ctx, matchId, match, changed, lastChange);
  }
  return teamId;
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
    const refused = creaseChangeError(current, strikerId, nonStrikerId);
    if (refused) throw new DbQueryError(refused, "22000");

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
