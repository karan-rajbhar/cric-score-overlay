import Link from "next/link";
import { createServerClient } from "~/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Trophy, Plus } from "lucide-react";
import { EmptyState } from "~/components/ui/empty-state";
import { formatStatus, formatTournamentFormat } from "~/lib/cricket";

export const dynamic = "force-dynamic";

export default async function TournamentsPage() {
  const supabase = await createServerClient();
  const { data: tournaments } = await supabase
    .from("tournaments")
    .select(
      "id, name, description, status, tournament_format, start_date, end_date, venue",
    )
    .order("start_date", { ascending: false });

  return (
    <div className="container mx-auto max-w-5xl px-3 py-4 sm:px-4 sm:py-8">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-xl font-bold tracking-tight sm:text-2xl">
          Tournaments
        </h1>
        <Button asChild size="sm" className="w-full sm:w-auto">
          <Link href="/tournaments/create">
            <Plus className="mr-1.5 h-4 w-4" />
            New tournament
          </Link>
        </Button>
      </div>

      {(tournaments ?? []).length === 0 ? (
        <EmptyState
          icon={Trophy}
          title="No tournaments hosted yet"
          description="Create a tournament to schedule matches, generate automatic fixtures, and maintain live automated standings points tables."
          primaryAction={{
            label: "Create tournament",
            href: "/tournaments/create",
            icon: Plus,
          }}
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {(tournaments ?? []).map((t) => (
            <Link key={t.id} href={`/tournaments/${t.id}`}>
              <Card className="transition-colors hover:border-primary/40">
                <CardHeader>
                  <CardTitle className="flex items-center justify-between gap-2">
                    <span className="truncate">{t.name}</span>
                    <Badge variant="outline" className="shrink-0">
                      {formatStatus(t.status)}
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm text-muted-foreground">
                  <div className="flex items-center gap-1.5">
                    <Trophy className="h-4 w-4 text-amber-500" />
                    <span>
                      {formatTournamentFormat(t.tournament_format)}
                      {t.venue ? `, ${t.venue}` : ""}
                    </span>
                  </div>
                  {t.description && (
                    <p className="line-clamp-2 text-foreground/80">
                      {t.description}
                    </p>
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
