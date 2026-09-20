import Link from "next/link";
import { createServerClient } from "~/lib/supabase/server";
import { Card, CardContent } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Shield, Plus } from "lucide-react";
import { EmptyState } from "~/components/ui/empty-state";
import { ClubLogo } from "~/components/clubs/club-logo";
import { formatClubType } from "~/lib/cricket";

export const dynamic = "force-dynamic";

interface ClubRow {
  id: string;
  name: string;
  short_name: string | null;
  location: string | null;
  club_type: string | null;
  logo_url?: string | null;
  is_public: boolean | null;
  teams: { count: number }[];
}

function ClubCard({ club }: { club: ClubRow }) {
  const teamCount = club.teams?.[0]?.count ?? 0;
  return (
    <Link href={`/clubs/${club.id}`} className="group">
      <Card className="transition-colors group-hover:border-primary/50">
        <CardContent className="p-4 sm:p-5">
          <div className="flex items-start gap-3">
            <ClubLogo
              name={club.name}
              shortName={club.short_name}
              logoUrl={club.logo_url}
              className="h-10 w-10 text-sm rounded-xl"
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-2">
                <h2 className="truncate font-semibold">{club.name}</h2>
                {club.short_name && (
                  <span className="shrink-0 rounded-md bg-secondary px-2 py-0.5 text-xs font-bold text-secondary-foreground">
                    {club.short_name}
                  </span>
                )}
              </div>
              <p className="truncate text-sm text-muted-foreground">
                {club.location ?? "—"}
              </p>
            </div>
          </div>
          <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
            {club.club_type && (
              <Badge variant="outline">{formatClubType(club.club_type)}</Badge>
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

  // If logged in, fetch clubs where user is owner or member
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

  const myClubs =
    myClubIds.length > 0
      ? ((await supabase
          .from("clubs")
          .select(
            "id, name, short_name, location, club_type, logo_url, is_public, teams(count)",
          )
          .in("id", myClubIds)
          .order("name")
          .then((r) => r.data)) as ClubRow[] | null)
      : null;

  // Public directory, excluding clubs already shown above.
  const { data: publicClubs } = (await supabase
    .from("clubs")
    .select(
      "id, name, short_name, location, club_type, logo_url, is_public, teams(count)",
    )
    .eq("is_public", true)
    .order("name")) as { data: ClubRow[] | null };

  const myIds = new Set((myClubs ?? []).map((c) => c.id));
  const explore = (publicClubs ?? []).filter((c) => !myIds.has(c.id));

  return (
    <div className="container mx-auto max-w-5xl px-3 py-6 sm:px-4 sm:py-10">
      <header className="mb-6 flex flex-col gap-3 sm:mb-8 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight sm:text-2xl">
            Clubs
          </h1>
          <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
            Clubs you belong to, plus public clubs on the platform.
          </p>
        </div>
        {user && (
          <Button asChild size="sm" className="h-10 w-full text-xs font-semibold sm:h-9 sm:w-auto sm:text-sm">
            <Link href="/clubs/create">
              <Plus className="mr-1.5 h-4 w-4" />
              Create club
            </Link>
          </Button>
        )}
      </header>

      {user && (
        <section className="mb-10">
          <h2 className="section-heading mb-4 text-sm font-semibold text-foreground">
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
              title="No clubs joined yet"
              description="You don't belong to any cricket clubs yet. Create your club to organize teams, record seasons, and showcase top performers."
              primaryAction={{
                label: "Create club",
                href: "/clubs/create",
                icon: Plus,
              }}
            />
          )}
        </section>
      )}

      <section>
        {!user && (
          <h2 className="section-heading mb-4 text-sm font-semibold text-foreground">
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
              title="No public clubs found"
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
