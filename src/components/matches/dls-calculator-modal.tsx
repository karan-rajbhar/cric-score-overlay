"use client";

import { useState } from "react";
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
import { CloudRain, Check } from "lucide-react";
import { calculateDlsTarget, calculateDlsParScore } from "~/lib/dls";
import { ballsFromOvers, dlsRevisionFor, oversFromBalls } from "~/lib/cricket";
import type { Match } from "~/lib/match-types";
import { updateDlsTarget } from "~/app/matches/mutations";
import { toast } from "sonner";

/**
 * Where the chase stood when play stopped, from the form's fields: balls
 * bowled (none: before it started), wickets down (none before a ball), the
 * decimal overs left and the fewest overs the chase can be cut to (it must
 * leave at least part of an over to bowl).
 */
function stoppageOf(
  oversBowled: string,
  wicketsDown: number,
  oversPerSide: number,
  ballsPerOver: number,
) {
  const fullBalls = oversPerSide * ballsPerOver;
  const bowledBalls = Math.min(
    Math.max(0, ballsFromOvers(Number(oversBowled) || 0, ballsPerOver)),
    Math.max(0, fullBalls - 1),
  );
  return {
    bowledBalls,
    wickets:
      bowledBalls > 0 ? Math.min(9, Math.max(0, Math.floor(wicketsDown))) : 0,
    oversLeft: (fullBalls - bowledBalls) / ballsPerOver,
    minOvers: Math.min(
      oversPerSide,
      Math.floor(bowledBalls / ballsPerOver) + 1,
    ),
  };
}

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
  const bpo =
    match.balls_per_over && match.balls_per_over > 0 ? match.balls_per_over : 6;
  const defaultOvers = match.overs_per_innings ?? 20;

  const [t1Runs, setT1Runs] = useState<number>(inn1?.total_runs ?? 150);
  const [t1Overs, setT1Overs] = useState<number>(defaultOvers);
  const [oversBowled, setOversBowled] = useState<string>(
    oversFromBalls(inn2?.total_balls ?? 0, bpo),
  );
  const [wicketsLost, setWicketsLost] = useState<number>(
    inn2?.total_wickets ?? 0,
  );
  const [t2Choice, setT2Overs] = useState<number>(
    Math.max(1, defaultOvers - 5),
  );

  const stop = stoppageOf(oversBowled, wicketsLost, t1Overs, bpo);
  const t2Overs = Math.min(t1Overs, Math.max(stop.minOvers, t2Choice));
  const earlierRevision = dlsRevisionFor(match, 2);

  const calculation = calculateDlsTarget({
    team1Runs: t1Runs,
    team1OversScheduled: t1Overs,
    team2OversScheduled: t1Overs,
    team2OversAvailable: t2Overs,
    interruptionOversRemaining: stop.oversLeft,
    interruptionWicketsLost: stop.wickets,
  });
  const parScore = calculateDlsParScore(
    t1Runs,
    t1Overs,
    t1Overs,
    stop.oversLeft,
    stop.wickets,
  );

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
          <DialogTitle>DLS calculator</DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Uses the DLS Standard Edition, the published table for matches
            without the DLS software, whose targets can differ. It covers one
            stoppage in the second innings, before the chase starts or during
            it.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          <div className="grid grid-cols-2 gap-4">
            <div className="min-w-0 space-y-1.5">
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
            <div className="min-w-0 space-y-1.5">
              <Label htmlFor="dls-t1-overs" className="text-xs font-semibold">
                Overs per side
              </Label>
              <Input
                id="dls-t1-overs"
                name="t1Overs"
                type="number"
                inputMode="numeric"
                min={1}
                max={50}
                value={t1Overs}
                onChange={(e) => setT1Overs(Number(e.target.value) || 20)}
                aria-describedby="dls-t1-overs-hint"
              />
            </div>
          </div>
          <p
            id="dls-t1-overs-hint"
            className="-mt-2 text-2xs text-muted-foreground"
          >
            As scheduled at the start, even if the first innings was all out.
          </p>

          <fieldset className="space-y-2">
            <legend className="text-xs font-semibold">
              When play stopped in the chase
            </legend>
            <div className="grid grid-cols-2 gap-4">
              <div className="min-w-0 space-y-1.5">
                <Label
                  htmlFor="dls-overs-bowled"
                  className="text-2xs text-muted-foreground"
                >
                  Overs bowled
                </Label>
                <Input
                  id="dls-overs-bowled"
                  name="oversBowled"
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step={0.1}
                  value={oversBowled}
                  onChange={(e) => setOversBowled(e.target.value)}
                  aria-describedby="dls-stop-hint"
                  className="h-10 text-base sm:h-9 sm:text-xs"
                />
              </div>
              <div className="min-w-0 space-y-1.5">
                <Label
                  htmlFor="dls-wickets-lost"
                  className="text-2xs text-muted-foreground"
                >
                  Wickets down
                </Label>
                <Input
                  id="dls-wickets-lost"
                  name="wicketsLost"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={9}
                  value={wicketsLost}
                  onChange={(e) => setWicketsLost(Number(e.target.value) || 0)}
                  className="h-10 text-base sm:h-9 sm:text-xs"
                />
              </div>
            </div>
            <p id="dls-stop-hint" className="text-2xs text-muted-foreground">
              Leave both at 0 if the chase had not started.
            </p>
          </fieldset>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="dls-t2-overs" className="text-xs font-semibold">
                Second innings overs
              </Label>
              <span className="text-xs font-medium tabular-nums text-primary">
                {t2Overs} overs
              </span>
            </div>
            <input
              id="dls-t2-overs"
              type="range"
              min={stop.minOvers}
              max={t1Overs}
              value={t2Overs}
              onChange={(e) => setT2Overs(Number(e.target.value))}
              className="w-full accent-primary"
            />
          </div>

          <div className="rounded-xl border border-primary/30 bg-primary/10 p-4 text-center">
            <p className="text-xs font-medium text-primary">Revised target</p>
            <div className="mt-1 flex items-baseline justify-center gap-2">
              <span className="font-score text-4xl font-semibold tabular-nums text-foreground">
                {calculation.targetRuns}
              </span>
              <span className="text-sm text-muted-foreground">
                runs in {t2Overs} overs
              </span>
            </div>
            <p className="mt-3 border-t border-border/40 pt-2 text-xs tabular-nums text-muted-foreground">
              Resources: first innings {calculation.team1Resource}%, second
              innings {calculation.team2Resource}%
            </p>
          </div>

          {stop.bowledBalls > 0 && (
            <div className="flex items-center justify-between gap-3 rounded-lg border p-3">
              <div className="min-w-0">
                <p className="text-xs font-semibold">
                  Par score if play does not resume
                </p>
                <p className="text-2xs text-muted-foreground">
                  The chasing side wins above par and ties on it.
                </p>
              </div>
              <span className="font-score text-lg font-semibold tabular-nums text-foreground">
                {parScore}
              </span>
            </div>
          )}

          {earlierRevision && (
            <p className="text-xs text-muted-foreground">
              This chase already has a revised target. The calculator covers a
              single stoppage, so a second revision has to be worked out by
              hand.
            </p>
          )}

          {canEdit && inn2 && (
            <Button
              className="h-11 min-h-[44px] w-full gap-2 text-sm font-semibold"
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
