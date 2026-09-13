"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { cn } from "~/lib/utils";
import { Loader2 } from "lucide-react";
import { getMatchBallLog } from "~/app/matches/queries";
import type { BallEvent, Match } from "~/lib/match-types";
import { teamName } from "~/lib/cricket";
import { WagonWheel } from "./wagon-wheel";

type Ball = BallEvent;

interface MatchStatsProps {
  match: Match;
}

export function MatchStats({ match }: MatchStatsProps) {
  const [ballLog, setBallLog] = useState<Ball[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const result = await getMatchBallLog(match.id);
      if (!cancelled) setBallLog((result.data as Ball[]) ?? []);
    })();
    return () => {
      cancelled = true;
    };
  }, [match.id]);

  const ballsForInnings = (inningsId: string): Ball[] =>
    (ballLog ?? []).filter((b) => b.innings_id === inningsId);

  const getRunsPerOver = (balls: Ball[], maxOvers: number) => {
    const runsPerOver: number[] = Array(maxOvers).fill(0);
    balls.forEach((ball) => {
      if (ball.over_number < maxOvers) {
        const currentRuns = runsPerOver[ball.over_number] || 0;
        runsPerOver[ball.over_number] =
          currentRuns + ball.runs_scored + (ball.extras || 0);
      }
    });
    return runsPerOver;
  };

  const getCumulativeRuns = (balls: Ball[]) => {
    const cumulative: { over: number; runs: number }[] = [];
    let total = 0;
    const byOver: { [key: number]: number } = {};

    balls.forEach((ball) => {
      const runs = ball.runs_scored + (ball.extras || 0);
      if (byOver[ball.over_number] === undefined) byOver[ball.over_number] = 0;
      const currentTotal = byOver[ball.over_number] || 0;
      byOver[ball.over_number] = currentTotal + runs;
    });

    Object.keys(byOver)
      .map(Number)
      .sort((a, b) => a - b)
      .forEach((over) => {
        total += byOver[over] || 0;
        cumulative.push({ over: over + 1, runs: total });
      });

    return cumulative;
  };

  const sortedInnings = [...(match.innings || [])].sort(
    (a, b) => a.innings_number - b.innings_number,
  );

  const innings1 = sortedInnings[0];
  const innings2 = sortedInnings[1];

  const maxBarHeight = 60;
  const maxRuns =
    ballLog === null
      ? 1
      : Math.max(
          ...sortedInnings.flatMap((inn) =>
            getRunsPerOver(ballsForInnings(inn.id), match.overs_per_innings),
          ),
          1,
        );

  return (
    <Tabs defaultValue="run-comparison" className="w-full">
      <TabsList className="mb-4 w-full justify-start">
        <TabsTrigger value="run-comparison">Over Comparison</TabsTrigger>
        <TabsTrigger value="run-rate">Run Rate</TabsTrigger>
        <TabsTrigger value="scoring-zones">Scoring Zones</TabsTrigger>
      </TabsList>

      {/* Over Comparison */}
      <TabsContent value="run-comparison">
        <Card>
          <CardHeader>
            <CardTitle>Runs Per Over Comparison</CardTitle>
          </CardHeader>
          <CardContent>
            {ballLog === null ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : sortedInnings.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground">
                No data available yet
              </div>
            ) : (
              <div className="space-y-6">
                {/* Legend */}
                <div className="flex items-center justify-center gap-4">
                  {innings1 && (
                    <div className="flex items-center gap-2">
                      <div className="h-4 w-4 rounded bg-cricket-primary" />
                      <span className="text-sm">
                        {teamName(match, innings1.team_id)}
                      </span>
                    </div>
                  )}
                  {innings2 && (
                    <div className="flex items-center gap-2">
                      <div className="h-4 w-4 rounded bg-cricket-secondary" />
                      <span className="text-sm">
                        {teamName(match, innings2.team_id)}
                      </span>
                    </div>
                  )}
                </div>

                {/* Bar Chart */}
                <div className="flex h-[200px] items-end justify-center gap-1 px-4">
                  {Array.from({ length: match.overs_per_innings }, (_, i) => {
                    const runs1 =
                      (innings1
                        ? getRunsPerOver(
                            ballsForInnings(innings1.id),
                            match.overs_per_innings,
                          )[i]
                        : 0) || 0;
                    const runs2 =
                      (innings2
                        ? getRunsPerOver(
                            ballsForInnings(innings2.id),
                            match.overs_per_innings,
                          )[i]
                        : 0) || 0;

                    const height1 = (runs1 / maxRuns) * maxBarHeight;
                    const height2 = (runs2 / maxRuns) * maxBarHeight;

                    return (
                      <div key={i} className="flex flex-col items-center gap-1">
                        <div className="flex h-[60px] items-end gap-0.5">
                          <div
                            className="w-3 rounded-t bg-cricket-primary transition-all"
                            style={{ height: `${height1}px` }}
                            title={`${teamName(match, innings1?.team_id ?? "")}: ${runs1} runs`}
                          />
                          {innings2 && (
                            <div
                              className="w-3 rounded-t bg-cricket-secondary transition-all"
                              style={{ height: `${height2}px` }}
                              title={`${teamName(match, innings2.team_id)}: ${runs2} runs`}
                            />
                          )}
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {i + 1}
                        </span>
                      </div>
                    );
                  })}
                </div>

                {/* Summary */}
                <div className="grid gap-4 pt-4 md:grid-cols-2">
                  {sortedInnings.map((innings) => {
                    const runsPerOver = getRunsPerOver(
                      ballsForInnings(innings.id),
                      match.overs_per_innings,
                    );
                    const maxOver = runsPerOver.reduce(
                      (best, runs, idx) =>
                        runs > (best.runs || 0)
                          ? { over: idx + 1, runs }
                          : best,
                      { over: 0, runs: 0 },
                    );

                    return (
                      <Card key={innings.id}>
                        <CardContent className="py-3">
                          <p className="mb-2 font-medium">
                            {teamName(match, innings.team_id)}
                          </p>
                          <div className="grid grid-cols-2 gap-2 text-sm">
                            <div>
                              <span className="text-muted-foreground">
                                Best Over:{" "}
                              </span>
                              <span className="font-medium">
                                Over {maxOver.over} ({maxOver.runs} runs)
                              </span>
                            </div>
                            <div>
                              <span className="text-muted-foreground">
                                Run Rate:{" "}
                              </span>
                              <span className="font-medium">
                                {innings.total_overs > 0
                                  ? (
                                      innings.total_runs / innings.total_overs
                                    ).toFixed(2)
                                  : "0.00"}
                              </span>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </TabsContent>

      {/* Run Rate */}
      <TabsContent value="run-rate">
        <Card>
          <CardHeader>
            <CardTitle>Run Rate Progression</CardTitle>
          </CardHeader>
          <CardContent>
            {ballLog === null ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : sortedInnings.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground">
                No data available yet
              </div>
            ) : (
              <div className="space-y-4">
                {/* Simple line representation */}
                {sortedInnings.map((innings) => {
                  const cumulative = getCumulativeRuns(
                    ballsForInnings(innings.id),
                  );
                  const maxCumulative = Math.max(
                    ...cumulative.map((c) => c.runs),
                    1,
                  );

                  return (
                    <Card key={innings.id}>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base">
                          {teamName(match, innings.team_id)}
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="flex h-[100px] items-end gap-1">
                          {cumulative.map((point, idx) => (
                            <div
                              key={idx}
                              className={cn(
                                "flex-1 rounded-t transition-all",
                                innings.innings_number === 1
                                  ? "bg-cricket-primary"
                                  : "bg-cricket-secondary",
                              )}
                              style={{
                                height: `${(point.runs / maxCumulative) * 100}%`,
                              }}
                              title={`After ${point.over} overs: ${point.runs} runs`}
                            />
                          ))}
                        </div>
                        <div className="mt-2 flex justify-between text-xs text-muted-foreground">
                          <span>Over 1</span>
                          <span>
                            Over {cumulative.length || match.overs_per_innings}
                          </span>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </TabsContent>

      {/* Scoring Zones & Wagon Wheel */}
      <TabsContent value="scoring-zones" className="space-y-6">
        <WagonWheel match={match} />

        <Card>
          <CardHeader>
            <CardTitle>Delivery Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-6 md:grid-cols-2">
              {sortedInnings.map((innings) => {
                const balls = ballsForInnings(innings.id);
                const dots = balls.filter(
                  (b) => b.runs_scored === 0 && !b.extras && !b.is_wicket,
                ).length;
                const ones = balls.filter((b) => b.runs_scored === 1).length;
                const twos = balls.filter((b) => b.runs_scored === 2).length;
                const threes = balls.filter((b) => b.runs_scored === 3).length;
                const fours = balls.filter((b) => b.runs_scored === 4).length;
                const sixes = balls.filter((b) => b.runs_scored === 6).length;
                const extras = balls.filter((b) => b.extras > 0).length;

                return (
                  <Card key={innings.id}>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base">
                        {teamName(match, innings.team_id)}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-4 gap-2">
                        <div className="rounded-lg bg-muted p-3 text-center">
                          <p className="text-2xl font-bold">{dots}</p>
                          <p className="text-xs text-muted-foreground">Dots</p>
                        </div>
                        <div className="rounded-lg bg-muted p-3 text-center">
                          <p className="text-2xl font-bold">{ones}</p>
                          <p className="text-xs text-muted-foreground">
                            Singles
                          </p>
                        </div>
                        <div className="rounded-lg bg-muted p-3 text-center">
                          <p className="text-2xl font-bold">{twos}</p>
                          <p className="text-xs text-muted-foreground">
                            Doubles
                          </p>
                        </div>
                        <div className="rounded-lg bg-muted p-3 text-center">
                          <p className="text-2xl font-bold">{threes}</p>
                          <p className="text-xs text-muted-foreground">
                            Threes
                          </p>
                        </div>
                        <div className="rounded-lg bg-cricket-secondary/20 p-3 text-center">
                          <p className="text-2xl font-bold text-cricket-secondary">
                            {fours}
                          </p>
                          <p className="text-xs text-muted-foreground">Fours</p>
                        </div>
                        <div className="rounded-lg bg-cricket-primary/20 p-3 text-center">
                          <p className="text-2xl font-bold text-cricket-primary">
                            {sixes}
                          </p>
                          <p className="text-xs text-muted-foreground">Sixes</p>
                        </div>
                        <div className="col-span-2 rounded-lg bg-yellow-500/20 p-3 text-center">
                          <p className="text-2xl font-bold text-yellow-500">
                            {extras}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Extras
                          </p>
                        </div>
                      </div>

                      {/* Boundary percentage */}
                      <div className="mt-4">
                        <div className="mb-1 flex justify-between text-sm">
                          <span>Boundary %</span>
                          <span className="font-medium">
                            {balls.length > 0
                              ? (
                                  ((fours * 4 + sixes * 6) /
                                    innings.total_runs) *
                                  100
                                ).toFixed(1)
                              : 0}
                            %
                          </span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-muted">
                          <div
                            className="h-full bg-gradient-to-r from-cricket-secondary to-cricket-primary"
                            style={{
                              width: `${
                                balls.length > 0
                                  ? ((fours * 4 + sixes * 6) /
                                      innings.total_runs) *
                                    100
                                  : 0
                              }%`,
                            }}
                          />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
}
