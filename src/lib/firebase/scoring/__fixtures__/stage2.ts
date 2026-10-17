/**
 * Test fixtures for the stage 2 storage: converting legacy-shaped tables
 * (rows per collection) to the new documents and back, and a golden-replay
 * driver for the current engine.
 */

import {
  applyStage2,
  planStage2For,
} from "../../../../../scripts/lib/stage2.mjs";
import { MemoryDataSource, type Doc } from "../../datasource";
import { legacyRowsDataSource } from "../../legacy-rows";
import {
  awardPenaltyRuns,
  reassignOverBowler,
  retireBatter,
  setCurrentBowler,
  updateBall,
  type ScoringContext,
} from "../../rpc/scoring";
import {
  ballRowsOf,
  battingRowsOf,
  bowlingRowsOf,
  fallOfWicketRowsOf,
  partnershipRowsOf,
  SCORECARD_FIELDS,
  type OversRow,
} from "../../scorecard";
import type { InningsRow } from "../../types";
import { ADMIN, type Driver, type Seed } from "./golden";
import { countingDataSource, type IoStats } from "./legacy";

/** Legacy-shaped tables -> stage 2 documents (legacy rows removed). */
export function toStage2(tables: Seed): Seed {
  const plan = planStage2For(tables, {
    deleteOld: true,
    now: "2024-01-01T00:00:00.000Z",
  });
  return applyStage2(tables, plan) as Seed;
}

/** Stage 2 documents -> the legacy row collections (inverse of toStage2). */
export function legacySeedOf(seed: Seed): Seed {
  if (!seed.overs) return seed;
  const out: Seed = { ...seed };
  const innings = (seed.innings ?? []) as unknown as InningsRow[];
  const rows = (fn: (i: InningsRow) => object[]) =>
    innings.flatMap(fn) as unknown as Doc[];
  out.batting_performances = rows(battingRowsOf);
  out.bowling_performances = rows(bowlingRowsOf);
  out.fall_of_wickets = rows(fallOfWicketRowsOf);
  out.partnerships = rows(partnershipRowsOf);
  out.ball_by_ball = (seed.overs as unknown as OversRow[])
    .flatMap(ballRowsOf)
    .sort((a, b) => a.seq - b.seq) as unknown as Doc[];
  out.innings = innings.map((i) => {
    const copy: Record<string, unknown> = { ...i };
    for (const k of SCORECARD_FIELDS) delete copy[k];
    return copy as Doc;
  });
  delete out.overs;
  delete out.player_matches;
  return out;
}

export interface Stage2Side extends Driver {
  ds: MemoryDataSource;
  stats: IoStats;
}

/** Golden-replay driver running the current engine on stage 2 storage. */
export function stage2Driver(
  legacyTables: Seed,
  incremental = true,
): Stage2Side {
  const memory = new MemoryDataSource(structuredClone(toStage2(legacyTables)));
  const { ds, stats } = countingDataSource(memory);
  const ctx: ScoringContext = { ds, uid: ADMIN, incremental };
  return {
    ds: memory,
    stats,
    ctx,
    view: legacyRowsDataSource(memory),
    updateBall: ({ batsmanId, bowlerId, ...rest }) =>
      updateBall(ctx, {
        ...rest,
        p_batsman_id: batsmanId ?? null,
        p_bowler_id: bowlerId ?? null,
      }),
    retire: async (matchId, playerId, type) => {
      await retireBatter(ctx, {
        p_match_id: matchId,
        p_player_id: playerId,
        p_type: type,
      });
    },
    penalty: async (matchId, runs, type) => {
      await awardPenaltyRuns(ctx, {
        p_match_id: matchId,
        p_runs: runs,
        p_type: type,
        p_reason: "test",
      });
    },
    reassignBowler: async (matchId, bowlerId) => {
      try {
        await setCurrentBowler(ctx, matchId, bowlerId);
      } catch {
        // ignored, as the server action does
      }
      await reassignOverBowler(ctx, {
        p_match_id: matchId,
        p_bowler_id: bowlerId,
      });
    },
  };
}
