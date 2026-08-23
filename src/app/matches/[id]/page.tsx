"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Card, CardContent } from "~/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { MatchExportButtons } from "~/components/matches/match-export-buttons";
import { MatchSummary } from "~/components/matches/match-summary";
import { MatchScorecard } from "~/components/matches/match-scorecard";
import { MatchStats } from "~/components/matches/match-stats";
import { MatchBalls } from "~/components/matches/match-balls";
import { MatchManhattan } from "~/components/matches/match-manhattan";
import { MatchPartnerships } from "~/components/matches/match-partnerships";
import { MatchInfo } from "~/components/matches/match-info";
import { getMatch } from "../queries";
import type { Match } from "~/lib/match-types";
import { formatDecimalOvers } from "~/lib/cricket";
import { useAuth } from "~/lib/auth";
import {
    ChevronLeft,
    Tv,
    Play,
    Loader2,
    LayoutDashboard,
    FileText,
    BarChart3,
    CircleDot,
    Info,
} from "lucide-react";

export default function MatchDetailsPage() {
    const params = useParams();
    const matchId = params.id as string;
    const { user } = useAuth();
    const [match, setMatch] = useState<Match | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        async function loadMatch() {
            const result = await getMatch(matchId);
            if (result.error) {
                setError(result.error);
            } else {
                setMatch(result.data as Match);
            }
            setLoading(false);
        }
        loadMatch();
    }, [matchId]);

    const getStatusBadge = (status: string) => {
        switch (status) {
            case "live":
                return <Badge variant="live">Live</Badge>;
            case "completed":
                return <Badge variant="success">Result</Badge>;
            case "scheduled":
                return <Badge variant="outline">Scheduled</Badge>;
            default:
                return <Badge variant="outline">{status}</Badge>;
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
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
    const isScorer =
        !!user &&
        (match.created_by === user.id || (match.match_admins ?? []).includes(user.id));

    return (
        <div className="min-h-screen bg-background">
            {/* Header */}
            <div className="border-b border-border bg-card sticky top-14 z-20">
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
            <div className="border-b border-border bg-card">
                <div className="container mx-auto px-4 py-6">
                    <h1 className="text-center text-sm font-medium text-muted-foreground mb-5">{match.title}</h1>

                    <div className="flex items-center justify-center gap-6 sm:gap-10">
                        {/* Team 1 */}
                        <div className="flex flex-1 items-center justify-end gap-4 text-right max-w-[320px]">
                            <div>
                                <p className="font-semibold">{match.team1.name}</p>
                                {team1Innings ? (
                                    <p className="score-display mt-0.5 text-3xl font-semibold leading-none tabular">
                                        {team1Innings.total_runs}/{team1Innings.total_wickets}
                                        <span className="ml-2 font-score text-base font-medium text-muted-foreground">
                                            ({formatDecimalOvers(team1Innings.total_overs)})
                                        </span>
                                    </p>
                                ) : (
                                    <p className="mt-1 text-xs uppercase tracking-wider text-muted-foreground">Yet to bat</p>
                                )}
                            </div>
                            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-secondary text-xs font-bold tracking-wide text-secondary-foreground">
                                {match.team1.short_name?.substring(0, 3).toUpperCase() || match.team1.name.substring(0, 3).toUpperCase()}
                            </span>
                        </div>

                        {/* VS */}
                        <div className="font-score text-lg font-medium uppercase tracking-widest text-muted-foreground/60">vs</div>

                        {/* Team 2 */}
                        <div className="flex flex-1 items-center gap-4 max-w-[320px]">
                            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-secondary text-xs font-bold tracking-wide text-secondary-foreground">
                                {match.team2.short_name?.substring(0, 3).toUpperCase() || match.team2.name.substring(0, 3).toUpperCase()}
                            </span>
                            <div>
                                <p className="font-semibold">{match.team2.name}</p>
                                {team2Innings ? (
                                    <p className="score-display mt-0.5 text-3xl font-semibold leading-none tabular">
                                        {team2Innings.total_runs}/{team2Innings.total_wickets}
                                        <span className="ml-2 font-score text-base font-medium text-muted-foreground">
                                            ({formatDecimalOvers(team2Innings.total_overs)})
                                        </span>
                                    </p>
                                ) : (
                                    <p className="mt-1 text-xs uppercase tracking-wider text-muted-foreground">Yet to bat</p>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Result */}
                    {match.status === "completed" && match.result_description && (
                        <p className="mt-5 text-center text-base font-medium text-primary">
                            {match.result_description}
                        </p>
                    )}

                    {/* Action Buttons */}
                    <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
                        {isScorer && (match.status === "scheduled" || match.status === "live") && (
                            <Button asChild size="sm">
                                <Link href={`/matches/${match.id}/score`}>
                                    <Play className="mr-1.5 h-4 w-4" />
                                    {match.status === "scheduled" ? "Start match" : "Continue scoring"}
                                </Link>
                            </Button>
                        )}
                        {match.status === "completed" && (
                            <MatchExportButtons match={match} />
                        )}
                        <Button variant="outline" size="sm" asChild>
                            <Link href={`/overlay/${match.id}`} target="_blank">
                                <Tv className="mr-1.5 h-4 w-4" />
                                OBS overlay
                            </Link>
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

                    <TabsContent value="stats" className="space-y-6">
                        <MatchManhattan match={match} />
                        <MatchPartnerships match={match} />
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
