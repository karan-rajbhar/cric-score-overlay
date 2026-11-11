"use client";

import { usePathname } from "next/navigation";
import { CalendarDays, Home, Menu, Shield, Trophy } from "lucide-react";
import { TabBar } from "~/components/ds/app-bar";
import { useAuth } from "~/lib/auth";
import { navSectionOf } from "~/lib/navigation";
import { useLitHref } from "~/lib/nav-light";

/**
 * Phone navigation: the floating tab bar at the bottom of the screen, where
 * the thumb is. Every tab is a place that holds what its name says (see
 * `/design#principles`); More has what has no tab (Teams, Players, account),
 * and Search is a button at the top of the main screens (`SearchLink`).
 * Hidden from tablets up, where the sidebar shows.
 */
export function MobileTabBar() {
  const pathname = usePathname() ?? "/";
  const { user } = useAuth();
  // A detail page lights the section of its trail (N24).
  const section = navSectionOf(useLitHref(pathname));

  return (
    // Steps aside while the on-screen keyboard is up (N38, ViewportVars).
    <div className="fixed inset-x-0 bottom-0 z-40 pb-[max(0.75rem,env(safe-area-inset-bottom))] pl-[max(0.75rem,env(safe-area-inset-left))] pr-[max(0.75rem,env(safe-area-inset-right))] md:hidden [[data-keyboard]_&]:hidden">
      <TabBar
        items={[
          {
            href: user ? "/dashboard" : "/",
            label: "Home",
            icon: Home,
            active: section === "home",
          },
          {
            href: "/matches",
            label: "Matches",
            icon: CalendarDays,
            active: section === "matches",
          },
          {
            href: "/clubs",
            label: "Clubs",
            icon: Shield,
            active: section === "clubs",
          },
          {
            href: "/tournaments",
            label: "Tournaments",
            icon: Trophy,
            active: section === "tournaments",
          },
          {
            href: "/more",
            label: "More",
            icon: Menu,
            active: section === "more",
          },
        ]}
      />
    </div>
  );
}
