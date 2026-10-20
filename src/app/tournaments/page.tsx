import Link from "next/link";
import { createServerClient } from "~/lib/firebase/server";
import { Card, CardContent } from "~/components/ui/card";
import { StatusBadge } from "~/components/ui/status-badge";
import { PageContainer, PageHeader } from "~/components/layout/page";
import { Button } from "~/components/ui/button";
import { Trophy, Plus } from "lucide-react";
import { EmptyState } from "~/components/ui/empty-state";
import { formatTournamentFormat } from "~/lib/cricket";

export const metadata = { title: "Tournaments" };

export const dynamic = "force-dynamic";

export default async function TournamentsPage() {
  const db = await createServerClient();
  const { data: tournaments } = await db
    .from("tournaments")
    .select(
      "id, name, description, status, tournament_format, start_date, end_date, venue",
    )
    .order("start_date", { ascending: false });

  return (
    <PageContainer>
      <PageHeader
        title="Tournaments"
        description="Leagues and cups with fixtures and points tables"
        actions={
          <Button asChild size="sm">
            <Link href="/tournaments/create">
              <Plus />
              New tournament
            </Link>
          </Button>
        }
      />

      {(tournaments ?? []).length === 0 ? (
        <EmptyState
          icon={Trophy}
          title="No tournaments yet"
          description="Create a tournament to schedule fixtures and keep a points table."
          primaryAction={{
            label: "Create tournament",
            href: "/tournaments/create",
            icon: Plus,
          }}
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {(tournaments ?? []).map((t) => (
            <Link key={t.id} href={`/tournaments/${t.id}`} className="group">
              <Card className="h-full transition-colors group-hover:border-primary/40">
                <CardContent className="space-y-2 p-4 sm:p-5">
                  <div className="flex items-start justify-between gap-3">
                    <h2 className="min-w-0 truncate text-base font-semibold text-foreground">
                      {t.name}
                    </h2>
                    <StatusBadge status={t.status} className="shrink-0" />
                  </div>
                  <p className="truncate text-sm text-muted-foreground">
                    {formatTournamentFormat(t.tournament_format)}
                    {t.venue ? ` · ${t.venue}` : ""}
                  </p>
                  {t.description && (
                    <p className="line-clamp-2 text-sm text-foreground/80">
                      {t.description}
                    </p>
                  )}
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </PageContainer>
  );
}
