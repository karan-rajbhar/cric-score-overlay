"use client";

import { useState } from "react";
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
    extra_type?: string;
    is_wicket: boolean;
    dismissal_type?: string;
    commentary?: string;
    batsman?: { id: string; full_name: string };
    bowler?: { id: string; full_name: string };
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
    team1_id: string;
    team2_id: string;
    team1: Team;
    team2: Team;
    innings: Innings[];
}

interface MatchBallsProps {
    match: Match;
}

export function MatchBalls({ match }: MatchBallsProps) {
    const [filter, setFilter] = useState<"all" | "boundaries" | "wickets">("all");

    const getTeamName = (teamId: string) => {
        return teamId === match.team1_id ? match.team1.name : match.team2.name;
    };

    const getBallDisplay = (ball: Ball) => {
        if (ball.is_wicket) return "W";
        if (ball.extra_type === "wide") return `${ball.extras}wd`;
        if (ball.extra_type === "no_ball") return `${ball.runs_scored}nb`;
        if (ball.extra_type === "bye") return `${ball.extras}b`;
        if (ball.extra_type === "leg_bye") return `${ball.extras}lb`;
        return ball.runs_scored.toString();
    };

    const getBallClass = (ball: Ball) => {
        if (ball.is_wicket) return "bg-red-500 text-white";
        if (ball.runs_scored === 6) return "bg-cricket-primary text-white";
        if (ball.runs_scored === 4) return "bg-cricket-secondary text-white";
        if (ball.extra_type) return "bg-yellow-500/20 text-yellow-500";
        if (ball.runs_scored === 0) return "bg-muted text-muted-foreground";
        return "bg-muted";
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
        return balls.reduce((sum, ball) => sum + ball.runs_scored + (ball.extras || 0), 0);
    };

    const sortedInnings = [...(match.innings || [])].sort(
        (a, b) => a.innings_number - b.innings_number
    );

    if (sortedInnings.length === 0) {
        return (
            <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                    No ball-by-ball data available yet
                </CardContent>
            </Card>
        );
    }

    return (
        <div className="space-y-4">
            {/* Filter Buttons */}
            <div className="flex gap-2">
                <Badge
                    variant={filter === "all" ? "default" : "outline"}
                    className="cursor-pointer"
                    onClick={() => setFilter("all")}
                >
                    All Balls
                </Badge>
                <Badge
                    variant={filter === "boundaries" ? "default" : "outline"}
                    className="cursor-pointer"
                    onClick={() => setFilter("boundaries")}
                >
                    Boundaries
                </Badge>
                <Badge
                    variant={filter === "wickets" ? "default" : "outline"}
                    className="cursor-pointer"
                    onClick={() => setFilter("wickets")}
                >
                    Wickets
                </Badge>
            </div>

            <Tabs defaultValue={`innings-${sortedInnings[0]?.innings_number}`} className="w-full">
                <TabsList className="w-full justify-start mb-4">
                    {sortedInnings.map((innings) => (
                        <TabsTrigger
                            key={innings.id}
                            value={`innings-${innings.innings_number}`}
                            className="flex-1 max-w-[200px]"
                        >
                            {innings.innings_number === 1 ? "1st" : "2nd"} Innings
                        </TabsTrigger>
                    ))}
                </TabsList>

                {sortedInnings.map((innings) => {
                    const balls = innings.ball_by_ball || [];
                    const filteredBalls = filterBalls(balls);
                    const overGroups = groupBallsByOver(filteredBalls);
                    const overNumbers = Object.keys(overGroups)
                        .map(Number)
                        .sort((a, b) => b - a); // Most recent first

                    return (
                        <TabsContent key={innings.id} value={`innings-${innings.innings_number}`}>
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
                                                <span className="font-medium">{getTeamName(innings.team_id)}</span>
                                                <span className="text-lg font-bold">
                                                    {innings.total_runs}/{innings.total_wickets} ({innings.total_overs} ov)
                                                </span>
                                            </div>
                                        </CardContent>
                                    </Card>

                                    {/* Overs */}
                                    {overNumbers.map((overNum) => {
                                        const overBalls = overGroups[overNum] || [];
                                        const overRuns = getOverRuns(overBalls);
                                        const wicketsInOver = overBalls.filter((b) => b.is_wicket).length;

                                        return (
                                            <Card key={overNum}>
                                                <CardHeader className="py-3">
                                                    <div className="flex items-center justify-between">
                                                        <CardTitle className="text-base flex items-center gap-2">
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
                                                                <Badge variant="destructive">{wicketsInOver} wicket</Badge>
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
                                                                        "w-10 h-10 rounded-full flex items-center justify-center font-semibold text-sm",
                                                                        getBallClass(ball)
                                                                    )}
                                                                    title={`${ball.batsman?.full_name} vs ${ball.bowler?.full_name}${ball.commentary ? `: ${ball.commentary}` : ""
                                                                        }`}
                                                                >
                                                                    {getBallDisplay(ball)}
                                                                </div>
                                                            ))}
                                                    </div>

                                                    {/* Ball Commentary */}
                                                    <div className="mt-3 space-y-1">
                                                        {overBalls
                                                            .sort((a, b) => a.ball_number - b.ball_number)
                                                            .map((ball) => (
                                                                <div key={ball.id} className="text-sm">
                                                                    <span className="font-medium">
                                                                        {overNum}.{ball.ball_number}
                                                                    </span>
                                                                    <span className="mx-2 text-muted-foreground">
                                                                        {ball.bowler?.full_name} to {ball.batsman?.full_name}
                                                                    </span>
                                                                    <span
                                                                        className={cn(
                                                                            "font-semibold",
                                                                            ball.is_wicket && "text-red-500",
                                                                            ball.runs_scored >= 4 && "text-cricket-primary"
                                                                        )}
                                                                    >
                                                                        {ball.is_wicket
                                                                            ? `WICKET! ${ball.dismissal_type || ""}`
                                                                            : `${ball.runs_scored + (ball.extras || 0)} run${ball.runs_scored + (ball.extras || 0) !== 1 ? "s" : ""
                                                                            }`}
                                                                    </span>
                                                                    {ball.extra_type && (
                                                                        <Badge variant="outline" className="ml-2 text-xs">
                                                                            {ball.extra_type}
                                                                        </Badge>
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
