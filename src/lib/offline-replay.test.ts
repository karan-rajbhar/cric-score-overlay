/**
 * Offline scoring end to end: actions queued while offline (balls, an undo
 * of a queued ball, a queued undo, a retirement, a new batter, penalty runs,
 * a bowler re-assignment and an edit of a synced ball) replay in order
 * through `POST /api/scoring/replay`, the real server-action code and the
 * scoring engine (on an in-memory store), and a replay after a lost
 * response (the server applied the batch, the client never heard back) is
 * not applied twice.
 *
 * The browser side is the real offline queue with its default transport
 * (`fetch`); only `fetch` is wired to the route handler. No server action
 * (and so no build-specific action id) is involved: a queue written by one
 * build replays against the next.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("~/lib/match-cache", () => ({ invalidateMatchCache: vi.fn() }));

let side: Stage2Side;
let signedIn: string | null;
vi.mock("~/lib/firebase/server", () => ({
  createServerClient: async () =>
    serverClientFor({
      ds: side.ds,
      db: null,
      getUser: async () =>
        signedIn
          ? { id: signedIn, email: null, phone: null, user_metadata: {} }
          : null,
    }),
}));

import { POST } from "~/app/api/scoring/replay/route";
import type { NextRequest } from "next/server";
import {
  awardPenaltyRuns,
  recordBall,
  retireBatter,
  setCurrentBatsmen,
  setCurrentBowler,
  undoLastBall,
  updateBall,
  type ScoringContext,
  appliedActionIdsOf,
} from "./firebase/rpc/scoring";
import { ballLogOf, type OversRow } from "./firebase/scorecard";
import { serverClientFor } from "./firebase/server-client";
import {
  ADMIN,
  GoldenReplay,
  SYNTHETIC_ROSTERS,
  syntheticTables,
} from "./firebase/scoring/__fixtures__/golden";
import {
  stage2Driver,
  type Stage2Side,
} from "./firebase/scoring/__fixtures__/stage2";
import type { InningsRow, MatchesRow } from "./firebase/types";
import {
  enqueueAction,
  enqueuePendingBall,
  flushPendingActions,
  getDeadLetterCount,
  getPendingActions,
  popLastAction,
} from "./offline-queue";
import type { ReplayBatch } from "./scoring-replay/protocol";

const M = "M";
const HOST = "cricscore.example.com";

interface Sent {
  headers: Headers;
  batch: ReplayBatch;
}

/**
 * Wires the browser's `fetch` to the route handler, as a same-origin
 * request from the score page. `loseReply(n)` drops the reply of the n-th
 * request after the server handled it.
 */
function wireFetchToRoute(loseReply: (n: number) => boolean = () => false) {
  const sent: Sent[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init: RequestInit) => {
      const headers = new Headers(init.headers);
      headers.set("Origin", `https://${HOST}`);
      headers.set("Host", HOST);
      sent.push({
        headers,
        batch: JSON.parse(String(init.body)) as ReplayBatch,
      });
      const res = await POST(
        new Request(`https://${HOST}${url}`, {
          method: init.method,
          headers,
          body: init.body,
        }) as unknown as NextRequest,
      );
      if (loseReply(sent.length)) throw new TypeError("Failed to fetch");
      return res;
    }),
  );
  return sent;
}

const inningsOf = (s: Stage2Side) =>
  s.ds
    .all("innings")
    .find((i) => i.innings_number === 1) as unknown as InningsRow;
const ballLog = (s: Stage2Side) =>
  ballLogOf(s.ds.all("overs") as unknown as OversRow[]);
const matchOf = (s: Stage2Side) =>
  s.ds.all("matches").find((m) => m.id === M) as unknown as MatchesRow;
/** Client action ids the match remembers (its own and its current innings'). */
const memoryOf = (s: Stage2Side) => {
  const match = matchOf(s);
  const current = (s.ds.all("innings") as unknown as InningsRow[]).find(
    (i) => i.innings_number === (match.current_innings ?? 1),
  );
  return appliedActionIdsOf(match, current ?? null);
};

