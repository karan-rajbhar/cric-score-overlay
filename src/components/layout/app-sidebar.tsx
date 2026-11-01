"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSidebarStore } from "~/lib/stores/useSidebarStore";
import { useAuth } from "~/lib/auth";
import { cn } from "~/lib/utils";
import {
  Home,
  Radio,
  Trophy,
  Shield,
  Users,
  UserCheck,
  PlusCircle,
} from "lucide-react";

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  authOnly?: boolean;
}

interface NavSection {
  title: string;
  items: NavItem[];
}

function navSections(home: string): NavSection[] {
  return [
    {
      title: "Matches",
      items: [
        { href: home, label: "Home", icon: Home },
        { href: "/matches", label: "Matches", icon: Radio },
        {
          href: "/matches/create",
          label: "New match",
          icon: PlusCircle,
          authOnly: true,
        },
      ],
    },
    {
      title: "Competitions",
      items: [
        { href: "/tournaments", label: "Tournaments", icon: Trophy },
        { href: "/clubs", label: "Clubs", icon: Shield },
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
  const { collapsed } = useSidebarStore();

  const isActive = (href: string) => {
    if (href === "/" || href === "/dashboard") return pathname === href;
    // New match is its own row, so Matches is not lit with it.
    if (href === "/matches" && pathname === "/matches/create") return false;
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  return (
    <aside
      className={cn(
        "fixed bottom-0 left-0 top-14 z-30 hidden overflow-y-auto overflow-x-hidden border-r border-border/60 bg-card transition-all duration-300 ease-in-out md:block",
        collapsed ? "w-[72px]" : "w-[260px]",
      )}
    >
      <nav aria-label="Main" className="select-none space-y-6 p-3">
        {navSections(user ? "/dashboard" : "/").map((section) => {
          const visibleItems = section.items.filter(
            (item) => !item.authOnly || !!user,
          );
          return (
            <div key={section.title} className="space-y-1">
              {collapsed ? (
                <div className="mx-1 my-2 h-px bg-border/40" />
              ) : (
                <div className="mb-1.5 px-3 text-xs font-medium text-muted-foreground/75">
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
                    title={collapsed ? item.label : undefined}
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
                    {!collapsed && (
                      <span className="flex-1 truncate">{item.label}</span>
                    )}
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
