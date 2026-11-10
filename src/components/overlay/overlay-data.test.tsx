import { afterEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";

/** Each read of `table/id` waits until the test answers it. */
const reads = new Map<string, (doc: unknown) => void>();
vi.mock("~/lib/firebase/client", () => ({ getFirebaseDb: () => ({}) }));
vi.mock("~/lib/firebase/realtime", () => ({
  watchDoc: () => () => {},
  readDoc: (_db: unknown, table: string, id: string) =>
    new Promise((resolve) => reads.set(`${table}/${id}`, resolve)),
}));

import { clearOverlayDocCache, useDocWhenShown } from "./overlay-data";

afterEach(() => {
  reads.clear();
  clearOverlayDocCache();
});

describe("useDocWhenShown", () => {
  it("never shows the previous player's document while the next one is read", async () => {
    const { result, rerender } = renderHook(
      ({ id }: { id: string }) =>
        useDocWhenShown<{ runs: number }>("player_career_stats", id, true),
      { initialProps: { id: "striker" } },
    );
    expect(result.current).toEqual({ data: null, loaded: false });
    await act(async () => reads.get("player_career_stats/striker")!({ runs: 812 }));
    expect(result.current).toEqual({ data: { runs: 812 }, loaded: true });

    // The strike changes: nothing until the new batter's figures land.
    rerender({ id: "non-striker" });
    expect(result.current).toEqual({ data: null, loaded: false });
    await act(async () =>
      reads.get("player_career_stats/non-striker")!({ runs: 95 }),
    );
    expect(result.current).toEqual({ data: { runs: 95 }, loaded: true });

    // Back to the first: its read is kept.
    rerender({ id: "striker" });
    expect(result.current).toEqual({ data: { runs: 812 }, loaded: true });
  });
});
