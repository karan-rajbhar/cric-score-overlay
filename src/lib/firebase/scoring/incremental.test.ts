/**
 * Equivalence proof for incremental scoring.
 *
 * Every delivery is recorded twice, on two in-memory databases: once
 * through the incremental `record_ball` path and once with it disabled (the
 * full recompute of the innings from its ball log). After every step the
 * two databases must hold the same scorecards, innings, matches, ball logs,
 * events and live_state docs (timestamps and random ids aside), the
 * incremental database must equal a fresh recompute of its own ball log, the
 * returned `record_state` must match the previous implementation, and the
 * live_state doc must match the previous full-read live view.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { MemoryDataSource, type Doc } from "../datasource";
import { liveRowOf, type LiveStateDoc } from "../live-state";
import {
  recordBall,
  setCurrentBatsmen,
  setCurrentBowler,
  startSuperOver,
  undoLastBall,
  type ScoringContext,
} from "../rpc/scoring";
import type {
  BallByBallRow,
  BattingPerformancesRow,
  BowlingPerformancesRow,
  InningsRow,
  MatchesRow,
} from "../types";
import { buildLiveMatchState } from "../views";
import {
  countingDataSource,
  legacyBuildLiveMatchState,
  legacyRecordState,
  type IoStats,
} from "./__fixtures__/legacy";
import { recomputeInnings } from "./recompute";

type Seed = Record<string, Doc[]>;
const seed = JSON.parse(
  readFileSync(join(process.cwd(), "firebase/seed/data.json"), "utf8"),
) as Seed;
const ADMIN = "admin-user";

// ---------------------------------------------------------------------------
// Harness
// ---------------------------------------------------------------------------

interface BallSpec {
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

type Step =
  | { kind: "ball"; ball: BallSpec }
  | { kind: "undo" }
  | { kind: "super_over" };

interface Side {
  ds: MemoryDataSource;
  stats: IoStats;
  ctx: ScoringContext;
}

interface BallCost {
  reads: number;
  writes: number;
  /**
   * A plain delivery: no event logged (boundary / wicket), no new fall of
   * wicket or partnership row, and no innings or match status change.
   */
  normal: boolean;
}

class Replay {
  readonly inc: Side;
  readonly full: Side;
  readonly costs: BallCost[] = [];
  readonly fullCosts: BallCost[] = [];
  private nextBatter = new Map<string, number>();
  private bowlerTurn = new Map<string, number>();
  private lastBowler = new Map<string, string>();

  constructor(
    tables: Seed,
    private readonly matchId: string,
    private readonly rosters: Record<string, string[]>,
  ) {
    const make = (incremental: boolean): Side => {
      const { ds, stats } = countingDataSource(
        new MemoryDataSource(structuredClone(tables)),
      );
      return { ds, stats, ctx: { ds, uid: ADMIN, incremental } };
    };
    this.inc = make(true);
    this.full = make(false);
  }

  async match(side: Side): Promise<MatchesRow> {
    return (await side.ds.getById(
      "matches",
      this.matchId,
    )) as unknown as MatchesRow;
  }

  async currentInnings(side: Side): Promise<InningsRow | null> {
    const match = await this.match(side);
    const all = (await side.ds.query("innings", [
      { field: "match_id", op: "==", value: this.matchId },
    ])) as unknown as InningsRow[];
    return (
      all.find((i) => i.innings_number === (match.current_innings ?? 1)) ?? null
    );
  }

  /** Make the side's crease / bowler match the spec (or pick the next). */
  private async prepare(side: Side, spec: BallSpec): Promise<BallSpec> {
    const innings = (await this.currentInnings(side))!;
    const batting = (await side.ds.query("batting_performances", [
      { field: "innings_id", op: "==", value: innings.id },
    ])) as unknown as BattingPerformancesRow[];
    const bowling = (await side.ds.query("bowling_performances", [
      { field: "innings_id", op: "==", value: innings.id },
    ])) as unknown as BowlingPerformancesRow[];
    const striker = batting.find((b) => b.is_current_batsman && b.is_striker);
    const nonStriker = batting.find(
      (b) => b.is_current_batsman && !b.is_striker,
    );
    const roster = this.rosters[innings.team_id] ?? [];
    const used = new Set(batting.map((b) => b.user_id));
    const key = `${side === this.inc ? "inc" : "full"}:${innings.innings_number}`;
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
      await setCurrentBatsmen(side.ctx, this.matchId, s, ns);
    }

