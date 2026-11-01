import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { usePlayerSearch, useSameNameCheck } from "./usePlayerSearch";

const answer = (id: string) => ({
  players: [{ id, name: id }],
  more: false,
});

describe("usePlayerSearch", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  const settle = () =>
    act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });

  it("searches nothing for an empty query", async () => {
    const search = vi.fn();
    const { result } = renderHook(() => usePlayerSearch("", search));
    await settle();
    expect(result.current.status).toBe("idle");
    expect(search).not.toHaveBeenCalled();
  });

  it("is searching from the first keystroke, before the debounce ends", async () => {
    const search = vi.fn().mockResolvedValue(answer("a"));
    const { result } = renderHook(() => usePlayerSearch("rah", search));
    expect(result.current.status).toBe("searching");
    expect(search).not.toHaveBeenCalled();
    await settle();
    expect(result.current.status).toBe("done");
    expect(result.current.players.map((p) => p.id)).toEqual(["a"]);
  });

  it("searches once for fast typing", async () => {
    const search = vi.fn().mockResolvedValue(answer("a"));
    const { rerender } = renderHook(({ q }) => usePlayerSearch(q, search), {
      initialProps: { q: "ra" },
    });
    rerender({ q: "rah" });
    rerender({ q: "rahu" });
    await settle();
    expect(search.mock.calls).toEqual([["rahu"]]);
  });

  it("does not show an older query's answer for a newer one", async () => {
    let finishOld = (_: ReturnType<typeof answer>) => {};
    const search = vi
      .fn()
      .mockImplementationOnce(() => new Promise((r) => (finishOld = r)))
      .mockResolvedValueOnce(answer("new"));
    const { result, rerender } = renderHook(
      ({ q }) => usePlayerSearch(q, search),
      { initialProps: { q: "ra" } },
    );
    await settle();
    rerender({ q: "rahul" });
    await settle();
    await act(async () => finishOld(answer("old")));
    expect(result.current.players.map((p) => p.id)).toEqual(["new"]);
  });

  it("reports a failed search as failed, and retry asks again", async () => {
    const search = vi
      .fn()
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce(answer("a"));
    const { result } = renderHook(() => usePlayerSearch("rahul", search));
    await settle();
    expect(result.current.status).toBe("failed");
    expect(result.current.players).toEqual([]);

    act(() => result.current.retry());
    expect(result.current.status).toBe("searching");
    await settle();
    expect(result.current.status).toBe("done");
    expect(search).toHaveBeenCalledTimes(2);
  });
});

describe("useSameNameCheck", () => {
  const rahul = { id: "r", name: "Rahul Sharma" };

  it("lets a name nobody has straight through", () => {
    const { result } = renderHook(() => useSameNameCheck("Amit", [rahul]));
    expect(result.current.allow()).toBe(true);
  });

  it("asks once for a name someone has, then lets it through", () => {
    const { result } = renderHook(() =>
      useSameNameCheck("rahul sharma", [rahul]),
    );
    let first = true;
    act(() => {
      first = result.current.allow();
    });
    expect(first).toBe(false);
    expect(result.current.asking).toBe(true);
    expect(result.current.twin).toBe(rahul);
    expect(result.current.allow()).toBe(true);
  });

  it("asks again for a different name", () => {
    const { result, rerender } = renderHook(
      ({ q }) => useSameNameCheck(q, [rahul, { id: "a", name: "Amit" }]),
      { initialProps: { q: "rahul sharma" } },
    );
    act(() => {
      result.current.allow();
    });
    rerender({ q: "amit" });
    expect(result.current.asking).toBe(false);
  });
});
