/**
 * Scoring engine mutations (server only), ported from the PL/pgSQL
 * functions `record_ball`, `undo_last_ball`, `update_ball`, `end_innings`,
 * `start_super_over`, `recompute_innings`, `set_current_batsmen` and
 * `set_current_bowler`.
 *
 * Each mutation runs inside one Firestore transaction: every document is
 * read first, the new innings state is derived with the pure recompute
 * engine, and all derived rows are written together so a crash can never
 * leave half-updated scorecards.
 */

import "server-only";
import type { Firestore, Transaction } from "firebase-admin/firestore";
import type { ScoringState } from "~/app/matches/types";
import type { DataSource } from "../datasource";
import { DbQueryError, newId } from "../query-builder";
import { recomputeInnings, type RecomputeOutput } from "../scoring/recompute";
import { advanceAfterInnings, inningsLimits } from "../scoring/result";
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
import { isMatchAdmin } from "./auth-helpers";
import { maybeRecalculateStandings } from "./standings";
import { recordState } from "./state";

export interface ScoringContext {
  db: Firestore;
  ds: DataSource;
  uid: string | null;
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

type WithId<T> = T & { id: string };

function stripId(data: object): Record<string, unknown> {
  const copy: Record<string, unknown> = { ...data };
  delete copy.id;
  return copy;
}

/** Thin wrapper so every read goes through the transaction. */
class Tx {
  constructor(
    private readonly db: Firestore,
    private readonly tx: Transaction,
  ) {}

  async doc<T>(table: string, id: string): Promise<WithId<T> | null> {
    const snap = await this.tx.get(this.db.collection(table).doc(id));
    return snap.exists
      ? ({ ...(snap.data() as T), id: snap.id } as WithId<T>)
      : null;
  }

  async docs<T>(table: string, ids: string[]): Promise<WithId<T>[]> {
    const unique = Array.from(new Set(ids.filter(Boolean)));
    if (!unique.length) return [];
    const snaps = await this.tx.getAll(
      ...unique.map((id) => this.db.collection(table).doc(id)),
    );
    return snaps
      .filter((s) => s.exists)
      .map((s) => ({ ...(s.data() as T), id: s.id }) as WithId<T>);
  }

  async where<T>(
    table: string,
    clauses: [string, "==" | "in", unknown][],
  ): Promise<WithId<T>[]> {
    let q: FirebaseFirestore.Query = this.db.collection(table);
    for (const [field, op, value] of clauses) q = q.where(field, op, value);
    const snap = await this.tx.get(q);
    return snap.docs.map(
      (d) => ({ ...(d.data() as T), id: d.id }) as WithId<T>,
    );
  }

  put(table: string, id: string, data: object): void {
    this.tx.set(this.db.collection(table).doc(id), stripId(data));
  }

  patch(table: string, id: string, data: object): void {
    this.tx.set(this.db.collection(table).doc(id), stripId(data), {
      merge: true,
    });
  }

