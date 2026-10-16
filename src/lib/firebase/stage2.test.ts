/**
 * Schema stage 2 transform (scripts/lib/stage2.mjs, used by the migration
 * and the seed) against the storage the app reads and writes
 * (scorecard.ts), plus the migration's idempotence and conflict rules.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  applyStage2,
  planStage2For,
  planWrites,
} from "../../../scripts/lib/stage2.mjs";
import { MemoryDataSource, type Doc } from "./datasource";
import { recordBall, setCurrentBatsmen } from "./rpc/scoring";
import {
  ballLogOf,
  lastBallOf,
  lastOverBowlerOf,
  playerMatchDocs,
  type OversRow,
} from "./scorecard";
import { legacySeedOf, toStage2 } from "./scoring/__fixtures__/stage2";
import type { InningsRow, MatchesRow } from "./types";

const seed = JSON.parse(
  readFileSync(join(process.cwd(), "firebase/seed/data.json"), "utf8"),
) as Record<string, Doc[]>;
const legacy = legacySeedOf(seed);
const NOW = "2024-06-01T00:00:00.000Z";

const withoutUpdatedAt = (docs: Doc[]) =>
  docs
    .map((d) => {
      const c: Record<string, unknown> = { ...d };
      delete c.updated_at;
      return JSON.stringify(c, Object.keys(c).sort());
    })
    .sort();

describe("stage 2 transform", () => {
  it("round-trips the seed: legacy rows -> documents -> legacy rows", () => {
    const back = toStage2(legacy);
    expect(back.innings).toEqual(seed.innings);
    expect(withoutUpdatedAt(back.overs!)).toEqual(
      withoutUpdatedAt(seed.overs!),
    );
    expect(withoutUpdatedAt(back.player_matches!)).toEqual(
      withoutUpdatedAt(seed.player_matches!),
    );
    for (const table of [
      "batting_performances",
      "bowling_performances",
      "fall_of_wickets",
      "partnerships",
      "ball_by_ball",
    ]) {
      expect(back[table]).toBeUndefined();
    }
  });

  it("builds the same caches and player records as the app", () => {
    const matches = new Map(
      (seed.matches as unknown as MatchesRow[]).map((m) => [m.id, m]),
    );
    const innings = seed.innings as unknown as InningsRow[];
    for (const inn of innings) {
      const match = matches.get(inn.match_id!)!;
      const balls = ballLogOf(
        (seed.overs as unknown as OversRow[]).filter(
          (o) => o.innings_id === inn.id,
        ),
      );
      expect(inn.last_ball).toEqual(lastBallOf(balls));
      expect(inn.last_over_bowler_id).toBe(
        lastOverBowlerOf(
          balls,
          inn.total_balls ?? 0,
          match.balls_per_over ?? 6,
        ),
      );
    }
    for (const match of matches.values()) {
      const ts = playerMatchDocs(
        match,
        innings.filter((i) => i.match_id === match.id),
        NOW,
      );
      expect(withoutUpdatedAt(ts as unknown as Doc[])).toEqual(
        withoutUpdatedAt(
          seed.player_matches!.filter((d) => d.match_id === match.id),
        ),
      );
    }
    // Completed seed innings give every player who batted or bowled a record.
    expect(seed.player_matches!.length).toBeGreaterThan(50);
  });

  it("is idempotent, and deletes legacy rows only with deleteOld", () => {
    // Mid-migration state: new documents written, legacy rows still there.
    const both = {
      ...legacy,
      innings: seed.innings!,
      overs: seed.overs!,
      player_matches: seed.player_matches!,
    };
    const again = planStage2For(both, { now: NOW });
    expect(planWrites(again)).toBe(0);
    const cleanup = planStage2For(both, { now: NOW, deleteOld: true });
    expect(planWrites(cleanup)).toBe(
      legacy.batting_performances!.length +
        legacy.bowling_performances!.length +
        legacy.fall_of_wickets!.length +
        legacy.partnerships!.length +
        legacy.ball_by_ball!.length,
    );
    const done = applyStage2(both, cleanup);
    expect(planWrites(planStage2For(done, { now: NOW, deleteOld: true }))).toBe(
      0,
    );
  });

  it("leaves an innings the new engine already scored in alone", () => {
    const both = structuredClone({
      ...legacy,
      innings: seed.innings!,
      overs: seed.overs!,
      player_matches: seed.player_matches!,
    });
    const over = both.overs.find((o) => (o.balls as Doc[]).length > 0)!;
    (over.balls as Doc[]).push({ id: "new-engine-ball", seq: 9999 });
    const plan = planStage2For(both, { now: NOW, deleteOld: true });
    expect(plan.conflicts).toEqual([over.innings_id]);
    expect(plan.inningsPatches.some((p) => p.id === over.innings_id)).toBe(
      false,
    );
    expect(plan.overWrites.some((o) => o.innings_id === over.innings_id)).toBe(
      false,
    );
    expect(plan.legacyDeletes.ball_by_ball!.length).toBe(
      legacy.ball_by_ball!.filter((b) => b.innings_id !== over.innings_id)
        .length,
    );
  });

  it("refreshes a migrated innings whose legacy log moved on", () => {
    const both: Record<string, Doc[]> = structuredClone({
      ...legacy,
      innings: seed.innings!,
      overs: seed.overs!,
      player_matches: seed.player_matches!,
    });
    const log = both.ball_by_ball!;
    const last = log.filter((b) => b.innings_id === seed.innings![0]!.id);
    // The old engine recorded one more ball after the copy was made.
    log.push({
      ...last[last.length - 1]!,
      id: "late-ball",
      seq: 100000,
      runs_scored: 6,
    });
    const plan = planStage2For(both, { now: NOW });
    expect(plan.conflicts).toEqual([]);
    expect(plan.inningsPatches.map((p) => p.id)).toEqual([
      seed.innings![0]!.id,
    ]);
    expect(plan.overWrites).toHaveLength(1);
  });

  it("reports legacy rows of innings that no longer exist", () => {
    const tables = structuredClone(legacy);
    tables.fall_of_wickets!.push({
      id: "gone_w1",
      innings_id: "gone",
      match_id: "x",
    });
    const plan = planStage2For(tables, { now: NOW });
    expect(plan.orphans).toEqual(["fall_of_wickets/gone_w1"]);
  });
});

describe("the engine and unmigrated innings", () => {
  it("refuses to score (rather than recompute from an empty over log)", async () => {
    const match = seed.matches!.find((m) => m.status === "live")!;
    const ds = new MemoryDataSource({
      ...legacy,
      matches: [{ ...match, created_by: "admin" }],
    });
    const ctx = { ds, uid: "admin" };
    await expect(
      recordBall(ctx, {
        p_match_id: match.id,
        p_bowler_id: "x",
        p_batsman_id: "y",
        p_non_striker_id: "z",
      }),
    ).rejects.toThrow("innings_not_migrated");
    await expect(setCurrentBatsmen(ctx, match.id, "y", "z")).rejects.toThrow(
      "innings_not_migrated",
    );
  });
});
