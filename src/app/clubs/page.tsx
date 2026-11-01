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
  DirectorySwitch,
  MineAllSwitch,
} from "~/components/layout/directory-switch";
import { ListSearch } from "~/components/layout/list-search";
import { PageContainer, PageHeader } from "~/components/layout/page";
import { Pager } from "~/components/layout/pager";
import { prefixSearch } from "~/lib/firebase/search";
import { keysetPage, PAGE_SIZE, parseCursor } from "~/lib/keyset";

export const metadata = { title: "Clubs" };

export const dynamic = "force-dynamic";

interface ClubRow {
  id: string;
  name: string;
  short_name: string | null;
  location: string | null;
  club_type: string | null;
  logo_url?: string | null;
  is_public: boolean | null;
  /** Teams in the club, kept by the teams write hook (see withTeamCounts). */
  team_count?: number | null;
  name_lower?: string;
}

const CLUB_COLUMNS =
  "id, name, short_name, location, club_type, logo_url, is_public, team_count, name_lower";

type CountClient = Awaited<ReturnType<typeof createServerClient>>;

/**
 * Each club's team count: the stored `team_count`, or a count() of its
 * teams for a club that has none yet (before the backfill).
 */
async function withTeamCounts(
  db: CountClient,
  clubs: ClubRow[],
): Promise<ClubRow[]> {
  return Promise.all(
    clubs.map(async (club) => {
      if (typeof club.team_count === "number") return club;
      const { count } = await db
        .from("teams")
        .select("id", { count: "exact", head: true })
        .eq("club_id", club.id);
      return { ...club, team_count: count ?? 0 };
    }),
  );
}

function ClubCard({ club }: { club: ClubRow }) {
  const teamCount = club.team_count ?? 0;
  return (
    <Link href={`/clubs/${club.id}`} className="group">
      <Card className="h-full transition-colors group-hover:border-primary/40">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <ClubLogo
              name={club.name}
              shortName={club.short_name}
              logoUrl={club.logo_url}
              className="h-10 w-10 shrink-0 text-sm"
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
              <span className="tabular-nums">{teamCount}</span>{" "}
              {teamCount === 1 ? "team" : "teams"}
            </span>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

export default async function ClubsPage({
  searchParams,
}: {
  searchParams?: Promise<{
    after?: string;
    view?: "mine" | "all";
    search?: string;
  }>;
}) {
  const { after, view: requested, search } = (await searchParams) ?? {};
  const query = search?.trim() ?? "";
  const db = await createServerClient();
  const {
    data: { user },
  } = await db.auth.getUser();
  // A search looks through every public club.
  const view = user && requested !== "all" && !query ? "mine" : "all";
  // Read here, not in nested components, so the page's reads are its own.
  const list =
    view === "mine"
      ? await myClubs(db, user!.id)
      : query.length >= 2
        ? await foundClubs(db, query)
        : await allClubs(db, after, Boolean(user));

  return (
    <PageContainer>
      <DirectorySwitch current="/clubs" />
      <PageHeader
        search
        title={view === "mine" ? "My clubs" : "All clubs"}
        description={
          view === "mine"
            ? "Clubs you belong to"
            : "Public clubs on the platform"
        }
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
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        {user && (
          <MineAllSwitch
            label="Club list"
            view={view}
            mine={{ label: "My clubs", href: "/clubs" }}
            all={{ label: "All clubs", href: "/clubs?view=all" }}
          />
        )}
        <ListSearch
          action="/clubs"
          value={query}
          label="Search clubs"
          placeholder="Search clubs…"
          hidden={{ view: "all" }}
        />
      </div>
      {list}
    </PageContainer>
  );
}

type Db = Awaited<ReturnType<typeof createServerClient>>;

/** Clubs the user belongs to or owns (each read only on this view). */
async function myClubs(db: Db, userId: string) {
  const [{ data: mems }, { data: owned }] = await Promise.all([
    db.from("club_memberships").select("club_id").eq("user_id", userId),
    db.from("clubs").select("id").eq("owner_id", userId),
  ]);
  const ids = Array.from(
    new Set([
      ...(mems ?? []).map((m) => m.club_id),
      ...(owned ?? []).map((o) => o.id),
    ]),
  );
  const clubs = ids.length
    ? await withTeamCounts(
        db,
        ((
          await db
            .from("clubs")
            .select(CLUB_COLUMNS)
            .in("id", ids)
            .order("name")
        ).data ?? []) as ClubRow[],
      )
    : [];

  if (clubs.length === 0) {
    return (
      <EmptyState
        icon={Shield}
        title="No clubs joined yet"
        description="You don't belong to any cricket clubs yet. Create your club to organize teams, record seasons, and showcase top performers."
        primaryAction={{
          label: "Create club",
          href: "/clubs/create",
          icon: Plus,
        }}
        secondaryAction={{ label: "See all clubs", href: "/clubs?view=all" }}
      />
    );
  }
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {clubs.map((club) => (
        <ClubCard key={club.id} club={club} />
      ))}
    </div>
  );
}

/** Public clubs named like the search (indexed: at most a page of reads). */
async function foundClubs(db: Db, query: string) {
  const { data } = await prefixSearch(
    db,
    "clubs",
    query,
    CLUB_COLUMNS,
    PAGE_SIZE,
  );
  const clubs = await withTeamCounts(
    db,
    (data as unknown as ClubRow[]).filter((c) => c.is_public === true),
  );
  if (clubs.length === 0) {
    return (
      <EmptyState
        icon={Shield}
        title="No clubs found"
        description={`No public club matches “${query}”.`}
      />
    );
  }
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {clubs.map((club) => (
        <ClubCard key={club.id} club={club} />
      ))}
    </div>
  );
}

/** Public clubs, a page at a time in name order (keyset, no scan). */
async function allClubs(
  db: Db,
  after: string | undefined,
  signedIn: boolean,
) {
  const cursor = parseCursor(after);
  let query = db
    .from("clubs")
    .select(CLUB_COLUMNS)
    .eq("is_public", true)
    .order("name_lower");
  if (cursor) query = query.after(cursor.value, cursor.id);
  const { data } = await query.limit(PAGE_SIZE + 1);
  const page = keysetPage(
    (data ?? []) as ClubRow[],
    (c) => c.name_lower ?? "",
  );
  const clubs = await withTeamCounts(db, page.rows);

  if (clubs.length === 0) {
    return (
      <EmptyState
        icon={Shield}
        title="No public clubs found"
        description={
          signedIn
            ? "No public cricket clubs have been registered on the platform yet."
            : "No public cricket clubs have been registered on the platform yet. Sign in to create the first club."
        }
        primaryAction={
          signedIn ? undefined : { label: "Sign in", href: "/auth/login" }
        }
      />
    );
  }
  return (
    <section className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {clubs.map((club) => (
          <ClubCard key={club.id} club={club} />
        ))}
      </div>
      <Pager
        label="Public clubs pages"
        firstHref={after ? "/clubs?view=all" : null}
        nextHref={
          page.next
            ? `/clubs?${new URLSearchParams({ view: "all", after: page.next })}`
            : null
        }
      />
    </section>
  );
}
