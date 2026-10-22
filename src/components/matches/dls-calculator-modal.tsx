"use client";

import { useState, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { CloudRain, Calculator, ArrowRight, Check } from "lucide-react";
import { calculateDlsTarget, calculateDlsParScore } from "~/lib/dls";
import type { Match } from "~/lib/match-types";
import { updateDlsTarget } from "~/app/matches/mutations";
import { toast } from "sonner";

interface DlsCalculatorModalProps {
  match: Match;
  canEdit?: boolean;
  triggerButton?: React.ReactNode;
  /** Opened from elsewhere (a menu): no trigger of its own. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function DlsCalculatorModal({
  match,
  canEdit = false,
  triggerButton,
  open: openProp,
  onOpenChange,
}: DlsCalculatorModalProps) {
  const [ownOpen, setOwnOpen] = useState(false);
  const controlled = openProp !== undefined;
  const open = controlled ? openProp : ownOpen;
  const setOpen = (next: boolean) => {
    if (controlled) onOpenChange?.(next);
    else setOwnOpen(next);
  };
  const [isApplying, setIsApplying] = useState(false);

  // Pre-fill values from current match state
  const inn1 = match.innings?.find((i) => i.innings_number === 1);
  const inn2 = match.innings?.find((i) => i.innings_number === 2);

  const defaultTotalOvers = match.overs_per_innings ?? 20;
  const defaultT1Runs = inn1?.total_runs ?? 150;
  const defaultT1Overs = defaultTotalOvers;
  const defaultT2Overs = Math.max(
    5,
    Math.min(
      defaultT1Overs,
      inn2?.total_overs ? Math.ceil(inn2.total_overs) : defaultT1Overs - 5,
    ),
  );

  const [t1Runs, setT1Runs] = useState<number>(defaultT1Runs);
  const [t1Overs, setT1Overs] = useState<number>(defaultT1Overs);
  const [t2Overs, setT2Overs] = useState<number>(defaultT2Overs);
  const [wicketsLost, setWicketsLost] = useState<number>(
    inn2?.total_wickets ?? 0,
  );
  const [currentOversBowled, setCurrentOversBowled] = useState<number>(
    inn2?.total_overs ? Math.floor(inn2.total_overs) : 0,
  );

  const calculation = useMemo(() => {
    return calculateDlsTarget({
      team1Runs: t1Runs,
      team1OversScheduled: t1Overs,
      team2OversScheduled: t1Overs,
      team2OversAvailable: t2Overs,
      format: t1Overs <= 20 ? "T20" : "ODI",
    });
  }, [t1Runs, t1Overs, t2Overs]);

  const parScore = useMemo(() => {
    const oversLeft = Math.max(0, t2Overs - currentOversBowled);
    return calculateDlsParScore(
      t1Runs,
      t1Overs,
      t2Overs,
      oversLeft,
      wicketsLost,
    );
  }, [t1Runs, t1Overs, t2Overs, currentOversBowled, wicketsLost]);

  const handleApplyTarget = async () => {
    if (!inn2) {
      toast.error("The second innings has not started yet");
      return;
    }
    setIsApplying(true);
    try {
      const res = await updateDlsTarget(
        match.id,
        inn2.id,
        calculation.targetRuns,
        t2Overs,
      );
      if (res.error) {
        toast.error(res.error);
      } else {
        toast.success(
          `Target revised to ${calculation.targetRuns} runs in ${t2Overs} overs`,
        );
        setOpen(false);
      }
    } catch {
      toast.error("Could not revise the target");
    } finally {
      setIsApplying(false);
    }
  };

  // DLS calculation only applies to in-progress (live), limited-overs matches
  if (match.status !== "live" || (match.overs_per_innings ?? 0) <= 0) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {!controlled && (
        <DialogTrigger asChild>
          {triggerButton ?? (
            <Button
              variant="outline"
              size="sm"
              className="h-10 px-3 text-xs font-semibold sm:h-9 sm:text-sm min-h-[36px] gap-1.5"
            >
              <CloudRain className="h-4 w-4 shrink-0 text-primary" />
              <span className="hidden sm:inline">DLS calculator</span>
              <span className="sm:hidden">DLS</span>
            </Button>
          )}
        </DialogTrigger>
      )}
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5 text-primary" />
            DLS calculator
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Works out a new chase target with the Duckworth-Lewis-Stern
            resource tables when rain or another stoppage shortens the second
            innings.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="dls-t1-runs" className="text-xs font-semibold">
                First innings runs
              </Label>
              <Input
                id="dls-t1-runs"
                name="t1Runs"
                type="number"
                inputMode="numeric"
                min={1}
                value={t1Runs}
                onChange={(e) => setT1Runs(Number(e.target.value) || 0)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="dls-t1-overs" className="text-xs font-semibold">
                First innings overs
              </Label>
              <Input
                id="dls-t1-overs"
                name="t1Overs"
                type="number"
                inputMode="numeric"
                min={5}
                max={50}
                value={t1Overs}
                onChange={(e) => setT1Overs(Number(e.target.value) || 20)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="dls-t2-overs" className="text-xs font-semibold">
                Second innings overs
              </Label>
              <span className="text-xs font-medium text-primary">
                {t2Overs} overs available
              </span>
            </div>
            <input
              id="dls-t2-overs"
              type="range"
              min={5}
              max={t1Overs}
              value={t2Overs}
              onChange={(e) => setT2Overs(Number(e.target.value))}
              className="w-full accent-primary"
            />
          </div>

          {/* Target Result Box */}
          <div className="rounded-xl border border-primary/30 bg-primary/10 p-4 text-center">
            <p className="text-xs font-medium text-primary">
              Revised DLS target
            </p>
            <div className="mt-1 flex items-center justify-center gap-2">
              <span className="text-4xl font-semibold tabular-nums text-foreground">
                {calculation.targetRuns}
              </span>
              <span className="text-sm text-muted-foreground">
                runs in {t2Overs} ov
              </span>
            </div>
            <div className="mt-3 flex items-center justify-center gap-4 border-t border-border/40 pt-2 text-xs text-muted-foreground">
              <span>First innings resources {calculation.team1Resource}%</span>
              <ArrowRight className="h-3 w-3" aria-hidden="true" />
              <span>Second innings resources {calculation.team2Resource}%</span>
            </div>
          </div>

          {/* Par Score Calculator */}
          <div className="space-y-2 rounded-lg border p-3">
            <p className="text-xs font-semibold">Live par score checker</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label
                  htmlFor="dls-overs-bowled"
                  className="text-2xs text-muted-foreground"
                >
                  Overs bowled
                </Label>
                <Input
                  id="dls-overs-bowled"
                  type="number"
                  inputMode="decimal"
                  min={0}
                  max={t2Overs}
                  value={currentOversBowled}
                  onChange={(e) =>
                    setCurrentOversBowled(Number(e.target.value) || 0)
                  }
                  className="h-8 text-xs"
                />
              </div>
              <div>
                <Label
                  htmlFor="dls-wickets-lost"
                  className="text-2xs text-muted-foreground"
                >
                  Wickets lost
                </Label>
                <Input
                  id="dls-wickets-lost"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={9}
                  value={wicketsLost}
                  onChange={(e) => setWicketsLost(Number(e.target.value) || 0)}
                  className="h-10 sm:h-9 text-base sm:text-xs"
                />
              </div>
            </div>
            <div className="flex items-center justify-between pt-1 text-xs font-medium">
              <span className="text-muted-foreground">
                Par score now
              </span>
              <span className="text-sm font-semibold text-foreground">
                {parScore} runs
              </span>
            </div>
          </div>

          {canEdit && inn2 && (
            <Button
              className="w-full gap-2 h-11 min-h-[44px] text-sm font-semibold"
              onClick={() => void handleApplyTarget()}
              disabled={isApplying}
            >
              <Check className="h-4 w-4" />
              {isApplying
                ? "Revising the target…"
                : `Set target: ${calculation.targetRuns} runs in ${t2Overs} overs`}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
