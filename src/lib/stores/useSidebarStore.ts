import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

export interface SidebarStoreState {
  collapsed: boolean;
  mobileOpen: boolean;
  setCollapsed: (collapsed: boolean) => void;
  toggleCollapsed: () => void;
  setMobileOpen: (open: boolean) => void;
  toggleMobile: () => void;
}

export const useSidebarStore = create<SidebarStoreState>()(
  persist(
    (set) => ({
      collapsed: false,
      mobileOpen: false,

      setCollapsed: (collapsed) => set({ collapsed }),
      toggleCollapsed: () => set((state) => ({ collapsed: !state.collapsed })),
      setMobileOpen: (mobileOpen) => set({ mobileOpen }),
      toggleMobile: () => set((state) => ({ mobileOpen: !state.mobileOpen })),
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
