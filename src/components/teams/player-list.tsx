"use client";

import { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { MoreHorizontal, Trash2, Crown, Shield } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { removePlayerFromTeam, updatePlayerRole } from "~/app/teams/actions";
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
    email?: string;
    avatar_url?: string;
  };
}

interface PlayerListProps {
  teamId: string;
  players: Player[];
  allowEdit?: boolean;
}

export function PlayerList({
  teamId,
  players,
  allowEdit = false,
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

  const getRoleBadge = (role?: string) => {
    switch (role) {
      case "captain":
        return (
          <Badge className="border-yellow-200 bg-yellow-500/10 text-yellow-600 hover:bg-yellow-500/20">
            Captain
          </Badge>
        );
      case "vice_captain":
        return (
          <Badge className="border-blue-200 bg-blue-500/10 text-blue-600 hover:bg-blue-500/20">
            Vice Captain
          </Badge>
        );
      case "wicket_keeper":
        return <Badge variant="outline">Wicket Keeper</Badge>;
      default:
        return (
          <span className="text-sm capitalize text-muted-foreground">
            {role || "Player"}
          </span>
        );
    }
  };

  if (!players || players.length === 0) {
    return (
      <div className="rounded-lg border bg-muted/20 py-12 text-center">
        <p className="text-muted-foreground">No players in this team yet.</p>
        {allowEdit && (
          <p className="mt-1 text-sm">
            Click "Add Player" to build your squad.
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[50px]">#</TableHead>
            <TableHead>Player</TableHead>
            <TableHead>Role</TableHead>
            {allowEdit && <TableHead className="w-[50px]"></TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {players.map((player, idx) => (
            <TableRow key={player.id}>
              <TableCell className="font-medium">{idx + 1}</TableCell>
              <TableCell>
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-sm font-medium">
                    {player.user?.full_name?.substring(0, 1)}
                  </div>
                  <div>
                    <p className="text-sm font-medium">
                      {player.user?.full_name}
                    </p>
                    {player.user?.email && (
                      <p className="text-xs text-muted-foreground">
                        {player.user.email}
                      </p>
                    )}
                  </div>
                </div>
              </TableCell>
              <TableCell>{getRoleBadge(player.role_in_team)}</TableCell>
              {allowEdit && (
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
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
                        onClick={() =>
                          handleRoleChange(player.user_id, "captain")
                        }
                      >
                        <Crown className="mr-2 h-4 w-4" /> Make Captain
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() =>
                          handleRoleChange(player.user_id, "vice_captain")
                        }
                      >
                        <Shield className="mr-2 h-4 w-4" /> Make Vice Captain
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() =>
                          handleRoleChange(player.user_id, "wicket_keeper")
                        }
                      >
                        Make Wicket Keeper
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() =>
                          handleRoleChange(player.user_id, "player")
                        }
                      >
                        Set as Regular Player
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="text-red-600 focus:text-red-600"
                        onClick={() => handleRemove(player.user_id)}
                      >
                        <Trash2 className="mr-2 h-4 w-4" /> Remove from Team
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
