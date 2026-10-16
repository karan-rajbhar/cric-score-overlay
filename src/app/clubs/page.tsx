import Link from "next/link";
import { createServerClient } from "~/lib/firebase/server";
import { Card, CardContent } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Shield, Plus } from "lucide-react";
import { EmptyState } from "~/components/ui/empty-state";
import { ClubLogo } from "~/components/clubs/club-logo";
import { formatClubType } from "~/lib/cricket";
import {
  PageContainer,
  PageHeader,
  SectionHeader,
} from "~/components/layout/page";

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
      <Card className="h-full transition-colors group-hover:border-primary/40">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <ClubLogo
              name={club.name}
              shortName={club.short_name}
              logoUrl={club.logo_url}
              className="h-10 w-10 shrink-0 rounded-lg text-sm"
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-2">
                <h3 className="truncate font-semibold">{club.name}</h3>
                {club.short_name && (
                  <span className="shrink-0 rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
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
              <span className="tabular-nums">{teamCount}</span> {teamCount === 1 ? "team" : "teams"}
            </span>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

export default async function ClubsPage() {
  const db = await createServerClient();
  const {
    data: { user },
  } = await db.auth.getUser();

  // If logged in, fetch clubs where user is owner or member
  let myClubIds: string[] = [];
  if (user) {
    const [{ data: mems }, { data: owned }] = await Promise.all([
      db
        .from("club_memberships")
        .select("club_id")
        .eq("user_id", user.id),
      db.from("clubs").select("id").eq("owner_id", user.id),
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
      ? ((await db
          .from("clubs")
          .select(
            "id, name, short_name, location, club_type, logo_url, is_public, teams(count)",
          )
          .in("id", myClubIds)
          .order("name")
          .then((r) => r.data)) as ClubRow[] | null)
      : null;

  // Public directory, excluding clubs already shown above.
  const { data: publicClubs } = (await db
    .from("clubs")
    .select(
      "id, name, short_name, location, club_type, logo_url, is_public, teams(count)",
    )
    .eq("is_public", true)
    .order("name")) as { data: ClubRow[] | null };

  const myIds = new Set((myClubs ?? []).map((c) => c.id));
  const explore = (publicClubs ?? []).filter((c) => !myIds.has(c.id));

  return (
    <PageContainer>
      <PageHeader
        title="Clubs"
        description="Clubs you belong to, plus public clubs on the platform."
        actions={
          user && (
            <Button asChild size="sm">
              <Link href="/clubs/create">
                <Plus />
                Create club
              </Link>
            </Button>
          )
        }
      />

      {user && (
        <section className="space-y-4">
          <SectionHeader title="My clubs" count={myClubs?.length ?? 0} />
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

      <section className="space-y-4">
        {(!user || explore.length > 0) && (
          <SectionHeader
            title="Public clubs"
            count={explore.length || undefined}
          />
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
              description="No public cricket clubs have been registered on the platform yet. Sign in to create the first club."
              primaryAction={{
                label: "Sign in",
                href: "/auth/login",
              }}
            />
          )
        )}
      </section>
    </PageContainer>
  );
}
