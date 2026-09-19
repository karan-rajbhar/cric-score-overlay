import { describe, it, expect, beforeEach } from "vitest";
import { usePreferencesStore } from "./usePreferencesStore";

describe("usePreferencesStore", () => {
  beforeEach(() => {
    usePreferencesStore.getState().resetPreferences();
  });

  it("provides sensible default preferences", () => {
    const state = usePreferencesStore.getState();
    expect(state.soundEffectsEnabled).toBe(true);
    expect(state.soundVolume).toBe(0.8);
    expect(state.hapticFeedback).toBe(true);
    expect(state.defaultMatchFormat).toBe("T20");
    expect(state.defaultOvers).toBe(20);
  });

  it("toggles sound and updates volume", () => {
    const { toggleSound, setVolume } = usePreferencesStore.getState();
    toggleSound();
    expect(usePreferencesStore.getState().soundEffectsEnabled).toBe(false);

    setVolume(0.5);
    expect(usePreferencesStore.getState().soundVolume).toBe(0.5);

    // Clamps volume between 0 and 1
    setVolume(1.5);
    expect(usePreferencesStore.getState().soundVolume).toBe(1.0);
    setVolume(-0.2);
    expect(usePreferencesStore.getState().soundVolume).toBe(0.0);
  });

  it("updates default match format and overs", () => {
    const { setDefaultFormat } = usePreferencesStore.getState();
    setDefaultFormat("ODI", 50);

    const state = usePreferencesStore.getState();
    expect(state.defaultMatchFormat).toBe("ODI");
    expect(state.defaultOvers).toBe(50);
  });
});