    const match = await this.match(side);
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
      await setCurrentBowler(side.ctx, this.matchId, bowler);
    }
    return { ...spec, batsman: s, nonStriker: ns, bowler };
  }

  private async recordOn(side: Side, spec: BallSpec, costs: BallCost[]) {
    const p = await this.prepare(side, spec);
    const events = await side.ds.query("match_events", [
      { field: "match_id", op: "==", value: this.matchId },
    ]);
    const fowBefore = (await side.ds.query("fall_of_wickets", [])).length;
    const partnershipsBefore = (await side.ds.query("partnerships", [])).length;
    const matchBefore = await this.match(side);
    const snap = { ...side.stats };
    const state = await recordBall(side.ctx, {
      p_match_id: this.matchId,
      p_bowler_id: p.bowler!,
      p_batsman_id: p.batsman!,
      p_non_striker_id: p.nonStriker!,
      p_runs_scored: p.runs ?? 0,
      p_extras: p.extras ?? 0,
      p_extra_type: p.extraType ?? null,
      p_is_wicket: Boolean(p.wicket),
      p_dismissal_type: p.wicket ?? null,
      p_fielder_id: p.fielder ?? null,
      p_dismissed_player_id: p.wicket
        ? p.dismissed === "non_striker"
          ? p.nonStriker!
          : p.batsman!
        : null,
    });
    const reads = side.stats.reads - snap.reads;
    const writes = side.stats.writes - snap.writes;
    const matchAfter = await this.match(side);
    const eventsAfter = await side.ds.query("match_events", [
      { field: "match_id", op: "==", value: this.matchId },
    ]);
    const fowAfter = (await side.ds.query("fall_of_wickets", [])).length;
    const partnershipsAfter = (await side.ds.query("partnerships", [])).length;
    costs.push({
      reads,
      writes,
      normal:
        eventsAfter.length === events.length &&
        fowAfter === fowBefore &&
        partnershipsAfter === partnershipsBefore &&
        matchAfter.current_innings === matchBefore.current_innings &&
        matchAfter.status === matchBefore.status,
    });
    return state;
  }

  async step(step: Step): Promise<void> {
    if (step.kind === "undo") {
      const a = await undoLastBall(this.inc.ctx, this.matchId);
      const b = await undoLastBall(this.full.ctx, this.matchId);
      expect(a).toEqual(b);
    } else if (step.kind === "super_over") {
      await startSuperOver(this.inc.ctx, this.matchId);
      await startSuperOver(this.full.ctx, this.matchId);
    } else {
      const a = await this.recordOn(this.inc, step.ball, this.costs);
      const b = await this.recordOn(this.full, step.ball, this.fullCosts);
      expect(a).toEqual(b);
      const legacy = await legacyRecordState(this.inc.ds, this.matchId);
      const { innings_break: _ignored, ...rest } = a;
      void _ignored;
      expect(rest).toEqual(legacy);
    }
    await this.check();
  }

  async check(): Promise<void> {
    expect(await snapshot(this.inc.ds, this.matchId)).toEqual(
      await snapshot(this.full.ds, this.matchId),
    );
    await expectMatchesRecompute(this.inc.ds, this.matchId);
    const live = (await this.inc.ds.getById(
      "live_state",
      this.matchId,
    )) as unknown as LiveStateDoc | null;
    const legacyLive = await legacyBuildLiveMatchState(
      this.inc.ds,
      this.matchId,
    );
    if (live) expect(liveRowOf(live)).toEqual(legacyLive);
    expect(await buildLiveMatchState(this.inc.ds, this.matchId)).toEqual(
      legacyLive,
    );
  }

  async isOver(): Promise<boolean> {
    return (await this.match(this.inc)).status !== "live";
  }
}

const VOLATILE = new Set(["created_at", "updated_at", "actual_end_time"]);

/** Comparable dump of everything a match owns (ids / timestamps normalized). */
async function snapshot(ds: MemoryDataSource, matchId: string) {
  const innings = (await ds.query("innings", [
    { field: "match_id", op: "==", value: matchId },
  ])) as unknown as InningsRow[];
  const alias = new Map(innings.map((i) => [i.id, `I${i.innings_number}`]));
  const norm = (doc: Doc, dropId = false): string => {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(doc)) {
      if (VOLATILE.has(k)) continue;
      if (dropId && k === "id") continue;
      if (k === "version" || k === "refs") continue;
      out[k] = v;
    }
    let text = JSON.stringify(out, Object.keys(out).sort());
    for (const [id, a] of alias) text = text.split(id).join(a);
    return text;
  };
  const dump: Record<string, string[]> = {};
  for (const table of [
    "matches",
    "innings",
    "batting_performances",
    "bowling_performances",
    "fall_of_wickets",
    "partnerships",
    "ball_by_ball",
    "match_events",
    "live_state",
  ]) {
    const docs =
      table === "matches" || table === "live_state"
        ? [await ds.getById(table, matchId)].filter((d): d is Doc => !!d)
        : await ds.query(table, [
            { field: "match_id", op: "==", value: matchId },
          ]);
    const dropId = table === "ball_by_ball" || table === "match_events";
    dump[table] = docs.map((d) => norm(d, dropId)).sort();
  }
  return dump;
}

