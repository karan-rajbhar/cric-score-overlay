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
  User as UserIcon,
  UserPlus,
} from "lucide-react";
import { InviteDialog } from "~/components/invite-dialog";
import { BrandMark, BrandWordmark } from "~/components/brand";
import { createClient } from "~/lib/firebase/client";
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
  const [inviteOpen, setInviteOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [fetchedUsername, setFetchedUsername] = useState<string | null>(null);
  const username =
    !user ? null : (fetchedUsername ?? (user.user_metadata?.username as string) ?? null);
  const { toggleCollapsed, toggleMobile } = useSidebar();

  useEffect(() => {
    if (!user?.id) return;
    let isMounted = true;
    const db = createClient();
    void db
      .from("users")
      .select("username")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (isMounted && data?.username) {
          setFetchedUsername(data.username);
        }
      });
    return () => {
      isMounted = false;
    };
  }, [user?.id]);

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
    <nav className="sticky top-0 z-40 h-14 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/85">
      <div className="flex h-full items-center justify-between gap-2 px-3 sm:gap-3 sm:px-5">
        {/* Left: Sidebar toggle + Brand */}
        <div className="flex items-center gap-1.5 sm:gap-2.5">
          {/* Mobile menu trigger */}
          <Button
            variant="ghost"
            size="icon"
            className="touch-manipulation text-muted-foreground hover:text-foreground md:hidden"
            onClick={toggleMobile}
            aria-label="Open navigation drawer"
          >
            <Menu className="h-5 w-5 shrink-0" />
          </Button>

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
            href="/"
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
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 shrink-0 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <input
              id="global-search-input"
              type="search"
              aria-label="Search matches, tournaments and players"
              autoComplete="off"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search matches, tournaments, players"
              className="h-9 w-full rounded-lg border border-border bg-card pl-9 pr-12 text-sm transition-colors placeholder:text-muted-foreground focus-visible:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
            />
            <kbd className="pointer-events-none absolute right-2 top-1/2 hidden -translate-y-1/2 select-none rounded border border-border bg-muted px-1.5 py-0.5 font-sans text-2xs font-medium text-muted-foreground sm:inline-block">
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

          {/* Quick Create Dropdown (Auth only) */}
          {user && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  size="sm"
                  className="h-8 px-2 text-xs font-semibold sm:gap-1 sm:px-3"
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
                  <Link href="/dashboard">Dashboard</Link>
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
                className="h-8 px-2 text-xs sm:px-3"
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
