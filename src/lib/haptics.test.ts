import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  triggerHaptic,
  hapticBall,
  hapticBoundary,
  hapticWicket,
  hapticUndo,
} from "./haptics";
import { usePreferencesStore } from "./stores/usePreferencesStore";

describe("haptics utility", () => {
  const vibrateMock = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    usePreferencesStore.getState().resetPreferences();
    Object.defineProperty(navigator, "vibrate", {
      value: vibrateMock,
      writable: true,
      configurable: true,
    });
  });

  it("calls navigator.vibrate with default pulse when enabled", () => {
    triggerHaptic();
    expect(vibrateMock).toHaveBeenCalledWith(12);
  });

  it("does not call navigator.vibrate when hapticFeedback is disabled in preferences", () => {
    usePreferencesStore.getState().setHapticEnabled(false);
    triggerHaptic();
    expect(vibrateMock).not.toHaveBeenCalled();
  });

  it("calls specific haptic patterns for match events", () => {
    hapticBall();
    expect(vibrateMock).toHaveBeenCalledWith(12);

    vibrateMock.mockClear();
    hapticBoundary();
    expect(vibrateMock).toHaveBeenCalledWith([18, 40, 18]);

    vibrateMock.mockClear();
    hapticWicket();
    expect(vibrateMock).toHaveBeenCalledWith([25, 50, 25, 50, 40]);

    vibrateMock.mockClear();
    hapticUndo();
    expect(vibrateMock).toHaveBeenCalledWith(10);
  });
});
