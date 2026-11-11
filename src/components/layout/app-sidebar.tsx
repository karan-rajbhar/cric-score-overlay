"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLitHref } from "~/lib/nav-light";
import {
  sidebarClasses,
  sidebarModeOf,
  useSidebarStore,
} from "~/lib/stores/useSidebarStore";
import { useAuth } from "~/lib/auth";
import { cn } from "~/lib/utils";
import {
  CalendarDays,
  Home,
  Trophy,
  Shield,
  Users,
  UserCheck,
} from "lucide-react";

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  authOnly?: boolean;
}

interface NavSection {
  /** Heading over the group; the first group (Home, Matches) has none, so
   * Home is not filed under "Matches" (N27). */
  title?: string;
  items: NavItem[];
}

/**
 * The places, in the tab bar's order and with its icons (N28): the four
 * tabs, then Teams and Players, which phones reach from More. No actions:
 * New match is the header's Create.
 */
function navSections(home: string): NavSection[] {
  return [
    {
      items: [
        { href: home, label: "Home", icon: Home },
        { href: "/matches", label: "Matches", icon: CalendarDays },
        { href: "/clubs", label: "Clubs", icon: Shield },
        { href: "/tournaments", label: "Tournaments", icon: Trophy },
      ],
    },
    {
      title: "Teams and players",
      items: [
        { href: "/teams", label: "Teams", icon: Users },
        { href: "/players", label: "Players", icon: UserCheck },
      ],
    },
  ];
}

/**
 * Tablet and desktop navigation (phones have the tab bar). Search is in the
 * header, which also collapses this (its button, or Ctrl+B).
 */
export function AppSidebar() {
  const { user } = useAuth();
  const pathname = usePathname();
  const mode = sidebarModeOf(useSidebarStore());
  const cls = sidebarClasses(mode);
  const railOnly = mode === "collapsed";

  // A detail page lights the section of its trail, as the tab bar does
  // (N24): a club's team lights Clubs.
  const lit = useLitHref(pathname);
  const isActive = (href: string) => {
    if (href === "/" || href === "/dashboard") return lit === href;
    return lit === href || lit.startsWith(`${href}/`);
  };

  return (
    <aside
      id="app-sidebar"
      className={cn(
        // box-content: the notch's inset is added to the rail's width, not
        // taken from it (N39).
        "fixed bottom-0 left-0 top-14 z-30 box-content hidden overflow-y-auto overflow-x-hidden border-r border-border/60 bg-card pl-[env(safe-area-inset-left)] transition-all duration-300 ease-in-out md:block",
        cls.width,
      )}
    >
      <nav aria-label="Main" className="select-none space-y-6 p-3">
        {navSections(user ? "/dashboard" : "/").map((section) => {
          const visibleItems = section.items.filter(
            (item) => !item.authOnly || !!user,
          );
          return (
            <div key={section.title ?? "main"} className="space-y-1">
              {mode !== "open" && section.title && (
                <div className={cn("mx-1 my-2 h-px bg-border/40", cls.rail)} />
              )}
              {!railOnly && section.title && (
                <div
                  className={cn(
                    "mb-1.5 px-3 text-xs font-medium text-muted-foreground",
                    mode === "auto" && "hidden lg:block",
                  )}
                >
                  {section.title}
                </div>
              )}

              {visibleItems.map((item) => {
                const active = isActive(item.href);
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    title={mode === "open" ? undefined : item.label}
                    aria-label={item.label}
                    className={cn(
                      "group flex min-h-10 items-center gap-3 rounded-full px-3.5 py-2 text-sm font-medium transition-colors duration-150",
                      active
                        ? "bg-primary-soft font-semibold text-primary-soft-foreground"
                        : "text-muted-foreground hover:bg-accent hover:text-foreground",
                    )}
                  >
                    <Icon
                      className={cn(
                        "h-[1.125rem] w-[1.125rem] shrink-0 transition-colors",
                        active
                          ? "text-primary-soft-foreground"
                          : "text-muted-foreground group-hover:text-foreground",
                      )}
                    />
                    <span className={cn("flex-1 truncate", cls.label)}>
                      {item.label}
                    </span>
                  </Link>
                );
              })}
            </div>
          );
        })}
      </nav>
    </aside>
  );
}