/** The stored rows of every innings equal a fresh recompute of its balls. */
async function expectMatchesRecompute(ds: MemoryDataSource, matchId: string) {
  const match = (await ds.getById("matches", matchId)) as unknown as MatchesRow;
  const innings = (await ds.query("innings", [
    { field: "match_id", op: "==", value: matchId },
  ])) as unknown as InningsRow[];
  for (const inn of innings) {
    const q = (table: string) =>
      ds.query(table, [{ field: "innings_id", op: "==", value: inn.id }]);
    const balls = ((await q("ball_by_ball")) as unknown as BallByBallRow[])
      .slice()
      .sort((a, b) => a.seq - b.seq);
    const batting = (await q(
      "batting_performances",
    )) as unknown as BattingPerformancesRow[];
    const bowling = (await q(
      "bowling_performances",
    )) as unknown as BowlingPerformancesRow[];
    if (!balls.length) continue;
    const out = recomputeInnings({
      match,
      innings: inn,
      balls,
      existingBatting: batting,
      existingBowling: bowling,
      now: "x",
    });
    const strip = (rows: object[]) =>
      rows
        .map((r) => {
          const c: Record<string, unknown> = { ...r };
          for (const k of VOLATILE) delete c[k];
          return JSON.stringify(c, Object.keys(c).sort());
        })
        .sort();
    // Batting flags may legitimately differ after set_current_batsmen; this
    // check runs right after a delivery, when they must agree.
    expect(strip(batting)).toEqual(strip(out.batting));
    expect(strip(bowling)).toEqual(strip(out.bowling));
    expect(strip(await q("fall_of_wickets"))).toEqual(strip(out.fallOfWickets));
    expect(strip(await q("partnerships"))).toEqual(strip(out.partnerships));
    for (const [k, v] of Object.entries(out.inningsPatch)) {
      if (k === "updated_at") continue;
      expect((inn as unknown as Record<string, unknown>)[k]).toEqual(v);
    }
  }
}

// ---------------------------------------------------------------------------
// Seed matches
// ---------------------------------------------------------------------------

function rostersFrom(tables: Seed): Record<string, string[]> {
  const rosters: Record<string, string[]> = {};
  for (const tp of tables.team_players ?? []) {
    const team = tp.team_id as string;
    (rosters[team] ??= []).push(tp.user_id as string);
  }
  return rosters;
}

/** Seed tables with one match reset to "live, first ball not yet bowled". */
function freshMatchTables(matchId: string): Seed {
  const base: Seed = {};
  for (const table of [
    "users",
    "teams",
    "team_players",
    "tournaments",
    "clubs",
    "club_memberships",
  ]) {
    base[table] = structuredClone(seed[table] ?? []);
  }
  const match = structuredClone(seed.matches!.find((m) => m.id === matchId)!);
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
  const first = seed.innings!.find(
    (i) => i.match_id === matchId && i.innings_number === 1,
  )!;
  base.innings = [
    {
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
    },
  ];
  return base;
}

const SEED_MATCHES = Array.from(
  new Set((seed.ball_by_ball ?? []).map((b) => b.match_id as string)),
);

const allCosts: BallCost[] = [];
const allFullCosts: BallCost[] = [];

describe("incremental record_ball equals a full recompute", () => {
  for (const matchId of SEED_MATCHES) {
    it(`replays seed match ${matchId.slice(-3)} ball by ball`, async () => {
      const inningsNumber = new Map(
        seed.innings!.map((i) => [i.id, i.innings_number as number]),
      );
      const balls = seed
        .ball_by_ball!.filter((b) => b.match_id === matchId)
        .sort((a, b) => (a.seq as number) - (b.seq as number));
      const replay = new Replay(
        freshMatchTables(matchId),
        matchId,
        rostersFrom(seed),
      );
      let recorded = 0;
      for (const b of balls) {
        if (await replay.isOver()) break;
        const innings = await replay.currentInnings(replay.inc);
        // Skip deliveries of an innings the replay already closed.
        if (
          innings?.innings_number !== inningsNumber.get(b.innings_id as string)
        )
          continue;
        const dismissed = b.dismissed_player_id ?? b.batsman_id;
        await replay.step({
          kind: "ball",
          // Outcomes only: the harness picks batters / bowlers itself so the
          // engine's own strike rotation and over boundaries are respected.
          ball: {
            runs: b.runs_scored as number,
            extras: b.extras as number,
            extraType: b.extra_type as string | null,
            wicket: b.is_wicket
              ? ((b.dismissal_type as string) ?? "bowled")
              : null,
            dismissed:
              b.is_wicket && dismissed === b.non_striker_id
                ? "non_striker"
                : "striker",
            fielder: b.fielder_id as string | null,
          },
        });
        recorded += 1;
      }
      expect(recorded).toBeGreaterThan(50);
      allCosts.push(...replay.costs);
      allFullCosts.push(...replay.fullCosts);
    }, 60_000);
  }
});

