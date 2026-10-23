/**
 * What a spectator on the match page costs per live change: one snapshot
 * per subscribed doc, the `overs` docs named by `live_state.overs_changed`
 * on the Balls / Stats tabs, and no server action at all.
 */

import React from "react";
import { act, cleanup, renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ballEventsOfOver, ballLogContext } from "~/lib/ball-log";
import {
  buildLiveScorecard,
  type ScorecardSource,
} from "~/lib/firebase/live-scorecard";
import type { OversRow } from "~/lib/firebase/scorecard";
import type { BallEvent, Match } from "~/lib/match-types";

type Handlers = {
  next: (d: Record<string, unknown> | null) => void;
  status?: (s: string) => void;
};
const watches: Array<
  { table: string; id: string; stop: ReturnType<typeof vi.fn> } & Handlers
> = [];
const overDocs = new Map<string, OversRow>();
const readDoc = vi.fn(async (_db: unknown, table: string, id: string) => {
  expect(table).toBe("overs");
  const doc = overDocs.get(id);
  return doc ? structuredClone(doc) : null;
});

vi.mock("~/lib/firebase/client", () => ({
  getFirebaseDb: () => ({}),
  createClient: () => ({}),
}));
vi.mock("~/lib/firebase/realtime", () => ({
  watchDoc: (_db: unknown, table: string, id: string, handlers: Handlers) => {
    const stop = vi.fn();
    watches.push({ table, id, ...handlers, stop });
    return stop;
  },
  readDoc: (db: unknown, table: string, id: string) => readDoc(db, table, id),
}));

const server = {
  getMatch: vi.fn(),
  getMatchBallLog: vi.fn(),
  ensureLiveScorecard: vi.fn(),
  getMatches: vi.fn(),
};
vi.mock("~/app/matches/queries", () => ({
  getMatch: (...a: unknown[]) => server.getMatch(...a),
  getMatchBallLog: (...a: unknown[]) => server.getMatchBallLog(...a),
  ensureLiveScorecard: (...a: unknown[]) => server.ensureLiveScorecard(...a),
  getMatches: (...a: unknown[]) => server.getMatches(...a),
}));

import { useLiveState } from "./useLiveState";
import {
  useMatchBallLogQuery,
  useMatchDetailQuery,
} from "./useMatchQueries";

let seq = 0;
/** A fresh match id per test (listeners and journals are per match). */
function newMatchId(): string {
  seq += 1;
  return `11111111-2222-4333-8444-${String(seq).padStart(12, "0")}`;
}

function baseMatch(id: string): Match {
  const roster = (team: string, ids: string[]) =>
    ids.map((u) => ({
      id: `${team}_${u}`,
      team_id: team,
      user_id: u,
      user: { id: u, full_name: `Name ${u}`, avatar_url: null },
    }));
  return {
    id,
    status: "live",
    current_innings: 1,
    team1_id: "t1",
    team2_id: "t2",
    team1: { id: "t1", name: "One", team_players: roster("t1", ["a1", "a2"]) },
    team2: { id: "t2", name: "Two", team_players: roster("t2", ["b1", "b2"]) },
    innings: [
      {
        id: `${id}-i1`,
        match_id: id,
        innings_number: 1,
        team_id: "t1",
        total_runs: 0,
        total_wickets: 0,
        total_balls: 0,
        total_overs: 0,
        is_completed: false,
      },
    ],
  } as unknown as Match;
}

function liveDoc(
  id: string,
  version: number,
  extra: Record<string, unknown> = {},
) {
  return {
    match_id: id,
    status: "live",
    innings_number: 1,
    total_runs: version,
    total_balls: version,
    version,
    updated_at: "x",
    refs: {},
    overs_changed: [],
    match_rev: "r1",
    ...extra,
  };
}

