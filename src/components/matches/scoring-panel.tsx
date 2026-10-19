"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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
  /**
   * What the last undo took back: said in a line under the over strip
   * ("Ball removed: Four, 3.6, Starc to Kohli") with "Restore ball", until
   * the next scoring action.
   */
  undoNotice?: {
    /** An undone event: "Retirement", "Penalty" or "Bonus". */
    heading?: string | null;
    label: string;
    /** "3.6" (over.ball). */
    position: string | null;
    /** "Starc to Kohli". */
    players: string | null;
    /** What else the undo took back. */
    note: string | null;
    pending: boolean;
    canRedo: boolean;
  } | null;
  onRedo?: () => void;
  /** Ignore scoring hotkeys while a dialog/menu owns the keyboard. */
  keyboardSuppressed?: boolean;
  isFreeHit?: boolean;
  sunlightMode?: boolean;
  wagonWheelPrompt?: boolean;
  /** Controlled visibility of the keyboard shortcuts sheet (the `?` key toggles it too). */
  shortcutsOpen?: boolean;
  onShortcutsOpenChange?: (open: boolean) => void;
}

const EXTRA_TYPES = [
  {
    type: "wide",
    label: "Wide",
    activeClass: "bg-primary text-primary-foreground",
  },
  {
    type: "no_ball",
    label: "No ball",
    activeClass: "bg-primary text-primary-foreground",
  },
  {
    type: "bye",
    label: "Bye",
    activeClass: "bg-primary text-primary-foreground",
  },
  {
    type: "leg_bye",
    label: "Leg bye",
    activeClass: "bg-primary text-primary-foreground",
  },
];

