"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "~/components/ui/dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "~/components/ui/select";
import { ScoringPanel } from "~/components/matches/scoring-panel";
import { CurrentBatsmen } from "~/components/matches/current-batsmen";
import { CurrentBowler } from "~/components/matches/current-bowler";
import {
    getMatch,
    getTeamPlayers,
    startMatch,
    recordBall,
    endOver,
    endInnings,
} from "../../actions";
import { useAuth } from "~/lib/auth";
import { ChevronLeft, Tv, Loader2, AlertCircle, Play } from "lucide-react";

interface Player {
    user_id: string;
    user: {
        id: string;
        full_name: string;
    };
    jersey_number?: number;
    batting_order?: number;
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
}

interface Team {
    id: string;
    name: string;
    short_name?: string;
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
    toss_winner_team_id?: string;
    toss_decision?: string;
    team1_id: string;
    team2_id: string;
    team1: Team;
    team2: Team;
    innings: Innings[];
}

export default function ScoringPage() {
    const params = useParams();
    const router = useRouter();
    const matchId = params.id as string;
    const { user, loading: authLoading } = useAuth();

    const [match, setMatch] = useState<Match | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Players
    const [battingTeamPlayers, setBattingTeamPlayers] = useState<Player[]>([]);
    const [bowlingTeamPlayers, setBowlingTeamPlayers] = useState<Player[]>([]);

    // Current players
    const [strikerId, setStrikerId] = useState<string | null>(null);
    const [nonStrikerId, setNonStrikerId] = useState<string | null>(null);
    const [currentBowlerId, setCurrentBowlerId] = useState<string | null>(null);

    // UI state
    const [showTossDialog, setShowTossDialog] = useState(false);
    const [showSelectBatsmen, setShowSelectBatsmen] = useState(false);
    const [showSelectBowler, setShowSelectBowler] = useState(false);
    const [showWicketDialog, setShowWicketDialog] = useState(false);
    const [tossWinner, setTossWinner] = useState<string>("");
    const [tossDecision, setTossDecision] = useState<"bat" | "bowl">("bat");
    const [lastBalls, setLastBalls] = useState<string[]>([]);
    const [isProcessing, setIsProcessing] = useState(false);

    useEffect(() => {
        loadMatch();
    }, [matchId]);

    const loadMatch = async () => {
        const result = await getMatch(matchId);
        if (result.error) {
            setError(result.error);
        } else if (result.data) {
            setMatch(result.data as Match);

            // If match is scheduled, show toss dialog
            if (result.data.status === "scheduled") {
                setShowTossDialog(true);
            } else if (result.data.status === "live") {
                // Load players for current innings
                await loadPlayers(result.data as Match);
            }
        }
        setLoading(false);
    };

    const loadPlayers = async (matchData: Match) => {
        const currentInnings = matchData.innings?.find(
            (i) => i.innings_number === matchData.current_innings
        );

        if (!currentInnings) return;

        const battingTeamId = currentInnings.team_id;
        const bowlingTeamId =
            battingTeamId === matchData.team1_id
                ? matchData.team2_id
                : matchData.team1_id;

        const [battingResult, bowlingResult] = await Promise.all([
            getTeamPlayers(battingTeamId),
            getTeamPlayers(bowlingTeamId),
        ]);

        if (battingResult.data) {
            setBattingTeamPlayers(battingResult.data);
        }
        if (bowlingResult.data) {
            setBowlingTeamPlayers(bowlingResult.data);
        }
    };

    const handleStartMatch = async () => {
        if (!tossWinner) return;
        setIsProcessing(true);

        const result = await startMatch(matchId, tossWinner, tossDecision);
        if (result.error) {
            setError(result.error);
        } else {
            setShowTossDialog(false);
            setShowSelectBatsmen(true);
            await loadMatch();
        }
        setIsProcessing(false);
    };

    const handleScore = async (runs: number, extras?: { type: string; runs: number }) => {
        if (!match || !strikerId || !nonStrikerId || !currentBowlerId) return;

        const currentInnings = match.innings?.find(
            (i) => i.innings_number === match.current_innings
        );
        if (!currentInnings) return;

        setIsProcessing(true);

        const ballData = {
            matchId: match.id,
            inningsId: currentInnings.id,
            overNumber: match.current_over,
            ballNumber: match.current_ball + 1,
            bowlerId: currentBowlerId,
            batsmanId: strikerId,
            nonStrikerId: nonStrikerId,
            runsScored: extras ? 0 : runs,
            extras: extras?.runs,
            extraType: extras?.type as "wide" | "no_ball" | "bye" | "leg_bye" | undefined,
        };

        const result = await recordBall(ballData);

        if (!result.error) {
            // Update last balls display
            let ballDisplay = runs.toString();
            if (runs === 4) ballDisplay = "4";
            if (runs === 6) ballDisplay = "6";
            if (extras) ballDisplay = `${extras.runs}${extras.type === "wide" ? "wd" : "nb"}`;

            setLastBalls((prev) => [...prev.slice(-5), ballDisplay]);

            // Swap striker if odd runs
            if (runs % 2 === 1) {
                const temp = strikerId;
                setStrikerId(nonStrikerId);
                setNonStrikerId(temp);
            }

            // Check if over complete
            const isLegal = !extras || !["wide", "no_ball"].includes(extras.type);
            if (isLegal && match.current_ball + 1 >= 6) {
                // End of over - swap strikers
                const temp = strikerId;
                setStrikerId(nonStrikerId);
                setNonStrikerId(temp);
                setLastBalls([]);
                setShowSelectBowler(true);
            }

            await loadMatch();
        }

        setIsProcessing(false);
    };

    const handleWicket = () => {
        setShowWicketDialog(true);
    };

    const handleEndOver = async () => {
        if (!currentBowlerId) return;
        setIsProcessing(true);

        // Swap strikers at end of over
        const temp = strikerId;
        setStrikerId(nonStrikerId);
        setNonStrikerId(temp);

        await endOver(matchId, "");
        setLastBalls([]);
        setShowSelectBowler(true);
        await loadMatch();

        setIsProcessing(false);
    };

    const handleEndInnings = async () => {
        setIsProcessing(true);
        await endInnings(matchId);
        await loadMatch();

        // Reset for new innings
        setStrikerId(null);
        setNonStrikerId(null);
        setCurrentBowlerId(null);
        setLastBalls([]);
        setShowSelectBatsmen(true);

        setIsProcessing(false);
    };

    const getCurrentInnings = () => {
        return match?.innings?.find((i) => i.innings_number === match.current_innings);
    };

    const getBattingTeam = () => {
        const innings = getCurrentInnings();
        if (!innings) return null;
        return innings.team_id === match?.team1_id ? match?.team1 : match?.team2;
    };

    const getBowlingTeam = () => {
        const innings = getCurrentInnings();
        if (!innings) return null;
        return innings.team_id === match?.team1_id ? match?.team2 : match?.team1;
    };

    const getPlayerName = (playerId: string | null, players: Player[]) => {
        if (!playerId) return null;
        return players.find((p) => p.user_id === playerId)?.user?.full_name || "Unknown";
    };

    if (authLoading || loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-cricket-primary" />
            </div>
        );
    }

    if (!user) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <Card className="max-w-md w-full mx-4">
                    <CardContent className="p-6 text-center">
                        <AlertCircle className="h-12 w-12 text-yellow-500 mx-auto mb-4" />
                        <h2 className="text-xl font-semibold mb-2">Sign in required</h2>
                        <p className="text-muted-foreground mb-4">
                            You need to be signed in to score a match.
                        </p>
                        <Button asChild>
                            <Link href="/auth/login">Sign In</Link>
                        </Button>
                    </CardContent>
                </Card>
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

    const currentInnings = getCurrentInnings();
    const battingTeam = getBattingTeam();
    const bowlingTeam = getBowlingTeam();

    return (
        <div className="min-h-screen bg-background">
            {/* Header */}
            <div className="border-b border-border/50 bg-card/50 backdrop-blur sticky top-0 z-20">
                <div className="container mx-auto px-4 py-3">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <Button variant="ghost" size="sm" asChild>
                                <Link href={`/matches/${match.id}`}>
                                    <ChevronLeft className="h-4 w-4 mr-1" />
                                    Back
                                </Link>
                            </Button>
                            <div>
                                <h1 className="font-semibold text-foreground">{match.title}</h1>
                                <p className="text-xs text-muted-foreground">
                                    {match.match_format} • {match.overs_per_innings} overs
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <Badge className="bg-red-500/10 text-red-500 border-red-500/20 animate-pulse">
                                🔴 LIVE
                            </Badge>
                            <Button variant="outline" size="sm" asChild>
                                <Link href={`/overlay/${match.id}`} target="_blank">
                                    <Tv className="h-4 w-4 mr-1" />
                                    Overlay
                                </Link>
                            </Button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Score Display */}
            <div className="bg-gradient-to-r from-cricket-primary/10 via-background to-cricket-secondary/10 py-6 border-b">
                <div className="container mx-auto px-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-full bg-cricket-primary flex items-center justify-center text-white font-bold">
                                {battingTeam?.short_name?.substring(0, 2) || battingTeam?.name.substring(0, 2)}
                            </div>
                            <div>
                                <p className="font-semibold text-lg">{battingTeam?.name}</p>
                                <p className="text-xs text-muted-foreground">Batting</p>
                            </div>
                        </div>
                        <div className="text-center">
                            <p className="text-4xl font-bold text-foreground">
                                {currentInnings?.total_runs || 0}/{currentInnings?.total_wickets || 0}
                            </p>
                            <p className="text-sm text-muted-foreground">
                                ({match.current_over}.{match.current_ball} overs)
                            </p>
                            {currentInnings?.target_runs && (
                                <p className="text-sm text-cricket-primary font-medium">
                                    Need {currentInnings.target_runs - (currentInnings.total_runs || 0)} runs
                                </p>
                            )}
                        </div>
                        <div className="text-right">
                            <p className="text-sm text-muted-foreground">vs {bowlingTeam?.name}</p>
                            <p className="text-lg font-semibold">
                                CRR: {currentInnings && currentInnings.total_overs > 0
                                    ? (currentInnings.total_runs / currentInnings.total_overs).toFixed(2)
                                    : "0.00"}
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Main Content */}
            <div className="container mx-auto px-4 py-6">
                <div className="grid lg:grid-cols-3 gap-6">
                    {/* Left Column - Batsmen & Bowler */}
                    <div className="space-y-4">
                        <CurrentBatsmen
                            batsman1={
                                strikerId
                                    ? {
                                        id: strikerId,
                                        name: getPlayerName(strikerId, battingTeamPlayers) || "",
                                        runs: 0,
                                        balls: 0,
                                        fours: 0,
                                        sixes: 0,
                                        isStriker: true,
                                    }
                                    : null
                            }
                            batsman2={
                                nonStrikerId
                                    ? {
                                        id: nonStrikerId,
                                        name: getPlayerName(nonStrikerId, battingTeamPlayers) || "",
                                        runs: 0,
                                        balls: 0,
                                        fours: 0,
                                        sixes: 0,
                                        isStriker: false,
                                    }
                                    : null
                            }
                            onSwapStriker={() => {
                                const temp = strikerId;
                                setStrikerId(nonStrikerId);
                                setNonStrikerId(temp);
                            }}
                            onSelectNewBatsman={() => setShowSelectBatsmen(true)}
                        />

                        <CurrentBowler
                            bowler={
                                currentBowlerId
                                    ? {
                                        id: currentBowlerId,
                                        name: getPlayerName(currentBowlerId, bowlingTeamPlayers) || "",
                                        overs: 0,
                                        maidens: 0,
                                        runs: 0,
                                        wickets: 0,
                                    }
                                    : null
                            }
                            onChangeBowler={() => setShowSelectBowler(true)}
                        />
                    </div>

                    {/* Center Column - Scoring Panel */}
                    <div className="lg:col-span-2">
                        <ScoringPanel
                            onScore={handleScore}
                            onWicket={handleWicket}
                            currentOver={match.current_over}
                            currentBall={match.current_ball}
                            lastBalls={lastBalls}
                            disabled={!strikerId || !nonStrikerId || !currentBowlerId || isProcessing}
                        />

                        {/* Quick Actions */}
                        <div className="flex gap-3 mt-4">
                            <Button
                                variant="outline"
                                className="flex-1"
                                onClick={handleEndOver}
                                disabled={isProcessing}
                            >
                                End Over
                            </Button>
                            <Button
                                variant="outline"
                                className="flex-1"
                                onClick={handleEndInnings}
                                disabled={isProcessing}
                            >
                                End Innings
                            </Button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Toss Dialog */}
            <Dialog open={showTossDialog} onOpenChange={setShowTossDialog}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Toss</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 pt-4">
                        <div>
                            <label className="text-sm font-medium">Who won the toss?</label>
                            <Select value={tossWinner} onValueChange={setTossWinner}>
                                <SelectTrigger className="mt-2">
                                    <SelectValue placeholder="Select team" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value={match.team1_id}>{match.team1.name}</SelectItem>
                                    <SelectItem value={match.team2_id}>{match.team2.name}</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <label className="text-sm font-medium">Elected to</label>
                            <div className="grid grid-cols-2 gap-3 mt-2">
                                <button
                                    type="button"
                                    onClick={() => setTossDecision("bat")}
                                    className={`p-4 rounded-lg border-2 transition-colors ${tossDecision === "bat"
                                            ? "border-cricket-primary bg-cricket-primary/10"
                                            : "border-border"
                                        }`}
                                >
                                    🏏 Bat
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setTossDecision("bowl")}
                                    className={`p-4 rounded-lg border-2 transition-colors ${tossDecision === "bowl"
                                            ? "border-cricket-primary bg-cricket-primary/10"
                                            : "border-border"
                                        }`}
                                >
                                    ⚾ Bowl
                                </button>
                            </div>
                        </div>
                        <Button
                            className="w-full bg-cricket-primary hover:bg-cricket-primary/90"
                            onClick={handleStartMatch}
                            disabled={!tossWinner || isProcessing}
                        >
                            {isProcessing ? (
                                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                            ) : (
                                <Play className="h-4 w-4 mr-2" />
                            )}
                            Start Match
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Select Batsmen Dialog */}
            <Dialog open={showSelectBatsmen} onOpenChange={setShowSelectBatsmen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Select Opening Batsmen</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 pt-4">
                        <div>
                            <label className="text-sm font-medium">Striker</label>
                            <Select value={strikerId || ""} onValueChange={setStrikerId}>
                                <SelectTrigger className="mt-2">
                                    <SelectValue placeholder="Select striker" />
                                </SelectTrigger>
                                <SelectContent>
                                    {battingTeamPlayers
                                        .filter((p) => p.user_id !== nonStrikerId)
                                        .map((player) => (
                                            <SelectItem key={player.user_id} value={player.user_id}>
                                                {player.user?.full_name}
                                                {player.jersey_number && ` (#${player.jersey_number})`}
                                            </SelectItem>
                                        ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <label className="text-sm font-medium">Non-Striker</label>
                            <Select value={nonStrikerId || ""} onValueChange={setNonStrikerId}>
                                <SelectTrigger className="mt-2">
                                    <SelectValue placeholder="Select non-striker" />
                                </SelectTrigger>
                                <SelectContent>
                                    {battingTeamPlayers
                                        .filter((p) => p.user_id !== strikerId)
                                        .map((player) => (
                                            <SelectItem key={player.user_id} value={player.user_id}>
                                                {player.user?.full_name}
                                                {player.jersey_number && ` (#${player.jersey_number})`}
                                            </SelectItem>
                                        ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <Button
                            className="w-full"
                            onClick={() => {
                                setShowSelectBatsmen(false);
                                if (!currentBowlerId) {
                                    setShowSelectBowler(true);
                                }
                            }}
                            disabled={!strikerId || !nonStrikerId}
                        >
                            Confirm
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Select Bowler Dialog */}
            <Dialog open={showSelectBowler} onOpenChange={setShowSelectBowler}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Select Bowler</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 pt-4">
                        <Select value={currentBowlerId || ""} onValueChange={setCurrentBowlerId}>
                            <SelectTrigger>
                                <SelectValue placeholder="Select bowler" />
                            </SelectTrigger>
                            <SelectContent>
                                {bowlingTeamPlayers.map((player) => (
                                    <SelectItem key={player.user_id} value={player.user_id}>
                                        {player.user?.full_name}
                                        {player.jersey_number && ` (#${player.jersey_number})`}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <Button
                            className="w-full"
                            onClick={() => setShowSelectBowler(false)}
                            disabled={!currentBowlerId}
                        >
                            Confirm
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
