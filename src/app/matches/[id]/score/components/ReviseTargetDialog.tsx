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
  /** The overs the chase has now (a revision's, else the match's). */
  currentOvers?: number | null;
  /** The match's overs: a revision can only shorten the chase. */
  maxOvers?: number | null;
  /** Resolves with the server's error, if any (the dialog then stays open). */
  onConfirm: (params: {
    targetRuns: number | null;
    overs?: number | null;
  }) => Promise<{ error: string | null } | void> | void;
  isProcessing?: boolean;
}

type ReviseTargetFormProps = Omit<
  ReviseTargetDialogProps,
  "open" | "onOpenChange"
> & { onCancel: () => void };

/** A whole number from 1 to `max`, or null when it is not one. */
function wholeNumber(text: string, max: number): number | null {
  const n = Number(text);
  return text.trim() !== "" && Number.isInteger(n) && n >= 1 && n <= max
    ? n
    : null;
}

function ReviseTargetForm({
  currentTarget,
  currentOvers,
  maxOvers,
  onConfirm,
  onCancel,
  isProcessing,
}: ReviseTargetFormProps) {
  const [targetRuns, setTargetRuns] = useState<string>(
    currentTarget != null ? String(currentTarget) : "",
  );
  const [overs, setOvers] = useState<string>(
    currentOvers != null ? String(currentOvers) : "",
  );
  const [error, setError] = useState<string | null>(null);
  const oversLimit = maxOvers ?? 100;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const runsNum = wholeNumber(targetRuns, 9999);
    const oversNum = wholeNumber(overs, oversLimit);
    if (runsNum === null) return;
    if (overs.trim() !== "" && oversNum === null) return;

    setError(null);
    const res = await onConfirm({
      targetRuns: runsNum,
      overs: oversNum,
    });
    const refused = res ? res.error : null;
    if (refused) setError(refused);
    else onCancel();
  };

  return (
    <form onSubmit={handleSubmit}>
      <DialogHeader>
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Target className="h-4 w-4" />
          </span>
          <DialogTitle>Revise target / overs</DialogTitle>
        </div>
        <DialogDescription>
          Set the chase&apos;s target and the overs it has, after rain or a
          delay. The first innings keeps its overs.
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-4 py-4">
        <div className="space-y-2">
          <Label htmlFor="targetRuns" className="text-xs font-semibold">
            Target runs to win
          </Label>
          <Input
            id="targetRuns"
            type="number"
            min="1"
            max="9999"
            step="1"
            placeholder="e.g. 145"
            value={targetRuns}
            onChange={(e) => setTargetRuns(e.target.value)}
            className="font-mono text-base"
            required
          />
          <p className="text-xs text-muted-foreground">
            The total number of runs required by the chasing team to win.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="overs" className="text-xs font-semibold">
            Revised overs (optional)
          </Label>
          <Input
            id="overs"
            type="number"
            min="1"
            max={oversLimit}
            step="1"
            placeholder={maxOvers ? String(maxOvers) : "e.g. 15"}
            value={overs}
            onChange={(e) => setOvers(e.target.value)}
            className="font-mono text-base"
          />
          <p className="text-xs text-muted-foreground">
            Leave empty for the match&apos;s full overs.
          </p>
        </div>

        <div className="flex items-start gap-2 rounded-lg border border-warning/30 bg-warning/10 p-2.5 text-xs text-warning">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
          <p>
            Updating the target will instantly recompute the required run rate and equation for all viewers, scoreboards, and broadcast overlays.
          </p>
        </div>

        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
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
  maxOvers,
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
            maxOvers={maxOvers}
            onConfirm={onConfirm}
            onCancel={() => onOpenChange(false)}
            isProcessing={isProcessing}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