const RUN_BUTTONS = [0, 1, 2, 3, 4, 6, 5];

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
  undoNotice = null,
  onRedo,
  keyboardSuppressed = false,
  isFreeHit = false,
  sunlightMode: propSunlightMode,
  wagonWheelPrompt: propWagonWheelPrompt,
  shortcutsOpen,
  onShortcutsOpenChange,
}: ScoringPanelProps) {
  const storeSunlightMode = usePreferencesStore((s) => s.sunlightMode);
  const wagonWheelMode = usePreferencesStore((s) => s.wagonWheelMode);

  const sunlightMode = propSunlightMode ?? storeSunlightMode;
  const wagonWheelPrompt = propWagonWheelPrompt ?? true;

  const [internalShortcuts, setInternalShortcuts] = useState(false);
  const showShortcutsHelp = shortcutsOpen ?? internalShortcuts;
  const setShowShortcutsHelp = useCallback(
    (open: boolean) => {
      setInternalShortcuts(open);
      onShortcutsOpenChange?.(open);
    },
    [onShortcutsOpenChange],
  );

  const [selectedExtra, setSelectedExtra] = useState<string | null>(null);
  const [selectedZone, setSelectedZone] = useState<string | null>(null);
  const [isWagonWheelModalOpen, setIsWagonWheelModalOpen] = useState(false);
  const [pendingScore, setPendingScore] = useState<{
    runs: number;
    extra?: { type: string; runs: number };
    rawRuns: number;
    extraType: string | null;
  } | null>(null);

  const [showMoreRuns, setShowMoreRuns] = useState(false);
  const [customRunsInput, setCustomRunsInput] = useState("");

  const overSummary = useMemo(() => {
    let runs = 0;
    let wickets = 0;
    for (const b of lastBalls) {
      if (b === "W") {
        wickets++;
      } else {
        const num = parseInt(b, 10);
        if (!isNaN(num)) {
          runs += num;
        } else if (b.includes("wd") || b.includes("nb")) {
          runs += 1;
        }
      }
    }
    return { runs, wickets };
  }, [lastBalls]);

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
    if (runs === 0) return "Dot";
    if (runs === 4) return "Four";
    if (runs === 5) return "Five";
    if (runs === 6) return "Six";
    return "";
  };

  const getStagedDeliveryDescription = () => {
    if (!selectedExtra) return null;
    // Short: the scorer reads it at a glance, mid-over.
    if (selectedExtra === "wide") {
      return "Wide selected: tap the runs (0 for just the wide)";
    }
    if (selectedExtra === "no_ball") {
      return "No ball selected: tap the runs off the bat. Free hit next";
    }
    if (selectedExtra === "bye") {
      return "Byes selected: tap the runs taken";
    }
    if (selectedExtra === "leg_bye") {
      return "Leg byes selected: tap the runs taken";
    }
    return "Tap the runs to record the ball";
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
        if (selectedExtra) {
          e.preventDefault();
          setSelectedExtra(null);
          return;
        }
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
        setShowShortcutsHelp(!showShortcutsHelp);
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
    setShowShortcutsHelp,
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
        return "bg-red-600 text-white border-2 border-black font-bold rounded-md shadow-none";
      if (ball === "4")
        return "bg-emerald-600 text-white border-2 border-black font-bold rounded-full shadow-none";
      if (ball === "6")
        return "bg-purple-700 text-white border-2 border-black font-bold rounded-full shadow-none";
      if (ball.includes("wd") || ball.includes("nb"))
        return "bg-amber-300 text-black border-2 border-black font-bold rounded-full shadow-none";
      return "bg-white text-black border-2 border-black font-bold rounded-full shadow-none";
    }

    // Shape + text carry meaning, not color alone (color-blind safe).
    if (ball === "W")
      return "bg-red-600 text-white border-red-700 font-bold rounded-md outline outline-1 outline-offset-1 outline-red-800";
    if (ball === "4")
      return "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border-emerald-600 font-bold rounded-full";
    if (ball === "6")
      return "bg-purple-500/20 text-purple-700 dark:text-purple-300 border-purple-600 font-bold rounded-full";
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
        "max-sm:flex max-sm:flex-1 max-sm:flex-col",
        sunlightMode && "sunlight-mode border-2 border-black",
      )}
    >
      <CardContent className="space-y-2 p-2.5 max-sm:flex max-sm:flex-1 max-sm:flex-col sm:space-y-3.5 sm:p-5">
        {/* Screen-reader live summary of over state */}
        <p aria-live="polite" className="sr-only">
          {undoNotice
            ? `${undoNotice.pending ? "Removing" : "Removed"} ${
                undoNotice.position ? `ball ${undoNotice.position}` : "the last ball"
              }${undoNotice.label ? `, ${getBallLabel(undoNotice.label)}` : ""}. ${
                undoNotice.note ? `${undoNotice.note}. ` : ""
              }${undoNotice.canRedo && !undoNotice.pending ? "Restore ball is available. " : ""}`
            : ""}
          Over {currentOver}.{currentBall}
          {lastBalls.length > 0
            ? `, this over: ${lastBalls.map(getBallLabel).join(", ")}`
            : ", no balls yet this over"}
          {selectedExtra ? `, ${selectedExtra.replace("_", " ")} pending` : ""}
        </p>

        {/* Over position + this-over ball trail (tap a ball to edit it) */}
        <div className="flex items-center gap-2">
          <span className="tabular-nums shrink-0 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 font-score text-sm font-bold leading-none text-emerald-800 dark:text-emerald-300 sm:text-base">
            Over {currentOver}.{currentBall}
          </span>
          {lastBalls.length > 0 ? (
            <>
              <div
                className="no-scrollbar flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto py-0.5"
                role="group"
                aria-label="Balls this over"
              >
                {lastBalls.map((ball, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => onSelectBall?.(idx)}
                    className={cn(
                      "flex h-8 w-8 shrink-0 items-center justify-center border text-2xs transition-colors hover:brightness-95 active:scale-95 sm:h-9 sm:w-9 sm:text-xs",
                      getBallDisplay(ball),
                    )}
                    title={`Ball ${idx + 1}: ${getBallLabel(ball)} (tap to edit)`}
                    aria-label={`Ball ${idx + 1}: ${getBallLabel(ball)}`}
                  >
                    {ball}
                  </button>
                ))}
              </div>
                <span className="tabular-nums shrink-0 rounded-full bg-muted/80 px-2 py-0.5 text-2xs font-bold text-foreground">
                  {overSummary.runs}r
                  {overSummary.wickets > 0 ? ` · ${overSummary.wickets}w` : ""}
                </span>
            </>
          ) : (
            <span className="truncate text-2xs font-medium text-muted-foreground/80 sm:text-xs">
              New over · awaiting first ball
            </span>
          )}
        </div>

        {/* What the last undo took back, in words, with a way to put it back */}
        {undoNotice && (
          <div
            data-testid="undo-notice"
            className={cn(
              "flex items-center justify-between gap-2 rounded-xl border px-3 py-1.5",
              sunlightMode
                ? "border-2 border-black bg-white text-black"
                : "border-border bg-muted/60 text-foreground",
            )}
          >
            <div className="flex min-w-0 items-center gap-2">
              <RotateCcw
                className="h-3.5 w-3.5 shrink-0 text-muted-foreground"
                aria-hidden="true"
              />
              <p
                className="min-w-0 text-xs leading-snug"
                title={[
                  undoNotice.position,
                  undoNotice.players,
                  undoNotice.note,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              >
                <span className="font-semibold">
                  {undoNotice.heading
                    ? `${undoNotice.heading} ${undoNotice.pending ? "being removed" : "removed"}: ${undoNotice.label}`
                    : `${undoNotice.pending ? "Removing ball" : "Ball removed"}${undoNotice.label ? `: ${getBallLabel(undoNotice.label)}` : ""}`}
                </span>
                {(undoNotice.position || undoNotice.players) && (
                  <span className="text-muted-foreground">
                    {" · "}
                    {[undoNotice.position, undoNotice.players]
                      .filter(Boolean)
                      .join(", ")}
                  </span>
                )}
                {undoNotice.note && (
                  <span className="block text-2xs text-muted-foreground">
                    {undoNotice.note}
                  </span>
                )}
              </p>
            </div>
            {undoNotice.canRedo && !undoNotice.pending && onRedo && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onRedo}
                disabled={disabled}
                className="h-8 shrink-0 px-2.5 text-xs font-semibold"
              >
                Restore ball
              </Button>
            )}
          </div>
        )}

        {/* Free Hit Delivery Banner (MCC Law 21.19) */}
        {isFreeHit && (
          <div
            className={cn(
              "flex items-center gap-2 rounded-xl border px-3 py-2",
              sunlightMode
                ? "border-2 border-black bg-amber-400 font-bold text-black"
                : "border-amber-500/50 bg-amber-500/15 text-amber-900 dark:border-amber-400/50 dark:bg-amber-950/60 dark:text-amber-200",
            )}
          >
            <span className="text-xs font-semibold">
              Free hit: batter can only be run out (MCC Law 21.19)
            </span>
          </div>
        )}

        {/* Extra pending banner */}
        {selectedExtra && (
          <div
            className={cn(
              "flex items-center justify-between gap-2 rounded-xl border px-3 py-2",
              sunlightMode
                ? "border-2 border-black bg-amber-300 font-bold text-black"
                : "border-amber-500/40 bg-amber-500/10 dark:border-amber-500/50 dark:bg-amber-950/40",
            )}
          >
            <div className="flex min-w-0 items-center gap-2">
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
                    ? "font-bold text-black"
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
                "h-7 shrink-0 rounded-lg px-2 text-xs font-bold",
                sunlightMode
                  ? "text-black hover:bg-black/10"
                  : "text-amber-900 hover:bg-amber-500/20 dark:text-amber-200",
              )}
              onClick={() => setSelectedExtra(null)}
            >
              Cancel
            </Button>
          </div>
        )}

        {/* Run keypad: 4 columns on phones (two rows that grow to fill the screen), one row from sm up */}
        <div
          className="grid grid-cols-4 gap-1.5 max-sm:flex-1 max-sm:auto-rows-fr sm:grid-cols-8 sm:gap-2.5"
          role="group"
          aria-label="Runs scored"
        >
          {RUN_BUTTONS.map((runs) => {
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
                  "score-display tabular-nums flex min-h-14 select-none flex-col items-center justify-center overflow-hidden rounded-xl border-2 px-1 text-2xl font-bold leading-none transition-colors active:opacity-80 disabled:opacity-50 sm:h-16 sm:rounded-2xl sm:text-3xl",
                  // An armed extra changes what every run button records.
                  selectedExtra && "ring-2 ring-amber-500/70 ring-offset-1 ring-offset-background",
                  sunlightMode
                    ? cn(
                        "border-2 font-bold shadow-none",
                        (isDot ||
                          runs === 1 ||
                          runs === 2 ||
                          runs === 3 ||
                          isFive) &&
                          "border-black bg-white text-black hover:bg-neutral-100",
                        isFour &&
                          "border-black bg-emerald-600 text-white hover:bg-emerald-700",
                        isSix &&
                          "border-black bg-purple-700 text-white hover:bg-purple-800",
                      )
                    : cn(
                        isDot &&
                          "border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground",
                        runs === 1 &&
                          "border-border bg-background text-foreground hover:bg-muted",
                        runs === 2 &&
                          "border-border bg-background text-foreground hover:bg-muted",
                        runs === 3 &&
                          "border-border bg-background text-foreground hover:bg-muted",
                        isFive &&
                          "border-border bg-background text-foreground hover:bg-muted",
                        isFour &&
                          "border-emerald-600/60 bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/20 dark:bg-emerald-950/60 dark:text-emerald-300 dark:hover:bg-emerald-900/60",
                        isSix &&
                          "border-purple-600/60 bg-purple-500/10 text-purple-700 hover:bg-purple-500/20 dark:bg-purple-950/60 dark:text-purple-300 dark:hover:bg-purple-900/60",
                      ),
                )}
                onClick={() => handleRunClick(runs)}
              >
                <span className="leading-none">{runs}</span>
                {subLabel && (
                  <span
                    className={cn(
                      "mt-1 font-sans text-[9px] font-semibold leading-none sm:text-2xs",
                      sunlightMode
                        ? isFour || isSix
                          ? "text-white"
                          : "text-black"
                        : runs === 4
                          ? "text-emerald-600 dark:text-emerald-400"
                          : runs === 6
                            ? "text-purple-600 dark:text-purple-400"
                            : selectedExtra
                              ? "text-amber-700 dark:text-amber-300"
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
              "score-display tabular-nums flex min-h-14 select-none flex-col items-center justify-center overflow-hidden rounded-xl border-2 px-1 leading-none transition-colors active:opacity-80 disabled:opacity-50 sm:h-16 sm:rounded-2xl",
              sunlightMode
                ? showMoreRuns
                  ? "border-2 border-black bg-black text-white shadow-none"
                  : "border-2 border-black bg-white text-black shadow-none hover:bg-neutral-100"
                : showMoreRuns
                  ? "border-primary bg-primary/15 text-primary"
                  : "border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            <span className="text-base font-semibold leading-none sm:text-lg">
              More
            </span>
            <span className="mt-1 font-sans text-[9px] font-bold leading-none text-muted-foreground sm:text-[10px]">
              7–13+
            </span>
          </button>
        </div>

        {/* High runs / extras expandable drawer (7 to 13+) */}
        {showMoreRuns && (
          <div className="space-y-2.5 rounded-2xl border border-border/80 bg-muted/40 p-3 dark:border-border/80 dark:bg-card/90">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-foreground">
                High runs / extras (7 to 13+)
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
                  className="h-9 min-w-[42px] rounded-xl text-xs font-bold"
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

        {/* Extras: single row of toggles */}
        <div
          className="grid grid-cols-4 gap-1.5 sm:gap-2"
          role="group"
          aria-label="Extras"
        >
          {EXTRA_TYPES.map(({ type, label, activeClass }) => (
            <button
              key={type}
              type="button"
              onClick={() => handleExtraClick(type)}
              disabled={disabled}
              aria-pressed={selectedExtra === type}
              aria-label={label}
              className={cn(
                "h-11 rounded-lg text-xs font-semibold transition-colors disabled:opacity-50 sm:rounded-xl",
                sunlightMode
                  ? selectedExtra === type
                    ? "border-2 border-black bg-black font-bold text-white shadow-none"
                    : "border-2 border-black bg-white font-bold text-black shadow-none hover:bg-neutral-100"
                  : selectedExtra === type
                    ? `${activeClass} border-transparent font-bold`
                    : "border border-border bg-background text-foreground hover:bg-muted",
              )}
            >
              <span aria-hidden="true">{label}</span>
            </button>
          ))}
        </div>

        {/* Primary actions: Wicket + Undo, set apart from the extras above so
            a hurried tap does not land on Wide / No ball instead */}
        <div
          className={cn(
            "mt-1 grid gap-2 border-t border-border/70 pt-2.5 sm:gap-3 sm:pt-3",
            onUndo ? "grid-cols-2" : "grid-cols-1",
          )}
          role="group"
          aria-label="Ball actions"
        >
          <Button
            variant="destructive"
            size="lg"
            className={cn(
              "h-12 gap-1.5 rounded-xl text-sm font-semibold sm:gap-2 sm:rounded-2xl sm:text-sm",
              sunlightMode
                ? "border-2 border-black bg-red-600 font-bold text-white shadow-none hover:bg-red-700"
                : "",
            )}
            onClick={() => {
              hapticWicket();
              onWicket(selectedExtra);
              setSelectedExtra(null);
              setSelectedZone(null);
            }}
            disabled={disabled}
            aria-label="Wicket dismissal"
            title={
              isFreeHit
                ? "Wicket dismissal (W) — Run Out Only on Free Hit"
                : "Wicket dismissal (W)"
            }
          >
            <span aria-hidden="true">
              Wicket<span className="hidden sm:inline"> (W)</span>
              {isFreeHit && (
                <span className="ml-1 text-[10px] font-bold tracking-normal text-amber-200">
                  (Run Out)
                </span>
              )}
            </span>
          </Button>

          {onUndo && (
            <Button
              type="button"
              variant="outline"
              size="lg"
              onClick={() => {
                hapticUndo();
                // An armed extra (often a mis-tap) is taken back first.
                if (selectedExtra) {
                  setSelectedExtra(null);
                  return;
                }
                onUndo();
              }}
              disabled={selectedExtra ? false : (undoDisabled ?? disabled)}
              title={selectedExtra ? "Cancel the extra (Esc)" : "Undo last ball (U)"}
              aria-label={
                selectedExtra
                  ? `Cancel ${selectedExtra.replace("_", " ")}`
                  : "Undo last ball"
              }
              className={cn(
                "h-11 gap-1.5 rounded-xl border-2 px-2 text-sm font-semibold sm:h-12 sm:gap-2 sm:rounded-2xl sm:px-4 sm:text-sm",
                sunlightMode
                  ? "border-black bg-white text-black hover:bg-neutral-100"
                  : "border-border bg-background text-foreground hover:bg-muted",
              )}
            >
              <RotateCcw className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span aria-hidden="true">
                {selectedExtra ? (
                  `Cancel ${EXTRA_TYPES.find((x) => x.type === selectedExtra)?.label.toLowerCase() ?? "extra"}`
                ) : (
                  <>
                    Undo<span className="hidden sm:inline"> (U)</span>
                  </>
                )}
              </span>
            </Button>
          )}
        </div>

        <p className="hidden text-center text-2xs text-muted-foreground sm:block">
          Keys 0–6 score · . dot · W wicket · U undo · S swap · D/N/B/L extras ·
          ? help
        </p>

        {/* Wagon wheel shot-direction prompt */}
        <Dialog
          open={isWagonWheelModalOpen}
          onOpenChange={(open) => {
            // Closing via Esc/backdrop discards the pending delivery instead
            // of silently recording it — mis-taps must not corrupt the score.
            if (!open) handleCancelModal();
          }}
        >
          <DialogContent className="max-w-md rounded-3xl p-4 sm:p-6">
            <DialogHeader className="text-center sm:text-center">
              <div className="mx-auto flex items-center gap-2">
                <Compass className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                <DialogTitle className="text-lg font-semibold">
                  Select shot direction
                </DialogTitle>
              </div>
              <DialogDescription className="text-xs text-muted-foreground">
                Tap where the shot went. The delivery is recorded as soon as you
                tap.
              </DialogDescription>
            </DialogHeader>

            {/* Pending Delivery Badge */}
            {pendingScore && (
              <div className="flex items-center justify-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted px-3 py-1 font-score text-sm font-semibold tabular-nums text-foreground">
                  {pendingScore.extraType && (
                    <span className="capitalize text-amber-700 dark:text-amber-400">
                      {pendingScore.extraType.replace("_", " ")} +
                    </span>
                  )}
                  <span>
                    {pendingScore.rawRuns === 0 && !pendingScore.extraType
                      ? "Dot Ball (0)"
                      : `${pendingScore.rawRuns} ${pendingScore.rawRuns === 1 ? "Run" : "Runs"}`}
                  </span>
                  {pendingScore.rawRuns === 4 && (
                    <span className="font-semibold text-emerald-700 dark:text-emerald-400">
                      · Four
                    </span>
                  )}
                  {pendingScore.rawRuns === 6 && (
                    <span className="font-semibold text-purple-700 dark:text-purple-400">
                      · Six
                    </span>
                  )}
                </span>
              </div>
            )}

            <div className="py-1">
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

            <DialogFooter className="flex flex-col-reverse items-center justify-between gap-2 sm:flex-row">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleCancelModal}
                className="text-xs text-muted-foreground hover:text-destructive"
              >
                Discard delivery
              </Button>
              <Button
                type="button"
                variant="default"
                size="sm"
                onClick={handleSkipZone}
                className="w-full text-xs font-bold sm:w-auto"
              >
                Skip (score without zone)
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Keyboard shortcuts sheet */}
        <Dialog open={showShortcutsHelp} onOpenChange={setShowShortcutsHelp}>
          <DialogContent className="max-w-md rounded-3xl p-5 sm:p-6">
            <DialogHeader>
              <div className="flex items-center gap-2">
                <Keyboard className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
                <DialogTitle className="text-lg font-semibold">
                  Keyboard shortcuts
                </DialogTitle>
              </div>
              <DialogDescription className="text-xs text-muted-foreground">
                Score from the keyboard on desktop.
              </DialogDescription>
            </DialogHeader>

            <div className="grid grid-cols-2 gap-2 py-2 text-xs">
              {[
                ["0 – 6 / .", "Score (Dot)", "outline"],
                ["W", "Wicket", "destructive"],
                ["D", "Wide Ball", "outline"],
                ["N", "No Ball", "outline"],
                ["B", "Bye", "outline"],
                ["L", "Leg Bye", "outline"],
                ["S", "Swap Strike", "outline"],
                ["E", "Edit Last Ball", "outline"],
                ["U", "Undo Ball", "outline"],
                ["Esc", "Clear Extra", "outline"],
              ].map(([key, label, variant]) => (
                <div
                  key={key}
                  className="flex items-center justify-between rounded-xl bg-muted/60 p-2.5 font-mono"
                >
                  <span className="font-bold">{key}</span>
                  <Badge
                    variant={variant as "outline" | "destructive"}
                    className="font-sans text-2xs"
                  >
                    {label}
                  </Badge>
                </div>
              ))}
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="default"
                size="sm"
                onClick={() => setShowShortcutsHelp(false)}
                className="w-full text-xs font-bold"
              >
                Got it (press ? anytime)
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
