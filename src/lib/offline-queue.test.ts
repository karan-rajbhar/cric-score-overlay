import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  enqueuePendingBall,
  getPendingBalls,
  hasPendingBalls,
  removePendingBall,
  clearPendingBalls,
  flushPendingBalls,
  enqueueAction,
  getPendingActions,
  getPendingCount,
  removeAction,
  popLastAction,
  clearPendingActions,
  clearAllPending,
  flushPendingActions,
  getDeadLetterActions,
  getDeadLetterCount,
  clearDeadLetterActions,
  skipHeadAction,
  type ActionFlushHandlers,
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

  describe("Unified Multi-Action Queue", () => {
    it("enqueues and retrieves actions of different types", () => {
      enqueueAction(matchId, "setBatsmen", {
        strikerId: "bat-1",
        nonStrikerId: "bat-2",
      });
      enqueueAction(matchId, "setBowler", { bowlerId: "bowl-1" });
      enqueueAction(matchId, "endInnings", {} as Record<string, never>);
      enqueueAction(matchId, "undoLastBall", {} as Record<string, never>);

      const actions = getPendingActions(matchId);
      expect(actions).toHaveLength(4);
      expect(actions[0]!.type).toBe("setBatsmen");
      expect(actions[1]!.type).toBe("setBowler");
      expect(actions[2]!.type).toBe("endInnings");
      expect(actions[3]!.type).toBe("undoLastBall");
      expect(getPendingCount(matchId)).toBe(4);
    });

    it("pops the last queued action for undo", () => {
      enqueueAction(matchId, "setBowler", { bowlerId: "bowl-1" });
      enqueueAction(matchId, "setBowler", { bowlerId: "bowl-2" });

      const popped = popLastAction(matchId);
      expect(popped).not.toBeNull();
      expect(popped!.type).toBe("setBowler");
      expect((popped!.payload as { bowlerId: string }).bowlerId).toBe("bowl-2");
      expect(getPendingActions(matchId)).toHaveLength(1);

      popLastAction(matchId);
      expect(popLastAction(matchId)).toBeNull();
      expect(getPendingCount(matchId)).toBe(0);
    });

    it("clears all pending actions with clearPendingActions and clearAllPending", () => {
      enqueueAction(matchId, "setBowler", { bowlerId: "bowl-1" });
      clearPendingActions(matchId);
      expect(getPendingActions(matchId)).toHaveLength(0);

      enqueueAction(matchId, "setBowler", { bowlerId: "bowl-2" });
      clearAllPending(matchId);
      expect(getPendingActions(matchId)).toHaveLength(0);
    });

    it("removes a specific action by ID", () => {
      const a1 = enqueueAction(matchId, "setBowler", { bowlerId: "bowl-1" });
      const a2 = enqueueAction(matchId, "setBowler", { bowlerId: "bowl-2" });

      removeAction(matchId, a1.queueId);
      const remaining = getPendingActions(matchId);
      expect(remaining).toHaveLength(1);
      expect(remaining[0]!.queueId).toBe(a2.queueId);
    });

    it("flushes mixed actions in sequential order", async () => {
      enqueueAction(matchId, "setBatsmen", {
        strikerId: "bat-1",
        nonStrikerId: "bat-2",
      });
      enqueueAction(matchId, "setBowler", { bowlerId: "bowl-1" });
      enqueueAction(matchId, "recordBall", dummyBall);
      enqueueAction(matchId, "undoLastBall", {} as Record<string, never>);
      enqueueAction(matchId, "endInnings", {} as Record<string, never>);
      const queued = getPendingActions(matchId).map((a) => a.queueId);
      const getQueueIds = () => queued;

      const handlers: ActionFlushHandlers = {
        setBatsmen: vi.fn().mockResolvedValue({ error: null }),
        setBowler: vi.fn().mockResolvedValue({ error: null }),
        recordBall: vi.fn().mockResolvedValue({ error: null }),
        undoLastBall: vi.fn().mockResolvedValue({ error: null }),
        endInnings: vi.fn().mockResolvedValue({ error: null }),
      };

      const result = await flushPendingActions(matchId, handlers);
      expect(result.synced).toBe(5);
      expect(result.failed).toBe(0);
      // Each handler also gets the action's queueId (idempotency key).
      const ids = getQueueIds();
      expect(handlers.setBatsmen).toHaveBeenCalledWith("bat-1", "bat-2", ids[0]);
      expect(handlers.setBowler).toHaveBeenCalledWith("bowl-1", ids[1]);
      expect(handlers.recordBall).toHaveBeenCalledWith(dummyBall, ids[2]);
      expect(handlers.undoLastBall).toHaveBeenCalledTimes(1);
      expect(handlers.endInnings).toHaveBeenCalledTimes(1);
      expect(getPendingActions(matchId)).toHaveLength(0);
    });

    it("stops sequential execution if an action fails", async () => {
      enqueueAction(matchId, "setBowler", { bowlerId: "bowl-1" });
      enqueueAction(matchId, "recordBall", dummyBall);

      const handlers: ActionFlushHandlers = {
        setBatsmen: vi.fn().mockResolvedValue({ error: null }),
        setBowler: vi.fn().mockResolvedValue({ error: "DB Error" }),
        recordBall: vi.fn().mockResolvedValue({ error: null }),
        undoLastBall: vi.fn().mockResolvedValue({ error: null }),
        endInnings: vi.fn().mockResolvedValue({ error: null }),
      };

      const result = await flushPendingActions(matchId, handlers);
      expect(result.synced).toBe(0);
      expect(result.failed).toBe(1);
      expect(handlers.setBowler).toHaveBeenCalledTimes(1);
      expect(handlers.recordBall).not.toHaveBeenCalled();
      expect(getPendingActions(matchId)).toHaveLength(2);
    });

    it("handles unexpected thrown network errors gracefully", async () => {
      enqueueAction(matchId, "setBowler", { bowlerId: "bowl-1" });

      const handlers: ActionFlushHandlers = {
        setBatsmen: vi.fn().mockResolvedValue({ error: null }),
        setBowler: vi.fn().mockRejectedValue(new Error("Fatal crash")),
        recordBall: vi.fn().mockResolvedValue({ error: null }),
        undoLastBall: vi.fn().mockResolvedValue({ error: null }),
        endInnings: vi.fn().mockResolvedValue({ error: null }),
      };

      const result = await flushPendingActions(matchId, handlers);
      expect(result.synced).toBe(0);
      expect(result.failed).toBe(1);
      expect(getPendingActions(matchId)).toHaveLength(1);
    });

    it("routes fatal sync errors to Dead Letter Queue without halting queue drain", async () => {
      // Corrupt/poisoned head action with fatal authorization error
      enqueueAction(matchId, "recordBall", dummyBall);
      // Valid subsequent action
      enqueueAction(matchId, "setBatsmen", {
        strikerId: "bat-1",
        nonStrikerId: "bat-2",
      });

      const handlers: ActionFlushHandlers = {
        recordBall: vi.fn().mockResolvedValue({ error: "not_authorized: permission denied" }),
        setBatsmen: vi.fn().mockResolvedValue({ error: null }),
        setBowler: vi.fn().mockResolvedValue({ error: null }),
        undoLastBall: vi.fn().mockResolvedValue({ error: null }),
        endInnings: vi.fn().mockResolvedValue({ error: null }),
      };

      const result = await flushPendingActions(matchId, handlers);
      // Head action was moved to DLQ, 2nd action succeeded
      expect(result.failed).toBe(1);
      expect(result.synced).toBe(1);
      expect(handlers.recordBall).toHaveBeenCalledTimes(1);
      expect(handlers.setBatsmen).toHaveBeenCalledTimes(1);

      // Pending queue is now empty (head action unblocked!)
      expect(getPendingActions(matchId)).toHaveLength(0);

      // Dead letter queue captured the failed action
      expect(getDeadLetterCount(matchId)).toBe(1);
      const dlq = getDeadLetterActions(matchId);
      expect(dlq[0]!.action.type).toBe("recordBall");
      expect(dlq[0]!.error).toContain("not_authorized");
    });

    it("routes actions exceeding max retries to Dead Letter Queue and unblocks queue", async () => {
      enqueueAction(matchId, "setBowler", { bowlerId: "bowl-1" });
      enqueueAction(matchId, "recordBall", dummyBall);

      const handlers: ActionFlushHandlers = {
        setBowler: vi.fn().mockResolvedValue({ error: "Temporary server timeout" }),
        recordBall: vi.fn().mockResolvedValue({ error: null }),
        setBatsmen: vi.fn().mockResolvedValue({ error: null }),
        undoLastBall: vi.fn().mockResolvedValue({ error: null }),
        endInnings: vi.fn().mockResolvedValue({ error: null }),
      };

      // Attempt 1: retryCount becomes 1, queue stops to preserve order
      const r1 = await flushPendingActions(matchId, handlers, { maxRetries: 3 });
      expect(r1.failed).toBe(1);
      expect(r1.synced).toBe(0);
      expect(getPendingActions(matchId)).toHaveLength(2);
      expect(getDeadLetterCount(matchId)).toBe(0);

      // Attempt 2: retryCount becomes 2
      const r2 = await flushPendingActions(matchId, handlers, { maxRetries: 3 });
      expect(r2.failed).toBe(1);
      expect(r2.synced).toBe(0);
      expect(getPendingActions(matchId)).toHaveLength(2);
      expect(getDeadLetterCount(matchId)).toBe(0);

      // Attempt 3: retryCount reaches 3 -> moved to DLQ, subsequent recordBall drains!
      const r3 = await flushPendingActions(matchId, handlers, { maxRetries: 3 });
      expect(r3.failed).toBe(1);
      expect(r3.synced).toBe(1);
      expect(getPendingActions(matchId)).toHaveLength(0);
      expect(getDeadLetterCount(matchId)).toBe(1);
    });

    it("supports manual head-of-queue skipping via skipHeadAction", () => {
      const a1 = enqueueAction(matchId, "recordBall", dummyBall);
      const a2 = enqueueAction(matchId, "setBowler", { bowlerId: "bowl-2" });

      expect(getPendingCount(matchId)).toBe(2);
      const skipped = skipHeadAction(matchId);
      expect(skipped).not.toBeNull();
      expect(skipped!.queueId).toBe(a1.queueId);

      // Pending queue now starts with a2
      const remaining = getPendingActions(matchId);
      expect(remaining).toHaveLength(1);
      expect(remaining[0]!.queueId).toBe(a2.queueId);

      // DLQ contains skipped item
      const dlq = getDeadLetterActions(matchId);
      expect(dlq).toHaveLength(1);
      expect(dlq[0]!.action.queueId).toBe(a1.queueId);
      expect(dlq[0]!.error).toContain("Manually skipped");

      clearDeadLetterActions(matchId);
      expect(getDeadLetterActions(matchId)).toHaveLength(0);
      expect(getDeadLetterCount(matchId)).toBe(0);
    });

    it("enqueues and flushes startSuperOver actions", async () => {
      enqueueAction(matchId, "startSuperOver", {} as Record<string, never>);

      const handlers: ActionFlushHandlers = {
        setBatsmen: vi.fn().mockResolvedValue({ error: null }),
        setBowler: vi.fn().mockResolvedValue({ error: null }),
        recordBall: vi.fn().mockResolvedValue({ error: null }),
        undoLastBall: vi.fn().mockResolvedValue({ error: null }),
        endInnings: vi.fn().mockResolvedValue({ error: null }),
        startSuperOver: vi.fn().mockResolvedValue({ error: null }),
      };

      const result = await flushPendingActions(matchId, handlers);
      expect(result.synced).toBe(1);
      expect(result.failed).toBe(0);
      expect(handlers.startSuperOver).toHaveBeenCalledTimes(1);
      expect(getPendingActions(matchId)).toHaveLength(0);
    });
  });
});
