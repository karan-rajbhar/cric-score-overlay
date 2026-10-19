import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  enqueuePendingBall,
  getPendingBalls,
  hasPendingBalls,
  removePendingBall,
  clearPendingBalls,
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
  postReplayBatch,
  type PendingBallParams,
  type QueuedActionType,
  type ReplayTransport,
} from "./offline-queue";
import type { ReplayActionResult } from "./scoring-replay/protocol";

type Handler = (payload: unknown, id: string) => Promise<{ error: string | null }>;
type ActionFlushHandlers = Partial<Record<QueuedActionType, Handler>>;

/**
 * A stand-in for POST /api/scoring/replay: runs each action through its
 * handler in order and stops at the first failure. A handler that throws
 * loses the whole reply (the transport throws, like a dropped connection).
 */
function routeLike(handlers: ActionFlushHandlers): ReplayTransport {
  return async (batch) => {
    const results: ReplayActionResult[] = [];
    for (const a of batch.actions) {
      const handler = handlers[a.type as QueuedActionType];
      const res = handler
        ? await handler(a.payload, a.id)
        : { error: `unsupported_action_type: ${a.type}` };
      if (res.error) {
        results.push({ id: a.id, status: "failed", error: res.error });
        break;
      }
      results.push({ id: a.id, status: "applied" });
    }
    return { ok: true, response: { v: 1, results } };
  };
}

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

    const result = await flushPendingActions(
      matchId,
      routeLike({ recordBall: submitFn }),
    );
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

    const result = await flushPendingActions(
      matchId,
      routeLike({ recordBall: submitFn }),
    );
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

      const result = await flushPendingActions(matchId, routeLike(handlers));
      expect(result.synced).toBe(5);
      expect(result.failed).toBe(0);
      // Each action is sent with its queueId (idempotency key).
      const ids = getQueueIds();
      expect(handlers.setBatsmen).toHaveBeenCalledWith(
        { strikerId: "bat-1", nonStrikerId: "bat-2" },
        ids[0],
      );
      expect(handlers.setBowler).toHaveBeenCalledWith({ bowlerId: "bowl-1" }, ids[1]);
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

      const result = await flushPendingActions(matchId, routeLike(handlers));
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

      const result = await flushPendingActions(matchId, routeLike(handlers));
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

      const result = await flushPendingActions(matchId, routeLike(handlers));
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
      const r1 = await flushPendingActions(matchId, routeLike(handlers), { maxRetries: 3 });
      expect(r1.failed).toBe(1);
      expect(r1.synced).toBe(0);
      expect(getPendingActions(matchId)).toHaveLength(2);
      expect(getDeadLetterCount(matchId)).toBe(0);

      // Attempt 2: retryCount becomes 2
      const r2 = await flushPendingActions(matchId, routeLike(handlers), { maxRetries: 3 });
      expect(r2.failed).toBe(1);
      expect(r2.synced).toBe(0);
      expect(getPendingActions(matchId)).toHaveLength(2);
      expect(getDeadLetterCount(matchId)).toBe(0);

      // Attempt 3: retryCount reaches 3 -> moved to DLQ, subsequent recordBall drains!
      const r3 = await flushPendingActions(matchId, routeLike(handlers), { maxRetries: 3 });
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

      const result = await flushPendingActions(matchId, routeLike(handlers));
      expect(result.synced).toBe(1);
      expect(result.failed).toBe(0);
      expect(handlers.startSuperOver).toHaveBeenCalledTimes(1);
      expect(getPendingActions(matchId)).toHaveLength(0);
    });
  });
});

