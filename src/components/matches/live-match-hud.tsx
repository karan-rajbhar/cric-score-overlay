"use client";

import { useMemo } from "react";
import { Card, CardContent } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
  Zap,
  Target,
  Flame,
  ArrowLeftRight,
  TrendingUp,
  TrendingDown,
  Sparkles,
  Pencil,
} from "lucide-react";
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
import { cn } from "~/lib/utils";

export interface BatsmanDisplay {
  id: string;
  name: string;
  runs: number;
  balls: number;
  fours: number;
  sixes: number;
  isStriker: boolean;
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
  onSelectBall?: (index: number) => void;
  onRetireStriker?: () => void;
  onRetireNonStriker?: () => void;
  onReviseTarget?: () => void;
  sunlightMode?: boolean;
}

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
  onSelectBall,
  onRetireStriker,
  onRetireNonStriker,
  onReviseTarget,
  sunlightMode = false,
}: LiveMatchHUDProps) {
  // Innings calculations
  const isSecondInnings = match.current_innings === 2;
  const firstInnings = useMemo(
    () => match.innings?.find((i) => i.innings_number === 1),
    [match.innings],
  );

  const targetRuns = useMemo(() => {
    if (currentInnings?.target_runs != null) return currentInnings.target_runs;
    if (isSecondInnings && firstInnings?.total_runs != null) {
      return firstInnings.total_runs + 1;
    }
    return null;
  }, [currentInnings, isSecondInnings, firstInnings]);

  const ballsBowled = useMemo(
    () => (currentInnings ? inningsBalls(currentInnings) : 0),
    [currentInnings],
  );

  const bpo = match.balls_per_over ?? 6;

  const totalInningsBalls = useMemo(
    () => (match.overs_per_innings ?? 20) * bpo,
    [match.overs_per_innings, bpo],
  );

  const ballsRem = useMemo(
    () => Math.max(0, totalInningsBalls - ballsBowled),
    [totalInningsBalls, ballsBowled],
  );

  const currentRuns = currentInnings?.total_runs ?? 0;
  const currentWickets = currentInnings?.total_wickets ?? 0;
  const wicketsInHand = Math.max(0, 10 - currentWickets);

  const runsNeeded = useMemo(() => {
    if (targetRuns == null || !isSecondInnings) return null;
    return Math.max(0, targetRuns - currentRuns);
  }, [targetRuns, isSecondInnings, currentRuns]);

  const crr = useMemo(
    () => (currentInnings ? runRate(currentRuns, ballsBowled, bpo) : "0.00"),
    [currentInnings, currentRuns, ballsBowled, bpo],
  );

  const rrr = useMemo(() => {
    if (runsNeeded == null) return null;
    return requiredRunRate(runsNeeded, ballsRem, bpo);
  }, [runsNeeded, ballsRem, bpo]);

  // Projected score in 1st innings
  const projectedScore = useMemo(() => {
    if (isSecondInnings || ballsBowled === 0) return null;
    const crrNum = parseFloat(crr);
    if (isNaN(crrNum) || crrNum <= 0) return null;
    return Math.round(crrNum * (match.overs_per_innings ?? 20));
  }, [isSecondInnings, ballsBowled, crr, match.overs_per_innings]);

  // Projected at 8 & 10 RPO in 1st innings
  const proj8 = useMemo(() => {
    if (isSecondInnings) return null;
    return Math.round(currentRuns + (ballsRem / bpo) * 8);
  }, [isSecondInnings, currentRuns, ballsRem, bpo]);

  const proj10 = useMemo(() => {
    if (isSecondInnings) return null;
    return Math.round(currentRuns + (ballsRem / bpo) * 10);
  }, [isSecondInnings, currentRuns, ballsRem, bpo]);

  // Active partnership calculation
  const partnership = useMemo(() => {
    if (!currentInnings) return { runs: 0, balls: 0, runRate: "0.00" };
    const fows = currentInnings.fall_of_wickets ?? [];
    const lastFow = fows.length > 0 ? fows[fows.length - 1] : null;
    const pRuns = Math.max(0, currentRuns - (lastFow?.runs_at_fall ?? 0));
    const pBalls = Math.max(
      0,
      ballsBowled - (lastFow ? ballsFromOvers(lastFow.overs_at_fall ?? 0, bpo) : 0),
    );
    return {
      runs: pRuns,
      balls: pBalls,
      runRate: runRate(pRuns, pBalls, bpo),
    };
  }, [currentInnings, currentRuns, ballsBowled, bpo]);

  // Bowler max overs limit
  const maxBowlerOvers = useMemo(
    () => Math.max(1, Math.ceil((match.overs_per_innings ?? 20) / 5)),
    [match.overs_per_innings],
  );

  const bowlerBallsCount = useMemo(() => {
    if (!bowler) return 0;
    return ballsFromOvers(bowler.overs, bpo);
  }, [bowler, bpo]);

  const bowlerMaxBalls = maxBowlerOvers * bpo;
  const isBowlerSpellFinished = bowlerBallsCount >= bowlerMaxBalls && bowlerBallsCount > 0;

  // Runs in current over
  const thisOverRuns = useMemo(() => {
    return rawDeliveries.reduce(
      (sum, d) => sum + (d.runs_scored ?? 0) + (d.extras ?? 0),
      0,
    );
  }, [rawDeliveries]);

  // Rate comparison indicator (chasing)
  const isAheadOfRate = useMemo(() => {
    if (rrr == null) return false;
    const crrNum = parseFloat(crr);
    const rrrNum = parseFloat(rrr);
    return !isNaN(crrNum) && !isNaN(rrrNum) && crrNum >= rrrNum;
  }, [crr, rrr]);

  const rateDiff = useMemo(() => {
    if (rrr == null) return null;
    const crrNum = parseFloat(crr);
    const rrrNum = parseFloat(rrr);
    if (isNaN(crrNum) || isNaN(rrrNum)) return null;
    const diff = Math.abs(crrNum - rrrNum);
    return diff.toFixed(2);
  }, [crr, rrr]);

  return (
    <div className="space-y-2 sm:space-y-3">
      {/* 1. KEY MATCH SITUATION & EQUATION BANNER */}
      {match.status === "live" && (
        <Card
          data-testid="match-equation-banner"
          className={cn(
            "overflow-hidden border shadow-sm transition-all",
            sunlightMode
              ? "border-2 border-black bg-white text-black shadow-none"
              : isSecondInnings
                ? isAheadOfRate
                  ? "border-emerald-500/40 bg-gradient-to-r from-emerald-500/10 via-background to-emerald-500/5 dark:border-emerald-500/30"
                  : "border-amber-500/40 bg-gradient-to-r from-amber-500/10 via-background to-amber-500/5 dark:border-amber-500/30"
                : "border-sky-500/30 bg-gradient-to-r from-sky-500/10 via-background to-sky-500/5 dark:border-sky-500/30",
          )}
        >
          <CardContent className="p-2 sm:p-4">
            {/* Integrated Live Scoreboard Strip */}
            <div className="flex items-center justify-between border-b border-border/40 pb-1.5 mb-1.5 sm:pb-2 sm:mb-2">
              <div className="min-w-0">
                <span className="text-[10px] sm:text-[11px] font-bold text-muted-foreground block truncate uppercase tracking-wider">
                  {battingTeamName ?? (match.current_innings === 1 ? match.team1?.name : match.team2?.name) ?? "Batting"} · Inns {match.current_innings}
                </span>
                <div className="flex items-baseline gap-1.5 sm:gap-2">
                  <span className="score-display text-xl sm:text-3xl font-black tabular-nums tracking-tight text-foreground">
                    {currentRuns}/{currentWickets}
                  </span>
                  <span className="text-xs sm:text-sm font-extrabold text-muted-foreground">
                    ({oversFromBalls(ballsBowled, bpo)} ov)
                  </span>
                </div>
              </div>

              {onEndInnings && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onEndInnings}
                  disabled={isProcessing}
                  className={cn(
                    "h-7 px-2 text-[11px] sm:h-8 sm:px-2.5 sm:text-xs font-extrabold",
                    sunlightMode
                      ? "border-2 border-black bg-white font-black text-black hover:bg-neutral-100"
                      : "",
                  )}
                >
                  End Inns
                </Button>
              )}
            </div>

            {isSecondInnings && targetRuns != null ? (
              <div className="space-y-1.5 sm:space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-1.5 sm:gap-2">
                  <div className="flex items-center gap-1.5 sm:gap-2">
                    <span
                      className={cn(
                        "flex h-6 w-6 sm:h-7 sm:w-7 shrink-0 items-center justify-center rounded-full font-bold",
                        sunlightMode
                          ? "bg-black text-white"
                          : isAheadOfRate
                            ? "bg-emerald-500 text-white"
                            : "bg-amber-500 text-white",
                      )}
                    >
                      <Zap className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                    </span>
                    <div>
                      <h3
                        data-testid="chase-equation-title"
                        className={cn(
                          "text-xs font-black tracking-tight sm:text-base",
                          sunlightMode
                            ? "text-black"
                            : isAheadOfRate
                              ? "text-emerald-700 dark:text-emerald-300"
                              : "text-amber-700 dark:text-amber-300",
                        )}
                      >
                        {runsNeeded === 0 ? (
                          "Scores Level · 1 run to win!"
                        ) : runsNeeded && runsNeeded > 0 ? (
                          <>
                            Need <span className="tabular font-black">{runsNeeded}</span> runs from{" "}
                            <span className="tabular font-black">{ballsRem}</span> balls
                          </>
                        ) : (
                          "Target Achieved"
                        )}
                      </h3>
                      <p className="flex flex-wrap items-center gap-1.5 sm:gap-2 text-[10px] sm:text-[11px] font-medium text-muted-foreground">
                        <span>
                          Target: <span className="tabular font-bold text-foreground">{targetRuns}</span> · {wicketsInHand} wickets in hand
                        </span>
                        {onReviseTarget && (
                          <button
                            type="button"
                            onClick={onReviseTarget}
                            title="Revise target runs or match overs"
                            className="inline-flex items-center gap-1 rounded bg-muted/70 px-1 py-0.2 sm:px-1.5 sm:py-0.5 text-[9px] sm:text-[10px] font-bold text-foreground hover:bg-muted"
                          >
                            <Pencil className="h-2 w-2 sm:h-2.5 sm:w-2.5" />
                            Revise Target
                          </button>
                        )}
                      </p>
                    </div>
                  </div>

                  {/* Rate status badge */}
                  {rrr != null && (
                    <Badge
                      variant="outline"
                      className={cn(
                        "tabular shrink-0 gap-1 px-2 py-0.5 sm:px-2.5 sm:py-1 text-[10px] sm:text-xs font-bold",
                        sunlightMode
                          ? "border-2 border-black font-black text-black"
                          : isAheadOfRate
                            ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                            : "border-amber-500/40 bg-amber-500/15 text-amber-700 dark:text-amber-300",
                      )}
                    >
                      {isAheadOfRate ? (
                        <>
                          <TrendingUp className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
                          <span>Ahead +{rateDiff} RPO</span>
                        </>
                      ) : (
                        <>
                          <TrendingDown className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
                          <span>Req +{rateDiff} RPO</span>
                        </>
                      )}
                    </Badge>
                  )}
                </div>

                {/* Key Chase Metrics Grid */}
                <div className="grid grid-cols-4 gap-1 sm:gap-1.5 rounded-lg sm:rounded-xl border border-border/70 bg-background/80 p-1 sm:p-2 text-center text-[10px] sm:text-xs dark:bg-card/70">
                  <div className="border-r border-border/60 px-0.5 sm:px-1">
                    <p className="text-[9px] sm:text-[10px] uppercase tracking-wider text-muted-foreground">Target</p>
                    <p className="tabular font-score text-xs sm:text-sm font-black">{targetRuns}</p>
                  </div>
                  <div className="border-r border-border/60 px-0.5 sm:px-1">
                    <p className="text-[9px] sm:text-[10px] uppercase tracking-wider text-muted-foreground">Req RR</p>
                    <p
                      className={cn(
                        "tabular font-score text-xs sm:text-sm font-black",
                        sunlightMode
                          ? "text-black"
                          : isAheadOfRate
                            ? "text-emerald-600 dark:text-emerald-400"
                            : "text-amber-600 dark:text-amber-400",
                      )}
                    >
                      {rrr ?? "—"}
                    </p>
                  </div>
                  <div className="border-r border-border/60 px-0.5 sm:px-1">
                    <p className="text-[9px] sm:text-[10px] uppercase tracking-wider text-muted-foreground">Curr RR</p>
                    <p className="tabular font-score text-xs sm:text-sm font-black">{crr}</p>
                  </div>
                  <div className="px-0.5 sm:px-1">
                    <p className="text-[9px] sm:text-[10px] uppercase tracking-wider text-muted-foreground">Remain</p>
                    <p className="tabular font-score text-xs sm:text-sm font-black">{ballsRem}b</p>
                  </div>
                </div>
              </div>
            ) : (
              /* 1ST INNINGS SITUATION */
              <div className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-sky-500 text-white">
                      <Target className="h-4 w-4" />
                    </span>
                    <div>
                      <h3 className="text-sm font-black tracking-tight text-foreground sm:text-base">
                        1st Innings · <span className="tabular text-sky-600 dark:text-sky-400">CRR: {crr}</span>
                      </h3>
                      <p className="text-[11px] font-medium text-muted-foreground">
                        {ballsRem} balls remaining ({oversFromBalls(ballsRem, bpo)} ov)
                      </p>
                    </div>
                  </div>

                  {projectedScore != null && (
                    <Badge
                      variant="outline"
                      className="tabular border-sky-500/40 bg-sky-500/15 px-2.5 py-1 text-xs font-bold text-sky-700 dark:text-sky-300"
                    >
                      <Sparkles className="mr-1 h-3 w-3 text-sky-500" />
                      Proj: {projectedScore}
                    </Badge>
                  )}
                </div>

                {/* Projected scenarios */}
                {ballsBowled > 6 && (
                  <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border/70 bg-background/80 px-3 py-1.5 text-xs text-muted-foreground dark:bg-card/70">
                    <span className="text-[11px] font-semibold">Projected Score:</span>
                    <div className="flex items-center gap-3">
                      <span>
                        At 8 RPO: <strong className="tabular text-foreground">{proj8}</strong>
                      </span>
                      <span className="text-border">|</span>
                      <span>
                        At 10 RPO: <strong className="tabular text-foreground">{proj10}</strong>
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* 2. COMPACT ACTIVE BATSMEN & BOWLER HUD */}
      <div className="grid grid-cols-1 gap-1.5 sm:gap-2.5 sm:grid-cols-2">
        {/* ACTIVE BATTERS CARD */}
        <Card
          data-testid="hud-batters-card"
          className={cn(
            "rounded-xl sm:rounded-2xl border shadow-sm",
            sunlightMode ? "border-2 border-black bg-white" : "border-border/70 bg-card/90",
          )}
        >
          <CardContent className="space-y-1 p-2 sm:space-y-2 sm:p-3.5">
            <div className="flex items-center justify-between border-b border-border/50 pb-1 sm:pb-1.5">
              <div className="flex min-w-0 items-center gap-1.5">
                <Flame className="h-4 w-4 text-orange-500 shrink-0" />
                <span className="truncate text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Batting
                </span>
                <span className="tabular text-[10px] sm:text-[11px] text-muted-foreground/80 hidden sm:inline">
                  (Stand: {partnership.runs} off {partnership.balls}b)
                </span>
              </div>
              {onSwapStriker && striker && nonStriker && (
                <button
                  type="button"
                  onClick={onSwapStriker}
                  title="Swap striker (change who is on strike)"
                  aria-label="Swap active striker"
                  className="touch-target inline-flex items-center gap-1 rounded-lg border border-border bg-muted/60 px-2 py-0.5 text-xs font-bold text-muted-foreground hover:bg-muted hover:text-foreground active:scale-95 shrink-0"
                >
                  <ArrowLeftRight className="h-3.5 w-3.5 shrink-0" />
                  <span>Swap</span>
                </button>
              )}
            </div>

            {/* Striker Row */}
            <div
              className={cn(
                "flex items-center justify-between rounded-lg sm:rounded-xl px-2 py-1 sm:px-2.5 sm:py-1.5 transition-colors",
                sunlightMode
                  ? "bg-neutral-100 border border-black font-black"
                  : "bg-emerald-500/10 border border-emerald-500/25",
              )}
            >
              <div className="min-w-0 flex-1 pr-1.5">
                <div className="flex items-center gap-1.5">
                  <span className="flex h-2 w-2 shrink-0 rounded-full bg-emerald-500 animate-pulse" aria-hidden="true" />
                  <span className="truncate text-xs font-extrabold text-foreground">
                    {striker ? striker.name : "Select Striker"} *
                  </span>
                  {onChangeStriker && (
                    <button
                      type="button"
                      onClick={onChangeStriker}
                      aria-label="Change striker"
                      className="text-muted-foreground hover:text-foreground p-0.5 shrink-0"
                    >
                      <Pencil className="h-3 w-3 shrink-0" />
                    </button>
                  )}
                  {onRetireStriker && striker && (
                    <button
                      type="button"
                      onClick={onRetireStriker}
                      title="Retire batsman (hurt / out)"
                      className="ml-1 inline-flex items-center rounded border border-rose-500/30 bg-rose-500/10 px-1.5 py-0.5 text-[10px] font-bold text-rose-600 hover:bg-rose-500/20 dark:text-rose-400 shrink-0"
                    >
                      Retire
                    </button>
                  )}
                </div>
                {striker && (
                  <p className="pl-3.5 text-[10px] text-muted-foreground">
                    SR: {strikeRate(striker.runs, striker.balls)} · {striker.fours}x4, {striker.sixes}x6
                  </p>
                )}
              </div>
              <div className="shrink-0 text-right">
                {striker ? (
                  <p className="tabular font-score text-xs sm:text-sm font-black whitespace-nowrap">
                    {striker.runs}{" "}
                    <span className="text-[10px] sm:text-[11px] font-semibold text-muted-foreground">
                      ({striker.balls})
                    </span>
                  </p>
                ) : (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 text-[10px] sm:text-[11px] px-2"
                    onClick={onChangeStriker}
                  >
                    Assign
                  </Button>
                )}
              </div>
            </div>

            {/* Non-Striker Row */}
            <div className="flex items-center justify-between rounded-lg sm:rounded-xl border border-border/50 bg-muted/20 px-2 py-1 sm:px-2.5 sm:py-1.5">
              <div className="min-w-0 flex-1 pr-1.5">
                <div className="flex items-center gap-1.5">
                  <span className="flex h-2 w-2 shrink-0 rounded-full bg-muted-foreground/30" aria-hidden="true" />
                  <span className="truncate text-xs font-bold text-muted-foreground">
                    {nonStriker ? nonStriker.name : "Select Non-Striker"}
                  </span>
                  {onChangeNonStriker && (
                    <button
                      type="button"
                      onClick={onChangeNonStriker}
                      aria-label="Change non-striker"
                      className="text-muted-foreground hover:text-foreground p-0.5 shrink-0"
                    >
                      <Pencil className="h-3 w-3 shrink-0" />
                    </button>
                  )}
                  {onRetireNonStriker && nonStriker && (
                    <button
                      type="button"
                      onClick={onRetireNonStriker}
                      title="Retire batsman (hurt / out)"
                      className="ml-1 inline-flex items-center rounded border border-rose-500/30 bg-rose-500/10 px-1.5 py-0.5 text-[10px] font-bold text-rose-600 hover:bg-rose-500/20 dark:text-rose-400 shrink-0"
                    >
                      Retire
                    </button>
                  )}
                </div>
                {nonStriker && (
                  <p className="pl-3.5 text-[10px] text-muted-foreground">
                    SR: {strikeRate(nonStriker.runs, nonStriker.balls)} · {nonStriker.fours}x4, {nonStriker.sixes}x6
                  </p>
                )}
              </div>
              <div className="shrink-0 text-right">
                {nonStriker ? (
                  <p className="tabular font-score text-xs sm:text-sm font-bold text-muted-foreground whitespace-nowrap">
                    {nonStriker.runs}{" "}
                    <span className="text-[10px] sm:text-[11px] font-medium text-muted-foreground/70">
                      ({nonStriker.balls})
                    </span>
                  </p>
                ) : (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 text-[10px] sm:text-[11px] px-2"
                    onClick={onChangeNonStriker}
                  >
                    Assign
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ACTIVE BOWLER CARD */}
        <Card
          data-testid="hud-bowler-card"
          className={cn(
            "rounded-xl sm:rounded-2xl border shadow-sm",
            sunlightMode ? "border-2 border-black bg-white" : "border-border/70 bg-card/90",
          )}
        >
          <CardContent className="space-y-1 p-2 sm:space-y-2 sm:p-3.5">
            <div className="flex items-center justify-between border-b border-border/50 pb-1 sm:pb-1.5">
              <div className="flex min-w-0 items-center gap-1.5">
                <Target className="h-4 w-4 text-sky-500 shrink-0" />
                <span className="truncate text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Bowler
                </span>
              </div>
              {onChangeBowler && (
                <button
                  type="button"
                  onClick={onChangeBowler}
                  aria-label="Change current bowler"
                  className="touch-target inline-flex items-center gap-1 rounded-lg border border-border bg-muted/60 px-2 py-0.5 text-xs font-bold text-muted-foreground hover:bg-muted hover:text-foreground active:scale-95 shrink-0"
                >
                  <Pencil className="h-3.5 w-3.5 shrink-0" />
                  <span>Change</span>
                </button>
              )}
            </div>

            <div className="rounded-lg sm:rounded-xl border border-sky-500/25 bg-sky-500/10 px-2 py-1 sm:px-2.5 sm:py-1.5">
              <div className="flex items-center justify-between">
                <span className="truncate text-xs sm:text-sm font-extrabold text-foreground">
                  {bowler ? bowler.name : "Select Bowler"}
                </span>
                <span className="tabular font-score text-xs sm:text-sm font-black whitespace-nowrap">
                  {bowler ? `${bowler.wickets}/${bowler.runs}` : "—"}
                </span>
              </div>

              {bowler ? (
                <div className="mt-1 flex items-center justify-between text-[10px] sm:text-xs text-muted-foreground">
                  <span>
                    Overs: <strong className="tabular text-foreground">{oversFromBalls(bowlerBallsCount, bpo)}</strong> / {maxBowlerOvers}
                  </span>
                  <span>
                    Econ: <strong className="tabular text-foreground">{economyRate(bowler.runs, bowlerBallsCount, bpo)}</strong>
                  </span>
                  <span>
                    Mdns: <strong className="tabular text-foreground">{bowler.maidens}</strong>
                  </span>
                </div>
              ) : (
                <p className="text-[10px] sm:text-xs text-muted-foreground">No bowler selected for this over</p>
              )}

              {isBowlerSpellFinished && (
                <p className="mt-0.5 text-[10px] font-bold text-amber-600 dark:text-amber-400">
                  ⚠ Max quota reached ({maxBowlerOvers} ov)
                </p>
              )}
            </div>

            {/* This over breakdown badge row — hidden on mobile to eliminate redundancy with ScoringPanel */}
            <div className="hidden sm:flex items-center justify-between pt-0.5 text-[11px]">
              <span className="text-muted-foreground">
                This Over: <strong className="tabular text-foreground">{thisOverRuns} runs</strong>
              </span>
              <div className="flex flex-wrap items-center gap-1">
                {lastBalls.length > 0 ? (
                  lastBalls.map((b, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => onSelectBall?.(idx)}
                      className={cn(
                        "tabular inline-flex h-5 min-w-[20px] items-center justify-center rounded px-1 text-[10px] font-black leading-none",
                        b === "W"
                          ? "bg-red-600 text-white"
                          : b === "4" || b === "6"
                            ? "bg-emerald-600 text-white"
                            : "bg-muted text-foreground",
                      )}
                      title={`Ball ${idx + 1}: ${b}`}
                    >
                      {b}
                    </button>
                  ))
                ) : (
                  <span className="text-[10px] text-muted-foreground">Over in progress</span>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