function scorecard(id: string, runs: number, version: number) {
  const innings: ScorecardSource = {
    id: `${id}-i1`,
    match_id: id,
    team_id: "t1",
    innings_number: 1,
    total_runs: runs,
    total_wickets: 0,
    total_balls: runs,
    total_overs: runs / 10,
    extras_total: 0,
    extras_byes: 0,
    extras_leg_byes: 0,
    extras_wides: 0,
    extras_no_balls: 0,
    extras_penalties: 0,
    extras_bonuses: 0,
    target_runs: null,
    is_completed: false,
    batting: [
      {
        user_id: "a1",
        batting_position: 1,
        runs_scored: runs,
        balls_faced: runs,
        minutes_batted: null,
        fours: 0,
        sixes: 0,
        is_out: false,
        dismissal_type: null,
        bowler_id: null,
        fielder_id: null,
        is_current_batsman: true,
        is_striker: true,
      },
    ],
    bowling: [],
    fall_of_wickets: [],
    partnerships: [
      {
        batsman1_id: "a1",
        batsman2_id: "a2",
        wicket_number: null,
        runs,
        balls: runs,
        start_over: 0,
        end_over: null,
        is_current: true,
      },
    ],
  };
  return buildLiveScorecard({
    matchId: id,
    innings: [innings],
    nameOf: (u) => `Name ${u}`,
    version,
    now: "x",
  });
}

function wrapper(client: QueryClient) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
  };
}

const newClient = () =>
  new QueryClient({ defaultOptions: { queries: { retry: false } } });

const listeners = (table: string, id: string) =>
  watches.filter((w) => w.table === table && w.id === id);

function serverCalls() {
  return Object.fromEntries(
    Object.entries(server).map(([k, fn]) => [k, fn.mock.calls.length]),
  );
}

beforeEach(() => {
  watches.length = 0;
  overDocs.clear();
  readDoc.mockClear();
  for (const fn of Object.values(server)) fn.mockReset();
  vi.useFakeTimers({ shouldAdvanceTime: true });
});
afterEach(() => {
  cleanup();
  vi.runOnlyPendingTimers();
  vi.useRealTimers();
});

