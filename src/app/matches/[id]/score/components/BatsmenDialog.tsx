"use client";

import { useMemo, useState } from "react";
import { ArrowLeftRight } from "lucide-react";
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
import { RoleBand } from "./RoleBand";

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
  /**
   * The end to change when both are filled (the scoreboard's Change on one
   * batter); the other batter stays.
   */
  focusEnd?: Slot | null;
  /** The batters at the crease now (null: that end is empty). */
  strikerId: string | null;
  nonStrikerId: string | null;
  dismissedPlayerIds?: Set<string>;
  /**
   * Receives the pair to confirm. Nothing on the screen changes before:
   * picks stay in the dialog until Confirm.
   */
  onConfirm: (pair: { strikerId: string; nonStrikerId: string }) => void;
  isProcessing: boolean;
  /** Creates a player in the batting side; resolves to the new id. */
  onCreatePlayer?: (name: string) => Promise<string | null>;
  /** Set while adding is impossible (e.g. offline). */
  addPlayerDisabledReason?: string | null;
  /**
   * Ends the innings: offered when a wicket leaves nobody to come in (a
   * short squad all out), next to adding a player.
   */
  onEndInnings?: () => void;
  /**
   * Retires a batter at the crease (opens the retire dialog): offered for
   * one who has batted, whom Change cannot take off.
   */
  onRetire?: (playerId: string) => void;
}

/**
 * Whether a batter has something on the scorecard (a ball faced, a run, a
 * retirement). Change is for a wrong pick before that: taking such a batter
 * off without a record would leave them "not out" with their runs, off the
 * crease. They retire instead (as PlayHQ allows a change only before the
 * batter's first ball).
 */
function hasBatted(perf: BattingPerformance | undefined): boolean {
  return Boolean(
    perf &&
      ((perf.balls_faced ?? 0) > 0 ||
        (perf.runs_scored ?? 0) > 0 ||
        perf.dismissal_type),
  );
}

