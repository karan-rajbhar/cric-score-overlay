"use client";

import { useMemo, useState } from "react";
import { Card, CardContent } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { TrendingUp, TrendingDown, Pencil } from "lucide-react";
import {
  oversFromBalls,
  ballsFromOvers,
  runRate,
  requiredRunRate,
  strikeRate,
  economyRate,
  inningsBalls,
} from "~/lib/cricket";
import type { Match, Innings } from "~/lib/match-types";
import type { DeliveryToEdit } from "~/app/matches/[id]/score/components/EditBallDialog";
import { bowlerQuota } from "~/app/matches/[id]/score/components/player-rows";
import { isSuperOverInnings } from "~/lib/firebase/scoring/result";
import { limitsOfInnings } from "~/app/matches/[id]/score/innings-notice";
import { cn } from "~/lib/utils";
import { useMediaQuery } from "~/lib/hooks/useMediaQuery";

export interface BatsmanDisplay {
  id: string;
  name: string;
  runs: number;
  balls: number;
  fours: number;
  sixes: number;
  isStriker: boolean;
  /** Order they came in: the rows stay in it, whoever is on strike. */
  position?: number | null;
}

export interface BowlerDisplay {
  id: string;
  name: string;
  overs: number;
  maidens: number;
  runs: number;
  wickets: number;
}

export interface LiveMatchHUDProps {
  match: Match;
  currentInnings: Innings | null | undefined;
  striker: BatsmanDisplay | null;
  nonStriker: BatsmanDisplay | null;
  bowler: BowlerDisplay | null;
  lastBalls: string[];
  rawDeliveries?: DeliveryToEdit[];
  battingTeamName?: string;
  onEndInnings?: () => void;
  isProcessing?: boolean;
  onSwapStriker?: () => void;
  onChangeStriker?: () => void;
  onChangeNonStriker?: () => void;
  onChangeBowler?: () => void;
  sunlightMode?: boolean;
}

/**
 * Live scoreboard for the scoring console: match situation, the two
 * batters at the crease and the current bowler. Kept compact so the
 * keypad below stays within reach on a phone.
 */