// ---------------------------------------------------------------------------
// Synthetic edge cases
// ---------------------------------------------------------------------------

const A = Array.from({ length: 11 }, (_, i) => `a${i + 1}`);
const B = Array.from({ length: 11 }, (_, i) => `b${i + 1}`);

function syntheticTables(overrides: Partial<MatchesRow> = {}): Seed {
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

const ball = (b: BallSpec): Step => ({ kind: "ball", ball: b });
const dots = (n: number, extra: BallSpec = {}): Step[] =>
  Array.from({ length: n }, () => ball({ runs: 0, ...extra }));

async function play(
  tables: Seed,
  steps: Step[],
  { stopWhenOver = true, countCost = true } = {},
) {
  const replay = new Replay(tables, "M", { TA: A, TB: B });
  for (const step of steps) {
    if (stopWhenOver && step.kind === "ball" && (await replay.isOver())) break;
    await replay.step(step);
  }
  if (countCost) {
    allCosts.push(...replay.costs);
    allFullCosts.push(...replay.fullCosts);
  }
  return replay;
}

describe("incremental record_ball edge cases", () => {
  it("extras, run-outs, free-hit wicket, retirements, maidens, undo and a chase finished mid-over", async () => {
    const replay = await play(syntheticTables({ overs_per_innings: 3 }), [
      // over 1 (innings 1): every kind of extra
      ball({ runs: 1 }),
      ball({ extras: 1, extraType: "wide" }),
      ball({ runs: 4, extras: 1, extraType: "no_ball" }),
      // free hit after the no-ball: only a run-out can dismiss, take one
      ball({ runs: 1, wicket: "run_out", dismissed: "non_striker" }),
      ball({ extras: 2, extraType: "bye" }),
      ball({ extras: 1, extraType: "leg_bye" }),
      ball({ extras: 5, extraType: "penalty" }),
      ball({ runs: 3, extras: 2, extraType: "wide" }),
      ball({ runs: 2 }),
      { kind: "undo" },
      ball({ runs: 2, wicket: "run_out", dismissed: "striker" }),
      // over 2: retired hurt, a new pair, then a maiden-free over end
      ball({ runs: 0, wicket: "retired_hurt" }),
      ball({ runs: 1, wicket: "run_out", dismissed: "striker" }),
      ball({ runs: 6 }),
      ball({ runs: 0, wicket: "caught", fielder: "b2" }),
      ball({ runs: 4 }),
      ball({ runs: 0, wicket: "retired_out" }),
      ball({ runs: 1 }),
      // over 3: a maiden; undo the ball that closes innings 1, bowl it again
      ...dots(6),
      { kind: "undo" },
      ball({ runs: 0 }),
      // innings 2 chases 36: a maiden, 34 off the next over, done mid-over
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
    ]);
    const match = await replay.match(replay.inc);
    expect(match.status).toBe("completed");
    expect(match.winning_team_id).toBe("TB");
  });

  it("ends innings by all-out and decides the match on runs", async () => {
    const replay = await play(syntheticTables({ wickets_per_innings: 3 }), [
      ball({ runs: 4 }),
      ball({ runs: 0, wicket: "bowled" }),
      ball({ runs: 2 }),
      ball({ runs: 0, wicket: "lbw" }),
      ball({ runs: 1, wicket: "run_out", dismissed: "non_striker" }),
      // innings 2
      ball({ runs: 1 }),
      ball({ runs: 0, wicket: "stumped" }),
      ball({ runs: 0, wicket: "hit_wicket" }),
      ball({ runs: 0, wicket: "caught", fielder: "a3" }),
    ]);
    const match = await replay.match(replay.inc);
    expect(match.status).toBe("completed");
    expect(match.win_margin_type).toBe("runs");
  });

  it("plays a tie and a super over", async () => {
    const replay = await play(
      syntheticTables({ overs_per_innings: 1 }),
      [
        ball({ runs: 4 }),
        ...dots(5),
        // innings 2 ties on 4
        ball({ runs: 2 }),
        ball({ runs: 2 }),
        ...dots(4),
        { kind: "super_over" },
        // innings 3 (super over, 2 wickets cap)
        ball({ runs: 1 }),
        ball({ runs: 0, wicket: "bowled" }),
        ball({ extras: 1, extraType: "wide" }),
        ball({ runs: 0, wicket: "caught", fielder: "a1" }),
        // innings 4: chase 2 runs, completed mid-over
        ball({ extras: 1, extraType: "no_ball" }),
        ball({ runs: 1 }),
        ball({ runs: 1 }),
      ],
      { stopWhenOver: false },
    );
    const match = await replay.match(replay.inc);
    expect(match.status).toBe("completed");
    expect(match.current_innings).toBe(4);
    expect(match.result_description).toContain("Super Over");
  });

  it("applies batsman-credit rules for wides / no-balls", async () => {
    await play(
      syntheticTables({
        wide_runs_to_batsman: true,
        noball_extras_to_batsman: true,
        wide_counts_as_ball_faced: true,
      }),
      [
        ball({ runs: 1, extras: 1, extraType: "wide" }),
        ball({ runs: 2, extras: 1, extraType: "no_ball" }),
        ball({ extras: 1, extraType: "bonus" }),
        ...dots(6),
        // scorer swaps the pair without a wicket: a new partnership starts
        ball({ batsman: "a5", nonStriker: "a6", runs: 1 }),
        ball({ runs: 1 }),
      ],
    );
  });

  it("falls back to a full recompute under max_balls_per_over", async () => {
    // Over boundaries here depend on every delivery of the over, so these
    // balls take the full path (and are left out of the cost figures).
    const steps: Step[] = [
      ball({ extras: 1, extraType: "wide" }),
      ...dots(3),
      ball({ extras: 1, extraType: "wide" }),
      ball({ extras: 1, extraType: "wide" }),
      ball({ extras: 1, extraType: "wide" }),
      ...dots(3),
    ];
    await play(syntheticTables({ max_balls_per_over: 7 }), steps, {
      countCost: false,
    });
  });
});

// ---------------------------------------------------------------------------
// Cost
// ---------------------------------------------------------------------------

describe("record_ball document cost", () => {
  let summary: {
    balls: number;
    normalBalls: number;
    avgReads: number;
    avgWrites: number;
    normalAvgReads: number;
    normalMaxReads: number;
    normalAvgWrites: number;
    normalMaxWrites: number;
    fullAvgReads: number;
    fullAvgWrites: number;
    fullNormalAvgReads: number;
  };
  beforeAll(() => {
    const avg = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / xs.length;
    const normal = allCosts.filter((c) => c.normal);
    const fullNormal = allFullCosts.filter((c) => c.normal);
    summary = {
      balls: allCosts.length,
      normalBalls: normal.length,
      avgReads: avg(allCosts.map((c) => c.reads)),
      avgWrites: avg(allCosts.map((c) => c.writes)),
      normalAvgReads: avg(normal.map((c) => c.reads)),
      normalMaxReads: Math.max(...normal.map((c) => c.reads)),
      normalAvgWrites: avg(normal.map((c) => c.writes)),
      normalMaxWrites: Math.max(...normal.map((c) => c.writes)),
      fullAvgReads: avg(allFullCosts.map((c) => c.reads)),
      fullAvgWrites: avg(allFullCosts.map((c) => c.writes)),
      fullNormalAvgReads: avg(fullNormal.map((c) => c.reads)),
    };
    console.info("record_ball cost per ball", summary);
  });

  it("stays within ~10-15 reads and ~5-8 writes per normal delivery", () => {
    expect(summary.normalBalls).toBeGreaterThan(500);
    expect(summary.normalAvgReads).toBeLessThanOrEqual(15);
    // First ball of an over / of a new player reads a name or two more.
    expect(summary.normalMaxReads).toBeLessThanOrEqual(24);
    expect(summary.normalAvgWrites).toBeLessThanOrEqual(8);
    expect(summary.normalMaxWrites).toBeLessThanOrEqual(8);
    // Including wickets, boundaries and innings changes.
    expect(summary.avgReads).toBeLessThanOrEqual(15);
    expect(summary.avgWrites).toBeLessThanOrEqual(9);
    // The full recompute path, for comparison.
    expect(summary.fullAvgReads).toBeGreaterThan(summary.avgReads * 4);
  });
});
