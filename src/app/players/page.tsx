import Link from "next/link";
import { createServerClient } from "~/lib/supabase/server";
import { Card, CardContent } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { Search, UserX } from "lucide-react";
import { EmptyState } from "~/components/ui/empty-state";

export const dynamic = "force-dynamic";

export default async function PlayersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q = "" } = await searchParams;
  const supabase = await createServerClient();

  let query = supabase
    .from("users")
    .select("id, full_name, avatar_url")
    .order("full_name")
    .limit(30);
  if (q.trim().length >= 2) {
    query = supabase
      .from("users")
      .select("id, full_name, avatar_url")
      .ilike("full_name", `%${q.trim()}%`)
      .order("full_name")
      .limit(30);
  }

  const { data: players } = await query;

  return (
    <div className="container mx-auto max-w-5xl px-3 py-4 sm:px-4 sm:py-8">
      <h1 className="text-xl font-bold tracking-tight sm:text-2xl">Players</h1>
      <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
        All players on the platform
      </p>

      <form
        action="/players"
        method="GET"
        className="relative mt-4 w-full max-w-md sm:mt-6"
      >
        <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
        <Input
          name="q"
          defaultValue={q}
          placeholder="Search players…"
          className="h-10 pl-9 text-sm"
        />
      </form>

      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {(players ?? []).map((p) => (
          <Link key={p.id} href={`/players/${p.id}`}>
            <Card className="transition-colors hover:border-primary/40">
              <CardContent className="flex items-center gap-3 p-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/15 font-bold text-primary">
                  {p.full_name.slice(0, 2).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-foreground">
                    {p.full_name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Player profile
                  </p>
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
    </div>
  );
}
