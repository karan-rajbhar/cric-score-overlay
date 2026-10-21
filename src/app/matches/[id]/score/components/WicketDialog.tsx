"use client";

import { useEffect, useMemo } from "react";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { AlertTriangle } from "lucide-react";
import { cn } from "~/lib/utils";
import { PlayerPicker } from "./PlayerPicker";
import { buildFielderRows } from "./player-rows";

export const ALL_DISMISSAL_TYPES = [
  {
    value: "bowled",
    label: "Bowled",
    needsFielder: false,
    allowedOnWide: false,
    allowedOnNoBall: false,
  },
  {
    value: "caught",
    label: "Caught",
    needsFielder: true,
    allowedOnWide: false,
    allowedOnNoBall: false,
  },
  {
    value: "lbw",
    label: "LBW",
    needsFielder: false,
    allowedOnWide: false,
    allowedOnNoBall: false,
  },
  {
    value: "stumped",
    label: "Stumped",
    needsFielder: true,
    allowedOnWide: true,
    allowedOnNoBall: false,
  },
  {
    value: "run_out",
    label: "Run out",
    needsFielder: true,
    allowedOnWide: true,
    allowedOnNoBall: true,
  },
  {
    value: "hit_wicket",
    label: "Hit wicket",
    needsFielder: false,
    allowedOnWide: true,
    allowedOnNoBall: false,
  },
  {
    value: "obstructing",
    label: "Obstructing the field",
    needsFielder: false,
    allowedOnWide: true,
    allowedOnNoBall: true,
  },
];

/**
 * Retirements (Law 25.4): recorded between deliveries, never as a ball, by
 * the retire action. Offered next to the dismissals, where scorers look for
 * them, but only for a plain wicket (not on an extra).
 */
export const RETIREMENT_TYPES = [
  { value: "retired_hurt", label: "Retired hurt" },
  { value: "retired_out", label: "Retired out" },
] as const;

export type RetirementType = (typeof RETIREMENT_TYPES)[number]["value"];

export function isRetirementType(
  v: string | null | undefined,
): v is RetirementType {
  return RETIREMENT_TYPES.some((r) => r.value === v);
}

interface WicketDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dismissalType: string;
  onDismissalTypeChange: (v: string) => void;
  fielderId: string;
  onFielderChange: (v: string) => void;
  bowlingTeamPlayers: Array<{
    user_id: string;
    role_in_team?: string | null;
    user?: { full_name: string } | null;
  }>;
  bowlingTeamName?: string;
  /** Marks the bowler in the fielder list (caught and bowled). */
  bowlerId?: string | null;
  /** Adds a (substitute) fielder to the bowling side; resolves to the new id. */
  onCreateFielder?: (name: string) => Promise<string | null>;
  /** Set while adding is impossible (e.g. offline). */
  addPlayerDisabledReason?: string | null;
  strikerId?: string | null;
  nonStrikerId?: string | null;
  strikerName?: string | null;
  nonStrikerName?: string | null;
  dismissedPlayerId?: string | null;
  onDismissedPlayerChange?: (id: string) => void;
  extraType?: string | null;
  runsCompleted?: number;
  onRunsCompletedChange?: (runs: number) => void;
  onConfirm: () => void;
  isProcessing: boolean;
  isFreeHit?: boolean;
}

