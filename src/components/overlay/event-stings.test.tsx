import { act, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { EventStings } from "./event-stings";
import {
  LEGACY_OVERLAY_THEME_IDS,
  OVERLAY_THEMES,
} from "./overlay-themes";
import type { ActiveEventSting } from "./types";

const sting = (over: Partial<ActiveEventSting> = {}): ActiveEventSting => ({
  id: "s1",
  type: "four",
  title: "Four",
  subtitle: "Arjun Mehta",
  detail: "34 (21)",
  durationMs: 4000,
  ...over,
});

describe("EventStings", () => {
  it("renders nothing without a sting", () => {
    const { container } = render(<EventStings sting={null} onDismiss={vi.fn()} />);
    expect(container.firstChild).toBeNull();
  });

  it("shows the title, the player and the figures", () => {
    render(<EventStings sting={sting()} onDismiss={vi.fn()} />);
    expect(screen.getByRole("status")).toHaveAttribute("data-sting-type", "four");
    expect(screen.getByText("Four")).toBeInTheDocument();
    expect(screen.getByText("Arjun Mehta")).toBeInTheDocument();
    expect(screen.getByText("34 (21)")).toBeInTheDocument();
  });

  it.each([
    ["four", "bg-four"],
    ["six", "bg-six"],
    ["wicket", "bg-wicket"],
    ["free_hit", "bg-extra"],
  ] as const)("marks a %s with its delivery colour", (type, cls) => {
    const { container } = render(
      <EventStings sting={sting({ type })} onDismiss={vi.fn()} />,
    );
    expect(container.querySelector(`.${cls}`)).not.toBeNull();
  });

  it("explains a free hit", () => {
    render(
      <EventStings
        sting={sting({ type: "free_hit", title: "Free hit", detail: undefined })}
        onDismiss={vi.fn()}
      />,
    );
    expect(screen.getByText("No dismissals except run out")).toBeInTheDocument();
  });

  it.each([
    ...OVERLAY_THEMES.map((t) => t.id),
    ...LEGACY_OVERLAY_THEME_IDS,
  ])("renders the same card in the %s theme", (theme) => {
    render(<EventStings sting={sting()} onDismiss={vi.fn()} theme={theme} />);
    expect(screen.getByText("Four")).toBeInTheDocument();
  });

  it("dismisses itself after its duration", () => {
    vi.useFakeTimers();
    const onDismiss = vi.fn();
    render(<EventStings sting={sting({ durationMs: 3000 })} onDismiss={onDismiss} />);
    act(() => vi.advanceTimersByTime(2999));
    expect(onDismiss).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(1));
    expect(onDismiss).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });
});
