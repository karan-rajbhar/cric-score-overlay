import Link from "next/link";
import { createServerClient } from "~/lib/supabase/server";
import { Card, CardContent } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { Search } from "lucide-react";

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
    .select("id, full_name, avatar_url, email")
    .order("full_name")
    .limit(30);
  if (q.trim().length >= 2) {
    query = supabase
      .from("users")
      .select("id, full_name, avatar_url, email")
      .ilike("full_name", `%${q.trim()}%`)
      .order("full_name")
      .limit(30);
  }

  const { data: players } = await query;

  return (
    <div className="container mx-auto max-w-5xl px-4 py-8">
      <h1 className="text-2xl font-bold tracking-tight">Players</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        All players on the platform
      </p>

      <form action="/players" method="GET" className="relative mt-6 max-w-md">
        <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
        <Input
          name="q"
          defaultValue={q}
          placeholder="Search players…"
          className="pl-9"
        />
      </form>

      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {(players ?? []).map((p) => (
          <Link key={p.id} href={`/players/${p.id}`}>
            <Card className="transition-colors hover:border-primary/40">
              <CardContent className="flex items-center gap-3 p-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/15 font-bold text-primary">
                  {p.full_name.slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <p className="font-medium">{p.full_name}</p>
                  <p className="text-xs text-muted-foreground">
                    {p.email ?? "—"}
                  </p>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
        {(players ?? []).length === 0 && (
          <p className="col-span-full py-8 text-center text-sm text-muted-foreground">
            No players found
          </p>
        )}
      </div>
    </div>
  );
}
