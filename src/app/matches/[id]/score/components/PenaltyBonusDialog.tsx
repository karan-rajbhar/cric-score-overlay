"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
import { ShieldAlert, Award } from "lucide-react";
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
  const [reason, setReason] = useState<string>(COMMON_REASONS[0]!);
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
      setReason(COMMON_REASONS[0]!);
      setCustomReason("");
    }
  }

  const teams = [
    battingTeam ? { team: battingTeam, side: "batting" } : null,
    bowlingTeam ? { team: bowlingTeam, side: "fielding" } : null,
  ].filter((t): t is { team: Team; side: string } => t !== null);
  const target = teams.find((t) => t.team.id === targetTeamId)?.team ?? null;
  const runsLabel = `${runs} run${runs === 1 ? "" : "s"}`;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!target || !runs) return;
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
          <DialogHeader>
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-destructive/10 text-destructive">
                {awardType === "penalty" ? (
                  <ShieldAlert className="h-4 w-4" aria-hidden="true" />
                ) : (
                  <Award className="h-4 w-4" aria-hidden="true" />
                )}
              </span>
              <DialogTitle className="text-lg font-semibold">
                Award penalty or bonus runs
              </DialogTitle>
            </div>
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
                  variant={awardType === "penalty" ? "default" : "outline"}
                  size="sm"
                  aria-pressed={awardType === "penalty"}
                  className="min-h-11 font-semibold"
                  onClick={() => {
                    setAwardType("penalty");
                    setRuns(5);
                  }}
                >
                  Penalty runs
                </Button>
                <Button
                  type="button"
                  variant={awardType === "bonus" ? "default" : "outline"}
                  size="sm"
                  aria-pressed={awardType === "bonus"}
                  className="min-h-11 font-semibold"
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
                <span className="text-2xs text-muted-foreground">
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
                  className="h-11 w-20 text-sm font-semibold tabular-nums"
                  required
                />
                <div className="flex flex-wrap gap-1">
                  {runPresets.map((r) => (
                    <Button
                      key={r}
                      type="button"
                      variant={runs === r ? "default" : "outline"}
                      size="sm"
                      aria-pressed={runs === r}
                      onClick={() => setRuns(r)}
                      className="h-11 min-w-11 px-2 text-xs font-semibold tabular-nums"
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
                <SelectTrigger id="penalty-reason" className="h-11 text-xs">
                  <SelectValue />
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
                  className="h-11 text-xs"
                  required
                />
              </div>
            )}
          </div>

          <DialogFooter className="flex flex-row items-center justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              className="min-h-11"
              onClick={() => onOpenChange(false)}
              disabled={isProcessing}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isProcessing || !runs || !target}
              className="min-h-11 bg-destructive font-semibold text-destructive-foreground hover:bg-destructive"
            >
              {isProcessing
                ? "Awarding…"
                : target
                  ? `Award ${runsLabel} to ${target.name}`
                  : "Choose a team"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
