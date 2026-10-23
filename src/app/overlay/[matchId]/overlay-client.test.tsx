import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, render, screen } from "@testing-library/react";

const watches: Array<{
  table: string;
  id: string;
  next: (data: Record<string, unknown> | null) => void;
  options: { pauseWhenHiddenMs?: number | null } | undefined;
}> = [];

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

import { playSixExplosion } from "~/components/overlay/sound-effects";
import { OverlayClient } from "./overlay-client";
import { DEMO_MATCH_DETAILS, DEMO_MATCH_STATE } from "./demo-data";

/** The score as the bar shows it ("138/5"). */
const SCORE = `${DEMO_MATCH_STATE.total_runs}/${DEMO_MATCH_STATE.total_wickets}`;
const scoreOf = (runs: number) => `${runs}/${DEMO_MATCH_STATE.total_wickets}`;

// A new id per test: the live_state listener outlives an unmount briefly.
let n = 0;
let REAL_ID = "";
const NOW = 1_800_000_000_000;

const watchOf = (table: string) => watches.find((w) => w.table === table)!;

function renderOverlay(
  props: Partial<React.ComponentProps<typeof OverlayClient>> = {},
) {
  return render(
    <OverlayClient
      matchId={REAL_ID}
      initial={{ ...DEMO_MATCH_STATE, match_id: REAL_ID }}
      match={DEMO_MATCH_DETAILS}
      serverNow={NOW}
      {...props}
    />,
  );
}

beforeEach(() => {
  n += 1;
  REAL_ID = `33333333-2222-4333-8444-${String(n).padStart(12, "0")}`;
  watches.length = 0;
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] });
  vi.setSystemTime(NOW);
});
afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe("OverlayClient", () => {
  it("follows two documents, never paused, and polls nothing", () => {
    const intervalSpy = vi.spyOn(globalThis, "setInterval");
    renderOverlay();
    expect(watches.map((w) => [w.table, w.id]).sort()).toEqual([
      ["live_state", REAL_ID],
      ["overlay_state", REAL_ID],
    ]);
    for (const w of watches)
      expect(w.options?.pauseWhenHiddenMs ?? null).toBeNull();
    // Only the ribbon's slide timer; no data polling.
    expect(intervalSpy.mock.calls.every(([, ms]) => ms === 8000)).toBe(true);
  });

  it("draws once the producer state is in, with nothing to click on air", () => {
    renderOverlay();
    // Not before: no flash of the wrong look.
    expect(screen.queryByText(SCORE)).toBeNull();
    act(() => watchOf("overlay_state").next(null));
    expect(screen.getByText(SCORE)).toBeInTheDocument();
    expect(screen.queryAllByRole("button")).toHaveLength(0);
    expect(screen.queryByText(/connected|offline/i)).toBeNull();

    act(() =>
      watchOf("live_state").next({
        ...DEMO_MATCH_STATE,
        match_id: REAL_ID,
        total_runs: 231,
        version: 3,
      }),
    );
    expect(screen.getByText(scoreOf(231))).toBeInTheDocument();
  });

  it("draws from the link alone if the producer state is slow", () => {
    renderOverlay();
    act(() => vi.advanceTimersByTime(3000));
    expect(screen.getByText(SCORE)).toBeInTheDocument();
  });

  it("shows what the control room put on air, including after a reload", () => {
    renderOverlay();
    act(() =>
      watchOf("overlay_state").next({
        version: 4,
        at: NOW - 2000,
        scene: { card: "toss", layout: "top" },
        strap: {
          id: "s1",
          type: "custom",
          title: "Play resumes at 3:30",
          durationMs: 8000,
          at: NOW - 2000,
        },
        cue: null,
      }),
    );
    expect(
      screen.getByText(`${DEMO_MATCH_STATE.team2_name} won the toss`),
    ).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(0));
    expect(screen.getByText("Play resumes at 3:30")).toBeInTheDocument();
    // Its 8 seconds were up 6 seconds after loading.
    act(() => vi.advanceTimersByTime(6100));
    expect(screen.queryByText("Play resumes at 3:30")).toBeNull();
  });

  it("replays an event card on load only when it is a few seconds old", () => {
    renderOverlay();
    act(() =>
      watchOf("overlay_state").next({
        version: 2,
        at: NOW - 60_000,
        scene: {},
        cue: { id: "old", kind: "six", at: NOW - 60_000 },
      }),
    );
    expect(screen.queryByRole("heading", { name: "Six" })).toBeNull();

    act(() =>
      watchOf("overlay_state").next({
        version: 3,
        at: NOW,
        scene: {},
        cue: { id: "new", kind: "six", at: NOW },
      }),
    );
    expect(screen.getByRole("heading", { name: "Six" })).toBeInTheDocument();
    // Sound is off unless the control room turns it on.
    expect(playSixExplosion).not.toHaveBeenCalled();
  });

  it("shows automatic cards for new deliveries unless turned off", () => {
    renderOverlay();
    act(() => watchOf("overlay_state").next(null));
    // The server says what each delivery did (live_state.events).
    const ball = (seq: number, runs: number) =>
      act(() =>
        watchOf("live_state").next({
          ...DEMO_MATCH_STATE,
          match_id: REAL_ID,
          last_ball_seq: seq,
          last_ball_runs: runs,
          total_runs: (DEMO_MATCH_STATE.total_runs ?? 0) + seq,
          events: [
            {
              type: "four",
              player_id: DEMO_MATCH_STATE.striker_id,
              name: DEMO_MATCH_STATE.striker_name,
              value: null,
              runs: null,
              balls: null,
              wickets: null,
              number: null,
            },
          ],
          version: seq,
        }),
      );
    ball(113, 4);
    act(() => vi.advanceTimersByTime(0));
    expect(screen.getByRole("heading", { name: "Four" })).toBeInTheDocument();

    act(() =>
      watchOf("overlay_state").next({
        version: 1,
        scene: {},
        auto: { four: { on: false, seconds: 4 } },
      }),
    );
    act(() => vi.advanceTimersByTime(5000));
    ball(114, 4);
    act(() => vi.advanceTimersByTime(0));
    expect(screen.queryByRole("heading", { name: "Four" })).toBeNull();
  });

  it("holds score changes for ?delay= seconds", () => {
    renderOverlay({ delaySeconds: 10 });
    act(() => watchOf("overlay_state").next(null));
    act(() =>
      watchOf("live_state").next({
        ...DEMO_MATCH_STATE,
        match_id: REAL_ID,
        total_runs: 175,
      }),
    );
    expect(screen.queryByText(scoreOf(175))).toBeNull();
    act(() => vi.advanceTimersByTime(10_000));
    expect(screen.getByText(scoreOf(175))).toBeInTheDocument();
  });

  it("says when the link names no match, instead of a blank source", () => {
    renderOverlay({ initial: null, notFound: true });
    act(() => watchOf("overlay_state").next(null));
    expect(
      screen.getByText(/does not match a CricScore match/),
    ).toBeInTheDocument();
  });

  it("opens no listener for the demo match", () => {
    render(<OverlayClient matchId="test" initial={DEMO_MATCH_STATE} />);
    expect(watches).toHaveLength(0);
    expect(screen.getByText(SCORE)).toBeInTheDocument();
  });
});
