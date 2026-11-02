"use client";

import { usePathname } from "next/navigation";
import { CalendarDays, Home, Menu, Shield, Trophy } from "lucide-react";
import { TabBar } from "~/components/ds/app-bar";
import { useAuth } from "~/lib/auth";
import { navSectionOf } from "~/lib/navigation";

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
  const section = navSectionOf(pathname);

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] md:hidden">
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
