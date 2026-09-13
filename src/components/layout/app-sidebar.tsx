"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSidebar } from "./app-shell";
import { useAuth } from "~/lib/auth";
import { cn } from "~/lib/utils";
import {
  LayoutDashboard,
  Radio,
  Trophy,
  Shield,
  Users,
  UserCheck,
  Tv,
  Target,
  ChevronLeft,
  ChevronRight,
  PlusCircle,
  X,
} from "lucide-react";

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
  authOnly?: boolean;
}

interface NavSection {
  title: string;
  items: NavItem[];
}

const NAV_SECTIONS: NavSection[] = [
  {
    title: "Match Center",
    items: [
      {
        href: "/dashboard",
        label: "Dashboard",
        icon: LayoutDashboard,
        authOnly: true,
      },
      { href: "/matches", label: "Matches", icon: Radio },
      {
        href: "/matches/create",
        label: "Score New Match",
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
  {
    title: "Broadcast & Tools",
    items: [
      { href: "/overlay/test", label: "OBS Overlays", icon: Tv },
      { href: "/search", label: "Search & Database", icon: Target },
    ],
  },
];

export function AppSidebar() {
  const { user } = useAuth();
  const pathname = usePathname();
  const { collapsed, toggleCollapsed, mobileOpen, setMobileOpen } =
    useSidebar();

  const isActive = (href: string) => {
    if (href === "/dashboard") return pathname === "/dashboard";
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  const renderContent = (isMobile = false) => (
    <div className="flex h-full select-none flex-col justify-between p-3">
      <div className="space-y-6">
        {isMobile && (
          <div className="flex items-center justify-between border-b border-border/70 px-2 pb-3">
            <span className="text-sm font-extrabold uppercase tracking-wider text-primary">
              CricScore Menu
            </span>
            <button
              onClick={() => setMobileOpen(false)}
              className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
              aria-label="Close menu"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        )}

        {NAV_SECTIONS.map((section, sIdx) => {
          const visibleItems = section.items.filter(
            (item) => !item.authOnly || !!user,
          );
          if (visibleItems.length === 0) return null;

          return (
            <div key={sIdx} className="space-y-1">
              {!collapsed || isMobile ? (
                <div className="mb-1.5 px-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70">
                  {section.title}
                </div>
              ) : (
                <div className="mx-1 my-2 h-px bg-border/40" />
              )}

              {visibleItems.map((item) => {
                const active = isActive(item.href);
                const Icon = item.icon;

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => isMobile && setMobileOpen(false)}
                    title={collapsed && !isMobile ? item.label : undefined}
                    className={cn(
                      "interactive-button group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-150",
                      active
                        ? "border border-primary/20 bg-primary/10 font-semibold text-primary shadow-sm"
                        : "text-muted-foreground hover:bg-muted/70 hover:text-foreground",
                    )}
                  >
                    <Icon
                      className={cn(
                        "h-4 w-4 shrink-0 transition-colors",
                        active
                          ? "text-primary"
                          : "text-muted-foreground group-hover:text-foreground",
                      )}
                    />
                    {(!collapsed || isMobile) && (
                      <span className="flex-1 truncate">{item.label}</span>
                    )}
                    {(!collapsed || isMobile) && item.badge && (
                      <span className="ml-auto rounded bg-primary/20 px-1.5 py-0.5 text-[10px] font-bold text-primary">
                        {item.badge}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          );
        })}
      </div>

      {/* Collapse/Expand Toggle (Desktop only) */}
      {!isMobile && (
        <div className="border-t border-border/60 pt-3">
          <button
            onClick={toggleCollapsed}
            className="flex w-full items-center justify-center gap-2 rounded-lg p-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted/70 hover:text-foreground"
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <>
                <ChevronLeft className="h-4 w-4" />
                <span>Collapse Sidebar</span>
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );

  return (
    <>
      {/* Desktop Sidebar (Fixed Left) */}
      <aside
        className={cn(
          "fixed bottom-0 left-0 top-[58px] z-30 hidden overflow-y-auto overflow-x-hidden border-r border-border/70 bg-card/60 backdrop-blur-md transition-all duration-300 ease-in-out md:block",
          collapsed ? "w-[72px]" : "w-[260px]",
        )}
      >
        {renderContent(false)}
      </aside>

      {/* Mobile Slide-Out Drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-background/80 backdrop-blur-sm transition-opacity"
            onClick={() => setMobileOpen(false)}
          />

          {/* Drawer Panel */}
          <div className="fixed inset-y-0 left-0 z-50 w-72 max-w-[85vw] border-r border-border bg-card shadow-2xl">
            {renderContent(true)}
          </div>
        </div>
      )}
    </>
  );
}
