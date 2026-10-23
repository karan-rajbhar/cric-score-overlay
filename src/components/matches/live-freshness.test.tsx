import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const live = vi.hoisted(() => ({
  current: {
    status: "connected",
    loaded: true,
    updatedAt: null as string | null,
  },
}));
vi.mock("~/lib/hooks/useLiveState", () => ({
  useLiveState: () => live.current,
}));

import { LiveFreshness, updatedAgo } from "./live-freshness";

const NOW = Date.parse("2026-10-22T10:00:00.000Z");

describe("LiveFreshness", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });
  afterEach(() => vi.useRealTimers());

  it("words the time since the last change", () => {
    const iso = (ms: number) => new Date(NOW - ms).toISOString();
    expect(updatedAgo(iso(20_000), NOW)).toBe("just now");
    expect(updatedAgo(iso(60_000), NOW)).toBe("1 min ago");
    expect(updatedAgo(iso(12 * 60_000), NOW)).toBe("12 min ago");
    expect(updatedAgo(iso(2 * 3_600_000), NOW)).toMatch(/^at \d/);
  });

  it("counts up while nothing changes, so a pause does not look frozen", () => {
    live.current = {
      status: "connected",
      loaded: true,
      updatedAt: new Date(NOW - 30_000).toISOString(),
    };
    render(<LiveFreshness matchId="m1" />);
    expect(screen.getByRole("status")).toHaveTextContent("Updated just now");
    act(() => vi.advanceTimersByTime(3 * 60_000));
    expect(screen.getByRole("status")).toHaveTextContent("Updated 3 min ago");
  });

  it("says when the live connection is down", () => {
    live.current = { status: "error", loaded: true, updatedAt: null };
    render(<LiveFreshness matchId="m1" />);
    const status = screen.getByRole("status");
    expect(status).toHaveTextContent("Reconnecting…");
    expect(status).toHaveAttribute("aria-live", "polite");
  });
});