  delete(table: string, id: string): void {
    this.tx.delete(this.db.collection(table).doc(id));
  }
}

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
  t: Tx,
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

function writeRecompute(
  t: Tx,
  bundle: InningsBundle,
  out: RecomputeOutput,
  now: string,
): void {
  t.patch(
    "innings",
    bundle.innings.id,
    out.inningsPatch as Record<string, unknown>,
  );
  t.patch("matches", bundle.match.id, { ...out.matchPatch, updated_at: now });
  for (const bp of out.batting)
    t.put(
      "batting_performances",
      bp.id,
      bp as unknown as Record<string, unknown>,
    );
  for (const bw of out.bowling)
    t.put(
      "bowling_performances",
      bw.id,
      bw as unknown as Record<string, unknown>,
    );

  const keepFow = new Set(out.fallOfWickets.map((f) => f.id));
  for (const existing of bundle.fallOfWickets) {
    if (!keepFow.has(existing.id)) t.delete("fall_of_wickets", existing.id);
  }
  for (const f of out.fallOfWickets)
    t.put("fall_of_wickets", f.id, f as unknown as Record<string, unknown>);

  const keepPartnerships = new Set(out.partnerships.map((p) => p.id));
  for (const existing of bundle.partnerships) {
    if (!keepPartnerships.has(existing.id))
      t.delete("partnerships", existing.id);
  }
  for (const p of out.partnerships)
    t.put("partnerships", p.id, p as unknown as Record<string, unknown>);
}

function logEvent(
  t: Tx,
  matchId: string,
  eventType: string,
  data: Record<string, unknown>,
  now: string,
) {
  t.put("match_events", newId(), {
    match_id: matchId,
    event_type: eventType,
    event_data: data,
    created_by: null,
    created_at: now,
  });
}

function applyAdvance(
  t: Tx,
  match: MatchesRow,
  completed: InningsRow,
  allInnings: InningsRow[],
  teams: TeamsRow[],
  now: string,
): void {
  const teamNames: Record<string, string | undefined> = {};
  for (const team of teams) teamNames[team.id] = team.name;
  const out = advanceAfterInnings(
    { match, completed, allInnings, teamNames, now },
    newId(),
  );
  t.patch(
    "innings",
    completed.id,
    out.completedInningsPatch as Record<string, unknown>,
  );
  t.patch("matches", match.id, out.matchPatch as Record<string, unknown>);
  if (out.nextInnings) {
    t.put(
      "innings",
      out.nextInnings.id,
      out.nextInnings as unknown as Record<string, unknown>,
    );
  }
  if (out.matchEndEvent) {
    logEvent(t, match.id, "match_end", out.matchEndEvent, now);
  }
}

async function requireAdmin(
  ctx: ScoringContext,
  matchId: string,
): Promise<void> {
  if (!(await isMatchAdmin(ctx.ds, matchId, ctx.uid))) {
    throw new DbQueryError("not_authorized", "42501");
  }
}

async function currentInningsOf(
  t: Tx,
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
  return recordState(ctx.ds, matchId);
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

export async function recordBall(
  ctx: ScoringContext,
  args: RecordBallArgs,
): Promise<ScoringState> {
  const matchId = args.p_match_id;
  await requireAdmin(ctx, matchId);

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

  const now = new Date().toISOString();
  const before = await ctx.db.runTransaction(async (tx) => {
    const t = new Tx(ctx.db, tx);
    const match = await t.doc<MatchesRow>("matches", matchId);
    if (!match) throw new DbQueryError("match_not_found", "22000");
    if (match.status !== "live")
      throw new DbQueryError("match_not_live", "22000");

    const { all, current: innings } = await currentInningsOf(t, match);
    if (!innings || innings.is_completed)
      throw new DbQueryError("no_open_innings", "22000");

    const [bundle, teams] = await Promise.all([
      loadInningsBundle(t, match, innings),
      t.docs<TeamsRow>("teams", [match.team1_id, match.team2_id]),
    ]);

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
          b.is_current_batsman &&
          b.is_striker &&
          b.user_id === args.p_batsman_id,
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
      match.balls_per_over && match.balls_per_over > 0
        ? match.balls_per_over
        : 6;
    const totalBalls = innings.total_balls ?? 0;
    const maxSeq = bundle.balls.reduce((m, b) => Math.max(m, b.seq ?? 0), 0);
    const seq = Math.max(match.last_ball_seq ?? 0, maxSeq) + 1;

    const ball: WithId<BallByBallRow> = {
      id: newId(),
      match_id: matchId,
      innings_id: innings.id,
      over_number: Math.floor(totalBalls / bpo),
      ball_number: (totalBalls % bpo) + 1,
      bowler_id: args.p_bowler_id,
      batsman_id: args.p_batsman_id,
      non_striker_id: args.p_non_striker_id,
      runs_scored: args.p_runs_scored ?? 0,
      extras: args.p_extras ?? 0,
      extra_type: extraType,
      is_wicket: isWicket,
      dismissal_type: isWicket ? dismissalType : null,
      fielder_id: args.p_fielder_id ?? null,
      dismissed_player_id: dismissedId,
      commentary: args.p_commentary ?? null,
      shot_zone: args.p_shot_zone ?? null,
      seq,
      created_at: now,
    };
    t.put("ball_by_ball", ball.id, ball);

    const out = runRecompute(bundle, [...bundle.balls, ball], now);
    writeRecompute(t, bundle, out, now);
    t.patch("matches", matchId, { last_ball_seq: seq });

    if (isWicket) {
      logEvent(
        t,
        matchId,
        "wicket",
        {
          batsman: dismissedId,
          dismissal: dismissalType,
          over: ball.over_number,
        },
        now,
      );
    } else if (ball.runs_scored === 4) {
      logEvent(
        t,
        matchId,
        "boundary_four",
        { batsman: ball.batsman_id, over: ball.over_number },
        now,
      );
    } else if (ball.runs_scored === 6) {
      logEvent(
        t,
        matchId,
        "boundary_six",
        { batsman: ball.batsman_id, over: ball.over_number },
        now,
      );
    }

    const updatedInnings: WithId<InningsRow> = {
      ...innings,
      ...out.inningsPatch,
    };
    const limits = inningsLimits(match, innings.innings_number);
    const targetReached =
      updatedInnings.target_runs !== null &&
      updatedInnings.target_runs !== undefined &&
      (updatedInnings.total_runs ?? 0) >= updatedInnings.target_runs;
    if (
      targetReached ||
      (updatedInnings.total_wickets ?? 0) >= limits.wicketsCap ||
      (updatedInnings.total_balls ?? 0) >= limits.maxBalls
    ) {
      applyAdvance(
        t,
        { ...match, ...out.matchPatch },
        updatedInnings,
        all.map((i) => (i.id === innings.id ? updatedInnings : i)),
        teams,
        now,
      );
    }
    return match;
  });

  const state = await finishWithState(ctx, matchId, before);
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

  const before = await ctx.db.runTransaction(async (tx) => {
    const t = new Tx(ctx.db, tx);
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

  const before = await ctx.db.runTransaction(async (tx) => {
    const t = new Tx(ctx.db, tx);
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

  const before = await ctx.db.runTransaction(async (tx) => {
    const t = new Tx(ctx.db, tx);
    const match = await t.doc<MatchesRow>("matches", matchId);
    if (!match) throw new DbQueryError("match_not_found", "22000");
    const { all, current } = await currentInningsOf(t, match);
    if (!current || current.is_completed)
      throw new DbQueryError("no_open_innings", "22000");
    const teams = await t.docs<TeamsRow>("teams", [
      match.team1_id,
      match.team2_id,
    ]);
    applyAdvance(t, match, current, all, teams, now);
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

  const before = await ctx.db.runTransaction(async (tx) => {
    const t = new Tx(ctx.db, tx);
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
  const matchId = await ctx.db.runTransaction(async (tx) => {
    const t = new Tx(ctx.db, tx);
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

  await ctx.db.runTransaction(async (tx) => {
    const t = new Tx(ctx.db, tx);
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
      t.patch("batting_performances", b.id, {
        is_current_batsman:
          b.user_id === strikerId || b.user_id === nonStrikerId,
        is_striker: b.user_id === strikerId,
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

  await ctx.db.runTransaction(async (tx) => {
    const t = new Tx(ctx.db, tx);
    const match = await t.doc<MatchesRow>("matches", matchId);
    if (!match) throw new DbQueryError("match_not_found", "22000");
    const { current } = await currentInningsOf(t, match);
    if (!current) throw new DbQueryError("no_open_innings", "22000");

    const [batting, bowlerTeams, balls, bowling] = await Promise.all([
      t.where<BattingPerformancesRow>("batting_performances", [
        ["innings_id", "==", current.id],
      ]),
      t.where<TeamPlayersRow>("team_players", [["user_id", "==", bowlerId]]),
      t.where<BallByBallRow>("ball_by_ball", [
        ["innings_id", "==", current.id],
      ]),
      t.where<BowlingPerformancesRow>("bowling_performances", [
        ["innings_id", "==", current.id],
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

    const currentOver = match.current_over ?? 0;
    if (currentOver > 0) {
      const bowledPrevious = balls.some(
        (b) => b.bowler_id === bowlerId && b.over_number === currentOver - 1,
      );
      if (bowledPrevious)
        throw new DbQueryError("same_bowler_next_over", "22000");
    }

    const existing = bowling.find((b) => b.user_id === bowlerId);
    for (const b of bowling) {
      t.patch("bowling_performances", b.id, {
        is_current_bowler: b.user_id === bowlerId,
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

  return { ok: true };
}
