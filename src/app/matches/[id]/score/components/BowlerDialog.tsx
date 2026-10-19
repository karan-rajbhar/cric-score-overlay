"use client";

import { useMemo, useRef } from "react";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import type { BowlingPerformance, TeamPlayer } from "~/lib/match-types";
import { focusPickerRow, PlayerPicker } from "./PlayerPicker";
import { buildBowlerRows } from "./player-rows";

interface BowlerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bowlingTeamPlayers: TeamPlayer[];
  bowlingTeamName?: string;
  /** This innings' bowling figures. */
  bowlingPerformances?: BowlingPerformance[];
  oversPerInnings?: number | null;
  currentBowlerId: string | null;
  lastOverBowlerId?: string | null;
  strikerId?: string | null;
  nonStrikerId?: string | null;
  battingTeamPlayerIds?: Set<string>;
  currentBall?: number;
  reassignOverDeliveries?: boolean;
  onReassignOverDeliveriesChange?: (val: boolean) => void;
  onBowlerChange: (v: string) => void;
  /** Receives the bowler to confirm, including a preselected one. */
  onConfirm: (bowlerId: string) => void;
  isProcessing: boolean;
  /** Creates a player in the bowling side; resolves to the new id. */
  onCreatePlayer?: (name: string) => Promise<string | null>;
  /** Set while adding is impossible (e.g. offline). */
  addPlayerDisabledReason?: string | null;
}

export function BowlerDialog({
  open,
  onOpenChange,
  bowlingTeamPlayers,
  bowlingTeamName,
  bowlingPerformances,
  oversPerInnings,
  currentBowlerId,
  lastOverBowlerId,
  strikerId,
  nonStrikerId,
  battingTeamPlayerIds,
  currentBall,
  reassignOverDeliveries = false,
  onReassignOverDeliveriesChange,
  onBowlerChange,
  onConfirm,
  isProcessing,
  onCreatePlayer,
  addPlayerDisabledReason,
}: BowlerDialogProps) {
  const { rows, onlyEligibleId } = useMemo(
    () =>
      buildBowlerRows({
        players: bowlingTeamPlayers,
        performances: bowlingPerformances,
        excludeIds: battingTeamPlayerIds,
        batterIds: [strikerId, nonStrikerId],
        currentBowlerId,
        lastOverBowlerId,
        oversPerInnings,
      }),
    [
      bowlingTeamPlayers,
      bowlingPerformances,
      battingTeamPlayerIds,
      strikerId,
      nonStrikerId,
      currentBowlerId,
      lastOverBowlerId,
      oversPerInnings,
    ],
  );

  const contentRef = useRef<HTMLDivElement>(null);

  // With a single eligible bowler, preselect them; confirming applies it.
  const draftBowlerId = currentBowlerId ?? onlyEligibleId;

  const blockedReason = (id: string | null): string | null => {
    if (!id) return null;
    if (lastOverBowlerId && id === lastOverBowlerId)
      return "This bowler completed the previous over. Please select a different bowler.";
    if (
      id === strikerId ||
      id === nonStrikerId ||
      battingTeamPlayerIds?.has(id)
    )
      return "This player is currently batting for the opposing team and cannot bowl.";
    return null;
  };
  const selectedBlocked = blockedReason(draftBowlerId);
  const canConfirm =
    Boolean(draftBowlerId) && !selectedBlocked && !isProcessing;

  const confirm = (id: string | null = draftBowlerId) => {
    if (!id || blockedReason(id) || isProcessing) return;
    if (id !== currentBowlerId) onBowlerChange(id);
    onConfirm(id);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        ref={contentRef}
        className="sm:max-w-md"
        onOpenAutoFocus={(e) => focusPickerRow(e, contentRef.current)}
      >
        <DialogHeader>
          <DialogTitle>Select bowler</DialogTitle>
          <DialogDescription>
            Choose the bowler for this over. Figures are
            overs-maidens-runs-wickets.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <PlayerPicker
            label="Choose bowler"
            rows={rows}
            selectedId={draftBowlerId}
            onSelect={onBowlerChange}
            onSubmit={(id) => confirm(id)}
            addPlayer={
              onCreatePlayer
                ? {
                    teamName: bowlingTeamName ?? "the bowling side",
                    onAdd: onCreatePlayer,
                    disabledReason: addPlayerDisabledReason,
                  }
                : undefined
            }
            emptyMessage="No players in the bowling squad yet."
          />

          {selectedBlocked && (
            <p className="text-xs text-destructive">{selectedBlocked}</p>
          )}

          {currentBall !== undefined && currentBall > 0 && (
            <label
              htmlFor="reassign-bowler-over"
              className="flex min-h-11 cursor-pointer items-start gap-2.5 rounded-lg border p-3 text-sm"
            >
              <input
                id="reassign-bowler-over"
                type="checkbox"
                checked={reassignOverDeliveries}
                onChange={(e) =>
                  onReassignOverDeliveriesChange?.(e.target.checked)
                }
                className="mt-0.5 h-4 w-4 shrink-0 rounded border-input"
              />
              <span>
                Reassign {currentBall} ball{currentBall > 1 ? "s" : ""} bowled
                in this over to this bowler (correct wrong bowler selection)
              </span>
            </label>
          )}

          {/* Pinned on phones: reachable however long the squad is */}
          <div className="max-sm:sticky max-sm:bottom-0 max-sm:z-10 max-sm:-mx-4 max-sm:-mb-4 max-sm:border-t max-sm:border-border/70 max-sm:bg-card max-sm:px-4 max-sm:pb-4 max-sm:pt-3">
            <Button
              className="h-11 w-full text-sm font-semibold"
              onClick={() => confirm()}
              disabled={!canConfirm}
            >
              Confirm bowler
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
