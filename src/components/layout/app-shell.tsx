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

  // If this is live match scoring, render dedicated distraction-free scoring console
  // without global site navbar (search, profile), sidebar, or footer
  const isScoring =
    Boolean(pathname?.includes("/matches/")) &&
    Boolean(pathname?.endsWith("/score") || pathname?.includes("/score/"));
  if (isScoring) {
    return (
      <main className="min-h-screen bg-background text-foreground">
        {children}
      </main>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
        <NavigationBar />

        <div className="flex flex-1">
          <AppSidebar />

          <main
            className={`min-w-0 flex-1 transition-all duration-300 ease-in-out ${
              collapsed ? "md:pl-[72px]" : "md:pl-[260px]"
            }`}
          >
            <div className="w-full overflow-x-hidden px-4 py-5 pb-[max(2rem,env(safe-area-inset-bottom))] sm:px-6 sm:py-8 lg:px-8">
              {children}
            </div>
          </main>
        </div>

        <footer
          className={`border-t border-border ${
            collapsed ? "md:pl-[72px]" : "md:pl-[260px]"
          }`}
        >
          <div className="px-4 py-5 sm:px-6 lg:px-8">
            <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 text-xs text-muted-foreground sm:flex-row">
              <p className="text-center sm:text-left">
                © 2026 CricScore. Cricket scoring for clubs and leagues.
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
