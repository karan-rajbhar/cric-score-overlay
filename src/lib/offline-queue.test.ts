import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  enqueuePendingBall,
  getPendingBalls,
  hasPendingBalls,
  removePendingBall,
  clearPendingBalls,
  flushPendingBalls,
  type PendingBallParams,
} from "./offline-queue";

describe("Offline Scorer Queue", () => {
  const matchId = "match-offline-123";
  const dummyBall: PendingBallParams = {
    matchId,
    bowlerId: "bowler-1",
    batsmanId: "bat-1",
    nonStrikerId: "bat-2",
    event: { runsScored: 4, shotZone: "cover" },
  };

  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it("enqueues and retrieves offline balls in FIFO order", () => {
    expect(hasPendingBalls(matchId)).toBe(false);

    const q1 = enqueuePendingBall(dummyBall);
    const q2 = enqueuePendingBall({
      ...dummyBall,
      event: { runsScored: 1, isWicket: false },
    });

    expect(hasPendingBalls(matchId)).toBe(true);
    const pending = getPendingBalls(matchId);
    expect(pending).toHaveLength(2);
    expect(pending[0]!.queueId).toBe(q1.queueId);
    expect(pending[0]!.event.runsScored).toBe(4);
    expect(pending[1]!.queueId).toBe(q2.queueId);
    expect(pending[1]!.event.runsScored).toBe(1);
  });

  it("removes single ball from queue by id", () => {
    const q1 = enqueuePendingBall(dummyBall);
    const q2 = enqueuePendingBall({
      ...dummyBall,
      event: { runsScored: 6 },
    });

    removePendingBall(matchId, q1.queueId);
    const remaining = getPendingBalls(matchId);
    expect(remaining).toHaveLength(1);
    expect(remaining[0]!.queueId).toBe(q2.queueId);

    removePendingBall(matchId, q2.queueId);
    expect(hasPendingBalls(matchId)).toBe(false);
  });

  it("clears all pending balls for match", () => {
    enqueuePendingBall(dummyBall);
    enqueuePendingBall(dummyBall);
    expect(getPendingBalls(matchId)).toHaveLength(2);

    clearPendingBalls(matchId);
    expect(getPendingBalls(matchId)).toHaveLength(0);
  });

  it("flushes balls sequentially to server submitFn", async () => {
    enqueuePendingBall({ ...dummyBall, event: { runsScored: 1 } });
    enqueuePendingBall({ ...dummyBall, event: { runsScored: 4 } });

    const submitFn = vi.fn().mockResolvedValue({ error: null });

    const result = await flushPendingBalls(matchId, submitFn);
    expect(result.synced).toBe(2);
    expect(result.failed).toBe(0);
    expect(submitFn).toHaveBeenCalledTimes(2);
    expect(hasPendingBalls(matchId)).toBe(false);
  });

  it("halts flushing on error to preserve strict delivery sequence", async () => {
    enqueuePendingBall({ ...dummyBall, event: { runsScored: 1 } });
    enqueuePendingBall({ ...dummyBall, event: { runsScored: 4 } });

    // First ball fails with network/server error
    const submitFn = vi.fn().mockResolvedValueOnce({ error: "Network timeout" });

    const result = await flushPendingBalls(matchId, submitFn);
    expect(result.synced).toBe(0);
    expect(result.failed).toBe(1);
    expect(submitFn).toHaveBeenCalledTimes(1);

    // Queue must retain both balls
    expect(getPendingBalls(matchId)).toHaveLength(2);
  });
});
