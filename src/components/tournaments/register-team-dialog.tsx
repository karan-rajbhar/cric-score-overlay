"use client";

import { useState, useTransition } from "react";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Label } from "~/components/ui/label";
import { Plus, Loader2 } from "lucide-react";
import { registerTeamForTournament } from "~/app/tournaments/actions";
import { toast } from "sonner";

interface TeamOption {
  id: string;
  name: string;
  short_name: string | null;
}

interface RegisterTeamDialogProps {
  tournamentId: string;
  availableTeams: TeamOption[];
  registeredTeamIds: string[];
}

export function RegisterTeamDialog({
  tournamentId,
  availableTeams,
  registeredTeamIds,
}: RegisterTeamDialogProps) {
  const [open, setOpen] = useState(false);
  const [selectedTeamId, setSelectedTeamId] = useState<string>("");
  const [isPending, startTransition] = useTransition();

  const unregisteredTeams = availableTeams.filter(
    (t) => !registeredTeamIds.includes(t.id),
  );

  const handleRegister = () => {
    if (!selectedTeamId) return;

    startTransition(async () => {
      const res = await registerTeamForTournament(tournamentId, selectedTeamId);
      if (res?.error) {
        toast.error(res.error);
      } else {
        toast.success("Team registered for tournament");
        setOpen(false);
        setSelectedTeamId("");
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-1.5">
          <Plus className="h-4 w-4" />
          Register Team
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Register Team for Tournament</DialogTitle>
          <DialogDescription>
            Select a team to add to the tournament fixtures and points table.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-3">
          {unregisteredTeams.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              All available teams are already registered in this tournament.
            </p>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="team-select">Select Team</Label>
              <Select value={selectedTeamId} onValueChange={setSelectedTeamId}>
                <SelectTrigger id="team-select">
                  <SelectValue placeholder="Choose a team..." />
                </SelectTrigger>
                <SelectContent>
                  {unregisteredTeams.map((team) => (
                    <SelectItem key={team.id} value={team.id}>
                      {team.name}{" "}
                      {team.short_name ? `(${team.short_name})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button
            onClick={handleRegister}
            disabled={!selectedTeamId || isPending}
          >
            {isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Registering...
              </>
            ) : (
              "Confirm Registration"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
