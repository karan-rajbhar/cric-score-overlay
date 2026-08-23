"use client";

import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "~/components/ui/table";
import {
    Calendar,
    MapPin,
    Trophy,
    Users,
    Hash,
    Clock,
    CircleDot,
    Layers,
} from "lucide-react";
import type { Match } from "~/lib/match-types";


interface MatchInfoProps {
    match: Match;
}

export function MatchInfo({ match }: MatchInfoProps) {
    const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleDateString("en-US", {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric",
        });
    };

    const formatTime = (dateStr: string) => {
        return new Date(dateStr).toLocaleTimeString("en-US", {
            hour: "2-digit",
            minute: "2-digit",
        });
    };

    const getTossWinnerName = () => {
        if (match.toss_winner_team_id === match.team1_id) return match.team1.name;
        if (match.toss_winner_team_id === match.team2_id) return match.team2.name;
        return "Not decided";
    };

    const getPlayerRole = (role?: string | null) => {
        switch (role) {
            case "batsman":
                return "Batter";
            case "bowler":
                return "Bowler";
            case "all_rounder":
                return "All-rounder";
            case "wicket_keeper":
                return "Wicket-keeper";
            default:
                return role || "";
        }
    };

    return (
        <Tabs defaultValue="match-info" className="w-full">
            <TabsList className="w-full justify-start mb-4">
                <TabsTrigger value="match-info" className="flex items-center gap-2">
                    <Hash className="h-4 w-4" />
                    Match Info
                </TabsTrigger>
                <TabsTrigger value="squads" className="flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    Squads
                </TabsTrigger>
                <TabsTrigger value="head-to-head" className="flex items-center gap-2">
                    <Trophy className="h-4 w-4" />
                    Head to Head
                </TabsTrigger>
            </TabsList>

            {/* Match Info Tab */}
            <TabsContent value="match-info">
                <div className="grid md:grid-cols-2 gap-4">
                    {/* Basic Info */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-lg">Match Details</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex items-start gap-3">
                                <Layers className="h-5 w-5 text-muted-foreground mt-0.5" />
                                <div>
                                    <p className="text-sm text-muted-foreground">Format</p>
                                    <p className="font-medium">{match.match_format}</p>
                                </div>
                            </div>

                            <div className="flex items-start gap-3">
                                <CircleDot className="h-5 w-5 text-muted-foreground mt-0.5" />
                                <div>
                                    <p className="text-sm text-muted-foreground">Overs</p>
                                    <p className="font-medium">{match.overs_per_innings} overs per innings</p>
                                </div>
                            </div>

                            {match.ball_type && (
                                <div className="flex items-start gap-3">
                                    <CircleDot className="h-5 w-5 text-muted-foreground mt-0.5" />
                                    <div>
                                        <p className="text-sm text-muted-foreground">Ball Type</p>
                                        <p className="font-medium capitalize">{match.ball_type}</p>
                                    </div>
                                </div>
                            )}

                            <div className="flex items-start gap-3">
                                <MapPin className="h-5 w-5 text-muted-foreground mt-0.5" />
                                <div>
                                    <p className="text-sm text-muted-foreground">Venue</p>
                                    <p className="font-medium">{match.venue || "Not specified"}</p>
                                </div>
                            </div>

                            {match.scheduled_at && (
                                <div className="flex items-start gap-3">
                                    <Calendar className="h-5 w-5 text-muted-foreground mt-0.5" />
                                    <div>
                                        <p className="text-sm text-muted-foreground">Date & Time</p>
                                        <p className="font-medium">{formatDate(match.scheduled_at)}</p>
                                        <p className="text-sm text-muted-foreground">
                                            {formatTime(match.scheduled_at)}
                                        </p>
                                    </div>
                                </div>
                            )}

                            {match.actual_start_time && (
                                <div className="flex items-start gap-3">
                                    <Clock className="h-5 w-5 text-muted-foreground mt-0.5" />
                                    <div>
                                        <p className="text-sm text-muted-foreground">Actual Start</p>
                                        <p className="font-medium">{formatTime(match.actual_start_time)}</p>
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Toss & Conditions */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-lg">Toss & Conditions</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex items-start gap-3">
                                <Trophy className="h-5 w-5 text-muted-foreground mt-0.5" />
                                <div>
                                    <p className="text-sm text-muted-foreground">Toss</p>
                                    <p className="font-medium">
                                        {match.toss_winner_team_id ? (
                                            <>
                                                {getTossWinnerName()} won and elected to{" "}
                                                <span className="capitalize">{match.toss_decision}</span>
                                            </>
                                        ) : (
                                            "Toss not conducted yet"
                                        )}
                                    </p>
                                </div>
                            </div>

                            {match.weather_conditions && (
                                <div className="flex items-start gap-3">
                                    <span className="text-lg">🌤️</span>
                                    <div>
                                        <p className="text-sm text-muted-foreground">Weather</p>
                                        <p className="font-medium">{match.weather_conditions}</p>
                                    </div>
                                </div>
                            )}

                            {match.pitch_conditions && (
                                <div className="flex items-start gap-3">
                                    <span className="text-lg">🏟️</span>
                                    <div>
                                        <p className="text-sm text-muted-foreground">Pitch</p>
                                        <p className="font-medium">{match.pitch_conditions}</p>
                                    </div>
                                </div>
                            )}

                            {(match.umpire1_name || match.umpire2_name) && (
                                <div className="flex items-start gap-3">
                                    <Users className="h-5 w-5 text-muted-foreground mt-0.5" />
                                    <div>
                                        <p className="text-sm text-muted-foreground">Umpires</p>
                                        <p className="font-medium">
                                            {[match.umpire1_name, match.umpire2_name].filter(Boolean).join(", ")}
                                        </p>
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Match ID & Meta */}
                    <Card className="md:col-span-2">
                        <CardHeader>
                            <CardTitle className="text-lg">Additional Info</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="grid md:grid-cols-3 gap-4">
                                <div>
                                    <p className="text-sm text-muted-foreground">Match ID</p>
                                    <p className="font-mono text-sm">{match.id}</p>
                                </div>
                                {match.tournament && (
                                    <div>
                                        <p className="text-sm text-muted-foreground">Tournament</p>
                                        <p className="font-medium">{match.tournament.name}</p>
                                    </div>
                                )}
                                {match.club && (
                                    <div>
                                        <p className="text-sm text-muted-foreground">Club</p>
                                        <p className="font-medium">{match.club.name}</p>
                                    </div>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </TabsContent>

            {/* Squads Tab */}
            <TabsContent value="squads">
                <div className="grid md:grid-cols-2 gap-4">
                    {/* Team 1 Squad */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-full bg-cricket-primary/20 flex items-center justify-center">
                                    {match.team1.short_name?.charAt(0) || match.team1.name.charAt(0)}
                                </div>
                                {match.team1.name}
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-0">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="w-[50px]">#</TableHead>
                                        <TableHead>Player</TableHead>
                                        <TableHead>Role</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {(match.team1.team_players || [])
                                        .sort((a, b) => (a.batting_order || 99) - (b.batting_order || 99))
                                        .map((tp, idx) => (
                                            <TableRow key={tp.id}>
                                                <TableCell className="font-medium">
                                                    {tp.jersey_number || idx + 1}
                                                </TableCell>
                                                <TableCell>{tp.user?.full_name}</TableCell>
                                                <TableCell className="text-sm text-muted-foreground">
                                                    {getPlayerRole(tp.role_in_team)}
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                </TableBody>
                            </Table>
                            {(!match.team1.team_players || match.team1.team_players.length === 0) && (
                                <div className="p-4 text-center text-muted-foreground">
                                    Squad not announced yet
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Team 2 Squad */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-full bg-cricket-secondary/20 flex items-center justify-center">
                                    {match.team2.short_name?.charAt(0) || match.team2.name.charAt(0)}
                                </div>
                                {match.team2.name}
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-0">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="w-[50px]">#</TableHead>
                                        <TableHead>Player</TableHead>
                                        <TableHead>Role</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {(match.team2.team_players || [])
                                        .sort((a, b) => (a.batting_order || 99) - (b.batting_order || 99))
                                        .map((tp, idx) => (
                                            <TableRow key={tp.id}>
                                                <TableCell className="font-medium">
                                                    {tp.jersey_number || idx + 1}
                                                </TableCell>
                                                <TableCell>{tp.user?.full_name}</TableCell>
                                                <TableCell className="text-sm text-muted-foreground">
                                                    {getPlayerRole(tp.role_in_team)}
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                </TableBody>
                            </Table>
                            {(!match.team2.team_players || match.team2.team_players.length === 0) && (
                                <div className="p-4 text-center text-muted-foreground">
                                    Squad not announced yet
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </TabsContent>

            {/* Head to Head Tab */}
            <TabsContent value="head-to-head">
                <Card>
                    <CardHeader>
                        <CardTitle>Head to Head</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-center py-12">
                            <Trophy className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                            <h3 className="text-lg font-semibold mb-2">Coming Soon</h3>
                            <p className="text-muted-foreground max-w-md mx-auto">
                                Historical head-to-head statistics between {match.team1.name} and{" "}
                                {match.team2.name} will be displayed here once more matches are played.
                            </p>
                        </div>
                    </CardContent>
                </Card>
            </TabsContent>
        </Tabs>
    );
}
