"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AppSidebar } from "~/components/layout/app-sidebar";
import { NavigationBar } from "~/components/navigation-bar";
import { useSidebarStore } from "~/lib/stores/useSidebarStore";

export const useSidebar = useSidebarStore;

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { collapsed } = useSidebarStore();

  // If this is an OBS live overlay, render purely without navigation shell
  const isOverlay = pathname?.startsWith("/overlay");
  if (isOverlay) {
    return <main className="min-h-screen bg-transparent">{children}</main>;
  }

  return (
    <div className="sunlit-canvas flex min-h-screen flex-col bg-background text-foreground">
        <NavigationBar />

        <div className="flex flex-1">
          <AppSidebar />

          <main
            className={`min-w-0 flex-1 transition-all duration-300 ease-in-out ${
              collapsed ? "md:pl-[72px]" : "md:pl-[260px]"
            }`}
          >
            <div className="mx-auto max-w-[1440px] px-3 py-4 sm:px-6 sm:py-6 lg:px-8">
              {children}
            </div>
          </main>
        </div>

        <footer
          className={`border-t border-border/70 bg-card/40 transition-colors duration-150 ${
            collapsed ? "md:pl-[72px]" : "md:pl-[260px]"
          }`}
        >
          <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6 sm:py-6 lg:px-8">
            <div className="flex flex-col items-center justify-between gap-3 text-xs text-muted-foreground sm:flex-row">
              <p className="text-center sm:text-left">
                © 2026 CricScore. Live cricket scoring, tournament management
                and broadcast engine.
              </p>
              <nav
                aria-label="Footer"
                className="flex flex-wrap justify-center gap-4 sm:gap-5"
              >
                <Link
                  href="/matches"
                  className="transition-colors hover:text-foreground"
                >
                  Matches
                </Link>
                <Link
                  href="/tournaments"
                  className="transition-colors hover:text-foreground"
                >
                  Tournaments
                </Link>
                <Link
                  href="/search"
                  className="transition-colors hover:text-foreground"
                >
                  Search
                </Link>
              </nav>
            </div>
          </div>
        </footer>
      </div>
  );
}
