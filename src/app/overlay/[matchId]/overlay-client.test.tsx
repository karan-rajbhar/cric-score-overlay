import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, render, screen } from "@testing-library/react";

const watches: Array<{
  table: string;
  id: string;
  next: (data: Record<string, unknown> | null) => void;
  options: { pauseWhenHiddenMs?: number | null } | undefined;
}> = [];
const channels: string[] = [];

vi.mock("~/lib/firebase", () => ({
  firebase: {
    channel: vi.fn((topic: string) => {
      channels.push(topic);
      const ch = {
        on: vi.fn(() => ch),
        subscribe: vi.fn(() => ch),
        send: vi.fn(),
      };
      return ch;
    }),
    removeChannel: vi.fn(),
    from: vi.fn(),
  },
}));
vi.mock("~/lib/firebase/client", () => ({ getFirebaseDb: () => ({}) }));
vi.mock("~/lib/firebase/realtime", () => ({
  watchDoc: (
    _db: unknown,
    table: string,
    id: string,
    handlers: { next: (data: Record<string, unknown> | null) => void },
    options: { pauseWhenHiddenMs?: number | null } | undefined,
  ) => {
    watches.push({ table, id, next: handlers.next, options });
    return () => {};
  },
}));
vi.mock("~/components/overlay/sound-effects", () => ({
  playFourFanfare: vi.fn(),
  playSixExplosion: vi.fn(),
  playWicketTone: vi.fn(),
  playMilestoneFanfare: vi.fn(),
  playFreeHitAlert: vi.fn(),
}));

import { firebase } from "~/lib/firebase";
import { OverlayClient } from "./overlay-client";
import { DEMO_MATCH_STATE } from "./demo-data";

const REAL_ID = "33333333-2222-4333-8444-555555555555";

beforeEach(() => {
  watches.length = 0;
  channels.length = 0;
});

describe("OverlayClient realtime", () => {
  it("subscribes to live_state once, never pauses, and does not poll", () => {
    const intervalSpy = vi.spyOn(globalThis, "setInterval");
    render(
      <OverlayClient
        matchId={REAL_ID}
        initial={{ ...DEMO_MATCH_STATE, match_id: REAL_ID }}
        initialControls={false}
      />,
    );

    expect(watches.map((w) => [w.table, w.id])).toEqual([
      ["live_state", REAL_ID],
    ]);
    expect(watches[0]!.options?.pauseWhenHiddenMs ?? null).toBeNull();
    // Only the producer command channel remains; scores are not broadcast.
    expect(channels).toEqual([`overlay_control_${REAL_ID}`]);
    expect(firebase.from).not.toHaveBeenCalled();
    // The 8s stat carousel is the only interval; no data polling.
    const delays = intervalSpy.mock.calls.map(([, ms]) => ms);
    expect(delays.filter((ms) => ms !== 8000)).toEqual([]);

    act(() =>
      watches[0]!.next({
        ...DEMO_MATCH_STATE,
        match_id: REAL_ID,
        total_runs: 231,
        version: 3,
      }),
    );
    expect(screen.getAllByText(/231/).length).toBeGreaterThanOrEqual(1);
    // Applying a new snapshot does not resubscribe anything.
    expect(watches).toHaveLength(1);
    expect(channels).toHaveLength(1);
  });

  it("does not open a listener for the demo match", () => {
    render(
      <OverlayClient
        matchId="test"
        initial={DEMO_MATCH_STATE}
        initialControls={false}
      />,
    );
    expect(watches).toHaveLength(0);
  });
});
