"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import type { Team } from "~/lib/match-types";
import { cn } from "~/lib/utils";

interface PenaltyBonusDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  battingTeam?: Team | null;
  bowlingTeam?: Team | null;
  /** Resolves false when nothing was recorded (the dialog stays open). */
  onConfirm: (params: {
    teamId: string;
    runs: number;
    reason: string;
    type: "penalty" | "bonus";
  }) => Promise<boolean | void> | boolean | void;
  isProcessing?: boolean;
}

const COMMON_REASONS = [
  "Ball hit a fielder's helmet on the ground",
  "Fake fielding or deliberate distraction",
  "Running on the protected area of the pitch",
  "Player misconduct",
  "Slow over rate",
  "Target or powerplay bonus",
  "Other",
];

/**
 * Penalty or bonus runs to either side, logged between balls. Nothing is
 * preselected for the side: runs to the wrong team change the result, so
 * the scorer taps the team each time the dialog opens.
 */
export function PenaltyBonusDialog({
  open,
  onOpenChange,
  battingTeam,
  bowlingTeam,
  onConfirm,
  isProcessing = false,
}: PenaltyBonusDialogProps) {
  const [awardType, setAwardType] = useState<"penalty" | "bonus">("penalty");
  const [targetTeamId, setTargetTeamId] = useState<string | null>(null);
  const [runs, setRuns] = useState<number>(5);
  // No reason until the scorer picks one (S7): it goes on the record.
  const [reason, setReason] = useState<string>("");
  const [customReason, setCustomReason] = useState("");

  // A fresh form each time it opens (the dialog stays mounted across
  // innings, when the batting side changes).
  const [seen, setSeen] = useState(open);
  if (seen !== open) {
    setSeen(open);
    if (open) {
      setAwardType("penalty");
      setTargetTeamId(null);
      setRuns(5);
      setReason("");
      setCustomReason("");
    }
  }

  const teams = [
    battingTeam ? { team: battingTeam, side: "batting" } : null,
    bowlingTeam ? { team: bowlingTeam, side: "fielding" } : null,
  ].filter((t): t is { team: Team; side: string } => t !== null);
  const target = teams.find((t) => t.team.id === targetTeamId)?.team ?? null;
  const runsLabel = `${runs} run${runs === 1 ? "" : "s"}`;
  const missingReason =
    !reason || (reason === "Other" && !customReason.trim());

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!target || !runs || missingReason) return;
    const finalReason =
      reason === "Other" && customReason.trim() ? customReason.trim() : reason;

    const done = await onConfirm({
      teamId: target.id,
      runs: Math.max(1, runs),
      reason: finalReason,
      type: awardType,
    });
    if (done !== false) onOpenChange(false);
  };

  const runPresets = [1, 2, 3, 5, 10];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit}>
          {/* The scoring dialogs' one header: a title, one line, no icon
              tile; and one footer, the main button full width (S8). */}
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold">
              Award penalty or bonus runs
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Runs to either side, recorded between balls (not a delivery).
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Type selector */}
            <div className="space-y-1.5">
              <Label id="award-type-label" className="text-xs font-semibold">
                Award type
              </Label>
              <div
                className="grid grid-cols-2 gap-2"
                role="group"
                aria-labelledby="award-type-label"
              >
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  aria-pressed={awardType === "penalty"}
                  className={cn(
                    "min-h-11 font-semibold",
                    awardType === "penalty" && "border-primary bg-primary/10",
                  )}
                  onClick={() => {
                    setAwardType("penalty");
                    setRuns(5);
                  }}
                >
                  Penalty runs
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  aria-pressed={awardType === "bonus"}
                  className={cn(
                    "min-h-11 font-semibold",
                    awardType === "bonus" && "border-primary bg-primary/10",
                  )}
                  onClick={() => {
                    setAwardType("bonus");
                    setRuns(1);
                  }}
                >
                  Bonus runs
                </Button>
              </div>
            </div>

            {/* Recipient team: nobody preselected */}
            <div className="space-y-1.5">
              <p id="recipient-team-label" className="text-xs font-semibold">
                Award the runs to
              </p>
              <div
                role="radiogroup"
                aria-labelledby="recipient-team-label"
                className="grid grid-cols-2 gap-2"
              >
                {teams.map(({ team, side }) => {
                  const checked = team.id === targetTeamId;
                  return (
                    <button
                      key={team.id}
                      type="button"
                      role="radio"
                      aria-checked={checked}
                      onClick={() => setTargetTeamId(team.id)}
                      className={cn(
                        "flex min-h-14 min-w-0 flex-col items-start justify-center rounded-lg border px-3 py-2 text-left transition-colors",
                        checked
                          ? "border-primary bg-primary/10"
                          : "border-border/70 bg-background hover:bg-muted",
                      )}
                    >
                      <span className="w-full truncate text-sm font-medium">
                        {team.name}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {side === "batting" ? "Batting now" : "Fielding now"}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Run Presets & Input */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="penalty-runs" className="text-xs font-semibold">
                  Number of runs
                </Label>
                <span className="text-xs text-muted-foreground">
                  A penalty is usually 5 runs
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Input
                  id="penalty-runs"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={50}
                  value={runs}
                  onChange={(e) => setRuns(Number(e.target.value))}
                  className="h-11 w-20 font-semibold tabular-nums"
                  required
                />
                <div className="flex flex-wrap gap-1">
                  {runPresets.map((r) => (
                    <Button
                      key={r}
                      type="button"
                      variant="outline"
                      size="sm"
                      aria-pressed={runs === r}
                      onClick={() => setRuns(r)}
                      className={cn(
                        "h-11 min-w-11 px-2 text-xs font-semibold tabular-nums",
                        runs === r && "border-primary bg-primary/10",
                      )}
                    >
                      {r}
                    </Button>
                  ))}
                </div>
              </div>
            </div>

            {/* Reason */}
            <div className="space-y-1.5">
              <Label htmlFor="penalty-reason" className="text-xs font-semibold">
                Reason
              </Label>
              <Select value={reason} onValueChange={setReason}>
                <SelectTrigger id="penalty-reason" className="h-11 text-sm">
                  <SelectValue placeholder="Choose a reason" />
                </SelectTrigger>
                <SelectContent>
                  {COMMON_REASONS.map((r) => (
                    <SelectItem key={r} value={r}>
                      {r}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {reason === "Other" && (
              <div className="space-y-1.5">
                <Label htmlFor="custom-reason" className="text-xs font-semibold">
                  What happened
                </Label>
                <Input
                  id="custom-reason"
                  value={customReason}
                  onChange={(e) => setCustomReason(e.target.value)}
                  placeholder="Enter details"
                  className="h-11"
                  required
                />
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Button
              type="submit"
              disabled={isProcessing || !runs || !target || missingReason}
              className="h-12 w-full font-semibold"
            >
              {isProcessing
                ? "Awarding…"
                : !target
                  ? "Choose a team"
                  : missingReason
                    ? "Choose a reason"
                    : `Award ${runsLabel} to ${target.name}`}
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="min-h-11 w-full"
              onClick={() => onOpenChange(false)}
              disabled={isProcessing}
            >
              Cancel
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
