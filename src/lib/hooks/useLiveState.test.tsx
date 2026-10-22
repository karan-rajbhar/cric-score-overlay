import React from "react";
import { act, cleanup, renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Match } from "~/lib/match-types";
import type { LiveMatchState } from "~/components/overlay/types";

const watches: Array<{
  table: string;
  id: string;
  next: (data: Record<string, unknown> | null) => void;
  status?: (s: string) => void;
  options: unknown;
  stop: ReturnType<typeof vi.fn>;
}> = [];

vi.mock("~/lib/firebase/client", () => ({
  getFirebaseDb: () => ({}),
  createClient: () => ({}),
}));
vi.mock("~/lib/firebase/realtime", () => ({
  watchDoc: (
    _db: unknown,
    table: string,
    id: string,
    handlers: {
      next: (d: Record<string, unknown> | null) => void;
      status?: (s: string) => void;
    },
    options: unknown,
  ) => {
    const stop = vi.fn();
    watches.push({ table, id, ...handlers, options, stop });
    return stop;
  },
}));

const getMatch = vi.fn();
vi.mock("~/app/matches/queries", () => ({
  getMatch: (...args: unknown[]) => getMatch(...args),
  getPartnerships: vi.fn(),
  getOverSummaries: vi.fn(),
  getMatchBallLog: vi.fn(),
  getMatches: vi.fn(),
}));

import {
  applyLiveState,
  scheduleInvalidate,
  useLiveState,
  useOnLiveChange,
} from "./useLiveState";
import { useMatchDetailQuery } from "./useMatchQueries";

const MATCH_ID = "11111111-2222-4333-8444-555555555555";

function liveDoc(version: number, extra: Partial<LiveMatchState> = {}) {
  return {
    match_id: MATCH_ID,
    status: "live",
    innings_number: 1,
    total_runs: 10 * version,
    total_wickets: 1,
    total_balls: version,
    version,
    updated_at: "x",
    refs: {},
    ...extra,
  };
}

