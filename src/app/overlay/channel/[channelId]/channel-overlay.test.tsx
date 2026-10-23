import { act, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type Next = (doc: { match_id?: string | null } | null) => void;
const watchers: { table: string; id: string; next: Next }[] = [];
const unsubscribe = vi.fn();

vi.mock("~/lib/firebase/client", () => ({ getFirebaseDb: () => ({}) }));
vi.mock("~/lib/firebase/realtime", () => ({
  watchDoc: (
    _db: unknown,
    table: string,
    id: string,
    handlers: { next: Next },
  ) => {
    watchers.push({ table, id, next: handlers.next });
    return unsubscribe;
  },
}));
vi.mock("../../[matchId]/overlay-client", () => ({
  OverlayClient: (props: {
    matchId: string;
    initial: { total_runs: number } | null;
    serverNow?: number;
    params?: { theme?: string };
  }) => (
    <div data-testid="overlay">
      {props.matchId}:{props.initial?.total_runs ?? "none"}:
      {props.serverNow ?? "no-clock"}:{props.params?.theme ?? "-"}
    </div>
  ),
}));

import { ChannelOverlay } from "./channel-overlay";

/** Fetch answers per match id; a pending one resolves when told to. */
const pending = new Map<string, () => void>();
let fetched: string[] = [];

function stubFetch(holdFor: string[] = []) {
  vi.stubGlobal(
    "fetch",
    vi.fn((url: string) => {
      const id = decodeURIComponent(String(url).split("/").pop()!);
      fetched.push(id);
      const respond = () =>
        id === "gone"
          ? ({ ok: false, json: async () => ({}) } as Response)
          : ({
              ok: true,
              json: async () => ({
                live: { total_runs: id.length * 10 },
                match: { id },
                serverNow: 5,
              }),
            } as Response);
      if (!holdFor.includes(id)) return Promise.resolve(respond());
      return new Promise<Response>((resolve) => {
        pending.set(id, () => resolve(respond()));
      });
    }),
  );
}

/** A snapshot of the channel doc with this match on air (or none). */
const channel = (matchId: string | null) =>
  act(() => watchers[0]!.next({ match_id: matchId }));

describe("ChannelOverlay", () => {
  beforeEach(() => {
    watchers.length = 0;
    pending.clear();
    fetched = [];
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("listens to its channel doc once and shows nothing while off air", async () => {
    stubFetch();
    const { container } = render(<ChannelOverlay channelId="ch1" />);
    expect(watchers).toEqual([
      expect.objectContaining({ table: "stream_channels", id: "ch1" }),
    ]);
    await channel(null);
    expect(container).toBeEmptyDOMElement();
    expect(fetched).toEqual([]);
  });

  it("swaps the overlay when the channel switches match, without a reload", async () => {
    stubFetch(["match-b"]);
    render(<ChannelOverlay channelId="ch1" theme="light" />);
    await channel("a");
    // The server's clock and the link's settings go to the overlay.
    expect(await screen.findByTestId("overlay")).toHaveTextContent(
      "a:10:5:light",
    );

    // Switching: the previous match stays on air until the next loads.
    await channel("match-b");
    expect(screen.getByTestId("overlay")).toHaveTextContent("a:10");
    await act(async () => pending.get("match-b")!());
    await waitFor(() =>
      expect(screen.getByTestId("overlay")).toHaveTextContent("match-b:70"),
    );
    // Still the one channel listener.
    expect(watchers).toHaveLength(1);
    expect(fetched).toEqual(["a", "match-b"]);
  });

  it("goes blank off air and reloads fresh data when back on", async () => {
    stubFetch(["a"]);
    const { container } = render(<ChannelOverlay channelId="ch1" />);
    await channel("a");
    await act(async () => pending.get("a")!());
    expect(await screen.findByTestId("overlay")).toBeInTheDocument();

    await channel(null);
    expect(container).toBeEmptyDOMElement();

    // Back on: nothing until its data is fresh again (no stale overlay).
    await channel("a");
    expect(container).toBeEmptyDOMElement();
    await act(async () => pending.get("a")!());
    expect(await screen.findByTestId("overlay")).toHaveTextContent("a:10");
    expect(fetched).toEqual(["a", "a"]);
  });

  it("shows nothing for a match that no longer exists", async () => {
    stubFetch();
    const { container } = render(<ChannelOverlay channelId="ch1" />);
    await channel("a");
    expect(await screen.findByTestId("overlay")).toBeInTheDocument();
    await channel("gone");
    await waitFor(() => expect(container).toBeEmptyDOMElement());
  });
});