/**
 * Who bats. Three cases:
 * - start of an innings (both ends empty): striker, then non-striker;
 * - after a wicket (one end empty): only the new batter is chosen (the
 *   next in is suggested); the not-out batter stays, and "Swap ends" sets
 *   who faces the next ball;
 * - both at the crease (a batter's Change): either end can be changed, as
 *   long as the batter leaving has not batted yet (otherwise: retire).
 */
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
  focusEnd = null,
  dismissedPlayerIds,
  onConfirm,
  isProcessing,
  onCreatePlayer,
  addPlayerDisabledReason,
  onEndInnings,
  onRetire,
}: BatsmenDialogProps) {
  /** The not-out batter after a wicket (their end is not to be replaced). */
  const survivor =
    Boolean(strikerId) !== Boolean(nonStrikerId)
      ? (strikerId ?? nonStrikerId)
      : null;

  const [draft, setDraft] = useState<{
    striker: string | null;
    nonStriker: string | null;
  }>({ striker: strikerId, nonStriker: nonStrikerId });
  const firstEmpty = (d: typeof draft): Slot =>
    !d.striker ? "striker" : !d.nonStriker ? "nonStriker" : "striker";
  const [activeSlot, setActiveSlot] = useState<Slot>(firstEmpty(draft));
  const { rows } = useMemo(
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

  // Start from the crease each time the dialog opens (or the crease
  // changes meanwhile, e.g. a co-scorer's change). Nobody is picked for
  // the scorer: a wrong default would be a wrong scorecard, so the empty
  // end stays empty until they tap a batter.
  const crease = `${open}:${strikerId}:${nonStrikerId}:${focusEnd}`;
  const [seen, setSeen] = useState("");
  if (crease !== seen) {
    setSeen(crease);
    if (open) {
      const fresh = { striker: strikerId, nonStriker: nonStrikerId };
      const empty = firstEmpty(fresh);
      setDraft(fresh);
      setActiveSlot(strikerId && nonStrikerId && focusEnd ? focusEnd : empty);
    }
  }

  const nameOf = (id: string | null) =>
    id ? (rows.find((r) => r.id === id)?.name ?? "Unknown") : null;
  const perfOf = (id: string | null) =>
    id ? battingPerformances?.find((p) => p.user_id === id) : undefined;

  const isOpponent = (id: string | null) =>
    Boolean(
      id &&
        ((currentBowlerId && id === currentBowlerId) ||
          bowlingTeamPlayerIds?.has(id)),
    );

  const slotOf = (id: string | null): Slot | null =>
    id === null
      ? null
      : draft.striker === id
        ? "striker"
        : draft.nonStriker === id
          ? "nonStriker"
          : null;

  /** The end being filled after a wicket: the one without the survivor. */
  const newBatterSlot: Slot | null = survivor
    ? slotOf(survivor) === "striker"
      ? "nonStriker"
      : "striker"
    : null;

  const select = (id: string) => {
    const slot = newBatterSlot ?? activeSlot;
    const key = slot === "striker" ? "striker" : "nonStriker";
    const otherKey = key === "striker" ? "nonStriker" : "striker";
    const current = draft[key];
    if (id === current) return;
    if (id === draft[otherKey]) {
      // Picking the batter at the other end swaps the two (not after a
      // wicket: the not-out batter is not the one being chosen).
      if (newBatterSlot) return;
      setDraft({ ...draft, [key]: id, [otherKey]: current });
      return;
    }
    const next = { ...draft, [key]: id };
    setDraft(next);
    if (!newBatterSlot && !next[otherKey]) setActiveSlot(otherKey);
  };

  const swapEnds = () => {
    setDraft({ striker: draft.nonStriker, nonStriker: draft.striker });
  };

  /** Batters at the crease now whom the draft would take off. */
  const leaving = [strikerId, nonStrikerId].filter(
    (id): id is string =>
      Boolean(id) && id !== draft.striker && id !== draft.nonStriker,
  );

  const canConfirm =
    Boolean(draft.striker && draft.nonStriker) &&
    draft.striker !== draft.nonStriker &&
    !isOpponent(draft.striker) &&
    !isOpponent(draft.nonStriker) &&
    !leaving.some((id) => hasBatted(perfOf(id))) &&
    !isProcessing;

  const confirm = () => {
    if (!canConfirm || !draft.striker || !draft.nonStriker) return;
    onConfirm({ strikerId: draft.striker, nonStrikerId: draft.nonStriker });
  };

  const slotButton = (slot: Slot, label: string, id: string | null) => {
    const locked = Boolean(newBatterSlot) && slot !== newBatterSlot;
    const active = newBatterSlot ? slot === newBatterSlot : activeSlot === slot;
    const note = locked ? "Not out" : null;
    return (
      <button
        type="button"
        aria-pressed={active}
        disabled={locked}
        onClick={() => setActiveSlot(slot)}
        className={cn(
          "flex min-h-14 min-w-0 flex-col items-start justify-center rounded-lg border px-3 py-2 text-left transition-colors disabled:cursor-default",
          active
            ? "border-primary bg-primary/10"
            : locked
              ? "border-border/70 bg-muted/40"
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
        {note && <span className="text-xs text-muted-foreground">{note}</span>}
      </button>
    );
  };

  const pickingFor = newBatterSlot ?? activeSlot;
  const changing = Boolean(strikerId && nonStrikerId && focusEnd);
  // Both in: the batter at the end being changed, when they have batted
  // (they retire instead of being replaced).
  const occupant =
    strikerId && nonStrikerId
      ? pickingFor === "striker"
        ? strikerId
        : nonStrikerId
      : null;
  const battedOccupant =
    occupant && hasBatted(perfOf(occupant)) ? occupant : null;
  // The task, in the title; the action, on the button.
  const title = survivor
    ? "Choose the new batter"
    : !strikerId && !nonStrikerId
      ? "Choose the opening batters"
      : changing
        ? `Change ${nameOf(focusEnd === "striker" ? strikerId : nonStrikerId) ?? "batter"}`
        : "Batters at the crease";
  const confirmLabel = survivor
    ? "Confirm new batter"
    : !strikerId && !nonStrikerId
      ? "Confirm openers"
      : changing
        ? "Confirm change"
        : "Confirm batters";
  // Only who can be picked: those out never are; after a wicket, the pair
  // at the crease is not being chosen either.
  const pickable = rows.filter(
    (r) =>
      !r.disabledReason &&
      !(survivor && (r.id === strikerId || r.id === nonStrikerId)),
  );
  // After a wicket with nobody left to come in: all out, unless a player
  // is added (local matches often add the next batter as he walks in).
  const nobodyLeft = Boolean(survivor) && pickable.length === 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="space-y-2 text-left">
          <RoleBand role="batting" teamName={battingTeamName} />
          <DialogTitle className="text-balance">{title}</DialogTitle>
          <DialogDescription>
            {survivor
              ? newBatterSlot === "striker"
                ? `The new batter faces the next ball, with ${nameOf(survivor) ?? "the not-out batter"} at the other end. Swap ends if ${nameOf(survivor) ?? "the not-out batter"} faces it instead.`
                : `${nameOf(survivor) ?? "The not-out batter"} faces the next ball. Swap ends if the new batter faces it instead.`
              : battedOccupant
                ? "Swap ends, or retire them to bring in another batter."
                : changing
                  ? "Tap who replaces them. The other batter stays."
                  : !strikerId && !nonStrikerId
                    ? "Tap the striker, then the non-striker."
                    : "Tap a player to fill the highlighted end."}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-[1fr_auto_1fr] items-stretch gap-2">
            {slotButton("striker", "Striker", draft.striker)}
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-auto w-9 self-stretch"
              onClick={swapEnds}
              disabled={!draft.striker && !draft.nonStriker}
              aria-label="Swap ends"
              title="Swap ends"
            >
              <ArrowLeftRight className="h-4 w-4" aria-hidden="true" />
            </Button>
            {slotButton("nonStriker", "Non-striker", draft.nonStriker)}
          </div>

          {nobodyLeft && (
            <div
              role="status"
              className="space-y-2 rounded-lg border border-border bg-muted/50 p-3 text-sm"
            >
              <p>
                Everyone in the squad has batted. Add the next batter below, or
                end the innings if the side is all out.
              </p>
              {onEndInnings && (
                <Button
                  type="button"
                  variant="outline"
                  className="h-10 w-full font-semibold"
                  onClick={onEndInnings}
                  disabled={isProcessing}
                >
                  End innings (all out)
                </Button>
              )}
            </div>
          )}

          {battedOccupant ? (
            <div
              role="status"
              className="space-y-3 rounded-lg border border-border bg-muted/50 p-3 text-sm"
            >
              <p>
                {nameOf(battedOccupant)} has batted (
                {perfOf(battedOccupant)?.runs_scored ?? 0} off{" "}
                {perfOf(battedOccupant)?.balls_faced ?? 0}), so another player
                cannot take their place. Change is for a wrong pick before a
                batter&apos;s first ball.
              </p>
              {onRetire && (
                <Button
                  type="button"
                  variant="outline"
                  className="h-11 w-full font-semibold"
                  onClick={() => onRetire(battedOccupant)}
                  disabled={isProcessing}
                >
                  Retire {nameOf(battedOccupant)}
                </Button>
              )}
              <p className="text-xs text-muted-foreground">
                Leaving the field: retire them (hurt, not out; or out). Wrong
                player recorded: undo, or edit the balls they faced.
              </p>
            </div>
          ) : (
            <PlayerPicker
              label={
                survivor
                  ? "Choose the new batter"
                  : pickingFor === "striker"
                    ? "Choose striker"
                    : "Choose non-striker"
              }
              rows={pickable}
              selectedId={
                pickingFor === "striker" ? draft.striker : draft.nonStriker
              }
              onSelect={select}
              addPlayer={
                onCreatePlayer
                  ? {
                      teamName: battingTeamName ?? "the batting side",
                      onAdd: onCreatePlayer,
                      disabledReason: addPlayerDisabledReason,
                    }
                  : undefined
              }
              emptyMessage={
                survivor
                  ? "Nobody left to come in."
                  : "No players in the batting squad yet."
              }
              noun="batter"
            />
          )}

          {/* Pinned on phones: reachable however long the squad is */}
          <div className="max-sm:sticky max-sm:bottom-0 max-sm:z-10 max-sm:-mx-4 max-sm:-mb-4 max-sm:border-t max-sm:border-border/70 max-sm:bg-card max-sm:px-4 max-sm:pb-4 max-sm:pt-3">
            <Button
              className="h-11 w-full text-sm font-semibold"
              onClick={confirm}
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
