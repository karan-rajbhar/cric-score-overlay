/**
 * Golden replay harness: scripted scoring sessions whose state after every
 * step is reduced to a hash.
 *
 * `golden.json` holds the hashes recorded with the engine as it was before
 * schema stage 2 (one document per scorecard row and per ball). Replaying
 * the same steps on the current engine and hashing the legacy-shaped view of
 * its storage (innings arrays and over documents expanded back into rows by
 * `legacyRowsDataSource`) must give identical hashes: same scorecards, ball
 * log, innings and match fields, live_state and returned ScoringState.
 */

import { createHash } from "node:crypto";
import { inningsSummaryEntry, inningsSummaryOf } from "../../derive.mjs";
import type { ScoringState } from "~/app/matches/types";
import type { DataSource, Doc } from "../../datasource";
import {
  recomputeInningsRpc,
  recordBall,
  setCurrentBatsmen,
  setCurrentBowler,
  startSuperOver,
  endInnings,
  undoLastBall,
  type ScoringContext,
} from "../../rpc/scoring";
import type {
  BallByBallRow,
  BattingPerformancesRow,
  BowlingPerformancesRow,
  InningsRow,
  MatchesRow,
} from "../../types";

export type Seed = Record<string, Doc[]>;
export const ADMIN = "admin-user";

export interface BallSpec {
  batsman?: string;
  nonStriker?: string;
  bowler?: string;
  runs?: number;
  extras?: number;
  extraType?: string | null;
  wicket?: string | null;
  dismissed?: "striker" | "non_striker";
  fielder?: string | null;
}

export interface UpdateSpec {
  /** innings_number of the ball to edit and its index by seq (negative counts from the end). */
  innings: number;
  index: number;
  runs?: number;
  extras?: number;
  extraType?: string | null;
  wicket?: string | null;
  fielder?: string | null;
  /** Re-assign the delivery to another batter / bowler. */
  batsman?: string;
  bowler?: string;
}

export type Step =
  | { kind: "ball"; ball: BallSpec }
  | { kind: "undo" }
  | { kind: "super_over" }
  | { kind: "end_innings" }
  | { kind: "update"; update: UpdateSpec }
  | {
      kind: "retire";
      who: "striker" | "non_striker";
      type: "retired_hurt" | "retired_out";
    }
  | { kind: "penalty"; runs: number; type: "penalty" | "bonus" }
  | { kind: "reassign_bowler"; bowler: string }
  | { kind: "recompute"; innings: number };

/**
 * The mutations that changed shape in stage 2 (formerly a builder write
 * followed by `recompute_innings`), supplied by the engine under test.
 */
export interface Driver {
  ctx: ScoringContext;
  /** Document reads / writes made through `ctx.ds`, when counted. */
  stats?: { reads: number; writes: number };
  /** Legacy-shaped reader (rows per collection). */
  view: DataSource;
  updateBall(args: {
    p_match_id: string;
    p_ball_id: string;
    p_runs_scored: number;
    p_extras: number;
    p_extra_type: string | null;
    p_is_wicket: boolean;
    p_dismissal_type: string | null;
    p_fielder_id: string | null;
    p_dismissed_player_id: string | null;
    batsmanId?: string;
    bowlerId?: string;
  }): Promise<ScoringState>;
  retire(matchId: string, playerId: string, type: string): Promise<void>;
  penalty(matchId: string, runs: number, type: string): Promise<void>;
  reassignBowler(matchId: string, bowlerId: string): Promise<void>;
}

const VOLATILE = new Set(["created_at", "updated_at", "actual_end_time"]);
/** Fields stage 2 added to innings documents (not part of the legacy row). */
export const STAGE2_INNINGS_FIELDS = new Set([
  "batting",
  "bowling",
  "fall_of_wickets",
  "partnerships",
  "last_ball",
  "last_over_bowler_id",
]);

/** Fields stage 3 added to match documents (not part of the legacy row). */
export const STAGE3_MATCH_FIELDS = new Set([
  "innings_summary",
  "title_lower",
  "search_prefixes",
  "tournament_snapshot",
  "club_snapshot",
]);

const LEGACY_TABLES = [
  "matches",
  "innings",
  "batting_performances",
  "bowling_performances",
  "fall_of_wickets",
  "partnerships",
  "ball_by_ball",
  "live_state",
] as const;

