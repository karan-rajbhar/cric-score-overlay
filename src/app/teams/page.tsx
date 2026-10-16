import { Suspense } from "react";
import Link from "next/link";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Plus, Search, Users, AlertCircle } from "lucide-react";
import { getTeams } from "./actions";
import { TeamCard } from "~/components/teams/team-card";
import { EmptyState } from "~/components/ui/empty-state";
import { Skeleton } from "~/components/ui/skeleton";
import { createServerClient } from "~/lib/firebase/server";
import { PageContainer, PageHeader } from "~/components/layout/page";
import { segmentedItem, segmentedTrack } from "~/components/ui/segmented";

export default async function TeamsPage({
  searchParams,
}: {
  searchParams: Promise<{
    search?: string;
    type?: "club" | "match" | "tournament";
    view?: "mine" | "all";
  }>;
}) {
  const db = await createServerClient();
  const {
    data: { user },
  } = await db.auth.getUser();

  const resolvedParams = await searchParams;
  const defaultView = user ? "mine" : "all";
  const view = resolvedParams?.view ?? defaultView;
  const { data: teams, error } = await getTeams({
    ...resolvedParams,
    mine: view === "mine",
  });

  const buildHref = (nextView: "mine" | "all") => {
    const params = new URLSearchParams();
    if (resolvedParams?.search) params.set("search", resolvedParams.search);
    if (nextView === "all") params.set("view", "all");
    const qs = params.toString();
    return qs ? `/teams?${qs}` : "/teams";
  };

  return (
    <PageContainer>
      <PageHeader
        title={view === "mine" ? "My teams" : "All teams"}
        description={
          view === "mine"
            ? "Teams you created, lead, or play in"
            : "Every team on the platform"
        }
        actions={
          <Button asChild size="sm">
            <Link href="/teams/create">
              <Plus />
              Create team
            </Link>
          </Button>
        }
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <nav aria-label="Team list" className={segmentedTrack}>
          <Link
            href={buildHref("mine")}
            aria-current={view === "mine" ? "page" : undefined}
            className={segmentedItem(view === "mine")}
          >
            My teams
          </Link>
          <Link
            href={buildHref("all")}
            aria-current={view === "all" ? "page" : undefined}
            className={segmentedItem(view === "all")}
          >
            All teams
          </Link>
        </nav>
        <div className="relative w-full flex-1 sm:max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <form action="/teams" method="GET">
            <Input
              name="search"
              type="search"
              aria-label="Search teams"
              placeholder="Search teams…"
              className="h-9 w-full pl-9"
              defaultValue={resolvedParams?.search}
            />
            {view === "all" && <input type="hidden" name="view" value="all" />}
          </form>
        </div>
      </div>

      {error ? (
        <EmptyState
          icon={AlertCircle}
          title="Unable to load teams"
          description={`There was an issue fetching teams: ${error}`}
          primaryAction={{
            label: "Browse all teams",
            href: "/teams?view=all",
          }}
        />
      ) : (
        <Suspense fallback={<TeamsLoading />}>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {teams?.map((team) => (
              <TeamCard key={team.id} team={team} />
            ))}
            {teams?.length === 0 && (
              <EmptyState
                icon={Users}
                title={
                  view === "mine"
                    ? "You're not in any teams yet"
                    : "No teams found"
                }
                description={
                  view === "mine"
                    ? "Create your squad to manage players, compete in tournaments, and track match records."
                    : resolvedParams?.search
                      ? `No teams matching "${resolvedParams.search}". Try a different keyword.`
                      : "No teams have been created on the platform yet."
                }
                primaryAction={{
                  label: "Create team",
                  href: "/teams/create",
                  icon: Plus,
                }}
                secondaryAction={
                  view === "mine"
                    ? {
                        label: "Browse all teams",
                        href: "/teams?view=all",
                      }
                    : undefined
                }
                className="col-span-full"
              />
            )}
          </div>
        </Suspense>
      )}
    </PageContainer>
  );
}

function TeamsLoading() {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="space-y-4 rounded-xl border border-border bg-card p-5"
        >
          <div className="flex items-center gap-4">
            <Skeleton className="h-12 w-12 rounded-xl" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-5 w-3/4" />
              <Skeleton className="h-3.5 w-1/2" />
            </div>
          </div>
          <Skeleton className="h-4 w-full" />
          <div className="flex items-center justify-between border-t border-border/50 pt-4">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-3 w-16" />
          </div>
        </div>
      ))}
    </div>
  );
}
