"use client";

import { Badge } from "~/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Trophy, Target, Clock, TrendingUp } from "lucide-react";
import type { Innings, Match } from "~/lib/match-types";
import { formatDecimalOvers } from "~/lib/cricket";






interface MatchSummaryProps {
    match: Match;
}

export function MatchSummary({ match }: MatchSummaryProps) {
    const getInningsForTeam = (teamId: string) => {
        return match.innings?.find((i) => i.team_id === teamId) || null;
    };

    const team1Innings = getInningsForTeam(match.team1_id);
    const team2Innings = getInningsForTeam(match.team2_id);

    const getTopScorer = (innings: Innings | null) => {
        if (!innings?.batting_performances?.length) return null;
        return innings.batting_performances.reduce((best, current) =>
            current.runs_scored > (best?.runs_scored || 0) ? current : best
            , innings.batting_performances[0]);
    };

    return (
        <div className="space-y-6">
            {/* Result Banner */}
            {match.status === "completed" && match.result_description && (
                <Card className="bg-gradient-to-r from-cricket-primary/20 to-cricket-secondary/20 border-cricket-primary/30">
                    <CardContent className="py-4">
                        <div className="flex items-center justify-center gap-3">
                            <Trophy className="h-6 w-6 text-cricket-primary" />
                            <p className="text-lg font-semibold text-foreground">
                                {match.result_description}
                            </p>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Live Match Info */}
            {match.status === "live" && team2Innings?.target_runs && (
                <Card className="bg-gradient-to-r from-red-500/20 to-orange-500/20 border-red-500/30">
                    <CardContent className="py-4">
                        <div className="flex items-center justify-center gap-3">
                            <Target className="h-6 w-6 text-red-500" />
                            <p className="text-lg font-semibold">
                                {match.team2.name} needs{" "}
                                <span className="text-red-500">
                                    {team2Innings.target_runs - team2Innings.total_runs}
                                </span>{" "}
                                runs from{" "}
                                <span className="text-red-500">
                                    {(match.overs_per_innings - team2Innings.total_overs) * 6}
                                </span>{" "}
                                balls
                            </p>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Key Stats Grid */}
            <div className="grid md:grid-cols-2 gap-4">
                {/* Team 1 Summary */}
                <Card>
                    <CardHeader className="pb-2">
                        <div className="flex items-center justify-between">
                            <CardTitle className="text-lg">{match.team1.name}</CardTitle>
                            {match.winning_team_id === match.team1_id && (
                                <Badge className="bg-cricket-primary/10 text-cricket-primary">Winner</Badge>
                            )}
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold mb-4">
                            {team1Innings ? (
                                <>
                                    {team1Innings.total_runs}/{team1Innings.total_wickets}
                                    <span className="text-lg text-muted-foreground ml-2">
                                        ({formatDecimalOvers(team1Innings.total_overs)} ov)
                                    </span>
                                </>
                            ) : (
                                <span className="text-muted-foreground">Yet to bat</span>
                            )}
                        </div>

                        {team1Innings && (
                            <div className="space-y-2 text-sm">
                                {getTopScorer(team1Innings) && (
                                    <div className="flex items-center justify-between">
                                        <span className="text-muted-foreground">Top Scorer</span>
                                        <span className="font-medium">
                                            {getTopScorer(team1Innings)?.user?.full_name} - {getTopScorer(team1Innings)?.runs_scored}
                                            {!getTopScorer(team1Innings)?.is_out && "*"}
                                            ({getTopScorer(team1Innings)?.balls_faced})
                                        </span>
                                    </div>
                                )}
                                <div className="flex items-center justify-between">
                                    <span className="text-muted-foreground">Run Rate</span>
                                    <span className="font-medium">
                                        {team1Innings.total_overs > 0
                                            ? (team1Innings.total_runs / team1Innings.total_overs).toFixed(2)
                                            : "0.00"}
                                    </span>
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Team 2 Summary */}
                <Card>
                    <CardHeader className="pb-2">
                        <div className="flex items-center justify-between">
                            <CardTitle className="text-lg">{match.team2.name}</CardTitle>
                            {match.winning_team_id === match.team2_id && (
                                <Badge className="bg-cricket-primary/10 text-cricket-primary">Winner</Badge>
                            )}
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold mb-4">
                            {team2Innings ? (
                                <>
                                    {team2Innings.total_runs}/{team2Innings.total_wickets}
                                    <span className="text-lg text-muted-foreground ml-2">
                                        ({formatDecimalOvers(team2Innings.total_overs)} ov)
                                    </span>
                                </>
                            ) : (
                                <span className="text-muted-foreground">Yet to bat</span>
                            )}
                        </div>

                        {team2Innings && (
                            <div className="space-y-2 text-sm">
                                {getTopScorer(team2Innings) && (
                                    <div className="flex items-center justify-between">
                                        <span className="text-muted-foreground">Top Scorer</span>
                                        <span className="font-medium">
                                            {getTopScorer(team2Innings)?.user?.full_name} - {getTopScorer(team2Innings)?.runs_scored}
                                            {!getTopScorer(team2Innings)?.is_out && "*"}
                                            ({getTopScorer(team2Innings)?.balls_faced})
                                        </span>
                                    </div>
                                )}
                                <div className="flex items-center justify-between">
                                    <span className="text-muted-foreground">Run Rate</span>
                                    <span className="font-medium">
                                        {team2Innings.total_overs > 0
                                            ? (team2Innings.total_runs / team2Innings.total_overs).toFixed(2)
                                            : "0.00"}
                                    </span>
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* Best Performers */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <TrendingUp className="h-5 w-5" />
                        Best Performers
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="grid md:grid-cols-2 gap-6">
                        {/* Batting */}
                        <div>
                            <h4 className="font-semibold mb-3 text-sm uppercase text-muted-foreground">
                                Top Batters
                            </h4>
                            <div className="space-y-2">
                                {match.innings?.flatMap(inn =>
                                    (inn.batting_performances || [])
                                        .filter(bp => bp.runs_scored > 0)
                                        .sort((a, b) => b.runs_scored - a.runs_scored)
                                        .slice(0, 3)
                                        .map(bp => (
                                            <div key={bp.id} className="flex items-center justify-between text-sm">
                                                <span>{bp.user?.full_name}</span>
                                                <span className="font-medium">
                                                    {bp.runs_scored}{!bp.is_out && "*"} ({bp.balls_faced})
                                                </span>
                                            </div>
                                        ))
                                )}
                            </div>
                        </div>

                        {/* Bowling */}
                        <div>
                            <h4 className="font-semibold mb-3 text-sm uppercase text-muted-foreground">
                                Top Bowlers
                            </h4>
                            <div className="space-y-2">
                                {match.innings?.flatMap(inn =>
                                    (inn.bowling_performances || [])
                                        .filter(bp => bp.wickets_taken > 0)
                                        .sort((a, b) => b.wickets_taken - a.wickets_taken)
                                        .slice(0, 3)
                                        .map(bp => (
                                            <div key={bp.id} className="flex items-center justify-between text-sm">
                                                <span>{bp.user?.full_name}</span>
                                                <span className="font-medium">
                                                    {bp.wickets_taken}/{bp.runs_conceded} ({bp.overs_bowled} ov)
                                                </span>
                                            </div>
                                        ))
                                )}
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Match Timeline/Key Moments - Placeholder */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Clock className="h-5 w-5" />
                        Key Moments
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="text-center py-8 text-muted-foreground">
                        <p>Key moments and highlights will appear here during live matches</p>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
