"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { useAuth } from "~/lib/auth";
import { Button } from "~/components/ui/button";
import { Skeleton } from "~/components/ui/skeleton";
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
  User as UserIcon,
  UserPlus,
} from "lucide-react";
import { InviteDialog } from "~/components/invite-dialog";
import {
  InstallAppMenuItem,
  useIosInstallHint,
} from "~/components/pwa/install-app";
import { BrandMark, BrandWordmark } from "~/components/brand";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { useSidebarStore } from "~/lib/stores/useSidebarStore";
import { useSignOut, useUsername } from "~/lib/hooks/useAccount";

export function NavigationBar() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const { signOut: handleSignOut, pending: signOutLoading } = useSignOut();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const username = useUsername();
  const { toggleCollapsed } = useSidebarStore();
  useIosInstallHint(Boolean(user));

  // Keyboard shortcuts: Ctrl+K for search, Ctrl+B for the sidebar.
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!e.metaKey && !e.ctrlKey) return;
      if (e.key === "k") {
        e.preventDefault();
        document.getElementById("global-search-input")?.focus();
      } else if (e.key === "b") {
        e.preventDefault();
        toggleCollapsed();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [toggleCollapsed]);

  return (
    <nav className="sticky top-0 z-40 h-14 border-b border-border/60 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/85">
      <div className="flex h-full items-center justify-between gap-2 px-3 sm:gap-3 sm:px-5">
        {/* Left: Sidebar toggle + Brand */}
        <div className="flex items-center gap-1.5 sm:gap-2.5">
          {/* Desktop sidebar collapse trigger */}
          <Button
            variant="ghost"
            size="sm"
            className="hidden h-9 w-9 p-0 text-muted-foreground hover:text-foreground md:flex"
            onClick={toggleCollapsed}
            title="Toggle sidebar (Ctrl+B)"
            aria-label="Toggle sidebar"
          >
            <PanelLeft className="h-4 w-4 shrink-0" />
          </Button>

          <Link
            href={user ? "/dashboard" : "/"}
            className="flex shrink-0 items-center gap-2 rounded-lg"
            aria-label="CricScore home"
          >
            <BrandMark />
            <BrandWordmark />
          </Link>
        </div>

        {/* Center: Search */}
        <div className="hidden w-full max-w-md items-center lg:flex">
          <form
            role="search"
            onSubmit={(e) => {
              e.preventDefault();
              const q = searchQuery.trim();
              if (q.length >= 2) {
                router.push(`/search?q=${encodeURIComponent(q)}`);
              }
            }}
            className="relative w-full"
          >
            <Search
              className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 shrink-0 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <input
              autoCorrect="off"
              autoCapitalize="none"
              spellCheck={false}
              id="global-search-input"
              type="search"
              aria-label="Search matches, tournaments and players"
              autoComplete="off"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search matches, tournaments, players"
              className="h-10 w-full rounded-full border border-border bg-card pl-10 pr-14 text-sm transition-colors placeholder:text-muted-foreground focus-visible:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
            />
            <kbd className="pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 select-none rounded-full border border-border bg-muted px-2 py-0.5 font-sans text-2xs font-medium text-muted-foreground sm:inline-block">
              Ctrl K
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
            className="h-9 w-9 touch-manipulation p-0 text-muted-foreground hover:text-foreground lg:hidden"
            title="Search"
            aria-label="Search"
          >
            <Link href="/search">
              <Search className="h-4 w-4 shrink-0" />
            </Link>
          </Button>

          {/* Quick Create Dropdown (Auth only); its space is held while auth resolves. */}
          {loading && (
            <Skeleton
              className="h-8 w-16 rounded-lg sm:w-24"
              aria-hidden="true"
            />
          )}
          {user && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  size="sm"
                >
                  <Plus className="h-3.5 w-3.5 shrink-0" />
                  <span className="hidden sm:inline">Create</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="w-48"
              >
                <DropdownMenuLabel className="text-xs font-medium text-muted-foreground">
                  Create
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild className="cursor-pointer text-xs">
                  <Link
                    href="/matches/create"
                    className="flex items-center gap-2"
                  >
                    <Radio className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <span>New match</span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild className="cursor-pointer text-xs">
                  <Link
                    href="/teams/create"
                    className="flex items-center gap-2"
                  >
                    <Users className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <span>New team</span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild className="cursor-pointer text-xs">
                  <Link
                    href="/tournaments/create"
                    className="flex items-center gap-2"
                  >
                    <Trophy className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <span>New tournament</span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild className="cursor-pointer text-xs">
                  <Link
                    href="/clubs/create"
                    className="flex items-center gap-2"
                  >
                    <Shield className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <span>New club</span>
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
                  className="flex h-9 w-9 touch-manipulation items-center justify-center rounded-full border border-border bg-muted text-xs font-semibold text-foreground transition-colors hover:bg-accent"
                  aria-label="User menu"
                >
                  {(user.user_metadata?.full_name ||
                    user.email ||
                    "U")[0]?.toUpperCase()}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="w-56"
              >
                <div className="p-2">
                  <div className="truncate text-xs font-semibold text-foreground">
                    {user.user_metadata?.full_name || "CricScore User"}
                  </div>
                  {username && (
                    <div className="font-mono text-xs text-muted-foreground">
                      @{username}
                    </div>
                  )}
                  <div className="truncate text-2xs text-muted-foreground">
                    {user.email}
                  </div>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild className="cursor-pointer text-xs">
                  <Link href="/dashboard">Home</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild className="cursor-pointer text-xs">
                  <Link
                    href={`/players/${username ? `@${username}` : user.id}`}
                    className="flex items-center gap-2"
                  >
                    <UserIcon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    <span>My profile</span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild className="cursor-pointer text-xs">
                  <Link href="/teams">My teams</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild className="cursor-pointer text-xs">
                  <Link href="/clubs">My clubs</Link>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={() => setInviteOpen(true)}
                  className="flex cursor-pointer items-center gap-2 text-xs"
                >
                  <UserPlus className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <span>Invite someone</span>
                </DropdownMenuItem>
                <DropdownMenuItem asChild className="cursor-pointer text-xs">
                  <Link href="/invitations">Manage invites</Link>
                </DropdownMenuItem>
                <InstallAppMenuItem />
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={handleSignOut}
                  disabled={signOutLoading}
                  className="cursor-pointer text-xs text-destructive hover:bg-destructive/10 focus:bg-destructive/10"
                >
                  <LogOut className="mr-2 h-3.5 w-3.5 shrink-0" />
                  <span>Sign out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          {user && (
            <InviteDialog open={inviteOpen} onOpenChange={setInviteOpen} />
          )}

          {!loading && !user && (
            <div className="flex items-center gap-1.5 sm:gap-2">
              <Button
                asChild
                variant="ghost"
                size="sm"
              >
                <Link href="/auth/login">Sign in</Link>
              </Button>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}