/** Comparable dump of everything a match owns (ids / timestamps normalized). */
export async function legacySnapshot(
  view: DataSource,
  matchId: string,
): Promise<Record<string, string[]>> {
  const innings = (await view.query("innings", [
    { field: "match_id", op: "==", value: matchId },
  ])) as unknown as InningsRow[];
  const alias = new Map(innings.map((i) => [i.id, `I${i.innings_number}`]));
  const norm = (table: string, doc: Doc): string => {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(doc)) {
      if (VOLATILE.has(k)) continue;
      if (table === "ball_by_ball" && k === "id") continue;
      if (k === "version" || k === "refs") continue;
      // Stage 3 derived match fields (search keys, the innings summary,
      // which incremental.test.ts checks against the innings instead).
      if (table === "matches" && STAGE3_MATCH_FIELDS.has(k)) continue;
      if (table === "innings" && STAGE2_INNINGS_FIELDS.has(k)) continue;
      out[k] = v === undefined ? null : v;
    }
    let text = JSON.stringify(out, Object.keys(out).sort());
    for (const [id, a] of alias) text = text.split(id).join(a);
    return text;
  };
  const dump: Record<string, string[]> = {};
  for (const table of LEGACY_TABLES) {
    const docs =
      table === "matches" || table === "live_state"
        ? [await view.getById(table, matchId)].filter((d): d is Doc => !!d)
        : await view.query(table, [
            { field: "match_id", op: "==", value: matchId },
          ]);
    dump[table] = docs.map((d) => norm(table, d)).sort();
  }
  return dump;
}

export function hashOf(value: unknown): string {
  return createHash("sha256")
    .update(JSON.stringify(value))
    .digest("hex")
    .slice(0, 24);
}

function normResult(result: unknown): unknown {
  if (result instanceof Error) return { error: result.message };
  return result ?? null;
}

// ---------------------------------------------------------------------------
// Replay
// ---------------------------------------------------------------------------

export interface StepCost {
  kind: Step["kind"];
  reads: number;
  writes: number;
  /**
   * A plain delivery: no new fall of wicket or partnership, and no innings
   * or match status change.
   */
  normal: boolean;
}

export class GoldenReplay {
  readonly hashes: string[] = [];
  readonly costs: StepCost[] = [];
  readonly snapshots: unknown[] = [];
  /** Extra checks run after every step (tests). */
  afterStep?: (step: Step) => Promise<void>;
  private nextBatter = new Map<number, number>();
  private bowlerTurn = new Map<number, number>();
  private lastBowler = new Map<number, string>();

  constructor(
    readonly driver: Driver,
    readonly matchId: string,
    private readonly rosters: Record<string, string[]>,
    private readonly keepSnapshots = false,
  ) {}

  async match(): Promise<MatchesRow> {
    return (await this.driver.view.getById(
      "matches",
      this.matchId,
    )) as unknown as MatchesRow;
  }

  async inningsList(): Promise<InningsRow[]> {
    return (await this.driver.view.query("innings", [
      { field: "match_id", op: "==", value: this.matchId },
    ])) as unknown as InningsRow[];
  }

  async currentInnings(): Promise<InningsRow | null> {
    const match = await this.match();
    return (
      (await this.inningsList()).find(
        (i) => i.innings_number === (match.current_innings ?? 1),
      ) ?? null
    );
  }

  private async rows<T>(table: string, inningsId: string): Promise<T[]> {
    return (await this.driver.view.query(table, [
      { field: "innings_id", op: "==", value: inningsId },
    ])) as unknown as T[];
  }

