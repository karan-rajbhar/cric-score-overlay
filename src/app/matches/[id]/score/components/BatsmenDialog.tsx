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
import { UserPlus, X } from "lucide-react";
import type { TeamPlayer } from "~/lib/match-types";

interface BatsmenDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  battingTeamPlayers: TeamPlayer[];
  bowlingTeamPlayerIds?: Set<string>;
  currentBowlerId?: string | null;
  strikerId: string | null;
  nonStrikerId: string | null;
  dismissedPlayerIds?: Set<string>;
  onStrikerChange: (v: string) => void;
  onNonStrikerChange: (v: string) => void;
  onConfirm: () => void;
  isProcessing: boolean;
  addPlayerTarget: string | null;
  newPlayerName: string;
  onNewPlayerNameChange: (v: string) => void;
  onAddPlayer: () => void;
  onAddPlayerTargetChange: (v: "batting" | "bowling" | null) => void;
}

export function BatsmenDialog({
  open,
  onOpenChange,
  battingTeamPlayers,
  bowlingTeamPlayerIds,
  currentBowlerId,
  strikerId,
  nonStrikerId,
  dismissedPlayerIds,
  onStrikerChange,
  onNonStrikerChange,
  onConfirm,
  isProcessing,
  addPlayerTarget,
  newPlayerName,
  onNewPlayerNameChange,
  onAddPlayer,
  onAddPlayerTargetChange,
}: BatsmenDialogProps) {
  const uniquePlayers = Array.from(
    new Map(
      battingTeamPlayers
        .filter(
          (p) =>
            p &&
            p.user_id &&
            (!bowlingTeamPlayerIds || !bowlingTeamPlayerIds.has(p.user_id)),
        )
        .map((p) => [p.user_id, p]),
    ).values(),
  );

  const isStrikerOpponent = Boolean(
    (currentBowlerId && strikerId === currentBowlerId) ||
      (strikerId && bowlingTeamPlayerIds?.has(strikerId)),
  );
  const isNonStrikerOpponent = Boolean(
    (currentBowlerId && nonStrikerId === currentBowlerId) ||
      (nonStrikerId && bowlingTeamPlayerIds?.has(nonStrikerId)),
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Select / Change Batsmen</DialogTitle>
          <DialogDescription>
            Assign or replace the striker and non-striker at the crease. You
            can correct wrong player selections at any point mid-game.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 pt-4">
          <div>
            <label className="text-sm font-medium">Striker</label>
            <Select value={strikerId || ""} onValueChange={onStrikerChange}>
              <SelectTrigger className="mt-2">
                <SelectValue placeholder="Select striker" />
              </SelectTrigger>
              <SelectContent>
                {uniquePlayers.length === 0 ? (
                  <div className="p-3 text-center text-xs text-muted-foreground">
                    No players in squad yet. Add one below.
                  </div>
                ) : (
                  uniquePlayers.map((player) => {
                    const isNonStriker = player.user_id === nonStrikerId;
                    const isOut = dismissedPlayerIds?.has(player.user_id);
                    const isOpponent = Boolean(
                      (currentBowlerId && player.user_id === currentBowlerId) ||
                        bowlingTeamPlayerIds?.has(player.user_id),
                    );
                    return (
                      <SelectItem
                        key={player.user_id}
                        value={player.user_id}
                        disabled={isNonStriker || isOut || isOpponent}
                      >
                        {player.user?.full_name ?? "Unknown"}
                        {isNonStriker ? " (Non-Striker)" : ""}
                        {isOut ? " (Out)" : ""}
                        {isOpponent ? " (Opposing Team / Bowling)" : ""}
                      </SelectItem>
                    );
                  })
                )}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-sm font-medium">Non-Striker</label>
            <Select
              value={nonStrikerId || ""}
              onValueChange={onNonStrikerChange}
            >
              <SelectTrigger className="mt-2">
                <SelectValue placeholder="Select non-striker" />
              </SelectTrigger>
              <SelectContent>
                {uniquePlayers.length === 0 ? (
                  <div className="p-3 text-center text-xs text-muted-foreground">
                    No players in squad yet. Add one below.
                  </div>
                ) : (
                  uniquePlayers.map((player) => {
                    const isStriker = player.user_id === strikerId;
                    const isOut = dismissedPlayerIds?.has(player.user_id);
                    const isOpponent = Boolean(
                      (currentBowlerId && player.user_id === currentBowlerId) ||
                        bowlingTeamPlayerIds?.has(player.user_id),
                    );
                    return (
                      <SelectItem
                        key={player.user_id}
                        value={player.user_id}
                        disabled={isStriker || isOut || isOpponent}
                      >
                        {player.user?.full_name ?? "Unknown"}
                        {isStriker ? " (Striker)" : ""}
                        {isOut ? " (Out)" : ""}
                        {isOpponent ? " (Opposing Team / Bowling)" : ""}
                      </SelectItem>
                    );
                  })
                )}
              </SelectContent>
            </Select>
          </div>

          {addPlayerTarget === "batting" ? (
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
                aria-label="Cancel adding player"
                onClick={() => onAddPlayerTargetChange(null)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => onAddPlayerTargetChange("batting")}
              className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
            >
              <UserPlus className="h-3.5 w-3.5" /> New player? Add to squad
            </button>
          )}

          <Button
            className="w-full h-11 min-h-[44px] text-sm font-bold shadow-md"
            onClick={onConfirm}
            disabled={
              !strikerId ||
              !nonStrikerId ||
              strikerId === nonStrikerId ||
              isStrikerOpponent ||
              isNonStrikerOpponent ||
              isProcessing
            }
          >
            Confirm
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
