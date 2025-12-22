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
    searchParams: { search?: string; type?: "club" | "match" | "tournament" };
}) {
    const { data: teams, error } = await getTeams(searchParams);

    return (
        <div className="container mx-auto px-4 py-8">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-8">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Teams</h1>
                    <p className="text-muted-foreground mt-1">
                        Manage your cricket teams and squads
                    </p>
                </div>
                <Button asChild>
                    <Link href="/teams/create">
                        <Plus className="mr-2 h-4 w-4" />
                        Create Team
                    </Link>
                </Button>
            </div>

            <div className="flex items-center gap-4 mb-6">
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
                                <p>No teams found.</p>
                                <Button variant="link" asChild className="mt-2">
                                    <Link href="/teams/create">Create your first team</Link>
                                </Button>
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
