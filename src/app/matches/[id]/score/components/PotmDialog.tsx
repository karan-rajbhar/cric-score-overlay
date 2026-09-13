"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "~/components/ui/dialog";
import { Button } from "~/components/ui/button";
import { Award, Check, User } from "lucide-react";
import { toast } from "sonner";
import { setPlayerOfTheMatch } from "~/app/matches/mutations";

interface PlayerOption {
  id: string;
  name: string;
  avatarUrl?: string | null;
  teamName: string;
  stats?: string;
}

interface PotmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  matchId: string;
  players: PlayerOption[];
  currentPotmId?: string | null;
  onSuccess?: (potmId: string) => void;
}

export function PotmDialog({
  open,
  onOpenChange,
  matchId,
  players,
  currentPotmId,
  onSuccess,
}: PotmDialogProps) {
  const [selectedPlayerId, setSelectedPlayerId] = useState<string>(
    currentPotmId ?? "",
  );
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    if (!selectedPlayerId) {
      toast.error("Please select a player");
      return;
    }

    setIsSaving(true);
    try {
      const res = await setPlayerOfTheMatch(matchId, selectedPlayerId);
      if (res.error) {
        toast.error(res.error);
      } else {
        toast.success("Player of the Match awarded successfully!");
        onOpenChange(false);
        onSuccess?.(selectedPlayerId);
      }
    } catch (err) {
      console.error("Failed to save POTM:", err);
      toast.error("An unexpected error occurred");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="mb-1 flex items-center gap-2 text-amber-500">
            <Award className="h-6 w-6" />
            <span className="text-xs font-semibold uppercase tracking-wider">
              Match Honors
            </span>
          </div>
          <DialogTitle className="text-xl">
            Award Player of the Match
          </DialogTitle>
          <DialogDescription>
            Select the standout player of this fixture to be featured on
            scorecards and broadcast graphics.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[300px] space-y-2 overflow-y-auto py-2 pr-1">
          {players.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No players available to award.
            </p>
          ) : (
            players.map((p) => {
              const isSelected = selectedPlayerId === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setSelectedPlayerId(p.id)}
                  className={`flex w-full items-center justify-between rounded-lg border p-3 text-left transition-all ${
                    isSelected
                      ? "border-amber-500/80 bg-amber-500/10 text-foreground ring-1 ring-amber-500/50"
                      : "border-border text-foreground hover:bg-muted/50"
                  }`}
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center overflow-hidden rounded-full border border-border/50 bg-muted">
                      {p.avatarUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={p.avatarUrl}
                          alt={p.name}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <User className="h-4 w-4 text-muted-foreground" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{p.name}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {p.teamName}
                      </p>
                    </div>
                  </div>
                  {isSelected && (
                    <Check className="h-5 w-5 flex-shrink-0 text-amber-500" />
                  )}
                </button>
              );
            })
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={!selectedPlayerId || isSaving}
            className="bg-amber-600 text-white hover:bg-amber-500"
          >
            {isSaving ? "Awarding..." : "Confirm Award"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
