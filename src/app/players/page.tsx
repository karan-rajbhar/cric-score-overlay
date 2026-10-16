import Link from "next/link";
import { createServerClient } from "~/lib/firebase/server";
import { Card, CardContent } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { Search, UserX } from "lucide-react";
import { EmptyState } from "~/components/ui/empty-state";
import { Initials } from "~/components/ui/initials";
import { PageContainer, PageHeader } from "~/components/layout/page";

export const dynamic = "force-dynamic";

export default async function PlayersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q = "" } = await searchParams;
  const db = await createServerClient();

  const cleanQ = q.trim().replace(/^@/, "");
  let query = db
    .from("users")
    .select("id, full_name, avatar_url, username")
    .order("full_name")
    .limit(30);
  if (cleanQ.length >= 2) {
    query = db
      .from("users")
      .select("id, full_name, avatar_url, username")
      .or(`full_name.ilike.%${cleanQ}%,username.ilike.%${cleanQ}%`)
      .order("full_name")
      .limit(30);
  }

  const { data: players } = await query;

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
        {(players ?? []).map((p) => (
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
        {(players ?? []).length === 0 && (
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
    </PageContainer>
  );
}
