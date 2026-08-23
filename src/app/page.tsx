"use client";

import Link from "next/link";
import { useAuth } from "~/lib/auth";
import { Button } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Radio, Trophy, Tv } from "lucide-react";

const FEATURES = [
    {
        icon: Radio,
        title: "Live scoring",
        description:
            "Ball-by-ball scoring that keeps every projection in sync — strike rotation, partnerships, fall of wickets and run rates update atomically.",
    },
    {
        icon: Trophy,
        title: "Clubs & teams",
        description:
            "Organize clubs, squads and tournaments. Full scorecards, player figures and results are stored match by match.",
    },
    {
        icon: Tv,
        title: "Broadcast overlay",
        description:
            "A transparent browser-source overlay for OBS with realtime updates, a polling fallback and connection status built in.",
    },
] as const;

export default function HomePage() {
    const { user } = useAuth();

    return (
        <div>
            {/* Hero */}
            <section className="border-b border-border bg-card">
                <div className="container mx-auto max-w-7xl px-4 py-20 text-center sm:px-6 lg:px-8">
                    <Badge variant="outline" className="mb-5 font-medium">
                        Live scoring · Clubs · OBS overlay
                    </Badge>
                    <h1 className="mx-auto max-w-3xl text-balance text-4xl font-bold tracking-tight sm:text-5xl">
                                                Score cricket matches like a{" "}
                        <span className="text-primary">broadcast</span> production
                    </h1>
                    <p className="mx-auto mt-4 max-w-2xl text-pretty text-lg text-muted-foreground">
                        Ball-by-ball scoring, automatic scorecards and a real-time overlay
                        for your stream — built for clubs, schools and community leagues.
                    </p>
                    <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
                        {user ? (
                            <>
                                <Button asChild size="lg">
                                    <Link href="/matches/create">Start a match</Link>
                                </Button>
                                <Button asChild size="lg" variant="outline">
                                    <Link href="/dashboard">Go to dashboard</Link>
                                </Button>
                            </>
                        ) : (
                            <>
                                <Button asChild size="lg">
                                    <Link href="/auth/signup">Create free account</Link>
                                </Button>
                                <Button asChild size="lg" variant="outline">
                                    <Link href="/matches">Browse matches</Link>
                                </Button>
                            </>
                        )}
                    </div>
                </div>
            </section>

            {/* Features */}
            <section className="border-y border-border bg-card">
                <div className="container mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
                    <h2 className="section-heading mb-8 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                      Platform
                    </h2>
                    <div className="grid gap-6 md:grid-cols-3">
                        {FEATURES.map(({ icon: Icon, title, description }) => (
                            <Card key={title}>
                                <CardContent className="p-6">
                                    <span className="flex h-10 w-10 items-center justify-center rounded-md border border-border bg-background">
                                        <Icon className="h-5 w-5 text-primary" />
                                    </span>
                                    <h3 className="mt-4 font-semibold">{title}</h3>
                                    <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                                        {description}
                                    </p>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                </div>
            </section>

            {/* How it works */}
            <section className="container mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
                <h2 className="section-heading mb-8 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                    Get started in minutes
                </h2>
                <div className="grid gap-6 md:grid-cols-2">
                    {[
                        {
                            title: "For scorers",
                            steps: [
                                "Create a match and pick the two teams",
                                "Record the toss and pick opening batters",
                                "Tap runs, extras and wickets ball by ball",
                                "Share the match link — scores update live",
                            ],
                        },
                        {
                            title: "For streamers",
                            steps: [
                                "Open the overlay link for your match",
                                "Add it as a Browser Source in OBS (1920×1080)",
                                "Enable 'Shutdown source when not visible' if desired",
                                "The scoreboard stays live via realtime + fallback polling",
                            ],
                        },
                    ].map((column) => (
                        <Card key={column.title}>
                            <CardContent className="p-6">
                                <h3 className="font-semibold">{column.title}</h3>
                                <ol className="mt-4 space-y-3">
                                    {column.steps.map((step, index) => (
                                        <li key={index} className="flex items-start gap-3 text-sm">
                                            <span className="score-display flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-border bg-secondary text-xs font-semibold">
                                                {index + 1}
                                            </span>
                                            <span className="pt-0.5 text-muted-foreground">{step}</span>
                                        </li>
                                    ))}
                                </ol>
                            </CardContent>
                        </Card>
                    ))}
                </div>

                <div className="mt-10 text-center">
                    <Button asChild size="lg">
                        <Link href={user ? "/matches/create" : "/auth/signup"}>
                            {user ? "Create a match" : "Start scoring free"}
                        </Link>
                    </Button>
                </div>
            </section>
        </div>
    );
}
