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
  onWicket: () => void;
  onUndo?: () => void;
  currentOver: number;
  currentBall: number;
  lastBalls: string[];
  disabled?: boolean;
}

export function ScoringPanel({
  onScore,
  onWicket,
  onUndo,
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
  ];

  const handleRunClick = (runs: number) => {
    const zone = selectedZone ?? undefined;
    if (selectedExtra) {
      // Extra + additional runs (e.g. wide + 1 boundary).
      onScore(
        runs === 0 ? 0 : runs,
        { type: selectedExtra, runs: runs === 0 ? 1 : runs },
        zone,
      );
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
    if (ball === "W") return "bg-red-600 text-white border-red-600";
    if (ball === "4")
      return "bg-sky-500/15 text-sky-600 dark:text-sky-400 border-sky-500/40";
    if (ball === "6")
      return "bg-violet-500/15 text-violet-600 dark:text-violet-400 border-violet-500/40";
    if (ball.includes("wd") || ball.includes("nb"))
      return "bg-amber-400/20 text-amber-700 dark:text-amber-300 border-amber-500/50";
    return "bg-secondary text-secondary-foreground border-border";
  };

  return (
    <Card>
      <CardContent className="space-y-4 p-4">
        {/* Header row */}
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Score this delivery
          </h3>
          <div className="flex items-center gap-2">
            {onUndo && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onUndo}
                disabled={disabled}
                title="Undo last ball"
              >
                <RotateCcw className="h-4 w-4" />
              </Button>
            )}
            <span className="tabular rounded-md border border-border bg-secondary px-2.5 py-1 font-score text-lg font-semibold leading-none">
              {currentOver}.{currentBall}
            </span>
          </div>
        </div>

        {/* This over */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">This over:</span>
          {lastBalls.length > 0 ? (
            <div className="flex gap-1.5">
              {lastBalls.map((ball, idx) => (
                <span
                  key={idx}
                  className={cn(
                    "tabular inline-flex h-7 min-w-7 items-center justify-center rounded-full border px-1.5 text-xs font-semibold",
                    getBallDisplay(ball),
                  )}
                >
                  {ball}
                </span>
              ))}
            </div>
          ) : (
            <span className="text-xs text-muted-foreground/70">
              No deliveries yet
            </span>
          )}
        </div>

        {/* Extra pending banner */}
        {selectedExtra && (
          <div className="flex items-center justify-between rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2">
            <span className="flex items-center gap-2 text-sm font-medium">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              {selectedExtra.replace("_", " ")} — tap runs to continue
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectedExtra(null)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        )}

        {/* Optional Shot Zone (Wagon Wheel) Selector */}
        <div className="space-y-1.5 pt-1">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Shot zone (optional for wagon wheel)</span>
            {selectedZone && (
              <button
                type="button"
                onClick={() => setSelectedZone(null)}
                className="text-[10px] text-muted-foreground underline hover:text-foreground"
              >
                Clear
              </button>
            )}
          </div>
          <div className="grid grid-cols-4 gap-1 sm:grid-cols-8">
            {[
              { id: "third_man", label: "3rd Man" },
              { id: "point", label: "Point" },
              { id: "cover", label: "Cover" },
              { id: "long_off", label: "Long Off" },
              { id: "long_on", label: "Long On" },
              { id: "mid_wicket", label: "Mid Wkt" },
              { id: "square_leg", label: "Sq Leg" },
              { id: "fine_leg", label: "Fine Leg" },
            ].map((z) => (
              <button
                key={z.id}
                type="button"
                onClick={() =>
                  setSelectedZone((prev) => (prev === z.id ? null : z.id))
                }
                className={cn(
                  "truncate rounded border px-1.5 py-1 text-center text-xs font-medium transition-colors",
                  selectedZone === z.id
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border/60 bg-muted/40 text-muted-foreground hover:bg-muted",
                )}
              >
                {z.label}
              </button>
            ))}
          </div>
        </div>

        {/* Runs */}
        <div className="grid grid-cols-6 gap-2">
          {runButtons.map((runs) => (
            <Button
              key={runs}
              variant="outline"
              size="lg"
              disabled={disabled}
              className={cn(
                "score-display h-14 text-2xl font-semibold",
                runs === 0 && "col-span-1",
              )}
              onClick={() => handleRunClick(runs)}
            >
              {runs}
            </Button>
          ))}
        </div>

        {/* Extras */}
        <div className="grid grid-cols-4 gap-2">
          {extraTypes.map(({ type, label, activeClass }) => (
            <button
              key={type}
              type="button"
              onClick={() => handleExtraClick(type)}
              disabled={disabled}
              className={cn(
                "h-9 rounded-md border text-sm font-medium transition-colors",
                selectedExtra === type
                  ? `${activeClass} border-transparent`
                  : "border-border hover:bg-secondary",
              )}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Wicket */}
        <Button
          variant="destructive"
          size="lg"
          className="w-full font-semibold tracking-wide"
          onClick={onWicket}
          disabled={disabled}
        >
          Wicket
        </Button>
      </CardContent>
    </Card>
  );
}