export function WicketDialog({
  open,
  onOpenChange,
  dismissalType,
  onDismissalTypeChange,
  fielderId,
  onFielderChange,
  bowlingTeamPlayers,
  bowlingTeamName,
  bowlerId,
  onCreateFielder,
  addPlayerDisabledReason,
  strikerId,
  nonStrikerId,
  strikerName,
  nonStrikerName,
  dismissedPlayerId,
  onDismissedPlayerChange,
  extraType,
  runsCompleted = 0,
  onRunsCompletedChange,
  onConfirm,
  isProcessing,
  isFreeHit = false,
}: WicketDialogProps) {
  // Filter dismissal types based on MCC laws when an extra delivery or Free Hit is active
  const availableDismissals = ALL_DISMISSAL_TYPES.filter((d) => {
    if (isFreeHit) {
      return d.value === "run_out" || d.value === "obstructing";
    }
    if (extraType === "no_ball") return d.allowedOnNoBall;
    if (extraType === "wide") return d.allowedOnWide;
    return true;
  });
  const retirements = extraType ? [] : RETIREMENT_TYPES;
  const retiring = isRetirementType(dismissalType);

  // If currently selected dismissal is not valid under the active extra/free hit, auto-select first valid
  useEffect(() => {
    const valid =
      availableDismissals.some((d) => d.value === dismissalType) ||
      (!extraType && isRetirementType(dismissalType));
    if (open && !valid) {
      onDismissalTypeChange(availableDismissals[0]?.value ?? "run_out");
    }
  }, [
    open,
    extraType,
    isFreeHit,
    dismissalType,
    availableDismissals,
    onDismissalTypeChange,
  ]);

  /** A run out or a retirement can be either batter; the rest the striker. */
  const eitherBatter = (type: string) =>
    type === "run_out" || isRetirementType(type);
  const pickType = (type: string) => {
    onDismissalTypeChange(type);
    if (!eitherBatter(type) && strikerId && dismissedPlayerId !== strikerId) {
      onDismissedPlayerChange?.(strikerId);
    }
  };
  const chipClass = (selected: boolean) =>
    cn(
      "touch-target flex h-11 min-h-[44px] items-center justify-center rounded-xl border text-xs font-semibold transition-colors",
      selected
        ? "border-black bg-black text-white shadow-sm dark:border-white dark:bg-white dark:text-black"
        : "border-border/80 bg-background text-foreground hover:bg-muted",
    );
  const retireeName =
    (dismissedPlayerId || strikerId) === nonStrikerId
      ? nonStrikerName || "Non-striker"
      : strikerName || "Striker";

  // Ensure dismissed player is initialized to striker if not selected
  useEffect(() => {
    if (open && strikerId && !dismissedPlayerId && onDismissedPlayerChange) {
      onDismissedPlayerChange(strikerId);
    }
  }, [open, strikerId, dismissedPlayerId, onDismissedPlayerChange]);

  const selectedDismissal = ALL_DISMISSAL_TYPES.find(
    (d) => d.value === dismissalType,
  );

  const fielderRows = useMemo(
    () =>
      buildFielderRows({
        players: bowlingTeamPlayers,
        bowlerId,
        keeperFirst: dismissalType === "stumped",
      }),
    [bowlingTeamPlayers, bowlerId, dismissalType],
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Record wicket</DialogTitle>
          <DialogDescription>
            Specify the dismissal mode and involved players to record the fall
            of wicket.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          {extraType && (
            <div className="flex items-center gap-2 rounded-lg border border-warning/40 bg-warning/10 p-2.5 text-xs text-warning">
              <AlertTriangle className="h-4 w-4 shrink-0 text-warning" />
              <span>
                {extraType === "no_ball"
                  ? "No-ball: Under MCC Law 21.18, batter can only be Run Out or Obstructing the Field."
                  : "Wide: Under MCC Law 22.17, batter cannot be Bowled, Caught, or LBW."}
              </span>
            </div>
          )}

          {isFreeHit && !extraType && (
            <div className="flex items-center gap-2 rounded-lg border border-destructive/40 bg-destructive/10 p-2.5 text-xs font-semibold text-destructive">
              <AlertTriangle className="h-4 w-4 shrink-0 text-destructive" />
              <span>
                Free Hit Delivery: Under Law 21.19, batter can only be dismissed
                Run Out or Obstructing.
              </span>
            </div>
          )}

          <div>
            <p
              className="text-sm font-semibold text-foreground"
              id="dismissal-label"
            >
              How was the batsman out?
            </p>
            {/* Rapid 1-Tap Dismissal Chips for outdoor scoring */}
            <div
              className="mt-2 grid grid-cols-2 gap-1.5 sm:grid-cols-4"
              role="group"
              aria-labelledby="dismissal-label"
            >
              {availableDismissals.map((d) => (
                <button
                  key={d.value}
                  type="button"
                  aria-pressed={dismissalType === d.value}
                  onClick={() => pickType(d.value)}
                  className={chipClass(dismissalType === d.value)}
                >
                  {d.label}
                </button>
              ))}
            </div>
          </div>

          {retirements.length > 0 && (
            <div>
              <p
                className="text-sm font-semibold text-foreground"
                id="retirement-label"
              >
                Or a retirement (not a ball)
              </p>
              <div
                className="mt-2 grid grid-cols-2 gap-1.5"
                role="group"
                aria-labelledby="retirement-label"
              >
                {retirements.map((r) => (
                  <button
                    key={r.value}
                    type="button"
                    aria-pressed={dismissalType === r.value}
                    onClick={() => pickType(r.value)}
                    className={chipClass(dismissalType === r.value)}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
              {retiring && (
                <p className="mt-2 text-xs text-muted-foreground" role="note">
                  {dismissalType === "retired_hurt"
                    ? "Not out: they can bat again later in the innings."
                    : "Out: counts as a wicket, not the bowler's."}{" "}
                  The over and the bowler's figures stay as they are. Next,
                  choose who comes in.
                </p>
              )}
            </div>
          )}

          {/* Who was dismissed: a run out or a retirement can take the non-striker */}
          {strikerId && nonStrikerId && onDismissedPlayerChange && (
            <div>
              <p className="text-sm font-medium" id="dismissed-batter-label">
                {retiring ? "Who retires" : "Batsman dismissed"}
              </p>
              <div
                className="mt-1.5 grid grid-cols-2 gap-2"
                role="radiogroup"
                aria-labelledby="dismissed-batter-label"
              >
                {[
                  { id: strikerId, name: strikerName || "Striker", end: "Striker" },
                  {
                    id: nonStrikerId,
                    name: nonStrikerName || "Non-striker",
                    end: "Non-striker",
                  },
                ].map((b) => {
                  const selected = (dismissedPlayerId || strikerId) === b.id;
                  const disabled =
                    !eitherBatter(dismissalType) && b.id !== strikerId;
                  return (
                    <button
                      key={b.id}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      disabled={disabled}
                      onClick={() => onDismissedPlayerChange(b.id)}
                      className={cn(
                        "flex min-h-11 min-w-0 flex-col items-start justify-center rounded-lg border px-3 py-1.5 text-left transition-colors disabled:opacity-50",
                        selected
                          ? "border-primary bg-primary/10"
                          : "border-border/70 bg-background hover:bg-muted",
                      )}
                    >
                      <span className="w-full truncate text-sm font-medium">
                        {b.name}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {b.end}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Runs completed before run out */}
          {dismissalType === "run_out" && onRunsCompletedChange && (
            <div>
              <label className="text-sm font-medium">
                Runs completed before run-out
              </label>
              <div className="mt-1.5 flex gap-2">
                {[0, 1, 2, 3].map((r) => (
                  <Button
                    key={r}
                    type="button"
                    variant={runsCompleted === r ? "default" : "outline"}
                    size="sm"
                    className="flex-1 min-h-[40px] text-sm font-bold"
                    onClick={() => onRunsCompletedChange(r)}
                  >
                    {r}
                  </Button>
                ))}
              </div>
            </div>
          )}

          {selectedDismissal?.needsFielder && (
            <div>
              <p className="mb-1.5 text-sm font-medium">
                {dismissalType === "run_out"
                  ? "Fielder (involved in run-out)"
                  : dismissalType === "stumped"
                    ? "Keeper"
                    : "Fielder / catcher"}
              </p>
              <PlayerPicker
                label="Choose fielder"
                rows={fielderRows}
                selectedId={fielderId || null}
                onSelect={onFielderChange}
                addPlayer={
                  onCreateFielder
                    ? {
                        teamName: bowlingTeamName ?? "the fielding side",
                        onAdd: onCreateFielder,
                        disabledReason: addPlayerDisabledReason,
                      }
                    : undefined
                }
                emptyMessage="No players in the fielding squad yet."
                noun="fielder"
              />
            </div>
          )}

          {/* Pinned on phones: reachable however long the fielder list is */}
          <div className="max-sm:sticky max-sm:bottom-0 max-sm:z-10 max-sm:-mx-4 max-sm:-mb-4 max-sm:border-t max-sm:border-border/70 max-sm:bg-card max-sm:px-4 max-sm:pb-4 max-sm:pt-3">
            <Button
              className="h-11 min-h-[44px] w-full text-sm font-semibold"
              onClick={onConfirm}
              disabled={isProcessing}
            >
              {retiring
                ? `${dismissalType === "retired_hurt" ? "Retire hurt" : "Retire out"}: ${retireeName}`
                : "Confirm wicket"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
