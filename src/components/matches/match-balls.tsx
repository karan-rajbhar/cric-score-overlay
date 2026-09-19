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
    return ball.runs_scored.toString();
  };

  const getBallClass = (ball: Ball) => {
    if (ball.is_wicket)
      return "bg-red-600 text-white font-black shadow-sm ring-1 ring-red-400";
    if (ball.runs_scored === 6)
      return "bg-purple-600 text-white font-black shadow-sm ring-1 ring-purple-400";
    if (ball.runs_scored === 4)
      return "bg-emerald-600 text-white font-black shadow-sm ring-1 ring-emerald-400";
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
          className="cursor-pointer rounded-full px-3 py-1 font-bold shadow-sm transition-all active:scale-95"
          onClick={() => setFilter("all")}
        >
          All Deliveries
        </Badge>
        <Badge
          variant={filter === "boundaries" ? "magenta" : "outline"}
          className="cursor-pointer rounded-full px-3 py-1 font-bold shadow-sm transition-all active:scale-95"
          onClick={() => setFilter("boundaries")}
        >
          Boundaries (4s &amp; 6s) 💥
        </Badge>
        <Badge
          variant={filter === "wickets" ? "destructive" : "outline"}
          className="cursor-pointer rounded-full px-3 py-1 font-bold shadow-sm transition-all active:scale-95"
          onClick={() => setFilter("wickets")}
        >
          Wickets ⚡
        </Badge>
      </div>

      <Tabs
        defaultValue={`innings-${sortedInnings[0]?.innings_number}`}
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
                  <Card>
                    <CardContent className="py-3">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">
                          {teamName(match, innings.team_id)}
                        </span>
                        <span className="text-lg font-bold">
                          {innings.total_runs}/{innings.total_wickets} (
                          {innings.total_overs} ov)
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
                      <Card key={overNum} className="content-visibility-auto">
                        <CardHeader className="py-3">
                          <div className="flex items-center justify-between">
                            <CardTitle className="flex items-center gap-2 text-base">
                              Over {overNum + 1}
                              {overBalls[0]?.bowler && (
                                <span className="text-sm font-normal text-muted-foreground">
                                  - {overBalls[0].bowler.full_name}
                                </span>
                              )}
                            </CardTitle>
                            <div className="flex items-center gap-2">
                              <Badge variant="secondary">{overRuns} runs</Badge>
                              {wicketsInOver > 0 && (
                                <Badge variant="destructive">
                                  {wicketsInOver} wicket
                                </Badge>
                              )}
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent className="pt-0">
                          <div className="flex flex-wrap gap-2">
                            {overBalls
                              .sort((a, b) => a.ball_number - b.ball_number)
                              .map((ball) => (
                                <div
                                  key={ball.id}
                                  className={cn(
                                    "flex h-10 w-10 items-center justify-center rounded-full text-sm font-semibold",
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
                          <div className="mt-3 space-y-1.5">
                            {overBalls
                              .sort((a, b) => a.ball_number - b.ball_number)
                              .map((ball) => (
                                <div
                                  key={ball.id}
                                  className="border-b border-border/30 py-1 text-sm last:border-0"
                                >
                                  <div className="flex flex-wrap items-center">
                                    <span className="font-mono text-xs font-medium">
                                      {overNum}.{ball.ball_number}
                                    </span>
                                    <span className="mx-2 text-muted-foreground">
                                      {ball.bowler?.full_name} to{" "}
                                      {ball.batsman?.full_name}
                                    </span>
                                    <span
                                      className={cn(
                                        "font-bold",
                                        ball.is_wicket &&
                                          "font-extrabold text-red-600 dark:text-red-400",
                                        ball.runs_scored === 6 &&
                                          "font-black text-purple-600 dark:text-purple-400",
                                        ball.runs_scored === 4 &&
                                          "font-black text-emerald-600 dark:text-emerald-400",
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
                                        className="ml-2 text-xs"
                                      >
                                        {formatExtraType(ball.extra_type)}
                                      </Badge>
                                    )}
                                  </div>
                                  {ball.commentary && (
                                    <p className="mt-0.5 pl-6 text-xs text-muted-foreground">
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
