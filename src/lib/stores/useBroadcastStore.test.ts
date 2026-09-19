import { describe, it, expect, beforeEach } from "vitest";
import { useBroadcastStore } from "./useBroadcastStore";

describe("useBroadcastStore", () => {
  beforeEach(() => {
    useBroadcastStore.getState().resetBroadcastStore();
  });

  it("has sensible default broadcast state", () => {
    const state = useBroadcastStore.getState();
    expect(state.selectedBroadcastView).toBe("1");
    expect(state.selectedCategory).toBe("all");
    expect(state.selectedTheme).toBe("starsports");
    expect(state.audioEnabled).toBe(true);
    expect(state.monitorScale).toBe(0.5);
    expect(state.monitorBg).toBe("stadium");
    expect(state.activeTab).toBe("inplay");
    expect(state.activeSting).toBeNull();
    expect(state.activeStrap).toBeNull();
  });

  it("updates broadcast view and logs action", () => {
    const { setBroadcastView } = useBroadcastStore.getState();
    setBroadcastView("13", "Lower Third Summary");

    const state = useBroadcastStore.getState();
    expect(state.selectedBroadcastView).toBe("13");
    expect(state.lastAction).toContain("Lower Third Summary");
  });

  it("updates broadcast theme and settings", () => {
    const { setSelectedTheme, setAudioEnabled, setMarginOffsetPx } =
      useBroadcastStore.getState();
    setSelectedTheme("skysports");
    setAudioEnabled(false);
    setMarginOffsetPx(24);

    const state = useBroadcastStore.getState();
    expect(state.selectedTheme).toBe("skysports");
    expect(state.audioEnabled).toBe(false);
    expect(state.marginOffsetPx).toBe(24);
  });

  it("triggers and clears lower third straps", () => {
    const { triggerStrap, clearStrap } = useBroadcastStore.getState();
    triggerStrap({
      strapType: "milestone",
      title: "50 Runs",
      subtitle: "K. Williamson off 34 balls",
      durationSecs: 5,
    });

    let state = useBroadcastStore.getState();
    expect(state.activeStrap).not.toBeNull();
    expect(state.activeStrap?.title).toBe("50 Runs");

    clearStrap();
    state = useBroadcastStore.getState();
    expect(state.activeStrap).toBeNull();
  });

  it("resets store back to initial defaults", () => {
    const { setSelectedTheme, resetBroadcastStore } =
      useBroadcastStore.getState();
    setSelectedTheme("foxcricket");
    resetBroadcastStore();

    expect(useBroadcastStore.getState().selectedTheme).toBe("starsports");
  });
});
