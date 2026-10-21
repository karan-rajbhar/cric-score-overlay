"use client";

import { useState } from "react";
import Link from "next/link";
import { Avatar } from "~/components/ds/avatar";
import { ListCard } from "~/components/ds/list";
import { Button } from "~/components/ui/button";
import { MoreHorizontal, Trash2, Users } from "lucide-react";
import { EmptyState } from "~/components/ui/empty-state";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { removePlayerFromTeam, updatePlayerRole } from "~/app/teams/actions";
import { formatPlayerRole } from "~/lib/cricket";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

interface Player {
  id: string; // team_players id
  user_id: string;
  role_in_team?: string;
  jersey_number?: number;
  user?: {
    id: string;
    full_name: string;
    avatar_url?: string;
  };
}

interface PlayerListProps {
  teamId: string;
  players: Player[];
  allowEdit?: boolean;
  tournamentId?: string;
  clubId?: string;
}

export function PlayerList({
  teamId,
  players,
  allowEdit = false,
  tournamentId,
  clubId,
}: PlayerListProps) {
  const [updating, setUpdating] = useState<string | null>(null);

  const handleRoleChange = async (userId: string, role: string) => {
    setUpdating(userId);
    try {
      const result = await updatePlayerRole(teamId, userId, role);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(`Role updated to ${role}`);
      }
    } catch {
      toast.error("Failed to update role");
    } finally {
      setUpdating(null);
    }
  };

  const handleRemove = async (userId: string) => {
    if (!confirm("Are you sure you want to remove this player from the team?"))
      return;

    setUpdating(userId);
    try {
      const result = await removePlayerFromTeam(teamId, userId);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Player removed from team");
      }
    } catch {
      toast.error("Failed to remove player");
    } finally {
      setUpdating(null);
    }
  };

  if (!players || players.length === 0) {
    return (
      <EmptyState
        icon={Users}
        title="No players in this squad yet"
        description={
          allowEdit
            ? "Add players, then choose the captain, vice-captain and keeper."
            : "No players have been added to this squad yet."
        }
      />
    );
  }
  const roleOf = (role?: string) =>
    role === "captain"
      ? "Captain (c)"
      : role === "vice_captain"
        ? "Vice-captain (vc)"
        : role === "wicket_keeper"
          ? "Wicket-keeper (wk)"
          : formatPlayerRole(role);

  return (
    <ListCard aria-label="Squad">
      {players.map((player) => {
        const name = player.user?.full_name ?? "Player";
        const lead =
          player.role_in_team === "captain" ||
          player.role_in_team === "vice_captain" ||
          player.role_in_team === "wicket_keeper";
        return (
          <div
            key={player.id}
            className="flex min-h-14 items-center gap-3 px-4 py-2 [contain-intrinsic-size:auto_3.5rem] [content-visibility:auto]"
          >
            <Avatar name={name} src={player.user?.avatar_url} size="sm" />
            <span className="min-w-0 flex-1">
              <Link
                href={`/players/${player.user_id}?teamId=${teamId}${tournamentId ? `&tournamentId=${encodeURIComponent(tournamentId)}` : ""}${clubId ? `&clubId=${encodeURIComponent(clubId)}` : ""}`}
                className="block truncate text-sm font-medium text-foreground hover:text-primary"
              >
                {name}
              </Link>
              <span
                className={
                  lead
                    ? "block truncate text-xs font-medium text-primary"
                    : "block truncate text-xs text-muted-foreground"
                }
              >
                {roleOf(player.role_in_team)}
              </span>
            </span>
            {player.jersey_number != null && (
              <span className="shrink-0 font-score text-sm tabular-nums text-muted-foreground">
                #{player.jersey_number}
              </span>
            )}
            {allowEdit && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Player actions for ${name}`}
                    disabled={updating === player.user_id}
                  >
                    {updating === player.user_id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <MoreHorizontal className="h-4 w-4" />
                    )}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuLabel>Actions</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => handleRoleChange(player.user_id, "captain")}
                  >
                    Make captain
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() =>
                      handleRoleChange(player.user_id, "vice_captain")
                    }
                  >
                    Make vice-captain
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() =>
                      handleRoleChange(player.user_id, "wicket_keeper")
                    }
                  >
                    Make wicket-keeper
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => handleRoleChange(player.user_id, "player")}
                  >
                    Set as regular player
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onClick={() => handleRemove(player.user_id)}
                  >
                    <Trash2 className="mr-2 h-4 w-4" /> Remove from team
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        );
      })}
    </ListCard>
  );
}
