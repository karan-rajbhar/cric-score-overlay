import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

/**
 * How the sidebar shows (N5):
 * - "collapsed": the 72px rail everywhere (the user collapsed it);
 * - "auto": the rail from `md`, the full sidebar from `lg`, so a tablet in
 *   portrait keeps its width for the page;
 * - "open": the full sidebar from `md` (opened on a tablet, this visit).
 */
export type SidebarMode = "collapsed" | "auto" | "open";

export interface SidebarStoreState {
  collapsed: boolean;
  /** Opened below `lg` this visit (not remembered). */
  narrowOpen: boolean;
  setCollapsed: (collapsed: boolean) => void;
  /** The header's button and Ctrl+B: what it does depends on the width. */
  toggleCollapsed: () => void;
}

const wide = () =>
  typeof window !== "undefined" &&
  Boolean(window.matchMedia?.("(min-width: 1024px)").matches);

export const sidebarModeOf = (s: {
  collapsed: boolean;
  narrowOpen: boolean;
}): SidebarMode =>
  s.narrowOpen ? "open" : s.collapsed ? "collapsed" : "auto";

export const useSidebarStore = create<SidebarStoreState>()(
  persist(
    (set) => ({
      collapsed: false,
      narrowOpen: false,

      setCollapsed: (collapsed) => set({ collapsed, narrowOpen: false }),
      toggleCollapsed: () =>
        set((state) =>
          wide()
            ? { collapsed: !state.collapsed, narrowOpen: false }
            : // Below lg the rail shows unless opened for this visit.
              { narrowOpen: !state.narrowOpen },
        ),
    }),
    {
      name: "cric-sidebar-collapsed",
      storage: createJSONStorage(() =>
        typeof window !== "undefined" ? window.localStorage : ({} as Storage),
      ),
      partialize: (state) => ({ collapsed: state.collapsed }),
    },
  ),
);

/** Classes for the sidebar's width, the page's left padding and labels. */
export function sidebarClasses(mode: SidebarMode) {
  switch (mode) {
    case "collapsed":
      return { width: "w-[72px]", pad: "md:pl-[72px]", label: "hidden", rail: "" };
    case "open":
      return { width: "w-[260px]", pad: "md:pl-[260px]", label: "", rail: "hidden" };
    default:
      return {
        width: "w-[72px] lg:w-[260px]",
        pad: "md:pl-[72px] lg:pl-[260px]",
        label: "hidden lg:inline",
        rail: "lg:hidden",
      };
  }
}