describe("Offline queue replay through /api/scoring/replay", () => {
  const matchId = "match-replay-1";
  const ball = (runs: number): PendingBallParams => ({
    matchId,
    bowlerId: "b1",
    batsmanId: "a1",
    nonStrikerId: "a2",
    event: { runsScored: runs },
  });

  beforeEach(() => {
    localStorage.clear();
    vi.unstubAllGlobals();
  });

  it("sends the queue in order, in batches of at most batchSize", async () => {
    for (let i = 0; i < 12; i++) enqueuePendingBall(ball(i % 4));
    const ids = getPendingActions(matchId).map((a) => a.queueId);
    const sent: string[][] = [];
    const route = routeLike({ recordBall: async () => ({ error: null }) });
    const result = await flushPendingActions(matchId, async (batch) => {
      expect(batch).toMatchObject({ v: 1, matchId });
      sent.push(batch.actions.map((a) => a.id));
      return route(batch);
    });
    expect(result).toMatchObject({ synced: 12, failed: 0 });
    expect(sent.map((s) => s.length)).toEqual([10, 2]);
    expect(sent.flat()).toEqual(ids);
  });

  it("drops duplicates: a batch whose reply was lost is re-sent and recognised", async () => {
    enqueuePendingBall(ball(1));
    enqueuePendingBall(ball(2));
    const applied = new Set<string>();
    let loseReply = true;
    const send: ReplayTransport = async (batch) => {
      const results = batch.actions.map((a): ReplayActionResult => {
        const dup = applied.has(a.id);
        applied.add(a.id);
        return { id: a.id, status: dup ? "duplicate" : "applied" };
      });
      if (loseReply) {
        loseReply = false;
        throw new TypeError("Failed to fetch");
      }
      return { ok: true, response: { v: 1, results } };
    };

    expect(await flushPendingActions(matchId, send)).toMatchObject({ synced: 0, failed: 1 });
    expect(getPendingActions(matchId)).toHaveLength(2);
    expect(getPendingActions(matchId)[0]!.retryCount).toBe(1);

    expect(await flushPendingActions(matchId, send)).toMatchObject({ synced: 2, failed: 0 });
    expect(getPendingActions(matchId)).toHaveLength(0);
    expect(applied.size).toBe(2);
  });

  it("keeps the queue untouched when the server refuses the batch (unknown version, signed out)", async () => {
    enqueuePendingBall(ball(1));
    const before = getPendingActions(matchId);
    for (const [status, code] of [
      [400, "unsupported_version"],
      [401, "not_authenticated"],
    ] as const) {
      const result = await flushPendingActions(matchId, async () => ({
        ok: false,
        status,
        code,
        message: "refused",
      }));
      expect(result).toMatchObject({
        synced: 0,
        failed: 0,
        errorCode: code,
        errorMessage: "refused",
      });
      expect(getPendingActions(matchId)).toEqual(before);
      expect(getDeadLetterCount(matchId)).toBe(0);
    }
  });

  it("treats a 5xx like a dropped connection: retried, then dead-lettered", async () => {
    enqueuePendingBall(ball(1));
    const down: ReplayTransport = async () => ({
      ok: false,
      status: 503,
      code: "http_503",
      message: "Service Unavailable",
    });
    expect(await flushPendingActions(matchId, down, { maxRetries: 2 })).toMatchObject({
      synced: 0,
      failed: 1,
    });
    expect(getPendingActions(matchId)[0]!.retryCount).toBe(1);
    await flushPendingActions(matchId, down, { maxRetries: 2 });
    expect(getPendingActions(matchId)).toHaveLength(0);
    expect(getDeadLetterCount(matchId)).toBe(1);
  });

  it("marks an action sent before as resent, and never gives up on one that got no reply", async () => {
    enqueuePendingBall(ball(1));
    const seen: Array<boolean | undefined> = [];
    const offline: ReplayTransport = async (batch) => {
      seen.push(batch.actions[0]!.resent);
      throw new TypeError("Failed to fetch");
    };
    for (let i = 0; i < 5; i++) {
      await flushPendingActions(matchId, offline, { maxRetries: 2 });
    }
    expect(seen).toEqual([undefined, true, true, true, true]);
    expect(getPendingActions(matchId)).toHaveLength(1);
    expect(getDeadLetterCount(matchId)).toBe(0);
  });

  it("passes on the documents of the batch that applied every action", async () => {
    enqueuePendingBall(ball(1));
    enqueuePendingBall(ball(2));
    const delta = { match: { id: matchId }, innings: [], overs: [] };
    const route = routeLike({ recordBall: async () => ({ error: null }) });
    const res = await flushPendingActions(matchId, async (batch) => {
      const out = await route(batch);
      return out.ok
        ? { ok: true, response: { ...out.response, delta: delta as never } }
        : out;
    });
    expect(res.applied).toEqual(
      expect.arrayContaining([expect.any(String), expect.any(String)]),
    );
    expect(res.delta).toBe(delta);

    // Two batches: the last batch's documents miss the first one's.
    for (let i = 0; i < 3; i++) enqueuePendingBall(ball(i));
    const split = await flushPendingActions(
      matchId,
      async (batch) => {
        const out = await route(batch);
        return out.ok
          ? { ok: true, response: { ...out.response, delta: delta as never } }
          : out;
      },
      { batchSize: 2 },
    );
    expect(split.synced).toBe(3);
    expect(split.delta).toBeNull();
  });

  it("drops a refused instant action and everything queued after it", async () => {
    enqueueAction(matchId, "recordBall", ball(1), "i1", { instant: true });
    enqueueAction(matchId, "recordBall", ball(2), "i2", { instant: true });
    enqueueAction(matchId, "setBowler", { bowlerId: "b9" }, "i3", {
      instant: true,
    });
    const recordBall = vi
      .fn()
      .mockResolvedValueOnce({ error: null })
      .mockResolvedValue({ error: "match_not_live" });
    const res = await flushPendingActions(
      matchId,
      routeLike({ recordBall, setBowler: async () => ({ error: null }) }),
    );
    // A transient-looking error is tried once more first.
    expect(recordBall).toHaveBeenCalledTimes(3);
    expect(res.synced).toBe(1);
    expect(res.rejected).toMatchObject({
      action: { queueId: "i2" },
      error: "match_not_live",
      dependents: 1,
    });
    expect(getPendingActions(matchId)).toHaveLength(0);
    expect(getDeadLetterActions(matchId).map((d) => d.action.queueId)).toEqual([
      "i2",
      "i3",
    ]);
  });

  it("drops a refused instant action at once when the error is fatal", async () => {
    enqueueAction(matchId, "recordBall", ball(1), "f1", { instant: true });
    const recordBall = vi.fn().mockResolvedValue({ error: "not_authorized" });
    const res = await flushPendingActions(matchId, routeLike({ recordBall }));
    expect(recordBall).toHaveBeenCalledTimes(1);
    expect(res.rejected?.dependents).toBe(0);
  });

  it("runs one flush per match at a time", async () => {
    enqueuePendingBall(ball(1));
    const send = vi.fn(routeLike({ recordBall: async () => ({ error: null }) }));
    const [a, b] = await Promise.all([
      flushPendingActions(matchId, send),
      flushPendingActions(matchId, send),
    ]);
    expect(b).toBe(a);
    expect(send).toHaveBeenCalledTimes(1);
  });

  it("postReplayBatch posts JSON (keepalive) and reads results or the error code", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ v: 1, results: [{ id: "x", status: "applied" }] }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            error: { code: "unsupported_version", message: "no v9" },
          }),
          { status: 400, headers: { "Content-Type": "application/json" } },
        ),
      )
      .mockResolvedValueOnce(new Response("<html>bad gateway</html>", { status: 502 }));
    vi.stubGlobal("fetch", fetchMock);
    const batch = {
      v: 1,
      matchId,
      actions: [{ id: "x", type: "undoLastBall", payload: {} }],
    };

    expect(await postReplayBatch(batch)).toEqual({
      ok: true,
      response: { v: 1, results: [{ id: "x", status: "applied" }] },
    });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/scoring/replay");
    expect(init).toMatchObject({
      method: "POST",
      keepalive: true,
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
    });
    expect(JSON.parse(String(init.body))).toEqual(batch);

    expect(await postReplayBatch(batch)).toEqual({
      ok: false,
      status: 400,
      code: "unsupported_version",
      message: "no v9",
    });
    expect(await postReplayBatch(batch)).toMatchObject({
      ok: false,
      status: 502,
      code: "http_502",
    });
  });
});
