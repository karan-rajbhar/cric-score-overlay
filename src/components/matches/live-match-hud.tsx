"use client";

import { useMemo, useState, type ReactNode } from "react";
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
  matchFormatName,
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
  /** The End innings confirm, when the page also opens it (Match tools). */
  endInningsOpen?: boolean;
  onEndInningsOpenChange?: (open: boolean) => void;
  isProcessing?: boolean;
  onSwapStriker?: () => void;
  onChangeStriker?: () => void;
  onChangeNonStriker?: () => void;
  onChangeBowler?: () => void;
  sunlightMode?: boolean;
  /**
   * Phones name the batting side (and a super over) on the line under the
   * score, for a screen whose top bar no longer says it. No line of its
   * own: the scoring column must fit a 360 by 640 phone.
   */
  sideOnPhones?: boolean;
  /**
   * The score card alone, without the crease and bowler cards: between
   * innings, when nobody is in yet (the break card says what comes next).
   */
  scoreOnly?: boolean;
  /** Save status and the like, at the top right of the card. */
  status?: ReactNode;
}

/**
 * The current stand of the innings for the pair at the crease (either
 * order), from the engine's partnerships; 0 off 0 when that pair has no
 * stand yet.
 */
export function currentStandOf(
  innings: Pick<Innings, "partnerships"> | null | undefined,
  strikerId: string | null | undefined,
  nonStrikerId: string | null | undefined,
): { runs: number; balls: number } {
  const stand = [...(innings?.partnerships ?? [])]
    .reverse()
    .find((p) => p.is_current);
  const pair = new Set([strikerId, nonStrikerId]);
  if (
    !stand ||
    !strikerId ||
    !nonStrikerId ||
    !pair.has(stand.batsman1_id) ||
    !pair.has(stand.batsman2_id)
  ) {
    return { runs: 0, balls: 0 };
  }
  return { runs: stand.runs ?? 0, balls: stand.balls ?? 0 };
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
  endInningsOpen,
  onEndInningsOpenChange,
  isProcessing = false,
  onSwapStriker,
  onChangeStriker,
  onChangeNonStriker,
  onChangeBowler,
  sunlightMode = false,
  sideOnPhones = false,
  scoreOnly = false,
  status,
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
  const endInningsDue = ballsRem <= bpo || wicketsInHand <= 1;

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

  // The stand at the crease, as the engine keeps it (the innings' current
  // partnership, worked out from the ball log): a retirement starts a new
  // stand too, and its balls are the balls the pair faced. A pair yet to
  // face a ball together has 0 off 0.
  const partnership = useMemo(
    () => currentStandOf(currentInnings, striker?.id, nonStriker?.id),
    [currentInnings, striker?.id, nonStriker?.id],
  );

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

  // Ahead or behind the rate needed: only once the chase has a rate (before
  // its first ball, a run rate of 0 read as behind).
  const rateDiff = useMemo(() => {
    if (rrr == null || ballsBowled === 0) return null;
    const crrNum = parseFloat(crr);
    const rrrNum = parseFloat(rrr);
    if (isNaN(crrNum) || isNaN(rrrNum)) return null;
    return {
      ahead: crrNum >= rrrNum,
      diff: Math.abs(crrNum - rrrNum).toFixed(2),
    };
  }, [crr, rrr, ballsBowled]);
  const isAheadOfRate = rateDiff?.ahead ?? false;

  // Ending an innings early can't be undone from the keypad, so it goes
  // through a confirmation dialog that can be cancelled.
  const [ownEndOpen, setOwnEndOpen] = useState(false);
  const confirmEndOpen = endInningsOpen ?? ownEndOpen;
  const setConfirmEndOpen = onEndInningsOpenChange ?? setOwnEndOpen;
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
          className="shadow-2xs inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center gap-1 rounded-xl border border-border/80 bg-background/80 px-1.5 text-xs font-bold text-foreground hover:bg-muted sm:h-7 sm:min-h-0 sm:min-w-0 sm:rounded-lg sm:px-2"
        >
          <Pencil className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <span className="hidden sm:inline">Change</span>
        </button>
      )}
    </>
  );
  // Quiet text on the board (its own token, not a white at some opacity).
  const muted = sunlightMode ? "text-black/70" : "text-board-muted";
  const inningsLabel = superOver
    ? `Super over · ${isSecondInnings ? "2nd" : "1st"} innings`
    : `${inningsNumber === 1 ? "1st" : "2nd"} innings · ${matchFormatName(match)}`;
  // "of 5 ov", "of 12.3 ov" (a revised quota): no ".0".
  const oversQuota = oversFromBalls(totalInningsBalls, bpo).replace(/\.0$/, "");
  const aheadText = rateDiff
    ? `${rateDiff.diff} an over ${rateDiff.ahead ? "ahead" : "behind"}`
    : "";
  // Phones (sideOnPhones): the batting side's short name on the line under
  // the score, and "Super over" in one.
  const battingSide =
    currentInnings?.team_id && currentInnings.team_id === match.team2_id
      ? match.team2
      : currentInnings?.team_id && currentInnings.team_id === match.team1_id
        ? match.team1
        : null;
  const sideShort =
    battingSide?.short_name || battingSide?.name || battingTeamName || null;
  const phoneSide = sideOnPhones
    ? [superOver ? "Super over" : null, sideShort].filter(Boolean).join(" · ") ||
      null
    : null;
  const bright = sunlightMode ? "text-black" : "text-board-foreground";

  return (
    <div className="space-y-1 sm:space-y-3">
      {/* 1. Match situation */}
      {match.status === "live" && (
        <Card
          data-testid="match-equation-banner"
          className={cn(
            "overflow-hidden shadow-sm",
            sunlightMode
              ? "border-2 border-black bg-white text-black shadow-none"
              : isSecondInnings && rateDiff
                ? isAheadOfRate
                  ? "scoreboard border border-board-good/40 bg-board text-board-foreground"
                  : "scoreboard border border-board-warn/40 bg-board text-board-foreground"
                : "scoreboard border border-board-line bg-board text-board-foreground",
          )}
        >
          <CardContent className="space-y-1 p-2 sm:space-y-2.5 sm:p-4">
            {/* One wording on every size, each figure once, the board's own
                colours (docs/scoring-screen-ux.md, the score card). */}
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                {/* Phones: the score starts the card; who bats is on the
                    line under it (sideOnPhones) or in the screen's header. */}
                <div className="flex min-w-0 items-center gap-2 max-sm:hidden">
                  <span className={cn("truncate text-sm font-semibold", muted)}>
                    {battingTeamName ??
                      (match.current_innings === 1
                        ? match.team1?.name
                        : match.team2?.name) ??
                      "Batting"}
                  </span>
                  <Badge
                    variant="outline"
                    size="sm"
                    className={cn(
                      "sm:h-6 sm:px-2.5 sm:text-xs",
                      sunlightMode
                        ? "border-black text-black"
                        : "border-board-line bg-transparent text-board-muted",
                    )}
                  >
                    {inningsLabel}
                  </Badge>
                </div>
                <p className="flex items-baseline gap-2 sm:mt-0.5">
                  <span
                    className={cn(
                      "font-score text-3xl font-bold leading-none tabular-nums tracking-tight sm:text-5xl",
                      bright,
                    )}
                  >
                    {currentRuns}/{currentWickets}
                  </span>
                  <span
                    className={cn(
                      "font-score text-sm font-semibold tabular-nums sm:text-lg",
                      muted,
                    )}
                  >
                    {oversFromBalls(ballsBowled, bpo)} of {oversQuota} ov
                  </span>
                </p>
              </div>

              {(status != null || onEndInnings) && (
                <div className="flex shrink-0 flex-col items-end gap-1.5">
                  {status != null && (
                    <div className="flex items-center gap-1.5">{status}</div>
                  )}
                  {/* Beside the score only near the innings' end (last
                      over, one wicket left); Match tools has it always
                      (S13). */}
                  {onEndInnings && endInningsDue && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setConfirmEndOpen(true)}
                    disabled={isProcessing}
                    className={cn(
                      "h-8 px-2.5 text-xs font-semibold",
                      sunlightMode
                        ? "border-2 border-black bg-white font-bold text-black hover:bg-neutral-100"
                        : "border-board-line bg-transparent text-board-foreground hover:bg-board-line hover:text-board-foreground",
                    )}
                  >
                    End innings
                  </Button>
                  )}
                  {onEndInnings && (
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
                  )}
                </div>
              )}
            </div>

            {/* Larger screens: the overs as a bar, and the balls left. */}
            <div className="hidden items-center gap-2.5 sm:flex">
              <div
                className={cn(
                  "h-2 flex-1 overflow-hidden rounded-full",
                  sunlightMode ? "bg-black/15" : "bg-board-line",
                )}
              >
                <div
                  className={cn(
                    "h-full rounded-full transition-all duration-300",
                    sunlightMode
                      ? "bg-black"
                      : isSecondInnings && rateDiff
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
                className={cn("shrink-0 text-xs font-semibold tabular-nums", muted)}
              >
                {ballsRem} {ballsRem === 1 ? "ball" : "balls"} left
              </span>
            </div>

            {isSecondInnings && targetRuns != null ? (
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  {/* h2: the screen's h1 is above, nothing between (S12). */}
                  <h2
                    data-testid="chase-equation-title"
                    className={cn(
                      "text-xs font-semibold sm:text-base",
                      sunlightMode
                        ? "text-black"
                        : !rateDiff
                          ? "text-board-foreground"
                          : isAheadOfRate
                            ? "text-board-good"
                            : "text-board-warn",
                    )}
                  >
                    {runsNeeded === 0 ? (
                      "Scores level · 1 run to win"
                    ) : runsNeeded && runsNeeded > 0 ? (
                      <>
                        {phoneSide ? (
                          <>
                            <span className="sm:hidden">{phoneSide} need</span>
                            <span className="max-sm:hidden">Need</span>
                          </>
                        ) : (
                          "Need"
                        )}{" "}
                        <span className="font-bold tabular-nums">{runsNeeded}</span>{" "}
                        {runsNeeded === 1 ? "run" : "runs"} from{" "}
                        <span className="font-bold tabular-nums">{ballsRem}</span>{" "}
                        {ballsRem === 1 ? "ball" : "balls"}
                      </>
                    ) : (
                      "Target reached"
                    )}
                    {/* Phones show ahead or behind by colour: say it too. */}
                    {rateDiff && (
                      <span className="sr-only sm:hidden">
                        {" "}
                        ({aheadText})
                      </span>
                    )}
                  </h2>
                  {/* Phones shorter than 700 px keep the headline only: the
                      keypad must fit 360 by 640, and the target and wickets
                      left follow from the score (the Scorecard has them). */}
                  <p
                    className={cn(
                      "text-xs font-medium tabular-nums sm:text-sm max-sm:[@media(max-height:700px)]:hidden",
                      muted,
                    )}
                  >
                    Target <strong className={cn("font-bold", bright)}>{targetRuns}</strong>{" "}
                    · {wicketsInHand} {wicketsInHand === 1 ? "wicket" : "wickets"} left
                    {rrr != null && runsNeeded != null && runsNeeded > 0 && (
                      <>
                        {" "}
                        · needs <strong className={cn("font-bold", bright)}>{rrr}</strong> an over
                      </>
                    )}
                    <span className="max-sm:hidden">
                      {" "}
                      · run rate {crr}
                    </span>
                  </p>
                </div>

                {rateDiff && (
                  <Badge
                    variant="outline"
                    size="sm"
                    className={cn(
                      "font-score tabular-nums max-sm:hidden sm:h-6 sm:px-2.5 sm:text-xs",
                      sunlightMode
                        ? "border-2 border-black font-bold text-black"
                        : isAheadOfRate
                          ? "border-board-good/40 bg-board-good/15 text-board-good"
                          : "border-board-warn/40 bg-board-warn/15 text-board-warn",
                    )}
                  >
                    {isAheadOfRate ? (
                      <TrendingUp className="h-3 w-3" aria-hidden="true" />
                    ) : (
                      <TrendingDown className="h-3 w-3" aria-hidden="true" />
                    )}
                    <span>{aheadText}</span>
                  </Badge>
                )}
              </div>
            ) : (
              <p
                className={cn(
                  "text-xs font-semibold tabular-nums sm:text-sm",
                  muted,
                )}
              >
                {phoneSide && <span className="sm:hidden">{phoneSide} · </span>}
                Run rate{" "}
                <span className={sunlightMode ? "text-black" : "text-board-good"}>
                  {crr}
                </span>
                {projectedScore != null && (
                  <>
                    {" "}
                    · Projected {projectedScore}
                    {ballsBowled > bpo && (
                      <span className="max-sm:hidden">
                        {" "}
                        ({proj8} at 8 an over, {proj10} at 10)
                      </span>
                    )}
                  </>
                )}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* 2. Batters at the crease + current bowler */}
      {!scoreOnly && (
      <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2 sm:gap-3">
        <Card
          data-testid="hud-batters-card"
          className={cn(
            "rounded-xl border shadow-sm",
            sunlightMode
              ? "border-2 border-black bg-white"
              : "border-border bg-card",
          )}
        >
          <CardContent className="space-y-1.5 p-1.5 sm:space-y-2 sm:p-3.5">
            {/* Title row (phones rely on the inline controls instead) */}
            <div className="hidden items-center justify-between gap-2 border-b border-border/50 pb-1.5 sm:flex">
              <div className="flex min-w-0 items-center gap-1.5">
                <span className="text-sm font-semibold text-foreground">
                  Batting
                </span>
                <span className="truncate text-xs font-semibold tabular-nums text-muted-foreground/90">
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
                          // 32 px in the row, 44 px to tap (into the row's
                          // own padding).
                          className="relative h-8 px-2 text-xs before:absolute before:-inset-y-1.5 before:inset-x-0 before:content-['']"
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
                              "truncate text-sm",
                              onStrike
                                ? "font-semibold text-foreground"
                                : "font-medium text-muted-foreground",
                            )}
                          >
                            {batter.name}
                            {onStrike ? " *" : ""}
                          </span>
                          {onStrike && (
                            <span className="inline-flex shrink-0 items-center rounded-full border border-primary/30 px-1.5 py-0.5 text-xs font-medium leading-none text-primary-soft-foreground">
                              On strike
                            </span>
                          )}
                        </span>
                        <span className="hidden pl-3.5 text-xs text-muted-foreground sm:block">
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
                        <span className="text-xs font-semibold text-muted-foreground">
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
                        className="shadow-2xs inline-flex min-w-11 shrink-0 items-center justify-center gap-1 rounded-xl border border-border/80 bg-background/80 px-2 text-xs font-bold text-foreground hover:bg-muted"
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
          <CardContent className="space-y-1.5 p-1.5 sm:space-y-2 sm:p-3.5">
            <div className="hidden items-center justify-between gap-2 border-b border-border/50 pb-1.5 sm:flex">
              <div className="flex min-w-0 items-center gap-1.5">
                <span className="text-sm font-semibold text-foreground">
                  Bowler
                </span>
                <span className="truncate text-xs font-semibold tabular-nums text-muted-foreground/90">
                  (this over: {thisOverRuns} runs)
                </span>
              </div>
              {!isPhone && bowlerAction}
            </div>

            {/* Phones: one row (name and figures over overs and economy)
                beside its Change button, the same height as a batter. */}
            <div className="flex items-stretch gap-1.5">
              <div
                className={cn(
                  "min-w-0 flex-1 rounded-xl border px-2.5 py-1 sm:px-3 sm:py-2",
                  sunlightMode
                    ? "border-2 border-black bg-neutral-100 font-bold"
                    : "border-border bg-muted/40",
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm font-semibold text-foreground">
                    {bowler ? bowler.name : "No bowler yet"}
                  </span>
                  <span className="shrink-0 whitespace-nowrap font-score text-sm font-bold tabular-nums text-foreground sm:text-base">
                    {bowler ? `${bowler.wickets}/${bowler.runs}` : "—"}
                  </span>
                </div>
                {bowler ? (
                  <>
                    <div className="flex items-center justify-between text-xs text-muted-foreground sm:mt-1">
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
                  <p className="text-xs text-muted-foreground">
                    No bowler selected for this over
                  </p>
                )}
                {isBowlerSpellFinished && (
                  <p className="text-xs font-bold text-warning sm:mt-1">
                    Quota bowled ({maxBowlerOvers} ov)
                  </p>
                )}
              </div>
              {isPhone && bowlerAction}
            </div>
            {lastBalls.length === 0 && (
              <p className="hidden text-[0.625rem] text-muted-foreground sm:block sm:text-xs">
                Awaiting first ball of over
              </p>
            )}
          </CardContent>
        </Card>
      </div>
      )}
    </div>
  );
}