function baseMatch(): Match {
  return {
    id: MATCH_ID,
    status: "live",
    current_innings: 1,
    innings: [
      {
        id: "i1",
        match_id: MATCH_ID,
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

function wrapper(client: QueryClient) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
  };
}

beforeEach(() => {
  watches.length = 0;
  getMatch.mockReset();
  vi.useFakeTimers({ shouldAdvanceTime: true });
});
afterEach(() => {
  // Unmount, then let the shared listener's release timer fire so the next
  // test starts with a fresh one.
  cleanup();
  vi.runOnlyPendingTimers();
  vi.useRealTimers();
});

describe("applyLiveState", () => {
  it("patches the current innings totals and match status", () => {
    const patched = applyLiveState(
      baseMatch(),
      liveDoc(7, { status: "completed" }) as unknown as LiveMatchState,
    );
    expect(patched.status).toBe("completed");
    expect(patched.innings?.[0]?.total_runs).toBe(70);
    expect(patched.innings?.[0]?.total_balls).toBe(7);
  });

  it("carries a DLS revision of the innings in play onto the match", () => {
    const patched = applyLiveState(
      baseMatch(),
      liveDoc(7, {
        target_runs: 98,
        dls_overs: 12,
        innings_number: 2,
      }) as unknown as LiveMatchState,
    );
    expect(patched.dls_revision).toEqual({
      innings_number: 2,
      target_runs: 98,
      overs: 12,
    });
    // Without one the match keeps what it had.
    expect(
      applyLiveState(baseMatch(), liveDoc(7) as unknown as LiveMatchState)
        .dls_revision,
    ).toBeUndefined();
  });

  it("ignores a live row for another match", () => {
    const match = baseMatch();
    const other = { ...liveDoc(3), match_id: "other" };
    expect(applyLiveState(match, other as unknown as LiveMatchState)).toBe(
      match,
    );
  });
});

describe("useLiveState", () => {
  it("shares one live_state listener between components and strips doc fields", () => {
    const a = renderHook(() => useLiveState(MATCH_ID));
    const b = renderHook(() => useLiveState(MATCH_ID));
    expect(watches).toHaveLength(1);
    expect(watches[0]).toMatchObject({ table: "live_state", id: MATCH_ID });

    act(() =>
      watches[0]!.next({ ...liveDoc(4), updated_at: "2026-10-22T10:00:00.000Z" }),
    );
    expect(a.result.current.version).toBe(4);
    // When it last changed, for the "Updated 2 min ago" line.
    expect(a.result.current.updatedAt).toBe("2026-10-22T10:00:00.000Z");
    expect(b.result.current.state?.total_runs).toBe(40);
    expect(a.result.current.state).not.toHaveProperty("refs");

    a.unmount();
    b.unmount();
    vi.advanceTimersByTime(5000);
    expect(watches[0]!.stop).toHaveBeenCalledTimes(1);
  });

  it("does not subscribe when disabled", () => {
    renderHook(() => useLiveState(MATCH_ID, { enabled: false }));
    expect(watches).toHaveLength(0);
  });
});

describe("useOnLiveChange", () => {
  it("treats the first snapshot as a baseline and debounces bursts", () => {
    const onChange = vi.fn();
    const { rerender } = renderHook(
      ({ version }: { version: number | null }) =>
        useOnLiveChange({ version, state: null }, onChange, 1000),
      { initialProps: { version: null as number | null } },
    );
    rerender({ version: 5 });
    vi.advanceTimersByTime(2000);
    expect(onChange).not.toHaveBeenCalled();

    rerender({ version: 6 });
    rerender({ version: 7 });
    vi.advanceTimersByTime(999);
    expect(onChange).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(onChange).toHaveBeenCalledTimes(1);
  });
});

describe("scheduleInvalidate", () => {
  it("collapses calls for the same key into one invalidation", () => {
    const client = new QueryClient();
    const spy = vi.spyOn(client, "invalidateQueries");
    for (let i = 0; i < 5; i++) scheduleInvalidate(client, ["matchBallLog", "m"]);
    vi.advanceTimersByTime(0);
    expect(spy).toHaveBeenCalledTimes(1);
  });
});

describe("useMatchDetailQuery", () => {
  it("refetches the full match once per live change and patches totals in between", async () => {
    getMatch.mockResolvedValue({ data: baseMatch(), error: null });
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const { result } = renderHook(() => useMatchDetailQuery(MATCH_ID), {
      wrapper: wrapper(client),
    });
    await vi.waitFor(() => expect(result.current.data).toBeTruthy());
    expect(getMatch).toHaveBeenCalledTimes(1);
    expect(watches.filter((w) => w.table === "live_state")).toHaveLength(1);

    act(() => {
      watches[0]!.status?.("connected");
      watches[0]!.next(liveDoc(1));
    });
    expect(result.current.isConnected).toBe(true);
    vi.advanceTimersByTime(5000);
    expect(getMatch).toHaveBeenCalledTimes(1);

    // Three quick changes (ball + innings + match writes) -> one refetch.
    act(() => {
      watches[0]!.next(liveDoc(2));
      watches[0]!.next(liveDoc(3));
      watches[0]!.next(liveDoc(4));
    });
    expect(result.current.data?.innings?.[0]?.total_runs).toBe(40);
    await act(async () => {
      vi.advanceTimersByTime(2000);
    });
    await vi.waitFor(() => expect(getMatch).toHaveBeenCalledTimes(2));
    expect(getMatch).toHaveBeenLastCalledWith(MATCH_ID, { version: 4 });
    vi.advanceTimersByTime(60_000);
    expect(getMatch).toHaveBeenCalledTimes(2);
  });

  it("skips refetches while refetchOnChange is off and catches up once", async () => {
    getMatch.mockResolvedValue({ data: baseMatch(), error: null });
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const { result, rerender } = renderHook(
      ({ on }: { on: boolean }) =>
        useMatchDetailQuery(MATCH_ID, { refetchOnChange: on }),
      { wrapper: wrapper(client), initialProps: { on: false } },
    );
    await vi.waitFor(() => expect(result.current.data).toBeTruthy());
    act(() => watches[0]!.next(liveDoc(1)));
    act(() => watches[0]!.next(liveDoc(2)));
    act(() => watches[0]!.next(liveDoc(3)));
    await act(async () => {
      vi.advanceTimersByTime(5000);
    });
    expect(getMatch).toHaveBeenCalledTimes(1);
    expect(result.current.data?.innings?.[0]?.total_runs).toBe(30);

    rerender({ on: true });
    await act(async () => {
      vi.advanceTimersByTime(100);
    });
    await vi.waitFor(() => expect(getMatch).toHaveBeenCalledTimes(2));
  });
});
