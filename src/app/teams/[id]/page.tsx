import Link from "next/link";
import { notFound } from "next/navigation";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "~/components/ui/card";
import { ChevronLeft, Edit, Users, Trophy, Calendar } from "lucide-react";
import { getTeam } from "../actions";
import { createServerClient } from "~/lib/supabase/server";
import { PlayerList } from "~/components/teams/player-list";
import { AddPlayerDialog } from "~/components/teams/add-player-dialog";
import { TeamLogoEditor } from "~/components/teams/team-logo-editor";
import { TeamLogo } from "~/components/teams/team-logo";
import { TeamSquadShare } from "~/components/teams/team-squad-share";

function TeamLogoStatic({
    name,
    shortName,
    logoUrl,
}: {
    name: string;
    shortName?: string | null;
    logoUrl?: string | null;
}) {
    return <TeamLogo name={name} shortName={shortName} logoUrl={logoUrl} className="h-16 w-16 rounded-lg text-lg" />;
}

export default async function TeamDetailsPage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id } = await params;
    const { data: team, error } = await getTeam(id);

    // Only captain/creator can edit the crest.
    const supabase = await createServerClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();
    const canEditLogo = !!user && (team?.captain_id === user.id || team?.created_by === user.id);

    if (error || !team) {
        if (!team) notFound();
        return (
            <div className="container mx-auto px-4 py-8">
                <div className="p-8 text-center text-red-500 bg-red-50 rounded-lg">
                    Error loading team: {error}
                </div>
            </div>
        );
    }

    // Flatten the player structure for the PlayerList component
    const players = (team.team_players as Array<{
        id: string;
        user_id: string;
        role_in_team?: string;
        jersey_number?: number;
        user?: {
            id: string;
            full_name: string;
            email?: string;
            avatar_url?: string;
        };
    }> | null) || [];

    return (
        <div className="container mx-auto px-4 py-8">
            <Button variant="ghost" className="mb-6 pl-0" asChild>
                <Link href="/teams">
                    <ChevronLeft className="mr-2 h-4 w-4" />
                    Back to Teams
                </Link>
            </Button>

            <div className="grid lg:grid-cols-3 gap-8">
                {/* Team Info Sidebar */}
                <div className="lg:col-span-1 space-y-6">
                    <Card>
                        <CardHeader>
                            <div className="flex items-start justify-between">
                                {canEditLogo ? (
                                    <TeamLogoEditor
                                        teamId={team.id}
                                        teamName={team.name}
                                        shortName={team.short_name}
                                        logoUrl={team.logo_url}
                                    />
                                ) : (
                                    <TeamLogoStatic
                                        name={team.name}
                                        shortName={team.short_name}
                                        logoUrl={team.logo_url}
                                    />
                                )}
                                <Button variant="outline" size="icon" title="Edit Team">
                                    <Edit className="h-4 w-4" />
                                </Button>
                            </div>
                            <CardTitle className="text-2xl">{team.name}</CardTitle>
                            {team.short_name && (
                                <CardDescription className="text-lg font-medium">{team.short_name}</CardDescription>
                            )}
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <p className="text-muted-foreground">{team.description || "No description provided."}</p>

                            <div className="pt-4 space-y-3 border-t">
                                <div className="flex items-center justify-between text-sm">
                                    <div className="flex items-center text-muted-foreground">
                                        <Users className="mr-2 h-4 w-4" />
                                        Squad Size
                                    </div>
                                    <span className="font-medium">{players.length}</span>
                                </div>

                                <div className="flex items-center justify-between text-sm">
                                    <div className="flex items-center text-muted-foreground">
                                        <Trophy className="mr-2 h-4 w-4" />
                                        Type
                                    </div>
                                    <Badge variant="secondary" className="capitalize">{team.team_type}</Badge>
                                </div>

                                <div className="flex items-center justify-between text-sm">
                                    <div className="flex items-center text-muted-foreground">
                                        <Calendar className="mr-2 h-4 w-4" />
                                        Created
                                    </div>
                                    <span className="font-medium">
                                        {new Date(team.created_at).toLocaleDateString()}
                                    </span>
                                </div>
                            </div>

                            {team.captain && (
                                <div className="pt-4 border-t">
                                    <p className="text-sm font-medium mb-2">Leadership</p>
                                    <div className="flex items-center gap-2 mb-1">
                                        <Badge className="bg-yellow-500/10 text-yellow-600 border-yellow-200">C</Badge>
                                        <span className="text-sm">{team.captain.full_name}</span>
                                    </div>
                                    {team.vice_captain && (
                                        <div className="flex items-center gap-2">
                                            <Badge className="bg-blue-500/10 text-blue-600 border-blue-200">VC</Badge>
                                            <span className="text-sm">{team.vice_captain.full_name}</span>
                                        </div>
                                    )}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>

                {/* Main Content - Squad */}
                <div className="lg:col-span-2 space-y-6">
                    <div className="flex items-center justify-between">
                        <h2 className="text-xl font-semibold tracking-tight">Squad</h2>
                        <div className="flex items-center gap-2">
                            <TeamSquadShare
                                teamId={team.id}
                                teamName={team.name}
                                shortName={team.short_name}
                                players={players.map((p) => ({
                                    full_name: p.user?.full_name ?? "Unknown",
                                    role_in_team: p.role_in_team,
                                    jersey_number: p.jersey_number,
                                }))}
                            />
                            <AddPlayerDialog teamId={team.id} />
                        </div>
                    </div>

                    <PlayerList
                        teamId={team.id}
                        players={players}
                        allowEdit={true}
                    />
                </div>
            </div>
        </div>
    );
}
