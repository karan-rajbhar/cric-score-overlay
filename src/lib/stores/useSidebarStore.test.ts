import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { sidebarModeOf, useSidebarStore } from "./useSidebarStore";

/** A window `min-width: 1024px` matches on, or not. */
function screenWidth(wide: boolean) {
  window.matchMedia = ((query: string) => ({
    matches: wide && query === "(min-width: 1024px)",
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  })) as unknown as typeof window.matchMedia;
}

describe("useSidebarStore", () => {
  const original = window.matchMedia;
  beforeEach(() => {
    useSidebarStore.setState({ collapsed: false, narrowOpen: false });
  });
  afterEach(() => {
    window.matchMedia = original;
  });

  it("initializes with expanded sidebar", () => {
    expect(useSidebarStore.getState().collapsed).toBe(false);
  });

  it("collapses and expands from lg, and remembers it", () => {
    screenWidth(true);
    const { toggleCollapsed } = useSidebarStore.getState();
    toggleCollapsed();
    expect(useSidebarStore.getState().collapsed).toBe(true);
    expect(sidebarModeOf(useSidebarStore.getState())).toBe("collapsed");

    toggleCollapsed();
    expect(useSidebarStore.getState().collapsed).toBe(false);
  });

  it("opens below lg for this visit only, over the rail (N5)", () => {
    screenWidth(false);
    useSidebarStore.getState().toggleCollapsed();
    expect(useSidebarStore.getState()).toMatchObject({
      collapsed: false,
      narrowOpen: true,
    });
    expect(sidebarModeOf(useSidebarStore.getState())).toBe("open");
  });
});
