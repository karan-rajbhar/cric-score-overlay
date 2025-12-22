"use client";

import Link from "next/link";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Users, Trophy } from "lucide-react";

interface TeamCardProps {
    team: {
        id: string;
        name: string;
        short_name?: string;
        description?: string;
        player_count?: number;
        team_type?: string;
    };
}

export function TeamCard({ team }: TeamCardProps) {
    return (
        <Card className="flex flex-col h-full hover:shadow-md transition-shadow">
            <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                            {team.short_name?.substring(0, 2) || team.name.substring(0, 2).toUpperCase()}
                        </div>
                        <div>
                            <CardTitle className="text-lg">{team.name}</CardTitle>
                            {team.short_name && (
                                <p className="text-sm text-muted-foreground">{team.short_name}</p>
                            )}
                        </div>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="flex-1 py-4">
                <p className="text-sm text-muted-foreground line-clamp-2 min-h-[40px]">
                    {team.description || "No description provided."}
                </p>

                <div className="flex items-center gap-4 mt-4 text-sm text-muted-foreground">
                    <div className="flex items-center gap-1">
                        <Users className="h-4 w-4" />
                        <span>{team.player_count || 0} Players</span>
                    </div>
                    <div className="flex items-center gap-1 capitalize">
                        <Trophy className="h-4 w-4" />
                        <span>{team.team_type} Team</span>
                    </div>
                </div>
            </CardContent>
            <CardFooter className="pt-0">
                <Button asChild className="w-full" variant="outline">
                    <Link href={`/teams/${team.id}`}>Manage Team</Link>
                </Button>
            </CardFooter>
        </Card>
    );
}
