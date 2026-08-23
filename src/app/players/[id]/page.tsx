import Link from "next/link";
import { notFound } from "next/navigation";
import { createServerClient } from "~/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { ChevronLeft } from "lucide-react";

export const dynamic = "force-dynamic";

function Stat({ label, value }: { label: string; value: string | number }) {
    return (
        <div className="rounded-lg border bg-card p-3 text-center">
            <div className="text-2xl font-bold">{value}</div>
            <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
        </div>
    );
}

export default async function PlayerPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const supabase = await createServerClient();

    const [{ data: user }, { data: stats }] = await Promise.all([
        supabase.from("users").select("id, full_name, avatar_url, email").eq("id", id).single(),
        supabase.from("player_career_stats").select("*").eq("user_id", id).single(),
    ]);

    if (!user) notFound();

    // Recent performances (last 5 innings appearances)
    const { data: recentBatting } = await supabase
        .from("batting_performances")
        .select("runs_scored, balls_faced, is_out, match_id, innings_id")
        .eq("user_id", id)
        .order("created_at", { ascending: false })
        .limit(5);

    return (
        <div className="container mx-auto max-w-4xl px-4 py-8">
            <Button variant="ghost" size="sm" asChild className="mb-6">
                <Link href="/teams">
                    <ChevronLeft className="mr-1 h-4 w-4" />
                    Back
                </Link>
            </Button>

            <div className="flex items-center gap-4">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/15 text-xl font-bold text-primary">
                    {user.full_name.slice(0, 2).toUpperCase()}
                </div>
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">{user.full_name}</h1>
                    <p className="text-sm text-muted-foreground">{user.email ?? "—"}</p>
                </div>
            </div>

            {!stats ? (
                <Card className="mt-8">
                    <CardContent className="py-8 text-center text-sm text-muted-foreground">
                        No career stats yet — play a match to generate them.
                    </CardContent>
                </Card>
            ) : (
                <>
                    <div className="mt-8 grid gap-6 md:grid-cols-3">
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-base">Batting</CardTitle>
                            </CardHeader>
                            <CardContent className="grid grid-cols-2 gap-3">
                                <Stat label="Matches" value={stats.total_matches} />
                                <Stat label="Runs" value={stats.total_runs} />
                                <Stat label="Avg" value={stats.batting_average ?? "—"} />
                                <Stat label="SR" value={stats.strike_rate ?? "—"} />
                                <Stat label="50s" value={stats.half_centuries} />
                                <Stat label="100s" value={stats.centuries} />
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle className="text-base">Bowling</CardTitle>
                            </CardHeader>
                            <CardContent className="grid grid-cols-2 gap-3">
                                <Stat label="Wkts" value={stats.total_wickets} />
                                <Stat label="Avg" value={stats.bowling_average ?? "—"} />
                                <Stat label="Econ" value={stats.economy_rate ?? "—"} />
                                <Stat label="5w" value={stats.five_wicket_hauls} />
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle className="text-base">Fielding</CardTitle>
                            </CardHeader>
                            <CardContent className="grid grid-cols-3 gap-3">
                                <Stat label="Catches" value={stats.total_catches} />
                                <Stat label="Stumpings" value={stats.total_stumpings} />
                                <Stat label="Run outs" value={stats.total_run_outs} />
                            </CardContent>
                        </Card>
                    </div>

                    <Card className="mt-6">
                        <CardHeader>
                            <CardTitle className="text-base">Recent innings</CardTitle>
                        </CardHeader>
                        <CardContent>
                            {(recentBatting ?? []).length === 0 ? (
                                <p className="text-sm text-muted-foreground">No recent batting data.</p>
                            ) : (
                                <div className="flex gap-2">
                                    {recentBatting!.map((r, i) => (
                                        <Badge
                                            key={i}
                                            variant={r.is_out ? "secondary" : "outline"}
                                            className="tabular"
                                        >
                                            {r.runs_scored}
                                            {!r.is_out && "*"} ({r.balls_faced})
                                        </Badge>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </>
            )}
        </div>
    );
}
