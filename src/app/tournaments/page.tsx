import Link from "next/link";
import { createServerClient } from "~/lib/firebase/server";
import { TournamentCard } from "~/components/tournaments/tournament-card";
import { PageContainer, PageHeader } from "~/components/layout/page";
import { Button } from "~/components/ui/button";
import { Trophy, Plus } from "lucide-react";
import { EmptyState } from "~/components/ui/empty-state";

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
            <TournamentCard
              key={t.id}
              href={`/tournaments/${t.id}`}
              tournament={t}
            />
          ))}
        </div>
      )}
    </PageContainer>
  );
}
