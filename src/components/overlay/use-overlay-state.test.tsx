import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";

vi.mock("~/lib/firebase/client", () => ({ getFirebaseDb: () => ({}) }));
vi.mock("~/lib/firebase/realtime", () => ({ watchDoc: () => () => {} }));
vi.mock("./sound-effects", () => ({
  playFourFanfare: vi.fn(),
  playSixExplosion: vi.fn(),
  playWicketTone: vi.fn(),
  playMilestoneFanfare: vi.fn(),
  playFreeHitAlert: vi.fn(),
}));

import { DEMO_MATCH_STATE } from "~/app/overlay/[matchId]/demo-data";
import {
  applyOverlayPatch,
  overlayPatchOf,
  type OverlayCommandInput,
  type OverlayStateDoc,
} from "~/lib/overlay-state";
import type { LiveEvent } from "~/lib/firebase/types";
import type { LiveMatchState } from "./types";
import { useOverlayLayers } from "./use-overlay-state";

const NOW = 1_800_000_000_000;

const ev = (type: LiveEvent["type"], extra: Partial<LiveEvent> = {}) =>
  ({
    type,
    player_id: null,
    name: null,
    value: null,
    runs: null,
    balls: null,
    wickets: null,
    number: null,
    ...extra,
  }) as LiveEvent;

const row = (over: Partial<LiveMatchState>) =>
  ({ ...DEMO_MATCH_STATE, events: [], ...over }) as LiveMatchState;

/** The stored state after a command, as the server writes it. */
const after = (doc: OverlayStateDoc | null, cmd: OverlayCommandInput) =>
  applyOverlayPatch(doc, overlayPatchOf(cmd, Date.now())!, null, Date.now());

function layersFor(state: LiveMatchState) {
  return renderHook(
    ({ state, doc }: { state: LiveMatchState; doc: OverlayStateDoc | null }) =>
      useOverlayLayers({ doc, state, serverNow: NOW, muted: true }),
    { initialProps: { state, doc: null as OverlayStateDoc | null } },
  );
}

const tick = (ms = 0) => act(() => vi.advanceTimersByTime(ms));

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] });
  vi.setSystemTime(NOW);
});
afterEach(() => {
  vi.useRealTimers();
});

describe("automatic graphics", () => {
  it("take the toss card off after its seconds when the openers are named meanwhile", () => {
    const s0 = row({ toss_winner_team_id: null });
    const { result, rerender } = layersFor(s0);
    const s1 = row({ toss_winner_team_id: "team-1", toss_decision: "bat" });
    rerender({ state: s1, doc: null });
    tick();
    expect(result.current.card).toBe("toss");

    tick(5000);
    const s2 = row({
      ...s1,
      bowler_id: "someone-new",
      events: [ev("new_bowler", { name: "A Bowler", balls: 0 })],
    });
    rerender({ state: s2, doc: null });
    tick();
    expect(result.current.strap?.type).toBe("new_bowler");

    // The toss card's 15 s and the strap's 6 s are long up.
    tick(15_000);
    expect(result.current.card).toBe("none");
    expect(result.current.strap).toBeNull();
  });

  it("take a strap off after its seconds when a four lands meanwhile, and let the producer's through", () => {
    const s0 = row({});
    const { result, rerender } = layersFor(s0);
    const s1 = row({
      striker_id: "new-batter",
      events: [ev("new_batter", { name: "N Batter" })],
    });
    rerender({ state: s1, doc: null });
    tick();
    expect(result.current.strap?.type).toBe("new_batter");

    tick(4000);
    const s2 = row({
      ...s1,
      total_runs: (s1.total_runs ?? 0) + 4,
      last_ball_seq: (s1.last_ball_seq ?? 0) + 1,
      events: [ev("four", { name: "N Batter" })],
    });
    rerender({ state: s2, doc: null });
    tick();
    expect(result.current.sting?.type).toBe("four");

    tick(4000);
    expect(result.current.strap).toBeNull();

    const doc = after(null, {
      type: "SHOW_STRAP",
      strap: {
        id: "p1",
        type: "custom",
        title: "Play resumes at 3:30",
        durationMs: 8000,
      },
    });
    rerender({ state: s2, doc });
    tick();
    expect(result.current.strap?.title).toBe("Play resumes at 3:30");
  });
});

describe("the automatic innings-break view", () => {
  it("leaves the innings-break view after its seconds when the chase's openers are named", () => {
    const s0 = row({});
    const { result, rerender } = layersFor(s0);
    const s1 = row({ last_ball_seq: 99, events: [ev("innings_end")] });
    rerender({ state: s1, doc: null });
    tick();
    expect(result.current.view).toBe("14");

    tick(10_000);
    rerender({
      state: row({
        ...s1,
        striker_id: "opener",
        events: [ev("new_batter", { name: "Opener" })],
      }),
      doc: null,
    });
    tick(30_000);
    expect(result.current.view).toBeNull();
  });

  it("and the other automatic graphics go off with Clear, Back to score bug and Take off", () => {
    const s0 = row({ toss_winner_team_id: null });
    const { result, rerender } = layersFor(s0);
    const s1 = row({
      toss_winner_team_id: "team-1",
      last_ball_seq: 99,
      events: [ev("innings_end")],
    });
    rerender({ state: s1, doc: null });
    tick();
    expect(result.current.view).toBe("14");
    expect(result.current.card).toBe("toss");

    // "Back to score bug" takes the automatic view off, not the card.
    let doc = after(null, { type: "SET_BROADCAST_VIEW", broadcastView: null });
    rerender({ state: s1, doc });
    tick();
    expect(result.current.view).toBeNull();
    expect(result.current.card).toBe("toss");

    // "Take off" on the card.
    tick(1000);
    doc = after(doc, { type: "HIDE_CARD" });
    rerender({ state: s1, doc });
    tick();
    expect(result.current.card).toBe("none");

    // Clear takes off a strap and the event card on air, and what was queued.
    const s2 = row({
      ...s1,
      total_wickets: (s1.total_wickets ?? 0) + 1,
      last_ball_seq: 100,
      events: [
        ev("wicket", { name: "Out" }),
        ev("over_end", { number: 4, runs: 3 }),
      ],
    });
    rerender({ state: s2, doc });
    tick();
    expect(result.current.sting?.type).toBe("wicket");
    tick(1000);
    doc = after(doc, { type: "PANIC_CLEAR" });
    rerender({ state: s2, doc });
    tick();
    expect(result.current.sting).toBeNull();
    tick(10_000);
    expect(result.current.strap).toBeNull();
  });
});
