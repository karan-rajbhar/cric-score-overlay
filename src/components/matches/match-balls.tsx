"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { Badge } from "~/components/ui/badge";
import { cn } from "~/lib/utils";
import { Loader2 } from "lucide-react";
import { useMatchBallLogQuery } from "~/lib/hooks/useMatchQueries";
import type { BallEvent, Match } from "~/lib/match-types";
import { teamName, formatDismissalType, formatExtraType } from "~/lib/cricket";

type Ball = BallEvent;

interface MatchBallsProps {
  match: Match;
}

export function MatchBalls({ match }: MatchBallsProps) {
  const [filter, setFilter] = useState<"all" | "boundaries" | "wickets">("all");
  const { data, error } = useMatchBallLogQuery(match.id);
  const ballLog = (data ?? null) as Ball[] | null;
  const logError = error
    ? error instanceof Error
      ? error.message
      : String(error)
    : null;

  const getBallDisplay = (ball: Ball) => {
    if (ball.is_wicket) return "W";
    if (ball.extra_type === "wide") return `${ball.extras}wd`;
    if (ball.extra_type === "no_ball") return `${ball.runs_scored}nb`;
    if (ball.extra_type === "bye") return `${ball.extras}b`;
    if (ball.extra_type === "leg_bye") return `${ball.extras}lb`;
    if (ball.extra_type === "penalty") return `${ball.extras}P`;
    if (ball.extra_type === "bonus") return `${ball.extras}B`;
    return ball.runs_scored.toString();
  };

  const getBallClass = (ball: Ball) => {
    if (ball.is_wicket)
      return "bg-red-600 text-white font-bold";
    if (ball.runs_scored === 6)
      return "bg-purple-600 text-white font-bold";
    if (ball.runs_scored === 4)
      return "bg-emerald-600 text-white font-bold";
    if (ball.extra_type)
      return "bg-amber-400/25 text-amber-800 dark:text-amber-200 border border-amber-500/40 font-bold";
    if (ball.runs_scored > 0)
      return "border border-amber-500/30 bg-amber-500/10 text-amber-900 dark:text-amber-200 font-bold";
    return "border border-border/80 bg-muted/60 text-muted-foreground font-medium";
  };

  const groupBallsByOver = (balls: Ball[]) => {
    const overs: { [key: number]: Ball[] } = {};
    balls.forEach((ball) => {
      if (!overs[ball.over_number]) {
        overs[ball.over_number] = [];
      }
      overs[ball.over_number]!.push(ball);
    });
    return overs;
  };

  const filterBalls = (balls: Ball[]) => {
    switch (filter) {
      case "boundaries":
        return balls.filter((b) => b.runs_scored >= 4 && !b.extra_type);
      case "wickets":
        return balls.filter((b) => b.is_wicket);
      default:
        return balls;
    }
  };

  const getOverRuns = (balls: Ball[]) => {
    return balls.reduce(
      (sum, ball) => sum + ball.runs_scored + (ball.extras || 0),
      0,
    );
  };

  const sortedInnings = [...(match.innings || [])].sort(
    (a, b) => a.innings_number - b.innings_number,
  );

  if (ballLog === null) {
    return (
      <Card>
        <CardContent className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (sortedInnings.length === 0 || logError) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          {logError ?? "No ball-by-ball data available yet"}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filter Buttons */}
      <div className="mb-4 flex flex-wrap gap-2">
        <Badge
          variant={filter === "all" ? "default" : "outline"}
          className="cursor-pointer rounded-full px-3 py-1 font-medium transition-colors"
          onClick={() => setFilter("all")}
        >
          All deliveries
        </Badge>
        <Badge
          variant={filter === "boundaries" ? "magenta" : "outline"}
          className="inline-flex items-center gap-1.5 cursor-pointer rounded-full px-3 py-1 font-medium transition-colors"
          onClick={() => setFilter("boundaries")}
        >
          Boundaries (4s &amp; 6s)
        </Badge>
        <Badge
          variant={filter === "wickets" ? "destructive" : "outline"}
          className="inline-flex items-center gap-1.5 cursor-pointer rounded-full px-3 py-1 font-medium transition-colors"
          onClick={() => setFilter("wickets")}
        >
          Wickets
        </Badge>
      </div>

      <Tabs
        defaultValue={
          sortedInnings.some((inn) => inn.innings_number === match.current_innings)
            ? `innings-${match.current_innings}`
            : `innings-${sortedInnings[sortedInnings.length - 1]?.innings_number ?? 1}`
        }
        className="w-full"
      >
        <TabsList className="mb-4 grid h-auto w-full max-w-xs grid-cols-2 gap-1 p-1">
          {sortedInnings.map((innings) => (
            <TabsTrigger
              key={innings.id}
              value={`innings-${innings.innings_number}`}
              className="justify-center px-2 py-1.5 text-xs font-semibold sm:px-4 sm:text-sm"
            >
              {innings.innings_number === 1 ? "1st" : "2nd"} Innings
            </TabsTrigger>
          ))}
        </TabsList>

        {sortedInnings.map((innings) => {
          const balls = ballLog.filter((b) => b.innings_id === innings.id);
          const filteredBalls = filterBalls(balls);
          const overGroups = groupBallsByOver(filteredBalls);
          const overNumbers = Object.keys(overGroups)
            .map(Number)
            .sort((a, b) => b - a); // Most recent first

          return (
            <TabsContent
              key={innings.id}
              value={`innings-${innings.innings_number}`}
            >
              {balls.length === 0 ? (
                <Card>
                  <CardContent className="py-12 text-center text-muted-foreground">
                    No ball-by-ball data for this innings
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-4">
                  {/* Innings Header */}
                  <Card className="overflow-hidden border-border bg-card">
                    <CardContent className="py-3 px-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-muted text-xs font-semibold text-foreground">
                            {teamName(match, innings.team_id).slice(0, 2)}
                          </div>
                          <span className="font-semibold text-foreground text-sm sm:text-base">
                            {teamName(match, innings.team_id)}
                          </span>
                        </div>
                        <span className="text-base sm:text-lg font-bold tabular-nums font-score text-foreground">
                          {innings.total_runs}/{innings.total_wickets}{" "}
                          <span className="text-xs font-normal text-muted-foreground font-sans">
                            ({innings.total_overs} ov)
                          </span>
                        </span>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Overs */}
                  {overNumbers.map((overNum) => {
                    const overBalls = overGroups[overNum] || [];
                    const overRuns = getOverRuns(overBalls);
                    const wicketsInOver = overBalls.filter(
                      (b) => b.is_wicket,
                    ).length;

                    return (
                      <Card key={overNum} className="content-visibility-auto overflow-hidden border-border bg-card">
                        <CardHeader className="border-b border-border/50 py-3 px-4">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <CardTitle className="flex items-center gap-2 text-sm sm:text-base font-bold">
                              <span>Over {overNum + 1}</span>
                              {overBalls[0]?.bowler && (
                                <span className="rounded-md bg-muted/60 px-2 py-0.5 text-xs font-medium text-muted-foreground">
                                  {overBalls[0].bowler.full_name}
                                </span>
                              )}
                            </CardTitle>
                            <div className="flex items-center gap-2">
                              <Badge variant="secondary" className="tabular-nums font-semibold text-xs">
                                {overRuns} {overRuns === 1 ? "run" : "runs"}
                              </Badge>
                              {wicketsInOver > 0 && (
                                <Badge variant="destructive" className="tabular-nums font-bold text-xs">
                                  {wicketsInOver} {wicketsInOver === 1 ? "wicket" : "wickets"}
                                </Badge>
                              )}
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent className="p-4">
                          <div className="flex flex-wrap gap-2">
                            {overBalls
                              .sort((a, b) => a.ball_number - b.ball_number)
                              .map((ball) => (
                                <div
                                  key={ball.id}
                                  className={cn(
                                    "flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-full text-xs sm:text-sm font-bold tabular-nums shrink-0",
                                    getBallClass(ball),
                                  )}
                                  title={`${ball.batsman?.full_name} vs ${ball.bowler?.full_name}${
                                    ball.commentary
                                      ? `: ${ball.commentary}`
                                      : ""
                                  }`}
                                >
                                  {getBallDisplay(ball)}
                                </div>
                              ))}
                          </div>

                          {/* Ball Commentary */}
                          <div className="mt-3.5 space-y-1.5 border-t border-border/50 pt-3">
                            {overBalls
                              .sort((a, b) => a.ball_number - b.ball_number)
                              .map((ball) => (
                                <div
                                  key={ball.id}
                                  className="rounded-lg p-2 text-xs sm:text-sm transition-colors hover:bg-muted/30"
                                >
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span className="font-mono text-xs font-bold text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                                      {overNum}.{ball.ball_number}
                                    </span>
                                    <span className="text-muted-foreground text-xs sm:text-sm">
                                      {ball.bowler?.full_name} to{" "}
                                      <strong className="text-foreground font-semibold">
                                        {ball.batsman?.full_name}
                                      </strong>
                                    </span>
                                    <span
                                      className={cn(
                                        "font-bold text-xs sm:text-sm",
                                        ball.is_wicket &&
                                          "font-bold text-red-600 dark:text-red-400",
                                        ball.runs_scored === 6 &&
                                          "font-bold text-purple-600 dark:text-purple-400",
                                        ball.runs_scored === 4 &&
                                          "font-bold text-emerald-600 dark:text-emerald-400",
                                      )}
                                    >
                                      {ball.is_wicket
                                        ? `Wicket! (${formatDismissalType(ball.dismissal_type)})`
                                        : `${ball.runs_scored + (ball.extras || 0)} run${
                                            ball.runs_scored +
                                              (ball.extras || 0) !==
                                            1
                                              ? "s"
                                              : ""
                                          }`}
                                    </span>
                                    {ball.extra_type && (
                                      <Badge
                                        variant="outline"
                                        className="text-[10px] px-1.5 py-0 uppercase"
                                      >
                                        {formatExtraType(ball.extra_type)}
                                      </Badge>
                                    )}
                                  </div>
                                  {ball.commentary && (
                                    <p className="mt-1 pl-6 text-xs text-muted-foreground italic">
                                      {ball.commentary}
                                    </p>
                                  )}
                                </div>
                              ))}
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </TabsContent>
          );
        })}
      </Tabs>
    </div>
  );
}
