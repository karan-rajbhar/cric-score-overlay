import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { LiveLastChange } from "~/lib/hooks/useLiveState";
import {
  OTHER_SCORER_WINDOW_MS,
  OtherScorerNotice,
  otherScorerChange,
} from "./OtherScorerNotice";

let lastChange: LiveLastChange | null = null;
vi.mock("~/lib/hooks/useLiveState", () => ({
  useLiveState: () => ({ lastChange }),
}));

const NOW = Date.parse("2026-10-17T12:00:00.000Z");
const ago = (ms: number) => new Date(NOW - ms).toISOString();

describe("otherScorerChange", () => {
  const change = { uid: "u2", name: "Ben Ito", at: ago(30_000) };

  it("is the change when another scorer made it within the window", () => {
    expect(otherScorerChange(change, "u1", NOW)).toBe(change);
  });

  it("is null for the viewer's own change, a stale one, or no user", () => {
    expect(otherScorerChange(change, "u2", NOW)).toBeNull();
    expect(
      otherScorerChange(
        { ...change, at: ago(OTHER_SCORER_WINDOW_MS) },
        "u1",
        NOW,
      ),
    ).toBeNull();
    expect(otherScorerChange(change, null, NOW)).toBeNull();
    expect(otherScorerChange(null, "u1", NOW)).toBeNull();
  });
});

describe("OtherScorerNotice", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });
  afterEach(() => {
    vi.useRealTimers();
    lastChange = null;
  });

  it("shows a calm, dismissible chip while another scorer is active", () => {
    lastChange = { uid: "u2", name: "Ben Ito", at: ago(10_000) };
    render(<OtherScorerNotice matchId="m1" userId="u1" />);
    const chip = screen.getByRole("status", {
      name: "Ben Ito is also scoring this match. Dismiss",
    });
    expect(chip).toHaveTextContent("Ben Ito is also scoring");

    fireEvent.click(chip);
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("stays hidden for the viewer's own changes and stale ones", () => {
    lastChange = { uid: "u1", name: "Me", at: ago(1_000) };
    const { rerender } = render(
      <OtherScorerNotice matchId="m1" userId="u1" />,
    );
    expect(screen.queryByRole("status")).toBeNull();

    lastChange = { uid: "u2", name: null, at: ago(5 * 60_000) };
    rerender(<OtherScorerNotice matchId="m1" userId="u1" />);
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("goes away once the other scorer has been quiet for the window", () => {
    lastChange = { uid: "u2", name: null, at: ago(0) };
    render(<OtherScorerNotice matchId="m1" userId="u1" />);
    expect(screen.getByRole("status")).toHaveTextContent(
      "Another scorer is also scoring",
    );
    act(() => {
      vi.advanceTimersByTime(OTHER_SCORER_WINDOW_MS + 1);
    });
    expect(screen.queryByRole("status")).toBeNull();
  });
});
