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
}

export function DlsCalculatorModal({
  match,
  canEdit = false,
}: DlsCalculatorModalProps) {
  const [open, setOpen] = useState(false);
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
      toast.error("2nd innings has not started yet");
      return;
    }
    setIsApplying(true);
    try {
      const res = await updateDlsTarget(
        match.id,
        inn2.id,
        calculation.targetRuns,
      );
      if (res.error) {
        toast.error(res.error);
      } else {
        toast.success(`DLS target updated to ${calculation.targetRuns} runs`);
        setOpen(false);
      }
    } catch {
      toast.error("Failed to update DLS target");
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
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5 text-xs font-medium"
        >
          <CloudRain className="h-3.5 w-3.5 text-sky-500" />
          <span className="hidden sm:inline">DLS Rain Calc</span>
          <span className="sm:hidden">DLS</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5 text-sky-500" />
            Duckworth-Lewis-Stern (DLS) Calculator
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Standard Edition DLS Method using official ICC resource percentage
            tables to recalculate targets when rain or interruptions shorten
            overs in limited-overs matches.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">1st Innings Runs</Label>
              <Input
                type="number"
                min={1}
                value={t1Runs}
                onChange={(e) => setT1Runs(Number(e.target.value) || 0)}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">1st Innings Overs</Label>
              <Input
                type="number"
                min={5}
                max={50}
                value={t1Overs}
                onChange={(e) => setT1Overs(Number(e.target.value) || 20)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold">
                2nd Innings Revised Overs
              </Label>
              <span className="text-xs font-medium text-sky-600 dark:text-sky-400">
                {t2Overs} overs available
              </span>
            </div>
            <input
              type="range"
              min={5}
              max={t1Overs}
              value={t2Overs}
              onChange={(e) => setT2Overs(Number(e.target.value))}
              className="w-full accent-sky-600"
            />
          </div>

          {/* Target Result Box */}
          <div className="rounded-xl border border-sky-500/30 bg-sky-500/10 p-4 text-center">
            <p className="text-xs font-medium uppercase tracking-wider text-sky-700 dark:text-sky-300">
              Revised DLS Target
            </p>
            <div className="mt-1 flex items-center justify-center gap-2">
              <span className="text-4xl font-extrabold text-foreground">
                {calculation.targetRuns}
              </span>
              <span className="text-sm text-muted-foreground">
                runs in {t2Overs} ov
              </span>
            </div>
            <div className="mt-3 flex items-center justify-center gap-4 border-t border-border/40 pt-2 text-xs text-muted-foreground">
              <span>Team 1 Res: {calculation.team1Resource}%</span>
              <ArrowRight className="h-3 w-3" />
              <span>Team 2 Res: {calculation.team2Resource}%</span>
            </div>
          </div>

          {/* Par Score Calculator */}
          <div className="space-y-2 rounded-lg border p-3">
            <p className="text-xs font-semibold">Live Par Score Checker</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-[11px] text-muted-foreground">
                  Overs Bowled
                </Label>
                <Input
                  type="number"
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
                <Label className="text-[11px] text-muted-foreground">
                  Wickets Lost
                </Label>
                <Input
                  type="number"
                  min={0}
                  max={9}
                  value={wicketsLost}
                  onChange={(e) => setWicketsLost(Number(e.target.value) || 0)}
                  className="h-8 text-xs"
                />
              </div>
            </div>
            <div className="flex items-center justify-between pt-1 text-xs font-medium">
              <span className="text-muted-foreground">
                DLS Par Score right now:
              </span>
              <span className="text-sm font-bold text-foreground">
                {parScore} runs
              </span>
            </div>
          </div>

          {canEdit && inn2 && (
            <Button
              className="w-full gap-2"
              onClick={() => void handleApplyTarget()}
              disabled={isApplying}
            >
              <Check className="h-4 w-4" />
              {isApplying
                ? "Updating Target..."
                : `Apply Target (${calculation.targetRuns} runs) to Match`}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
