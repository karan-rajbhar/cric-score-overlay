"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { AppSidebar } from "~/components/layout/app-sidebar";
import { NavigationBar } from "~/components/navigation-bar";

interface SidebarContextType {
  collapsed: boolean;
  setCollapsed: (collapsed: boolean) => void;
  toggleCollapsed: () => void;
  mobileOpen: boolean;
  setMobileOpen: (open: boolean) => void;
  toggleMobile: () => void;
}

const SidebarContext = createContext<SidebarContextType | undefined>(undefined);

export function useSidebar() {
  const context = useContext(SidebarContext);
  if (!context) {
    throw new Error("useSidebar must be used within an AppShell");
  }
  return context;
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [collapsed, setCollapsedState] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("cric-sidebar-collapsed");
      if (saved === "true") {
        requestAnimationFrame(() => setCollapsedState(true));
      }
    } catch {
      // Ignore
    }
  }, []);

  const setCollapsed = (val: boolean) => {
    setCollapsedState(val);
    try {
      localStorage.setItem("cric-sidebar-collapsed", String(val));
    } catch {
      // Ignore
    }
  };

  const toggleCollapsed = () => setCollapsed(!collapsed);
  const toggleMobile = () => setMobileOpen(!mobileOpen);

  // If this is an OBS live overlay, render purely without navigation shell
  const isOverlay = pathname?.startsWith("/overlay");
  if (isOverlay) {
    return <main className="min-h-screen bg-transparent">{children}</main>;
  }

  return (
    <SidebarContext.Provider
      value={{
        collapsed,
        setCollapsed,
        toggleCollapsed,
        mobileOpen,
        setMobileOpen,
        toggleMobile,
      }}
    >
      <div className="sunlit-canvas flex min-h-screen flex-col bg-background text-foreground">
        <NavigationBar />

        <div className="flex flex-1">
          <AppSidebar />

          <main
            className={`min-w-0 flex-1 transition-all duration-300 ease-in-out ${
              collapsed ? "md:pl-[72px]" : "md:pl-[260px]"
            }`}
          >
            <div className="mx-auto max-w-[1440px] px-4 py-6 sm:px-6 lg:px-8">
              {children}
            </div>
          </main>
        </div>

        <footer
          className={`border-t border-border/70 bg-card/40 transition-all duration-300 ${
            collapsed ? "md:pl-[72px]" : "md:pl-[260px]"
          }`}
        >
          <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
            <div className="flex flex-col items-center justify-between gap-3 text-xs text-muted-foreground sm:flex-row">
              <p>
                © 2026 CricScore. Live cricket scoring, tournament management
                and broadcast engine.
              </p>
              <div className="flex gap-5">
                <a href="#" className="transition-colors hover:text-foreground">
                  Privacy
                </a>
                <a href="#" className="transition-colors hover:text-foreground">
                  Terms
                </a>
                <a href="#" className="transition-colors hover:text-foreground">
                  Support
                </a>
              </div>
            </div>
          </div>
        </footer>
      </div>
    </SidebarContext.Provider>
  );
}
