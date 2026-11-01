import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

export interface SidebarStoreState {
  collapsed: boolean;
  setCollapsed: (collapsed: boolean) => void;
  toggleCollapsed: () => void;
}

export const useSidebarStore = create<SidebarStoreState>()(
  persist(
    (set) => ({
      collapsed: false,

      setCollapsed: (collapsed) => set({ collapsed }),
      toggleCollapsed: () => set((state) => ({ collapsed: !state.collapsed })),
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
