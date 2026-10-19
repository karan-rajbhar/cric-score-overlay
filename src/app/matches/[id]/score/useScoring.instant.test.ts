import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useScoring } from "./useScoring";
import { getScoringState, getTeamPlayers } from "../../queries";
import { recordBall, undoLastBall } from "../../mutations";
import { getDeadLetterCount, getPendingActions } from "~/lib/offline-queue";
import { reportClientError } from "~/lib/report-error";
import {
  ballDocsAfter,
  bowlingWithBowler,
  checkBallArgs,
} from "~/lib/firebase/scoring/ball-docs";
import { overDocId, type OversRow } from "~/lib/firebase/scorecard";
import type { InningsRow, MatchesRow } from "~/lib/firebase/types";
import { applyLiveResync, type ScoringDelta } from "~/lib/scoring-delta";
import { recordBallArgsOf } from "~/lib/scoring-prediction";
import type { ReplayBatch, ReplayBatchAction } from "~/lib/scoring-replay/protocol";

vi.mock("~/lib/firebase/client", () => ({ getFirebaseDb: vi.fn() }));
vi.mock("~/lib/report-error", () => ({ reportClientError: vi.fn() }));

vi.mock("../../queries", () => ({
  getScoringState: vi.fn(),
  getMatch: vi.fn(async () => ({ data: null, error: null })),
  getTeamPlayers: vi.fn(),
}));

vi.mock("../../mutations", () => ({
  startMatch: vi.fn(),
  recordBall: vi.fn(),
  updateBall: vi.fn(),
  undoLastBall: vi.fn(),
  setCurrentBatsmen: vi.fn(),
  setCurrentBowler: vi.fn(),
  endInnings: vi.fn(),
  startSuperOver: vi.fn(),
  retirePlayer: vi.fn(),
  awardTeamPenalty: vi.fn(),
  reassignCurrentOverBowler: vi.fn(),
}));

vi.mock("../../../teams/actions", () => ({ createPlayerQuick: vi.fn() }));

vi.mock("sonner", () => ({
  toast: { info: vi.fn(), error: vi.fn(), success: vi.fn(), warning: vi.fn() },
}));

import { toast } from "sonner";

const M = "1523c4af-11e9-40bb-90f3-c8bf28db670d";
const INN = "inn-1";
const T1 = "team-1";
const T2 = "team-2";
const NOW = "2026-10-19T10:00:00.000Z";

const batter = (id: string, pos: number, striker: boolean) => ({
  user_id: id,
  batting_position: pos,
  runs_scored: 0,
  balls_faced: 0,
  minutes_batted: 0,
  fours: 0,
  sixes: 0,
  is_out: false,
  dismissal_type: null,
  bowler_id: null,
  fielder_id: null,
  is_current_batsman: true,
  is_striker: striker,
});

const bowler = (id: string, current: boolean) => ({
  user_id: id,
  overs_bowled: 0,
  balls_bowled: 0,
  runs_conceded: 0,
  wickets_taken: 0,
  maidens: 0,
  wides: 0,
  no_balls: 0,
  is_current_bowler: current,
});

const MATCH = {
  id: M,
  status: "live",
  current_innings: 1,
  team1_id: T1,
  team2_id: T2,
  balls_per_over: 6,
  overs_per_innings: 20,
  wickets_per_innings: 10,
  max_balls_per_over: null,
  last_ball_seq: null,
};

function freshInnings(): InningsRow & { id: string } {
  return {
    id: INN,
    match_id: M,
    team_id: T1,
    innings_number: 1,
    total_runs: 0,
    total_wickets: 0,
    total_overs: 0,
    total_balls: 0,
    extras_total: 0,
    extras_byes: 0,
    extras_leg_byes: 0,
    extras_wides: 0,
    extras_no_balls: 0,
    extras_penalties: 0,
    extras_bonuses: 0,
    is_completed: false,
    target_runs: null,
    created_at: NOW,
    updated_at: NOW,
    batting: [batter("p1", 1, true), batter("p2", 2, false)],
    bowling: [bowler("b1", true)],
    fall_of_wickets: [],
    partnerships: [],
    last_ball: null,
    last_over_bowler_id: null,
    last_ball_seq: 0,
  };
}

