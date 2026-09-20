"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
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
import { Shield, Loader2, UserPlus } from "lucide-react";
import { registerTeamForTournament } from "~/app/tournaments/actions";
import { toast } from "sonner";

export interface ClubTeamOption {
  id: string;
  name: string;
  short_name?: string | null;
  team_type?: string | null;
}

interface RegisterClubTeamDialogProps {
  tournament: {
    id: string;
    name: string;
  };
  clubTeams: ClubTeamOption[];
  registeredTeamIds?: string[];
  trigger?: React.ReactNode;
  onSuccess?: () => void;
}

export function RegisterClubTeamDialog({
  tournament,
  clubTeams,
  registeredTeamIds = [],
  trigger,
  onSuccess,
}: RegisterClubTeamDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [selectedTeamId, setSelectedTeamId] = useState<string>("");
  const [isPending, startTransition] = useTransition();

  const availableTeams = clubTeams.filter(
    (team) => !registeredTeamIds.includes(team.id),
  );

  const handleOpenChange = (newOpen: boolean) => {
    if (newOpen) {
      setSelectedTeamId("");
    }
    setOpen(newOpen);
  };

  const handleRegister = () => {
    if (!selectedTeamId) {
      toast.error("Please select a club squad to register");
      return;
    }

    const team = clubTeams.find((t) => t.id === selectedTeamId);

    startTransition(async () => {
      const res = await registerTeamForTournament(
        tournament.id,
        selectedTeamId,
      );
      if (res?.error) {
        toast.error(res.error);
      } else {
        toast.success(
          `Enrolled "${team?.name ?? "Squad"}" into ${tournament.name}!`,
        );
        setOpen(false);
        setSelectedTeamId("");
        router.refresh();
        onSuccess?.();
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {trigger ? (
          trigger
        ) : (
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1.5 text-xs"
            aria-label={`Enrol club squad into ${tournament.name}`}
          >
            <UserPlus className="h-3.5 w-3.5 text-primary" />
            Enrol Squad
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base font-bold">
            <Shield className="h-4 w-4 text-primary" />
            Enrol Squad in Tournament
          </DialogTitle>
          <DialogDescription className="text-xs">
            Enrol one of your club&apos;s registered playing squads into{" "}
            <span className="font-semibold text-foreground">
              {tournament.name}
            </span>
            .
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-3">
          {availableTeams.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
              {clubTeams.length === 0
                ? "No squads exist in this club yet. Create a club squad first."
                : "All club squads are already enrolled in this tournament."}
            </div>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="club-team-select" className="text-xs font-semibold">
                Select Club Squad
              </Label>
              <Select
                value={selectedTeamId}
                onValueChange={setSelectedTeamId}
              >
                <SelectTrigger id="club-team-select">
                  <SelectValue placeholder="Choose a club squad..." />
                </SelectTrigger>
                <SelectContent>
                  {availableTeams.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}{" "}
                      {t.short_name ? `(${t.short_name})` : ""}{" "}
                      {t.team_type ? `• ${t.team_type}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setOpen(false)}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={handleRegister}
            disabled={!selectedTeamId || isPending}
          >
            {isPending ? (
              <>
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                Enrolling...
              </>
            ) : (
              "Confirm Enrolment"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
