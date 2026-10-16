import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { EventStings } from "./event-stings";
import type { ActiveEventSting } from "./types";

describe("EventStings Component", () => {
  it("renders null when sting is null", () => {
    const { container } = render(
      <EventStings sting={null} onDismiss={vi.fn()} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders FOUR! sting correctly", () => {
    const sting: ActiveEventSting = {
      id: "test-4",
      type: "four",
      title: "FOUR!",
      subtitle: "Virat Kohli cracks a boundary",
      detail: "78* (46b)",
      durationMs: 4000,
    };

    render(<EventStings sting={sting} onDismiss={vi.fn()} />);
    expect(screen.getByText("FOUR!")).toBeInTheDocument();
    expect(
      screen.getByText("Virat Kohli cracks a boundary"),
    ).toBeInTheDocument();
    expect(screen.getByText("78* (46b)")).toBeInTheDocument();
  });

  it("renders MAXIMUM! sting correctly", () => {
    const sting: ActiveEventSting = {
      id: "test-6",
      type: "six",
      title: "MAXIMUM!",
      subtitle: "Massive six over long-on",
      detail: "84* (47b)",
      durationMs: 4000,
    };

    render(<EventStings sting={sting} onDismiss={vi.fn()} />);
    expect(screen.getByText("MAXIMUM!")).toBeInTheDocument();
    expect(screen.getByText("Massive six over long-on")).toBeInTheDocument();
  });

  it("renders WICKET! sting with dismissal details", () => {
    const sting: ActiveEventSting = {
      id: "test-w",
      type: "wicket",
      title: "WICKET!",
      subtitle: "Faf du Plessis OUT",
      detail: "c Dhoni b Jadeja",
      durationMs: 4000,
    };

    render(<EventStings sting={sting} onDismiss={vi.fn()} />);
    expect(screen.getByText("WICKET!")).toBeInTheDocument();
    expect(screen.getByText("Faf du Plessis OUT")).toBeInTheDocument();
    expect(screen.getByText("c Dhoni b Jadeja")).toBeInTheDocument();
  });

  it("renders MILESTONE! sting correctly", () => {
    const sting: ActiveEventSting = {
      id: "test-m",
      type: "milestone",
      title: "FANTASTIC FIFTY!",
      subtitle: "Virat Kohli · 50 Runs",
      detail: "Off 32 deliveries",
      durationMs: 4000,
    };

    render(<EventStings sting={sting} onDismiss={vi.fn()} />);
    expect(screen.getByText("FANTASTIC FIFTY!")).toBeInTheDocument();
    expect(screen.getByText("Virat Kohli · 50 Runs")).toBeInTheDocument();
    expect(screen.getByText("Off 32 deliveries")).toBeInTheDocument();
  });

  it("renders FREE HIT! sting correctly", () => {
    const sting: ActiveEventSting = {
      id: "test-fh",
      type: "free_hit",
      title: "FREE HIT!",
      durationMs: 4000,
    };

    render(<EventStings sting={sting} onDismiss={vi.fn()} />);
    expect(screen.getByText("FREE HIT!")).toBeInTheDocument();
    expect(
      screen.getByText(/No Dismissals Except Run Out/i),
    ).toBeInTheDocument();
  });

  it.each([
    "starsports",
    "sonysports",
    "foxcricket",
    "skysports",
    "thehundred",
    "apex",
    "volt",
    "thunder",
    "dharma",
    "nakshatra",
    "agni",
    "custom",
  ] as const)("renders the same event card for the %s theme", (theme) => {
    const sting: ActiveEventSting = {
      id: `test-${theme}-4`,
      type: "four",
      title: "Four",
      subtitle: "David Warner cuts for four",
      detail: "78* (46b)",
      durationMs: 4000,
    };

    render(<EventStings sting={sting} theme={theme} onDismiss={vi.fn()} />);
    const card = screen.getByRole("status");
    expect(card).toHaveAttribute("data-theme", theme);
    expect(screen.getByText("Four")).toBeInTheDocument();
    expect(screen.getByText("David Warner cuts for four")).toBeInTheDocument();
    expect(screen.getByText("78* (46b)")).toBeInTheDocument();
  });

  it("dismisses after the sting duration", () => {
    vi.useFakeTimers();
    const onDismiss = vi.fn();
    const sting: ActiveEventSting = {
      id: "test-timer",
      type: "wicket",
      title: "Wicket",
      durationMs: 1000,
    };

    render(<EventStings sting={sting} onDismiss={onDismiss} />);
    vi.advanceTimersByTime(999);
    expect(onDismiss).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(onDismiss).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });
});