const NAMES = new Map(
  ["p1", "p2", "p3", "b1", "b2"].map((id) => [id, { id, full_name: `Player ${id}` }]),
);

const squad = (team: string, ids: string[]) =>
  ids.map((id) => ({
    id,
    team_id: team,
    user_id: id,
    user: { id, full_name: `Player ${id}` },
  }));

/** `getScoringState` for the server's documents (built the way a delta is). */
function scoringStateOf(innings: InningsRow & { id: string }, overs: OversRow[]) {
  const shell = {
    match: {
      ...MATCH,
      innings: [{ id: INN, innings_number: 1, team_id: T1, total_balls: 0 }],
    },
    strikerId: null,
    nonStrikerId: null,
    bowlerId: null,
    lastOverBowlerId: null,
    thisOverDeliveries: [] as unknown[],
  };
  const snapshot = applyLiveResync(
    shell,
    [innings],
    overs.map((o) => [o.id, o] as const),
    NAMES,
  )!;
  return { data: snapshot, base: { innings, overs }, error: null };
}

/**
 * A stand-in for the server: its own copy of the documents, changed by the
 * engine's functions (with its own ids and clock), answering the replay
 * route with the documents it committed.
 */
class FakeServer {
  innings = freshInnings();
  overs: OversRow[] = [];
  /** Per action: undefined applies it; a string fails it with that error. */
  fail: (a: ReplayBatchAction) => string | undefined = () => undefined;
  /** Changes the committed innings before it is answered (a drift). */
  tamper: ((inn: InningsRow & { id: string }) => void) | null = null;
  batches: ReplayBatch[] = [];
  /** Hold replies until `release()` (to look at the screen meanwhile). */
  hold = false;
  private waiting: Array<() => void> = [];
  private n = 0;

  release() {
    const w = this.waiting;
    this.waiting = [];
    for (const r of w) r();
  }

  state() {
    return scoringStateOf(this.innings, this.overs);
  }

  private apply(a: ReplayBatchAction): ScoringDelta {
    const now = `2026-10-19T10:00:${String((this.n += 1)).padStart(2, "0")}.000Z`;
    if (a.type === "recordBall") {
      const args = recordBallArgsOf(M, a.payload as never);
      const checked = checkBallArgs(args);
      if (!checked.ok) throw new Error(checked.code);
      const over = Math.floor((this.innings.total_balls ?? 0) / 6);
      const id = overDocId(INN, over);
      const docs = ballDocsAfter({
        match: MATCH as unknown as MatchesRow,
        innings: this.innings,
        overDoc: this.overs.find((o) => o.id === id) ?? null,
        args,
        checked: checked.checked,
        ballRandom: `srv${this.n}`,
        now,
      })!;
      this.innings = { ...this.innings, ...docs.inningsPatch };
      const overDoc = { ...docs.overDoc, id };
      this.overs = [...this.overs.filter((o) => o.id !== id), overDoc];
      this.tamper?.(this.innings);
      return {
        match: MATCH as never,
        innings: [this.innings],
        overs: [overDoc],
      };
    }
    if (a.type === "setBowler") {
      const next = bowlingWithBowler(
        this.innings.bowling ?? [],
        (a.payload as { bowlerId: string }).bowlerId,
      );
      if (next) this.innings = { ...this.innings, bowling: next };
      return { match: MATCH as never, innings: [this.innings], overs: [] };
    }
    throw new Error(`unexpected ${a.type}`);
  }

