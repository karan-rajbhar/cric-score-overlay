"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useAuth } from "~/lib/auth";
import { Button } from "~/components/ui/button";
import { ThemeToggle } from "~/components/ui/theme-toggle";
import { LayoutDashboard, Activity, Users, LogOut, Menu } from "lucide-react";
import { BrandMark, BrandWordmark } from "~/components/brand";
import { cn } from "~/lib/utils";

const NAV_ITEMS = [
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/matches", label: "Matches", icon: Activity },
    { href: "/clubs", label: "Clubs", icon: Users },
] as const;

export function NavigationBar() {
    const { user, signOut, loading } = useAuth();
    const pathname = usePathname();
    const [signOutLoading, setSignOutLoading] = useState(false);
    const [mobileOpen, setMobileOpen] = useState(false);

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

    const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

    return (
        <nav className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/85">
            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
                <div className="flex h-14 items-center justify-between gap-4">
                    {/* Brand */}
                    <Link href="/" className="flex shrink-0 items-center gap-2.5">
                        <BrandMark />
                        <BrandWordmark />
                    </Link>

                    {/* Desktop nav */}
                    {user && !loading && (
                        <div className="hidden items-center gap-1 md:flex">
                            {NAV_ITEMS.map(({ href, label, icon: Icon }) => (
                                <Link
                                    key={href}
                                    href={href}
                                    className={cn(
                                        "flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                                        isActive(href)
                                            ? "bg-secondary text-foreground"
                                            : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
                                    )}
                                >
                                    <Icon className="h-4 w-4" />
                                    {label}
                                </Link>
                            ))}
                        </div>
                    )}

                    <div className="flex items-center gap-2">
                        <ThemeToggle />
                        {!loading && user && (
                            <>
                                <span className="hidden max-w-[160px] truncate rounded-md border border-border px-2.5 py-1 text-xs font-medium text-muted-foreground sm:block">
                                    {user.user_metadata?.full_name || user.email?.split("@")[0]}
                                </span>
                                <Button
                                    onClick={handleSignOut}
                                    disabled={signOutLoading}
                                    variant="ghost"
                                    size="sm"
                                    className="text-muted-foreground hover:text-destructive"
                                >
                                    <LogOut className="h-4 w-4" />
                                    <span className="hidden sm:inline">Sign out</span>
                                </Button>
                            </>
                        )}
                        {!loading && !user && (
                            <>
                                <Button asChild variant="ghost" size="sm">
                                    <Link href="/auth/login">Sign in</Link>
                                </Button>
                                <Button asChild size="sm">
                                    <Link href="/auth/signup">Get started</Link>
                                </Button>
                            </>
                        )}
                        {user && (
                            <Button
                                variant="ghost"
                                size="sm"
                                className="md:hidden"
                                onClick={() => setMobileOpen((v) => !v)}
                                aria-label="Toggle navigation"
                            >
                                <Menu className="h-5 w-5" />
                            </Button>
                        )}
                    </div>
                </div>
            </div>

            {/* Mobile nav */}
            {user && mobileOpen && (
                <div className="border-t border-border md:hidden">
                    <div className="space-y-1 px-4 py-3">
                        {NAV_ITEMS.map(({ href, label, icon: Icon }) => (
                            <Link
                                key={href}
                                href={href}
                                onClick={() => setMobileOpen(false)}
                                className={cn(
                                    "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium",
                                    isActive(href)
                                        ? "bg-secondary text-foreground"
                                        : "text-muted-foreground hover:bg-secondary/60"
                                )}
                            >
                                <Icon className="h-4 w-4" />
                                {label}
                            </Link>
                        ))}
                    </div>
                </div>
            )}
        </nav>
    );
}
