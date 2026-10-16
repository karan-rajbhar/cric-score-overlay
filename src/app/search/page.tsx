import Link from "next/link";
import { globalSearch } from "./actions";
import { Input } from "~/components/ui/input";
import { StatusBadge } from "~/components/ui/status-badge";
import { Initials } from "~/components/ui/initials";
import { PageContainer, PageHeader, SectionHeader } from "~/components/layout/page";
import { Search } from "lucide-react";
import { EmptyState } from "~/components/ui/empty-state";

export const dynamic = "force-dynamic";

function Section<T>({
  title,
  items,
  render,
}: {
  title: string;
  items: T[];
  render: (item: T) => React.ReactNode;
}) {
  if (items.length === 0) return null;
  return (
    <section className="space-y-3">
      <SectionHeader title={title} count={items.length} />
      <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
        {items.map((item, i) => (
          <li key={i}>{render(item)}</li>
        ))}
      </ul>
    </section>
  );
}

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q = "" } = await searchParams;
  const result = q.trim().length >= 2 ? await globalSearch(q) : null;

  const hasResults =
    result &&
    (result.matches.length > 0 ||
      result.teams.length > 0 ||
      result.players.length > 0 ||
      result.clubs.length > 0 ||
      result.tournaments.length > 0);

  return (
    <PageContainer size="narrow">
      <PageHeader
        title="Search"
        description="Teams, matches, players, clubs and tournaments"
      />

      <form action="/search" method="GET" role="search" className="relative">
        <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          id="search-query"
          name="q"
          type="search"
          autoComplete="off"
          enterKeyHint="search"
          defaultValue={q}
          aria-label="Search"
          placeholder="Search matches, teams, players, clubs, tournaments…"
          className="h-11 pl-10 text-base sm:text-sm"
          autoFocus
        />
      </form>

      {q && !result && (
        <p className="text-sm text-muted-foreground">
          Type at least 2 characters
        </p>
      )}

      {result && !hasResults && (
        <EmptyState
          icon={Search}
          title={`No results for "${q}"`}
          description="Nothing matched. Check the spelling or try a shorter term."
          primaryAction={{
            label: "Browse matches",
            href: "/matches",
          }}
          secondaryAction={{
            label: "Browse tournaments",
            href: "/tournaments",
          }}
        />
      )}

      {result && hasResults && (
        <div className="space-y-6">
          <Section
            title="Matches"
            items={result.matches}
            render={(x: {
              id: string;
              title: string;
              status: string;
              venue: string | null;
            }) => {
              return (
                <Link className="block transition-colors hover:bg-muted/50" href={`/matches/${x.id}?from=search`}>
                  <div className="flex items-center justify-between gap-3 px-4 py-3">
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{x.title}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {x.venue ?? "—"}
                        </p>
                      </div>
                      <StatusBadge status={x.status} className="shrink-0" />
                    </div>
                </Link>
              );
            }}
          />

          <Section
            title="Teams"
            items={result.teams}
            render={(x: {
              id: string;
              name: string;
              short_name: string | null;
            }) => {
              return (
                <Link className="block transition-colors hover:bg-muted/50" href={`/teams/${x.id}`}>
                  <div className="px-4 py-3">
                      <p className="truncate font-medium">{x.name}</p>
                      {x.short_name && (
                        <p className="truncate text-xs text-muted-foreground">
                          {x.short_name}
                        </p>
                      )}
                    </div>
                </Link>
              );
            }}
          />

          <Section
            title="Players"
            items={result.players}
            render={(x: {
              id: string;
              full_name: string;
              avatar_url: string | null;
              username?: string | null;
            }) => {
              return (
                <Link className="block transition-colors hover:bg-muted/50" href={`/players/${x.username ? `@${x.username}` : x.id}`}
                >
                  <div className="flex items-center gap-3 px-4 py-3">
                      <Initials name={x.full_name} fallback="P" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{x.full_name}</p>
                        <p className="truncate font-mono text-xs text-muted-foreground">
                          {x.username ? `@${x.username}` : "Player profile"}
                        </p>
                      </div>
                    </div>
                </Link>
              );
            }}
          />

          <Section
            title="Clubs"
            items={result.clubs}
            render={(x: {
              id: string;
              name: string;
              location: string | null;
            }) => {
              return (
                <Link className="block transition-colors hover:bg-muted/50" href={`/clubs/${x.id}`}>
                  <div className="px-4 py-3">
                      <p className="truncate font-medium">{x.name}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {x.location ?? "—"}
                      </p>
                    </div>
                </Link>
              );
            }}
          />

          <Section
            title="Tournaments"
            items={result.tournaments}
            render={(x: {
              id: string;
              name: string;
              status: string | null;
            }) => {
              return (
                <Link className="block transition-colors hover:bg-muted/50" href={`/tournaments/${x.id}`}>
                  <div className="flex items-center justify-between gap-3 px-4 py-3">
                      <p className="min-w-0 flex-1 truncate font-medium">
                        {x.name}
                      </p>
                      <StatusBadge status={x.status} className="shrink-0" />
                    </div>
                </Link>
              );
            }}
          />
        </div>
      )}
    </PageContainer>
  );
}
