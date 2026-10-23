import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  render,
  screen,
  fireEvent,
  act,
  waitFor,
  within,
} from "@testing-library/react";

const watches: Array<{
  table: string;
  id: string;
  next: (data: Record<string, unknown> | null) => void;
  status?: (s: string) => void;
}> = [];

vi.mock("~/lib/firebase/client", () => ({ getFirebaseDb: () => ({}) }));
vi.mock("~/lib/firebase/realtime", () => ({
  watchDoc: (
    _db: unknown,
    table: string,
    id: string,
    handlers: {
      next: (data: Record<string, unknown> | null) => void;
      status?: (s: string) => void;
    },
  ) => {
    watches.push({ table, id, next: handlers.next, status: handlers.status });
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

import { ControlClient } from "./control-client";
import { DEMO_MATCH_STATE, DEMO_MATCH_DETAILS } from "../demo-data";

class MockResizeObserver {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
}

let n = 0;
let REAL_ID = "";
const fetchMock = vi.fn();

const watchOf = (table: string) => watches.find((w) => w.table === table)!;
const lastCommand = () => screen.getByRole("status", { name: "Last command" });
const sentPayload = () =>
  JSON.parse(fetchMock.mock.calls.at(-1)![1].body as string).payload;

function renderDemo() {
  return render(
    <ControlClient
      matchId="test"
      initialState={DEMO_MATCH_STATE}
      initialMatch={DEMO_MATCH_DETAILS}
    />,
  );
}

function renderReal(state = DEMO_MATCH_STATE) {
  return render(
    <ControlClient
      matchId={REAL_ID}
      initialState={{ ...state, match_id: REAL_ID }}
      initialMatch={DEMO_MATCH_DETAILS}
    />,
  );
}

beforeEach(() => {
  n += 1;
  // A new id per test: the live_state listener outlives an unmount briefly.
  REAL_ID = `11111111-2222-4333-8444-${String(n).padStart(12, "0")}`;
  watches.length = 0;
  window.ResizeObserver =
    MockResizeObserver as unknown as typeof ResizeObserver;
  fetchMock.mockReset();
  fetchMock.mockResolvedValue(new Response("{}", { status: 200 }));
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe("ControlClient", () => {
  it("names the match and the score, and links to setting up the stream", () => {
    renderReal();
    expect(
      screen.getByRole("heading", { name: "Control room" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Royal Challengers v Super Kings/),
    ).toBeInTheDocument();
    expect(screen.getByText(/168\/5/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Stream setup" })).toHaveAttribute(
      "href",
      `/matches/${REAL_ID}/stream`,
    );
    expect(screen.getByRole("link", { name: /Open overlay/ })).toHaveAttribute(
      "href",
      `/overlay/${REAL_ID}`,
    );
  });

  it("follows live_state and overlay_state, one listener each, no polling", () => {
    const intervalSpy = vi.spyOn(globalThis, "setInterval");
    renderReal();
    expect(watches.map((w) => w.table).sort()).toEqual([
      "live_state",
      "overlay_state",
    ]);
    expect(
      intervalSpy.mock.calls.some(
        ([, ms]) => typeof ms === "number" && ms < 8000,
      ),
    ).toBe(false);
    act(() =>
      watchOf("live_state").next({
        ...DEMO_MATCH_STATE,
        match_id: REAL_ID,
        total_runs: 201,
        version: 9,
      }),
    );
    expect(screen.getByText(/201\/5/)).toBeInTheDocument();
  });

  it("says a command is on air only once the overlay state names it", async () => {
    renderReal();
    act(() => watchOf("overlay_state").status?.("connected"));
    fireEvent.click(screen.getByRole("button", { name: /^Striker/ }));
    expect(lastCommand()).toHaveTextContent("Sending: Lower third: Striker");

    const payload = sentPayload();
    expect(payload).toMatchObject({
      type: "SHOW_STRAP",
      strap: { type: "batsman", durationMs: 8000 },
    });
    expect(typeof payload.id).toBe("string");
    await waitFor(() =>
      expect(lastCommand()).toHaveTextContent(
        "Sent: Lower third: Striker. Waiting for the overlay to confirm.",
      ),
    );

    act(() =>
      watchOf("overlay_state").next({
        version: 1,
        last_command_id: payload.id,
        at: Date.now(),
        scene: {},
        strap: { ...payload.strap, at: Date.now() },
      }),
    );
    expect(lastCommand()).toHaveTextContent("On air: Lower third: Striker");
    // What is up can be taken off.
    await waitFor(() =>
      expect(screen.getByText("Lower third:")).toBeInTheDocument(),
    );
    fireEvent.click(screen.getByRole("button", { name: "Take off" }));
    expect(sentPayload()).toMatchObject({ type: "HIDE_STRAP" });
  });

  it("says why a command did not go out, and can try again", async () => {
    fetchMock.mockResolvedValue(new Response("{}", { status: 403 }));
    renderReal();
    fireEvent.click(screen.getByRole("button", { name: /^Six/ }));
    await waitFor(() =>
      expect(lastCommand()).toHaveTextContent(
        "Not sent: Event card: Six. Only this match's scorers and organisers can change its overlay.",
      ),
    );
    fetchMock.mockResolvedValue(new Response("{}", { status: 200 }));
    fireEvent.click(
      within(lastCommand()).getByRole("button", { name: "Try again" }),
    );
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(sentPayload()).toMatchObject({
      type: "TRIGGER_STING",
      stingType: "six",
    });
  });

  it("offers each card only when it has something true to show", () => {
    renderDemo();
    const result = screen.getByRole("button", { name: /^Result/ });
    expect(result).toBeDisabled();
    expect(result).toHaveTextContent("After the match");
    expect(screen.getByRole("button", { name: /^Scorecard/ })).toBeEnabled();
  });

  it("runs the demo match on this page, preview included", () => {
    renderDemo();
    fireEvent.click(screen.getByRole("button", { name: /^Scorecard/ }));
    expect(lastCommand()).toHaveTextContent("On air: Card: Scorecard");
    expect(
      screen.getByRole("button", { name: /^Scorecard/, pressed: true }),
    ).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Add a four" }));
    expect(screen.getByText(/172\/5/)).toBeInTheDocument();
  });

  it("picks themes from the shared list", () => {
    renderDemo();
    const look = screen
      .getByRole("heading", { name: "Look" })
      .closest("section")!;
    for (const label of ["Standard", "Light", "Custom"]) {
      expect(
        within(look).getByRole("button", { name: new RegExp(`^${label}`) }),
      ).toBeInTheDocument();
    }
    fireEvent.click(within(look).getByRole("button", { name: /^Custom/ }));
    expect(screen.getByLabelText("Main colour")).toBeInTheDocument();
  });

  it("has keyboard shortcuts that leave the browser's own alone", () => {
    renderReal();
    fireEvent.keyDown(window, { key: "w" });
    expect(sentPayload()).toMatchObject({ stingType: "wicket" });
    fireEvent.keyDown(window, { key: "w", metaKey: true });
    fireEvent.keyDown(window, { key: " " });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    fireEvent.keyDown(window, { key: "Escape" });
    expect(sentPayload()).toMatchObject({ type: "PANIC_CLEAR" });
  });

  it("stops live updates for a finished match until the producer resumes them", () => {
    renderReal({ ...DEMO_MATCH_STATE, status: "completed" });
    expect(watches.map((w) => w.table)).toEqual(["overlay_state"]);
    fireEvent.click(
      screen.getByRole("button", { name: /Resume live updates/i }),
    );
    expect(watches.map((w) => w.table)).toContain("live_state");
  });
});
