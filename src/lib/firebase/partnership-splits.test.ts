/**
 * Each batter's share of a stand (`scripts/migrate-partnership-splits.mjs`):
 * the plan rebuilds the shares of stands recorded before they were kept,
 * from the ball log, exactly as the scoring engine keeps them now, and
 * leaves alone an innings whose log does not give back its stands.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  SPLIT_FIELDS,
  ballLogOfOvers,
  needsSplits,
  planPartnershipSplits,
  standsWithSplits,
} from "../../../scripts/lib/partnership-splits.mjs";
import { hasNoBall } from "./noball-faced";
import type { Doc } from "./datasource";
import {
  GoldenReplay,
  SYNTHETIC_SCENARIOS,
  freshMatchTables,
  playSynthetic,
  replaySeedMatch,
  rostersFrom,
  seedMatchIds,
  type Seed,
} from "./scoring/__fixtures__/golden";
import {
  legacySeedOf,
  stage2Driver,
  type Stage2Side,
} from "./scoring/__fixtures__/stage2";
import { recomputeInnings, type BallInput } from "./scoring/recompute";

const withoutSplits = (p: Doc): Doc => {
  const copy: Doc = { ...p };
  for (const k of SPLIT_FIELDS) delete copy[k];
  return copy;
};

/**
 * The engine's stored innings, their shares removed (as recorded before
 * they were kept), planned again: every share comes back as stored.
 */
function expectPlanRebuilds(side: Stage2Side) {
  const innings = side.ds.all("innings");
  const scored = innings.filter(
    (i) => Array.isArray(i.partnerships) && i.partnerships.length > 0,
  );
  expect(scored.length).toBeGreaterThan(0);
  for (const inn of scored) {
    expect(needsSplits(inn)).toBe(false);
  }
  const stripped = innings.map((i) =>
    Array.isArray(i.partnerships)
      ? { ...i, partnerships: (i.partnerships as Doc[]).map(withoutSplits) }
      : i,
  );
  const plan = planPartnershipSplits({
    matches: side.ds.all("matches"),
    innings: stripped,
    overs: side.ds.all("overs"),
  });
  expect(plan.mismatched).toEqual([]);
  expect(
    Object.fromEntries(plan.updates.map((u) => [u.id, u.partnerships])),
  ).toEqual(Object.fromEntries(scored.map((i) => [i.id, i.partnerships])));
}

