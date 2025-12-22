"use client";

import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { Badge } from "~/components/ui/badge";
import { cn } from "~/lib/utils";

interface Ball {
    id: string;
    over_number: number;
    ball_number: number;
    runs_scored: number;
    extras: number;
    is_wicket: boolean;
    innings?: { innings_number: number; team_id: string };
}

interface Innings {
    id: string;
    innings_number: number;
    team_id: string;
    total_runs: number;
    total_wickets: number;
    total_overs: number;
    ball_by_ball?: Ball[];
}

interface Team {
    id: string;
    name: string;
    short_name?: string;
}

interface Match {
    id: string;
    overs_per_innings: number;
    team1_id: string;
    team2_id: string;
    team1: Team;
    team2: Team;
    innings: Innings[];
}

interface MatchStatsProps {
    match: Match;
}

export function MatchStats({ match }: MatchStatsProps) {
    const getTeamName = (teamId: string) => {
        return teamId === match.team1_id ? match.team1.name : match.team2.name;
    };

    const getRunsPerOver = (balls: Ball[], maxOvers: number) => {
        const runsPerOver: number[] = Array(maxOvers).fill(0);
        balls.forEach((ball) => {
            if (ball.over_number < maxOvers) {
                const currentRuns = runsPerOver[ball.over_number] || 0;
                runsPerOver[ball.over_number] = currentRuns + ball.runs_scored + (ball.extras || 0);
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
        (a, b) => a.innings_number - b.innings_number
    );

    const innings1 = sortedInnings[0];
    const innings2 = sortedInnings[1];

    const maxBarHeight = 60;
    const maxRuns = Math.max(
        ...sortedInnings.flatMap((inn) =>
            getRunsPerOver(inn.ball_by_ball || [], match.overs_per_innings)
        ),
        1
    );

    return (
        <Tabs defaultValue="run-comparison" className="w-full">
            <TabsList className="w-full justify-start mb-4">
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
                        {sortedInnings.length === 0 ? (
                            <div className="text-center py-12 text-muted-foreground">
                                No data available yet
                            </div>
                        ) : (
                            <div className="space-y-6">
                                {/* Legend */}
                                <div className="flex items-center gap-4 justify-center">
                                    {innings1 && (
                                        <div className="flex items-center gap-2">
                                            <div className="w-4 h-4 rounded bg-cricket-primary" />
                                            <span className="text-sm">{getTeamName(innings1.team_id)}</span>
                                        </div>
                                    )}
                                    {innings2 && (
                                        <div className="flex items-center gap-2">
                                            <div className="w-4 h-4 rounded bg-cricket-secondary" />
                                            <span className="text-sm">{getTeamName(innings2.team_id)}</span>
                                        </div>
                                    )}
                                </div>

                                {/* Bar Chart */}
                                <div className="flex items-end justify-center gap-1 h-[200px] px-4">
                                    {Array.from({ length: match.overs_per_innings }, (_, i) => {
                                        const runs1 = (innings1?.ball_by_ball
                                            ? getRunsPerOver(innings1.ball_by_ball, match.overs_per_innings)[i]
                                            : 0) || 0;
                                        const runs2 = (innings2?.ball_by_ball
                                            ? getRunsPerOver(innings2.ball_by_ball, match.overs_per_innings)[i]
                                            : 0) || 0;

                                        const height1 = (runs1 / maxRuns) * maxBarHeight;
                                        const height2 = (runs2 / maxRuns) * maxBarHeight;

                                        return (
                                            <div key={i} className="flex flex-col items-center gap-1">
                                                <div className="flex items-end gap-0.5 h-[60px]">
                                                    <div
                                                        className="w-3 bg-cricket-primary rounded-t transition-all"
                                                        style={{ height: `${height1}px` }}
                                                        title={`${getTeamName(innings1?.team_id || "")}: ${runs1} runs`}
                                                    />
                                                    {innings2 && (
                                                        <div
                                                            className="w-3 bg-cricket-secondary rounded-t transition-all"
                                                            style={{ height: `${height2}px` }}
                                                            title={`${getTeamName(innings2.team_id)}: ${runs2} runs`}
                                                        />
                                                    )}
                                                </div>
                                                <span className="text-xs text-muted-foreground">{i + 1}</span>
                                            </div>
                                        );
                                    })}
                                </div>

                                {/* Summary */}
                                <div className="grid md:grid-cols-2 gap-4 pt-4">
                                    {sortedInnings.map((innings) => {
                                        const runsPerOver = getRunsPerOver(
                                            innings.ball_by_ball || [],
                                            match.overs_per_innings
                                        );
                                        const maxOver = runsPerOver.reduce(
                                            (best, runs, idx) =>
                                                runs > (best.runs || 0) ? { over: idx + 1, runs } : best,
                                            { over: 0, runs: 0 }
                                        );

                                        return (
                                            <Card key={innings.id}>
                                                <CardContent className="py-3">
                                                    <p className="font-medium mb-2">{getTeamName(innings.team_id)}</p>
                                                    <div className="grid grid-cols-2 gap-2 text-sm">
                                                        <div>
                                                            <span className="text-muted-foreground">Best Over: </span>
                                                            <span className="font-medium">
                                                                Over {maxOver.over} ({maxOver.runs} runs)
                                                            </span>
                                                        </div>
                                                        <div>
                                                            <span className="text-muted-foreground">Run Rate: </span>
                                                            <span className="font-medium">
                                                                {innings.total_overs > 0
                                                                    ? (innings.total_runs / innings.total_overs).toFixed(2)
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
                        {sortedInnings.length === 0 ? (
                            <div className="text-center py-12 text-muted-foreground">
                                No data available yet
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {/* Simple line representation */}
                                {sortedInnings.map((innings) => {
                                    const cumulative = getCumulativeRuns(innings.ball_by_ball || []);
                                    const maxCumulative = Math.max(...cumulative.map((c) => c.runs), 1);

                                    return (
                                        <Card key={innings.id}>
                                            <CardHeader className="pb-2">
                                                <CardTitle className="text-base">
                                                    {getTeamName(innings.team_id)}
                                                </CardTitle>
                                            </CardHeader>
                                            <CardContent>
                                                <div className="flex items-end gap-1 h-[100px]">
                                                    {cumulative.map((point, idx) => (
                                                        <div
                                                            key={idx}
                                                            className={cn(
                                                                "flex-1 rounded-t transition-all",
                                                                innings.innings_number === 1
                                                                    ? "bg-cricket-primary"
                                                                    : "bg-cricket-secondary"
                                                            )}
                                                            style={{
                                                                height: `${(point.runs / maxCumulative) * 100}%`,
                                                            }}
                                                            title={`After ${point.over} overs: ${point.runs} runs`}
                                                        />
                                                    ))}
                                                </div>
                                                <div className="flex justify-between mt-2 text-xs text-muted-foreground">
                                                    <span>Over 1</span>
                                                    <span>Over {cumulative.length || match.overs_per_innings}</span>
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

            {/* Scoring Zones (Placeholder for Wagon Wheel) */}
            <TabsContent value="scoring-zones">
                <Card>
                    <CardHeader>
                        <CardTitle>Scoring Zones</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="grid md:grid-cols-2 gap-6">
                            {sortedInnings.map((innings) => {
                                const balls = innings.ball_by_ball || [];
                                const dots = balls.filter(
                                    (b) => b.runs_scored === 0 && !b.extras && !b.is_wicket
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
                                                {getTeamName(innings.team_id)}
                                            </CardTitle>
                                        </CardHeader>
                                        <CardContent>
                                            <div className="grid grid-cols-4 gap-2">
                                                <div className="text-center p-3 rounded-lg bg-muted">
                                                    <p className="text-2xl font-bold">{dots}</p>
                                                    <p className="text-xs text-muted-foreground">Dots</p>
                                                </div>
                                                <div className="text-center p-3 rounded-lg bg-muted">
                                                    <p className="text-2xl font-bold">{ones}</p>
                                                    <p className="text-xs text-muted-foreground">Singles</p>
                                                </div>
                                                <div className="text-center p-3 rounded-lg bg-muted">
                                                    <p className="text-2xl font-bold">{twos}</p>
                                                    <p className="text-xs text-muted-foreground">Doubles</p>
                                                </div>
                                                <div className="text-center p-3 rounded-lg bg-muted">
                                                    <p className="text-2xl font-bold">{threes}</p>
                                                    <p className="text-xs text-muted-foreground">Threes</p>
                                                </div>
                                                <div className="text-center p-3 rounded-lg bg-cricket-secondary/20">
                                                    <p className="text-2xl font-bold text-cricket-secondary">{fours}</p>
                                                    <p className="text-xs text-muted-foreground">Fours</p>
                                                </div>
                                                <div className="text-center p-3 rounded-lg bg-cricket-primary/20">
                                                    <p className="text-2xl font-bold text-cricket-primary">{sixes}</p>
                                                    <p className="text-xs text-muted-foreground">Sixes</p>
                                                </div>
                                                <div className="text-center p-3 rounded-lg bg-yellow-500/20 col-span-2">
                                                    <p className="text-2xl font-bold text-yellow-500">{extras}</p>
                                                    <p className="text-xs text-muted-foreground">Extras</p>
                                                </div>
                                            </div>

                                            {/* Boundary percentage */}
                                            <div className="mt-4">
                                                <div className="flex justify-between text-sm mb-1">
                                                    <span>Boundary %</span>
                                                    <span className="font-medium">
                                                        {balls.length > 0
                                                            ? (((fours * 4 + sixes * 6) / innings.total_runs) * 100).toFixed(1)
                                                            : 0}
                                                        %
                                                    </span>
                                                </div>
                                                <div className="h-2 bg-muted rounded-full overflow-hidden">
                                                    <div
                                                        className="h-full bg-gradient-to-r from-cricket-secondary to-cricket-primary"
                                                        style={{
                                                            width: `${balls.length > 0
                                                                ? ((fours * 4 + sixes * 6) / innings.total_runs) * 100
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
