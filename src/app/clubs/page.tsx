import Link from "next/link";
import { createServerClient } from "~/lib/supabase/server";
import { Card, CardContent } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Shield, Plus } from "lucide-react";
import { EmptyState } from "~/components/ui/empty-state";

export const dynamic = "force-dynamic";

interface ClubRow {
  id: string;
  name: string;
  short_name: string | null;
  location: string | null;
  club_type: string | null;
  is_public: boolean | null;
  teams: { count: number }[];
}

function ClubCard({ club }: { club: ClubRow }) {
  const teamCount = club.teams?.[0]?.count ?? 0;
  return (
    <Link href={`/clubs/${club.id}`} className="group">
      <Card className="transition-colors group-hover:border-primary/50">
        <CardContent className="p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="font-semibold">{club.name}</h2>
              <p className="text-sm text-muted-foreground">
                {club.location ?? "—"}
              </p>
            </div>
            {club.short_name && (
              <span className="rounded-md bg-secondary px-2 py-1 text-xs font-bold text-secondary-foreground">
                {club.short_name}
              </span>
            )}
          </div>
          <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
            {club.club_type && (
              <Badge variant="outline" className="capitalize">
                {club.club_type}
              </Badge>
            )}
            <span>
              {teamCount} {teamCount === 1 ? "team" : "teams"}
            </span>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

export default async function ClubsPage() {
  const supabase = await createServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  let myClubIds: string[] = [];
  if (user) {
    const [{ data: mems }, { data: owned }] = await Promise.all([
      supabase
        .from("club_memberships")
        .select("club_id")
        .eq("user_id", user.id),
      supabase.from("clubs").select("id").eq("owner_id", user.id),
    ]);
    myClubIds = Array.from(
      new Set([
        ...(mems ?? []).map((m) => m.club_id),
        ...(owned ?? []).map((o) => o.id),
      ]),
    );
  }

  // My clubs: owned or a member of (only when logged in).
  const myClubs =
    myClubIds.length > 0
      ? ((await supabase
          .from("clubs")
          .select(
            "id, name, short_name, location, club_type, is_public, teams(count)",
          )
          .in("id", myClubIds)
          .order("name")
          .then((r) => r.data)) as ClubRow[] | null)
      : null;

  // Public directory, excluding clubs already shown above.
  const { data: publicClubs } = (await supabase
    .from("clubs")
    .select(
      "id, name, short_name, location, club_type, is_public, teams(count)",
    )
    .eq("is_public", true)
    .order("name")) as { data: ClubRow[] | null };

  const myIds = new Set((myClubs ?? []).map((c) => c.id));
  const explore = (publicClubs ?? []).filter((c) => !myIds.has(c.id));

  return (
    <div className="container mx-auto max-w-5xl px-4 py-10">
      <header className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Clubs</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Clubs you belong to, plus public clubs on the platform.
          </p>
        </div>
        {user && (
          <Button asChild size="sm">
            <Link href="/clubs/create">Create club</Link>
          </Button>
        )}
      </header>

      {user && (
        <section className="mb-10">
          <h2 className="section-heading mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            My clubs
          </h2>
          {myClubs?.length ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {myClubs.map((club) => (
                <ClubCard key={club.id} club={club} />
              ))}
            </div>
          ) : (
            <EmptyState
              icon={Shield}
              title="No Clubs Joined Yet"
              description="You don't belong to any cricket clubs yet. Create your club to organize teams, record seasons, and showcase top performers."
              primaryAction={{
                label: "Create Club",
                href: "/clubs/create",
                icon: Plus,
              }}
            />
          )}
        </section>
      )}

      <section>
        {!user && (
          <h2 className="section-heading mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Public clubs
          </h2>
        )}
        {explore.length ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {explore.map((club) => (
              <ClubCard key={club.id} club={club} />
            ))}
          </div>
        ) : (
          !user && (
            <EmptyState
              icon={Shield}
              title="No Public Clubs Found"
              description="No public cricket clubs have been registered on the platform yet. Sign in to create the first club!"
              primaryAction={{
                label: "Sign In to Create Club",
                href: "/auth/login",
              }}
            />
          )
        )}
        {user && !explore.length && null}
      </section>
    </div>
  );
}