export function LiveMatchHUD({
  match,
  currentInnings,
  striker,
  nonStriker,
  bowler,
  lastBalls,
  rawDeliveries = [],
  battingTeamName,
  onEndInnings,
  isProcessing = false,
  onSwapStriker,
  onChangeStriker,
  onChangeNonStriker,
  onChangeBowler,
  sunlightMode = false,
}: LiveMatchHUDProps) {
  const inningsNumber = match.current_innings ?? 1;
  // Super overs (innings 3 on) are one over and two wickets a side.
  const superOver = isSuperOverInnings(inningsNumber);
  /** A chase: the match's 2nd innings, or a super over's. */
  const isSecondInnings = inningsNumber % 2 === 0;
  // The engine's limits for this innings (one over for a super over).
  const limits = limitsOfInnings(match, inningsNumber);
  const oversLimit = limits.maxBalls / limits.ballsPerOver;
  const wicketsLimit = limits.wicketsCap;
  const firstInnings = useMemo(
    () => match.innings?.find((i) => i.innings_number === 1),
    [match.innings],
  );

  const targetRuns = useMemo(() => {
    if (currentInnings?.target_runs != null) return currentInnings.target_runs;
    if (inningsNumber === 2 && firstInnings?.total_runs != null) {
      return firstInnings.total_runs + 1;
    }
    return null;
  }, [currentInnings, inningsNumber, firstInnings]);

  const ballsBowled = useMemo(
    () => (currentInnings ? inningsBalls(currentInnings) : 0),
    [currentInnings],
  );

  const bpo = match.balls_per_over ?? 6;
  const totalInningsBalls = limits.maxBalls;
  const ballsRem = Math.max(0, totalInningsBalls - ballsBowled);

  const currentRuns = currentInnings?.total_runs ?? 0;
  const currentWickets = currentInnings?.total_wickets ?? 0;
  const wicketsInHand = Math.max(0, wicketsLimit - currentWickets);

  const runsNeeded = useMemo(() => {
    if (targetRuns == null || !isSecondInnings) return null;
    return Math.max(0, targetRuns - currentRuns);
  }, [targetRuns, isSecondInnings, currentRuns]);

  const crr = currentInnings ? runRate(currentRuns, ballsBowled, bpo) : "0.00";
  const rrr =
    runsNeeded == null ? null : requiredRunRate(runsNeeded, ballsRem, bpo);

  const projectedScore = useMemo(() => {
    if (isSecondInnings || ballsBowled === 0) return null;
    const crrNum = parseFloat(crr);
    if (isNaN(crrNum) || crrNum <= 0) return null;
    return Math.round(crrNum * oversLimit);
  }, [isSecondInnings, ballsBowled, crr, oversLimit]);

  const proj8 = isSecondInnings
    ? null
    : Math.round(currentRuns + (ballsRem / bpo) * 8);
  const proj10 = isSecondInnings
    ? null
    : Math.round(currentRuns + (ballsRem / bpo) * 10);

  const partnership = useMemo(() => {
    if (!currentInnings) return { runs: 0, balls: 0 };
    const fows = [...(currentInnings.fall_of_wickets ?? [])].sort(
      (a, b) => (a.wicket_number ?? 0) - (b.wicket_number ?? 0),
    );
    const lastFow = fows.length > 0 ? fows[fows.length - 1] : null;
    return {
      runs: Math.max(0, currentRuns - (lastFow?.runs_at_fall ?? 0)),
      balls: Math.max(
        0,
        ballsBowled -
          (lastFow ? ballsFromOvers(lastFow.overs_at_fall ?? 0, bpo) : 0),
      ),
    };
  }, [currentInnings, currentRuns, ballsBowled, bpo]);

  // The same quota the bowler picker shows (none under five overs).
  const maxBowlerOvers = superOver ? 1 : bowlerQuota(match.overs_per_innings);
  const bowlerBallsCount = bowler ? ballsFromOvers(bowler.overs, bpo) : 0;
  const bowlerMaxBalls = (maxBowlerOvers ?? 0) * bpo;
  const isBowlerSpellFinished =
    maxBowlerOvers !== null &&
    bowlerBallsCount >= bowlerMaxBalls &&
    bowlerBallsCount > 0;

  const thisOverRuns = useMemo(
    () =>
      rawDeliveries
        .filter(
          (d) =>
            d.over_number === undefined || d.over_number === match.current_over,
        )
        .reduce((sum, d) => sum + (d.runs_scored ?? 0) + (d.extras ?? 0), 0),
    [rawDeliveries, match.current_over],
  );

  const rateDiff = useMemo(() => {
    if (rrr == null) return null;
    const crrNum = parseFloat(crr);
    const rrrNum = parseFloat(rrr);
    if (isNaN(crrNum) || isNaN(rrrNum)) return null;
    return {
      ahead: crrNum >= rrrNum,
      diff: Math.abs(crrNum - rrrNum).toFixed(2),
    };
  }, [crr, rrr]);
  const isAheadOfRate = rateDiff?.ahead ?? false;

  // Ending an innings early can't be undone from the keypad, so it goes
  // through a confirmation dialog that can be cancelled.
  const [confirmEndOpen, setConfirmEndOpen] = useState(false);
  const confirmEndInnings = () => {
    setConfirmEndOpen(false);
    onEndInnings?.();
  };

  // Phones drop the card headers to save height and show the bowler's
  // control inline instead.
  const isPhone = useMediaQuery("(max-width: 639px)");
  // Rows in the order the two came in (batting position); the striker's
  // end is whichever row holds the striker.
  const batterRows = [
    { end: "striker" as const, batter: striker, onStrike: true },
    { end: "nonStriker" as const, batter: nonStriker, onStrike: false },
  ].sort((a, b) => {
    const pa = a.batter?.position ?? Number.MAX_SAFE_INTEGER;
    const pb = b.batter?.position ?? Number.MAX_SAFE_INTEGER;
    return pa - pb;
  });

  // Strike can be picked when both batters are in (and this screen scores).
  const canPickStrike = Boolean(onSwapStriker && striker && nonStriker);

  const bowlerAction = (
    <>
      {onChangeBowler && (
        <button
          type="button"
          onClick={onChangeBowler}
          aria-label="Change current bowler"
          title="Change bowler"
          className="shadow-2xs inline-flex h-11 min-w-11 items-center justify-center gap-1 rounded-lg border border-border/80 bg-background/80 px-1.5 text-2xs font-bold text-foreground hover:bg-muted sm:h-7 sm:min-w-0 sm:px-2"
        >
          <Pencil className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <span className="hidden sm:inline">Change</span>
        </button>
      )}
    </>
  );
  const dim = sunlightMode ? "text-black/70" : "text-white/70";
  const bright = sunlightMode ? "text-black" : "text-white";

  return (
    <div className="space-y-2 sm:space-y-3">
      {/* 1. Match situation */}
      {match.status === "live" && (
        <Card
          data-testid="match-equation-banner"
          className={cn(
            "overflow-hidden shadow-sm",
            sunlightMode
              ? "border-2 border-black bg-white text-black shadow-none"
              : isSecondInnings
                ? isAheadOfRate
                  ? "scoreboard border border-board-good/40 bg-board text-board-foreground"
                  : "scoreboard border border-board-warn/40 bg-board text-board-foreground"
                : "scoreboard border border-board-line bg-board text-board-foreground",
          )}
        >
          <CardContent className="space-y-1.5 p-2.5 sm:space-y-3 sm:p-4">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      "truncate text-xs font-semibold sm:text-sm",
                      sunlightMode
                        ? "text-black"
                        : "text-board-muted",
                    )}
                  >
                    {battingTeamName ??
                      (match.current_innings === 1
                        ? match.team1?.name
                        : match.team2?.name) ??
                      "Batting"}
                  </span>
                  <Badge
                    variant="outline"
                    className={cn(
                      "px-1.5 py-0 text-[0.625rem] font-medium sm:text-xs",
                      sunlightMode
                        ? "border-black text-black"
                        : "border-white/20 bg-white/5 text-white/80",
                    )}
                  >
                    {superOver
                      ? `Super over · ${isSecondInnings ? "2nd" : "1st"} innings`
                      : `Inns ${inningsNumber} · ${match.match_format || "Match"}`}
                  </Badge>
                </div>
                <div className="mt-0.5 flex items-baseline gap-2">
                  <span
                    className={cn(
                      "font-score text-3xl font-bold tabular-nums tracking-tight sm:text-5xl",
                      bright,
                    )}
                  >
                    {currentRuns}/{currentWickets}
                  </span>
                  <span
                    className={cn(
                      "text-sm font-bold tabular-nums sm:text-lg",
                      sunlightMode ? "text-black/70" : "text-white/60",
                    )}
                  >
                    ({oversFromBalls(ballsBowled, bpo)} ov)
                  </span>
                  <span className={cn("text-2xs font-semibold sm:hidden", dim)}>
                    of {oversFromBalls(totalInningsBalls, bpo)}
                  </span>
                </div>
              </div>

              {onEndInnings && (
                <div className="flex shrink-0 items-center gap-1.5">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setConfirmEndOpen(true)}
                    disabled={isProcessing}
                    className={cn(
                      "h-8 px-2.5 text-xs font-semibold",
                      sunlightMode
                        ? "border-2 border-black bg-white font-bold text-black hover:bg-neutral-100"
                        : "border-white/20 bg-white/10 text-white hover:bg-white/20 hover:text-white",
                    )}
                  >
                    End innings
                  </Button>
                  <Dialog
                    open={confirmEndOpen}
                    onOpenChange={setConfirmEndOpen}
                  >
                    <DialogContent className="sm:max-w-sm">
                      <DialogHeader>
                        <DialogTitle className="text-balance">
                          End this innings?
                        </DialogTitle>
                        <DialogDescription>
                          {battingTeamName ?? "Batting side"}{" "}
                          <span className="font-semibold tabular-nums text-foreground">
                            {currentRuns}/{currentWickets}
                          </span>{" "}
                          after{" "}
                          <span className="tabular-nums">
                            {oversFromBalls(ballsBowled, bpo)}
                          </span>{" "}
                          overs.{" "}
                          {isSecondInnings
                            ? "This ends the match: the result is worked out from the scores."
                            : `The next innings starts with a target of ${currentRuns + 1}.`}
                        </DialogDescription>
                      </DialogHeader>
                      <DialogFooter className="gap-2 sm:gap-0">
                        <Button
                          variant="outline"
                          autoFocus
                          onClick={() => setConfirmEndOpen(false)}
                        >
                          Keep scoring
                        </Button>
                        <Button
                          variant="destructive"
                          onClick={confirmEndInnings}
                          disabled={isProcessing}
                        >
                          End innings
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>
              )}
            </div>

            {/* Overs progress (larger screens) */}
            <div className="hidden items-center gap-2.5 sm:flex">
              <div
                className={cn(
                  "h-2 flex-1 overflow-hidden rounded-full",
                  sunlightMode ? "bg-black/15" : "bg-white/10",
                )}
              >
                <div
                  className={cn(
                    "h-full rounded-full transition-all duration-300",
                    sunlightMode
                      ? "bg-black"
                      : isSecondInnings
                        ? isAheadOfRate
                          ? "bg-board-good"
                          : "bg-board-warn"
                        : "bg-board-foreground/80",
                  )}
                  style={{
                    width: `${Math.min(100, totalInningsBalls > 0 ? (ballsBowled / totalInningsBalls) * 100 : 0)}%`,
                  }}
                />
              </div>
              <span
                className={cn("shrink-0 text-xs font-bold tabular-nums", dim)}
              >
                {oversFromBalls(ballsBowled, bpo)} /{" "}
                {oversFromBalls(totalInningsBalls, bpo)} ov
              </span>
            </div>

            {isSecondInnings && targetRuns != null ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex min-w-0 flex-1 items-center gap-2">
                    <div className="min-w-0">
                      <h3
                        data-testid="chase-equation-title"
                        className={cn(
                          "text-xs font-semibold sm:text-base",
                          sunlightMode
                            ? "text-black"
                            : isAheadOfRate
                              ? "text-board-good"
                              : "text-board-warn",
                        )}
                      >
                        {runsNeeded === 0 ? (
                          "Scores level · 1 run to win"
                        ) : runsNeeded && runsNeeded > 0 ? (
                          <>
                            Need{" "}
                            <span className="font-bold tabular-nums">
                              {runsNeeded}
                            </span>{" "}
                            runs from{" "}
                            <span className="font-bold tabular-nums">
                              {ballsRem}
                            </span>{" "}
                            balls
                          </>
                        ) : (
                          "Target achieved"
                        )}
                      </h3>
                      <p
                        className={cn(
                          "text-[0.625rem] font-medium sm:text-2xs",
                          dim,
                        )}
                      >
                        Target:{" "}
                        <strong
                          className={cn("font-bold tabular-nums", bright)}
                        >
                          {targetRuns}
                        </strong>{" "}
                        · {wicketsInHand}{" "}
                        <span className="hidden sm:inline">
                          wickets in hand
                        </span>
                        <span className="sm:hidden">
                          wkts · RRR {rrr ?? "—"} · CRR {crr}
                        </span>
                      </p>
                    </div>
                  </div>

                  {rateDiff && (
                    <Badge
                      variant="outline"
                      className={cn(
                        "shrink-0 gap-1 px-2 py-0.5 text-[0.625rem] font-bold tabular-nums sm:px-2.5 sm:py-1 sm:text-xs",
                        sunlightMode
                          ? "border-2 border-black font-bold text-black"
                          : isAheadOfRate
                            ? "border-board-good/40 bg-board-good/15 text-board-good"
                            : "border-board-warn/40 bg-board-warn/15 text-board-warn",
                      )}
                    >
                      {isAheadOfRate ? (
                        <TrendingUp className="h-3 w-3" />
                      ) : (
                        <TrendingDown className="h-3 w-3" />
                      )}
                      <span>
                        {isAheadOfRate ? "Ahead" : "Req"} +{rateDiff.diff} RPO
                      </span>
                    </Badge>
                  )}
                </div>

                {/* Chase metrics (larger screens) */}
                <div
                  className={cn(
                    "hidden grid-cols-4 gap-2 rounded-xl p-2 text-center text-xs sm:grid",
                    sunlightMode
                      ? "border border-black bg-neutral-100"
                      : "border border-white/10 bg-black/25",
                  )}
                >
                  {[
                    ["Target", String(targetRuns), bright],
                    [
                      "Req RR",
                      rrr ?? "—",
                      sunlightMode
                        ? "text-black"
                        : isAheadOfRate
                          ? "text-board-good"
                          : "text-board-warn",
                    ],
                    ["Curr RR", crr, bright],
                    ["Remain", `${ballsRem}b`, bright],
                  ].map(([label, value, color], i) => (
                    <div
                      key={label}
                      className={cn(
                        "px-1",
                        i < 3 &&
                          (sunlightMode
                            ? "border-r border-black/20"
                            : "border-r border-white/10"),
                      )}
                    >
                      <p
                        className={cn(
                          "text-[0.625rem] font-medium",
                          sunlightMode ? "text-muted-foreground" : "text-board-muted",
                        )}
                      >
                        {label}
                      </p>
                      <p
                        className={cn(
                          "font-score text-base font-bold tabular-nums",
                          color,
                        )}
                      >
                        {value}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex min-w-0 flex-1 items-center gap-2">
                    <div>
                      <h3
                        className={cn(
                          "text-xs font-semibold sm:text-base",
                          bright,
                        )}
                      >
                        {superOver ? "Super over" : "1st innings"} ·{" "}
                        <span
                          className={cn(
                            "font-bold tabular-nums",
                            sunlightMode ? "text-black" : "text-board-good",
                          )}
                        >
                          CRR: {crr}
                        </span>
                      </h3>
                      <p
                        className={cn(
                          "text-[0.625rem] font-medium sm:text-2xs",
                          dim,
                        )}
                      >
                        {ballsRem} balls remaining (
                        {oversFromBalls(ballsRem, bpo)} ov)
                      </p>
                    </div>
                  </div>

                  {projectedScore != null && (
                    <Badge
                      variant="outline"
                      className={cn(
                        "px-2.5 py-1 text-xs font-bold tabular-nums",
                        sunlightMode
                          ? "border-2 border-black font-bold text-black"
                          : "border-white/20 bg-white/5 text-white/80",
                      )}
                    >
                      Proj: {projectedScore}
                    </Badge>
                  )}
                </div>

                {ballsBowled > 6 && (
                  <div
                    className={cn(
                      "hidden flex-wrap items-center justify-between gap-2 rounded-xl px-3 py-1.5 text-xs sm:flex",
                      sunlightMode
                        ? "border border-black bg-neutral-100 text-black"
                        : "border border-white/10 bg-black/25 text-white/80",
                    )}
                  >
                    <span className="text-2xs font-semibold">
                      Projected score:
                    </span>
                    <div className="flex items-center gap-3">
                      <span>
                        At 8 RPO:{" "}
                        <strong className={cn("tabular-nums", bright)}>
                          {proj8}
                        </strong>
                      </span>
                      <span className="opacity-40">|</span>
                      <span>
                        At 10 RPO:{" "}
                        <strong className={cn("tabular-nums", bright)}>
                          {proj10}
                        </strong>
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* 2. Batters at the crease + current bowler */}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 sm:gap-3">
        <Card
          data-testid="hud-batters-card"
          className={cn(
            "rounded-xl border shadow-sm",
            sunlightMode
              ? "border-2 border-black bg-white"
              : "border-border bg-card",
          )}
        >
          <CardContent className="space-y-1.5 p-2 sm:space-y-2 sm:p-3.5">
            {/* Title row (phones rely on the inline controls instead) */}
            <div className="hidden items-center justify-between gap-2 border-b border-border/50 pb-1.5 sm:flex">
              <div className="flex min-w-0 items-center gap-1.5">
                <span className="text-sm font-semibold text-foreground">
                  Batting
                </span>
                <span className="truncate text-2xs font-semibold tabular-nums text-muted-foreground/90">
                  (Stand: {partnership.runs} off {partnership.balls}b)
                </span>
              </div>
            </div>

            {/* Who is on strike: one choice of two (a radio group). Tap a
                batter to put them on strike; the striker alone is marked
                (highlight, "*", "On strike"). The rows keep the order the
                two came in, so only the highlight moves. Change replaces
                that batter. */}
            <div
              role="radiogroup"
              aria-label="Batter on strike"
              className="space-y-1.5 sm:space-y-2"
              onKeyDown={(e) => {
                if (
                  canPickStrike &&
                  ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)
                ) {
                  e.preventDefault();
                  onSwapStriker?.();
                }
              }}
            >
              {batterRows.map(({ end, batter, onStrike }) => {
                const change = end === "striker" ? onChangeStriker : onChangeNonStriker;
                if (!batter) {
                  return (
                    <div
                      key={end}
                      className="flex items-center justify-between gap-2 rounded-xl border border-dashed border-border px-2.5 py-1.5 sm:px-3 sm:py-2"
                    >
                      <span className="text-xs text-muted-foreground sm:text-sm">
                        {end === "striker" ? "Select striker" : "Select non-striker"}
                      </span>
                      {change && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 px-2 text-xs"
                          onClick={change}
                        >
                          Assign
                        </Button>
                      )}
                    </div>
                  );
                }
                return (
                  <div key={end} className="flex items-stretch gap-1.5">
                    <button
                      type="button"
                      role="radio"
                      aria-checked={onStrike}
                      aria-label={`${batter.name}, ${batter.runs} off ${batter.balls}${onStrike ? ", on strike" : ""}`}
                      tabIndex={onStrike ? 0 : -1}
                      disabled={!canPickStrike && !onStrike}
                      onClick={() => {
                        if (!onStrike && canPickStrike) onSwapStriker?.();
                      }}
                      title={onStrike ? `${batter.name} is on strike` : `Tap to put ${batter.name} on strike`}
                      data-testid={onStrike ? "hud-batter-on-strike" : "hud-batter-off-strike"}
                      className={cn(
                        "flex min-h-11 min-w-0 flex-1 items-center justify-between gap-2 rounded-xl border px-2.5 py-1.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-default sm:px-3 sm:py-2",
                        onStrike
                          ? sunlightMode
                            ? "border-2 border-black bg-neutral-100 font-bold"
                            : "border-primary/40 bg-primary-soft"
                          : sunlightMode
                            ? "border-black/40 bg-white"
                            : "border-border/60 bg-muted/25 enabled:hover:bg-muted/50",
                      )}
                    >
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-1.5">
                          <span
                            className={cn(
                              "flex h-2 w-2 shrink-0 rounded-full",
                              onStrike ? "bg-primary" : "bg-muted-foreground/30",
                            )}
                            aria-hidden="true"
                          />
                          <span
                            className={cn(
                              "truncate text-xs sm:text-sm",
                              onStrike
                                ? "font-semibold text-foreground"
                                : "font-medium text-muted-foreground",
                            )}
                          >
                            {batter.name}
                            {onStrike ? " *" : ""}
                          </span>
                          {onStrike && (
                            <span className="inline-flex shrink-0 items-center rounded-full border border-primary/30 px-1.5 py-0.5 text-[0.625rem] font-medium text-primary-soft-foreground">
                              On strike
                            </span>
                          )}
                        </span>
                        <span className="hidden pl-3.5 text-2xs text-muted-foreground sm:block">
                          SR:{" "}
                          <strong className="font-semibold tabular-nums text-foreground">
                            {strikeRate(batter.runs, batter.balls)}
                          </strong>{" "}
                          · {batter.fours}x4, {batter.sixes}x6
                        </span>
                      </span>
                      <span
                        className={cn(
                          "shrink-0 whitespace-nowrap font-score text-sm font-bold tabular-nums sm:text-base",
                          onStrike ? "text-foreground" : "text-muted-foreground",
                        )}
                      >
                        {batter.runs}{" "}
                        <span className="text-2xs font-semibold text-muted-foreground sm:text-xs">
                          ({batter.balls})
                        </span>
                      </span>
                    </button>
                    {change && (
                      <button
                        type="button"
                        onClick={change}
                        title={`Change ${batter.name}`}
                        aria-label={`Change ${batter.name}`}
                        className="shadow-2xs inline-flex min-w-11 shrink-0 items-center justify-center gap-1 rounded-xl border border-border/80 bg-background/80 px-2 text-2xs font-bold text-foreground hover:bg-muted"
                      >
                        <Pencil className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
                        <span className="hidden sm:inline">Change</span>
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Card
          data-testid="hud-bowler-card"
          className={cn(
            "rounded-xl border shadow-sm",
            sunlightMode
              ? "border-2 border-black bg-white"
              : "border-border bg-card",
          )}
        >
          <CardContent className="space-y-1.5 p-2 sm:space-y-2 sm:p-3.5">
            <div className="hidden items-center justify-between gap-2 border-b border-border/50 pb-1.5 sm:flex">
              <div className="flex min-w-0 items-center gap-1.5">
                <span className="text-sm font-semibold text-foreground">
                  Bowler
                </span>
                <span className="truncate text-2xs font-semibold tabular-nums text-muted-foreground/90">
                  (this over: {thisOverRuns} runs)
                </span>
              </div>
              {!isPhone && bowlerAction}
            </div>

            <div
              className={cn(
                "rounded-xl border px-2.5 py-1.5 sm:px-3 sm:py-2",
                sunlightMode
                  ? "border-2 border-black bg-neutral-100 font-bold"
                  : "border-border bg-muted/40",
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-xs font-semibold text-foreground sm:text-sm">
                  {bowler ? bowler.name : "No bowler yet"}
                </span>
                <div className="flex shrink-0 items-center gap-1.5">
                  <span className="whitespace-nowrap font-score text-sm font-bold tabular-nums text-foreground sm:text-base">
                    {bowler ? `${bowler.wickets}/${bowler.runs}` : "—"}
                  </span>
                  {isPhone && bowlerAction}
                </div>
              </div>
              {bowler ? (
                <>
                  <div className="mt-1 flex items-center justify-between text-[0.625rem] text-muted-foreground sm:text-xs">
                    <span>
                      Overs:{" "}
                      <strong className="font-bold tabular-nums text-foreground">
                        {oversFromBalls(bowlerBallsCount, bpo)}
                      </strong>{" "}
                      {maxBowlerOvers !== null && <> / {maxBowlerOvers}</>}
                    </span>
                    <span>
                      Econ:{" "}
                      <strong className="font-bold tabular-nums text-foreground">
                        {economyRate(bowler.runs, bowlerBallsCount, bpo)}
                      </strong>
                    </span>
                    <span className="hidden sm:inline">
                      Mdns:{" "}
                      <strong className="font-bold tabular-nums text-foreground">
                        {bowler.maidens}
                      </strong>
                    </span>
                  </div>
                  {maxBowlerOvers !== null && (
                    <div className="mt-1.5 hidden h-1.5 w-full overflow-hidden rounded-full bg-muted sm:block">
                      <div
                        className={cn(
                          "h-full rounded-full transition-all duration-300",
                          isBowlerSpellFinished
                            ? "bg-warning"
                            : "bg-foreground/40",
                        )}
                        style={{
                          width: `${Math.min(100, (bowlerBallsCount / bowlerMaxBalls) * 100)}%`,
                        }}
                      />
                    </div>
                  )}
                </>
              ) : (
                <p className="text-[0.625rem] text-muted-foreground sm:text-xs">
                  No bowler selected for this over
                </p>
              )}
              {isBowlerSpellFinished && (
                <p className="mt-1 text-[0.625rem] font-bold text-warning">
                  Quota bowled ({maxBowlerOvers} ov)
                </p>
              )}
            </div>
            {lastBalls.length === 0 && (
              <p className="hidden text-[0.625rem] text-muted-foreground sm:block sm:text-2xs">
                Awaiting first ball of over
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