describe("partnership splits plan", () => {
  for (const scenario of SYNTHETIC_SCENARIOS) {
    it(`rebuilds the engine's shares: ${scenario.name}`, async () => {
      for (const incremental of [true, false]) {
        let side: Stage2Side | null = null;
        await playSynthetic(
          (tables: Seed) => (side = stage2Driver(tables, incremental)),
          scenario,
        );
        expectPlanRebuilds(side!);
      }
    }, 60_000);
  }

  const legacySeed = legacySeedOf(
    JSON.parse(
      readFileSync(join(process.cwd(), "firebase/seed/data.json"), "utf8"),
    ) as Seed,
  );
  const rosters = rostersFrom(legacySeed);
  for (const matchId of seedMatchIds(legacySeed).slice(0, 2)) {
    it(`rebuilds the engine's shares: seed match ${matchId.slice(-3)}`, async () => {
      const side = stage2Driver(freshMatchTables(legacySeed, matchId), true);
      await replaySeedMatch(
        new GoldenReplay(side, matchId, rosters),
        legacySeed,
        matchId,
      );
      expectPlanRebuilds(side);
    }, 120_000);
  }

  it("rebuilds the seed's stands (recorded before shares were kept)", () => {
    const data = JSON.parse(
      readFileSync(join(process.cwd(), "firebase/seed/data.json"), "utf8"),
    ) as Seed;
    const plan = planPartnershipSplits({
      matches: data.matches!,
      innings: data.innings!,
      overs: data.overs!,
    });
    // A stand's balls now count the no-balls its batters faced, which the
    // seed (recorded before) does not: such stands are left to the no-ball
    // migration (noball-faced.ts), which fills their shares too.
    const withNoBall = new Set(
      data.innings!.filter((i) => hasNoBall(i as never)).map((i) => i.id),
    );
    expect(plan.mismatched.length).toBeGreaterThan(0);
    for (const id of plan.mismatched) expect(withNoBall.has(id)).toBe(true);
    for (const { partnerships } of plan.updates) {
      for (const p of partnerships) {
        // The shares and the extras make up the stand.
        expect(p.batsman1_runs + p.batsman2_runs).toBeLessThanOrEqual(p.runs);
        expect(p.batsman1_balls + p.batsman2_balls).toBe(p.balls);
      }
    }
  });

  describe("on generated ball logs, under every crediting setting", () => {
    // A seeded generator: the same logs on every run.
    const rng = (seed: number) => () => {
      seed = (seed * 16807) % 2147483647;
      return seed / 2147483647;
    };

    function ballLog(seed: number): BallInput[] {
      const r = rng(seed);
      const balls: BallInput[] = [];
      let striker = "a1";
      let nonStriker = "a2";
      let next = 3;
      let over = 0;
      let legal = 0;
      let seq = 0;
      const base = (part: Partial<BallInput>): BallInput => ({
        id: `b${seq + 1}`,
        match_id: "m1",
        innings_id: "i1",
        over_number: over,
        ball_number: legal + 1,
        bowler_id: `b${(over % 4) + 1}`,
        batsman_id: striker,
        non_striker_id: nonStriker,
        runs_scored: 0,
        extras: 0,
        extra_type: null,
        is_wicket: false,
        dismissal_type: null,
        fielder_id: null,
        dismissed_player_id: null,
        commentary: null,
        shot_zone: null,
        seq: ++seq,
        ...part,
      });
      const newBatter = (out: "striker" | "non") => {
        const id = `a${next++}`;
        if (out === "striker") striker = id;
        else nonStriker = id;
      };
      while (over < 12 && next <= 11) {
        const x = r();
        if (x < 0.08) {
          balls.push(
            base({ extras: 1 + (r() < 0.2 ? 4 : 0), extra_type: "wide" }),
          );
        } else if (x < 0.14) {
          balls.push(
            base({
              runs_scored: [0, 1, 4][Math.floor(r() * 3)]!,
              extras: 1,
              extra_type: "no_ball",
            }),
          );
        } else if (x < 0.19) {
          const runs = 1 + Math.floor(r() * 4);
          balls.push(
            base({ extras: runs, extra_type: r() < 0.5 ? "bye" : "leg_bye" }),
          );
          legal += 1;
          if (runs % 2) [striker, nonStriker] = [nonStriker, striker];
        } else if (x < 0.21) {
          // A penalty: the team's runs, no ball, no stand.
          balls.push(
            base({
              bowler_id: null,
              batsman_id: null,
              non_striker_id: null,
              extras: 5,
              extra_type: "penalty",
              penalty_team_id: "t1",
            } as Partial<BallInput>),
          );
        } else if (x < 0.23) {
          // Retired hurt: not a wicket, but the stand ends.
          balls.push(
            base({
              bowler_id: null,
              is_wicket: true,
              dismissal_type: "retired_hurt",
              dismissed_player_id: striker,
            }),
          );
          newBatter("striker");
        } else if (x < 0.29) {
          const runOut = r() < 0.3;
          balls.push(
            base({
              is_wicket: true,
              dismissal_type: runOut ? "run_out" : "bowled",
              dismissed_player_id: runOut ? nonStriker : striker,
            }),
          );
          legal += 1;
          newBatter(runOut ? "non" : "striker");
        } else {
          const runs = [0, 0, 1, 1, 2, 3, 4, 6][Math.floor(r() * 8)]!;
          balls.push(base({ runs_scored: runs }));
          legal += 1;
          if (runs % 2) [striker, nonStriker] = [nonStriker, striker];
        }
        if (legal === 6) {
          over += 1;
          legal = 0;
          [striker, nonStriker] = [nonStriker, striker];
        }
      }
      return balls;
    }

    const settings = [false, true].flatMap((wideRuns) =>
      [false, true].flatMap((noballExtras) =>
        [false, true].map((wideFaced) => ({
          id: "m1",
          balls_per_over: 6,
          max_balls_per_over: null,
          wide_runs_to_batsman: wideRuns,
          noball_extras_to_batsman: noballExtras,
          wide_counts_as_ball_faced: wideFaced,
        })),
      ),
    );

    for (const [i, match] of settings.entries()) {
      it(`setting ${i}: wide runs ${match.wide_runs_to_batsman}, no-ball extras ${match.noball_extras_to_batsman}, wide faced ${match.wide_counts_as_ball_faced}`, () => {
        for (const seed of [11, 23, 37, 41, 59]) {
          const balls = ballLog(seed * (i + 1));
          const out = recomputeInnings({
            match,
            innings: { id: "i1", match_id: "m1" },
            balls,
            existingBatting: [],
            existingBowling: [],
            now: "2026-01-01T00:00:00.000Z",
          });
          expect(out.partnerships.length).toBeGreaterThan(1);
          const stands = out.partnerships as unknown as Doc[];
          expect(
            standsWithSplits(
              match,
              stands.map(withoutSplits),
              balls as unknown as Doc[],
            ),
          ).toEqual(stands);
        }
      });
    }
  });

  it("leaves an innings alone when its log does not give back its stands", () => {
    const overs: Doc[] = [
      {
        id: "i1_0",
        match_id: "m1",
        innings_id: "i1",
        over_number: 0,
        balls: [
          {
            id: "x1",
            seq: 1,
            bowler_id: "w",
            batsman_id: "s",
            non_striker_id: "n",
            runs_scored: 4,
            extras: 0,
          },
          {
            id: "x2",
            seq: 2,
            bowler_id: "w",
            batsman_id: "s",
            non_striker_id: "n",
            runs_scored: 1,
            extras: 0,
          },
        ],
      },
    ];
    const stand = {
      batsman1_id: "s",
      batsman2_id: "n",
      wicket_number: null,
      is_current: true,
    };
    const matches: Doc[] = [{ id: "m1" }];
    const good = planPartnershipSplits({
      matches,
      innings: [
        {
          id: "i1",
          match_id: "m1",
          partnerships: [{ ...stand, runs: 5, balls: 2 }],
        },
      ],
      overs,
    });
    expect(good.updates[0]!.partnerships[0]).toMatchObject({
      batsman1_runs: 5,
      batsman1_balls: 2,
      batsman2_runs: 0,
      batsman2_balls: 0,
    });
    // Stored as 6 runs: the log gives 5, so nothing is written.
    const bad = planPartnershipSplits({
      matches,
      innings: [
        {
          id: "i1",
          match_id: "m1",
          partnerships: [{ ...stand, runs: 6, balls: 2 }],
        },
      ],
      overs,
    });
    expect(bad).toEqual({ updates: [], mismatched: ["i1"] });
    // Applied, there is nothing left to plan.
    const again = planPartnershipSplits({
      matches,
      innings: [
        {
          id: "i1",
          match_id: "m1",
          partnerships: good.updates[0]!.partnerships,
        },
      ],
      overs,
    });
    expect(again).toEqual({ updates: [], mismatched: [] });
  });

  it("reads the log in seq order across over documents", () => {
    const log = ballLogOfOvers([
      { id: "o1", over_number: 1, balls: [{ id: "c", seq: 7 }] },
      {
        id: "o0",
        over_number: 0,
        balls: [
          { id: "b", seq: 3 },
          { id: "a", seq: 1 },
        ],
      },
    ]);
    expect(log.map((b) => b.id)).toEqual(["a", "b", "c"]);
  });
});