/** A started match: 3 balls in, a1 on strike with a2, b1 bowling. */
async function startedMatch() {
  const s = stage2Driver(syntheticTables({ overs_per_innings: 3 }), true);
  const replay = new GoldenReplay(s, M, SYNTHETIC_ROSTERS);
  for (const runs of [1, 1, 0])
    await replay.step({ kind: "ball", ball: { runs } });
  const inn = inningsOf(s);
  const striker = inn.batting!.find((b) => b.is_striker)!.user_id;
  const nonStriker = inn.batting!.find(
    (b) => b.is_current_batsman && !b.is_striker,
  )!.user_id;
  const bowler = inn.bowling!.find((b) => b.is_current_bowler)!.user_id;
  return { side: s, striker, nonStriker, bowler };
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

describe("offline queue replay through /api/scoring/replay", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.unstubAllGlobals();
    signedIn = ADMIN;
  });

  it("replays balls, undo, retirement, penalties, re-assignment and edits in order, once", async () => {
    const started = await startedMatch();
    side = started.side;
    const { striker, nonStriker, bowler } = started;
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

    // ---- back online; the first batch (10 actions) reaches the server but
    // its reply is lost, so that flush stops there ----
    const sent = wireFetchToRoute((n) => n === 1);
    expect(await flushPendingActions(M)).toMatchObject({ synced: 0, failed: 1 });
    expect(getPendingActions(M)).toHaveLength(13);

    // Retry: the first ten are recognised (same ids) and not applied again.
    // Two flushes at once (the "online" event and a tap) share one replay.
    const [a, b] = await Promise.all([
      flushPendingActions(M),
      flushPendingActions(M),
    ]);
    expect(a).toMatchObject({ synced: 13, failed: 0 });
    expect(b).toBe(a);
    expect(getPendingActions(M)).toHaveLength(0);
    expect(getDeadLetterCount(M)).toBe(0);

    // Batches of ten, in queue order; the lost one re-sent whole.
    const ids = queued.map((q) => q.queueId);
    expect(sent.map((s) => s.batch.actions.map((x) => x.id))).toEqual([
      ids.slice(0, 10),
      ids.slice(0, 10),
      ids.slice(10),
    ]);
    // No server action involved.
    for (const s of sent) {
      expect(s.headers.get("next-action")).toBeNull();
      expect(s.batch.v).toBe(1);
    }

    // ---- the server state: the first ball edited to 3; 1, 0 synced
    // before; 0, 2 (the 1 was undone), a retirement, 1, then 0 ----
    const log = ballLog(side);
    const deliveries = log.filter((d) => !d.extra_type && !d.dismissal_type);
    expect(deliveries.map((d) => d.runs_scored)).toEqual([3, 1, 0, 0, 2, 1, 0]);
    expect(deliveries.map((d) => d.bowler_id)).toEqual([
      ...Array<string>(6).fill(bowler),
      "b9",
    ]);
    // The fielding side's award is not a delivery: it keeps no bowler.
    expect(log.find((d) => d.penalty_team_id === "TB")!.bowler_id).toBeNull();
    const inn = inningsOf(side);
    // 7 off the bat, +5 penalty runs to the batting side; the fielding
    // side's 5 wait for their innings.
    expect(inn.total_runs).toBe(12);
    expect(inn.extras_penalties).toBe(5);
    const retired = inn.batting!.find((x) => x.user_id === striker)!;
    expect(retired).toMatchObject({
      is_out: false,
      dismissal_type: "retired_hurt",
      is_current_batsman: false,
    });
    expect(log.filter((d) => d.dismissal_type === "retired_hurt")).toHaveLength(
      1,
    );
    expect(log.filter((d) => d.penalty_team_id === "TB")).toHaveLength(1);
  });

  it("replays a queue stored by an earlier build after a deploy", async () => {
    const started = await startedMatch();
    side = started.side;
    const { striker, nonStriker, bowler } = started;

    // localStorage exactly as an earlier build left it: a ball under the
    // pre-unified key, then actions in the unified queue (retry counters
    // from failed attempts against the old deployment included).
    localStorage.setItem(
      `cric_pending_balls_${M}`,
      JSON.stringify([
        {
          queueId: "1700000000000_old0001",
          enqueuedAt: 1700000000000,
          ...ball(bowler, striker, nonStriker, 2),
        },
      ]),
    );
    localStorage.setItem(
      `cric_pending_actions_${M}`,
      JSON.stringify([
        {
          queueId: "1700000000001_old0002",
          matchId: M,
          type: "recordBall",
          enqueuedAt: 1700000000001,
          retryCount: 1,
          lastError: "Failed to find Server Action",
          payload: {
            ...ball(bowler, striker, nonStriker, 4),
            event: {
              runsScored: 4,
              extras: 0,
              isWicket: false,
              shotZone: null,
            },
          },
        },
        {
          queueId: "1700000000002_old0003",
          matchId: M,
          type: "undoLastBall",
          enqueuedAt: 1700000000002,
          payload: {},
        },
      ]),
    );

    const sent = wireFetchToRoute();
    expect(await flushPendingActions(M)).toMatchObject({ synced: 3, failed: 0 });
    expect(sent).toHaveLength(1);
    expect(sent[0]!.batch.actions.map((x) => [x.type, x.id])).toEqual([
      ["recordBall", "1700000000000_old0001"],
      ["recordBall", "1700000000001_old0002"],
      ["undoLastBall", "1700000000002_old0003"],
    ]);
    expect(getPendingActions(M)).toHaveLength(0);
    // 3 synced balls, then 2 (the 4 was undone).
    expect(ballLog(side).map((d) => d.runs_scored)).toEqual([1, 1, 0, 2]);
    expect(memoryOf(side)).toEqual([
      "1700000000000_old0001",
      "1700000000001_old0002",
      "1700000000002_old0003",
    ]);
  });

  it("keeps the queue when the session has expired", async () => {
    const started = await startedMatch();
    side = started.side;
    enqueuePendingBall(
      ball(started.bowler, started.striker, started.nonStriker, 1),
    );
    signedIn = null;
    wireFetchToRoute();
    expect(await flushPendingActions(M)).toMatchObject({
      synced: 0,
      errorCode: "not_authenticated",
    });
    expect(getPendingActions(M)).toHaveLength(1);
    expect(getDeadLetterCount(M)).toBe(0);
    expect(ballLog(side)).toHaveLength(3);
  });
});

