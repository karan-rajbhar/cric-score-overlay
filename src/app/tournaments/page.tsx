import Link from "next/link";
import { createServerClient } from "~/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Trophy, Plus } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function TournamentsPage() {
    const supabase = await createServerClient();
    const { data: tournaments } = await supabase
        .from("tournaments")
        .select("id, name, description, status, tournament_format, start_date, end_date, venue")
        .order("start_date", { ascending: false });

    return (
        <div className="container mx-auto max-w-5xl px-4 py-8">
            <div className="mb-6 flex items-center justify-between">
                <h1 className="text-2xl font-bold tracking-tight">Tournaments</h1>
                <Button asChild size="sm">
                    <Link href="/tournaments/create">
                        <Plus className="mr-1.5 h-4 w-4" />
                        New tournament
                    </Link>
                </Button>
            </div>

            {(tournaments ?? []).length === 0 ? (
                <Card>
                    <CardContent className="py-12 text-center text-sm text-muted-foreground">
                        No tournaments yet.
                    </CardContent>
                </Card>
            ) : (
                <div className="grid gap-4 md:grid-cols-2">
                    {(tournaments ?? []).map((t) => (
                        <Link key={t.id} href={`/tournaments/${t.id}`}>
                            <Card className="transition-colors hover:border-primary/40">
                                <CardHeader>
                                    <CardTitle className="flex items-center justify-between">
                                        <span>{t.name}</span>
                                        <Badge variant="outline" className="capitalize">
                                            {t.status}
                                        </Badge>
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-2 text-sm text-muted-foreground">
                                    <div className="flex items-center gap-1">
                                        <Trophy className="h-4 w-4" />
                                        {t.tournament_format} {t.venue ? `· ${t.venue}` : ""}
                                    </div>
                                    {t.description && (
                                        <p className="line-clamp-2 text-foreground/80">{t.description}</p>
                                    )}
                                </CardContent>
                            </Card>
                        </Link>
                    ))}
                </div>
            )}
        </div>
    );
}
