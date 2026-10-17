/**
 * Offline scoring end to end: actions queued while offline (balls, an undo
 * of a queued ball, a queued undo, a retirement, a new batter, penalty runs,
 * a bowler re-assignment and an edit of a synced ball) replay through the
 * current scoring rpcs in order, and a replay after a lost response (the
 * server applied the action, the client never heard back) is not applied
 * twice.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  awardPenaltyRuns,
  reassignOverBowler,
  recordBall,
  retireBatter,
  setCurrentBatsmen,
  setCurrentBowler,
  undoLastBall,
  updateBall,
  type ScoringContext,
} from "./firebase/rpc/scoring";
import { ballLogOf, type OversRow } from "./firebase/scorecard";
import {
  GoldenReplay,
  SYNTHETIC_ROSTERS,
  syntheticTables,
} from "./firebase/scoring/__fixtures__/golden";
import {
  stage2Driver,
  type Stage2Side,
} from "./firebase/scoring/__fixtures__/stage2";
import type { InningsRow } from "./firebase/types";
import {
  enqueueAction,
  enqueuePendingBall,
  flushPendingActions,
  getDeadLetterCount,
  getPendingActions,
  popLastAction,
  type ActionFlushHandlers,
} from "./offline-queue";

const M = "M";

/** Handlers shaped like the server actions `useScoring` replays through. */
function serverHandlers(
  side: Stage2Side,
  calls: string[],
): ActionFlushHandlers {
  const ctx = (id: string): ScoringContext => ({
    ...side.ctx,
    clientActionId: id,
  });
  const ok = async (fn: () => Promise<unknown>) => {
    try {
      await fn();
      return { error: null };
    } catch (err) {
      return { error: (err as Error).message };
    }
  };
  return {
    recordBall: (p, id) => {
      calls.push(`ball:${id}`);
      return ok(() =>
        recordBall(ctx(id), {
          p_match_id: p.matchId,
          p_bowler_id: p.bowlerId,
          p_batsman_id: p.batsmanId,
          p_non_striker_id: p.nonStrikerId,
          p_runs_scored: p.event.runsScored ?? 0,
          p_extras: p.event.extras ?? 0,
          p_extra_type: p.event.extraType ?? null,
          p_is_wicket: p.event.isWicket ?? false,
          p_dismissal_type: p.event.dismissalType ?? null,
          p_dismissed_player_id: p.event.dismissedPlayerId ?? null,
        }),
      );
    },
    setBatsmen: (s, ns) => {
      calls.push("batsmen");
      return ok(() => setCurrentBatsmen(side.ctx, M, s, ns));
    },
    setBowler: (b) => {
      calls.push("bowler");
      return ok(() => setCurrentBowler(side.ctx, M, b));
    },
    endInnings: async () => ({ error: "unexpected" }),
    undoLastBall: (id) => {
      calls.push(`undo:${id}`);
      return ok(() => undoLastBall(ctx(id), M));
    },
    retireBatter: (p, id) => {
      calls.push(`retire:${id}`);
      return ok(() =>
        retireBatter(ctx(id), {
          p_match_id: M,
          p_player_id: p.playerId,
          p_type: p.type,
          p_reason: p.reason ?? null,
        }),
      );
    },
    awardPenalty: (p, id) => {
      calls.push(`penalty:${id}`);
      return ok(() =>
        awardPenaltyRuns(ctx(id), {
          p_match_id: M,
          p_runs: p.runs,
          p_type: p.type,
          p_reason: p.reason,
          p_team_id: p.teamId,
        }),
      );
    },
    reassignOverBowler: (b, id) => {
      calls.push(`reassign:${id}`);
      return ok(async () => {
        await setCurrentBowler(side.ctx, M, b).catch(() => undefined);
        await reassignOverBowler(ctx(id), { p_match_id: M, p_bowler_id: b });
      });
    },
    updateBall: (p) => {
      calls.push("update");
      return ok(() =>
        updateBall(side.ctx, {
          p_match_id: M,
          p_ball_id: p.ballId,
          p_runs_scored: p.runsScored,
          p_extras: p.extras,
          p_extra_type: p.extraType ?? null,
          p_is_wicket: p.isWicket,
          p_dismissal_type: p.dismissalType,
          p_batsman_id: p.batsmanId ?? null,
          p_bowler_id: p.bowlerId ?? null,
        }),
      );
    },
  };
}