describe("Summary / Scorecard / Top performers while live", () => {
  it("follows live_scorecard: one snapshot per doc per change, no server request", async () => {
    const id = newMatchId();
    server.getMatch.mockResolvedValue({ data: baseMatch(id), error: null });
    const client = newClient();
    const { result, rerender } = renderHook(
      ({ tab }: { tab: string }) =>
        useMatchDetailQuery(id, {
          refetchOnChange: tab !== "info",
          liveScorecard: tab !== "info",
        }),
      { wrapper: wrapper(client), initialProps: { tab: "summary" } },
    );
    await vi.waitFor(() => expect(result.current.data).toBeTruthy());
    act(() => listeners("live_state", id)[0]!.next(liveDoc(id, 1)));
    await vi.waitFor(() =>
      expect(listeners("live_scorecard", id)).toHaveLength(1),
    );
    const card = listeners("live_scorecard", id)[0]!;
    act(() => card.next(scorecard(id, 1, 1) as never));
    const before = serverCalls();

    for (let v = 2; v <= 6; v += 1) {
      act(() => {
        listeners("live_state", id)[0]!.next(liveDoc(id, v));
        card.next(scorecard(id, v, v) as never);
      });
      await act(async () => {
        vi.advanceTimersByTime(2000);
      });
    }
    // Five balls: 5 snapshots of each doc, nothing from the server.
    expect(listeners("live_state", id)).toHaveLength(1);
    expect(listeners("live_scorecard", id)).toHaveLength(1);
    expect(serverCalls()).toEqual(before);
    expect(server.getMatch).toHaveBeenCalledTimes(1);
    const inn = result.current.data!.innings![0]!;
    expect(inn.total_runs).toBe(6);
    expect(inn.batting_performances?.[0]).toMatchObject({
      runs_scored: 6,
      user: { id: "a1", full_name: "Name a1" },
    });

    // Info tab: the scorecard listener is dropped.
    rerender({ tab: "info" });
    await act(async () => {
      vi.advanceTimersByTime(5000);
    });
    expect(card.stop).toHaveBeenCalledTimes(1);
  });

  it("drops the live_state listener while the scorecard carries its copy", async () => {
    const id = newMatchId();
    server.getMatch.mockResolvedValue({ data: baseMatch(id), error: null });
    const withCopy = (v: number, extra: Record<string, unknown> = {}) => {
      const { refs: _refs, ...live } = liveDoc(id, v, extra);
      void _refs;
      return { ...scorecard(id, v, v), live };
    };
    const { result, rerender } = renderHook(
      ({ tab }: { tab: string }) =>
        useMatchDetailQuery(id, {
          refetchOnChange: tab !== "info",
          liveScorecard: tab !== "info",
        }),
      { wrapper: wrapper(newClient()), initialProps: { tab: "summary" } },
    );
    await vi.waitFor(() => expect(result.current.data).toBeTruthy());
    const liveListener = listeners("live_state", id)[0]!;
    act(() => liveListener.next(liveDoc(id, 1)));
    await vi.waitFor(() =>
      expect(listeners("live_scorecard", id)).toHaveLength(1),
    );
    const card = listeners("live_scorecard", id)[0]!;
    act(() => card.next(withCopy(1) as never));
    // The copy feeds the live state: its own listener stops.
    expect(liveListener.stop).toHaveBeenCalledTimes(1);

    for (let v = 2; v <= 6; v += 1) {
      act(() => card.next(withCopy(v) as never));
      await act(async () => {
        vi.advanceTimersByTime(2000);
      });
    }
    // One snapshot per ball, totals and live state current.
    expect(result.current.live.version).toBe(6);
    expect(result.current.isConnected).toBe(true);
    expect(result.current.data!.innings![0]!.total_runs).toBe(6);
    expect(server.getMatch).toHaveBeenCalledTimes(1);
    // A change to the match itself still refetches it.
    act(() => card.next(withCopy(7, { match_rev: "r2" }) as never));
    await act(async () => {
      vi.advanceTimersByTime(3000);
    });
    await vi.waitFor(() => expect(server.getMatch).toHaveBeenCalledTimes(2));

    // Info tab: the scorecard goes, live_state is followed again.
    rerender({ tab: "info" });
    await act(async () => {
      vi.advanceTimersByTime(5000);
    });
    expect(card.stop).toHaveBeenCalledTimes(1);
    expect(listeners("live_state", id)).toHaveLength(2);
  });

  it("refetches getMatch only when the match itself changes", async () => {
    const id = newMatchId();
    server.getMatch.mockResolvedValue({ data: baseMatch(id), error: null });
    const { result } = renderHook(
      () => useMatchDetailQuery(id, { liveScorecard: true }),
      { wrapper: wrapper(newClient()) },
    );
    await vi.waitFor(() => expect(result.current.data).toBeTruthy());
    act(() => listeners("live_state", id)[0]!.next(liveDoc(id, 1)));
    await vi.waitFor(() =>
      expect(listeners("live_scorecard", id)).toHaveLength(1),
    );
    act(() =>
      listeners("live_scorecard", id)[0]!.next(scorecard(id, 1, 1) as never),
    );
    // A bowler change: new version, same match_rev.
    act(() => listeners("live_state", id)[0]!.next(liveDoc(id, 2)));
    await act(async () => {
      vi.advanceTimersByTime(3000);
    });
    expect(server.getMatch).toHaveBeenCalledTimes(1);
    // Settings edited: match_rev moves.
    act(() =>
      listeners("live_state", id)[0]!.next(liveDoc(id, 3, { match_rev: "r2" })),
    );
    await act(async () => {
      vi.advanceTimersByTime(3000);
    });
    await vi.waitFor(() => expect(server.getMatch).toHaveBeenCalledTimes(2));
    // Match completed.
    act(() =>
      listeners("live_state", id)[0]!.next(
        liveDoc(id, 4, { match_rev: "r2", status: "completed" }),
      ),
    );
    await act(async () => {
      vi.advanceTimersByTime(3000);
    });
    await vi.waitFor(() => expect(server.getMatch).toHaveBeenCalledTimes(3));
  });

  it("asks the server once to build a missing doc", async () => {
    const id = newMatchId();
    server.getMatch.mockResolvedValue({ data: baseMatch(id), error: null });
    server.ensureLiveScorecard.mockResolvedValue({ data: null, error: null });
    const { result } = renderHook(
      () => useMatchDetailQuery(id, { liveScorecard: true }),
      { wrapper: wrapper(newClient()) },
    );
    await vi.waitFor(() => expect(result.current.data).toBeTruthy());
    act(() => listeners("live_state", id)[0]!.next(liveDoc(id, 1)));
    await vi.waitFor(() =>
      expect(listeners("live_scorecard", id)).toHaveLength(1),
    );
    act(() => listeners("live_scorecard", id)[0]!.next(null));
    await vi.waitFor(() =>
      expect(server.ensureLiveScorecard).toHaveBeenCalledTimes(1),
    );
    expect(server.ensureLiveScorecard).toHaveBeenCalledWith(id);
  });
});

