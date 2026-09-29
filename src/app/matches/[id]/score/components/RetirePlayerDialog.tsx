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
import { Label } from "~/components/ui/label";
import { Input } from "~/components/ui/input";
import { HeartPulse, ShieldAlert } from "lucide-react";

interface RetirePlayerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  playerName: string;
  playerId: string;
  onConfirm: (params: {
    playerId: string;
    type: "retired_hurt" | "retired_out";
    reason?: string | null;
  }) => Promise<void> | void;
  isProcessing?: boolean;
}

export function RetirePlayerDialog({
  open,
  onOpenChange,
  playerName,
  playerId,
  onConfirm,
  isProcessing = false,
}: RetirePlayerDialogProps) {
  const [retireType, setRetireType] = useState<"retired_hurt" | "retired_out">(
    "retired_hurt",
  );
  const [reason, setReason] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onConfirm({
      playerId,
      type: retireType,
      reason: reason.trim() || null,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-400">
                <HeartPulse className="h-4 w-4" />
              </span>
              <DialogTitle className="text-lg font-bold">
                Retire Batsman: {playerName}
              </DialogTitle>
            </div>
            <DialogDescription className="text-xs text-muted-foreground">
              Select whether the batter is retiring hurt or retiring out.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label className="text-xs font-bold">Retirement Type</Label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setRetireType("retired_hurt")}
                  className={`flex flex-col items-start gap-1 rounded-2xl border p-3 text-left transition-all ${
                    retireType === "retired_hurt"
                      ? "border-emerald-500 bg-emerald-500/10 ring-1 ring-emerald-500"
                      : "border-border bg-card/60 hover:bg-muted"
                  }`}
                >
                  <span className="text-xs font-bold text-foreground">
                    Retire Hurt
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    Law 25.4: Injury/Illness. <strong>NOT OUT</strong>. Team wickets do not increase.
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setRetireType("retired_out")}
                  className={`flex flex-col items-start gap-1 rounded-2xl border p-3 text-left transition-all ${
                    retireType === "retired_out"
                      ? "border-destructive bg-destructive/10 ring-1 ring-destructive"
                      : "border-border bg-card/60 hover:bg-muted"
                  }`}
                >
                  <span className="text-xs font-bold text-foreground">
                    Retire Out
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    Law 25.4: Tactical retirement. <strong>OUT</strong>. Counts as a wicket down.
                  </span>
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="retire-reason" className="text-xs font-bold">
                Reason / Injury Notes (Optional)
              </Label>
              <Input
                id="retire-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. Hamstring strain, finger injury..."
                className="h-9 text-xs"
              />
            </div>

            <div className="flex items-start gap-2 rounded-xl border border-muted p-2.5 text-xs text-muted-foreground">
              <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
              <span>
                {retireType === "retired_hurt"
                  ? "Retiring hurt vacates the crease. You will be prompted to select the new incoming batter."
                  : "Retiring out credits a wicket to the team and closes this batter's innings as OUT."}
              </span>
            </div>
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
              disabled={isProcessing}
              className={
                retireType === "retired_out"
                  ? "bg-destructive font-bold text-destructive-foreground hover:bg-destructive/90"
                  : "bg-emerald-600 font-bold text-white hover:bg-emerald-700"
              }
            >
              {isProcessing
                ? "Processing..."
                : retireType === "retired_hurt"
                  ? "Retire Hurt (Not Out)"
                  : "Retire Out (Wicket)"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
