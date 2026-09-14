import { Suspense } from "react";
import Link from "next/link";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Plus, Search, Users, AlertCircle } from "lucide-react";
import { getTeams } from "./actions";
import { TeamCard } from "~/components/teams/team-card";
import { EmptyState } from "~/components/ui/empty-state";
import { Skeleton } from "~/components/ui/skeleton";
import { createServerClient } from "~/lib/supabase/server";

export default async function TeamsPage({
  searchParams,
}: {
  searchParams: Promise<{
    search?: string;
    type?: "club" | "match" | "tournament";
    view?: "mine" | "all";
  }>;
}) {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

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
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8 flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            {view === "mine" ? "My teams" : "All teams"}
          </h1>
          <p className="mt-1 text-muted-foreground">
            {view === "mine"
              ? "Teams you created, lead, or play in"
              : "Every team on the platform"}
          </p>
        </div>
        <Button asChild>
          <Link href="/teams/create">
            <Plus className="mr-2 h-4 w-4" />
            Create team
          </Link>
        </Button>
      </div>

      <div className="mb-6 flex items-center justify-between gap-4">
        <div className="inline-flex rounded-lg border border-border p-0.5">
          <Link
            href={buildHref("mine")}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              view === "mine"
                ? "bg-secondary text-secondary-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            My teams
          </Link>
          <Link
            href={buildHref("all")}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              view === "all"
                ? "bg-secondary text-secondary-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            All teams
          </Link>
        </div>
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <form action="/teams" method="GET">
            <Input
              name="search"
              type="search"
              placeholder="Search teams..."
              className="pl-8"
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
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
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
    </div>
  );
}

function TeamsLoading() {
  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="space-y-4 rounded-2xl border border-border bg-card p-6"
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
