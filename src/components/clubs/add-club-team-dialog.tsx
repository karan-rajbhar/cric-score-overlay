"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { TeamCrest } from "~/components/ds/avatar";
import { Button } from "~/components/ds/button";
import { ListCard, ListRow } from "~/components/ds/list";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog";
import {
  getTeamsForClub,
  setTeamClub,
  type ClubTeamCandidate,
} from "~/app/clubs/club-teams";
import { NETWORK_ERROR_MESSAGE } from "~/lib/network-error";

/**
 * "Add a team" on a club's Teams tab: brings an existing team into the
 * club instead of creating it again (a second team splits its records).
 * The teams in the club's matches come first; the list is read when it
 * opens.
 */
export function AddClubTeamDialog({
  clubId,
  clubName,
}: {
  clubId: string;
  clubName: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [teams, setTeams] = useState<ClubTeamCandidate[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState<string | null>(null);

  const load = async () => {
    setTeams(null);
    setError(null);
    try {
      const res = await getTeamsForClub(clubId);
      if (res.error) setError(res.error);
      else setTeams(res.teams);
    } catch {
      setError(NETWORK_ERROR_MESSAGE);
    }
  };

  const add = async (team: ClubTeamCandidate) => {
    setAdding(team.id);
    try {
      const res = await setTeamClub(team.id, clubId);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success(`${team.name} is now a ${clubName} team`);
      setTeams((list) => list?.filter((t) => t.id !== team.id) ?? null);
      router.refresh();
    } catch {
      toast.error(NETWORK_ERROR_MESSAGE);
    } finally {
      setAdding(null);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) void load();
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          Add a team
        </Button>
      </DialogTrigger>
      <DialogContent className="flex max-h-[calc(100dvh-2rem)] flex-col gap-3 overflow-hidden sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="px-8 text-balance">Add a team to {clubName}</DialogTitle>
          <DialogDescription>
            A team that already plays keeps its squad and matches. The teams
            in {clubName}&apos;s matches are listed first.
          </DialogDescription>
        </DialogHeader>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {error ? (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          ) : teams === null ? (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              Finding teams
            </p>
          ) : teams.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No other teams to add: every team you run or that played for{" "}
              {clubName} is in it already.
            </p>
          ) : (
            <ListCard aria-label="Teams to add">
              {teams.map((team) => (
                <ListRow
                  key={team.id}
                  leading={
                    <TeamCrest
                      name={team.name}
                      shortName={team.short_name}
                      logoUrl={team.logo_url}
                      size="sm"
                    />
                  }
                  title={team.name}
                  subtitle={
                    [
                      team.playedForClub ? `Played for ${clubName}` : null,
                      team.inOtherClub ? "In another club: adding moves it" : null,
                      team.canAdd ? null : "Its captain or creator can add it",
                    ]
                      .filter(Boolean)
                      .join(" · ") || undefined
                  }
                  trailing={
                    team.canAdd ? (
                      <Button
                        size="sm"
                        variant="soft"
                        loading={adding === team.id}
                        disabled={adding !== null}
                        onClick={() => void add(team)}
                        aria-label={`Add ${team.name} to ${clubName}`}
                      >
                        Add
                      </Button>
                    ) : undefined
                  }
                />
              ))}
            </ListCard>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
