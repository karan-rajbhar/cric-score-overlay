"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { MatchCard } from "~/components/matches/match-card";
import { getMatches } from "./queries";
import { Plus, Search, Loader2 } from "lucide-react";
import { useAuth } from "~/lib/auth";
import { cn } from "~/lib/utils";
import type { Match } from "~/lib/match-types";




const statusOptions = [
    { value: "all", label: "All" },
    { value: "live", label: "Live" },
    { value: "scheduled", label: "Scheduled" },
    { value: "completed", label: "Results" },
] as const;

export default function MatchesPage() {
    const { user, loading: authLoading } = useAuth();
    const [matches, setMatches] = useState<Match[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [statusFilter, setStatusFilter] = useState<string>("all");
    const [searchQuery, setSearchQuery] = useState("");

    useEffect(() => {
        let cancelled = false;

        const fetchMatches = async () => {
            setLoading(true);
            const filters: { status?: string } = {};
            if (statusFilter !== "all") {
                filters.status = statusFilter;
            }

            const result = await getMatches(filters);
            if (cancelled) return;
            if (result.error) {
                setError(result.error);
            } else {
                setMatches((result.data ?? []) as unknown as Match[]);
            }
            setLoading(false);
        };

        void fetchMatches();
        return () => {
            cancelled = true;
        };
    }, [statusFilter]);

    const filteredMatches = matches.filter((match) => {
        if (!searchQuery) return true;
        const query = searchQuery.toLowerCase();
        return (
            match.title.toLowerCase().includes(query) ||
            match.team1?.name.toLowerCase().includes(query) ||
            match.team2?.name.toLowerCase().includes(query) ||
            match.venue?.toLowerCase().includes(query)
        );
    });

    // Group by status for sectioned display.
    const liveMatches = filteredMatches.filter((m) => m.status === "live");
    const scheduledMatches = filteredMatches.filter((m) => m.status === "scheduled");
    const completedMatches = filteredMatches.filter((m) => m.status === "completed");
    const otherMatches = filteredMatches.filter(
        (m) => !["live", "scheduled", "completed"].includes(m.status)
    );

    if (authLoading) {
        return (
            <div className="flex min-h-[60vh] items-center justify-center">
                <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" />
            </div>
        );
    }

    const renderSection = (title: string, items: Match[], live = false) =>
        items.length > 0 && (
            <section className="space-y-4">
                <h2
                    className={cn(
                        "text-sm font-semibold uppercase tracking-wider",
                        live ? "text-red-500 dark:text-red-400" : "text-muted-foreground"
                    )}
                >
                    {title}
                </h2>
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {items.map((match) => (
                        <MatchCard
                            key={match.id}
                            match={match}
                            canScore={
                                !!user &&
                                (match.created_by === user.id ||
                                    (match.match_admins ?? []).includes(user.id))
                            }
                        />
                    ))}
                </div>
            </section>
        );

    return (
        <div>
            {/* Header + filters */}
            <div className="border-b border-border bg-card">
                <div className="container mx-auto px-4 py-5">
                    <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
                        <div>
                            <h1 className="text-xl font-bold tracking-tight">Matches</h1>
                            <p className="text-sm text-muted-foreground">
                                Live scores, fixtures and results
                            </p>
                        </div>
                        {user && (
                            <Button asChild size="sm">
                                <Link href="/matches/create">
                                    <Plus className="mr-1.5 h-4 w-4" />
                                    New match
                                </Link>
                            </Button>
                        )}
                    </div>

                    <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
                        <div className="relative flex-1 sm:max-w-xs">
                            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                            <Input
                                placeholder="Search teams or venues…"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pl-9"
                            />
                        </div>
                        <div className="flex gap-1 rounded-lg border border-border p-1">
                            {statusOptions.map((option) => (
                                <button
                                    key={option.value}
                                    type="button"
                                    onClick={() => setStatusFilter(option.value)}
                                    className={cn(
                                        "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                                        statusFilter === option.value
                                            ? "bg-primary text-primary-foreground"
                                            : "text-muted-foreground hover:text-foreground"
                                    )}
                                >
                                    {option.label}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="container mx-auto space-y-10 py-8">
                {loading ? (
                    <div className="flex items-center justify-center py-20">
                        <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" />
                    </div>
                ) : error ? (
                    <Card className="mx-auto max-w-md">
                        <CardContent className="p-6 text-center">
                            <p className="mb-4 text-destructive">{error}</p>
                            <Button onClick={() => setStatusFilter(statusFilter)}>Try again</Button>
                        </CardContent>
                    </Card>
                ) : filteredMatches.length === 0 ? (
                    <Card className="mx-auto max-w-md">
                        <CardContent className="p-10 text-center">
                            <h3 className="font-semibold">No matches found</h3>
                            <p className="mt-1 text-sm text-muted-foreground">
                                {user
                                    ? "Create your first match to get started."
                                    : "Sign in to create a new match."}
                            </p>
                            {user && (
                                <Button asChild className="mt-4" size="sm">
                                    <Link href="/matches/create">
                                        <Plus className="mr-1.5 h-4 w-4" />
                                        New match
                                    </Link>
                                </Button>
                            )}
                        </CardContent>
                    </Card>
                ) : (
                    <>
                        {renderSection("Live now", liveMatches, true)}
                        {renderSection("Upcoming", scheduledMatches)}
                        {renderSection("Recent results", completedMatches)}
                        {renderSection("Other", otherMatches)}
                    </>
                )}
            </div>
        </div>
    );
}
