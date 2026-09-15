"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { useAuth } from "~/lib/auth";
import { Button } from "~/components/ui/button";
import { ThemeToggle } from "~/components/ui/theme-toggle";
import {
  LogOut,
  Search,
  Plus,
  PanelLeft,
  Radio,
  Trophy,
  Users,
  Shield,
  Menu,
} from "lucide-react";
import { BrandMark, BrandWordmark } from "~/components/brand";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { useSidebar } from "~/components/layout/app-shell";

export function NavigationBar() {
  const { user, signOut, loading } = useAuth();
  const router = useRouter();
  const [signOutLoading, setSignOutLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const { toggleCollapsed, toggleMobile } = useSidebar();

  const handleSignOut = async () => {
    if (signOutLoading) return;
    try {
      setSignOutLoading(true);
      await signOut();
    } catch (error) {
      console.error("Failed to sign out:", error);
      window.location.reload();
    }
  };

  // Keyboard shortcut ⌘K / Ctrl+K for search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        const searchInput = document.getElementById("global-search-input");
        searchInput?.focus();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <nav className="sticky top-0 z-40 h-[58px] border-b border-border/70 bg-background/85 backdrop-blur-md supports-[backdrop-filter]:bg-background/75">
      <div className="flex h-full items-center justify-between gap-2 px-3 sm:gap-3 sm:px-6">
        {/* Left: Sidebar toggle + Brand */}
        <div className="flex items-center gap-1.5 sm:gap-3">
          {/* Mobile menu trigger */}
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground md:hidden"
            onClick={toggleMobile}
            aria-label="Open navigation drawer"
          >
            <Menu className="h-5 w-5" />
          </Button>

          {/* Desktop sidebar collapse trigger */}
          <Button
            variant="ghost"
            size="sm"
            className="hidden h-8 w-8 p-0 text-muted-foreground hover:bg-muted hover:text-foreground md:flex"
            onClick={toggleCollapsed}
            title="Toggle sidebar (Ctrl+B)"
            aria-label="Toggle sidebar"
          >
            <PanelLeft className="h-4 w-4" />
          </Button>

          <Link
            href="/"
            className="flex shrink-0 items-center gap-2 sm:gap-2.5"
          >
            <BrandMark />
            <span className="hidden min-[400px]:inline-flex">
              <BrandWordmark />
            </span>
          </Link>
        </div>

        {/* Center: Search */}
        <div className="hidden w-full max-w-md items-center lg:flex">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const q = searchQuery.trim();
              if (q.length >= 2) {
                router.push(`/search?q=${encodeURIComponent(q)}`);
              }
            }}
            className="relative w-full"
          >
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <input
              id="global-search-input"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search matches, tournaments, players..."
              className="h-8 w-full rounded-lg border border-border/70 bg-muted/30 pl-8 pr-12 text-xs transition-all placeholder:text-muted-foreground focus-visible:bg-background focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
            />
            <kbd className="pointer-events-none absolute right-2 top-2 hidden select-none rounded border border-border/60 bg-muted/60 px-1.5 py-0.5 font-mono text-[10px] font-medium text-muted-foreground sm:inline-block">
              ⌘K
            </kbd>
          </form>
        </div>

        {/* Right: Quick actions, Mobile Search, Theme, Profile */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Mobile Search Button */}
          <Button
            asChild
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground lg:hidden"
            title="Search"
            aria-label="Search"
          >
            <Link href="/search">
              <Search className="h-4 w-4" />
            </Link>
          </Button>

          {/* Quick Create Dropdown (Auth only) */}
          {user && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  size="sm"
                  className="interactive-button h-8 px-2 text-xs font-semibold sm:gap-1 sm:px-3"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Create</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="w-48 border-border bg-popover/95 backdrop-blur-md"
              >
                <DropdownMenuLabel className="text-xs font-bold text-muted-foreground">
                  Quick Actions
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild className="cursor-pointer text-xs">
                  <Link
                    href="/matches/create"
                    className="flex items-center gap-2"
                  >
                    <Radio className="h-4 w-4 text-emerald-500" />
                    <span>New Match</span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild className="cursor-pointer text-xs">
                  <Link
                    href="/teams/create"
                    className="flex items-center gap-2"
                  >
                    <Users className="h-4 w-4 text-sky-500" />
                    <span>Create Team</span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild className="cursor-pointer text-xs">
                  <Link
                    href="/tournaments/create"
                    className="flex items-center gap-2"
                  >
                    <Trophy className="h-4 w-4 text-amber-500" />
                    <span>Host Tournament</span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild className="cursor-pointer text-xs">
                  <Link
                    href="/clubs/create"
                    className="flex items-center gap-2"
                  >
                    <Shield className="h-4 w-4 text-purple-500" />
                    <span>Register Club</span>
                  </Link>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          <ThemeToggle />

          {/* User Auth Buttons */}
          {!loading && user && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className="flex h-8 w-8 items-center justify-center rounded-full border border-primary/30 bg-primary/10 text-xs font-bold text-primary transition-all hover:bg-primary/20"
                  aria-label="User menu"
                >
                  {(user.user_metadata?.full_name ||
                    user.email ||
                    "U")[0]?.toUpperCase()}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="w-56 border-border bg-popover/95 backdrop-blur-md"
              >
                <div className="p-2">
                  <div className="truncate text-xs font-semibold text-foreground">
                    {user.user_metadata?.full_name || "CricScore User"}
                  </div>
                  <div className="truncate text-[11px] text-muted-foreground">
                    {user.email}
                  </div>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild className="cursor-pointer text-xs">
                  <Link href="/dashboard">Dashboard</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild className="cursor-pointer text-xs">
                  <Link href="/teams">My Teams</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild className="cursor-pointer text-xs">
                  <Link href="/clubs">My Clubs</Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={handleSignOut}
                  disabled={signOutLoading}
                  className="cursor-pointer text-xs text-destructive hover:bg-destructive/10 focus:bg-destructive/10"
                >
                  <LogOut className="mr-2 h-3.5 w-3.5" />
                  <span>Sign out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {!loading && !user && (
            <div className="flex items-center gap-1.5 sm:gap-2">
              <Button
                asChild
                variant="ghost"
                size="sm"
                className="h-8 px-2 text-xs sm:px-3"
              >
                <Link href="/auth/login">Sign in</Link>
              </Button>
              <Button
                asChild
                size="sm"
                className="interactive-button h-8 px-2.5 text-xs font-semibold sm:px-3"
              >
                <Link href="/auth/signup">
                  <span className="hidden sm:inline">Get started</span>
                  <span className="sm:hidden">Join</span>
                </Link>
              </Button>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}
