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
import { Label } from "~/components/ui/label";
import { Input } from "~/components/ui/input";
import { cn } from "~/lib/utils";
import { RETIREMENT_TYPES, type RetirementType } from "./WicketDialog";

interface RetirePlayerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  playerName: string;
  playerId: string;
  onConfirm: (params: {
    playerId: string;
    type: RetirementType;
    reason?: string | null;
  }) => Promise<void> | void;
  isProcessing?: boolean;
}

/** What each retirement means for the scorecard, in plain words. */
const MEANING: Record<RetirementType, string> = {
  retired_hurt: "Not out. They can bat again later in the innings.",
  retired_out: "Out. Counts as a wicket, not the bowler's.",
};

/**
 * Retire a batter (Law 25.4): between deliveries, so no ball is recorded.
 * Nothing is preselected: hurt (not out) and out (a wicket) score
 * differently, so the scorer picks one.
 */
export function RetirePlayerDialog({
  open,
  onOpenChange,
  playerName,
  playerId,
  onConfirm,
  isProcessing = false,
}: RetirePlayerDialogProps) {
  const [retireType, setRetireType] = useState<RetirementType | null>(null);
  const [reason, setReason] = useState("");

  // A fresh form each time the dialog opens (or opens for another batter).
  const key = `${open}:${playerId}`;
  const [seen, setSeen] = useState(key);
  if (key !== seen) {
    setSeen(key);
    setRetireType(null);
    setReason("");
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!retireType) return;
    onOpenChange(false);
    await onConfirm({
      playerId,
      type: retireType,
      reason: reason.trim() || null,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader className="text-left">
            <DialogTitle className="text-balance">
              Retire {playerName}
            </DialogTitle>
            <DialogDescription>
              Not a ball: the over and the bowler&apos;s figures stay as they
              are. Next, you choose who comes in at {playerName}&apos;s end.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div
              role="radiogroup"
              aria-label="How they retire"
              className="grid gap-2"
            >
              {RETIREMENT_TYPES.map((r) => {
                const checked = retireType === r.value;
                return (
                  <button
                    key={r.value}
                    type="button"
                    role="radio"
                    aria-checked={checked}
                    onClick={() => setRetireType(r.value)}
                    className={cn(
                      "flex min-h-14 flex-col items-start justify-center rounded-lg border px-3 py-2 text-left transition-colors",
                      checked
                        ? "border-primary bg-primary/10"
                        : "border-border/70 bg-background hover:bg-muted",
                    )}
                  >
                    <span className="text-sm font-medium">{r.label}</span>
                    <span className="text-xs text-muted-foreground">
                      {MEANING[r.value]}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="retire-reason" className="text-sm font-medium">
                Note (optional)
              </Label>
              <Input
                id="retire-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. hamstring strain"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isProcessing}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="font-semibold"
              disabled={!retireType || isProcessing}
            >
              {retireType === "retired_hurt"
                ? "Retire hurt"
                : retireType === "retired_out"
                  ? "Retire out"
                  : "Choose how they retire"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
