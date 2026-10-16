/**
 * Equivalence proof for the scoring engine on stage 2 storage (innings
 * scorecard arrays, one document per over, player_matches).
 *
 * Every scripted session (each seed match ball by ball, plus synthetic edge
 * cases: extras, run-outs, retirements, undo across innings, super overs,
 * update_ball, penalties, bowler re-assignment, recompute, declarations) is
 * replayed twice: through the incremental `record_ball` path and with it
 * disabled (full recompute of the innings from its ball log). After every
 * step:
 *
 * - the legacy-shaped view of the storage (innings arrays and over documents
 *   expanded back into rows), the live_state doc and the returned
 *   ScoringState hash to exactly the values recorded with the engine as it
 *   was before stage 2 (`__fixtures__/golden.json`);
 * - the stored scorecards equal a fresh recompute of the stored ball log,
 *   and the innings caches (`last_ball`, `last_over_bowler_id`) and the
 *   `player_matches` records equal what they are derived from;
 * - live_state and `record_state` equal the previous full-read
 *   implementations (`__fixtures__/legacy.ts`).
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { liveRowOf, type LiveStateDoc } from "../live-state";
import { recordState } from "../rpc/state";
import {
  ballLogOf,
  lastBallOf,
  lastOverBowlerOf,
  overDocId,
  playerMatchDocs,
  type OversRow,
  type PlayerMatchesRow,
} from "../scorecard";
import type {
  BallByBallRow,
  BattingPerformancesRow,
  BowlingPerformancesRow,
  InningsRow,
  MatchesRow,
} from "../types";
import { buildLiveMatchState } from "../views";
import {
  freshMatchTables,
  GoldenReplay,
  playSynthetic,
  replaySeedMatch,
  rostersFrom,
  seedMatchIds,
  SYNTHETIC_SCENARIOS,
  type Seed,
  type StepCost,
} from "./__fixtures__/golden";
import {
  legacyBuildLiveMatchState,
  legacyRecordState,
} from "./__fixtures__/legacy";
import {
  legacySeedOf,
  stage2Driver,
  type Stage2Side,
} from "./__fixtures__/stage2";
import { recomputeInnings } from "./recompute";

const seed = legacySeedOf(
  JSON.parse(
    readFileSync(join(process.cwd(), "firebase/seed/data.json"), "utf8"),
  ) as Seed,
);
const golden = JSON.parse(
  readFileSync(
    join(process.cwd(), "src/lib/firebase/scoring/__fixtures__/golden.json"),
    "utf8",
  ),
) as { seed: Record<string, string[]>; synthetic: Record<string, string[]> };

const VOLATILE = new Set(["created_at", "updated_at"]);

function strip(rows: object[]): string[] {
  return rows
    .map((r) => {
      const c: Record<string, unknown> = { ...r };
      for (const k of VOLATILE) delete c[k];
      return JSON.stringify(c, Object.keys(c).sort());
    })
    .sort();
}

/** Every derived document of the match agrees with what it derives from. */
async function checkInvariants(side: Stage2Side, matchId: string) {
  const { ds, view } = side;
  const match = (await ds.getById("matches", matchId)) as unknown as MatchesRow;
  const innings = (await ds.query("innings", [
    { field: "match_id", op: "==", value: matchId },
  ])) as unknown as InningsRow[];
  const bpo =
    match.balls_per_over && match.balls_per_over > 0 ? match.balls_per_over : 6;

  for (const inn of innings) {
    const overs = (await ds.query("overs", [
      { field: "innings_id", op: "==", value: inn.id },
    ])) as unknown as OversRow[];
    for (const o of overs) {
      expect(o.id).toBe(overDocId(inn.id, o.over_number));
      expect(o.match_id).toBe(matchId);
      expect(o.balls.length).toBeGreaterThan(0);
      const seqs = o.balls.map((b) => b.seq);
      expect(seqs).toEqual([...seqs].sort((a, b) => a - b));
    }
    const balls = ballLogOf(overs);
    // Caches the fast paths rely on.
    expect(inn.last_ball ?? null).toEqual(lastBallOf(balls));
    expect(inn.last_over_bowler_id ?? null).toBe(
      lastOverBowlerOf(balls, inn.total_balls ?? 0, bpo),
    );
    if (!balls.length) continue;
    const q = (table: string) =>
      view.query(table, [{ field: "innings_id", op: "==", value: inn.id }]);
    const batting = (await q(
      "batting_performances",
    )) as unknown as BattingPerformancesRow[];
    const bowling = (await q(
      "bowling_performances",
    )) as unknown as BowlingPerformancesRow[];
    const out = recomputeInnings({
      match,
      innings: inn,
      balls: balls as BallByBallRow[],
      existingBatting: batting,
      existingBowling: bowling,
      now: "x",
    });
    expect(strip(batting)).toEqual(strip(out.batting));
    expect(strip(bowling)).toEqual(strip(out.bowling));
    expect(strip(await q("fall_of_wickets"))).toEqual(strip(out.fallOfWickets));
    expect(strip(await q("partnerships"))).toEqual(strip(out.partnerships));
    for (const [k, v] of Object.entries(out.inningsPatch)) {
      if (k === "updated_at") continue;
      expect((inn as unknown as Record<string, unknown>)[k]).toEqual(v);
    }
  }

  const stored = (await ds.query("player_matches", [
    { field: "match_id", op: "==", value: matchId },
  ])) as unknown as PlayerMatchesRow[];
  expect(strip(stored)).toEqual(strip(playerMatchDocs(match, innings, "x")));

  const live = (await ds.getById(
    "live_state",
    matchId,
  )) as unknown as LiveStateDoc | null;
  const legacyLive = await legacyBuildLiveMatchState(view, matchId);
  if (live) expect(liveRowOf(live)).toEqual(legacyLive);
  expect(await buildLiveMatchState(ds, matchId)).toEqual(legacyLive);
  if (innings.some((i) => i.innings_number === (match.current_innings ?? 1))) {
    expect(await recordState(ds, matchId)).toEqual(
      await legacyRecordState(view, matchId),
    );
  }
}

