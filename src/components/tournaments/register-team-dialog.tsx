"use client";

import { useEffect, useState, useTransition } from "react";
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
import {
  getRegistrableTeams,
  registerTeamForTournament,
} from "~/app/tournaments/actions";
import { toast } from "sonner";
import { NETWORK_ERROR_MESSAGE } from "~/lib/network-error";

interface TeamOption {
  id: string;
  name: string;
  short_name: string | null;
}

interface RegisterTeamDialogProps {
  tournamentId: string;
  /**
   * The teams the user may register. Left out for organisers, who may
   * register any team: the dialog reads the list when it opens.
   */
  availableTeams?: TeamOption[];
  registeredTeamIds: string[];
  /** Organisers add teams directly; anyone else sends a request. */
  isOrganiser?: boolean;
}

/**
 * The teams to offer: those given, or (organisers) every team, read once
 * when the dialog first opens.
 */
function useRegistrableTeams(
  tournamentId: string,
  open: boolean,
  given: TeamOption[] | undefined,
) {
  const [loaded, setLoaded] = useState<TeamOption[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const loads = !given;
  useEffect(() => {
    if (!open || !loads || loaded) return;
    let cancelled = false;
    getRegistrableTeams(tournamentId)
      .then((res) => {
        if (cancelled) return;
        setLoaded(res.data);
        setError(res.error);
      })
      .catch(() => {
        if (!cancelled) setError(NETWORK_ERROR_MESSAGE);
      });
    return () => {
      cancelled = true;
    };
  }, [open, loads, loaded, tournamentId]);
  return {
    teams: given ?? loaded ?? [],
    loading: loads && !loaded && !error,
    error,
  };
}

function LoadStatus({ error }: { error: string | null }) {
  return error ? (
    <p role="alert" className="text-sm text-destructive">
      {error}
    </p>
  ) : (
    <p
      role="status"
      className="flex items-center gap-2 text-sm text-muted-foreground"
    >
      <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
      Loading teams…
    </p>
  );
}

export function RegisterTeamDialog({
  tournamentId,
  availableTeams: givenTeams,
  registeredTeamIds,
  isOrganiser = false,
}: RegisterTeamDialogProps) {
  const [open, setOpen] = useState(false);
  const [selectedTeamId, setSelectedTeamId] = useState<string>("");
  const [isPending, startTransition] = useTransition();
  const {
    teams: availableTeams,
    loading,
    error: loadError,
  } = useRegistrableTeams(tournamentId, open, givenTeams);

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
          {loading || loadError ? (
            <LoadStatus error={loadError} />
          ) : availableTeams.length === 0 ? (
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
