"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AppSidebar } from "~/components/layout/app-sidebar";
import { MobileTabBar } from "~/components/layout/mobile-tab-bar";
import { NavigationBar } from "~/components/navigation-bar";
import { isReportPath } from "~/lib/report-route";
import { useSidebarStore } from "~/lib/stores/useSidebarStore";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { collapsed } = useSidebarStore();

  // If this is an OBS live overlay, render purely without navigation shell
  const isOverlay = pathname?.startsWith("/overlay");
  if (isOverlay) {
    // Broadcast graphics keep their condensed face for figures.
    return (
      <main className="min-h-screen bg-transparent [--font-score:var(--font-broadcast)]">
        {children}
      </main>
    );
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

  // The printable reports (match, club statistics) bring their own toolbar
  // and layout.
  if (isReportPath(pathname)) {
    return <div className="min-h-screen bg-background">{children}</div>;
  }

  return (
    // Phones: room at the bottom for the floating tab bar.
    <div className="flex min-h-screen flex-col bg-background text-foreground max-md:pb-24">
        {/* Phones: no header (the tab bar and its More drawer hold its
            items; detail screens have their own back bar). */}
        <div className="contents max-md:hidden">
          <NavigationBar />
        </div>

        <div className="flex flex-1">
          <AppSidebar />

          <main
            className={`relative isolate min-w-0 flex-1 transition-all duration-300 ease-in-out ${
              collapsed ? "md:pl-[72px]" : "md:pl-[260px]"
            }`}
          >
            {/* The wash behind the top of every screen, fading into the page. */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-80 bg-wash [mask-image:linear-gradient(to_bottom,#000_35%,transparent)]"
            />
            {/* overflow-x-clip, not -hidden: "hidden" turns this into a scroll
                container, so sticky page headers stick inside it (pushed down
                by their top offset) instead of under the navigation bar. */}
            <div className="w-full overflow-x-clip px-4 pb-[max(2rem,env(safe-area-inset-bottom))] pt-[max(1.25rem,env(safe-area-inset-top))] sm:px-6 sm:py-8 lg:px-8">
              {children}
            </div>
          </main>
        </div>

        <footer
          className={`border-t border-border max-md:hidden ${
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
        <MobileTabBar />
      </div>
  );
}
