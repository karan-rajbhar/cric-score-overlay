import Link from "next/link";
import { prefixSearch } from "~/lib/firebase/search";
import { createServerClient } from "~/lib/firebase/server";
import { Card, CardContent } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { Search, UserX } from "lucide-react";
import { EmptyState } from "~/components/ui/empty-state";
import { Initials } from "~/components/ui/initials";
import { PageContainer, PageHeader } from "~/components/layout/page";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 30;

/** `after` cursor: the last row's lower-cased name and id. */
function parseCursor(raw: string | undefined): { name: string; id: string } | null {
  if (!raw) return null;
  const cut = raw.lastIndexOf("~");
  if (cut < 0) return null;
  return { name: raw.slice(0, cut), id: raw.slice(cut + 1) };
}

type PlayerRow = {
  id: string;
  full_name: string;
  avatar_url: string | null;
  username: string | null;
  name_lower?: string;
};

export default async function PlayersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; after?: string }>;
}) {
  const { q = "", after } = await searchParams;
  const db = await createServerClient();

  const cleanQ = q.trim().replace(/^@/, "");
  let players: PlayerRow[] = [];
  let nextCursor: string | null = null;
  if (cleanQ.length >= 2) {
    // Word-prefix match on name / @username (reads at most 30 profiles).
    const { data } = await prefixSearch(
      db,
      "users",
      cleanQ,
      "id, full_name, avatar_url, username",
      PAGE_SIZE,
    );
    players = data as PlayerRow[];
  } else {
    // One page in name order, read with a keyset cursor (no scan).
    const cursor = parseCursor(after);
    let query = db
      .from("users")
      .select("id, full_name, avatar_url, username, name_lower")
      .order("name_lower");
    if (cursor) query = query.after(cursor.name, cursor.id);
    const { data } = await query.limit(PAGE_SIZE + 1);
    const rows = (data ?? []) as PlayerRow[];
    players = rows.slice(0, PAGE_SIZE);
    const last = players[players.length - 1];
    if (rows.length > PAGE_SIZE && last) {
      nextCursor = `${last.name_lower ?? ""}~${last.id}`;
    }
  }

  return (
    <PageContainer>
      <PageHeader title="Players" description="All players on the platform" />

      <form
        action="/players"
        method="GET"
        className="relative w-full max-w-md"
      >
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          name="q"
          type="search"
          aria-label="Search players"
          defaultValue={q}
          placeholder="Search by name or @handle…"
          className="h-10 pl-9 text-sm"
        />
      </form>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {players.map((p) => (
          <Link
            key={p.id}
            href={`/players/${p.username ? `@${p.username}` : p.id}`}
          >
            <Card className="h-full transition-colors hover:border-primary/40">
              <CardContent className="flex items-center gap-3 p-4">
                <Initials
                  name={p.full_name}
                  letters={2}
                  className="h-10 w-10 text-sm"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-foreground">
                    {p.full_name}
                  </p>
                  {p.username ? (
                    <p className="truncate font-mono text-xs text-muted-foreground">
                      @{p.username}
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      Player profile
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
        {players.length === 0 && (
          <EmptyState
            icon={UserX}
            title="No players found"
            description={
              q
                ? `No registered cricketers match "${q}". Try another query.`
                : "No registered players are currently active on the platform."
            }
            primaryAction={
              q
                ? {
                    label: "Clear search",
                    href: "/players",
                  }
                : undefined
            }
            className="col-span-full"
          />
        )}
      </div>

      {(after || nextCursor) && (
        <nav aria-label="Players pages" className="flex justify-between gap-3">
          {after ? (
            <Link
              href="/players"
              className="text-sm font-medium text-primary hover:underline"
            >
              First page
            </Link>
          ) : (
            <span />
          )}
          {nextCursor && (
            <Link
              href={`/players?${new URLSearchParams({ after: nextCursor })}`}
              className="text-sm font-medium text-primary hover:underline"
            >
              Next page
            </Link>
          )}
        </nav>
      )}
    </PageContainer>
  );
}
