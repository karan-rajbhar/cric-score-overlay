"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
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
import { SlidersHorizontal } from "lucide-react";
import { toast } from "sonner";
import { overridePointsTableEntry } from "~/app/tournaments/actions";

interface PointsOverrideDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tournamentId: string;
  teamId: string;
  teamName: string;
  currentAdjustment?: number | null;
  currentReason?: string | null;
  currentStatus?: string | null;
}

export function PointsOverrideDialog({
  open,
  onOpenChange,
  tournamentId,
  teamId,
  teamName,
  currentAdjustment,
  currentReason,
  currentStatus,
}: PointsOverrideDialogProps) {
  const [adjustment, setAdjustment] = useState<string>(
    String(currentAdjustment ?? 0),
  );
  const [reason, setReason] = useState<string>(currentReason ?? "");
  const [status, setStatus] = useState<
    "in_contention" | "qualified" | "eliminated"
  >(
    (currentStatus as "in_contention" | "qualified" | "eliminated") ??
      "in_contention",
  );
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    const val = parseFloat(adjustment);
    if (isNaN(val)) {
      toast.error(
        "Please enter a valid numeric points adjustment (e.g. -1.0 or 0.5)",
      );
      return;
    }

    setIsSaving(true);
    try {
      const res = await overridePointsTableEntry(
        tournamentId,
        teamId,
        val,
        reason,
        status,
      );
      if (res.error) {
        toast.error(res.error);
      } else {
        toast.success(`Updated standings for ${teamName}`);
        onOpenChange(false);
      }
    } catch (err) {
      console.error("Points override failed:", err);
      toast.error("An unexpected error occurred");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="mb-1 flex items-center gap-2 text-primary">
            <SlidersHorizontal className="h-5 w-5" />
            <span className="text-xs font-semibold uppercase tracking-wider">
              Admin Controls
            </span>
          </div>
          <DialogTitle className="text-xl">
            Points & Qualification Override
          </DialogTitle>
          <DialogDescription>
            Manually adjust points (penalties, bonuses, decimals) or override
            qualification flags for{" "}
            <span className="font-semibold text-foreground">{teamName}</span>.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="adjustment">Points Adjustment</Label>
            <Input
              id="adjustment"
              type="number"
              step="0.1"
              value={adjustment}
              onChange={(e) => setAdjustment(e.target.value)}
              placeholder="e.g. -1 for penalty, +0.5 for bonus"
            />
            <p className="text-[11px] text-muted-foreground">
              Negative values subtract points (e.g. -1.0 for slow over rate).
              Positive values award bonus points.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="reason">Adjustment Reason</Label>
            <Input
              id="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Slow over rate in Match #4 (-1 pt)"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="status">Qualification Status Flag</Label>
            <Select
              value={status}
              onValueChange={(val) =>
                setStatus(val as "in_contention" | "qualified" | "eliminated")
              }
            >
              <SelectTrigger id="status">
                <SelectValue placeholder="Select Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="in_contention">
                  In Contention (Normal)
                </SelectItem>
                <SelectItem value="qualified">
                  Qualified (Q) — Top Spot Secured
                </SelectItem>
                <SelectItem value="eliminated">
                  Eliminated (E) — Out of Contention
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? "Saving..." : "Save Override"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
