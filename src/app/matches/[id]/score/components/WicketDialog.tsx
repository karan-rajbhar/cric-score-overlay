"use client";

import { useEffect } from "react";
import { Button } from "~/components/ui/button";
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
import { AlertTriangle } from "lucide-react";

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
    label: "Run Out",
    needsFielder: true,
    allowedOnWide: true,
    allowedOnNoBall: true,
  },
  {
    value: "hit_wicket",
    label: "Hit Wicket",
    needsFielder: false,
    allowedOnWide: true,
    allowedOnNoBall: false,
  },
  {
    value: "obstructing",
    label: "Obstructing Field",
    needsFielder: false,
    allowedOnWide: true,
    allowedOnNoBall: true,
  },
  {
    value: "retired_hurt",
    label: "Retired Hurt",
    needsFielder: false,
    allowedOnWide: true,
    allowedOnNoBall: true,
  },
];

interface WicketDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dismissalType: string;
  onDismissalTypeChange: (v: string) => void;
  fielderId: string;
  onFielderChange: (v: string) => void;
  bowlingTeamPlayers: Array<{
    user_id: string;
    user?: { full_name: string } | null;
  }>;
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
}

export function WicketDialog({
  open,
  onOpenChange,
  dismissalType,
  onDismissalTypeChange,
  fielderId,
  onFielderChange,
  bowlingTeamPlayers,
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
}: WicketDialogProps) {
  // Filter dismissal types based on MCC laws when an extra delivery is active
  const availableDismissals = ALL_DISMISSAL_TYPES.filter((d) => {
    if (extraType === "no_ball") return d.allowedOnNoBall;
    if (extraType === "wide") return d.allowedOnWide;
    return true;
  });

  // If currently selected dismissal is not valid under the active extra, auto-select first valid
  useEffect(() => {
    if (open && !availableDismissals.some((d) => d.value === dismissalType)) {
      onDismissalTypeChange(availableDismissals[0]?.value ?? "run_out");
    }
  }, [
    open,
    extraType,
    dismissalType,
    availableDismissals,
    onDismissalTypeChange,
  ]);

  // Ensure dismissed player is initialized to striker if not selected
  useEffect(() => {
    if (open && strikerId && !dismissedPlayerId && onDismissedPlayerChange) {
      onDismissedPlayerChange(strikerId);
    }
  }, [open, strikerId, dismissedPlayerId, onDismissedPlayerChange]);

  const selectedDismissal = ALL_DISMISSAL_TYPES.find(
    (d) => d.value === dismissalType,
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Record Wicket</DialogTitle>
          <DialogDescription>
            Specify the dismissal mode and involved players to record the fall
            of wicket.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          {extraType && (
            <div className="flex items-center gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-2.5 text-xs text-amber-700 dark:text-amber-300">
              <AlertTriangle className="h-4 w-4 shrink-0 text-amber-500" />
              <span>
                {extraType === "no_ball"
                  ? "No-ball: Under MCC Law 21.18, batter can only be Run Out, Obstructing the Field, or Retired Hurt."
                  : "Wide: Under MCC Law 22.17, batter cannot be Bowled, Caught, or LBW."}
              </span>
            </div>
          )}

          <div>
            <label className="text-sm font-medium">
              How was the batsman out?
            </label>
            <Select value={dismissalType} onValueChange={onDismissalTypeChange}>
              <SelectTrigger className="mt-1.5">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {availableDismissals.map((d) => (
                  <SelectItem key={d.value} value={d.value}>
                    {d.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Who was dismissed (Critical for Run Outs & general accuracy) */}
          {strikerId && nonStrikerId && onDismissedPlayerChange && (
            <div>
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">Batsman Dismissed</label>
                {dismissalType !== "run_out" && (
                  <span className="text-xs text-muted-foreground">
                    (Striker)
                  </span>
                )}
              </div>
              <Select
                value={dismissedPlayerId || strikerId}
                onValueChange={onDismissedPlayerChange}
                disabled={dismissalType !== "run_out"}
              >
                <SelectTrigger className="mt-1.5">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={strikerId}>
                    {strikerName || "Striker"} (Facing / Striker)
                  </SelectItem>
                  <SelectItem value={nonStrikerId}>
                    {nonStrikerName || "Non-Striker"} (Non-Striker)
                  </SelectItem>
                </SelectContent>
              </Select>
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
                    className="flex-1"
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
              <label className="text-sm font-medium">
                {dismissalType === "run_out"
                  ? "Fielder (involved in run-out)"
                  : "Fielder / Catcher / Keeper"}
              </label>
              <Select value={fielderId} onValueChange={onFielderChange}>
                <SelectTrigger className="mt-1.5">
                  <SelectValue placeholder="Select fielder" />
                </SelectTrigger>
                <SelectContent>
                  {bowlingTeamPlayers.map((player) => (
                    <SelectItem key={player.user_id} value={player.user_id}>
                      {player.user?.full_name ?? "Unknown"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <Button
            className="mt-2 w-full"
            onClick={onConfirm}
            disabled={isProcessing}
          >
            Confirm Wicket
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
