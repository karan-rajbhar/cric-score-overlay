"use client";

import { useCallback, useEffect, useState } from "react";
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
import { X, RotateCcw, AlertTriangle, Compass, Sun, Zap, Flame, Sparkles } from "lucide-react";
import { cn } from "~/lib/utils";
import { WagonWheelSelector } from "./wagon-wheel-selector";
import {
  hapticBall,
  hapticBoundary,
  hapticWicket,
  hapticUndo,
} from "~/lib/haptics";
import { usePreferencesStore } from "~/lib/stores/usePreferencesStore";

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
  sunlightMode?: boolean;
  onToggleSunlightMode?: () => void;
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
  sunlightMode: propSunlightMode,
  onToggleSunlightMode,
}: ScoringPanelProps) {
  const storeSunlightMode = usePreferencesStore((s) => s.sunlightMode);
  const toggleStoreSunlightMode = usePreferencesStore(
    (s) => s.toggleSunlightMode,
  );
  const [internalSunlightMode, setInternalSunlightMode] = useState<
    boolean | null
  >(null);

  const sunlightMode =
    propSunlightMode !== undefined
      ? propSunlightMode
      : internalSunlightMode !== null
        ? internalSunlightMode
        : storeSunlightMode;

  const handleToggleSunlight = () => {
    if (onToggleSunlightMode) {
      onToggleSunlightMode();
    } else {
      toggleStoreSunlightMode();
      setInternalSunlightMode((prev) =>
        prev === null ? !storeSunlightMode : !prev,
      );
    }
  };

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
        // Laws of Cricket: a penalty is always 5 runs — never user-settable.
        effectiveRuns = 0;
        extra = { type: "penalty", runs: 5 };
      } else {
        effectiveRuns = runs === 0 ? 0 : runs;
        extra = { type: extraType, runs: runs === 0 ? 1 : runs };
      }
    }

    return { effectiveRuns, extra };
  };

  const handleRunClick = useCallback(
    (runs: number) => {
      if (runs === 4 || runs === 6) {
        hapticBoundary();
      } else {
        hapticBall();
      }

      const { effectiveRuns, extra } = calculateScorePayload(
        runs,
        selectedExtra,
      );

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
    },
    [selectedExtra, wagonWheelPrompt, selectedZone, onScore],
  );

  // Keyboard-first scoring: 0/1/2/3/4/6 score, W wicket, U undo.
  // Ignored while typing or when the wagon-wheel dialog is open.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (isWagonWheelModalOpen || disabled) return;
      const target = e.target as HTMLElement | null;
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement ||
        target?.isContentEditable
      ) {
        return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const key = e.key.toLowerCase();
      if (["0", "1", "2", "3", "4", "6"].includes(key)) {
        e.preventDefault();
        handleRunClick(Number(key));
      } else if (key === "w") {
        e.preventDefault();
        hapticWicket();
        onWicket(selectedExtra);
        setSelectedExtra(null);
        setSelectedZone(null);
      } else if (key === "u") {
        e.preventDefault();
        hapticUndo();
        onUndo?.();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [
    isWagonWheelModalOpen,
    disabled,
    selectedExtra,
    handleRunClick,
    onWicket,
    onUndo,
  ]);

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
    if (sunlightMode) {
      if (ball === "W")
        return "bg-red-600 text-white border-2 border-black font-black rounded-md shadow-none";
      if (ball === "4")
        return "bg-emerald-600 text-white border-2 border-black font-black rounded-full shadow-none";
      if (ball === "6")
        return "bg-purple-700 text-white border-2 border-black font-black rounded-full shadow-none";
      if (ball.includes("wd") || ball.includes("nb"))
        return "bg-amber-300 text-black border-2 border-black font-black rounded-full shadow-none";
      return "bg-white text-black border-2 border-black font-black rounded-full shadow-none";
    }

    // Shape + text carry meaning, not color alone (color-blind safe).
    if (ball === "W")
      return "bg-red-600 text-white border-red-700 font-black shadow-sm rounded-md outline outline-1 outline-offset-1 outline-red-800";
    if (ball === "4")
      return "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border-emerald-600 font-black rounded-full ring-2 ring-emerald-500/30";
    if (ball === "6")
      return "bg-purple-500/20 text-purple-700 dark:text-purple-300 border-purple-600 font-black rounded-full ring-2 ring-offset-1 ring-purple-500/40 ring-offset-background";
    if (ball.includes("wd") || ball.includes("nb"))
      return "bg-amber-400/25 text-amber-800 dark:text-amber-200 border-amber-600 border-dashed font-bold rounded-full";
    return "bg-muted/60 text-muted-foreground border-border/80 font-medium rounded-full";
  };

  const getBallLabel = (ball: string) => {
    if (ball === "W") return "Wicket";
    if (ball === "4") return "Four";
    if (ball === "6") return "Six";
    if (ball.includes("wd")) return `Wide ${ball}`;
    if (ball.includes("nb")) return `No ball ${ball}`;
    if (ball === "0" || ball === "•") return "Dot ball";
    return `${ball} run${ball === "1" ? "" : "s"}`;
  };

  return (
    <Card
      data-sunlight={sunlightMode ? "true" : "false"}
      className={cn(
        "card-data bg-card/90",
        sunlightMode && "sunlight-mode border-2 border-black shadow-md",
      )}
    >
      <CardContent className="space-y-3 p-3.5 sm:space-y-4 sm:p-6">
        {/* Screen-reader live summary of over state */}
        <p aria-live="polite" className="sr-only">
          Over {currentOver}.{currentBall}
          {lastBalls.length > 0
            ? `, this over: ${lastBalls.map(getBallLabel).join(", ")}`
            : ", no balls yet this over"}
          {selectedExtra ? `, ${selectedExtra.replace("_", " ")} pending` : ""}
        </p>
        {/* Header row */}
        <div className="flex items-center justify-between gap-2">
          <h3 className="score-heading text-sm font-extrabold tracking-tight text-foreground">
            Score delivery
          </h3>
          <div className="flex items-center gap-2">
            {/* Sunlight mode for outdoor scoring */}
            <button
              type="button"
              onClick={handleToggleSunlight}
              aria-pressed={sunlightMode}
              aria-label={`Sunlight mode ${sunlightMode ? "on" : "off"} for outdoor scoring`}
              title="High-contrast mode for bright sunlight"
              className={cn(
                "touch-target flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-extrabold transition-colors active:scale-95",
                sunlightMode
                  ? "border-black bg-black text-white shadow-sm ring-2 ring-black"
                  : "border-border bg-muted/50 text-muted-foreground hover:bg-muted",
              )}
            >
              <Sun className="h-3.5 w-3.5" aria-hidden="true" />
              <span className="hidden sm:inline">
                Sun {sunlightMode ? "ON" : "OFF"}
              </span>
            </button>
            {/* Toggle auto wagon wheel prompt */}
            <button
              type="button"
              onClick={() => setWagonWheelPrompt((prev) => !prev)}
              aria-label={`Toggle Wagon Wheel prompt on scoring (${wagonWheelPrompt ? "ON" : "OFF"})`}
              aria-pressed={wagonWheelPrompt}
              className={cn(
                "touch-target flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-extrabold transition-colors active:scale-95",
                wagonWheelPrompt
                  ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 shadow-sm"
                  : "border-border bg-muted/50 text-muted-foreground hover:bg-muted",
              )}
              title="Toggle Wagon Wheel shot selector on scoring"
            >
              <Compass className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Wagon Wheel: {wagonWheelPrompt ? "ON" : "OFF"}</span>
            </button>

            {onUndo && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  hapticUndo();
                  onUndo();
                }}
                disabled={disabled}
                title="Undo last ball (U)"
                aria-label="Undo last ball"
                className="touch-target h-9 w-9 rounded-full p-0 text-muted-foreground hover:text-foreground"
              >
                <RotateCcw className="h-4 w-4" aria-hidden="true" />
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
            <div
              className="flex flex-wrap gap-1.5 sm:gap-2"
              role="group"
              aria-label="Balls this over"
            >
              {lastBalls.map((ball, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => onSelectBall?.(idx)}
                  className={cn(
                    "touch-target flex h-9 w-9 items-center justify-center border text-xs transition-colors hover:brightness-95 active:scale-95 sm:h-9 sm:w-9",
                    getBallDisplay(ball),
                  )}
                  title={`Ball ${idx + 1}: ${getBallLabel(ball)}`}
                  aria-label={`Ball ${idx + 1}: ${getBallLabel(ball)}`}
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
          <div
            className={cn(
              "flex items-center justify-between rounded-2xl border px-3.5 py-2.5 shadow-sm",
              sunlightMode
                ? "border-2 border-black bg-amber-300 text-black font-black shadow-none"
                : "border-amber-500/40 bg-amber-500/10 dark:border-amber-500/50 dark:bg-amber-950/40",
            )}
          >
            <span
              className={cn(
                "flex items-center gap-2 text-xs font-bold",
                sunlightMode
                  ? "text-black font-black"
                  : "text-amber-900 dark:text-amber-200",
              )}
            >
              <AlertTriangle
                className={cn(
                  "h-4 w-4",
                  sunlightMode ? "text-black" : "text-amber-500",
                )}
              />
              {selectedExtra.replace("_", " ").toUpperCase()} PENDING: Tap runs
              to record delivery
            </span>
            <Button
              variant="ghost"
              size="sm"
              className={cn(
                "h-6 w-6 rounded-full p-0",
                sunlightMode
                  ? "text-black hover:bg-black/10"
                  : "text-amber-900 hover:bg-amber-500/20 dark:text-amber-200",
              )}
              onClick={() => setSelectedExtra(null)}
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}


        {/* Responsive Keypad Grid (Thumb-Zone Optimization) */}
        <div
          className="grid grid-cols-3 gap-2 sm:grid-cols-6 sm:gap-2.5"
          role="group"
          aria-label="Runs scored, keys 0 to 6"
        >
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
                title={
                  isDot
                    ? "Dot ball (0)"
                    : isFour
                      ? "Four (4)"
                      : isSix
                        ? "Six (6)"
                        : `${runs} runs (${runs})`
                }
                className={cn(
                  "score-display tabular touch-target flex h-14 flex-col items-center justify-center rounded-xl border-2 text-2xl font-black transition-colors active:scale-90 disabled:opacity-50 sm:h-16 sm:rounded-2xl sm:text-3xl",
                  sunlightMode
                    ? cn(
                        "border-2 font-black shadow-none",
                        isDot &&
                          "border-black bg-white text-black hover:bg-neutral-100",
                        runs === 1 &&
                          "border-black bg-white text-black hover:bg-neutral-100",
                        runs === 2 &&
                          "border-black bg-white text-black hover:bg-neutral-100",
                        runs === 3 &&
                          "border-black bg-white text-black hover:bg-neutral-100",
                        isFour &&
                          "border-black bg-emerald-600 text-white hover:bg-emerald-700",
                        isSix &&
                          "border-black bg-purple-700 text-white hover:bg-purple-800",
                      )
                    : cn(
                        isDot &&
                          "border-border/80 bg-background/80 text-muted-foreground shadow-sm hover:border-slate-400 hover:text-foreground dark:border-[#29332e] dark:bg-[#141a17] dark:text-muted-foreground dark:hover:border-[#384a41] dark:hover:bg-[#1a231f] dark:hover:text-foreground dark:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06)]",
                        runs === 1 &&
                          "border-amber-500/30 bg-amber-500/5 text-amber-800 shadow-sm hover:bg-amber-500/15 dark:border-[#29332e] dark:bg-[#141a17] dark:text-foreground dark:hover:border-amber-500/40 dark:hover:bg-[#1c221e] dark:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06)]",
                        runs === 2 &&
                          "border-amber-500/40 bg-amber-500/10 text-amber-900 shadow-sm hover:bg-amber-500/20 dark:border-[#29332e] dark:bg-[#141a17] dark:text-foreground dark:hover:border-amber-500/40 dark:hover:bg-[#1c221e] dark:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06)]",
                        runs === 3 &&
                          "border-orange-500/40 bg-orange-500/10 text-orange-900 shadow-sm hover:bg-orange-500/20 dark:border-[#29332e] dark:bg-[#141a17] dark:text-foreground dark:hover:border-orange-500/40 dark:hover:bg-[#1c221e] dark:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06)]",
                        isFour &&
                          "border-emerald-500/50 bg-emerald-500/15 text-emerald-700 shadow-md ring-2 ring-emerald-500/20 hover:bg-emerald-500/25 dark:border-emerald-500/60 dark:bg-emerald-950/50 dark:text-emerald-300 dark:shadow-[inset_0_1px_0_0_rgba(52,211,153,0.35),0_0_16px_-3px_rgba(16,185,129,0.35)] dark:ring-0 dark:hover:bg-emerald-900/60",
                        isSix &&
                          "border-purple-500/50 bg-purple-500/15 text-purple-700 shadow-md ring-2 ring-purple-500/20 hover:bg-purple-500/25 dark:border-purple-500/60 dark:bg-purple-950/50 dark:text-purple-300 dark:shadow-[inset_0_1px_0_0_rgba(192,132,252,0.35),0_0_16px_-3px_rgba(168,85,247,0.35)] dark:ring-0 dark:hover:bg-purple-900/60",
                      ),
                )}
                onClick={() => handleRunClick(runs)}
              >
                <span>{runs}</span>
                {isFour && (
                  <span
                    className={cn(
                      "font-sans text-[10px] font-black tracking-wider sm:text-xs",
                      sunlightMode
                        ? "text-white"
                        : "text-emerald-600 dark:text-emerald-400",
                    )}
                  >
                    FOUR
                  </span>
                )}
                {isSix && (
                  <span
                    className={cn(
                      "font-sans text-[10px] font-black tracking-wider sm:text-xs",
                      sunlightMode
                        ? "text-white"
                        : "text-purple-600 dark:text-purple-400",
                    )}
                  >
                    SIX
                  </span>
                )}
                {isDot && (
                  <span
                    className={cn(
                      "font-sans text-[10px] font-bold sm:text-xs",
                      sunlightMode ? "text-black" : "text-muted-foreground",
                    )}
                  >
                    DOT
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Extras as Playful Capsules */}
        <div
          className="grid grid-cols-3 gap-1.5 sm:grid-cols-5 sm:gap-2"
          role="group"
          aria-label="Extras"
        >
          {extraTypes.map(({ type, label, activeClass }) => (
            <button
              key={type}
              type="button"
              onClick={() => handleExtraClick(type)}
              disabled={disabled}
              aria-pressed={selectedExtra === type}
              className={cn(
                "touch-target h-11 rounded-xl text-[11px] font-bold transition-colors active:scale-95 sm:h-11 sm:text-xs",
                sunlightMode
                  ? selectedExtra === type
                    ? "border-2 border-black bg-black font-black text-white shadow-none"
                    : "border-2 border-black bg-white font-black text-black hover:bg-neutral-100 shadow-none"
                  : selectedExtra === type
                    ? `${activeClass} border-transparent font-black shadow-md`
                    : "border border-border/80 bg-background/80 text-foreground shadow-sm hover:bg-muted dark:border-[#29332e] dark:bg-[#141a17] dark:hover:bg-[#1c2420] dark:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05)]",
              )}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Primary Action Row: Wicket & Prominent Undo */}
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <Button
            variant="destructive"
            size="lg"
            className={cn(
              "touch-target h-12 gap-2 rounded-2xl text-sm font-black tracking-wider shadow-sm",
              onUndo ? "sm:col-span-2" : "w-full",
              sunlightMode
                ? "border-2 border-black bg-red-600 font-black text-white hover:bg-red-700 shadow-none"
                : "dark:bg-rose-950/70 dark:border dark:border-rose-500/60 dark:text-rose-100 dark:hover:bg-rose-900/80 dark:shadow-[inset_0_1px_0_0_rgba(244,63,94,0.35),0_0_16px_-4px_rgba(244,63,94,0.35)]",
            )}
            onClick={() => {
              hapticWicket();
              onWicket(selectedExtra);
              setSelectedExtra(null);
              setSelectedZone(null);
            }}
            disabled={disabled}
            title="Wicket dismissal (W)"
          >
            <Zap className="h-4 w-4" aria-hidden="true" />
            <span>WICKET DISMISSAL</span>
          </Button>

          {onUndo && (
            <Button
              type="button"
              variant="outline"
              size="lg"
              onClick={() => {
                hapticUndo();
                onUndo();
              }}
              disabled={disabled}
              title="Quick undo delivery (U)"
              aria-label="Quick undo delivery"
              className={cn(
                "touch-target h-12 gap-1.5 rounded-2xl border-2 text-xs font-black tracking-wide",
                sunlightMode
                  ? "border-black bg-white text-black hover:bg-neutral-100"
                  : "border-border/80 bg-background/80 text-foreground hover:bg-muted dark:border-[#29332e] dark:bg-[#141a17] dark:hover:bg-[#1c2420] dark:text-foreground dark:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06)]",
              )}
            >
              <RotateCcw className="h-4 w-4" aria-hidden="true" />
              <span>UNDO (U)</span>
            </Button>
          )}
        </div>

        <p className="text-center text-[11px] text-muted-foreground">
          Keys 0–6 score, W wicket, U undo
        </p>

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
                  {pendingScore.rawRuns === 4 && (
                    <span className="inline-flex items-center gap-1 font-bold text-amber-600 dark:text-amber-400">
                      <Flame className="h-3.5 w-3.5" /> FOUR
                    </span>
                  )}
                  {pendingScore.rawRuns === 6 && (
                    <span className="inline-flex items-center gap-1 font-bold text-purple-600 dark:text-purple-400">
                      <Sparkles className="h-3.5 w-3.5" /> MAX
                    </span>
                  )}
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
