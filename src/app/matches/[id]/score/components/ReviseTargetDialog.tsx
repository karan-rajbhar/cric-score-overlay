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
import { Target, AlertCircle } from "lucide-react";

interface ReviseTargetDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentTarget?: number | null;
  currentOvers?: number | null;
  onConfirm: (params: {
    targetRuns: number | null;
    overs?: number | null;
  }) => Promise<void> | void;
  isProcessing?: boolean;
}

function ReviseTargetForm({
  currentTarget,
  currentOvers,
  onConfirm,
  onCancel,
  isProcessing,
}: {
  currentTarget?: number | null;
  currentOvers?: number | null;
  onConfirm: (params: {
    targetRuns: number | null;
    overs?: number | null;
  }) => Promise<void> | void;
  onCancel: () => void;
  isProcessing?: boolean;
}) {
  const [targetRuns, setTargetRuns] = useState<string>(
    currentTarget != null ? String(currentTarget) : "",
  );
  const [overs, setOvers] = useState<string>(
    currentOvers != null ? String(currentOvers) : "",
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const runsNum = targetRuns.trim() !== "" ? parseInt(targetRuns, 10) : null;
    const oversNum = overs.trim() !== "" ? parseFloat(overs) : null;

    if (runsNum !== null && (isNaN(runsNum) || runsNum < 0)) {
      return;
    }
    if (oversNum !== null && (isNaN(oversNum) || oversNum < 1 || oversNum > 100)) {
      return;
    }

    await onConfirm({
      targetRuns: runsNum,
      overs: oversNum,
    });
    onCancel();
  };

  return (
    <form onSubmit={handleSubmit}>
      <DialogHeader>
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Target className="h-4 w-4" />
          </span>
          <DialogTitle>Revise Target / Overs</DialogTitle>
        </div>
        <DialogDescription>
          Adjust the 2nd innings target runs or revised overs due to rain, DLS, or custom match rules.
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-4 py-4">
        <div className="space-y-2">
          <Label htmlFor="targetRuns" className="text-xs font-semibold">
            Target Runs to Win
          </Label>
          <Input
            id="targetRuns"
            type="number"
            min="0"
            max="999"
            placeholder="e.g. 145"
            value={targetRuns}
            onChange={(e) => setTargetRuns(e.target.value)}
            className="font-mono text-base"
            required
          />
          <p className="text-[11px] text-muted-foreground">
            The total number of runs required by the chasing team to win.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="overs" className="text-xs font-semibold">
            Revised Overs (optional)
          </Label>
          <Input
            id="overs"
            type="number"
            min="1"
            max="100"
            step="1"
            placeholder={currentOvers ? String(currentOvers) : "e.g. 15"}
            value={overs}
            onChange={(e) => setOvers(e.target.value)}
            className="font-mono text-base"
          />
          <p className="text-[11px] text-muted-foreground">
            Leave empty to retain the current match innings length.
          </p>
        </div>

        <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-2.5 text-xs text-amber-800 dark:text-amber-200">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
          <p>
            Updating the target will instantly recompute the required run rate and equation for all viewers, scoreboards, and broadcast overlays.
          </p>
        </div>
      </div>

      <DialogFooter className="gap-2 sm:gap-0">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={isProcessing}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={isProcessing}>
          {isProcessing ? "Updating..." : "Save Revised Target"}
        </Button>
      </DialogFooter>
    </form>
  );
}

export function ReviseTargetDialog({
  open,
  onOpenChange,
  currentTarget,
  currentOvers,
  onConfirm,
  isProcessing = false,
}: ReviseTargetDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        {open && (
          <ReviseTargetForm
            key={`${currentTarget}-${currentOvers}-${open}`}
            currentTarget={currentTarget}
            currentOvers={currentOvers}
            onConfirm={onConfirm}
            onCancel={() => onOpenChange(false)}
            isProcessing={isProcessing}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