  /** Make the crease / bowler match the spec (or pick the next). */
  private async prepare(
    spec: BallSpec,
  ): Promise<
    Required<Pick<BallSpec, "batsman" | "nonStriker" | "bowler">> & BallSpec
  > {
    const ctx = this.driver.ctx;
    const innings = (await this.currentInnings())!;
    const batting = await this.rows<BattingPerformancesRow>(
      "batting_performances",
      innings.id,
    );
    const bowling = await this.rows<BowlingPerformancesRow>(
      "bowling_performances",
      innings.id,
    );
    const striker = batting.find((b) => b.is_current_batsman && b.is_striker);
    const nonStriker = batting.find(
      (b) => b.is_current_batsman && !b.is_striker,
    );
    const roster = this.rosters[innings.team_id] ?? [];
    const used = new Set(batting.map((b) => b.user_id));
    const key = innings.innings_number;
    const pickNew = () => {
      let i = this.nextBatter.get(key) ?? 0;
      while (i < roster.length && used.has(roster[i]!)) i += 1;
      this.nextBatter.set(key, i + 1);
      used.add(roster[i]!);
      return roster[i]!;
    };
    const s = spec.batsman ?? striker?.user_id ?? pickNew();
    const ns = spec.nonStriker ?? nonStriker?.user_id ?? pickNew();
    if (s !== striker?.user_id || ns !== nonStriker?.user_id) {
      await setCurrentBatsmen(ctx, this.matchId, s, ns);
    }

    const match = await this.match();
    const bowlingTeam =
      innings.team_id === match.team1_id ? match.team2_id : match.team1_id;
    const current = bowling.find((b) => b.is_current_bowler);
    let bowler = spec.bowler ?? current?.user_id;
    if (!bowler) {
      // Rosters may overlap; skip the batters at the crease and whoever
      // bowled the previous over.
      const pool = (this.rosters[bowlingTeam] ?? []).slice(-5);
      const previous = this.lastBowler.get(key);
      let turn = this.bowlerTurn.get(key) ?? 0;
      for (let k = 0; k < pool.length * 2; k += 1, turn += 1) {
        const candidate = pool[turn % pool.length]!;
        if (candidate !== s && candidate !== ns && candidate !== previous) {
          bowler = candidate;
          break;
        }
      }
      this.bowlerTurn.set(key, turn + 1);
    }
    if (!bowler) throw new Error("no eligible bowler");
    this.lastBowler.set(key, bowler);
    if (bowler !== current?.user_id) {
      await setCurrentBowler(ctx, this.matchId, bowler);
    }
    return { ...spec, batsman: s, nonStriker: ns, bowler };
  }

  private async pickBall(spec: UpdateSpec): Promise<BallByBallRow> {
    const innings = (await this.inningsList()).find(
      (i) => i.innings_number === spec.innings,
    )!;
    const balls = (
      await this.rows<BallByBallRow>("ball_by_ball", innings.id)
    ).sort((a, b) => a.seq - b.seq);
    const idx = spec.index < 0 ? balls.length + spec.index : spec.index;
    return balls[idx]!;
  }

  private async run(step: Step): Promise<unknown> {
    const { ctx } = this.driver;
    const matchId = this.matchId;
    switch (step.kind) {
      case "undo":
        return undoLastBall(ctx, matchId);
      case "super_over":
        return startSuperOver(ctx, matchId);
      case "end_innings":
        return endInnings(ctx, matchId);
      case "recompute": {
        const innings = (await this.inningsList()).find(
          (i) => i.innings_number === step.innings,
        )!;
        return recomputeInningsRpc(ctx, innings.id);
      }
      case "update": {
        const u = step.update;
        const ball = await this.pickBall(u);
        const isWicket = u.wicket !== undefined ? !!u.wicket : !!ball.is_wicket;
        return this.driver.updateBall({
          p_match_id: matchId,
          p_ball_id: ball.id,
          p_runs_scored: u.runs ?? ball.runs_scored ?? 0,
          p_extras: u.extras ?? ball.extras ?? 0,
          p_extra_type:
            u.extraType !== undefined ? u.extraType : (ball.extra_type ?? null),
          p_is_wicket: isWicket,
          p_dismissal_type: isWicket
            ? (u.wicket ?? ball.dismissal_type ?? "bowled")
            : null,
          p_fielder_id:
            u.fielder !== undefined ? u.fielder : (ball.fielder_id ?? null),
          p_dismissed_player_id: isWicket
            ? (ball.dismissed_player_id ?? null)
            : null,
          batsmanId: u.batsman,
          bowlerId: u.bowler,
        });
      }
      case "retire": {
        const innings = (await this.currentInnings())!;
        const batting = await this.rows<BattingPerformancesRow>(
          "batting_performances",
          innings.id,
        );
        const who = batting.find(
          (b) =>
            b.is_current_batsman &&
            (step.who === "striker" ? b.is_striker : !b.is_striker),
        );
        if (!who) throw new Error("nobody to retire");
        await this.driver.retire(matchId, who.user_id, step.type);
        return null;
      }
      case "penalty":
        await this.driver.penalty(matchId, step.runs, step.type);
        return null;
      case "reassign_bowler":
        await this.driver.reassignBowler(matchId, step.bowler);
        return null;
      case "ball": {
        const p = await this.prepare(step.ball);
        return this.measured(step.kind, () =>
          recordBall(ctx, {
            p_match_id: matchId,
            p_bowler_id: p.bowler,
            p_batsman_id: p.batsman,
            p_non_striker_id: p.nonStriker,
            p_runs_scored: p.runs ?? 0,
            p_extras: p.extras ?? 0,
            p_extra_type: p.extraType ?? null,
            p_is_wicket: Boolean(p.wicket),
            p_dismissal_type: p.wicket ?? null,
            p_fielder_id: p.fielder ?? null,
            p_dismissed_player_id: p.wicket
              ? p.dismissed === "non_striker"
                ? p.nonStriker
                : p.batsman
              : null,
          }),
        );
      }
    }
  }

