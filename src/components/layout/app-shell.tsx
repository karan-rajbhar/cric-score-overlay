"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AppSidebar } from "~/components/layout/app-sidebar";
import { MobileTabBar } from "~/components/layout/mobile-tab-bar";
import { UpdateStrip } from "~/components/pwa/update-strip";
import { isTaskPath } from "~/lib/navigation";
import { NavigationBar } from "~/components/navigation-bar";
import { useTrackVisits } from "~/lib/in-app-history";
import { isReportPath } from "~/lib/report-route";
import {
  sidebarClasses,
  sidebarModeOf,
  useSidebarStore,
} from "~/lib/stores/useSidebarStore";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const pad = sidebarClasses(sidebarModeOf(useSidebarStore())).pad;
  useTrackVisits(pathname);

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
    // A div: the scoring screen has its own <main>, and a page has one.
    return (
      <div className="min-h-screen bg-background text-foreground">
        {children}
      </div>
    );
  }

  const task = isTaskPath(pathname);

  // The printable reports (match, club statistics) bring their own toolbar
  // and layout.
  if (isReportPath(pathname)) {
    return <div className="min-h-screen bg-background">{children}</div>;
  }

  return (
    // Phones: room at the bottom for the floating tab bar (none on a task).
    <div
      className={`flex min-h-screen flex-col bg-background text-foreground ${task ? "" : "max-md:pb-24"}`}
    >
        {/* The first stop for a keyboard: past the header and the sidebar
            (WCAG 2.4.1, N26). */}
        <a
          href="#content"
          className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[60] focus:rounded-full focus:bg-primary focus:px-4 focus:py-2.5 focus:text-sm focus:font-medium focus:text-primary-foreground focus:shadow-float focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
        >
          Skip to content
        </a>
        {/* A new version waiting: a strip in the flow, covering nothing.
            Not on the scoring screen, where it would push the keys down
            mid-match; it waits for the next page (N12). */}
        <UpdateStrip />
        {/* Phones: no header (the tab bar and the More page hold its items;
            detail screens have their own back bar). */}
        <div className="contents max-md:hidden">
          <NavigationBar />
        </div>

        <div className="flex flex-1">
          <AppSidebar />

          <main
            id="content"
            tabIndex={-1}
            className={`relative isolate min-w-0 flex-1 transition-all duration-300 ease-in-out focus:outline-none md:ml-[env(safe-area-inset-left)] ${
              pad
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
            {/* Side insets: a phone on its side keeps the page clear of the
                notch (N39); from md the sidebar takes the left one. */}
            <div className="w-full overflow-x-clip pb-[max(2rem,env(safe-area-inset-bottom))] pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))] pt-[max(1.25rem,env(safe-area-inset-top))] sm:py-8 sm:pl-[max(1.5rem,env(safe-area-inset-left))] sm:pr-[max(1.5rem,env(safe-area-inset-right))] md:pl-6 lg:pl-8 lg:pr-[max(2rem,env(safe-area-inset-right))]">
              {children}
            </div>
          </main>
        </div>

        <footer
          className={`border-t border-border max-md:hidden md:ml-[env(safe-area-inset-left)] ${
            pad
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
                  href="/clubs"
                  className="transition-colors hover:text-foreground"
                >
                  Clubs
                </Link>
              </nav>
            </div>
          </div>
        </footer>
        {!task && <MobileTabBar />}
      </div>
  );
}