  install() {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init: RequestInit) => {
        expect(url).toBe("/api/scoring/replay");
        const batch = JSON.parse(String(init.body)) as ReplayBatch;
        this.batches.push(batch);
        if (this.hold) await new Promise<void>((r) => this.waiting.push(r));
        const results = [];
        const deltas: ScoringDelta[] = [];
        for (const action of batch.actions) {
          const error = this.fail(action);
          if (error) {
            results.push({ id: action.id, status: "failed", code: "action_failed", error });
            break;
          }
          deltas.push(this.apply(action));
          results.push({ id: action.id, status: "applied" });
        }
        const last = deltas.at(-1);
        const delta = last
          ? {
              match: last.match,
              innings: [this.innings],
              overs: this.overs.filter((o) =>
                deltas.some((d) => d.overs.some((w) => w.id === o.id)),
              ),
            }
          : null;
        return new Response(JSON.stringify({ v: 1, results, delta }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }),
    );
  }
}

const currentInnings = (match: { innings?: unknown[] } | null) =>
  match?.innings?.[0] as
    | { total_runs: number; total_balls: number; total_wickets: number }
    | undefined;

describe("useScoring: instant scoring", () => {
  let server: FakeServer;

  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    vi.unstubAllGlobals();
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(true);
    server = new FakeServer();
    server.install();
    vi.mocked(getTeamPlayers).mockImplementation(async (team: string) => ({
      data: team === T1 ? squad(T1, ["p1", "p2", "p3"]) : squad(T2, ["b1", "b2"]),
      error: null,
    }));
    vi.mocked(getScoringState).mockImplementation(async () => server.state() as never);
  });

  async function open(options?: Parameters<typeof useScoring>[1]) {
    const hook = renderHook(() => useScoring(M, options));
    await waitFor(() => expect(hook.result.current.loading).toBe(false));
    return hook;
  }

  it("shows a ball at once and saves it in the background", async () => {
    const { result } = await open();
    server.hold = true;

    await act(async () => {
      const res = await result.current.handleScore("b1", "p1", "p2", { runsScored: 4 });
      expect(res.error).toBeNull();
    });
    // On screen before the server has answered.
    expect(currentInnings(result.current.match)?.total_runs).toBe(4);
    expect(result.current.lastBalls).toEqual(["4"]);
    expect(result.current.isProcessing).toBe(false);
    expect(server.batches).toHaveLength(1);
    expect(server.batches[0]!.actions[0]).toMatchObject({ type: "recordBall" });
    expect(recordBall).not.toHaveBeenCalled();

    await act(async () => server.release());
    await waitFor(() => expect(getPendingActions(M)).toHaveLength(0));
    await waitFor(() => expect(result.current.isSaving).toBe(false));
    // The confirmed state is the server's (its ball id), same figures.
    expect(currentInnings(result.current.match)?.total_runs).toBe(4);
    expect(result.current.rawDeliveries[0]!.id).toContain("~srv");
    expect(reportClientError).not.toHaveBeenCalled();
    // The reply's documents were enough: no re-read.
    expect(getScoringState).toHaveBeenCalledTimes(1);
  });

  it("keeps scoring while earlier balls are still being saved, in order", async () => {
    const { result } = await open();
    server.hold = true;
    await act(async () => {
      await result.current.handleScore("b1", "p1", "p2", { runsScored: 1 });
    });
    // Strike rotated: the next ball is faced by p2, from the prediction.
    expect(result.current.strikerId).toBe("p2");
    await act(async () => {
      await result.current.handleScore("b1", "p2", "p1", { runsScored: 6 });
      await result.current.handleScore("b1", "p2", "p1", { runsScored: 0 });
    });
    expect(currentInnings(result.current.match)?.total_runs).toBe(7);
    expect(currentInnings(result.current.match)?.total_balls).toBe(3);

    await act(async () => server.release());
    await waitFor(() => expect(server.batches).toHaveLength(2));
    await act(async () => server.release());
    await waitFor(() => expect(getPendingActions(M)).toHaveLength(0));
    // The first request had one ball; the two tapped meanwhile went next.
    expect(server.batches.map((b) => b.actions.length)).toEqual([1, 2]);
    expect(server.innings.total_runs).toBe(7);
    expect(currentInnings(result.current.match)?.total_runs).toBe(7);
    expect(reportClientError).not.toHaveBeenCalled();
  });

  it("asks for the next batsman and bowler straight from the prediction", async () => {
    const onNeedsBatsman = vi.fn();
    const onNeedsBowler = vi.fn();
    const { result } = await open({ onNeedsBatsman, onNeedsBowler });
    server.hold = true;
    await act(async () => {
      await result.current.handleScore("b1", "p1", "p2", {
        runsScored: 0,
        isWicket: true,
        dismissalType: "bowled",
        dismissedPlayerId: "p1",
      });
    });
    expect(onNeedsBatsman).toHaveBeenCalledTimes(1);
    expect(result.current.strikerId).toBeNull();
    expect(currentInnings(result.current.match)?.total_wickets).toBe(1);
    await act(async () => server.release());
  });

  it("prompts for the bowler when an over ends, and predicts the bowler change", async () => {
    const onNeedsBowler = vi.fn();
    const { result } = await open({ onNeedsBowler });
    for (let i = 0; i < 6; i++) {
      const s = result.current.strikerId!;
      const ns = result.current.nonStrikerId!;
      await act(async () => {
        await result.current.handleScore("b1", s, ns, { runsScored: 0 });
      });
    }
    expect(onNeedsBowler).toHaveBeenCalled();
    expect(result.current.currentBowlerId).toBeNull();
    server.hold = true;
    await act(async () => {
      expect(await result.current.handleConfirmBowler("b2")).toEqual({ error: null });
    });
    expect(result.current.currentBowlerId).toBe("b2");
    // The new over starts empty on screen.
    expect(result.current.lastBalls).toEqual([]);
    await act(async () => server.release());
    await waitFor(() => expect(getPendingActions(M)).toHaveLength(0));
    expect(server.innings.bowling?.find((b) => b.is_current_bowler)?.user_id).toBe("b2");
  });

  it("refuses the same bowler for the next over without queueing anything", async () => {
    const { result } = await open();
    for (let i = 0; i < 6; i++) {
      const s = result.current.strikerId!;
      const ns = result.current.nonStrikerId!;
      await act(async () => {
        await result.current.handleScore("b1", s, ns, { runsScored: 0 });
      });
    }
    await waitFor(() => expect(getPendingActions(M)).toHaveLength(0));
    // Not predicted (the engine refuses it): the waiting path sends it.
    const { setCurrentBowler } = await import("../../mutations");
    vi.mocked(setCurrentBowler).mockResolvedValueOnce({
      error: "The same bowler cannot bowl consecutive overs.",
    });
    await act(async () => {
      await result.current.handleConfirmBowler("b1");
    });
    expect(setCurrentBowler).toHaveBeenCalledTimes(1);
    expect(getPendingActions(M)).toHaveLength(0);
  });

  it("undoes a ball the server has not received yet on the device", async () => {
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
    const { result } = await open();
    await act(async () => {
      await result.current.handleScore("b1", "p1", "p2", { runsScored: 4 });
    });
    expect(currentInnings(result.current.match)?.total_runs).toBe(4);
    expect(getPendingActions(M)).toHaveLength(1);
    await act(async () => {
      await result.current.handleUndo();
    });
    expect(getPendingActions(M)).toHaveLength(0);
    expect(currentInnings(result.current.match)?.total_runs).toBe(0);
    expect(undoLastBall).not.toHaveBeenCalled();
    expect(server.batches).toHaveLength(0);
  });

  it("lets a ball already on its way reach the server before undoing it there", async () => {
    const { result } = await open();
    server.hold = true;
    await act(async () => {
      await result.current.handleScore("b1", "p1", "p2", { runsScored: 4 });
    });
    vi.mocked(undoLastBall).mockResolvedValueOnce({ data: null, error: null });
    let undone: Promise<unknown>;
    act(() => {
      undone = result.current.handleUndo();
    });
    expect(undoLastBall).not.toHaveBeenCalled();
    await act(async () => server.release());
    await act(async () => {
      await undone;
    });
    expect(server.innings.total_runs).toBe(4);
    expect(undoLastBall).toHaveBeenCalledTimes(1);
  });

  it("goes back to the saved score when the server refuses a ball, with what came after it", async () => {
    const { result } = await open();
    server.fail = (a) =>
      (a.payload as { event?: { runsScored?: number } }).event?.runsScored === 6
        ? "not_authorized: scoring rights were removed"
        : undefined;
    server.hold = true;
    await act(async () => {
      await result.current.handleScore("b1", "p1", "p2", { runsScored: 2 });
      await result.current.handleScore("b1", "p1", "p2", { runsScored: 6 });
      await result.current.handleScore("b1", "p1", "p2", { runsScored: 1 });
    });
    expect(currentInnings(result.current.match)?.total_runs).toBe(9);
    await act(async () => server.release());
    await waitFor(() => expect(server.batches).toHaveLength(2));
    await act(async () => server.release());
    await waitFor(() => expect(getPendingActions(M)).toHaveLength(0));
    await waitFor(() =>
      expect(currentInnings(result.current.match)?.total_runs).toBe(2),
    );
    expect(getDeadLetterCount(M)).toBe(2);
    expect(toast.error).toHaveBeenCalledWith(
      expect.stringMatching(/^Not saved: not_authorized.*1 later action/),
    );
  });

  it("reports a prediction that differs from the server, and shows the server's", async () => {
    const { result } = await open();
    server.tamper = (inn) => {
      inn.total_runs = (inn.total_runs ?? 0) + 1;
    };
    await act(async () => {
      await result.current.handleScore("b1", "p1", "p2", { runsScored: 4 });
    });
    await waitFor(() => expect(getPendingActions(M)).toHaveLength(0));
    await waitFor(() =>
      expect(currentInnings(result.current.match)?.total_runs).toBe(5),
    );
    expect(reportClientError).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining("prediction differed"),
      }),
    );
  });

  it("keeps the ball queued and retries when the reply does not arrive", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      const { result } = await open();
      const fetchOk = vi.mocked(fetch).getMockImplementation()!;
      vi.mocked(fetch).mockImplementationOnce(async () => {
        throw new TypeError("Failed to fetch");
      });
      await act(async () => {
        await result.current.handleScore("b1", "p1", "p2", { runsScored: 3 });
      });
      await waitFor(() => expect(result.current.syncStuck).toBe(true));
      expect(getPendingActions(M)).toHaveLength(1);
      expect(currentInnings(result.current.match)?.total_runs).toBe(3);
      vi.mocked(fetch).mockImplementation(fetchOk);
      await act(async () => {
        await vi.advanceTimersByTimeAsync(2_500);
      });
      await waitFor(() => expect(getPendingActions(M)).toHaveLength(0));
      expect(result.current.syncStuck).toBe(false);
      expect(server.innings.total_runs).toBe(3);
      // The retry said it was a resend, so the server labels a duplicate.
      expect(server.batches.at(-1)!.actions[0]!.resent).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it("waits for the server when it has no documents to predict from", async () => {
    vi.mocked(getScoringState).mockImplementation(
      async () => ({ ...server.state(), base: null }) as never,
    );
    vi.mocked(recordBall).mockResolvedValueOnce({ data: null, error: null });
    const { result } = await open();
    await act(async () => {
      await result.current.handleScore("b1", "p1", "p2", { runsScored: 4 });
    });
    expect(recordBall).toHaveBeenCalledTimes(1);
    expect(server.batches).toHaveLength(0);
  });
});
