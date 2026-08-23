import { Suspense } from "react";
import Link from "next/link";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Plus, Search, Loader2 } from "lucide-react";
import { getTeams } from "./actions";
import { TeamCard } from "~/components/teams/team-card";

export default async function TeamsPage({
    searchParams,
}: {
    searchParams: { search?: string; type?: "club" | "match" | "tournament"; view?: "mine" | "all" };
}) {
    const view = searchParams?.view === "all" ? "all" : "mine";
    const { data: teams, error } = await getTeams({
        ...searchParams,
        mine: view === "mine",
    });

    const buildHref = (nextView: "mine" | "all") => {
        const params = new URLSearchParams();
        if (searchParams?.search) params.set("search", searchParams.search);
        if (nextView === "all") params.set("view", "all");
        const qs = params.toString();
        return qs ? `/teams?${qs}` : "/teams";
    };

    return (
        <div className="container mx-auto px-4 py-8">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-8">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">
                        {view === "mine" ? "My Teams" : "All Teams"}
                    </h1>
                    <p className="text-muted-foreground mt-1">
                        {view === "mine"
                            ? "Teams you created, lead, or play in"
                            : "Every team on the platform"}
                    </p>
                </div>
                <Button asChild>
                    <Link href="/teams/create">
                        <Plus className="mr-2 h-4 w-4" />
                        Create Team
                    </Link>
                </Button>
            </div>

            <div className="flex items-center justify-between gap-4 mb-6">
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
                <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <form action="/teams" method="GET">
                        <Input
                            name="search"
                            type="search"
                            placeholder="Search teams..."
                            className="pl-8"
                            defaultValue={searchParams?.search}
                        />
                        {view === "all" && <input type="hidden" name="view" value="all" />}
                    </form>
                </div>
            </div>

            {error ? (
                <div className="p-8 text-center text-red-500 bg-red-50 rounded-lg">
                    Error loading teams: {error}
                </div>
            ) : (
                <Suspense fallback={<TeamsLoading />}>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {teams?.map((team) => (
                            <TeamCard key={team.id} team={team} />
                        ))}
                        {teams?.length === 0 && (
                            <div className="col-span-full text-center py-12 text-muted-foreground bg-muted/20 rounded-lg border border-dashed">
                                {view === "mine" ? (
                                    <>
                                        <p>You're not part of any team yet.</p>
                                        <div className="mt-2 flex justify-center gap-2">
                                            <Button variant="link" asChild>
                                                <Link href="/teams/create">Create your first team</Link>
                                            </Button>
                                            <Button variant="link" asChild>
                                                <Link href="/teams?view=all">Browse all teams</Link>
                                            </Button>
                                        </div>
                                    </>
                                ) : (
                                    <>
                                        <p>No teams found.</p>
                                        <Button variant="link" asChild className="mt-2">
                                            <Link href="/teams/create">Create the first one</Link>
                                        </Button>
                                    </>
                                )}
                            </div>
                        )}
                    </div>
                </Suspense>
            )}
        </div>
    );
}

function TeamsLoading() {
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
                <div key={i} className="h-[200px] bg-muted/20 animate-pulse rounded-lg" />
            ))}
            <div className="flex items-center justify-center col-span-full py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        </div>
    );
}