const allCosts: StepCost[] = [];
const allFullCosts: StepCost[] = [];

describe("stage 2 storage replays the pre-stage-2 engine exactly", () => {
  const rosters = rostersFrom(seed);
  for (const matchId of seedMatchIds(seed)) {
    it(`replays seed match ${matchId.slice(-3)} ball by ball`, async () => {
      const replays: GoldenReplay[] = [];
      for (const incremental of [true, false]) {
        const side = stage2Driver(freshMatchTables(seed, matchId), incremental);
        const replay = new GoldenReplay(side, matchId, rosters);
        replay.afterStep = () => checkInvariants(side, matchId);
        const recorded = await replaySeedMatch(replay, seed, matchId);
        expect(recorded).toBeGreaterThan(50);
        expect(replay.hashes).toEqual(golden.seed[matchId]);
        replays.push(replay);
      }
      allCosts.push(...replays[0]!.costs);
      allFullCosts.push(...replays[1]!.costs);
    }, 120_000);
  }

  for (const scenario of SYNTHETIC_SCENARIOS) {
    it(
      scenario.name,
      async () => {
        for (const incremental of [true, false]) {
          let side: Stage2Side | null = null;
          const replay = await playSynthetic(
            (tables: Seed) => (side = stage2Driver(tables, incremental)),
            scenario,
            false,
            () => checkInvariants(side!, "M"),
          );
          expect(replay.hashes).toEqual(golden.synthetic[scenario.name]);
          if (!scenario.noCost) {
            (incremental ? allCosts : allFullCosts).push(...replay.costs);
          }
        }
      },
      60_000,
    );
  }
});

// ---------------------------------------------------------------------------
// Cost
// ---------------------------------------------------------------------------

describe("record_ball document cost", () => {
  const avg = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / xs.length;
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
    undoAvgReads: number;
    undoAvgWrites: number;
    updateAvgReads: number;
    updateAvgWrites: number;
  };
  beforeAll(() => {
    const balls = allCosts.filter((c) => c.kind === "ball");
    const normal = balls.filter((c) => c.normal);
    const fullBalls = allFullCosts.filter((c) => c.kind === "ball");
    const by = (kind: StepCost["kind"]) =>
      allCosts.filter((c) => c.kind === kind);
    summary = {
      balls: balls.length,
      normalBalls: normal.length,
      avgReads: avg(balls.map((c) => c.reads)),
      avgWrites: avg(balls.map((c) => c.writes)),
      normalAvgReads: avg(normal.map((c) => c.reads)),
      normalMaxReads: Math.max(...normal.map((c) => c.reads)),
      normalAvgWrites: avg(normal.map((c) => c.writes)),
      normalMaxWrites: Math.max(...normal.map((c) => c.writes)),
      fullAvgReads: avg(fullBalls.map((c) => c.reads)),
      fullAvgWrites: avg(fullBalls.map((c) => c.writes)),
      undoAvgReads: avg(by("undo").map((c) => c.reads)),
      undoAvgWrites: avg(by("undo").map((c) => c.writes)),
      updateAvgReads: avg(by("update").map((c) => c.reads)),
      updateAvgWrites: avg(by("update").map((c) => c.writes)),
    };
    console.info("record_ball cost per ball", summary);
  });

  it("reads match + innings + over + live_state and writes the same four per normal delivery", () => {
    expect(summary.normalBalls).toBeGreaterThan(500);
    // Before stage 2: ~10.6 reads / ~7.3 writes per normal delivery.
    expect(summary.normalAvgReads).toBeLessThanOrEqual(4.1);
    expect(summary.normalAvgWrites).toBeLessThanOrEqual(4);
    expect(summary.normalMaxWrites).toBeLessThanOrEqual(4);
    // A new player's name is read once.
    expect(summary.normalMaxReads).toBeLessThanOrEqual(7);
    // Including wickets, boundaries and innings changes (player records
    // are written when an innings completes).
    expect(summary.avgReads).toBeLessThanOrEqual(5);
    expect(summary.avgWrites).toBeLessThanOrEqual(5);
    // The full recompute path, for comparison (one read per over).
    expect(summary.fullAvgReads).toBeGreaterThan(summary.avgReads * 2);
  });
});