  private async shape(): Promise<string> {
    const match = await this.match();
    const count = async (table: string) =>
      (
        await this.driver.view.query(table, [
          { field: "match_id", op: "==", value: this.matchId },
        ])
      ).length;
    return JSON.stringify([
      match.current_innings,
      match.status,
      await count("fall_of_wickets"),
      await count("partnerships"),
    ]);
  }

  /** Runs one mutation, counting its reads / writes when the driver can. */
  private async measured<R>(
    kind: Step["kind"],
    fn: () => Promise<R>,
  ): Promise<R> {
    const stats = this.driver.stats;
    if (!stats) return fn();
    const shape = await this.shape();
    const before = { ...stats };
    let failed = false;
    try {
      return await fn();
    } catch (err) {
      failed = true;
      throw err;
    } finally {
      const reads = stats.reads - before.reads;
      const writes = stats.writes - before.writes;
      if (!failed) {
        this.costs.push({
          kind,
          reads,
          writes,
          normal: (await this.shape()) === shape,
        });
      }
    }
  }

  async step(step: Step): Promise<unknown> {
    let result: unknown;
    try {
      result =
        step.kind === "ball"
          ? await this.run(step)
          : await this.measured(step.kind, () => this.run(step));
    } catch (err) {
      result = err instanceof Error ? err : new Error(String(err));
    }
    const snapshot = {
      step: step.kind,
      result: normResult(result),
      state: await legacySnapshot(this.driver.view, this.matchId),
    };
    this.hashes.push(hashOf(snapshot));
    if (this.keepSnapshots) this.snapshots.push(snapshot);
    await this.afterStep?.(step);
    return result;
  }

  async isOver(): Promise<boolean> {
    return (await this.match()).status !== "live";
  }
}

// ---------------------------------------------------------------------------
// Scenarios
// ---------------------------------------------------------------------------

export function rostersFrom(tables: Seed): Record<string, string[]> {
  const rosters: Record<string, string[]> = {};
  for (const tp of tables.team_players ?? []) {
    const team = tp.team_id as string;
    (rosters[team] ??= []).push(tp.user_id as string);
  }
  return rosters;
}

/**
 * Legacy-shaped seed tables with one match reset to "live, first ball not
 * yet bowled". `legacySeed` holds rows per collection (ball_by_ball, ...).
 */
export function freshMatchTables(legacySeed: Seed, matchId: string): Seed {
  const base: Seed = {};
  for (const table of [
    "users",
    "teams",
    "team_players",
    "tournaments",
    "clubs",
    "club_memberships",
  ]) {
    base[table] = structuredClone(legacySeed[table] ?? []);
  }
  const match = structuredClone(
    legacySeed.matches!.find((m) => m.id === matchId)!,
  );
  Object.assign(match, {
    status: "live",
    current_innings: 1,
    current_over: 0,
    current_ball: 0,
    last_ball_seq: 0,
    result_type: null,
    result_description: null,
    winning_team_id: null,
    win_margin: null,
    win_margin_type: null,
    actual_end_time: null,
    created_by: ADMIN,
  });
  base.matches = [match];
  const first = legacySeed.innings!.find(
    (i) => i.match_id === matchId && i.innings_number === 1,
  )!;
  const fresh: Doc = {
    ...structuredClone(first),
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
  };
  for (const k of STAGE2_INNINGS_FIELDS) delete fresh[k];
  base.innings = [fresh];
  match.innings_summary = inningsSummaryOf([fresh]);
  return base;
}

