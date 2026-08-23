"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "~/lib/auth";
import { Button } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/card";
import { MatchCard } from "~/components/matches/match-card";
import { getMatches } from "~/app/matches/queries";
import { Plus, Radio, Tv, Loader2, Trophy } from "lucide-react";
import type { Match } from "~/lib/match-types";




export default function Dashboard() {
    const { user } = useAuth();
    const [liveMatches, setLiveMatches] = useState<Match[]>([]);
    const [recentMatches, setRecentMatches] = useState<Match[]>([]);
    const [loading, setLoading] = useState(true);

    const canScoreMatch = (match: Match) =>
        !!user &&
        (match.created_by === user.id || (match.match_admins ?? []).includes(user.id));

    useEffect(() => {
        let cancelled = false;

        const load = async () => {
            setLoading(true);
            const [liveResult, recentResult] = await Promise.all([
                getMatches({ status: "live" }),
                getMatches({ status: "completed", limit: 6 }),
            ]);
            if (cancelled) return;
            setLiveMatches((liveResult.data ?? []) as unknown as Match[]);
            setRecentMatches((recentResult.data ?? []) as unknown as Match[]);
            setLoading(false);
        };

        void load();
        return () => {
            cancelled = true;
        };
    }, []);

    return (
        <div className="container mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
            {/* Greeting */}
            <header className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                <div>
                    <h1 className="text-xl font-bold tracking-tight">
                        {user?.user_metadata?.full_name
                            ? `Welcome back, ${user.user_metadata.full_name.split(" ")[0]}`
                            : "Dashboard"}
                    </h1>
                    <p className="text-sm text-muted-foreground">
                        Your matches at a glance.
                    </p>
                </div>
                <div className="flex gap-2">
                    <Button asChild size="sm" variant="outline">
                        <Link href="/teams">Manage teams</Link>
                    </Button>
                    <Button asChild size="sm">
                        <Link href="/matches/create">
                            <Plus className="mr-1.5 h-4 w-4" />
                            New match
                        </Link>
                    </Button>
                </div>
            </header>

            {/* Quick links */}
            <div className="mb-10 grid gap-4 sm:grid-cols-3">
                {[
                    {
                        href: "/matches",
                        icon: Radio,
                        title: "Matches",
                        description: "Follow live games and results",
                    },
                    {
                        href: "/clubs",
                        icon: Trophy,
                        title: "Clubs",
                        description: "Clubs, squads and players",
                    },
                    {
                        href: "/overlay/test",
                        icon: Tv,
                        title: "Overlay preview",
                        description: "Test the OBS scoreboard",
                    },
                ].map(({ href, icon: Icon, title, description }) => (
                    <Link key={href} href={href}>
                        <Card className="transition-colors hover:border-primary/50">
                            <CardContent className="flex items-center gap-4 p-5">
                                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-border bg-secondary/50">
                                    <Icon className="h-5 w-5 text-primary" />
                                </span>
                                <div>
                                    <p className="font-medium">{title}</p>
                                    <p className="text-sm text-muted-foreground">{description}</p>
                                </div>
                            </CardContent>
                        </Card>
                    </Link>
                ))}
            </div>

            {/* Live matches */}
            <section className="mb-10">
                <h2 className="section-heading mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                    Live now
                </h2>
                {loading ? (
                    <div className="flex justify-center py-10">
                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                ) : liveMatches.length > 0 ? (
                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                        {liveMatches.map((match) => (
                            <MatchCard
                                key={match.id}
                                match={match as never}
                                canScore={canScoreMatch(match)}
                            />
                        ))}
                    </div>
                ) : (
                    <p className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
                        No live matches right now.{" "}
                        <Link href="/matches/create" className="text-primary hover:underline">
                            Start one
                        </Link>{" "}
                        and it will appear here in real time.
                    </p>
                )}
            </section>

            {/* Recent results */}
            <section>
                <h2 className="section-heading mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                    Recent results
                </h2>
                {!loading && recentMatches.length > 0 ? (
                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                        {recentMatches.map((match) => (
                            <MatchCard
                                key={match.id}
                                match={match as never}
                                canScore={false}
                            />
                        ))}
                    </div>
                ) : (
                    !loading && (
                        <p className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
                            Completed matches will show up here.
                        </p>
                    )
                )}
            </section>
        </div>
    );
}
