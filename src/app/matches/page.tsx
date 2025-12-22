"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Card, CardContent } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { MatchCard } from "~/components/matches/match-card";
import { getMatches } from "./actions";
import { Plus, Search, Filter, Loader2 } from "lucide-react";
import { useAuth } from "~/lib/auth";

interface Team {
    id: string;
    name: string;
    short_name?: string;
}

interface Innings {
    id: string;
    team_id: string;
    innings_number: number;
    total_runs: number;
    total_wickets: number;
    total_overs: number;
    is_completed: boolean;
}

interface Match {
    id: string;
    title: string;
    match_format: string;
    overs_per_innings: number;
    status: "scheduled" | "live" | "completed" | "abandoned" | "cancelled";
    venue?: string;
    scheduled_at?: string;
    result_description?: string;
    team1: Team;
    team2: Team;
    innings?: Innings[];
}

export default function MatchesPage() {
    const { user, loading: authLoading } = useAuth();
    const [matches, setMatches] = useState<Match[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [statusFilter, setStatusFilter] = useState<string>("all");
    const [searchQuery, setSearchQuery] = useState("");

    useEffect(() => {
        loadMatches();
    }, [statusFilter]);

    const loadMatches = async () => {
        setLoading(true);
        const filters: { status?: string } = {};
        if (statusFilter !== "all") {
            filters.status = statusFilter;
        }

        const result = await getMatches(filters);
        if (result.error) {
            setError(result.error);
        } else {
            setMatches(result.data ?? []);
        }
        setLoading(false);
    };

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

    // Group matches by status
    const liveMatches = filteredMatches.filter((m) => m.status === "live");
    const scheduledMatches = filteredMatches.filter((m) => m.status === "scheduled");
    const completedMatches = filteredMatches.filter((m) => m.status === "completed");
    const otherMatches = filteredMatches.filter(
        (m) => !["live", "scheduled", "completed"].includes(m.status)
    );

    const statusOptions = [
        { value: "all", label: "All Matches" },
        { value: "live", label: "Live" },
        { value: "scheduled", label: "Scheduled" },
        { value: "completed", label: "Completed" },
        { value: "abandoned", label: "Abandoned" },
    ];

    if (authLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-cricket-primary" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background">
            {/* Header */}
            <div className="border-b border-border/50 bg-card/50 backdrop-blur sticky top-16 z-10">
                <div className="container mx-auto px-4 py-4">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div>
                            <h1 className="text-2xl font-bold text-foreground">Matches</h1>
                            <p className="text-sm text-muted-foreground">
                                View and manage cricket matches
                            </p>
                        </div>
                        {user && (
                            <Button asChild className="bg-cricket-primary hover:bg-cricket-primary/90">
                                <Link href="/matches/create">
                                    <Plus className="h-4 w-4 mr-2" />
                                    Create Match
                                </Link>
                            </Button>
                        )}
                    </div>

                    {/* Filters */}
                    <div className="flex flex-col md:flex-row gap-3 mt-4">
                        <div className="relative flex-1 max-w-md">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Search teams, venues..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pl-9"
                            />
                        </div>
                        <div className="flex gap-2 flex-wrap">
                            {statusOptions.map((option) => (
                                <Button
                                    key={option.value}
                                    variant={statusFilter === option.value ? "default" : "outline"}
                                    size="sm"
                                    onClick={() => setStatusFilter(option.value)}
                                    className={
                                        statusFilter === option.value
                                            ? "bg-cricket-primary hover:bg-cricket-primary/90"
                                            : ""
                                    }
                                >
                                    {option.label}
                                </Button>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="container mx-auto px-4 py-8">
                {loading ? (
                    <div className="flex items-center justify-center py-20">
                        <Loader2 className="h-8 w-8 animate-spin text-cricket-primary" />
                    </div>
                ) : error ? (
                    <Card className="max-w-md mx-auto">
                        <CardContent className="p-6 text-center">
                            <p className="text-red-500 mb-4">{error}</p>
                            <Button onClick={loadMatches}>Try Again</Button>
                        </CardContent>
                    </Card>
                ) : filteredMatches.length === 0 ? (
                    <Card className="max-w-md mx-auto">
                        <CardContent className="p-6 text-center">
                            <div className="text-4xl mb-4">🏏</div>
                            <h3 className="text-lg font-semibold mb-2">No matches found</h3>
                            <p className="text-muted-foreground mb-4">
                                {user
                                    ? "Create your first match to get started!"
                                    : "Sign in to create a new match."}
                            </p>
                            {user && (
                                <Button asChild>
                                    <Link href="/matches/create">
                                        <Plus className="h-4 w-4 mr-2" />
                                        Create Match
                                    </Link>
                                </Button>
                            )}
                        </CardContent>
                    </Card>
                ) : (
                    <div className="space-y-8">
                        {/* Live Matches */}
                        {liveMatches.length > 0 && (
                            <section>
                                <div className="flex items-center gap-2 mb-4">
                                    <Badge className="bg-red-500/10 text-red-500 border-red-500/20 animate-pulse">
                                        🔴 LIVE
                                    </Badge>
                                    <h2 className="text-lg font-semibold">Live Matches</h2>
                                </div>
                                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {liveMatches.map((match) => (
                                        <MatchCard key={match.id} match={match} />
                                    ))}
                                </div>
                            </section>
                        )}

                        {/* Scheduled Matches */}
                        {scheduledMatches.length > 0 && (
                            <section>
                                <div className="flex items-center gap-2 mb-4">
                                    <Badge className="bg-blue-500/10 text-blue-500 border-blue-500/20">
                                        ⏰ Upcoming
                                    </Badge>
                                    <h2 className="text-lg font-semibold">Scheduled Matches</h2>
                                </div>
                                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {scheduledMatches.map((match) => (
                                        <MatchCard key={match.id} match={match} />
                                    ))}
                                </div>
                            </section>
                        )}

                        {/* Completed Matches */}
                        {completedMatches.length > 0 && (
                            <section>
                                <div className="flex items-center gap-2 mb-4">
                                    <Badge className="bg-green-500/10 text-green-500 border-green-500/20">
                                        ✓ Completed
                                    </Badge>
                                    <h2 className="text-lg font-semibold">Recent Results</h2>
                                </div>
                                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {completedMatches.map((match) => (
                                        <MatchCard key={match.id} match={match} />
                                    ))}
                                </div>
                            </section>
                        )}

                        {/* Other Matches */}
                        {otherMatches.length > 0 && (
                            <section>
                                <div className="flex items-center gap-2 mb-4">
                                    <h2 className="text-lg font-semibold">Other Matches</h2>
                                </div>
                                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {otherMatches.map((match) => (
                                        <MatchCard key={match.id} match={match} />
                                    ))}
                                </div>
                            </section>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
