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

interface PenaltyBonusDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  battingTeam?: Team | null;
  bowlingTeam?: Team | null;
  onConfirm: (params: {
    teamId: string;
    runs: number;
    reason: string;
    type: "penalty" | "bonus";
  }) => Promise<void> | void;
  isProcessing?: boolean;
}

const COMMON_REASONS = [
  "Ball hit helmet on ground (Law 28.3)",
  "Fake fielding / unfair play (Law 41)",
  "Running on pitch danger area (Law 41)",
  "Player misconduct / Level 1/2 (Law 42)",
  "Slow over rate penalty",
  "Target bonus / powerplay bonus",
  "Other infraction",
];

export function PenaltyBonusDialog({
  open,
  onOpenChange,
  battingTeam,
  bowlingTeam,
  onConfirm,
  isProcessing = false,
}: PenaltyBonusDialogProps) {
  const [awardType, setAwardType] = useState<"penalty" | "bonus">("penalty");
  const [targetTeamId, setTargetTeamId] = useState<string>(
    battingTeam?.id ?? "",
  );
  const [runs, setRuns] = useState<number>(5);
  const [reason, setReason] = useState<string>(COMMON_REASONS[0]!);
  const [customReason, setCustomReason] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetTeamId) return;
    const finalReason =
      reason === "Other infraction" && customReason.trim()
        ? customReason.trim()
        : reason;

    await onConfirm({
      teamId: targetTeamId,
      runs: Math.max(1, runs),
      reason: finalReason,
      type: awardType,
    });
    onOpenChange(false);
  };

  const runPresets = [1, 2, 3, 5, 10];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-400">
                {awardType === "penalty" ? (
                  <ShieldAlert className="h-4 w-4" />
                ) : (
                  <Award className="h-4 w-4" />
                )}
              </span>
              <DialogTitle className="text-lg font-bold">
                Award Penalty or Bonus Runs
              </DialogTitle>
            </div>
            <DialogDescription className="text-xs text-muted-foreground">
              Award penalty runs (MCC Law 41/42) or bonus runs to either team.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Type selector */}
            <div className="space-y-1.5">
              <Label className="text-xs font-bold">Award Type</Label>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  variant={awardType === "penalty" ? "default" : "outline"}
                  size="sm"
                  className="h-9 font-bold"
                  onClick={() => {
                    setAwardType("penalty");
                    setRuns(5);
                  }}
                >
                  Penalty Runs
                </Button>
                <Button
                  type="button"
                  variant={awardType === "bonus" ? "default" : "outline"}
                  size="sm"
                  className="h-9 font-bold"
                  onClick={() => {
                    setAwardType("bonus");
                    setRuns(1);
                  }}
                >
                  Bonus Runs
                </Button>
              </div>
            </div>

            {/* Recipient Team */}
            <div className="space-y-1.5">
              <Label htmlFor="recipient-team" className="text-xs font-bold">
                Award Runs To
              </Label>
              <Select
                value={targetTeamId || battingTeam?.id || ""}
                onValueChange={setTargetTeamId}
              >
                <SelectTrigger id="recipient-team" className="h-9 text-xs font-bold">
                  <SelectValue placeholder="Select team" />
                </SelectTrigger>
                <SelectContent>
                  {battingTeam && (
                    <SelectItem value={battingTeam.id}>
                      {battingTeam.name} (Batting Team)
                    </SelectItem>
                  )}
                  {bowlingTeam && (
                    <SelectItem value={bowlingTeam.id}>
                      {bowlingTeam.name} (Fielding / Bowling Team)
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground">
                Under MCC Law 41/42, penalty runs can be awarded to either team.
              </p>
            </div>

            {/* Run Presets & Input */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="penalty-runs" className="text-xs font-bold">
                  Number of Runs
                </Label>
                <span className="text-[11px] text-muted-foreground">
                  Standard Law 41/42 is 5 runs
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Input
                  id="penalty-runs"
                  type="number"
                  min={1}
                  max={50}
                  value={runs}
                  onChange={(e) => setRuns(Number(e.target.value))}
                  className="h-9 w-20 text-xs font-bold"
                  required
                />
                <div className="flex flex-wrap gap-1">
                  {runPresets.map((r) => (
                    <Button
                      key={r}
                      type="button"
                      variant={runs === r ? "default" : "outline"}
                      size="sm"
                      onClick={() => setRuns(r)}
                      className="h-8 px-2 text-xs font-bold"
                    >
                      +{r}
                    </Button>
                  ))}
                </div>
              </div>
            </div>

            {/* Reason */}
            <div className="space-y-1.5">
              <Label htmlFor="penalty-reason" className="text-xs font-bold">
                Reason / Violation
              </Label>
              <Select value={reason} onValueChange={setReason}>
                <SelectTrigger id="penalty-reason" className="h-9 text-xs">
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

            {reason === "Other infraction" && (
              <div className="space-y-1.5">
                <Label htmlFor="custom-reason" className="text-xs font-bold">
                  Specify Reason
                </Label>
                <Input
                  id="custom-reason"
                  value={customReason}
                  onChange={(e) => setCustomReason(e.target.value)}
                  placeholder="Enter details..."
                  className="h-9 text-xs"
                  required
                />
              </div>
            )}
          </div>

          <DialogFooter className="flex flex-row items-center justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              disabled={isProcessing}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={isProcessing || !runs}
              className="bg-rose-600 font-bold text-white hover:bg-rose-700"
            >
              {isProcessing ? "Awarding..." : `Award +${runs} Runs`}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
