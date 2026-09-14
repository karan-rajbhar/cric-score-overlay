"use client";

import Link from "next/link";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Users, Trophy } from "lucide-react";
import { formatTeamType } from "~/lib/cricket";

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
    <Card className="flex h-full flex-col transition-shadow hover:shadow-md">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 font-bold text-primary">
              {team.short_name?.substring(0, 2) ||
                team.name.substring(0, 2).toUpperCase()}
            </div>
            <div>
              <CardTitle className="text-lg">{team.name}</CardTitle>
              {team.short_name && (
                <p className="text-sm text-muted-foreground">
                  {team.short_name}
                </p>
              )}
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex-1 py-4">
        <p className="line-clamp-2 min-h-[40px] text-sm text-muted-foreground">
          {team.description || "No description provided."}
        </p>

        <div className="mt-4 flex items-center gap-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <Users className="h-3.5 w-3.5" />
            <span className="tabular">
              {team.player_count || 0}{" "}
              {team.player_count === 1 ? "player" : "players"}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <Trophy className="h-3.5 w-3.5" />
            <span>{formatTeamType(team.team_type)}</span>
          </div>
        </div>
      </CardContent>
      <CardFooter className="pt-0">
        <Button
          asChild
          className="interactive-button w-full"
          variant="outline"
          size="sm"
        >
          <Link href={`/teams/${team.id}`}>Manage squad</Link>
        </Button>
      </CardFooter>
    </Card>
  );
}
