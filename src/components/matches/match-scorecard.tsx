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
import { Badge } from "~/components/ui/badge";

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
    fall_of_wickets?: FallOfWicket[];
}

interface FallOfWicket {
    id: string;
    wicket_number: number;
    runs_at_wicket: number;
    overs_at_wicket: number;
    batsman?: { id: string; full_name: string };
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

interface MatchScorecardProps {
    match: Match;
}

export function MatchScorecard({ match }: MatchScorecardProps) {
    const getTeamName = (teamId: string) => {
        return teamId === match.team1_id ? match.team1.name : match.team2.name;
    };

    const formatOvers = (overs: number) => {
        const fullOvers = Math.floor(overs);
        const balls = Math.round((overs - fullOvers) * 10);
        return `${fullOvers}.${balls}`;
    };

    const calculateStrikeRate = (runs: number, balls: number) => {
        if (balls === 0) return "0.00";
        return ((runs / balls) * 100).toFixed(2);
    };

    const calculateEconomy = (runs: number, overs: number) => {
        if (overs === 0) return "0.00";
        return (runs / overs).toFixed(2);
    };

    const sortedInnings = [...(match.innings || [])].sort(
        (a, b) => a.innings_number - b.innings_number
    );

    if (sortedInnings.length === 0) {
        return (
            <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                    No innings data available yet
                </CardContent>
            </Card>
        );
    }

    return (
        <Tabs defaultValue={`innings-${sortedInnings[0]?.innings_number}`} className="w-full">
            <TabsList className="w-full justify-start mb-4">
                {sortedInnings.map((innings) => (
                    <TabsTrigger
                        key={innings.id}
                        value={`innings-${innings.innings_number}`}
                        className="flex-1 max-w-[200px]"
                    >
                        {getTeamName(innings.team_id)} - {innings.total_runs}/{innings.total_wickets}
                    </TabsTrigger>
                ))}
            </TabsList>

            {sortedInnings.map((innings) => (
                <TabsContent key={innings.id} value={`innings-${innings.innings_number}`}>
                    <div className="space-y-6">
                        {/* Innings Header */}
                        <Card>
                            <CardHeader className="pb-2">
                                <div className="flex items-center justify-between">
                                    <CardTitle>{getTeamName(innings.team_id)} Innings</CardTitle>
                                    <div className="text-right">
                                        <div className="text-3xl font-bold">
                                            {innings.total_runs}/{innings.total_wickets}
                                        </div>
                                        <div className="text-sm text-muted-foreground">
                                            ({formatOvers(innings.total_overs)} overs)
                                        </div>
                                    </div>
                                </div>
                            </CardHeader>
                        </Card>

                        {/* Batting Card */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-lg">Batting</CardTitle>
                            </CardHeader>
                            <CardContent className="p-0">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead className="w-[200px]">Batter</TableHead>
                                            <TableHead className="text-center">R</TableHead>
                                            <TableHead className="text-center">B</TableHead>
                                            <TableHead className="text-center">4s</TableHead>
                                            <TableHead className="text-center">6s</TableHead>
                                            <TableHead className="text-center">SR</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {(innings.batting_performances || [])
                                            .sort((a, b) => b.runs_scored - a.runs_scored)
                                            .map((bp) => (
                                                <TableRow key={bp.id}>
                                                    <TableCell>
                                                        <div>
                                                            <span className="font-medium">
                                                                {bp.user?.full_name}
                                                                {bp.is_not_out && (
                                                                    <Badge variant="outline" className="ml-2 text-xs">
                                                                        not out
                                                                    </Badge>
                                                                )}
                                                            </span>
                                                            {bp.dismissal_type && (
                                                                <p className="text-xs text-muted-foreground">
                                                                    {bp.dismissal_type}
                                                                </p>
                                                            )}
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="text-center font-semibold">
                                                        {bp.runs_scored}
                                                    </TableCell>
                                                    <TableCell className="text-center">{bp.balls_faced}</TableCell>
                                                    <TableCell className="text-center">{bp.fours}</TableCell>
                                                    <TableCell className="text-center">{bp.sixes}</TableCell>
                                                    <TableCell className="text-center">
                                                        {calculateStrikeRate(bp.runs_scored, bp.balls_faced)}
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                    </TableBody>
                                </Table>
                            </CardContent>
                        </Card>

                        {/* Extras */}
                        <Card>
                            <CardContent className="py-3">
                                <div className="flex items-center justify-between">
                                    <span className="text-muted-foreground">Extras</span>
                                    <div className="flex items-center gap-4">
                                        <span className="font-semibold">{innings.extras_total || 0}</span>
                                        <span className="text-sm text-muted-foreground">
                                            (wd {innings.extras_wides || 0}, nb {innings.extras_no_balls || 0},
                                            b {innings.extras_byes || 0}, lb {innings.extras_leg_byes || 0})
                                        </span>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Bowling Card */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-lg">Bowling</CardTitle>
                            </CardHeader>
                            <CardContent className="p-0">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead className="w-[200px]">Bowler</TableHead>
                                            <TableHead className="text-center">O</TableHead>
                                            <TableHead className="text-center">M</TableHead>
                                            <TableHead className="text-center">R</TableHead>
                                            <TableHead className="text-center">W</TableHead>
                                            <TableHead className="text-center">Econ</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {(innings.bowling_performances || [])
                                            .sort((a, b) => b.wickets_taken - a.wickets_taken)
                                            .map((bp) => (
                                                <TableRow key={bp.id}>
                                                    <TableCell className="font-medium">
                                                        {bp.user?.full_name}
                                                    </TableCell>
                                                    <TableCell className="text-center">{bp.overs_bowled}</TableCell>
                                                    <TableCell className="text-center">{bp.maidens}</TableCell>
                                                    <TableCell className="text-center">{bp.runs_conceded}</TableCell>
                                                    <TableCell className="text-center font-semibold">
                                                        {bp.wickets_taken}
                                                    </TableCell>
                                                    <TableCell className="text-center">
                                                        {calculateEconomy(bp.runs_conceded, bp.overs_bowled)}
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                    </TableBody>
                                </Table>
                            </CardContent>
                        </Card>

                        {/* Fall of Wickets */}
                        {innings.fall_of_wickets && innings.fall_of_wickets.length > 0 && (
                            <Card>
                                <CardHeader>
                                    <CardTitle className="text-lg">Fall of Wickets</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="flex flex-wrap gap-3">
                                        {innings.fall_of_wickets
                                            .sort((a, b) => a.wicket_number - b.wicket_number)
                                            .map((fow) => (
                                                <Badge
                                                    key={fow.id}
                                                    variant="outline"
                                                    className="text-sm py-1 px-3"
                                                >
                                                    {fow.runs_at_wicket}/{fow.wicket_number} ({fow.batsman?.full_name},{" "}
                                                    {formatOvers(fow.overs_at_wicket)} ov)
                                                </Badge>
                                            ))}
                                    </div>
                                </CardContent>
                            </Card>
                        )}
                    </div>
                </TabsContent>
            ))}
        </Tabs>
    );
}
