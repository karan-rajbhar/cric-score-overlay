"use client";

import { useMemo, useState } from "react";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { cn } from "~/lib/utils";
import type { BattingPerformance, TeamPlayer } from "~/lib/match-types";
import { PlayerPicker } from "./PlayerPicker";
import { buildBatterRows } from "./player-rows";

type Slot = "striker" | "nonStriker";

interface BatsmenDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  battingTeamPlayers: TeamPlayer[];
  battingTeamName?: string;
  /** This innings' batting figures (runs/balls, out, retired). */
  battingPerformances?: BattingPerformance[];
  bowlingTeamPlayerIds?: Set<string>;
  currentBowlerId?: string | null;
  strikerId: string | null;
  nonStrikerId: string | null;
  dismissedPlayerIds?: Set<string>;
  onStrikerChange: (v: string) => void;
  onNonStrikerChange: (v: string) => void;
  /** Receives the pair to confirm, including a preselected next batter. */
  onConfirm: (pair: { strikerId: string; nonStrikerId: string }) => void;
  isProcessing: boolean;
  /** Creates a player in the batting side; resolves to the new id. */
  onCreatePlayer?: (name: string) => Promise<string | null>;
  /** Set while adding is impossible (e.g. offline). */
  addPlayerDisabledReason?: string | null;
}

export function BatsmenDialog({
  open,
  onOpenChange,
  battingTeamPlayers,
  battingTeamName,
  battingPerformances,
  bowlingTeamPlayerIds,
  currentBowlerId,
  strikerId,
  nonStrikerId,
  dismissedPlayerIds,
  onStrikerChange,
  onNonStrikerChange,
  onConfirm,
  isProcessing,
  onCreatePlayer,
  addPlayerDisabledReason,
}: BatsmenDialogProps) {
  const firstEmpty: Slot =
    !strikerId && nonStrikerId
      ? "striker"
      : !nonStrikerId && strikerId
        ? "nonStriker"
        : "striker";
  const [activeSlot, setActiveSlot] = useState<Slot>(firstEmpty);
  // Point at the empty slot each time the dialog opens.
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setActiveSlot(firstEmpty);
  }

  const { rows, nextInId } = useMemo(
    () =>
      buildBatterRows({
        players: battingTeamPlayers,
        performances: battingPerformances,
        dismissedIds: dismissedPlayerIds,
        excludeIds: bowlingTeamPlayerIds,
        bowlerId: currentBowlerId,
        strikerId,
        nonStrikerId,
      }),
    [
      battingTeamPlayers,
      battingPerformances,
      dismissedPlayerIds,
      bowlingTeamPlayerIds,
      currentBowlerId,
      strikerId,
      nonStrikerId,
    ],
  );

  // After a wicket one end is empty: suggest the next batter in, but only
  // apply it when the scorer confirms.
  const suggestion =
    nextInId && Boolean(strikerId) !== Boolean(nonStrikerId) ? nextInId : null;
  const draftStriker = strikerId ?? suggestion;
  const draftNonStriker = nonStrikerId ?? (strikerId ? suggestion : null);

  const nameOf = (id: string | null) =>
    id ? (rows.find((r) => r.id === id)?.name ?? "Unknown") : null;

  const isOpponent = (id: string | null) =>
    Boolean(
      id &&
        ((currentBowlerId && id === currentBowlerId) ||
          bowlingTeamPlayerIds?.has(id)),
    );

  const select = (id: string) => {
    const current = activeSlot === "striker" ? strikerId : nonStrikerId;
    const other = activeSlot === "striker" ? nonStrikerId : strikerId;
    const setThis =
      activeSlot === "striker" ? onStrikerChange : onNonStrikerChange;
    const setOther =
      activeSlot === "striker" ? onNonStrikerChange : onStrikerChange;
    if (id === current) return;
    setThis(id);
    if (id === other) {
      // Picking the batter at the other end swaps the two.
      if (current) setOther(current);
    } else if (!other) {
      setActiveSlot(activeSlot === "striker" ? "nonStriker" : "striker");
    }
  };

  const createPlayer = onCreatePlayer
    ? async (name: string) => onCreatePlayer(name)
    : undefined;

  const canConfirm =
    Boolean(draftStriker && draftNonStriker) &&
    draftStriker !== draftNonStriker &&
    !isOpponent(draftStriker) &&
    !isOpponent(draftNonStriker) &&
    !isProcessing;

  const confirm = () => {
    if (!canConfirm || !draftStriker || !draftNonStriker) return;
    if (draftStriker !== strikerId) onStrikerChange(draftStriker);
    if (draftNonStriker !== nonStrikerId) onNonStrikerChange(draftNonStriker);
    onConfirm({ strikerId: draftStriker, nonStrikerId: draftNonStriker });
  };

  const slotButton = (slot: Slot, label: string, id: string | null) => {
    const active = activeSlot === slot;
    const suggested =
      id !== null &&
      id === suggestion &&
      id !== (slot === "striker" ? strikerId : nonStrikerId);
    return (
      <button
        type="button"
        aria-pressed={active}
        onClick={() => setActiveSlot(slot)}
        className={cn(
          "flex min-h-14 min-w-0 flex-col items-start justify-center rounded-lg border px-3 py-2 text-left transition-colors",
          active
            ? "border-primary bg-primary/10"
            : "border-border/70 bg-background hover:bg-muted",
        )}
      >
        <span className="text-xs text-muted-foreground">{label}</span>
        <span
          className={cn(
            "w-full truncate text-sm font-medium",
            !id && "text-muted-foreground",
          )}
        >
          {nameOf(id) ?? "Choose"}
        </span>
        {suggested && (
          <span className="text-xs text-muted-foreground">Next in</span>
        )}
      </button>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Select batsmen</DialogTitle>
          <DialogDescription>
            Tap a player to fill the highlighted end.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            {slotButton("striker", "Striker", draftStriker)}
            {slotButton("nonStriker", "Non-striker", draftNonStriker)}
          </div>

          <PlayerPicker
            label={
              activeSlot === "striker" ? "Choose striker" : "Choose non-striker"
            }
            rows={rows}
            selectedId={
              activeSlot === "striker" ? draftStriker : draftNonStriker
            }
            onSelect={select}
            addPlayer={
              createPlayer
                ? {
                    teamName: battingTeamName ?? "the batting side",
                    onAdd: createPlayer,
                    disabledReason: addPlayerDisabledReason,
                  }
                : undefined
            }
            emptyMessage="No players in the batting squad yet."
          />

          <Button
            className="h-11 w-full text-sm font-semibold"
            onClick={confirm}
            disabled={!canConfirm}
          >
            Confirm
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
