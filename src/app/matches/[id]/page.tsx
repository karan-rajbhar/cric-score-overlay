"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Card, CardContent } from "~/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { MatchSummary } from "~/components/matches/match-summary";
import { MatchScorecard } from "~/components/matches/match-scorecard";
import { MatchStats } from "~/components/matches/match-stats";
import { MatchBalls } from "~/components/matches/match-balls";
import { MatchInfo } from "~/components/matches/match-info";
import { getMatchFull } from "../actions";
import {
    ChevronLeft,
    Tv,
    Play,
    Share2,
    Loader2,
    LayoutDashboard,
    FileText,
    BarChart3,
    CircleDot,
    Info,
} from "lucide-react";

interface TeamPlayer {
    id: string;
    user_id: string;
    role?: string;
    batting_order?: number;
    jersey_number?: number;
    user?: { id: string; full_name: string; avatar_url?: string };
}

interface BattingPerformance {
    id: string;
    user_id: string;
    runs_scored: number;
    balls_faced: number;
    fours: number;
    sixes: number;
    is_not_out: boolean;
    dismissal_type?: string;
    user?: { id: string; full_name: string };
}

interface BowlingPerformance {
    id: string;
    user_id: string;
    overs_bowled: number;
    runs_conceded: number;
    wickets_taken: number;
    maidens: number;
    wides: number;
    no_balls: number;
    user?: { id: string; full_name: string };
}

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

interface FallOfWicket {
    id: string;
    wicket_number: number;
    runs_at_wicket: number;
    overs_at_wicket: number;
    batsman?: { id: string; full_name: string };
}

interface Innings {
    id: string;
    innings_number: number;
    team_id: string;
    total_runs: number;
    total_wickets: number;
    total_overs: number;
    is_completed: boolean;
    target_runs?: number;
    extras_total?: number;
    extras_wides?: number;
    extras_no_balls?: number;
    extras_byes?: number;
    extras_leg_byes?: number;
    batting_performances?: BattingPerformance[];
    bowling_performances?: BowlingPerformance[];
    ball_by_ball?: Ball[];
    fall_of_wickets?: FallOfWicket[];
}

interface Team {
    id: string;
    name: string;
    short_name?: string;
    team_players?: TeamPlayer[];
}

interface Tournament {
    id: string;
    name: string;
}

interface Club {
    id: string;
    name: string;
}

interface Match {
    id: string;
    title: string;
    match_format: string;
    overs_per_innings: number;
    status: string;
    current_innings: number;
    current_over: number;
    current_ball: number;
    venue?: string;
    scheduled_at?: string;
    actual_start_time?: string;
    actual_end_time?: string;
    toss_winner_team_id?: string;
    toss_decision?: string;
    result_description?: string;
    winning_team_id?: string;
    weather_conditions?: string;
    pitch_conditions?: string;
    ball_type?: string;
    umpire1_name?: string;
    umpire2_name?: string;
    team1_id: string;
    team2_id: string;
    team1: Team;
    team2: Team;
    innings: Innings[];
    tournament?: Tournament;
    club?: Club;
}

