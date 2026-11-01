import Link from "next/link";
import { createServerClient } from "~/lib/firebase/server";
import { TournamentCard } from "~/components/tournaments/tournament-card";
import { PageContainer, PageHeader } from "~/components/layout/page";
import { Pager } from "~/components/layout/pager";
import { keysetPage, PAGE_SIZE, parseCursor } from "~/lib/keyset";
import { Button } from "~/components/ui/button";
import { Trophy, Plus } from "lucide-react";
import { EmptyState } from "~/components/ui/empty-state";

export const metadata = { title: "Tournaments" };

export const dynamic = "force-dynamic";

export default async function TournamentsPage({
  searchParams,
}: {
  searchParams?: Promise<{ after?: string }>;
}) {
  const { after } = (await searchParams) ?? {};
  const db = await createServerClient();
  // Latest start first, a page at a time (keyset: at most 31 reads, no
  // scan); tournaments without a start date come last.
  const cursor = parseCursor(after);
  const { data } = await db
    .from("tournaments")
    .select(
      "id, name, description, status, tournament_format, start_date, end_date, venue",
    )
    .order("start_date", { ascending: false })
    .keyset(cursor && { value: cursor.value || null, id: cursor.id })
    .limit(PAGE_SIZE + 1);
  const { rows: tournaments, next } = keysetPage(
    data ?? [],
    (t) => t.start_date ?? "",
  );

  return (
    <PageContainer>
      <PageHeader
        search
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

      {tournaments.length === 0 ? (
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
          {tournaments.map((t) => (
            <TournamentCard
              key={t.id}
              href={`/tournaments/${t.id}`}
              tournament={t}
            />
          ))}
        </div>
      )}
      <Pager
        label="Tournaments pages"
        firstHref={after ? "/tournaments" : null}
        nextHref={
          next ? `/tournaments?${new URLSearchParams({ after: next })}` : null
        }
      />
    </PageContainer>
  );
}
