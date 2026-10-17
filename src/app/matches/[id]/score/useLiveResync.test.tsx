/**
 * The scoring screen opened by a spectator (or a co-scorer's device) must
 * follow balls recorded elsewhere: before this hook it loaded once and only
 * a manual refresh showed new balls.
 */

import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type Handlers = { next: (d: Record<string, unknown> | null) => void };
const watches: Array<{ table: string; id: string } & Handlers> = [];
vi.mock("~/lib/firebase/client", () => ({ getFirebaseDb: () => ({}) }));
vi.mock("~/lib/firebase/realtime", () => ({
  watchDoc: (_db: unknown, table: string, id: string, handlers: Handlers) => {
    watches.push({ table, id, ...handlers });
    return () => {};
  },
}));

import { LIVE_REFETCH_DELAY_MS } from "~/lib/hooks/useLiveState";
import { useLiveResync } from "./useLiveResync";

let seq = 0;
function newMatchId() {
  seq += 1;
  return `11111111-2222-4333-8444-${String(seq).padStart(12, "0")}`;
}

function liveDoc(id: string, version: number, uid: string | null) {
  return {
    match_id: id,
    status: "live",
    total_runs: version,
    version,
    last_change: uid ? { uid, name: null, at: new Date().toISOString() } : null,
  };
}

function setup(userId: string | null, busy = false) {
  const matchId = newMatchId();
  const sync = vi.fn(async () => {});
  const hook = renderHook(
    (props: { busy: boolean }) =>
      useLiveResync({ matchId, userId, busy: props.busy, sync }),
    { initialProps: { busy } },
  );
  const watch = watches.find((w) => w.id === matchId && w.table === "live_state")!;
  const emit = async (version: number, uid: string | null) => {
    act(() => watch.next(liveDoc(matchId, version, uid)));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(LIVE_REFETCH_DELAY_MS + 10);
    });
  };
  return { sync, hook, emit };
}

describe("useLiveResync", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("re-reads the scoring state for a signed-out viewer on every new ball", async () => {
    const { sync, emit } = setup(null);
    await emit(1, "scorer"); // first snapshot: baseline
    expect(sync).not.toHaveBeenCalled();
    await emit(2, "scorer");
    expect(sync).toHaveBeenCalledTimes(1);
    await emit(3, "scorer");
    expect(sync).toHaveBeenCalledTimes(2);
  });

  it("follows a co-scorer but skips the echo of this screen's own ball", async () => {
    const { sync, hook, emit } = setup("me");
    await emit(1, "me");
    hook.rerender({ busy: true });
    hook.rerender({ busy: false });
    await emit(2, "me");
    expect(sync).not.toHaveBeenCalled();
    await emit(3, "other-scorer");
    expect(sync).toHaveBeenCalledTimes(1);
  });

  it("waits until this screen is idle (queued offline actions)", async () => {
    const { sync, hook, emit } = setup(null, true);
    await emit(1, "scorer");
    await emit(2, "scorer");
    expect(sync).not.toHaveBeenCalled();
    hook.rerender({ busy: false });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(sync).toHaveBeenCalledTimes(1);
  });
});