export default function MatchDetailsPage() {
    const params = useParams();
    const matchId = params.id as string;
    const [match, setMatch] = useState<Match | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        async function loadMatch() {
            const result = await getMatchFull(matchId);
            if (result.error) {
                setError(result.error);
            } else {
                setMatch(result.data as Match);
            }
            setLoading(false);
        }
        loadMatch();
    }, [matchId]);

    const formatOvers = (overs: number) => {
        const fullOvers = Math.floor(overs);
        const balls = Math.round((overs - fullOvers) * 10);
        return `${fullOvers}.${balls}`;
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case "live":
                return (
                    <Badge className="bg-red-500/10 text-red-500 border-red-500/20 animate-pulse">
                        🔴 LIVE
                    </Badge>
                );
            case "completed":
                return (
                    <Badge className="bg-green-500/10 text-green-500 border-green-500/20">
                        ✓ Completed
                    </Badge>
                );
            case "scheduled":
                return (
                    <Badge className="bg-blue-500/10 text-blue-500 border-blue-500/20">
                        📅 Scheduled
                    </Badge>
                );
            default:
                return <Badge variant="outline">{status}</Badge>;
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-cricket-primary" />
            </div>
        );
    }

    if (error || !match) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <Card className="max-w-md w-full mx-4">
                    <CardContent className="p-6 text-center">
                        <p className="text-red-500 mb-4">{error || "Match not found"}</p>
                        <Button asChild>
                            <Link href="/matches">Back to Matches</Link>
                        </Button>
                    </CardContent>
                </Card>
            </div>
        );
    }

    const team1Innings = match.innings?.find((i) => i.team_id === match.team1_id);
    const team2Innings = match.innings?.find((i) => i.team_id === match.team2_id);

    return (
        <div className="min-h-screen bg-background">
            {/* Header */}
            <div className="border-b border-border/50 bg-card/50 backdrop-blur sticky top-0 z-20">
                <div className="container mx-auto px-4 py-3">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <Button variant="ghost" size="sm" asChild>
                                <Link href="/matches">
                                    <ChevronLeft className="h-4 w-4 mr-1" />
                                    Matches
                                </Link>
                            </Button>
                        </div>
                        <div className="flex items-center gap-2">
                            {getStatusBadge(match.status)}
                            <Badge variant="outline">{match.match_format}</Badge>
                            <Badge variant="outline">{match.overs_per_innings} overs</Badge>
                        </div>
                    </div>
                </div>
            </div>

            {/* Score Header - Always Visible */}
            <div className="bg-gradient-to-r from-cricket-primary/10 via-background to-cricket-secondary/10 border-b">
                <div className="container mx-auto px-4 py-6">
                    <h1 className="text-xl font-bold mb-4 text-center">{match.title}</h1>

                    <div className="flex items-center justify-center gap-8">
                        {/* Team 1 */}
                        <div className="text-center flex-1 max-w-[300px]">
                            <div className="flex items-center justify-center gap-3 mb-2">
                                <div className="w-12 h-12 rounded-full bg-cricket-primary/20 flex items-center justify-center text-cricket-primary font-bold text-lg">
                                    {match.team1.short_name?.substring(0, 2) || match.team1.name.substring(0, 2)}
                                </div>
                                <div className="text-left">
                                    <p className="font-semibold">{match.team1.name}</p>
                                    {team1Innings && (
                                        <p className="text-2xl font-bold">
                                            {team1Innings.total_runs}/{team1Innings.total_wickets}
                                            <span className="text-sm font-normal text-muted-foreground ml-2">
                                                ({formatOvers(team1Innings.total_overs)})
                                            </span>
                                        </p>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* VS */}
                        <div className="text-2xl font-bold text-muted-foreground">vs</div>

                        {/* Team 2 */}
                        <div className="text-center flex-1 max-w-[300px]">
                            <div className="flex items-center justify-center gap-3 mb-2">
                                <div className="text-right">
                                    <p className="font-semibold">{match.team2.name}</p>
                                    {team2Innings && (
                                        <p className="text-2xl font-bold">
                                            {team2Innings.total_runs}/{team2Innings.total_wickets}
                                            <span className="text-sm font-normal text-muted-foreground ml-2">
                                                ({formatOvers(team2Innings.total_overs)})
                                            </span>
                                        </p>
                                    )}
                                </div>
                                <div className="w-12 h-12 rounded-full bg-cricket-secondary/20 flex items-center justify-center text-cricket-secondary font-bold text-lg">
                                    {match.team2.short_name?.substring(0, 2) || match.team2.name.substring(0, 2)}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Result */}
                    {match.status === "completed" && match.result_description && (
                        <p className="text-center mt-4 text-lg font-medium text-cricket-primary">
                            {match.result_description}
                        </p>
                    )}

                    {/* Action Buttons */}
                    <div className="flex items-center justify-center gap-3 mt-4">
                        {match.status === "scheduled" && (
                            <Button asChild className="bg-cricket-primary hover:bg-cricket-primary/90">
                                <Link href={`/matches/${match.id}/score`}>
                                    <Play className="h-4 w-4 mr-2" />
                                    Start Match
                                </Link>
                            </Button>
                        )}
                        {match.status === "live" && (
                            <Button asChild className="bg-cricket-primary hover:bg-cricket-primary/90">
                                <Link href={`/matches/${match.id}/score`}>
                                    <Play className="h-4 w-4 mr-2" />
                                    Continue Scoring
                                </Link>
                            </Button>
                        )}
                        <Button variant="outline" asChild>
                            <Link href={`/overlay/${match.id}`} target="_blank">
                                <Tv className="h-4 w-4 mr-2" />
                                OBS Overlay
                            </Link>
                        </Button>
                        <Button variant="outline" size="icon">
                            <Share2 className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
            </div>

            {/* Main Tabbed Content */}
            <div className="container mx-auto px-4 py-6">
                <Tabs defaultValue="summary" className="w-full">
                    <TabsList className="w-full justify-start mb-6 bg-muted/50 p-1">
                        <TabsTrigger value="summary" className="flex items-center gap-2">
                            <LayoutDashboard className="h-4 w-4" />
                            Summary
                        </TabsTrigger>
                        <TabsTrigger value="scorecard" className="flex items-center gap-2">
                            <FileText className="h-4 w-4" />
                            Scorecard
                        </TabsTrigger>
                        <TabsTrigger value="stats" className="flex items-center gap-2">
                            <BarChart3 className="h-4 w-4" />
                            Stats
                        </TabsTrigger>
                        <TabsTrigger value="balls" className="flex items-center gap-2">
                            <CircleDot className="h-4 w-4" />
                            Balls
                        </TabsTrigger>
                        <TabsTrigger value="info" className="flex items-center gap-2">
                            <Info className="h-4 w-4" />
                            Info
                        </TabsTrigger>
                    </TabsList>

                    <TabsContent value="summary">
                        <MatchSummary match={match} />
                    </TabsContent>

                    <TabsContent value="scorecard">
                        <MatchScorecard match={match} />
                    </TabsContent>

                    <TabsContent value="stats">
                        <MatchStats match={match} />
                    </TabsContent>

                    <TabsContent value="balls">
                        <MatchBalls match={match} />
                    </TabsContent>

                    <TabsContent value="info">
                        <MatchInfo match={match} />
                    </TabsContent>
                </Tabs>
            </div>
        </div>
    );
}
