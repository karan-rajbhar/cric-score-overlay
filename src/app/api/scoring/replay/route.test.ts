// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";

vi.mock("server-only", () => ({}));

const getUser = vi.fn();
let recentClientActions: string[] = [];
const fromTable = vi.fn();
vi.mock("~/lib/firebase/server", () => ({
  createServerClient: vi.fn(async () => ({
    auth: { getUser },
    from: (table: string) => {
      fromTable(table);
      const q = {
        select: () => q,
        eq: () => q,
        maybeSingle: async () => ({
          data: { recent_client_actions: recentClientActions },
          error: null,
        }),
      };
      return q;
    },
  })),
}));

vi.mock("~/app/matches/mutations", () => ({
  recordBall: vi.fn(),
  undoLastBall: vi.fn(),
  endInnings: vi.fn(),
  startSuperOver: vi.fn(),
  setCurrentBatsmen: vi.fn(),
  setCurrentBowler: vi.fn(),
  retirePlayer: vi.fn(),
  awardTeamPenalty: vi.fn(),
  reassignCurrentOverBowler: vi.fn(),
  updateBall: vi.fn(),
}));

import * as mutations from "~/app/matches/mutations";
import { POST } from "./route";

const M = "match-1";
const HOST = "cricscore.example.com";

function request(
  body: unknown,
  headers: Record<string, string | null> = {},
): NextRequest {
  const h = new Headers({
    "Content-Type": "application/json",
    Host: HOST,
    Origin: `https://${HOST}`,
  });
  for (const [k, v] of Object.entries(headers)) {
    if (v === null) h.delete(k);
    else h.set(k, v);
  }
  return new Request(`https://${HOST}/api/scoring/replay`, {
    method: "POST",
    headers: h,
    body: typeof body === "string" ? body : JSON.stringify(body),
  }) as unknown as NextRequest;
}

const batch = (actions: unknown[], extra: Record<string, unknown> = {}) => ({
  v: 1,
  matchId: M,
  actions,
  ...extra,
});

const ballAction = (id: string, runs = 1) => ({
  id,
  type: "recordBall",
  payload: {
    matchId: M,
    bowlerId: "b1",
    batsmanId: "a1",
    nonStrikerId: "a2",
    event: { runsScored: runs },
  },
  queuedAt: 1,
});

async function json(res: Response) {
  return (await res.json()) as {
    v?: number;
    results?: Array<{
      id: string;
      status: string;
      error?: string;
      code?: string;
    }>;
    error?: { code: string; message: string };
    supportedVersions?: number[];
    delta?: unknown;
  };
}

const allMutations = () => Object.values(mutations).map((fn) => vi.mocked(fn));

