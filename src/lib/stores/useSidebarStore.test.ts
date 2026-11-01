import { describe, it, expect, beforeEach } from "vitest";
import { useSidebarStore } from "./useSidebarStore";

describe("useSidebarStore", () => {
  beforeEach(() => {
    useSidebarStore.setState({ collapsed: false });
  });

  it("initializes with expanded sidebar", () => {
    expect(useSidebarStore.getState().collapsed).toBe(false);
  });

  it("toggles collapsed state", () => {
    const { toggleCollapsed } = useSidebarStore.getState();
    toggleCollapsed();
    expect(useSidebarStore.getState().collapsed).toBe(true);

    toggleCollapsed();
    expect(useSidebarStore.getState().collapsed).toBe(false);
  });
});