export function seedMatchIds(legacySeed: Seed): string[] {
  return Array.from(
    new Set((legacySeed.ball_by_ball ?? []).map((b) => b.match_id as string)),
  );
}

/** The seed match's deliveries as outcome-only steps (the harness picks players). */
export function seedSteps(
  legacySeed: Seed,
  matchId: string,
): {
  steps: Step[];
  inningsOf: number[];
} {
  const inningsNumber = new Map(
    legacySeed.innings!.map((i) => [i.id, i.innings_number as number]),
  );
  const balls = legacySeed
    .ball_by_ball!.filter((b) => b.match_id === matchId)
    .sort((a, b) => (a.seq as number) - (b.seq as number));
  const steps: Step[] = [];
  const inningsOf: number[] = [];
  for (const b of balls) {
    const dismissed = b.dismissed_player_id ?? b.batsman_id;
    steps.push({
      kind: "ball",
      ball: {
        runs: b.runs_scored as number,
        extras: b.extras as number,
        extraType: b.extra_type as string | null,
        wicket: b.is_wicket ? ((b.dismissal_type as string) ?? "bowled") : null,
        dismissed:
          b.is_wicket && dismissed === b.non_striker_id
            ? "non_striker"
            : "striker",
        fielder: b.fielder_id as string | null,
      },
    });
    inningsOf.push(inningsNumber.get(b.innings_id as string) ?? 0);
  }
  return { steps, inningsOf };
}

/** Replays a seed match; deliveries of an innings already closed are skipped. */
export async function replaySeedMatch(
  replay: GoldenReplay,
  legacySeed: Seed,
  matchId: string,
): Promise<number> {
  const { steps, inningsOf } = seedSteps(legacySeed, matchId);
  let recorded = 0;
  for (let i = 0; i < steps.length; i += 1) {
    if (await replay.isOver()) break;
    const innings = await replay.currentInnings();
    if (innings?.innings_number !== inningsOf[i]) continue;
    await replay.step(steps[i]!);
    recorded += 1;
  }
  return recorded;
}

export const A = Array.from({ length: 11 }, (_, i) => `a${i + 1}`);
export const B = Array.from({ length: 11 }, (_, i) => `b${i + 1}`);

export function syntheticTables(overrides: Partial<MatchesRow> = {}): Seed {
  const users = [...A, ...B].map((id) => ({
    id,
    full_name: `Player ${id.toUpperCase()}`,
  }));
  const teamPlayers = [
    ...A.map((u) => ({ id: `tp_${u}`, team_id: "TA", user_id: u })),
    ...B.map((u) => ({ id: `tp_${u}`, team_id: "TB", user_id: u })),
  ];
  return {
    users,
    teams: [
      { id: "TA", name: "Alpha", short_name: "ALP", logo_url: null },
      { id: "TB", name: "Bravo", short_name: "BRV", logo_url: null },
    ],
    team_players: teamPlayers,
    tournaments: [{ id: "T1", name: "Cup" }],
    matches: [
      {
        id: "M",
        title: "Alpha v Bravo",
        status: "live",
        team1_id: "TA",
        team2_id: "TB",
        tournament_id: "T1",
        current_innings: 1,
        current_over: 0,
        current_ball: 0,
        overs_per_innings: 2,
        balls_per_over: 6,
        max_balls_per_over: null,
        wickets_per_innings: 10,
        wide_runs_to_batsman: false,
        noball_extras_to_batsman: false,
        wide_counts_as_ball_faced: false,
        last_ball_seq: 0,
        created_by: ADMIN,
        match_admins: [],
        innings_summary: [
          inningsSummaryEntry({
            id: "INN1",
            team_id: "TA",
            innings_number: 1,
            total_runs: 0,
            total_wickets: 0,
            total_overs: 0,
            total_balls: 0,
            extras_total: 0,
            is_completed: false,
            target_runs: null,
          }),
        ],
        ...overrides,
      } as unknown as Doc,
    ],
    innings: [
      {
        id: "INN1",
        match_id: "M",
        team_id: "TA",
        innings_number: 1,
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
      },
    ],
  };
}

