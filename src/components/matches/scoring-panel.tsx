"use client";

import { useState } from "react";
import { Button } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "~/components/ui/dialog";
import { X, RotateCcw, AlertTriangle, Compass } from "lucide-react";
import { cn } from "~/lib/utils";
import { WagonWheelSelector } from "./wagon-wheel-selector";

interface ScoringPanelProps {
  onScore: (
    runs: number,
    extras?: { type: string; runs: number },
    shotZone?: string,
  ) => void;
  onWicket: (extraType?: string | null) => void;
  onUndo?: () => void;
  onSelectBall?: (index: number) => void;
  currentOver: number;
  currentBall: number;
  lastBalls: string[];
  disabled?: boolean;
}

export function ScoringPanel({
  onScore,
  onWicket,
  onUndo,
  onSelectBall,
  currentOver,
  currentBall,
  lastBalls,
  disabled = false,
}: ScoringPanelProps) {
  const [selectedExtra, setSelectedExtra] = useState<string | null>(null);
  const [selectedZone, setSelectedZone] = useState<string | null>(null);
  const [wagonWheelPrompt, setWagonWheelPrompt] = useState<boolean>(true);
  const [isWagonWheelModalOpen, setIsWagonWheelModalOpen] =
    useState<boolean>(false);
  const [pendingScore, setPendingScore] = useState<{
    runs: number;
    extra?: { type: string; runs: number };
    rawRuns: number;
    extraType: string | null;
  } | null>(null);

  const runButtons = [0, 1, 2, 3, 4, 6];

  const extraTypes = [
    { type: "wide", label: "Wide", activeClass: "bg-amber-500 text-white" },
    {
      type: "no_ball",
      label: "No ball",
      activeClass: "bg-orange-500 text-white",
    },
    { type: "bye", label: "Bye", activeClass: "bg-sky-600 text-white" },
    {
      type: "leg_bye",
      label: "Leg bye",
      activeClass: "bg-violet-500 text-white",
    },
    {
      type: "penalty",
      label: "Penalty (+5)",
      activeClass: "bg-rose-600 text-white",
    },
  ];

  const calculateScorePayload = (runs: number, extraType: string | null) => {
    let effectiveRuns = runs;
    let extra: { type: string; runs: number } | undefined = undefined;

    if (extraType) {
      if (extraType === "wide") {
        effectiveRuns = 0;
        extra = { type: "wide", runs: 1 + runs };
      } else if (extraType === "no_ball") {
        effectiveRuns = runs;
        extra = { type: "no_ball", runs: 1 };
      } else if (extraType === "bye" || extraType === "leg_bye") {
        effectiveRuns = 0;
        extra = { type: extraType, runs: runs === 0 ? 1 : runs };
      } else if (extraType === "penalty") {
        effectiveRuns = 0;
        extra = { type: "penalty", runs: runs === 0 ? 5 : runs };
      } else {
        effectiveRuns = runs === 0 ? 0 : runs;
        extra = { type: extraType, runs: runs === 0 ? 1 : runs };
      }
    }

    return { effectiveRuns, extra };
  };

  const handleRunClick = (runs: number) => {
    const { effectiveRuns, extra } = calculateScorePayload(runs, selectedExtra);

    if (wagonWheelPrompt) {
      setPendingScore({
        runs: effectiveRuns,
        extra,
        rawRuns: runs,
        extraType: selectedExtra,
      });
      setIsWagonWheelModalOpen(true);
    } else {
      onScore(effectiveRuns, extra, selectedZone ?? undefined);
      setSelectedExtra(null);
      setSelectedZone(null);
    }
  };

  const handleConfirmScoreWithZone = (zone?: string | null) => {
    if (!pendingScore) return;
    onScore(pendingScore.runs, pendingScore.extra, zone ?? undefined);
    setPendingScore(null);
    setIsWagonWheelModalOpen(false);
    setSelectedExtra(null);
    setSelectedZone(null);
  };

  const handleSkipZone = () => {
    handleConfirmScoreWithZone(undefined);
  };

  const handleCancelModal = () => {
    setPendingScore(null);
    setIsWagonWheelModalOpen(false);
  };

  const handleExtraClick = (extraType: string) => {
    setSelectedExtra((prev) => (prev === extraType ? null : extraType));
  };

  const getBallDisplay = (ball: string) => {
    if (ball === "W")
      return "bg-red-600 text-white border-red-600 font-black shadow-sm";
    if (ball === "4")
      return "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border-emerald-500/40 font-black";
    if (ball === "6")
      return "bg-purple-500/20 text-purple-700 dark:text-purple-300 border-purple-500/40 font-black";
    if (ball.includes("wd") || ball.includes("nb"))
      return "bg-amber-400/25 text-amber-800 dark:text-amber-200 border-amber-500/40 font-bold";
    return "bg-muted/60 text-muted-foreground border-border/80 font-medium";
  };

  return (
    <Card className="rounded-3xl border-emerald-500/20 bg-card/90 shadow-sm">
      <CardContent className="space-y-3 p-3.5 sm:space-y-4 sm:p-6">
        {/* Header row */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
            <h3 className="text-sm font-extrabold tracking-tight text-foreground">
              Score Delivery
            </h3>
          </div>
          <div className="flex items-center gap-2">
            {/* Toggle auto wagon wheel prompt */}
            <button
              type="button"
              onClick={() => setWagonWheelPrompt((prev) => !prev)}
              aria-label={`Toggle Wagon Wheel prompt on scoring (${wagonWheelPrompt ? "ON" : "OFF"})`}
              className={cn(
                "flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-extrabold transition-all duration-150 active:scale-95",
                wagonWheelPrompt
                  ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 shadow-sm"
                  : "border-border bg-muted/50 text-muted-foreground hover:bg-muted",
              )}
              title="Toggle Wagon Wheel shot selector on scoring"
            >
              <Compass className="h-3.5 w-3.5" />
              <span>Wagon Wheel: {wagonWheelPrompt ? "ON" : "OFF"}</span>
            </button>

            {onUndo && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onUndo}
                disabled={disabled}
                title="Undo last ball"
                className="h-8 w-8 rounded-full p-0 text-muted-foreground hover:text-foreground"
              >
                <RotateCcw className="h-4 w-4" />
              </Button>
            )}
            <span className="tabular rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 font-score text-sm font-extrabold leading-none text-emerald-800 dark:text-emerald-300 sm:px-3 sm:py-1 sm:text-base">
              Over {currentOver}.{currentBall}
            </span>
          </div>
        </div>

        {/* This over ball-by-ball pill trail */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-bold text-muted-foreground">
            This over:
          </span>
          {lastBalls.length > 0 ? (
            <div className="flex flex-wrap gap-1.5 sm:gap-2">
              {lastBalls.map((ball, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => onSelectBall?.(idx)}
                  className={cn(
                    "flex h-7 w-7 items-center justify-center rounded-full border text-xs transition-transform duration-150 hover:scale-110 active:scale-95 sm:h-8 sm:w-8",
                    getBallDisplay(ball),
                  )}
                  title={`Ball ${idx + 1}: ${ball}`}
                >
                  {ball}
                </button>
              ))}
            </div>
          ) : (
            <span className="text-xs font-medium text-muted-foreground/70">
              Awaiting first ball of over...
            </span>
          )}
        </div>

        {/* Extra pending banner */}
        {selectedExtra && (
          <div className="flex items-center justify-between rounded-2xl border border-amber-500/40 bg-amber-500/10 px-3.5 py-2.5 shadow-sm">
            <span className="flex items-center gap-2 text-xs font-bold text-amber-900 dark:text-amber-200">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              {selectedExtra.replace("_", " ").toUpperCase()} PENDING: Tap runs
              to record delivery
            </span>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 rounded-full p-0"
              onClick={() => setSelectedExtra(null)}
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}


        {/* 6 Bouncy Run Buttons */}
        <div className="grid grid-cols-6 gap-1.5 sm:gap-2.5">
          {runButtons.map((runs) => {
            const isFour = runs === 4;
            const isSix = runs === 6;
            const isDot = runs === 0;
            return (
              <button
                key={runs}
                type="button"
                disabled={disabled}
                aria-label={
                  isDot
                    ? "0 runs (dot ball)"
                    : isFour
                      ? "4 runs (four)"
                      : isSix
                        ? "6 runs (six)"
                        : `${runs} run${runs > 1 ? "s" : ""}`
                }
                className={cn(
                  "score-display tabular flex h-14 flex-col items-center justify-center rounded-xl border-2 text-2xl font-black transition-all duration-150 hover:-translate-y-0.5 active:scale-90 disabled:opacity-50 sm:h-16 sm:rounded-2xl sm:text-3xl",
                  isDot &&
                    "border-border/80 bg-background/80 text-muted-foreground shadow-sm hover:border-slate-400 hover:text-foreground",
                  runs === 1 &&
                    "border-amber-500/30 bg-amber-500/5 text-amber-800 shadow-sm hover:bg-amber-500/15 dark:text-amber-300",
                  runs === 2 &&
                    "border-amber-500/40 bg-amber-500/10 text-amber-900 shadow-sm hover:bg-amber-500/20 dark:text-amber-200",
                  runs === 3 &&
                    "border-orange-500/40 bg-orange-500/10 text-orange-900 shadow-sm hover:bg-orange-500/20 dark:text-orange-200",
                  isFour &&
                    "border-emerald-500/50 bg-emerald-500/15 text-emerald-700 shadow-md ring-2 ring-emerald-500/20 hover:bg-emerald-500/25 dark:text-emerald-300",
                  isSix &&
                    "border-purple-500/50 bg-purple-500/15 text-purple-700 shadow-md ring-2 ring-purple-500/20 hover:bg-purple-500/25 dark:text-purple-300",
                )}
                onClick={() => handleRunClick(runs)}
              >
                <span>{runs}</span>
                {isFour && (
                  <span className="font-sans text-[8px] font-extrabold tracking-wider text-emerald-600 dark:text-emerald-400 sm:text-[9px]">
                    FOUR 💥
                  </span>
                )}
                {isSix && (
                  <span className="font-sans text-[8px] font-extrabold tracking-wider text-purple-600 dark:text-purple-400 sm:text-[9px]">
                    MAX ✨
                  </span>
                )}
                {isDot && (
                  <span className="font-sans text-[8px] font-bold text-muted-foreground sm:text-[9px]">
                    DOT
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Extras as Playful Capsules */}
        <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-5 sm:gap-2">
          {extraTypes.map(({ type, label, activeClass }) => (
            <button
              key={type}
              type="button"
              onClick={() => handleExtraClick(type)}
              disabled={disabled}
              className={cn(
                "h-9 rounded-xl border text-[11px] font-bold transition-all duration-150 active:scale-95 sm:h-10 sm:text-xs",
                selectedExtra === type
                  ? `${activeClass} border-transparent font-black shadow-md`
                  : "border-border/80 bg-background/80 text-foreground shadow-sm hover:bg-muted",
              )}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Wicket Button: Radiant Joyful Red with Lightning */}
        <Button
          variant="destructive"
          size="lg"
          className="h-12 w-full gap-2 rounded-2xl bg-gradient-to-r from-red-600 via-rose-600 to-red-600 text-sm font-black tracking-wider text-white shadow-md hover:from-red-700 hover:to-rose-700 active:scale-95"
          onClick={() => {
            onWicket(selectedExtra);
            setSelectedExtra(null);
            setSelectedZone(null);
          }}
          disabled={disabled}
        >
          <span>⚡ WICKET DISMISSAL</span>
        </Button>

        {/* Stumps App Style Wagon Wheel Selection Dialog */}
        <Dialog
          open={isWagonWheelModalOpen}
          onOpenChange={(open) => {
            if (!open) handleCancelModal();
          }}
        >
          <DialogContent className="max-w-md rounded-3xl p-5 sm:p-6">
            <DialogHeader className="text-center sm:text-center">
              <div className="mx-auto flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                  <Compass className="h-4 w-4" />
                </span>
                <DialogTitle className="text-lg font-black tracking-tight">
                  Select Shot Direction
                </DialogTitle>
              </div>
              <DialogDescription className="text-xs text-muted-foreground">
                Tap the wagon wheel sector where the shot was played
              </DialogDescription>
            </DialogHeader>

            {/* Pending Delivery Badge */}
            {pendingScore && (
              <div className="flex items-center justify-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 font-score text-sm font-extrabold text-emerald-800 dark:text-emerald-300">
                  {pendingScore.extraType && (
                    <span className="uppercase text-amber-600 dark:text-amber-400">
                      {pendingScore.extraType.replace("_", " ")} +
                    </span>
                  )}
                  <span>
                    {pendingScore.rawRuns === 0 && !pendingScore.extraType
                      ? "Dot Ball (0)"
                      : `${pendingScore.rawRuns} ${pendingScore.rawRuns === 1 ? "Run" : "Runs"}`}
                  </span>
                  {pendingScore.rawRuns === 4 && <span>💥 FOUR</span>}
                  {pendingScore.rawRuns === 6 && <span>✨ MAX</span>}
                </span>
              </div>
            )}

            {/* Interactive Wagon Wheel Selector */}
            <div className="py-2">
              <WagonWheelSelector
                selectedZone={selectedZone}
                onSelectZone={(zone) => {
                  if (zone) {
                    setSelectedZone(zone);
                    handleConfirmScoreWithZone(zone);
                  }
                }}
              />
            </div>

            <DialogFooter className="flex flex-row items-center justify-between gap-2 sm:justify-between">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleCancelModal}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleSkipZone}
                className="text-xs font-semibold"
              >
                Skip (Score without zone)
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
