import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { lookUpPlayers, PLAYER_LOOKUP_TIMEOUT_MS } from "./player-lookup";

describe("lookUpPlayers", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("asks the stable route, with the text encoded", async () => {
    const answer = { players: [], more: false };
    fetchMock.mockResolvedValue(new Response(JSON.stringify(answer)));
    await expect(lookUpPlayers("@rahul s&x")).resolves.toEqual(answer);
    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      "/api/players/search?q=%40rahul%20s%26x",
    );
  });

  it("rejects an error answer: it must not read as nobody found", async () => {
    fetchMock.mockResolvedValue(new Response("{}", { status: 500 }));
    await expect(lookUpPlayers("rahul")).rejects.toThrow(/500/);
  });

  it("gives up on a stalled connection", async () => {
    vi.useFakeTimers();
    fetchMock.mockImplementation(
      (_url: string, init: RequestInit) =>
        new Promise((_, reject) => {
          init.signal?.addEventListener("abort", () =>
            reject(new DOMException("Aborted", "AbortError")),
          );
        }),
    );
    const search = lookUpPlayers("rahul");
    const settled = expect(search).rejects.toThrow("Aborted");
    await vi.advanceTimersByTimeAsync(PLAYER_LOOKUP_TIMEOUT_MS);
    await settled;
  });
});