const inningsOf = (side: Stage2Side) =>
  side.ds
    .all("innings")
    .find((i) => i.innings_number === 1) as unknown as InningsRow;
const ballLog = (side: Stage2Side) =>
  ballLogOf(side.ds.all("overs") as unknown as OversRow[]);

/** A started match: 3 balls in, a1 on strike with a2, b1 bowling. */
async function startedMatch() {
  const side = stage2Driver(syntheticTables({ overs_per_innings: 3 }), true);
  const replay = new GoldenReplay(side, M, SYNTHETIC_ROSTERS);
  for (const runs of [1, 1, 0])
    await replay.step({ kind: "ball", ball: { runs } });
  const inn = inningsOf(side);
  const striker = inn.batting!.find((b) => b.is_striker)!.user_id;
  const nonStriker = inn.batting!.find(
    (b) => b.is_current_batsman && !b.is_striker,
  )!.user_id;
  const bowler = inn.bowling!.find((b) => b.is_current_bowler)!.user_id;
  return { side, striker, nonStriker, bowler };
}

const ball = (
  bowlerId: string,
  batsmanId: string,
  nonStrikerId: string,
  runs: number,
) => ({
  matchId: M,
  bowlerId,
  batsmanId,
  nonStrikerId,
  event: { runsScored: runs },
});

