import Link from "next/link";
import { globalSearch } from "./actions";
import { Card, CardContent } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { Badge } from "~/components/ui/badge";
import { Search } from "lucide-react";
import { EmptyState } from "~/components/ui/empty-state";
import { formatStatus } from "~/lib/cricket";

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
    <div>
      <div className="mb-2.5 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
        <span className="tabular text-xs font-medium text-muted-foreground">
          {items.length} {items.length === 1 ? "result" : "results"}
        </span>
      </div>
      <div className="grid gap-2">{items.map(render)}</div>
    </div>
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
    <div className="container mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-2xl font-bold tracking-tight">Search</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Teams, matches, players, clubs and tournaments
      </p>

      <form action="/search" method="GET" className="relative mt-6">
        <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
        <Input
          name="q"
          defaultValue={q}
          placeholder="Search…"
          className="pl-9"
          autoFocus
        />
      </form>

      {q && !result && (
        <p className="mt-6 text-sm text-muted-foreground">
          Type at least 2 characters
        </p>
      )}

      {result && !hasResults && (
        <EmptyState
          icon={Search}
          title={`No Results for "${q}"`}
          description="We couldn't find any matches, teams, tournaments, clubs, or players matching your search query. Try checking for typos or searching a broader term."
          primaryAction={{
            label: "Explore Matches",
            href: "/matches",
          }}
          secondaryAction={{
            label: "Browse Tournaments",
            href: "/tournaments",
          }}
          className="mt-6"
        />
      )}

      {result && hasResults && (
        <div className="mt-6 space-y-6">
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
                <Link key={x.id} href={`/matches/${x.id}?from=search`}>
                  <Card className="transition-colors hover:border-primary/40">
                    <CardContent className="flex items-center justify-between p-4">
                      <div>
                        <p className="font-medium">{x.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {x.venue ?? "—"}
                        </p>
                      </div>
                      <Badge variant="outline">{formatStatus(x.status)}</Badge>
                    </CardContent>
                  </Card>
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
                <Link key={x.id} href={`/teams/${x.id}`}>
                  <Card className="transition-colors hover:border-primary/40">
                    <CardContent className="p-4">
                      <p className="font-medium">{x.name}</p>
                      {x.short_name && (
                        <p className="text-xs text-muted-foreground">
                          {x.short_name}
                        </p>
                      )}
                    </CardContent>
                  </Card>
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
            }) => {
              return (
                <Link key={x.id} href={`/players/${x.id}`}>
                  <Card className="transition-colors hover:border-primary/40">
                    <CardContent className="flex items-center gap-3 p-4">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                        {(x.full_name ?? "P")[0]?.toUpperCase()}
                      </div>
                      <div>
                        <p className="font-medium">{x.full_name}</p>
                        <p className="text-xs text-muted-foreground">
                          Player Profile
                        </p>
                      </div>
                    </CardContent>
                  </Card>
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
                <Link key={x.id} href={`/clubs/${x.id}`}>
                  <Card className="transition-colors hover:border-primary/40">
                    <CardContent className="p-4">
                      <p className="font-medium">{x.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {x.location ?? "—"}
                      </p>
                    </CardContent>
                  </Card>
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
                <Link key={x.id} href={`/tournaments/${x.id}`}>
                  <Card className="transition-colors hover:border-primary/40">
                    <CardContent className="flex items-center justify-between p-4">
                      <p className="font-medium">{x.name}</p>
                      <Badge variant="outline">
                        {formatStatus(x.status) || "—"}
                      </Badge>
                    </CardContent>
                  </Card>
                </Link>
              );
            }}
          />
        </div>
      )}
    </div>
  );
}
