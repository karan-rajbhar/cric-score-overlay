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
import { Input } from "~/components/ui/input";
import {
  X,
  RotateCcw,
  AlertTriangle,
  Compass,
  Sun,
  Zap,
  Flame,
  Sparkles,
  Volume2,
  VolumeX,
  Keyboard,
} from "lucide-react";
import { Badge } from "~/components/ui/badge";
import { cn } from "~/lib/utils";
import { WagonWheelSelector } from "./wagon-wheel-selector";
import {
  hapticBall,
  hapticBoundary,
  hapticWicket,
  hapticUndo,
} from "~/lib/haptics";
import { announceDelivery, announceUndo } from "~/lib/speech";
import { usePreferencesStore } from "~/lib/stores/usePreferencesStore";

interface ScoringPanelProps {
  onScore: (
    runs: number,
    extras?: { type: string; runs: number },
    shotZone?: string,
  ) => void;
  onWicket: (extraType?: string | null) => void;
  onUndo?: () => void;
  onEditLastBall?: () => void;
  onSwapStriker?: () => void;
  onSelectBall?: (index: number) => void;
  currentOver: number;
  currentBall: number;
  lastBalls: string[];
  disabled?: boolean;
  /** Overrides `disabled` for the Undo action only (undo stays useful while a bowler is pending). */
  undoDisabled?: boolean;
  /** Ignore scoring hotkeys while a dialog/menu owns the keyboard. */
  keyboardSuppressed?: boolean;
  isFreeHit?: boolean;
  sunlightMode?: boolean;
  onToggleSunlightMode?: () => void;
  wagonWheelPrompt?: boolean;
  onToggleWagonWheelPrompt?: () => void;
}