// ---------------------------------------------------------------------------
// Balls / Stats: the ball log
// ---------------------------------------------------------------------------

function ball(
  inningsId: string,
  over: number,
  n: number,
  s: number,
  extra: Record<string, unknown> = {},
) {
  return {
    id: `${inningsId}_${over}~${s}`,
    ball_number: n,
    seq: s,
    bowler_id: "b1",
    batsman_id: "a1",
    non_striker_id: "a2",
    runs_scored: 1,
    extras: 0,
    extra_type: null,
    is_wicket: false,
    dismissal_type: null,
    fielder_id: null,
    dismissed_player_id: null,
    commentary: null,
    shot_zone: null,
    created_at: null,
    ...extra,
  };
}

function putOver(matchId: string, over: number, balls: object[]) {
  const inningsId = `${matchId}-i1`;
  const id = `${inningsId}_${over}`;
  if (!balls.length) overDocs.delete(id);
  else
    overDocs.set(id, {
      id,
      match_id: matchId,
      innings_id: inningsId,
      over_number: over,
      balls: balls as OversRow["balls"],
      updated_at: null,
    });
  return id;
}

/** What getMatchBallLog returns for the current over docs. */
function serverLog(match: Match): BallEvent[] {
  const ctx = ballLogContext([], match);
  return [...overDocs.values()]
    .flatMap((o) => ballEventsOfOver(o, ctx)!)
    .sort((a, b) => (a.seq ?? 0) - (b.seq ?? 0));
}

async function ballsTab() {
  const id = newMatchId();
  const match = baseMatch(id);
  const inn = `${id}-i1`;
  putOver(id, 0, [ball(inn, 0, 1, 1), ball(inn, 0, 2, 2)]);
  server.getMatch.mockResolvedValue({ data: match, error: null });
  server.getMatchBallLog.mockImplementation(async () => ({
    data: serverLog(match),
    error: null,
  }));
  const client = newClient();
  const page = renderHook(
    () => ({
      live: useLiveState(id),
      detail: useMatchDetailQuery(id, {
        refetchOnChange: false,
        liveScorecard: false,
      }),
    }),
    { wrapper: wrapper(client) },
  );
  await vi.waitFor(() => expect(page.result.current.detail.data).toBeTruthy());
  const live = () => listeners("live_state", id)[0]!;
  act(() => live().next(liveDoc(id, 1)));
  // The tab opens: several charts share the one log (Stats tab).
  const tab = renderHook(
    () => [
      useMatchBallLogQuery(id),
      useMatchBallLogQuery(id),
      useMatchBallLogQuery(id),
    ],
    { wrapper: wrapper(client) },
  );
  await vi.waitFor(() => expect(tab.result.current[0]!.data).toHaveLength(2));
  await act(async () => {
    vi.advanceTimersByTime(1000);
  });
  readDoc.mockClear();
  const emit = async (version: number, overs: string[]) => {
    act(() => live().next(liveDoc(id, version, { overs_changed: overs })));
    await act(async () => {
      vi.advanceTimersByTime(1000);
    });
  };
  const log = () => tab.result.current[0]!.data as BallEvent[];
  return { id, inn, match, emit, log };
}

