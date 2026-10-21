"use client";

import { usePathname } from "next/navigation";
import { CalendarDays, Home, Menu, Search, Trophy } from "lucide-react";
import { TabBar } from "~/components/ds/app-bar";
import { useAuth } from "~/lib/auth";
import { useSidebarStore } from "~/lib/stores/useSidebarStore";

/**
 * Phone navigation: the floating tab bar at the bottom of the screen, where
 * the thumb is. "More" opens the drawer with everything else (clubs, teams,
 * players, overlays). Hidden from tablets up, where the sidebar shows.
 */
export function MobileTabBar() {
  const pathname = usePathname() ?? "/";
  const { user } = useAuth();
  const { mobileOpen, setMobileOpen } = useSidebarStore();
  const home = user ? "/dashboard" : "/";
  const under = (href: string) =>
    pathname === href || pathname.startsWith(`${href}/`);

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] md:hidden">
      <TabBar
        items={[
          {
            href: home,
            label: "Home",
            icon: Home,
            active: pathname === home,
          },
          {
            href: "/matches",
            label: "Matches",
            icon: CalendarDays,
            active: under("/matches"),
          },
          {
            href: "/tournaments",
            label: "Tournaments",
            icon: Trophy,
            active: under("/tournaments"),
          },
          {
            href: "/search",
            label: "Search",
            icon: Search,
            active: under("/search"),
          },
          {
            label: "More",
            icon: Menu,
            onClick: () => setMobileOpen(!mobileOpen),
            expanded: mobileOpen,
            active: mobileOpen,
          },
        ]}
      />
    </div>
  );
}
