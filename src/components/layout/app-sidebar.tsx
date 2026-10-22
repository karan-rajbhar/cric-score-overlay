"use client";

import React from "react";
import Link from "next/link";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { usePathname } from "next/navigation";
import { useSidebarStore } from "~/lib/stores/useSidebarStore";
import { useAuth } from "~/lib/auth";
import { cn } from "~/lib/utils";
import {
  DrawerAccount,
  DrawerActions,
  DrawerFooter,
} from "~/components/layout/drawer-account";
import {
  LayoutDashboard,
  Radio,
  Trophy,
  Shield,
  Users,
  UserCheck,
  Tv,
  ChevronLeft,
  ChevronRight,
  PlusCircle,
  X,
  Search,
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
    title: "Matches",
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
  {
    title: "Tools",
    items: [
      { href: "/overlay/test", label: "Stream overlays", icon: Tv },
      { href: "/search", label: "Search", icon: Search },
    ],
  },
];

export function AppSidebar() {
  const { user } = useAuth();
  const pathname = usePathname();
  const { collapsed, toggleCollapsed, mobileOpen, setMobileOpen } =
    useSidebarStore();

  // The drawer is for phones: close it when the window grows past them
  // (a modal left open there would keep the page inert).
  React.useEffect(() => {
    if (!mobileOpen || typeof window.matchMedia !== "function") return;
    const wide = window.matchMedia("(min-width: 768px)");
    const close = () => {
      if (wide.matches) setMobileOpen(false);
    };
    close();
    wide.addEventListener?.("change", close);
    return () => wide.removeEventListener?.("change", close);
  }, [mobileOpen, setMobileOpen]);

  const isActive = (href: string) => {
    if (href === "/dashboard") return pathname === "/dashboard";
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  const renderContent = (isMobile = false) => (
    <div className="flex h-full select-none flex-col justify-between p-3">
      <div className="space-y-6">
        {isMobile && (
          <div className="space-y-3">
            <div className="flex items-center justify-between px-1">
              <DialogPrimitive.Title className="text-sm font-semibold text-foreground">
                Menu
              </DialogPrimitive.Title>
              <DialogPrimitive.Close
                className="flex h-10 w-10 items-center justify-center rounded-full text-muted-foreground hover:bg-accent hover:text-foreground"
                aria-label="Close menu"
              >
                <X className="h-5 w-5 shrink-0" aria-hidden="true" />
              </DialogPrimitive.Close>
            </div>
            <DrawerAccount onNavigate={() => setMobileOpen(false)} />
          </div>
        )}

        {NAV_SECTIONS.map((section, sIdx) => {
          // On phones "New match" sits under Create with the others.
          const visibleItems = section.items.filter(
            (item) =>
              (!item.authOnly || !!user) &&
              !(isMobile && item.href === "/matches/create"),
          );
          if (visibleItems.length === 0) return null;

          return (
            <div key={sIdx} className="space-y-1">
              {!collapsed || isMobile ? (
                <div className="mb-1.5 px-3 text-xs font-medium text-muted-foreground/75">
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
                      "group flex min-h-10 items-center gap-3 rounded-full px-3.5 py-2 text-sm font-medium transition-colors duration-150",
                      isMobile && "min-h-[44px]",
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
                    {(!collapsed || isMobile) && (
                      <span className="flex-1 truncate">{item.label}</span>
                    )}
                    {(!collapsed || isMobile) && item.badge && (
                      <span className="ml-auto rounded bg-muted px-1.5 py-0.5 text-2xs font-medium text-muted-foreground">
                        {item.badge}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          );
        })}
        {isMobile && <DrawerActions onNavigate={() => setMobileOpen(false)} />}
      </div>

      {isMobile && (
        <div className="pt-6">
          <DrawerFooter />
        </div>
      )}

      {/* Collapse/Expand Toggle (Desktop only) */}
      {!isMobile && (
        <div className="border-t border-border/60 pt-3">
          <button
            onClick={toggleCollapsed}
            className="flex w-full items-center justify-center gap-2 rounded-full p-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? (
              <ChevronRight className="h-4 w-4 shrink-0" />
            ) : (
              <>
                <ChevronLeft className="h-4 w-4 shrink-0" />
                <span>Collapse sidebar</span>
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
          "fixed bottom-0 left-0 top-14 z-30 hidden overflow-y-auto overflow-x-hidden border-r border-border/60 bg-card transition-all duration-300 ease-in-out md:block",
          collapsed ? "w-[72px]" : "w-[260px]",
        )}
      >
        {renderContent(false)}
      </aside>

      {/* Phone drawer: a modal dialog (focus moves in and stays, Escape or
          the backdrop closes it, focus returns to More). */}
      <DialogPrimitive.Root open={mobileOpen} onOpenChange={setMobileOpen}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm md:hidden" />
          <DialogPrimitive.Content
            aria-describedby={undefined}
            className="fixed inset-y-0 left-0 z-50 w-72 max-w-[85vw] overflow-y-auto overscroll-contain rounded-r-[1.75rem] bg-card pb-[env(safe-area-inset-bottom)] pt-[env(safe-area-inset-top)] shadow-float focus:outline-none md:hidden"
          >
            {renderContent(true)}
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
    </>
  );
}