describe("the scoring engine recognises replayed client actions", () => {
  it("does not apply a replayed ball, undo, retirement, penalty, crease change or edit twice", async () => {
    const { side: s, striker, nonStriker, bowler } = await startedMatch();
    const ctx = (id: string): ScoringContext => ({
      ...s.ctx,
      clientActionId: id,
    });
    const recordArgs = (bat: string, non: string, runs: number) => ({
      p_match_id: M,
      p_bowler_id: bowler,
      p_batsman_id: bat,
      p_non_striker_id: non,
      p_runs_scored: runs,
    });

    await recordBall(ctx("x1"), recordArgs(striker, nonStriker, 1));
    await recordBall(ctx("x2"), recordArgs(nonStriker, striker, 1));
    expect(ballLog(s)).toHaveLength(5);
    // A ball replayed after the next one was recorded is still recognised.
    await recordBall(ctx("x1"), recordArgs(striker, nonStriker, 1));
    expect(ballLog(s)).toHaveLength(5);

    await undoLastBall(ctx("u1"), M);
    await undoLastBall(ctx("u1"), M);
    expect(ballLog(s)).toHaveLength(4);

    const retire = {
      p_match_id: M,
      p_player_id: striker,
      p_type: "retired_out",
    };
    await retireBatter(ctx("r1"), retire);
    await expect(retireBatter(ctx("r1"), retire)).resolves.toBeNull();
    expect(inningsOf(s).total_wickets).toBe(1);

    const award = {
      p_match_id: M,
      p_team_id: "TA",
      p_runs: 5,
      p_reason: "x",
      p_type: "penalty",
    };
    await awardPenaltyRuns(ctx("p1"), award);
    await awardPenaltyRuns(ctx("p1"), award);
    expect(inningsOf(s).extras_penalties).toBe(5);

    // Crease changes: a replay after a later change must not undo it.
    await setCurrentBatsmen(ctx("c1"), M, "a8", nonStriker);
    await setCurrentBatsmen(ctx("c2"), M, nonStriker, "a8");
    await setCurrentBatsmen(ctx("c1"), M, "a8", nonStriker);
    const crease = inningsOf(s).batting!.find((x) => x.is_striker)!;
    expect(crease.user_id).toBe(nonStriker);

    await setCurrentBowler(ctx("w1"), M, bowler);
    await setCurrentBowler(ctx("w2"), M, "b7");
    await setCurrentBowler(ctx("w1"), M, bowler);
    expect(
      inningsOf(s).bowling!.find((x) => x.is_current_bowler)!.user_id,
    ).toBe("b7");

    const first = ballLog(s)[0]!.id;
    const edit = (runs: number) => ({
      p_match_id: M,
      p_ball_id: first,
      p_runs_scored: runs,
    });
    await updateBall(ctx("e1"), edit(2));
    await updateBall(ctx("e2"), edit(6));
    await updateBall(ctx("e1"), edit(2));
    expect(ballLog(s)[0]!.runs_scored).toBe(6);

    expect(memoryOf(s)).toEqual([
      "x1",
      "x2",
      "u1",
      "r1",
      "p1",
      "c1",
      "c2",
      "w1",
      "w2",
      "e1",
      "e2",
    ]);
  });
});