export const SYNTHETIC_ROSTERS = { TA: A, TB: B };

const ball = (b: BallSpec): Step => ({ kind: "ball", ball: b });
const dots = (n: number, extra: BallSpec = {}): Step[] =>
  Array.from({ length: n }, () => ball({ runs: 0, ...extra }));

export interface SyntheticScenario {
  name: string;
  overrides: Partial<MatchesRow>;
  steps: Step[];
  /** Keep replaying after the match is decided (super overs). */
  continueWhenOver?: boolean;
  /** Excluded from the per-ball cost figures (full recompute by design). */
  noCost?: boolean;
}

export const SYNTHETIC_SCENARIOS: SyntheticScenario[] = [
  {
    name: "extras, run-outs, free-hit wicket, retirements, maidens, undo and a chase finished mid-over",
    overrides: { overs_per_innings: 3 },
    steps: [
      ball({ runs: 1 }),
      ball({ extras: 1, extraType: "wide" }),
      ball({ runs: 4, extras: 1, extraType: "no_ball" }),
      ball({ runs: 1, wicket: "run_out", dismissed: "non_striker" }),
      ball({ extras: 2, extraType: "bye" }),
      ball({ extras: 1, extraType: "leg_bye" }),
      ball({ extras: 5, extraType: "penalty" }),
      ball({ runs: 3, extras: 2, extraType: "wide" }),
      ball({ runs: 2 }),
      { kind: "undo" },
      ball({ runs: 2, wicket: "run_out", dismissed: "striker" }),
      ball({ runs: 0, wicket: "retired_hurt" }),
      ball({ runs: 1, wicket: "run_out", dismissed: "striker" }),
      ball({ runs: 6 }),
      ball({ runs: 0, wicket: "caught", fielder: "b2" }),
      ball({ runs: 4 }),
      ball({ runs: 0, wicket: "retired_out" }),
      ball({ runs: 1 }),
      ...dots(6),
      { kind: "undo" },
      ball({ runs: 0 }),
      ...dots(6),
      ball({ runs: 4 }),
      ball({ runs: 6 }),
      ball({ runs: 6 }),
      ball({ runs: 6 }),
      ball({ runs: 6 }),
      ball({ runs: 6 }),
      ball({ runs: 1 }),
      ball({ runs: 1 }),
      ball({ runs: 1 }),
    ],
  },
  {
    name: "ends innings by all-out and decides the match on runs",
    overrides: { wickets_per_innings: 3 },
    steps: [
      ball({ runs: 4 }),
      ball({ runs: 0, wicket: "bowled" }),
      ball({ runs: 2 }),
      ball({ runs: 0, wicket: "lbw" }),
      ball({ runs: 1, wicket: "run_out", dismissed: "non_striker" }),
      ball({ runs: 1 }),
      ball({ runs: 0, wicket: "stumped" }),
      ball({ runs: 0, wicket: "hit_wicket" }),
      ball({ runs: 0, wicket: "caught", fielder: "a3" }),
    ],
  },
  {
    name: "plays a tie and a super over",
    overrides: { overs_per_innings: 1 },
    continueWhenOver: true,
    steps: [
      ball({ runs: 4 }),
      ...dots(5),
      ball({ runs: 2 }),
      ball({ runs: 2 }),
      ...dots(4),
      { kind: "super_over" },
      ball({ runs: 1 }),
      ball({ runs: 0, wicket: "bowled" }),
      ball({ extras: 1, extraType: "wide" }),
      ball({ runs: 0, wicket: "caught", fielder: "a1" }),
      ball({ extras: 1, extraType: "no_ball" }),
      ball({ runs: 1 }),
      ball({ runs: 1 }),
      // undo the super-over winner, then win it again
      { kind: "undo" },
      ball({ runs: 1 }),
    ],
  },
  {
    name: "applies batsman-credit rules for wides / no-balls",
    overrides: {
      wide_runs_to_batsman: true,
      noball_extras_to_batsman: true,
      wide_counts_as_ball_faced: true,
    },
    steps: [
      ball({ runs: 1, extras: 1, extraType: "wide" }),
      ball({ runs: 2, extras: 1, extraType: "no_ball" }),
      ball({ extras: 1, extraType: "bonus" }),
      ...dots(6),
      ball({ batsman: "a5", nonStriker: "a6", runs: 1 }),
      ball({ runs: 1 }),
    ],
  },
  {
    name: "falls back to a full recompute under max_balls_per_over",
    overrides: { max_balls_per_over: 7 },
    noCost: true,
    steps: [
      ball({ extras: 1, extraType: "wide" }),
      ...dots(3),
      ball({ extras: 1, extraType: "wide" }),
      ball({ extras: 1, extraType: "wide" }),
      ball({ extras: 1, extraType: "wide" }),
      ...dots(3),
    ],
  },
  {
    name: "edits: update_ball, retirements, penalties, bowler reassignment, recompute and a declared innings",
    overrides: { overs_per_innings: 3 },
    continueWhenOver: true,
    steps: [
      ball({ runs: 1 }),
      ball({ runs: 2 }),
      ball({ runs: 0 }),
      // edit the second ball of the innings into a boundary, then a wicket
      { kind: "update", update: { innings: 1, index: 1, runs: 4 } },
      {
        kind: "update",
        update: { innings: 1, index: 2, wicket: "caught", fielder: "b3" },
      },
      ball({ runs: 1 }),
      { kind: "retire", who: "striker", type: "retired_hurt" },
      ball({ runs: 2 }),
      { kind: "penalty", runs: 5, type: "penalty" },
      ball({ runs: 0 }),
      { kind: "penalty", runs: 2, type: "bonus" },
      ball({ runs: 1 }),
      { kind: "reassign_bowler", bowler: "b10" },
      ball({ runs: 3 }),
      // re-assign a delivery to another bowler (a new bowling row) and batter
      { kind: "update", update: { innings: 1, index: 0, bowler: "b11" } },
      {
        kind: "update",
        update: {
          innings: 1,
          index: -1,
          extras: 1,
          extraType: "wide",
          runs: 0,
        },
      },
      { kind: "recompute", innings: 1 },
      ball({ runs: 6 }),
      { kind: "retire", who: "non_striker", type: "retired_out" },
      ball({ runs: 1 }),
      ball({ runs: 0, wicket: "bowled" }),
      ...dots(3),
      { kind: "end_innings" },
      // innings 2, then edit innings 1 (now completed) and undo across
      ball({ runs: 4 }),
      ball({ runs: 1 }),
      { kind: "update", update: { innings: 1, index: 3, runs: 6 } },
      { kind: "recompute", innings: 1 },
      { kind: "undo" },
      { kind: "undo" },
      { kind: "undo" },
      ball({ runs: 2 }),
      { kind: "end_innings" },
      ball({ runs: 6 }),
      ball({ runs: 6 }),
      ball({ runs: 6 }),
      ball({ runs: 6 }),
      ball({ runs: 6 }),
      ball({ runs: 6 }),
      ball({ runs: 6 }),
      ball({ runs: 6 }),
      // match decided: edit a ball of the winning innings, then undo it open
      { kind: "update", update: { innings: 2, index: -1, runs: 1 } },
      { kind: "update", update: { innings: 2, index: 0, batsman: "b9" } },
      { kind: "undo" },
      ball({ runs: 6 }),
    ],
  },
];

export async function playSynthetic(
  driverFor: (tables: Seed) => Driver,
  scenario: SyntheticScenario,
  keepSnapshots = false,
  afterStep?: (replay: GoldenReplay, step: Step) => Promise<void>,
): Promise<GoldenReplay> {
  const tables = syntheticTables(scenario.overrides);
  const replay = new GoldenReplay(
    driverFor(tables),
    "M",
    SYNTHETIC_ROSTERS,
    keepSnapshots,
  );
  if (afterStep) replay.afterStep = (step) => afterStep(replay, step);
  for (const step of scenario.steps) {
    if (
      !scenario.continueWhenOver &&
      step.kind === "ball" &&
      (await replay.isOver())
    )
      break;
    await replay.step(step);
  }
  return replay;
}
