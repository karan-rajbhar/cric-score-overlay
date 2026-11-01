import { Suspense } from "react";
import Link from "next/link";
import { Button } from "~/components/ui/button";
import { Plus, Users, AlertCircle } from "lucide-react";
import { getTeams } from "./actions";
import { TeamCard } from "~/components/teams/team-card";
import { EmptyState } from "~/components/ui/empty-state";
import { Skeleton } from "~/components/ui/skeleton";
import { createServerClient } from "~/lib/firebase/server";
import { ListSearch } from "~/components/layout/list-search";
import { PageContainer, PageHeader } from "~/components/layout/page";
import { Pager } from "~/components/layout/pager";
import {
  DirectorySwitch,
  MineAllSwitch,
} from "~/components/layout/directory-switch";

export const metadata = { title: "Teams" };

export default async function TeamsPage({
  searchParams,
}: {
  searchParams: Promise<{
    search?: string;
    type?: "club" | "match" | "tournament";
    view?: "mine" | "all";
    after?: string;
  }>;
}) {
  const db = await createServerClient();
  const {
    data: { user },
  } = await db.auth.getUser();

  const resolvedParams = await searchParams;
  const defaultView = user ? "mine" : "all";
  const view = resolvedParams?.view ?? defaultView;
  const {
    data: teams,
    error,
    next,
  } = await getTeams({
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
      <DirectorySwitch current="/teams" />
      <PageHeader
        search
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
        <MineAllSwitch
          label="Team list"
          view={view}
          mine={{ label: "My teams", href: buildHref("mine") }}
          all={{ label: "All teams", href: buildHref("all") }}
        />
        <ListSearch
          action="/teams"
          value={resolvedParams?.search}
          label="Search teams"
          placeholder="Search teams…"
          hidden={view === "all" ? { view: "all" } : undefined}
        />
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
      {view === "all" && !resolvedParams?.search && (
        <TeamsPager
          type={resolvedParams?.type}
          after={resolvedParams?.after}
          next={next ?? null}
        />
      )}
    </PageContainer>
  );
}

/** "All teams" comes a page at a time (name order). */
function TeamsPager({
  type,
  after,
  next,
}: {
  type?: string;
  after?: string;
  next: string | null;
}) {
  const pageHref = (cursor: string | null) => {
    const params = new URLSearchParams({ view: "all" });
    if (type) params.set("type", type);
    if (cursor) params.set("after", cursor);
    return `/teams?${params}`;
  };
  return (
    <Pager
      label="Teams pages"
      firstHref={after ? pageHref(null) : null}
      nextHref={next ? pageHref(next) : null}
    />
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
