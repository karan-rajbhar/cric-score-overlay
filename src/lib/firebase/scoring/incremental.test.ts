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

import {
  MATCH_DETAIL_SELECT,
  PARTNERSHIPS_SELECT,
} from "~/app/matches/match-select";
import {
  canonicalJson,
  inningsSummaryEntry,
  inningsSummaryOf,
} from "../derive.mjs";
import { staleSummaryInnings } from "../innings-summary";
import {
  buildLiveScorecard,
  LIVE_SCORECARD_COLLECTION,
  liveScorecardView,
  type LiveScorecardDoc,
  type ScorecardSource,
} from "../live-scorecard";
import { liveRowOf, type LiveStateDoc } from "../live-state";
import { serverClientFor } from "../server-client";
import { rebuildStats } from "../stats.mjs";
import { recordState } from "../rpc/state";
import {
  ballLogOf,
  lastBallOf,
  lastOverBowlerOf,
  overDocId,
  playerMatchDocs,
  withoutScorecardStorage,
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
import { carriedPenaltiesOf, seqCounterOf } from "../scorecard";

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

/** Statistics documents without their timestamps, order-independent. */
function statsDump(docs: object[]): string[] {
  return docs
    .map((d) => {
      const c: Record<string, unknown> = { ...d };
      delete c.last_updated;
      delete c.updated_at;
      return canonicalJson(c);
    })
    .sort();
}

function strip(rows: object[]): string[] {
  return rows
    .map((r) => {
      const c: Record<string, unknown> = { ...r };
      for (const k of VOLATILE) delete c[k];
      return JSON.stringify(c, Object.keys(c).sort());
    })
    .sort();
}

const INNINGS_FIELDS = [
  "id",
  "match_id",
  "team_id",
  "innings_number",
  "total_runs",
  "total_wickets",
  "total_balls",
  "total_overs",
  "extras_total",
  "extras_byes",
  "extras_leg_byes",
  "extras_wides",
  "extras_no_balls",
  "extras_penalties",
  "extras_bonuses",
  "target_runs",
  "is_completed",
] as const;

/** What the match page renders from `match.innings` (no timestamps). */
function rendered(innings: Array<Record<string, unknown>>): unknown[] {
  const rows = (list: unknown) =>
    ((list ?? []) as Array<Record<string, unknown>>).map((r) => {
      const c = { ...r };
      for (const k of VOLATILE) delete c[k];
      return c;
    });
  return [...innings]
    .sort((a, b) => Number(a.innings_number) - Number(b.innings_number))
    .map((inn) => {
      const out: Record<string, unknown> = {};
      for (const k of INNINGS_FIELDS) out[k] = inn[k] ?? null;
      out.batting_performances = rows(inn.batting_performances);
      out.bowling_performances = rows(inn.bowling_performances);
      out.fall_of_wickets = rows(inn.fall_of_wickets);
      return out;
    });
}

const PARTNERSHIP_FIELDS = PARTNERSHIPS_SELECT.split(",")
  .map((f) => f.trim().split(":")[0]!)
  .filter(Boolean);

function partnershipRows(rows: Array<Record<string, unknown>>): unknown[] {
  return rows
    .map((r) => Object.fromEntries(PARTNERSHIP_FIELDS.map((k) => [k, r[k]])))
    .sort((a, b) => String(a.id).localeCompare(String(b.id)));
}

/**
 * `live_scorecard/{matchId}` equals a fresh build from the stored innings,
 * and renders exactly what `getMatch` / `getPartnerships` return.
 */
async function checkLiveScorecard(
  ds: Stage2Side["ds"],
  matchId: string,
  innings: InningsRow[],
) {
  const card = (await ds.getById(
    LIVE_SCORECARD_COLLECTION,
    matchId,
  )) as unknown as LiveScorecardDoc | null;
  if (!card) {
    expect(innings).toHaveLength(0);
    return;
  }
  const users = new Map(ds.all("users").map((u) => [u.id, u]));
  const fresh = buildLiveScorecard({
    matchId,
    innings: innings as unknown as ScorecardSource[],
    nameOf: (id) => (users.get(id)?.full_name as string | undefined) ?? null,
    version: card.version,
    now: card.updated_at,
  });
  const stored: Record<string, unknown> = { ...card };
  delete stored.id;
  expect(stored).toEqual(fresh);

  const client = serverClientFor({ ds, db: null, getUser: async () => null });
  const { data: match } = await client
    .from("matches")
    .select(MATCH_DETAIL_SELECT)
    .eq("id", matchId)
    .single();
  const expected = (
    (match as { innings?: object[] } | null)?.innings ?? []
  ).map((i) => withoutScorecardStorage(i, ["fall_of_wickets"]));
  const view = liveScorecardView(card);
  expect(rendered(view.innings)).toEqual(
    rendered(expected as Array<Record<string, unknown>>),
  );
  const { data: stands } = await client
    .from("partnerships")
    .select(PARTNERSHIPS_SELECT)
    .eq("match_id", matchId)
    .order("start_over");
  expect(partnershipRows(view.partnerships)).toEqual(
    partnershipRows((stands ?? []) as Array<Record<string, unknown>>),
  );
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
    if (inn.carried_penalties !== undefined) {
      expect(inn.carried_penalties).toEqual(
        carriedPenaltiesOf(inn, balls as BallByBallRow[]),
      );
    }
    // The match's seq counter covers every ball it logged.
    for (const b of balls) {
      expect(seqCounterOf(match, ...innings)).toBeGreaterThanOrEqual(b.seq);
    }
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

  // Stage 3: the match's innings summary, and the career / leaderboard
  // statistics equal a rebuild from the stored player records. A live
  // match's innings in progress is not followed ball by ball: readers
  // re-read that innings (`staleSummaryInnings`), and with it the summary
  // is exact.
  const stale = new Set(staleSummaryInnings(match));
  const byId = new Map(innings.map((i) => [i.id, i]));
  const asRead = (match.innings_summary ?? []).map((e) =>
    stale.has(e.id) && byId.has(e.id)
      ? inningsSummaryEntry(byId.get(e.id)!)
      : e,
  );
  expect(asRead).toEqual(inningsSummaryOf(innings));
  const rebuilt = rebuildStats(
    ds.all("player_matches") as unknown as PlayerMatchesRow[],
    new Map(ds.all("users").map((u) => [u.id, u])),
    "x",
  );
  expect(statsDump(ds.all("player_career_stats"))).toEqual(
    statsDump(rebuilt.careers),
  );
  expect(statsDump(ds.all("leaderboards"))).toEqual(
    statsDump(rebuilt.leaderboards),
  );

  await checkLiveScorecard(ds, matchId, innings);

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

  it("reads match + innings + over + live_state + live_scorecard and writes all but the match per normal delivery", () => {
    expect(summary.normalBalls).toBeGreaterThan(500);
    // Before stage 2: ~10.6 reads / ~7.3 writes per normal delivery; 4 / 4
    // before the live scorecard (+1 read, +1 write: live_scorecard); 5
    // writes while the match document followed every ball.
    expect(summary.normalAvgReads).toBeLessThanOrEqual(5.1);
    expect(summary.normalAvgWrites).toBeLessThanOrEqual(4);
    expect(summary.normalMaxWrites).toBeLessThanOrEqual(4);
    // A new player's name is read once.
    expect(summary.normalMaxReads).toBeLessThanOrEqual(8);
    // Including wickets, boundaries and innings changes (player records
    // are written when an innings completes).
    expect(summary.avgReads).toBeLessThanOrEqual(6);
    expect(summary.avgWrites).toBeLessThanOrEqual(4.6);
    // The full recompute path, for comparison (one read per over).
    expect(summary.fullAvgReads).toBeGreaterThan(summary.avgReads * 2);
  });
});