describe("Balls / Stats ball log while live", () => {
  it("reads one over doc per ball (also across an over end) and no server", async () => {
    const { id, inn, match, emit, log } = await ballsTab();
    const calls = serverCalls();
    // Ball 3 of over 0.
    const o0 = putOver(id, 0, [
      ball(inn, 0, 1, 1),
      ball(inn, 0, 2, 2),
      ball(inn, 0, 3, 3, { runs_scored: 4 }),
    ]);
    await emit(2, [o0]);
    await vi.waitFor(() => expect(log()).toHaveLength(3));
    expect(readDoc).toHaveBeenCalledTimes(1);
    expect(readDoc).toHaveBeenLastCalledWith({}, "overs", o0);
    // The over ends, then the first ball of over 1: one doc each.
    putOver(id, 0, [
      ...overDocs.get(o0)!.balls,
      ball(inn, 0, 4, 4),
      ball(inn, 0, 5, 5),
      ball(inn, 0, 6, 6),
    ]);
    await emit(3, [o0]);
    const o1 = putOver(id, 1, [ball(inn, 1, 1, 7, { bowler_id: "b2" })]);
    await emit(4, [o1]);
    await vi.waitFor(() => expect(log()).toHaveLength(7));
    expect(readDoc).toHaveBeenCalledTimes(3);
    expect(log()).toEqual(serverLog(match));
    expect(serverCalls()).toEqual(calls);
  });

  it("applies an undo and an edit of an earlier over from the changed docs", async () => {
    const { id, inn, match, emit, log } = await ballsTab();
    const o1 = putOver(id, 1, [ball(inn, 1, 1, 3)]);
    await emit(2, [o1]);
    await vi.waitFor(() => expect(log()).toHaveLength(3));
    // Undo the only ball of over 1 (its doc is deleted).
    putOver(id, 1, []);
    await emit(3, [o1]);
    await vi.waitFor(() => expect(log()).toHaveLength(2));
    // update_ball on over 0 (an earlier over): that doc only.
    const o0 = putOver(id, 0, [
      ball(inn, 0, 1, 1, { runs_scored: 6, shot_zone: "long_on" }),
      ball(inn, 0, 2, 2),
    ]);
    await emit(4, [o0]);
    await vi.waitFor(() => expect(log()[0]!.runs_scored).toBe(6));
    expect(readDoc).toHaveBeenCalledTimes(3);
    expect(log()).toEqual(serverLog(match));
    expect(server.getMatchBallLog).toHaveBeenCalledTimes(1);
  });

  it("refetches the whole log after a missed version or an unknown player", async () => {
    const { id, inn, match, emit, log } = await ballsTab();
    // Versions 2 and 3 never observed (paused tab): full refetch.
    putOver(id, 0, [
      ball(inn, 0, 1, 1),
      ball(inn, 0, 2, 2),
      ball(inn, 0, 3, 3),
    ]);
    await emit(4, [`${inn}_0`]);
    await vi.waitFor(() =>
      expect(server.getMatchBallLog).toHaveBeenCalledTimes(2),
    );
    await vi.waitFor(() => expect(log()).toHaveLength(3));
    expect(readDoc).not.toHaveBeenCalled();
    // A batter on neither roster: full refetch (the server resolves names).
    const o1 = putOver(id, 1, [ball(inn, 1, 1, 4, { batsman_id: "x9" })]);
    await emit(5, [o1]);
    await vi.waitFor(() =>
      expect(server.getMatchBallLog).toHaveBeenCalledTimes(3),
    );
    expect(readDoc).toHaveBeenCalledTimes(1);
    void match;
  });
});
