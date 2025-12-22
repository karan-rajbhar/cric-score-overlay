"use client";

import Link from "next/link";
import { Card, CardContent } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Clock, MapPin, Play, Eye, BarChart3 } from "lucide-react";

interface Team {
    id: string;
    name: string;
    short_name?: string;
}

interface Innings {
    id: string;
    team_id: string;
    innings_number: number;
    total_runs: number;
    total_wickets: number;
    total_overs: number;
    is_completed: boolean;
}

interface Match {
    id: string;
    title: string;
    match_format: string;
    overs_per_innings: number;
    status: "scheduled" | "live" | "completed" | "abandoned" | "cancelled";
    venue?: string;
    scheduled_at?: string;
    result_description?: string;
    team1: Team;
    team2: Team;
    innings?: Innings[];
}

interface MatchCardProps {
    match: Match;
    showActions?: boolean;
}

export function MatchCard({ match, showActions = true }: MatchCardProps) {
    const getStatusBadge = () => {
        switch (match.status) {
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
                        ⏰ Scheduled
                    </Badge>
                );
            case "abandoned":
                return (
                    <Badge className="bg-yellow-500/10 text-yellow-500 border-yellow-500/20">
                        ⚠️ Abandoned
                    </Badge>
                );
            default:
                return (
                    <Badge variant="outline">{match.status}</Badge>
                );
        }
    };

    const getTeamScore = (teamId: string) => {
        const innings = match.innings?.find((i) => i.team_id === teamId);
        if (!innings) return null;
        return {
            runs: innings.total_runs,
            wickets: innings.total_wickets,
            overs: innings.total_overs,
        };
    };

    const team1Score = getTeamScore(match.team1.id);
    const team2Score = getTeamScore(match.team2.id);

    const formatDate = (dateStr?: string) => {
        if (!dateStr) return "TBD";
        return new Date(dateStr).toLocaleDateString("en-US", {
            weekday: "short",
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
        });
    };

    return (
        <Card className="overflow-hidden hover:shadow-lg transition-shadow border-border/50 bg-card/50 backdrop-blur">
            <CardContent className="p-0">
                {/* Header */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-border/50 bg-muted/30">
                    <div className="flex items-center gap-2">
                        {getStatusBadge()}
                        <Badge variant="outline" className="text-xs">
                            {match.match_format} • {match.overs_per_innings} overs
                        </Badge>
                    </div>
                </div>

                {/* Teams & Scores */}
                <div className="p-4 space-y-4">
                    {/* Team 1 */}
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white font-bold text-sm">
                                {match.team1.short_name?.substring(0, 2) || match.team1.name.substring(0, 2)}
                            </div>
                            <div>
                                <p className="font-semibold text-foreground">{match.team1.name}</p>
                                {match.team1.short_name && (
                                    <p className="text-xs text-muted-foreground">{match.team1.short_name}</p>
                                )}
                            </div>
                        </div>
                        {team1Score && (
                            <div className="text-right">
                                <p className="text-2xl font-bold text-foreground">
                                    {team1Score.runs}/{team1Score.wickets}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                    ({team1Score.overs} ov)
                                </p>
                            </div>
                        )}
                    </div>

                    {/* VS Divider */}
                    <div className="flex items-center gap-4">
                        <div className="flex-1 h-px bg-border" />
                        <span className="text-xs text-muted-foreground font-medium">VS</span>
                        <div className="flex-1 h-px bg-border" />
                    </div>

                    {/* Team 2 */}
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center text-white font-bold text-sm">
                                {match.team2.short_name?.substring(0, 2) || match.team2.name.substring(0, 2)}
                            </div>
                            <div>
                                <p className="font-semibold text-foreground">{match.team2.name}</p>
                                {match.team2.short_name && (
                                    <p className="text-xs text-muted-foreground">{match.team2.short_name}</p>
                                )}
                            </div>
                        </div>
                        {team2Score && (
                            <div className="text-right">
                                <p className="text-2xl font-bold text-foreground">
                                    {team2Score.runs}/{team2Score.wickets}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                    ({team2Score.overs} ov)
                                </p>
                            </div>
                        )}
                    </div>

                    {/* Result */}
                    {match.result_description && (
                        <div className="pt-2 border-t border-border/50">
                            <p className="text-sm font-medium text-center text-cricket-primary">
                                {match.result_description}
                            </p>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="px-4 py-3 border-t border-border/50 bg-muted/20">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <div className="flex items-center gap-3">
                            {match.venue && (
                                <span className="flex items-center gap-1">
                                    <MapPin className="h-3 w-3" />
                                    {match.venue}
                                </span>
                            )}
                            <span className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {formatDate(match.scheduled_at)}
                            </span>
                        </div>
                    </div>

                    {/* Actions */}
                    {showActions && (
                        <div className="flex gap-2 mt-3">
                            <Button asChild size="sm" variant="outline" className="flex-1">
                                <Link href={`/matches/${match.id}`}>
                                    <Eye className="h-4 w-4 mr-1" />
                                    View
                                </Link>
                            </Button>
                            {match.status === "live" && (
                                <Button asChild size="sm" className="flex-1 bg-cricket-primary hover:bg-cricket-primary/90">
                                    <Link href={`/matches/${match.id}/score`}>
                                        <Play className="h-4 w-4 mr-1" />
                                        Score
                                    </Link>
                                </Button>
                            )}
                            {match.status === "scheduled" && (
                                <Button asChild size="sm" className="flex-1 bg-cricket-secondary hover:bg-cricket-secondary/90">
                                    <Link href={`/matches/${match.id}/score`}>
                                        <BarChart3 className="h-4 w-4 mr-1" />
                                        Start
                                    </Link>
                                </Button>
                            )}
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}
