"use client";

import { useMemo, useRef, useState } from "react";
import { ChoiceGroup } from "~/components/ds/field";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import type { BowlingPerformance, TeamPlayer } from "~/lib/match-types";
import {
  focusPickerRow,
  PlayerPicker,
  type PickerAddPlayer,
} from "./PlayerPicker";
import { buildBowlerRows } from "./player-rows";
import { RoleBand } from "./RoleBand";

/** Why a bowler changes once the over has balls in it. */
type ChangeReason = "wrong_bowler" | "cannot_finish";

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
  /**
   * Who the log has bowling this over (`overBowlingOf`), null before its
   * first delivery. Set, the scorer first says what happened: the two ways
   * of changing a bowler now do different things to those balls.
   */
  overBowling?: { bowlerId: string; balls: number } | null;
  /** The over being bowled (1-based), for the title. */
  overNumber?: number;
  /**
   * Receives the bowler to confirm. Nothing on the screen changes before:
   * the pick stays in the dialog until Confirm.
   */
  onConfirm: (bowlerId: string) => void;
  /** A wrong pick: the `overBowling` bowler's balls go to `bowlerId`. */
  onReassign?: (bowlerId: string) => void;
  isProcessing: boolean;
  /** Adds a player to the bowling side; resolves to their id. */
  onCreatePlayer?: PickerAddPlayer["onAdd"];
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
  overBowling = null,
  overNumber,
  onConfirm,
  onReassign,
  isProcessing,
  onCreatePlayer,
  addPlayerDisabledReason,
}: BowlerDialogProps) {
  const { rows } = useMemo(
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

  // The scorer's pick, starting from the current bowler (or nobody: a
  // wrong default would put the wrong bowler on). Mid-over nobody: the
  // change is away from the bowler on.
  const [draftBowlerId, setDraftBowlerId] = useState<string | null>(
    overBowling ? null : currentBowlerId,
  );
  const [reason, setReason] = useState<ChangeReason | null>(null);
  const [seen, setSeen] = useState("");
  const key = `${open}:${currentBowlerId}:${overBowling?.bowlerId}`;
  if (key !== seen) {
    setSeen(key);
    if (open) {
      setDraftBowlerId(overBowling ? null : currentBowlerId);
      setReason(null);
    }
  }

  const nameOf = (id: string | null | undefined) =>
    rows.find((r) => r.id === id)?.name ?? "The bowler";

  const blockedReason = (id: string | null): string | null => {
    if (!id) return null;
    if (lastOverBowlerId && id === lastOverBowlerId)
      return "This bowler bowled the last over. Choose someone else.";
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
    Boolean(draftBowlerId) &&
    (!overBowling || Boolean(reason)) &&
    !selectedBlocked &&
    !isProcessing;

  const confirm = (id: string | null = draftBowlerId) => {
    if (!id || blockedReason(id) || isProcessing) return;
    if (overBowling && !reason) return;
    if (reason === "wrong_bowler") onReassign?.(id);
    else onConfirm(id);
  };

  // The over's bowler is the one being corrected, or the one leaving.
  const pickable = overBowling
    ? rows.filter((r) => r.id !== overBowling.bowlerId)
    : rows;
  const overBowlerName = nameOf(overBowling?.bowlerId);
  const ballsBowled = `${overBowling?.balls} ball${overBowling?.balls === 1 ? "" : "s"}`;
  // The task, in the title; the action, on the button.
  const confirmLabel = !overBowling
    ? "Confirm bowler"
    : !reason
      ? "Choose what happened"
      : reason === "wrong_bowler"
        ? draftBowlerId
          ? `Give ${ballsBowled} to ${nameOf(draftBowlerId)}`
          : "Choose who bowled"
        : draftBowlerId
          ? `${nameOf(draftBowlerId)} finishes the over`
          : "Choose who finishes the over";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        ref={contentRef}
        className="sm:max-w-md"
        onOpenAutoFocus={(e) => focusPickerRow(e, contentRef.current)}
      >
        <DialogHeader className="space-y-2 text-left">
          <RoleBand role="bowling" teamName={bowlingTeamName} />
          <DialogTitle className="text-balance">
            {overBowling
              ? `Change the bowler of over ${overNumber ?? ""}`.trim()
              : overNumber
                ? `Choose the bowler for over ${overNumber}`
                : "Choose the bowler"}
          </DialogTitle>
          <DialogDescription>
            {overBowling
              ? `${overBowlerName} has bowled ${ballsBowled} in this over.`
              : "Figures are overs-maidens-runs-wickets."}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          {overBowling && (
            <ChoiceGroup
              legend="What happened?"
              name="bowler-change-reason"
              layout="cards"
              value={reason}
              onChange={setReason}
              options={[
                {
                  value: "wrong_bowler",
                  label: "Wrong bowler",
                  description: `${overBowlerName} did not bowl. Their ${ballsBowled} go to the right bowler.`,
                },
                {
                  value: "cannot_finish",
                  label: "Can't finish the over",
                  description: `Injured or suspended. ${overBowlerName} keeps ${ballsBowled} and another bowler bowls the rest.`,
                },
              ]}
            />
          )}

          {/* Mid-over the list waits for the answer, so it cannot be skipped */}
          {(!overBowling || reason) && (
            <PlayerPicker
              label={
                reason === "wrong_bowler"
                  ? "Who bowled"
                  : reason === "cannot_finish"
                    ? "Who finishes the over"
                    : "Choose bowler"
              }
              rows={pickable}
              selectedId={draftBowlerId}
              onSelect={setDraftBowlerId}
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
              noun="bowler"
            />
          )}

          {selectedBlocked && (
            <p className="text-xs text-destructive">{selectedBlocked}</p>
          )}

          {/* Pinned on phones: reachable however long the squad is */}
          <div className="max-sm:sticky max-sm:bottom-0 max-sm:z-10 max-sm:-mx-4 max-sm:-mb-4 max-sm:border-t max-sm:border-border/70 max-sm:bg-card max-sm:px-4 max-sm:pb-4 max-sm:pt-3">
            <Button
              className="h-11 w-full text-sm font-semibold"
              onClick={() => confirm()}
              disabled={!canConfirm}
            >
              {confirmLabel}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
