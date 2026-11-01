import Link from "next/link";
import { prefixSearch } from "~/lib/firebase/search";
import { createServerClient } from "~/lib/firebase/server";
import { TournamentCard } from "~/components/tournaments/tournament-card";
import { ListSearch } from "~/components/layout/list-search";
import { PageContainer, PageHeader } from "~/components/layout/page";
import { Pager } from "~/components/layout/pager";
import { keysetPage, PAGE_SIZE, parseCursor } from "~/lib/keyset";
import { Button } from "~/components/ui/button";
import { Trophy, Plus } from "lucide-react";
import { EmptyState } from "~/components/ui/empty-state";

export const metadata = { title: "Tournaments" };

export const dynamic = "force-dynamic";

const COLUMNS =
  "id, name, description, status, tournament_format, start_date, end_date, venue";

type TournamentRow = React.ComponentProps<typeof TournamentCard>["tournament"] & {
  id: string;
};

export default async function TournamentsPage({
  searchParams,
}: {
  searchParams?: Promise<{ after?: string; search?: string }>;
}) {
  const { after, search } = (await searchParams) ?? {};
  const query = search?.trim() ?? "";
  const searching = query.length >= 2;
  const db = await createServerClient();

  let tournaments: TournamentRow[];
  let next: string | null = null;
  if (searching) {
    // Indexed: at most a page of reads.
    const { data } = await prefixSearch(
      db,
      "tournaments",
      query,
      COLUMNS,
      PAGE_SIZE,
    );
    tournaments = data as unknown as TournamentRow[];
  } else {
    // Latest start first, a page at a time (keyset: at most 31 reads, no
    // scan); tournaments without a start date come last.
    const cursor = parseCursor(after);
    const { data } = await db
      .from("tournaments")
      .select(COLUMNS)
      .order("start_date", { ascending: false })
      .keyset(cursor && { value: cursor.value || null, id: cursor.id })
      .limit(PAGE_SIZE + 1);
    const page = keysetPage(
      (data ?? []) as unknown as (TournamentRow & { start_date?: string | null })[],
      (t) => t.start_date ?? "",
    );
    tournaments = page.rows;
    next = page.next;
  }

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

      <ListSearch
        action="/tournaments"
        value={query}
        label="Search tournaments"
        placeholder="Search tournaments…"
      />

      {tournaments.length === 0 && searching ? (
        <EmptyState
          icon={Trophy}
          title="No tournaments found"
          description={`No tournament matches “${query}”.`}
        />
      ) : tournaments.length === 0 ? (
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
