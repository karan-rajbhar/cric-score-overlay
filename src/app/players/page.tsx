import { prefixSearch } from "~/lib/firebase/search";
import { createServerClient } from "~/lib/firebase/server";
import { Avatar } from "~/components/ds/avatar";
import { ListCard, ListRow } from "~/components/ds/list";
import { Input } from "~/components/ui/input";
import { Search, UserX } from "lucide-react";
import { EmptyState } from "~/components/ui/empty-state";
import { PageContainer, PageHeader } from "~/components/layout/page";
import { Pager } from "~/components/layout/pager";
import { keysetPage, PAGE_SIZE, parseCursor } from "~/lib/keyset";

export const metadata = { title: "Players" };

export const dynamic = "force-dynamic";

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
    if (cursor) query = query.after(cursor.value, cursor.id);
    const { data } = await query.limit(PAGE_SIZE + 1);
    const page = keysetPage(
      (data ?? []) as PlayerRow[],
      (p) => p.name_lower ?? "",
    );
    players = page.rows;
    nextCursor = page.next;
  }

  return (
    <PageContainer>
      <PageHeader title="Players" description="All players on the platform" />

      <form action="/players" method="GET" className="relative w-full max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          autoCorrect="off"
          autoCapitalize="none"
          spellCheck={false}
          name="q"
          type="search"
          aria-label="Search players"
          defaultValue={q}
          placeholder="Search by name or @handle…"
          className="h-10 pl-9 text-sm"
        />
      </form>

      {players.length > 0 && (
        <ListCard>
          {players.map((p) => (
            <ListRow
              key={p.id}
              href={`/players/${p.username ? `@${p.username}` : p.id}`}
              leading={<Avatar name={p.full_name} src={p.avatar_url} />}
              title={p.full_name}
              subtitle={p.username ? `@${p.username}` : "Player profile"}
            />
          ))}
        </ListCard>
      )}
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

      <Pager
        label="Players pages"
        firstHref={after ? "/players" : null}
        nextHref={
          nextCursor
            ? `/players?${new URLSearchParams({ after: nextCursor })}`
            : null
        }
      />
    </PageContainer>
  );
}
