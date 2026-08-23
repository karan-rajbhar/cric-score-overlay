import Link from "next/link";
import { notFound } from "next/navigation";
import { createServerClient } from "~/lib/supabase/server";
import { Card, CardContent } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";

export const dynamic = "force-dynamic";

interface TeamRow {
    id: string;
    name: string;
    short_name: string | null;
    team_type: string | null;
    team_players: { count: number }[];
}

export default async function ClubPage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id } = await params;
    const supabase = await createServerClient();

    const [{ data: club }, { data: teams }] = await Promise.all([
        supabase.from("clubs").select("*").eq("id", id).single(),
        supabase
            .from("teams")
            .select("id, name, short_name, team_type, team_players(count)")
            .eq("club_id", id)
            .order("name"),
    ]);

    if (!club) notFound();

    return (
        <div className="container mx-auto max-w-5xl px-4 py-10">
            <Link
                href="/clubs"
                className="text-sm text-muted-foreground hover:text-foreground"
            >
                ← All clubs
            </Link>

            <header className="mb-8 mt-4">
                <h1 className="text-2xl font-bold tracking-tight">{club.name}</h1>
                <p className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
                    {club.location && <span>{club.location}</span>}
                    {club.club_type && (
                        <Badge variant="outline" className="capitalize">
                            {club.club_type}
                        </Badge>
                    )}
                </p>
            </header>

            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                Teams
            </h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {(teams as TeamRow[] | null)?.map((team) => (
                    <Link key={team.id} href={`/teams/${team.id}`} className="group">
                        <Card className="transition-colors group-hover:border-primary/50">
                            <CardContent className="p-5">
                                <h3 className="font-semibold">{team.name}</h3>
                                <p className="mt-1 text-xs text-muted-foreground capitalize">
                                    {team.team_type} · {team.team_players?.[0]?.count ?? 0} players
                                </p>
                            </CardContent>
                        </Card>
                    </Link>
                ))}
                {!teams?.length && (
                    <p className="text-sm text-muted-foreground">No teams in this club yet.</p>
                )}
            </div>
        </div>
    );
}