describe("POST /api/scoring/replay", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    recentClientActions = [];
    getUser.mockResolvedValue({
      data: { user: { id: "scorer-1" } },
      error: null,
    });
    vi.mocked(mutations.recordBall).mockResolvedValue({
      data: null,
      error: null,
    });
    vi.mocked(mutations.undoLastBall).mockResolvedValue({
      data: null,
      error: null,
    });
    vi.mocked(mutations.endInnings).mockResolvedValue({
      data: null,
      error: null,
    });
    vi.mocked(mutations.startSuperOver).mockResolvedValue({
      data: null,
      error: null,
    });
    vi.mocked(mutations.updateBall).mockResolvedValue({
      data: null,
      error: null,
    });
    vi.mocked(mutations.setCurrentBatsmen).mockResolvedValue({ error: null });
    vi.mocked(mutations.setCurrentBowler).mockResolvedValue({ error: null });
    for (const fn of [
      mutations.retirePlayer,
      mutations.awardTeamPenalty,
      mutations.reassignCurrentOverBowler,
    ]) {
      vi.mocked(fn).mockResolvedValue({ success: true, error: null });
    }
  });

  it("requires a signed-in session", async () => {
    getUser.mockResolvedValue({ data: { user: null }, error: null });
    const res = await POST(request(batch([ballAction("x1")])));
    expect(res.status).toBe(401);
    expect((await json(res)).error?.code).toBe("not_authenticated");
    for (const fn of allMutations()) expect(fn).not.toHaveBeenCalled();
  });

  it("refuses cross-origin or origin-less requests (CSRF)", async () => {
    for (const origin of [null, "https://evil.example", "null", "not a url"]) {
      const res = await POST(
        request(batch([ballAction("x1")]), { Origin: origin }),
      );
      expect(res.status, String(origin)).toBe(403);
      expect((await json(res)).error?.code).toBe("bad_origin");
    }
    expect(getUser).not.toHaveBeenCalled();
    for (const fn of allMutations()) expect(fn).not.toHaveBeenCalled();
  });

  it("matches the origin against the forwarded host behind a proxy", async () => {
    const res = await POST(
      request(batch([ballAction("x1")]), {
        Host: "internal:8080",
        "X-Forwarded-Host": HOST,
      }),
    );
    expect(res.status).toBe(200);
  });

  it("accepts only JSON bodies of a bounded size", async () => {
    const form = await POST(
      request("v=1", { "Content-Type": "application/x-www-form-urlencoded" }),
    );
    expect(form.status).toBe(415);
    const plain = await POST(
      request(batch([ballAction("x1")]), { "Content-Type": "text/plain" }),
    );
    expect(plain.status).toBe(415);
    const big = await POST(request(`{"v":1,"pad":"${"x".repeat(70 * 1024)}"}`));
    expect(big.status).toBe(413);
    expect((await json(big)).error?.code).toBe("payload_too_large");
    const broken = await POST(request("{not json"));
    expect(broken.status).toBe(400);
    expect((await json(broken)).error?.code).toBe("invalid_json");
    for (const fn of allMutations()) expect(fn).not.toHaveBeenCalled();
  });

  it("answers an unknown version with a 400 the client can surface", async () => {
    for (const v of [2, 0, "1", undefined]) {
      const res = await POST(request(batch([ballAction("x1")], { v })));
      expect(res.status).toBe(400);
      const body = await json(res);
      expect(body.error?.code).toBe("unsupported_version");
      expect(body.supportedVersions).toEqual([1]);
    }
    for (const fn of allMutations()) expect(fn).not.toHaveBeenCalled();
  });

  it("rejects a malformed or oversized batch", async () => {
    const tooMany = Array.from({ length: 21 }, (_, i) => ballAction(`x${i}`));
    for (const body of [
      batch(tooMany),
      batch([]),
      { v: 1, actions: [ballAction("x1")] },
      batch([{ type: "recordBall", payload: {} }]),
    ]) {
      const res = await POST(request(body));
      expect(res.status).toBe(400);
      expect((await json(res)).error?.code).toBe("invalid_batch");
    }
  });

  it("applies every action type in order through the server-action code, with its id", async () => {
    const actions = [
      {
        id: "1",
        type: "setBowler",
        payload: { bowlerId: "b1", userId: "someone-else" },
      },
      {
        id: "2",
        type: "setBatsmen",
        payload: { strikerId: "a1", nonStrikerId: "a2" },
      },
      ballAction("3", 4),
      { id: "4", type: "undoLastBall", payload: {} },
      {
        id: "5",
        type: "retireBatter",
        payload: { playerId: "a1", type: "retired_hurt", reason: null },
      },
      {
        id: "6",
        type: "awardPenalty",
        payload: {
          teamId: "T2",
          runs: 5,
          reason: "slow over rate",
          type: "penalty",
        },
      },
      { id: "7", type: "reassignOverBowler", payload: { bowlerId: "b2" } },
      {
        id: "8",
        type: "updateBall",
        payload: {
          ballId: "ball-1",
          runsScored: 2,
          extras: 0,
          extraType: null,
          isWicket: false,
          dismissalType: null,
        },
      },
      { id: "9", type: "endInnings", payload: {} },
      { id: "10", type: "startSuperOver", payload: {} },
    ];
    const res = await POST(request(batch(actions)));
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    const body = await json(res);
    expect(body.v).toBe(1);
    expect(body.results).toEqual(
      actions.map((a) => ({ id: a.id, status: "applied" })),
    );

    // Client-supplied extras (a user id) never reach the server code.
    expect(mutations.setCurrentBowler).toHaveBeenCalledWith(M, "b1", "1");
    expect(mutations.setCurrentBatsmen).toHaveBeenCalledWith(
      M,
      "a1",
      "a2",
      "2",
    );
    expect(mutations.recordBall).toHaveBeenCalledWith({
      matchId: M,
      bowlerId: "b1",
      batsmanId: "a1",
      nonStrikerId: "a2",
      event: expect.objectContaining({ runsScored: 4 }),
      clientActionId: "3",
    });
    expect(mutations.undoLastBall).toHaveBeenCalledWith(M, "4");
    expect(mutations.retirePlayer).toHaveBeenCalledWith(M, {
      playerId: "a1",
      type: "retired_hurt",
      reason: null,
      clientActionId: "5",
    });
    expect(mutations.awardTeamPenalty).toHaveBeenCalledWith(M, {
      teamId: "T2",
      runs: 5,
      reason: "slow over rate",
      type: "penalty",
      clientActionId: "6",
    });
    expect(mutations.reassignCurrentOverBowler).toHaveBeenCalledWith(
      M,
      "b2",
      "7",
    );
    expect(mutations.updateBall).toHaveBeenCalledWith(
      expect.objectContaining({
        matchId: M,
        ballId: "ball-1",
        runsScored: 2,
        clientActionId: "8",
      }),
    );
    expect(mutations.endInnings).toHaveBeenCalledWith(M, "9");
    expect(mutations.startSuperOver).toHaveBeenCalledWith(M, "10");
    const callOrder = allMutations()
      .flatMap((fn) => fn.mock.invocationCallOrder.map((n) => [n, fn] as const))
      .sort((a, b) => a[0] - b[0])
      .map(([, fn]) => fn);
    expect(callOrder).toEqual([
      mutations.setCurrentBowler,
      mutations.setCurrentBatsmen,
      mutations.recordBall,
      mutations.undoLastBall,
      mutations.retirePlayer,
      mutations.awardTeamPenalty,
      mutations.reassignCurrentOverBowler,
      mutations.updateBall,
      mutations.endInnings,
      mutations.startSuperOver,
    ]);
  });

  it("stops at the first failure and leaves the rest unattempted", async () => {
    vi.mocked(mutations.recordBall)
      .mockResolvedValueOnce({ data: null, error: null })
      .mockResolvedValueOnce({
        data: null,
        error: "Select a bowler before scoring the next ball.",
      });
    const res = await POST(
      request(batch([ballAction("x1"), ballAction("x2"), ballAction("x3")])),
    );
    expect(res.status).toBe(200);
    expect((await json(res)).results).toEqual([
      { id: "x1", status: "applied" },
      {
        id: "x2",
        status: "failed",
        code: "action_failed",
        error: "Select a bowler before scoring the next ball.",
      },
    ]);
    expect(mutations.recordBall).toHaveBeenCalledTimes(2);
  });

  it("reports a thrown server error as that action's failure", async () => {
    vi.mocked(mutations.undoLastBall).mockRejectedValueOnce(new Error("boom"));
    const res = await POST(
      request(
        batch([
          { id: "u1", type: "undoLastBall", payload: {} },
          ballAction("x1"),
        ]),
      ),
    );
    expect((await json(res)).results).toEqual([
      { id: "u1", status: "failed", code: "action_failed", error: "boom" },
    ]);
    expect(mutations.recordBall).not.toHaveBeenCalled();
  });

  it("reports actions the match already applied as duplicates without re-running them", async () => {
    recentClientActions = ["x1", "x2"];
    const res = await POST(
      request(
        batch([
          { ...ballAction("x1"), resent: true },
          { ...ballAction("x2"), resent: true },
          ballAction("x3"),
        ]),
      ),
    );
    expect((await json(res)).results).toEqual([
      { id: "x1", status: "duplicate" },
      { id: "x2", status: "duplicate" },
      { id: "x3", status: "applied" },
    ]);
    expect(mutations.recordBall).toHaveBeenCalledTimes(1);
    expect(
      vi.mocked(mutations.recordBall).mock.calls[0]![0].clientActionId,
    ).toBe("x3");
  });

  it("skips the duplicate lookup when no action was sent before", async () => {
    recentClientActions = ["x1"];
    const res = await POST(request(batch([ballAction("x1")])));
    // The engine itself refuses a replay; the label is only cosmetic.
    expect((await json(res)).results).toEqual([
      { id: "x1", status: "applied" },
    ]);
    expect(fromTable).not.toHaveBeenCalled();

    await POST(request(batch([{ ...ballAction("x2"), resent: true }])));
    expect(fromTable).toHaveBeenCalledWith("matches");
  });

  it("answers with the documents the applied actions committed, merged", async () => {
    const match = { id: M, status: "live" };
    const inn = (runs: number) => ({ id: "inn1", total_runs: runs });
    const over = (n: number, balls: number) => ({
      id: `inn1_${n}`,
      innings_id: "inn1",
      over_number: n,
      balls: Array.from({ length: balls }, (_, i) => ({ id: `b${i}` })),
    });
    vi.mocked(mutations.recordBall)
      .mockResolvedValueOnce({
        data: null,
        error: null,
        delta: { match, innings: [inn(1)], overs: [over(0, 6)] },
      } as never)
      .mockResolvedValueOnce({
        data: null,
        error: null,
        delta: { match, innings: [inn(5)], overs: [over(1, 1)] },
      } as never);
    vi.mocked(mutations.setCurrentBowler).mockResolvedValueOnce({
      error: null,
      delta: { match, innings: [inn(1)], overs: [] },
    } as never);
    const res = await POST(
      request(
        batch([
          ballAction("x1"),
          { id: "x2", type: "setBowler", payload: { bowlerId: "b2" } },
          ballAction("x3", 4),
        ]),
      ),
    );
    const body = await json(res);
    expect(body.results!.map((r) => r.status)).toEqual([
      "applied",
      "applied",
      "applied",
    ]);
    expect(body.delta).toEqual({
      match,
      innings: [inn(5)],
      overs: [over(0, 6), over(1, 1)],
    });
  });

  it("answers without documents when an action has none or was a duplicate", async () => {
    vi.mocked(mutations.recordBall).mockResolvedValueOnce({
      data: null,
      error: null,
      delta: { match: { id: M }, innings: [], overs: [] },
    } as never);
    const withUndo = await POST(
      request(
        batch([ballAction("x1"), { id: "u1", type: "undoLastBall", payload: {} }]),
      ),
    );
    expect((await json(withUndo)).delta).toBeNull();

    recentClientActions = ["x5"];
    const dup = await POST(
      request(batch([{ ...ballAction("x5"), resent: true }])),
    );
    expect((await json(dup)).delta).toBeNull();
  });

  it("fails an invalid or unknown action in its place, after applying the ones before", async () => {
    const res = await POST(
      request(
        batch([
          ballAction("x1"),
          { id: "x2", type: "setBowler", payload: { bowlerId: "" } },
          ballAction("x3"),
        ]),
      ),
    );
    const results = (await json(res)).results!;
    expect(results.map((r) => [r.id, r.status, r.code])).toEqual([
      ["x1", "applied", undefined],
      ["x2", "failed", "invalid_action"],
    ]);
    expect(results[1]!.error).toMatch(/^invalid_action: bowlerId/);

    const unknown = await POST(
      request(batch([{ id: "y1", type: "declareInnings", payload: {} }])),
    );
    expect((await json(unknown)).results).toEqual([
      {
        id: "y1",
        status: "failed",
        code: "unsupported_action_type",
        error: "unsupported_action_type: declareInnings",
      },
    ]);
  });

  it("refuses a ball whose payload names another match", async () => {
    const other = ballAction("x1");
    other.payload.matchId = "match-2";
    const res = await POST(request(batch([other])));
    expect((await json(res)).results![0]).toMatchObject({
      status: "failed",
      code: "invalid_action",
    });
    expect(mutations.recordBall).not.toHaveBeenCalled();
  });

  it("accepts older v1 payload shapes (nulls for optional fields, extra keys)", async () => {
    const res = await POST(
      request(
        batch([
          {
            id: "x1",
            type: "recordBall",
            payload: {
              matchId: M,
              bowlerId: "b1",
              batsmanId: "a1",
              nonStrikerId: "a2",
              event: {
                runsScored: 0,
                extras: 1,
                extraType: "wide",
                isWicket: null,
                dismissalType: null,
                commentary: null,
                shotZone: null,
                legacyFlag: true,
              },
            },
          },
          // An undo queued before payloads were sent at all.
          { id: "x2", type: "undoLastBall" },
        ]),
      ),
    );
    expect((await json(res)).results).toEqual([
      { id: "x1", status: "applied" },
      { id: "x2", status: "applied" },
    ]);
    const event = vi.mocked(mutations.recordBall).mock.calls[0]![0].event;
    expect(event).toMatchObject({
      runsScored: 0,
      extras: 1,
      extraType: "wide",
    });
    expect(event.isWicket).toBeUndefined();
    expect(event).not.toHaveProperty("legacyFlag");
  });
});
