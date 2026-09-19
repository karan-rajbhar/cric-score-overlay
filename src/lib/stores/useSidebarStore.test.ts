import { describe, it, expect, beforeEach } from "vitest";
import { useSidebarStore } from "./useSidebarStore";

describe("useSidebarStore", () => {
  beforeEach(() => {
    useSidebarStore.setState({ collapsed: false, mobileOpen: false });
  });

  it("initializes with expanded sidebar and closed mobile menu", () => {
    const state = useSidebarStore.getState();
    expect(state.collapsed).toBe(false);
    expect(state.mobileOpen).toBe(false);
  });

  it("toggles collapsed state", () => {
    const { toggleCollapsed } = useSidebarStore.getState();
    toggleCollapsed();
    expect(useSidebarStore.getState().collapsed).toBe(true);

    toggleCollapsed();
    expect(useSidebarStore.getState().collapsed).toBe(false);
  });

  it("toggles mobile menu state", () => {
    const { toggleMobile, setMobileOpen } = useSidebarStore.getState();
    toggleMobile();
    expect(useSidebarStore.getState().mobileOpen).toBe(true);

    setMobileOpen(false);
    expect(useSidebarStore.getState().mobileOpen).toBe(false);
  });
});