describe("offline queue replay through the scoring rpcs", () => {
  beforeEach(() => localStorage.clear());

  it("replays balls, undo, retirement, penalties, re-assignment and edits in order, once", async () => {
    const { side, striker, nonStriker, bowler } = await startedMatch();
    const synced = ballLog(side);
    expect(synced).toHaveLength(3);

    // ---- offline ----
    enqueuePendingBall(ball(bowler, striker, nonStriker, 0));
    enqueuePendingBall(ball(bowler, striker, nonStriker, 2));
    enqueuePendingBall(ball(bowler, striker, nonStriker, 4));
    // The scorer undoes the boundary while still offline: it never syncs.
    expect(popLastAction(M)?.type).toBe("recordBall");
    enqueuePendingBall(ball(bowler, striker, nonStriker, 1));
    // An undo queued as an action (replayed as undo_last_ball).
    enqueueAction(M, "undoLastBall", {} as Record<string, never>);
    enqueueAction(M, "retireBatter", {
      playerId: striker,
      type: "retired_hurt",
      reason: "cramp",
    });
    enqueueAction(M, "setBatsmen", {
      strikerId: "a9",
      nonStrikerId: nonStriker,
    });
    // Ends the over: a9 ran one, then the ends change, so a9 faces again.
    enqueuePendingBall(ball(bowler, "a9", nonStriker, 1));
    enqueueAction(M, "setBowler", { bowlerId: "b8" });
    enqueuePendingBall(ball("b8", "a9", nonStriker, 0));
    enqueueAction(M, "awardPenalty", {
      teamId: "TA",
      runs: 5,
      reason: "fake fielding",
      type: "penalty",
    });
    enqueueAction(M, "awardPenalty", {
      teamId: "TB",
      runs: 5,
      reason: "ball hit helmet",
      type: "penalty",
    });
    // The next over was bowled by b9, not b8: re-assign it.
    enqueueAction(M, "reassignOverBowler", { bowlerId: "b9" });
    enqueueAction(M, "updateBall", {
      ballId: synced[0]!.id,
      runsScored: 3,
      extras: 0,
      extraType: null,
      isWicket: false,
      dismissalType: null,
    });
    const queued = getPendingActions(M);
    expect(queued).toHaveLength(13);

    // ---- back online; the 2nd queued ball reaches the server but its reply
    // is lost, so that flush stops there ----
    const calls: string[] = [];
    const handlers = serverHandlers(side, calls);
    let dropped = false;
    const lossy: ActionFlushHandlers = {
      ...handlers,
      recordBall: async (p, id) => {
        const res = await handlers.recordBall(p, id);
        if (!dropped && id === queued[1]!.queueId) {
          dropped = true;
          throw new Error("Failed to fetch");
        }
        return res;
      },
    };
    expect(await flushPendingActions(M, lossy)).toEqual({
      synced: 1,
      failed: 1,
    });
    expect(ballLog(side)).toHaveLength(5);
    expect(getPendingActions(M)).toHaveLength(12);

    // Retry: the 2nd ball is recognised (same id) and not recorded again.
    // Two flushes at once (the "online" event and a tap) share one replay.
    const [a, b] = await Promise.all([
      flushPendingActions(M, handlers),
      flushPendingActions(M, handlers),
    ]);
    expect(a).toEqual({ synced: 12, failed: 0 });
    expect(b).toBe(a);
    expect(getPendingActions(M)).toHaveLength(0);
    expect(getDeadLetterCount(M)).toBe(0);
    // Every queued action was sent once (the lost one twice), in order.
    expect(calls).toEqual([
      `ball:${queued[0]!.queueId}`,
      `ball:${queued[1]!.queueId}`,
      `ball:${queued[1]!.queueId}`,
      `ball:${queued[2]!.queueId}`,
      `undo:${queued[3]!.queueId}`,
      `retire:${queued[4]!.queueId}`,
      "batsmen",
      `ball:${queued[6]!.queueId}`,
      "bowler",
      `ball:${queued[8]!.queueId}`,
      `penalty:${queued[9]!.queueId}`,
      `penalty:${queued[10]!.queueId}`,
      `reassign:${queued[11]!.queueId}`,
      "update",
    ]);

    // ---- the server state: the first ball edited to 3; 1, 0 synced
    // before; 0, 2 (the 1 was undone), a retirement, 1, then 0 ----
    const log = ballLog(side);
    const deliveries = log.filter((b) => !b.extra_type && !b.dismissal_type);
    expect(deliveries.map((b) => b.runs_scored)).toEqual([3, 1, 0, 0, 2, 1, 0]);
    expect(deliveries.map((b) => b.bowler_id)).toEqual([
      ...Array<string>(6).fill(bowler),
      "b9",
    ]);
    // The fielding side's award is not a delivery: it keeps no bowler.
    expect(log.find((b) => b.penalty_team_id === "TB")!.bowler_id).toBeNull();
    const inn = inningsOf(side);
    // 7 off the bat, +5 penalty runs to the batting side; the fielding
    // side's 5 wait for their innings.
    expect(inn.total_runs).toBe(12);
    expect(inn.extras_penalties).toBe(5);
    const retired = inn.batting!.find((b) => b.user_id === striker)!;
    expect(retired).toMatchObject({
      is_out: false,
      dismissal_type: "retired_hurt",
      is_current_batsman: false,
    });
    expect(log.filter((b) => b.dismissal_type === "retired_hurt")).toHaveLength(
      1,
    );
    expect(log.filter((b) => b.penalty_team_id === "TB")).toHaveLength(1);
  });

  it("a replayed undo, retirement or penalty is not applied twice", async () => {
    const { side, striker, nonStriker, bowler } = await startedMatch();
    const handlers = serverHandlers(side, []);

    await handlers.recordBall(ball(bowler, striker, nonStriker, 1), "x1");
    await handlers.recordBall(ball(bowler, nonStriker, striker, 1), "x2");
    expect(ballLog(side)).toHaveLength(5);
    // A ball replayed after the next one was recorded is still recognised.
    await handlers.recordBall(ball(bowler, striker, nonStriker, 1), "x1");
    expect(ballLog(side)).toHaveLength(5);

    await handlers.undoLastBall("u1");
    await handlers.undoLastBall("u1");
    expect(ballLog(side)).toHaveLength(4);

    await handlers.retireBatter!(
      { playerId: striker, type: "retired_out" },
      "r1",
    );
    expect(
      await handlers.retireBatter!(
        { playerId: striker, type: "retired_out" },
        "r1",
      ),
    ).toEqual({ error: null });
    expect(inningsOf(side).total_wickets).toBe(1);

    const award = {
      teamId: "TA",
      runs: 5,
      reason: "x",
      type: "penalty" as const,
    };
    await handlers.awardPenalty!(award, "p1");
    await handlers.awardPenalty!(award, "p1");
    expect(inningsOf(side).extras_penalties).toBe(5);

    // Only the last 20 ids are kept on the match.
    const match = side.ds.all("matches").find((m) => m.id === M)!;
    expect(match.recent_client_actions).toEqual(["x1", "x2", "u1", "r1", "p1"]);
  });
});
