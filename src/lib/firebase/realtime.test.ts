import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const listeners: Array<{
  path: string;
  next: (snap: unknown) => void;
  error: (err: Error) => void;
  unsubscribe: ReturnType<typeof vi.fn>;
}> = [];

const getDocFromServer = vi.fn();

vi.mock("firebase/firestore", () => ({
  doc: (_db: unknown, table: string, id: string) => ({ path: `${table}/${id}` }),
  onSnapshot: (
    ref: { path: string },
    next: (snap: unknown) => void,
    error: (err: Error) => void,
  ) => {
    const unsubscribe = vi.fn();
    listeners.push({ path: ref.path, next, error, unsubscribe });
    return unsubscribe;
  },
  getDocFromServer: (ref: { path: string }) => getDocFromServer(ref),
  addDoc: vi.fn(),
  collection: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
  serverTimestamp: vi.fn(),
  Timestamp: { fromMillis: vi.fn() },
}));

import { watchDoc } from "./realtime";

function snap(data: Record<string, unknown> | null) {
  return { exists: () => data !== null, data: () => data };
}

function setHidden(hidden: boolean) {
  Object.defineProperty(document, "visibilityState", {
    value: hidden ? "hidden" : "visible",
    configurable: true,
  });
  document.dispatchEvent(new Event("visibilitychange"));
}

describe("watchDoc", () => {
  beforeEach(() => {
    listeners.length = 0;
    getDocFromServer.mockReset();
    vi.useFakeTimers();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => {
    setHidden(false);
    vi.useRealTimers();
  });

  it("listens to exactly one document and reports missing docs as null", () => {
    const next = vi.fn();
    const stop = watchDoc({} as never, "live_state", "m1", { next });
    expect(listeners.map((l) => l.path)).toEqual(["live_state/m1"]);

    listeners[0]!.next(snap(null));
    listeners[0]!.next(snap({ version: 2 }));
    expect(next).toHaveBeenNthCalledWith(1, null);
    expect(next).toHaveBeenNthCalledWith(2, { version: 2 });

    stop();
    expect(listeners[0]!.unsubscribe).toHaveBeenCalledTimes(1);
  });

  it("pauses after the tab is hidden long enough and resumes with a fresh listener", () => {
    const status = vi.fn();
    const stop = watchDoc(
      {} as never,
      "live_state",
      "m1",
      { next: vi.fn(), status },
      { pauseWhenHiddenMs: 60_000 },
    );
    expect(listeners).toHaveLength(1);

    // A short trip to another tab keeps the listener.
    setHidden(true);
    vi.advanceTimersByTime(30_000);
    setHidden(false);
    expect(listeners[0]!.unsubscribe).not.toHaveBeenCalled();
    expect(listeners).toHaveLength(1);

    setHidden(true);
    vi.advanceTimersByTime(60_000);
    expect(listeners[0]!.unsubscribe).toHaveBeenCalledTimes(1);
    expect(status).toHaveBeenLastCalledWith("paused");

    setHidden(false);
    expect(listeners).toHaveLength(2);
    expect(listeners[1]!.path).toBe("live_state/m1");
    stop();
  });

  it("never pauses when pauseWhenHiddenMs is null", () => {
    const stop = watchDoc({} as never, "live_state", "m1", { next: vi.fn() });
    setHidden(true);
    vi.advanceTimersByTime(10 * 60_000);
    expect(listeners[0]!.unsubscribe).not.toHaveBeenCalled();
    stop();
  });

  it("re-attaches after a listener error", () => {
    const status = vi.fn();
    const stop = watchDoc({} as never, "live_state", "m1", {
      next: vi.fn(),
      status,
    });
    listeners[0]!.error(new Error("unavailable"));
    expect(status).toHaveBeenLastCalledWith("error", expect.any(Error));
    vi.advanceTimersByTime(30_000);
    expect(listeners).toHaveLength(2);
    stop();
  });

  it("starts over when shown after a long absence whose pause never ran", () => {
    const stop = watchDoc(
      {} as never,
      "live_state",
      "m1",
      { next: vi.fn() },
      { pauseWhenHiddenMs: 60_000 },
    );
    setHidden(true);
    // A frozen background tab: the clock moves on, the pause timer does not.
    vi.setSystemTime(Date.now() + 5 * 60_000);
    setHidden(false);
    expect(listeners[0]!.unsubscribe).toHaveBeenCalledTimes(1);
    expect(listeners).toHaveLength(2);
    stop();
  });

  it("re-attaches a live listener that went silent while the doc moved on", async () => {
    const next = vi.fn();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const stop = watchDoc(
      {} as never,
      "live_state",
      "m1",
      { next },
      {
        staleCheck: {
          afterMs: 180_000,
          when: (d) => (d as { status?: string } | null)?.status === "live",
        },
      },
    );
    listeners[0]!.next(snap({ status: "live", version: 1 }));

    // Nothing changed on the server: one read, listener kept.
    getDocFromServer.mockResolvedValueOnce(snap({ status: "live", version: 1 }));
    await vi.advanceTimersByTimeAsync(180_000);
    expect(getDocFromServer).toHaveBeenCalledTimes(1);
    expect(listeners).toHaveLength(1);

    // The server is ahead of the listener: deliver and re-attach.
    getDocFromServer.mockResolvedValueOnce(snap({ status: "live", version: 4 }));
    await vi.advanceTimersByTimeAsync(180_000);
    expect(next).toHaveBeenLastCalledWith({ status: "live", version: 4 });
    expect(listeners[0]!.unsubscribe).toHaveBeenCalledTimes(1);
    expect(listeners).toHaveLength(2);
    expect(warn).toHaveBeenCalled();
    stop();
  });

  it("does not check a finished match", async () => {
    const stop = watchDoc(
      {} as never,
      "live_state",
      "m1",
      { next: vi.fn() },
      {
        staleCheck: {
          afterMs: 180_000,
          when: (d) => (d as { status?: string } | null)?.status === "live",
        },
      },
    );
    listeners[0]!.next(snap({ status: "completed", version: 9 }));
    await vi.advanceTimersByTimeAsync(10 * 180_000);
    expect(getDocFromServer).not.toHaveBeenCalled();
    stop();
  });
});
