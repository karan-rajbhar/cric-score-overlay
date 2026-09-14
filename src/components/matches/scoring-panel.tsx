"use client";

import { useState } from "react";
import { Button } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/card";
import { X, RotateCcw, AlertTriangle } from "lucide-react";
import { cn } from "~/lib/utils";

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

  const handleRunClick = (runs: number) => {
    const zone = selectedZone ?? undefined;
    if (selectedExtra) {
      if (selectedExtra === "wide") {
        // In cricket, all runs on a wide are extras (striker gets 0 bat runs).
        // If wide + boundary: 1 penalty + 4 boundary = 5 wides total.
        onScore(0, { type: "wide", runs: 1 + runs }, zone);
      } else if (selectedExtra === "no_ball") {
        // 1 penalty run charged to bowler, plus runs off the bat credited to striker.
        onScore(runs, { type: "no_ball", runs: 1 }, zone);
      } else if (selectedExtra === "bye" || selectedExtra === "leg_bye") {
        // Byes / Leg-byes are extras, 0 runs off the bat.
        onScore(0, { type: selectedExtra, runs: runs === 0 ? 1 : runs }, zone);
      } else if (selectedExtra === "penalty") {
        // MCC Law 41/42/28: 5 penalty runs awarded to batting side
        onScore(0, { type: "penalty", runs: runs === 0 ? 5 : runs }, zone);
      } else {
        onScore(
          runs === 0 ? 0 : runs,
          { type: selectedExtra, runs: runs === 0 ? 1 : runs },
          zone,
        );
      }
      setSelectedExtra(null);
    } else {
      onScore(runs, undefined, zone);
    }
    setSelectedZone(null);
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
      <CardContent className="space-y-4 p-5 sm:p-6">
        {/* Header row */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
            <h3 className="text-sm font-extrabold tracking-tight text-foreground">
              Score Delivery
            </h3>
          </div>
          <div className="flex items-center gap-2">
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
            <span className="tabular rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 font-score text-base font-extrabold leading-none text-emerald-800 dark:text-emerald-300">
              Over {currentOver}.{currentBall}
            </span>
          </div>
        </div>

        {/* This over ball-by-ball pill trail */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-muted-foreground">
            This over:
          </span>
          {lastBalls.length > 0 ? (
            <div className="flex gap-2">
              {lastBalls.map((ball, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => onSelectBall?.(idx)}
                  className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-full border text-xs transition-transform duration-150 hover:scale-110 active:scale-95",
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

        {/* Optional Shot Zone (Wagon Wheel) Selector as Joyful Pills */}
        <div className="space-y-1.5 pt-1">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="font-semibold">
              Shot zone (optional for live wagon radar)
            </span>
            {selectedZone && (
              <button
                type="button"
                onClick={() => setSelectedZone(null)}
                className="text-[10.5px] font-bold text-emerald-600 underline hover:text-emerald-700"
              >
                Clear
              </button>
            )}
          </div>
          <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-8">
            {[
              { id: "third_man", label: "3rd Man", bg: "hover:border-sky-400" },
              { id: "point", label: "Point", bg: "hover:border-amber-400" },
              { id: "cover", label: "Cover", bg: "hover:border-emerald-400" },
              {
                id: "long_off",
                label: "Long Off",
                bg: "hover:border-purple-400",
              },
              {
                id: "long_on",
                label: "Long On",
                bg: "hover:border-orange-400",
              },
              {
                id: "mid_wicket",
                label: "Mid Wkt",
                bg: "hover:border-teal-400",
              },
              {
                id: "square_leg",
                label: "Sq Leg",
                bg: "hover:border-rose-400",
              },
              {
                id: "fine_leg",
                label: "Fine Leg",
                bg: "hover:border-indigo-400",
              },
            ].map((z) => (
              <button
                key={z.id}
                type="button"
                onClick={() =>
                  setSelectedZone((prev) => (prev === z.id ? null : z.id))
                }
                className={cn(
                  "truncate rounded-full border px-2 py-1 text-center text-xs font-bold transition-all duration-150 active:scale-95",
                  selectedZone === z.id
                    ? "border-emerald-500 bg-emerald-500 text-white shadow-sm ring-1 ring-emerald-400"
                    : "border-border/70 bg-muted/40 text-muted-foreground hover:bg-muted/70",
                  z.bg,
                )}
              >
                {z.label}
              </button>
            ))}
          </div>
        </div>

        {/* 6 Bouncy Run Buttons */}
        <div className="grid grid-cols-6 gap-2 sm:gap-2.5">
          {runButtons.map((runs) => {
            const isFour = runs === 4;
            const isSix = runs === 6;
            const isDot = runs === 0;
            return (
              <button
                key={runs}
                type="button"
                disabled={disabled}
                className={cn(
                  "score-display tabular flex h-16 flex-col items-center justify-center rounded-2xl border-2 text-3xl font-black transition-all duration-150 hover:-translate-y-0.5 active:scale-90 disabled:opacity-50",
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
                  <span className="font-sans text-[9px] font-extrabold tracking-wider text-emerald-600 dark:text-emerald-400">
                    FOUR 💥
                  </span>
                )}
                {isSix && (
                  <span className="font-sans text-[9px] font-extrabold tracking-wider text-purple-600 dark:text-purple-400">
                    MAX ✨
                  </span>
                )}
                {isDot && (
                  <span className="font-sans text-[9px] font-bold text-muted-foreground">
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
                "h-10 rounded-xl border text-xs font-bold transition-all duration-150 active:scale-95",
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
      </CardContent>
    </Card>
  );
}