export function ScoringPanel({
  onScore,
  onWicket,
  onUndo,
  onEditLastBall,
  onSwapStriker,
  onSelectBall,
  currentOver,
  currentBall,
  lastBalls,
  disabled = false,
  undoDisabled,
  keyboardSuppressed = false,
  isFreeHit = false,
  sunlightMode: propSunlightMode,
  onToggleSunlightMode,
  wagonWheelPrompt: propWagonWheelPrompt,
  onToggleWagonWheelPrompt,
}: ScoringPanelProps) {
  const storeSunlightMode = usePreferencesStore((s) => s.sunlightMode);
  const toggleStoreSunlightMode = usePreferencesStore(
    (s) => s.toggleSunlightMode,
  );
  const [internalSunlightMode, setInternalSunlightMode] = useState<
    boolean | null
  >(null);

  const toggleStoreWagonWheelPrompt = usePreferencesStore(
    (s) => s.toggleWagonWheelPrompt,
  );
  const [internalWagonWheelPrompt, setInternalWagonWheelPrompt] = useState<
    boolean | null
  >(null);

  const sunlightMode =
    propSunlightMode !== undefined
      ? propSunlightMode
      : internalSunlightMode !== null
        ? internalSunlightMode
        : storeSunlightMode;

  const wagonWheelPrompt =
    propWagonWheelPrompt !== undefined
      ? propWagonWheelPrompt
      : internalWagonWheelPrompt !== null
        ? internalWagonWheelPrompt
        : true;

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

  const handleToggleWagonWheel = () => {
    if (onToggleWagonWheelPrompt) {
      onToggleWagonWheelPrompt();
    } else {
      toggleStoreWagonWheelPrompt();
      setInternalWagonWheelPrompt((prev) =>
        prev === null ? !wagonWheelPrompt : !prev,
      );
    }
  };

  const voiceAnnouncements = usePreferencesStore((s) => s.voiceAnnouncements);
  const toggleVoiceAnnouncements = usePreferencesStore(
    (s) => s.toggleVoiceAnnouncements,
  );
  const wagonWheelMode = usePreferencesStore((s) => s.wagonWheelMode);

  const [showShortcutsHelp, setShowShortcutsHelp] = useState(false);

  const [selectedExtra, setSelectedExtra] = useState<string | null>(null);
  const [selectedZone, setSelectedZone] = useState<string | null>(null);
  const [isWagonWheelModalOpen, setIsWagonWheelModalOpen] =
    useState<boolean>(false);
  const [pendingScore, setPendingScore] = useState<{
    runs: number;
    extra?: { type: string; runs: number };
    rawRuns: number;
    extraType: string | null;
  } | null>(null);

  const [showMoreRuns, setShowMoreRuns] = useState(false);
  const [customRunsInput, setCustomRunsInput] = useState("");

  const runButtons = [0, 1, 2, 3, 4, 6, 5];

  const getRunSubLabel = (runs: number) => {
    if (selectedExtra === "wide") {
      return runs === 0 ? "1 Wd" : `${1 + runs} Wd`;
    }
    if (selectedExtra === "no_ball") {
      return runs === 0 ? "1 Nb" : `${runs}+1 (${runs + 1})`;
    }
    if (selectedExtra === "bye") {
      return runs === 0 ? "1 Bye" : `${runs} Byes`;
    }
    if (selectedExtra === "leg_bye") {
      return runs === 0 ? "1 Lb" : `${runs} Lb`;
    }
    if (selectedExtra === "penalty") {
      return runs === 0 ? "5 Pen" : `${runs} Pen`;
    }
    if (selectedExtra === "bonus") {
      return runs === 0 ? "1 Bon" : `${runs} Bon`;
    }
    if (runs === 0) return "DOT";
    if (runs === 4) return "FOUR";
    if (runs === 5) return "FIVE";
    if (runs === 6) return "SIX";
    return "";
  };

  const getStagedDeliveryDescription = () => {
    if (!selectedExtra) return null;
    if (selectedExtra === "wide") {
      return "WIDE BALL: Tap runs to record delivery (0 for 1 Wide, or tap completed runs).";
    }
    if (selectedExtra === "no_ball") {
      return "NO BALL: Tap runs to record delivery (+1 No Ball extra added). Free Hit next delivery!";
    }
    if (selectedExtra === "bye") {
      return "BYE: Tap runs to record delivery (credited to team extras, 0 to bowler).";
    }
    if (selectedExtra === "leg_bye") {
      return "LEG BYE: Tap runs to record delivery (credited to team extras, 0 to bowler).";
    }
    if (selectedExtra === "penalty") {
      return "PENALTY RUNS: Tap runs to record delivery (default 5 runs).";
    }
    if (selectedExtra === "bonus") {
      return "BONUS RUNS: Tap runs to record delivery (bonus runs to team).";
    }
    return "Tap runs to record delivery";
  };

  const shouldPromptWagonWheel = useCallback(
    (runs: number) => {
      if (!wagonWheelPrompt || wagonWheelMode === "off") return false;
      if (wagonWheelMode === "boundaries") return runs === 4 || runs === 6;
      if (wagonWheelMode === "all") return true;
      return runs > 0;
    },
    [wagonWheelPrompt, wagonWheelMode],
  );

  const extraTypes = [
    {
      type: "wide",
      label: "Wide",
      shortLabel: "Wd",
      activeClass: "bg-amber-500 text-white",
    },
    {
      type: "no_ball",
      label: "No ball",
      shortLabel: "Nb",
      activeClass: "bg-orange-500 text-white",
    },
    {
      type: "bye",
      label: "Bye",
      shortLabel: "Bye",
      activeClass: "bg-sky-600 text-white",
    },
    {
      type: "leg_bye",
      label: "Leg bye",
      shortLabel: "Lb",
      activeClass: "bg-violet-500 text-white",
    },
    {
      type: "penalty",
      label: "Penalty",
      shortLabel: "Pen",
      activeClass: "bg-rose-600 text-white",
    },
    {
      type: "bonus",
      label: "Bonus",
      shortLabel: "Bon",
      activeClass: "bg-emerald-600 text-white",
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
      } else if (extraType === "bonus") {
        effectiveRuns = 0;
        extra = { type: "bonus", runs: runs === 0 ? 1 : runs };
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

      if (shouldPromptWagonWheel(runs)) {
        setPendingScore({
          runs: effectiveRuns,
          extra,
          rawRuns: runs,
          extraType: selectedExtra,
        });
        setIsWagonWheelModalOpen(true);
      } else {
        onScore(effectiveRuns, extra, selectedZone ?? undefined);
        announceDelivery({
          runs: effectiveRuns,
          extraType: selectedExtra,
        });
        setSelectedExtra(null);
        setSelectedZone(null);
      }
    },
    [selectedExtra, shouldPromptWagonWheel, selectedZone, onScore],
  );

  // Keyboard-first scoring: 0-6 score, . dot, W wicket, U undo, E edit, S swap strike, D wide, N noball, B bye, L legbye, ? help.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (isWagonWheelModalOpen || showShortcutsHelp || keyboardSuppressed)
        return;
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
      // Undo stays available while run buttons are disabled (e.g. over
      // complete with bowler pending) as long as undo itself isn't disabled.
      if (key === "u") {
        if (undoDisabled ?? disabled) return;
        e.preventDefault();
        hapticUndo();
        announceUndo();
        onUndo?.();
        return;
      }
      if (key === "escape") {
        e.preventDefault();
        setSelectedExtra(null);
        return;
      }
      if (key === "?") {
        e.preventDefault();
        setShowShortcutsHelp((prev) => !prev);
        return;
      }
      if (disabled) return;
      if (["0", "1", "2", "3", "4", "5", "6"].includes(key) || key === ".") {
        e.preventDefault();
        handleRunClick(key === "." ? 0 : Number(key));
      } else if (key === "w") {
        e.preventDefault();
        hapticWicket();
        // Wicket dialog may still be cancelled — no voice announcement yet.
        onWicket(selectedExtra);
        setSelectedExtra(null);
        setSelectedZone(null);
      } else if (key === "e") {
        e.preventDefault();
        onEditLastBall?.();
      } else if (key === "s") {
        e.preventDefault();
        onSwapStriker?.();
      } else if (key === "d") {
        e.preventDefault();
        setSelectedExtra((prev) => (prev === "wide" ? null : "wide"));
      } else if (key === "n") {
        e.preventDefault();
        setSelectedExtra((prev) => (prev === "no_ball" ? null : "no_ball"));
      } else if (key === "b") {
        e.preventDefault();
        setSelectedExtra((prev) => (prev === "bye" ? null : "bye"));
      } else if (key === "l") {
        e.preventDefault();
        setSelectedExtra((prev) => (prev === "leg_bye" ? null : "leg_bye"));
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [
    isWagonWheelModalOpen,
    showShortcutsHelp,
    disabled,
    keyboardSuppressed,
    undoDisabled,
    selectedExtra,
    handleRunClick,
    onWicket,
    onUndo,
    onEditLastBall,
    onSwapStriker,
  ]);

  const handleConfirmScoreWithZone = (zone?: string | null) => {
    if (!pendingScore) return;
    onScore(pendingScore.runs, pendingScore.extra, zone ?? undefined);
    announceDelivery({
      runs: pendingScore.runs,
      extraType: pendingScore.extraType,
    });
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
      <CardContent className="space-y-1.5 p-2 sm:space-y-4 sm:p-6">
        {/* Screen-reader live summary of over state */}
        <p aria-live="polite" className="sr-only">
          Over {currentOver}.{currentBall}
          {lastBalls.length > 0
            ? `, this over: ${lastBalls.map(getBallLabel).join(", ")}`
            : ", no balls yet this over"}
          {selectedExtra ? `, ${selectedExtra.replace("_", " ")} pending` : ""}
        </p>
        {/* Row 1: Over Header & Uniform Quick Tools Bar */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <span className="tabular shrink-0 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 font-score text-xs font-black leading-none text-emerald-800 dark:text-emerald-300 sm:px-3 sm:py-1 sm:text-base">
              Over {currentOver}.{currentBall}
            </span>
            <h3 className="score-heading hidden text-xs font-extrabold tracking-tight text-foreground sm:inline-block sm:text-sm">
              Score delivery
            </h3>
          </div>
          <div className="flex shrink-0 items-center gap-1 sm:gap-1.5">
            {/* Voice announcer toggle */}
            <button
              type="button"
              onClick={toggleVoiceAnnouncements}
              aria-pressed={voiceAnnouncements}
              aria-label={`Voice announcements ${voiceAnnouncements ? "on" : "off"}`}
              title="Voice announcements for live scoring (screen-free awareness)"
              className={cn(
                "touch-target flex h-7 w-7 sm:h-8 sm:w-auto items-center justify-center gap-1.5 rounded-lg border text-xs font-bold transition-colors active:scale-95 sm:px-2.5 sm:py-1",
                voiceAnnouncements
                  ? "border-sky-500/40 bg-sky-500/10 text-sky-700 dark:text-sky-300 shadow-sm"
                  : "border-border bg-muted/50 text-muted-foreground hover:bg-muted",
              )}
            >
              {voiceAnnouncements ? (
                <Volume2 className="h-3.5 w-3.5 shrink-0" />
              ) : (
                <VolumeX className="h-3.5 w-3.5 shrink-0" />
              )}
              <span className="hidden sm:inline">
                Voice {voiceAnnouncements ? "ON" : "OFF"}
              </span>
            </button>
            {/* Keyboard shortcuts modal trigger (desktop only, no physical keyboard on mobile) */}
            <button
              type="button"
              onClick={() => setShowShortcutsHelp(true)}
              aria-label="Keyboard shortcuts cheat sheet"
              title="Keyboard shortcuts (?)"
              className="touch-target hidden sm:inline-flex h-8 w-auto items-center justify-center gap-1.5 rounded-lg border border-border bg-muted/50 text-muted-foreground transition-colors hover:bg-muted active:scale-95 px-2.5 py-1 text-xs font-bold"
            >
              <Keyboard className="h-3.5 w-3.5 shrink-0" />
              <span>Keys (?)</span>
            </button>
            {/* Sunlight mode for outdoor scoring */}
            <button
              type="button"
              onClick={handleToggleSunlight}
              aria-pressed={sunlightMode}
              aria-label={`Sunlight mode ${sunlightMode ? "on" : "off"} for outdoor scoring`}
              title="High-contrast mode for bright sunlight"
              className={cn(
                "touch-target flex h-7 w-7 sm:h-8 sm:w-auto items-center justify-center gap-1.5 rounded-lg border text-xs font-bold transition-colors active:scale-95 sm:px-2.5 sm:py-1",
                sunlightMode
                  ? "border-black bg-black text-white shadow-sm ring-2 ring-black"
                  : "border-border bg-muted/50 text-muted-foreground hover:bg-muted",
              )}
            >
              <Sun className="h-3.5 w-3.5 shrink-0" />
              <span className="hidden sm:inline">
                Sun {sunlightMode ? "ON" : "OFF"}
              </span>
            </button>
            {/* Toggle auto wagon wheel prompt */}
            <button
              type="button"
              onClick={handleToggleWagonWheel}
              aria-label={`Toggle Wagon Wheel prompt on scoring (${wagonWheelPrompt ? "ON" : "OFF"})`}
              aria-pressed={wagonWheelPrompt}
              className={cn(
                "touch-target flex h-7 w-7 sm:h-8 sm:w-auto items-center justify-center gap-1.5 rounded-lg border text-xs font-bold transition-colors active:scale-95 sm:px-2.5 sm:py-1",
                wagonWheelPrompt
                  ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 shadow-sm"
                  : "border-border bg-muted/50 text-muted-foreground hover:bg-muted",
              )}
              title="Toggle Wagon Wheel shot selector on scoring"
            >
              <Compass className="h-3.5 w-3.5 shrink-0" />
              <span className="hidden sm:inline">WW: {wagonWheelPrompt ? "ON" : "OFF"}</span>
            </button>
          </div>
        </div>

        {/* Row 2: This over ball-by-ball pill trail (scrollable if many extras) */}
        <div className="flex items-center gap-2 overflow-hidden">
          <span className="text-[11px] sm:text-xs font-bold text-muted-foreground shrink-0">
            This over:
          </span>
          {lastBalls.length > 0 ? (
            <div
              className="flex items-center gap-1.5 overflow-x-auto py-0.5 no-scrollbar flex-1"
              role="group"
              aria-label="Balls this over"
            >
              {lastBalls.map((ball, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => onSelectBall?.(idx)}
                  className={cn(
                    "touch-target flex h-7 w-7 sm:h-9 sm:w-9 items-center justify-center border text-[11px] sm:text-xs transition-colors hover:brightness-95 active:scale-95 shrink-0",
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
            <span className="text-[11px] sm:text-xs font-medium text-muted-foreground/70">
              Awaiting first ball of over...
            </span>
          )}
        </div>

        {/* Free Hit Delivery Banner (MCC Law 21.19) */}
        {isFreeHit && (
          <div
            className={cn(
              "flex items-center gap-2 rounded-2xl border px-3.5 py-2.5 shadow-sm animate-pulse",
              sunlightMode
                ? "border-2 border-black bg-amber-400 text-black font-black"
                : "border-amber-500/50 bg-amber-500/15 text-amber-900 dark:border-amber-400/50 dark:bg-amber-950/60 dark:text-amber-200",
            )}
          >
            <Zap className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
            <span className="text-xs font-black tracking-wide">
              FREE HIT DELIVERY — Batsman cannot be dismissed Bowled, Caught, LBW, or Stumped (MCC Law 21.19)!
            </span>
          </div>
        )}

        {/* Extra pending banner */}
        {selectedExtra && (
          <div
            className={cn(
              "flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-2xl border px-3.5 py-2.5 shadow-sm",
              sunlightMode
                ? "border-2 border-black bg-amber-300 text-black font-black shadow-none"
                : "border-amber-500/40 bg-amber-500/10 dark:border-amber-500/50 dark:bg-amber-950/40",
            )}
          >
            <div className="flex items-center gap-2">
              <AlertTriangle
                className={cn(
                  "h-4 w-4 shrink-0",
                  sunlightMode ? "text-black" : "text-amber-500",
                )}
              />
              <span
                className={cn(
                  "text-xs font-bold",
                  sunlightMode
                    ? "text-black font-black"
                    : "text-amber-900 dark:text-amber-200",
                )}
              >
                {getStagedDeliveryDescription()}
              </span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className={cn(
                "h-6 px-2 text-xs font-bold rounded-lg self-end sm:self-auto",
                sunlightMode
                  ? "text-black hover:bg-black/10"
                  : "text-amber-900 hover:bg-amber-500/20 dark:text-amber-200",
              )}
              onClick={() => setSelectedExtra(null)}
            >
              Cancel (Esc)
            </Button>
          </div>
        )}


        {/* Responsive Keypad Grid (Thumb-Zone Optimization) */}
        <div
          className="grid grid-cols-4 gap-1.5 sm:grid-cols-8 sm:gap-2.5"
          role="group"
          aria-label="Runs scored"
        >
          {runButtons.map((runs) => {
            const isFour = runs === 4;
            const isSix = runs === 6;
            const isFive = runs === 5;
            const isDot = runs === 0;
            const subLabel = getRunSubLabel(runs);
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
                  "score-display tabular touch-target flex h-11 flex-col items-center justify-center rounded-xl border-2 text-xl font-black transition-transform duration-75 active:scale-95 disabled:opacity-50 sm:h-16 sm:rounded-2xl sm:text-3xl select-none",
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
                        isFive &&
                          "border-black bg-white text-black hover:bg-neutral-100",
                        isFour &&
                          "border-black bg-emerald-600 text-white hover:bg-emerald-700",
                        isSix &&
                          "border-black bg-purple-700 text-white hover:bg-purple-800",
                      )
                    : cn(
                        isDot &&
                          "border-border/80 bg-background/80 text-muted-foreground shadow-sm hover:border-slate-400 hover:text-foreground dark:border-border/80 dark:bg-card/80 dark:text-muted-foreground dark:hover:border-border dark:hover:bg-muted/80 dark:hover:text-foreground",
                        runs === 1 &&
                          "border-amber-500/30 bg-amber-500/5 text-amber-800 shadow-sm hover:bg-amber-500/15 dark:border-border/80 dark:bg-card/80 dark:text-foreground dark:hover:border-amber-500/40 dark:hover:bg-muted/80",
                        runs === 2 &&
                          "border-amber-500/40 bg-amber-500/10 text-amber-900 shadow-sm hover:bg-amber-500/20 dark:border-border/80 dark:bg-card/80 dark:text-foreground dark:hover:border-amber-500/40 dark:hover:bg-muted/80",
                        runs === 3 &&
                          "border-orange-500/40 bg-orange-500/10 text-orange-900 shadow-sm hover:bg-orange-500/20 dark:border-border/80 dark:bg-card/80 dark:text-foreground dark:hover:border-orange-500/40 dark:hover:bg-muted/80",
                        isFive &&
                          "border-sky-500/40 bg-sky-500/10 text-sky-900 shadow-sm hover:bg-sky-500/20 dark:border-border/80 dark:bg-card/80 dark:text-foreground dark:hover:border-sky-500/40 dark:hover:bg-muted/80",
                        isFour &&
                          "border-emerald-500/50 bg-emerald-500/15 text-emerald-700 shadow-md ring-2 ring-emerald-500/20 hover:bg-emerald-500/25 dark:border-emerald-500/60 dark:bg-emerald-950/50 dark:text-emerald-300 dark:shadow-[inset_0_1px_0_0_rgba(52,211,153,0.35),0_0_16px_-3px_rgba(16,185,129,0.35)] dark:ring-0 dark:hover:bg-emerald-900/60",
                        isSix &&
                          "border-purple-500/50 bg-purple-500/15 text-purple-700 shadow-md ring-2 ring-purple-500/20 hover:bg-purple-500/25 dark:border-purple-500/60 dark:bg-purple-950/50 dark:text-purple-300 dark:shadow-[inset_0_1px_0_0_rgba(192,132,252,0.35),0_0_16px_-3px_rgba(168,85,247,0.35)] dark:ring-0 dark:hover:bg-purple-900/60",
                      ),
                )}
                onClick={() => handleRunClick(runs)}
              >
                <span>{runs}</span>
                {subLabel && (
                  <span
                    className={cn(
                      "font-sans text-[10px] font-black tracking-wider sm:text-xs",
                      sunlightMode
                        ? "text-white"
                        : runs === 4
                          ? "text-emerald-600 dark:text-emerald-400"
                          : runs === 6
                            ? "text-purple-600 dark:text-purple-400"
                            : runs === 5
                              ? "text-sky-600 dark:text-sky-400"
                              : selectedExtra
                                ? "text-amber-700 dark:text-amber-300 font-extrabold"
                                : "text-muted-foreground",
                    )}
                  >
                    {subLabel}
                  </span>
                )}
              </button>
            );
          })}

          {/* More runs button */}
          <button
            type="button"
            disabled={disabled}
            aria-label="More run options: 7 to 13+ runs"
            title="More run options (7, 8, 9, 10, 11, 12, 13, custom)"
            onClick={() => setShowMoreRuns((prev) => !prev)}
            className={cn(
              "score-display tabular touch-target flex h-11 flex-col items-center justify-center rounded-xl border-2 text-xs font-black transition-transform duration-75 active:scale-95 disabled:opacity-50 sm:h-16 sm:rounded-2xl sm:text-base select-none",
              sunlightMode
                ? showMoreRuns
                  ? "border-2 border-black bg-black text-white shadow-none"
                  : "border-2 border-black bg-white text-black hover:bg-neutral-100 shadow-none"
                : showMoreRuns
                  ? "border-primary bg-primary/15 text-primary shadow-sm"
                  : "border-border/80 bg-background/80 text-muted-foreground shadow-sm hover:border-slate-400 hover:text-foreground dark:border-border/80 dark:bg-card/80 dark:text-muted-foreground dark:hover:border-border dark:hover:bg-muted/80 dark:hover:text-foreground",
            )}
          >
            <span className="text-sm font-black sm:text-lg">+More</span>
            <span className="font-sans text-[8px] font-bold text-muted-foreground sm:text-[10px]">
              7–13+
            </span>
          </button>
        </div>

        {/* High runs / extras expandable drawer (7 to 13+) */}
        {showMoreRuns && (
          <div className="rounded-2xl border border-border/80 bg-muted/40 p-3 space-y-2.5 dark:border-border/80 dark:bg-card/90">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-foreground">
                High Runs / Extras (7 to 13+):
              </span>
              <button
                type="button"
                onClick={() => setShowMoreRuns(false)}
                className="rounded-full p-1 text-muted-foreground hover:bg-muted"
                title="Close high runs"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
              {[7, 8, 9, 10, 11, 12, 13].map((r) => (
                <Button
                  key={r}
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-9 min-w-[42px] rounded-xl font-bold text-xs"
                  onClick={() => {
                    handleRunClick(r);
                    setShowMoreRuns(false);
                  }}
                >
                  {r}
                </Button>
              ))}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const val = Number(customRunsInput);
                  if (!isNaN(val) && val >= 0) {
                    handleRunClick(val);
                    setCustomRunsInput("");
                    setShowMoreRuns(false);
                  }
                }}
                className="flex items-center gap-1.5"
              >
                <Input
                  type="number"
                  min="0"
                  max="50"
                  value={customRunsInput}
                  onChange={(e) => setCustomRunsInput(e.target.value)}
                  placeholder="Custom..."
                  className="h-9 w-24 text-xs font-bold"
                />
                <Button
                  type="submit"
                  size="sm"
                  variant="secondary"
                  className="h-9 px-3 text-xs font-bold"
                  disabled={!customRunsInput}
                >
                  Score
                </Button>
              </form>
            </div>
          </div>
        )}

        {/* Extras as Playful Capsules: Single Row on All Screen Sizes */}
        <div
          className="grid grid-cols-6 gap-1 sm:gap-2"
          role="group"
          aria-label="Extras"
        >
          {extraTypes.map(({ type, label, shortLabel, activeClass }) => (
            <button
              key={type}
              type="button"
              onClick={() => handleExtraClick(type)}
              disabled={disabled}
              aria-pressed={selectedExtra === type}
              aria-label={label}
              className={cn(
                "touch-target h-8 sm:h-11 rounded-lg sm:rounded-xl text-[10px] sm:text-xs font-bold transition-colors active:scale-95",
                sunlightMode
                  ? selectedExtra === type
                    ? "border-2 border-black bg-black font-black text-white shadow-none"
                    : "border-2 border-black bg-white font-black text-black hover:bg-neutral-100 shadow-none"
                  : selectedExtra === type
                    ? `${activeClass} border-transparent font-black shadow-md`
                    : "border border-border/80 bg-background/80 text-foreground shadow-sm hover:bg-muted dark:border-border/80 dark:bg-card/80 dark:hover:bg-muted/80 dark:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05)]",
              )}
            >
              <span className="sm:hidden" aria-hidden="true">{shortLabel}</span>
              <span className="hidden sm:inline" aria-hidden="true">{label}</span>
            </button>
          ))}
        </div>

        {/* Primary Action Row: Wicket & Undo (Swap is on Batters HUD; Edit is via ball trail / Undo) */}
        <div
          className={cn(
            "grid gap-1.5 sm:gap-2",
            onUndo ? "grid-cols-2" : "grid-cols-1",
          )}
        >
          <Button
            variant="destructive"
            size="lg"
            className={cn(
              "touch-target h-10 sm:h-12 gap-1.5 sm:gap-2 rounded-xl sm:rounded-2xl text-xs sm:text-sm font-black tracking-wider shadow-sm",
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
            aria-label="Wicket dismissal"
            title="Wicket dismissal (W)"
          >
            <Zap className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span aria-hidden="true">
              WICKET<span className="hidden sm:inline"> (W)</span>
            </span>
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
                disabled={undoDisabled ?? disabled}
              title="Undo last ball (U)"
              aria-label="Undo last ball"
              className={cn(
                "touch-target h-10 sm:h-12 gap-1.5 sm:gap-2 rounded-xl sm:rounded-2xl border-2 text-xs sm:text-sm font-black tracking-wide px-2 sm:px-4",
                sunlightMode
                  ? "border-black bg-white text-black hover:bg-neutral-100"
                  : "border-border/80 bg-background/80 text-foreground hover:bg-muted dark:border-border/80 dark:bg-card/80 dark:hover:bg-muted/80 dark:text-foreground dark:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06)]",
              )}
            >
              <RotateCcw className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span aria-hidden="true">
                UNDO<span className="hidden sm:inline"> (U)</span>
              </span>
            </Button>
          )}
        </div>

        <p className="hidden sm:block text-center text-[11px] text-muted-foreground">
          Keys 0–6 score, . dot, W wicket, U undo, S swap, ? help
        </p>

        {/* Stumps App Style Wagon Wheel Selection Dialog */}
        <Dialog
          open={isWagonWheelModalOpen}
          onOpenChange={(open) => {
            // Closing via Esc/backdrop discards the pending delivery instead
            // of silently recording it — mis-taps must not corrupt the score.
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
                Tap the wagon wheel sector where the shot was played, or tap Score Directly
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

            <DialogFooter className="flex flex-col-reverse sm:flex-row items-center justify-between gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleCancelModal}
                className="text-xs text-muted-foreground hover:text-destructive"
              >
                Cancel Delivery (Discard)
              </Button>
              <Button
                type="button"
                variant="default"
                size="sm"
                onClick={handleSkipZone}
                className="w-full sm:w-auto text-xs font-bold"
              >
                Skip (Score without zone)
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Rapid-Scoring Keyboard Shortcuts Dialog */}
        <Dialog open={showShortcutsHelp} onOpenChange={setShowShortcutsHelp}>
          <DialogContent className="max-w-md rounded-3xl p-5 sm:p-6">
            <DialogHeader>
              <div className="flex items-center gap-2">
                <Keyboard className="h-5 w-5 text-emerald-500" />
                <DialogTitle className="text-lg font-black">
                  Keyboard Rapid-Scoring
                </DialogTitle>
              </div>
              <DialogDescription className="text-xs text-muted-foreground">
                Desktop hotkeys designed for high-speed, zero-mouse cricket scoring.
              </DialogDescription>
            </DialogHeader>

            <div className="grid grid-cols-2 gap-2 text-xs py-2">
              <div className="flex items-center justify-between rounded-xl bg-muted/60 p-2.5 font-mono">
                <span className="font-bold">0 – 6 / .</span>
                <Badge variant="outline" className="font-sans text-[11px]">Score (Dot)</Badge>
              </div>
              <div className="flex items-center justify-between rounded-xl bg-muted/60 p-2.5 font-mono">
                <span className="font-bold">W</span>
                <Badge variant="destructive" className="font-sans text-[11px]">Wicket</Badge>
              </div>
              <div className="flex items-center justify-between rounded-xl bg-muted/60 p-2.5 font-mono">
                <span className="font-bold">D</span>
                <Badge variant="outline" className="font-sans text-[11px]">Wide Ball</Badge>
              </div>
              <div className="flex items-center justify-between rounded-xl bg-muted/60 p-2.5 font-mono">
                <span className="font-bold">N</span>
                <Badge variant="outline" className="font-sans text-[11px]">No Ball</Badge>
              </div>
              <div className="flex items-center justify-between rounded-xl bg-muted/60 p-2.5 font-mono">
                <span className="font-bold">B</span>
                <Badge variant="outline" className="font-sans text-[11px]">Bye</Badge>
              </div>
              <div className="flex items-center justify-between rounded-xl bg-muted/60 p-2.5 font-mono">
                <span className="font-bold">L</span>
                <Badge variant="outline" className="font-sans text-[11px]">Leg Bye</Badge>
              </div>
              <div className="flex items-center justify-between rounded-xl bg-muted/60 p-2.5 font-mono">
                <span className="font-bold">S</span>
                <Badge variant="outline" className="font-sans text-[11px]">Swap Strike</Badge>
              </div>
              <div className="flex items-center justify-between rounded-xl bg-muted/60 p-2.5 font-mono">
                <span className="font-bold">E</span>
                <Badge variant="outline" className="font-sans text-[11px]">Edit Last Ball</Badge>
              </div>
              <div className="flex items-center justify-between rounded-xl bg-muted/60 p-2.5 font-mono">
                <span className="font-bold">U</span>
                <Badge variant="outline" className="font-sans text-[11px]">Undo Ball</Badge>
              </div>
              <div className="flex items-center justify-between rounded-xl bg-muted/60 p-2.5 font-mono">
                <span className="font-bold">Esc</span>
                <Badge variant="outline" className="font-sans text-[11px]">Clear Extra</Badge>
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="default"
                size="sm"
                onClick={() => setShowShortcutsHelp(false)}
                className="w-full text-xs font-bold"
              >
                Got it (Press ? anytime)
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
