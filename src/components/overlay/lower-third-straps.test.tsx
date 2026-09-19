import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { LowerThirdStraps } from "./lower-third-straps";
import { DEMO_MATCH_STATE } from "~/app/overlay/[matchId]/demo-data";
import type { ActiveLowerThirdStrap } from "./types";

describe("LowerThirdStraps Component", () => {
  it("renders null when strap is null or none", () => {
    const { container } = render(
      <LowerThirdStraps
        strap={null}
        state={DEMO_MATCH_STATE}
        layout="bottom"
        onDismiss={vi.fn()}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders Batsman Inning strap with strike rate", () => {
    const strap: ActiveLowerThirdStrap = {
      id: "s1",
      type: "batsman",
      title: "",
      durationMs: 5000,
    };

    render(
      <LowerThirdStraps
        strap={strap}
        state={DEMO_MATCH_STATE}
        layout="bottom"
        onDismiss={vi.fn()}
      />,
    );

    expect(screen.getByText(/BATSMAN INNINGS/i)).toBeInTheDocument();
    expect(screen.getByText(/Virat Kohli/i)).toBeInTheDocument();
    expect(screen.getByText(/78 runs off 46 balls/i)).toBeInTheDocument();
    expect(screen.getByText(/Strike Rate/i)).toBeInTheDocument();
  });

  it("renders Bowler Spell strap with economy", () => {
    const strap: ActiveLowerThirdStrap = {
      id: "s2",
      type: "bowler",
      title: "",
      durationMs: 5000,
    };

    render(
      <LowerThirdStraps
        strap={strap}
        state={DEMO_MATCH_STATE}
        layout="bottom"
        onDismiss={vi.fn()}
      />,
    );

    expect(screen.getByText(/CURRENT SPELL/i)).toBeInTheDocument();
    expect(screen.getByText(/Ravindra Jadeja/i)).toBeInTheDocument();
    expect(screen.getByText(/2 wickets for 28 runs/i)).toBeInTheDocument();
    expect(screen.getByText(/Economy/i)).toBeInTheDocument();
  });

  it("renders Target Equation strap", () => {
    const strap: ActiveLowerThirdStrap = {
      id: "s3",
      type: "target",
      title: "",
      durationMs: 5000,
    };

    render(
      <LowerThirdStraps
        strap={strap}
        state={DEMO_MATCH_STATE}
        layout="bottom"
        onDismiss={vi.fn()}
      />,
    );

    expect(screen.getByText(/CHASE EQUATION/i)).toBeInTheDocument();
    expect(
      screen.getByText(/Need 17 runs from 8 deliveries/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/Required RR/i)).toBeInTheDocument();
  });

  it("renders custom production alert strap", () => {
    const strap: ActiveLowerThirdStrap = {
      id: "s4",
      type: "custom",
      title: "BROADCAST ALERT",
      customText: "Physio on ground tending to batsman",
      badge: "LIVE NOTICE",
      durationMs: 5000,
    };

    render(
      <LowerThirdStraps
        strap={strap}
        state={DEMO_MATCH_STATE}
        layout="bottom"
        onDismiss={vi.fn()}
      />,
    );

    expect(screen.getByText("LIVE NOTICE")).toBeInTheDocument();
    expect(screen.getByText("BROADCAST ALERT")).toBeInTheDocument();
    expect(
      screen.getByText("Physio on ground tending to batsman"),
    ).toBeInTheDocument();
  });

  it("handles configurable auto-dismiss timers and infinite duration", () => {
    vi.useFakeTimers();
    const onDismiss = vi.fn();

    // 5000ms duration
    const strap5s: ActiveLowerThirdStrap = {
      id: "s-5s",
      type: "batsman",
      title: "",
      durationMs: 5000,
    };

    const { unmount } = render(
      <LowerThirdStraps
        strap={strap5s}
        state={DEMO_MATCH_STATE}
        layout="bottom"
        onDismiss={onDismiss}
      />,
    );

    vi.advanceTimersByTime(4999);
    expect(onDismiss).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(onDismiss).toHaveBeenCalledTimes(1);

    unmount();
    onDismiss.mockClear();

    // Infinite duration (-1)
    const strapInfinite: ActiveLowerThirdStrap = {
      id: "s-inf",
      type: "batsman",
      title: "",
      durationMs: -1,
    };

    render(
      <LowerThirdStraps
        strap={strapInfinite}
        state={DEMO_MATCH_STATE}
        layout="bottom"
        onDismiss={onDismiss}
      />,
    );

    vi.advanceTimersByTime(60000);
    expect(onDismiss).not.toHaveBeenCalled();

    vi.useRealTimers();
  });
});
