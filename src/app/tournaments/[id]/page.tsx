import Link from "next/link";
import { notFound } from "next/navigation";
import { createServerClient } from "~/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { ChevronLeft } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function TournamentPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const supabase = await createServerClient();

    const [{ data: tournament }, { data: standings }] = await Promise.all([
        supabase.from("tournaments").select("*").eq("id", id).single(),
        supabase
            .from("tournament_standings")
            .select("*, team:teams!tournament_standings_team_id_fkey(id, name, short_name)")
            .eq("tournament_id", id)
            .order("points", { ascending: false })
            .order("net_run_rate", { ascending: false }),
    ]);

    if (!tournament) notFound();

    return (
        <div className="container mx-auto max-w-5xl px-4 py-8">
            <Button variant="ghost" size="sm" asChild className="mb-4">
                <Link href="/tournaments">
                    <ChevronLeft className="mr-1 h-4 w-4" />
                    Tournaments
                </Link>
            </Button>

            <h1 className="text-2xl font-bold tracking-tight">{tournament.name}</h1>
            <div className="mt-1 flex items-center gap-2">
                <Badge variant="outline" className="capitalize">
                    {tournament.status}
                </Badge>
                <span className="text-sm text-muted-foreground">
                    {tournament.tournament_format} · {tournament.venue ?? "—"}
                </span>
            </div>

            <Card className="mt-6">
                <CardHeader>
                    <CardTitle>Points table</CardTitle>
                </CardHeader>
                <CardContent>
                    {(standings ?? []).length === 0 ? (
                        <p className="py-6 text-center text-sm text-muted-foreground">
                            No standings yet — teams will appear once matches are played.
                        </p>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b text-xs uppercase text-muted-foreground">
                                        <th className="py-2 text-left">Team</th>
                                        <th className="py-2 text-center">P</th>
                                        <th className="py-2 text-center">W</th>
                                        <th className="py-2 text-center">L</th>
                                        <th className="py-2 text-center">Pts</th>
                                        <th className="py-2 text-center">NRR</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {(standings ?? []).map((s) => (
                                        <tr key={s.id} className="border-b last:border-0">
                                            <td className="py-2 font-medium">
                                                {(s.team as { name: string } | null)?.name ?? s.team_id.slice(0, 8)}
                                            </td>
                                            <td className="py-2 text-center tabular">{s.matches_played}</td>
                                            <td className="py-2 text-center tabular">{s.wins}</td>
                                            <td className="py-2 text-center tabular">{s.losses}</td>
                                            <td className="py-2 text-center font-bold tabular">{s.points}</td>
                                            <td className="py-2 text-center tabular">
                                                {Number(s.net_run_rate ?? 0).toFixed(2)}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
