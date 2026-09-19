"use client";

import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { UserPlus } from "lucide-react";
import type { TeamPlayer } from "~/lib/match-types";

interface BowlerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bowlingTeamPlayers: TeamPlayer[];
  currentBowlerId: string | null;
  lastOverBowlerId?: string | null;
  onBowlerChange: (v: string) => void;
  onConfirm: () => void;
  isProcessing: boolean;
  addPlayerTarget: string | null;
  newPlayerName: string;
  onNewPlayerNameChange: (v: string) => void;
  onAddPlayer: () => void;
  onAddPlayerTargetChange: (v: "batting" | "bowling" | null) => void;
}

export function BowlerDialog({
  open,
  onOpenChange,
  bowlingTeamPlayers,
  currentBowlerId,
  lastOverBowlerId,
  onBowlerChange,
  onConfirm,
  isProcessing,
  addPlayerTarget,
  newPlayerName,
  onNewPlayerNameChange,
  onAddPlayer,
  onAddPlayerTargetChange,
}: BowlerDialogProps) {
  const isSelectedBowlerConsecutive = Boolean(
    currentBowlerId && lastOverBowlerId && currentBowlerId === lastOverBowlerId,
  );

  const uniqueBowlingPlayers = Array.from(
    new Map(
      bowlingTeamPlayers
        .filter((p) => p && p.user_id)
        .map((p) => [p.user_id, p]),
    ).values(),
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Select Bowler</DialogTitle>
          <DialogDescription>
            Choose the bowler to deliver the next over.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 pt-4">
          <Select value={currentBowlerId || ""} onValueChange={onBowlerChange}>
            <SelectTrigger>
              <SelectValue placeholder="Select bowler" />
            </SelectTrigger>
            <SelectContent>
              {uniqueBowlingPlayers.length === 0 ? (
                <div className="p-3 text-center text-xs text-muted-foreground">
                  No players in bowling squad yet. Add one below.
                </div>
              ) : (
                uniqueBowlingPlayers.map((player) => {
                  const isConsecutive = Boolean(
                    lastOverBowlerId && player.user_id === lastOverBowlerId,
                  );
                  return (
                    <SelectItem
                      key={player.user_id}
                      value={player.user_id}
                      disabled={isConsecutive}
                    >
                      {player.user?.full_name ?? "Unknown"}
                      {isConsecutive ? " (Cannot bowl consecutive overs)" : ""}
                    </SelectItem>
                  );
                })
              )}
            </SelectContent>
          </Select>

          {isSelectedBowlerConsecutive && (
            <p className="text-xs text-destructive">
              This bowler completed the previous over. Please select a different
              bowler.
            </p>
          )}

          {addPlayerTarget === "bowling" ? (
            <div className="flex gap-2">
              <Input
                placeholder="Player name"
                value={newPlayerName}
                onChange={(e) => onNewPlayerNameChange(e.target.value)}
                autoFocus
                onKeyDown={(e) => e.key === "Enter" && void onAddPlayer()}
              />
              <Button
                type="button"
                variant="secondary"
                onClick={() => void onAddPlayer()}
                disabled={!newPlayerName.trim() || isProcessing}
              >
                Add
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Cancel adding bowler"
                onClick={() => onAddPlayerTargetChange(null)}
              >
                ✕
              </Button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => onAddPlayerTargetChange("bowling")}
              className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
            >
              <UserPlus className="h-3.5 w-3.5" /> New player? Add to squad
            </button>
          )}

          <Button
            className="w-full"
            onClick={onConfirm}
            disabled={
              !currentBowlerId || isSelectedBowlerConsecutive || isProcessing
            }
          >
            Confirm Bowler
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
