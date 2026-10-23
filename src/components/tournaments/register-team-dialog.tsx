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
import Link from "next/link";
import { Plus, Loader2 } from "lucide-react";
import { registerTeamForTournament } from "~/app/tournaments/actions";
import { toast } from "sonner";
import { NETWORK_ERROR_MESSAGE } from "~/lib/network-error";

interface TeamOption {
  id: string;
  name: string;
  short_name: string | null;
}

interface RegisterTeamDialogProps {
  tournamentId: string;
  availableTeams: TeamOption[];
  registeredTeamIds: string[];
  /** Organisers add teams directly; anyone else sends a request. */
  isOrganiser?: boolean;
}

export function RegisterTeamDialog({
  tournamentId,
  availableTeams,
  registeredTeamIds,
  isOrganiser = false,
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
      let res: Awaited<ReturnType<typeof registerTeamForTournament>>;
      try {
        res = await registerTeamForTournament(tournamentId, selectedTeamId);
      } catch {
        toast.error(NETWORK_ERROR_MESSAGE);
        return;
      }
      if (res?.error) {
        toast.error(res.error);
      } else {
        toast.success(
          "status" in res && res.status === "pending"
            ? "Request sent. The organisers confirm it before the team joins the points table."
            : "Team added to the tournament",
        );
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
          Register team
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Register a team</DialogTitle>
          <DialogDescription>
            {isOrganiser
              ? "The team joins the fixtures and points table straight away."
              : "The organisers confirm your request before the team joins the fixtures and points table."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-3">
          {availableTeams.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              There are no teams to register yet.{" "}
              <Link
                href={`/teams/create?tournamentId=${tournamentId}`}
                className="font-medium text-foreground underline underline-offset-4"
              >
                Create a team
              </Link>
            </p>
          ) : unregisteredTeams.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {isOrganiser
                ? "Every team is already registered in this tournament."
                : "Your teams are already registered or waiting for the organisers."}
            </p>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="team-select">Select team</Label>
              <Select value={selectedTeamId} onValueChange={setSelectedTeamId}>
                <SelectTrigger id="team-select">
                  <SelectValue placeholder="Choose a team" />
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
                Registering…
              </>
            ) : isOrganiser ? (
              "Add team"
            ) : (
              "Send request"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
