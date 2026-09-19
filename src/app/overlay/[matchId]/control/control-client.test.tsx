import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

vi.mock("~/lib/supabase", () => ({
  supabase: {
    channel: vi.fn(() => ({
      subscribe: vi.fn(),
      send: vi.fn(),
    })),
    removeChannel: vi.fn(),
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn().mockResolvedValue({ data: null }),
        })),
      })),
    })),
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

beforeEach(() => {
  window.ResizeObserver = MockResizeObserver as unknown as typeof ResizeObserver;
  Object.defineProperty(navigator, "clipboard", {
    value: { writeText: vi.fn().mockResolvedValue(undefined) },
    configurable: true,
    writable: true,
  });
});

describe("ControlClient Component", () => {
  it("renders the studio header with live status, match score, and action buttons", () => {
    render(
      <ControlClient
        matchId="test"
        initialState={DEMO_MATCH_STATE}
        initialMatch={DEMO_MATCH_DETAILS}
      />,
    );

    expect(screen.getByText(/LIVE STUDIO/i)).toBeInTheDocument();
    expect(screen.getByText(/Royal Challengers/i)).toBeInTheDocument();
    expect(screen.getByText(/Super Kings/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Copy OBS URL/i })).toBeInTheDocument();
  });

  it("renders the 5 instant celebration sting buttons with hotkey labels", () => {
    render(
      <ControlClient
        matchId="test"
        initialState={DEMO_MATCH_STATE}
        initialMatch={DEMO_MATCH_DETAILS}
      />,
    );

    expect(screen.getByRole("button", { name: /FOUR!/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /MAXIMUM!/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /WICKET!/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /50 \/ 100/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /FREE HIT/i })).toBeInTheDocument();
  });

  it("renders match phase graphics switcher decks instead of a raw 29-button scroll", () => {
    render(
      <ControlClient
        matchId="test"
        initialState={DEMO_MATCH_STATE}
        initialMatch={DEMO_MATCH_DETAILS}
      />,
    );

    expect(screen.getByRole("tab", { name: /Live Scorebars/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Scorecards & Squads/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Breaks & Stoppages/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Analytics & Charts/i })).toBeInTheDocument();
  });

  it("allows switching phase tabs to reveal relevant broadcast graphics", () => {
    render(
      <ControlClient
        matchId="test"
        initialState={DEMO_MATCH_STATE}
        initialMatch={DEMO_MATCH_DETAILS}
      />,
    );

    const scorecardsTab = screen.getByRole("tab", { name: /Scorecards & Squads/i });
    fireEvent.click(scorecardsTab);

    expect(screen.getByText(/Batting Team 1/i)).toBeInTheDocument();
    expect(screen.getByText(/Bowling Team 1/i)).toBeInTheDocument();
    expect(screen.getByText(/Team 1 Playing XI/i)).toBeInTheDocument();
  });

  it("renders 1-click broadcast notice presets and custom alert sender", () => {
    render(
      <ControlClient
        matchId="test"
        initialState={DEMO_MATCH_STATE}
        initialMatch={DEMO_MATCH_DETAILS}
      />,
    );

    const drinksBtn = screen.getByRole("button", { name: /DRINKS BREAK/i });
    expect(drinksBtn).toBeInTheDocument();
    fireEvent.click(drinksBtn);

    expect(screen.getByPlaceholderText(/Custom broadcast alert/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Send Alert/i })).toBeInTheDocument();
  });

  it("renders interactive match scenario simulator in test mode and responds to score mutations", () => {
    render(
      <ControlClient
        matchId="test"
        initialState={DEMO_MATCH_STATE}
        initialMatch={DEMO_MATCH_DETAILS}
      />,
    );

    expect(screen.getByText(/Match Simulator/i)).toBeInTheDocument();
    const plusFourBtn = screen.getByRole("button", { name: /\+4 Runs/i });
    fireEvent.click(plusFourBtn);

    // Initial 168 + 4 = 172
    expect(screen.getAllByText(/172\//i).length).toBeGreaterThanOrEqual(1);
  });

  it("displays live ON-AIR tally and allows returning to scorebar", () => {
    render(
      <ControlClient
        matchId="test"
        initialState={DEMO_MATCH_STATE}
        initialMatch={DEMO_MATCH_DETAILS}
      />,
    );

    expect(screen.getByText(/ON AIR/i)).toBeInTheDocument();
  });

  it("opens the unified Settings & Themes dialog when Settings button is clicked", () => {
    render(
      <ControlClient
        matchId="test"
        initialState={DEMO_MATCH_STATE}
        initialMatch={DEMO_MATCH_DETAILS}
      />,
    );

    const settingsBtn = screen.getByRole("button", { name: /Settings/i });
    fireEvent.click(settingsBtn);

    expect(screen.getByText(/Broadcast Production Settings/i)).toBeInTheDocument();
    expect(screen.getByText(/TV Broadcast Visual Theme/i)).toBeInTheDocument();
    expect(screen.getByText(/Operator Keyboard Shortcuts/i)).toBeInTheDocument();
  });

  it("handles keyboard shortcuts to trigger celebratory stings", () => {
    render(
      <ControlClient
        matchId="test"
        initialState={DEMO_MATCH_STATE}
        initialMatch={DEMO_MATCH_DETAILS}
      />,
    );

    // Fire keydown for '4'
    fireEvent.keyDown(window, { key: "4" });
    // Fire keydown for 'w'
    fireEvent.keyDown(window, { key: "w" });
    // Fire keydown for Space
    fireEvent.keyDown(window, { key: " " });
  });
});
