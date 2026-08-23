"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Card, CardContent } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
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
import { getMatch, getTeamPlayers, getScoringState } from "../../queries";
import {
    startMatch,
    recordBall,
    undoLastBall,
    setCurrentBatsmen,
    setCurrentBowler,
    endInnings,
} from "../../mutations";
import type { ExtraType, ScoringState } from "../../types";
import { createPlayerQuick } from "../../../teams/actions";
import { useAuth } from "~/lib/auth";
import type { Match, TeamPlayer } from "~/lib/match-types";

type Player = TeamPlayer;

import { toast } from "sonner";
import { ChevronLeft, Tv, Loader2, AlertCircle, Play, Undo2, UserPlus } from "lucide-react";


const DISMISSAL_TYPES = [
    { value: "bowled", label: "Bowled", needsFielder: false },
    { value: "caught", label: "Caught", needsFielder: true },
    { value: "lbw", label: "LBW", needsFielder: false },
    { value: "stumped", label: "Stumped", needsFielder: true },
    { value: "run_out", label: "Run Out", needsFielder: true },
    { value: "hit_wicket", label: "Hit Wicket", needsFielder: false },
];

function deliveryLabel(d: {
    runs_scored: number | null;
    extras: number | null;
    extra_type: string | null;
    is_wicket: boolean | null;
}): string {
    if (d.is_wicket) return "W";
    const runs = d.runs_scored ?? 0;
    switch (d.extra_type) {
        case "wide":
            return runs > 0 ? `${runs}+wd` : "wd";
        case "no_ball":
            return runs > 0 ? `${runs}+nb` : "nb";
        case "bye":
            return `${d.extras ?? 0}b`;
        case "leg_bye":
            return `${d.extras ?? 0}lb`;
        case "penalty":
            return `${d.extras ?? 0}p`;
        default:
            return String(runs);
    }
}

export default function ScoringPage() {
    const params = useParams();
    const matchId = params.id as string;
    const { user, loading: authLoading } = useAuth();

    const [match, setMatch] = useState<Match | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Players
    const [battingTeamPlayers, setBattingTeamPlayers] = useState<Player[]>([]);
    const [bowlingTeamPlayers, setBowlingTeamPlayers] = useState<Player[]>([]);

    // Current players (mirrored from database)
    const [strikerId, setStrikerId] = useState<string | null>(null);
    const [nonStrikerId, setNonStrikerId] = useState<string | null>(null);
    const [currentBowlerId, setCurrentBowlerId] = useState<string | null>(null);

    // This over's deliveries
    const [lastBalls, setLastBalls] = useState<string[]>([]);

    // UI state
    const [showTossDialog, setShowTossDialog] = useState(false);
    const [showSelectBatsmen, setShowSelectBatsmen] = useState(false);
    const [showSelectBowler, setShowSelectBowler] = useState(false);
    const [showWicketDialog, setShowWicketDialog] = useState(false);
    const [tossWinner, setTossWinner] = useState<string>("");
    const [tossDecision, setTossDecision] = useState<"bat" | "bowl">("bat");
    const [isProcessing, setIsProcessing] = useState(false);

    // Wicket dialog inputs
    const [dismissalType, setDismissalType] = useState("bowled");
    const [fielderId, setFielderId] = useState<string>("");

    // Inline "add player" while scoring ("batting" | "bowling" | null)
    const [addPlayerTarget, setAddPlayerTarget] = useState<"batting" | "bowling" | null>(null);
    const [newPlayerName, setNewPlayerName] = useState("");

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

        if (battingResult.data) setBattingTeamPlayers(battingResult.data);
        if (bowlingResult.data) setBowlingTeamPlayers(bowlingResult.data);
    };

    /** Hydrate all client-side mirrors from authoritative database state. */
    const syncFromDb = useCallback(async () => {
        const result = await getScoringState(matchId);
        if (result.error || !result.data) return;

        const { match: m, strikerId: s, nonStrikerId: ns, bowlerId: b, thisOverDeliveries } = result.data as {
            match: Match;
            strikerId: string | null;
            nonStrikerId: string | null;
            bowlerId: string | null;
            thisOverDeliveries: Array<{
                runs_scored: number | null;
                extras: number | null;
                extra_type: string | null;
                is_wicket: boolean | null;
            }>;
        };

        if (m.status === "scheduled") setShowTossDialog(true);
        if (m.status === "live") await loadPlayers(m);

        setMatch(m);
        setStrikerId(s);
        setNonStrikerId(ns);
        setCurrentBowlerId(b);
        setLastBalls(thisOverDeliveries.map(deliveryLabel));
    }, [matchId]);

    const loadMatch = useCallback(async () => {
        const result = await getMatch(matchId);
        if (result.error) {
            setError(result.error);
        } else if (result.data) {
            setMatch(result.data as Match);
            if (result.data.status === "scheduled") setShowTossDialog(true);
        }
    }, [matchId]);

    useEffect(() => {
        let cancelled = false;

        const init = async () => {
            await syncFromDb();
            if (!cancelled) setLoading(false);
        };

        void init();
        return () => {
            cancelled = true;
        };
    }, [syncFromDb]);

    const applyState = (state: ScoringState) => {
        setStrikerId(state.striker_id);
        setNonStrikerId(state.non_striker_id);

        if (state.match_completed) {
            toast.info(state.result_description ?? "Match completed");
            void loadMatch();
            return;
        }
        if (state.innings_break || state.needs_batsman) {
            setShowSelectBatsmen(true);
        } else if (state.needs_bowler) {
            // Over finished: force a fresh bowler choice instead of keeping
            // the previous over's bowler pre-selected.
            setCurrentBowlerId(null);
            setShowSelectBowler(true);
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
            await syncFromDb();
        }
        setIsProcessing(false);
    };

    const handleScore = async (
        runs: number,
        extras?: { type: string; runs: number }
    ) => {
        if (!match) return;
        if (!strikerId || !nonStrikerId || !currentBowlerId) {
            toast.warning("Select batters and a bowler before scoring.");
            return;
        }

        const currentInnings = match.innings?.find(
            (i) => i.innings_number === match.current_innings
        );
        if (!currentInnings) {
            toast.warning("No open innings to score.");
            return;
        }

        setIsProcessing(true);

        const result = await recordBall({
            matchId: match.id,
            bowlerId: currentBowlerId,
            batsmanId: strikerId,
            nonStrikerId: nonStrikerId,
            event: {
                runsScored: extras ? 0 : runs,
                extras: extras?.runs ?? 0,
                extraType: extras?.type as ExtraType | undefined,
            },
        });

        if (result.error) {
            toast.error(result.error);
            await syncFromDb();
        } else if (result.data) {
            applyState(result.data);
            await syncFromDb();
        }

        setIsProcessing(false);
    };

    const handleWicketConfirm = async () => {
        if (!match || !strikerId || !nonStrikerId || !currentBowlerId) {
            toast.warning("Select batters and a bowler first.");
            return;
        }

        const currentInnings = match.innings?.find(
            (i) => i.innings_number === match.current_innings
        );
        if (!currentInnings) return;

        const dismissal = DISMISSAL_TYPES.find((d) => d.value === dismissalType);
        const needsFielder = dismissal?.needsFielder && fielderId;

        setIsProcessing(true);

        const result = await recordBall({
            matchId: match.id,
            bowlerId: currentBowlerId,
            batsmanId: strikerId,
            nonStrikerId: nonStrikerId,
            event: {
                runsScored: 0,
                extras: 0,
                isWicket: true,
                dismissalType,
                fielderId: needsFielder ? fielderId : null,
            },
        });

        if (result.error) {
            toast.error(result.error);
            await syncFromDb();
        } else if (result.data) {
            applyState(result.data);
            await syncFromDb();
        }

        setShowWicketDialog(false);
        setDismissalType("bowled");
        setFielderId("");
        setIsProcessing(false);
    };

    const handleUndo = async () => {
        setIsProcessing(true);
        const result = await undoLastBall(matchId);
        if (result.error) {
            toast.error(result.error);
        } else if (result.data) {
            applyState(result.data);
            toast.success("Last ball undone");
        }
        await syncFromDb();
        setIsProcessing(false);
    };

    const handleConfirmBatsmen = async () => {
        if (!strikerId || !nonStrikerId) return;
        setIsProcessing(true);
        const result = await setCurrentBatsmen(matchId, strikerId, nonStrikerId);
        if (result.error) {
            toast.error(result.error);
        } else {
            setShowSelectBatsmen(false);
            if (!currentBowlerId) setShowSelectBowler(true);
            await syncFromDb();
        }
        setIsProcessing(false);
    };

    const handleConfirmBowler = async () => {
        if (!currentBowlerId) return;
        setIsProcessing(true);
        const result = await setCurrentBowler(matchId, currentBowlerId);
        if (result.error) {
            toast.error(result.error);
        } else {
            setShowSelectBowler(false);
            await syncFromDb();
        }
        setIsProcessing(false);
    };

    const handleAddPlayerInline = async () => {
        if (!addPlayerTarget || !newPlayerName.trim() || !match) return;

        const currentInnings = match.innings?.find(
            (i) => i.innings_number === match.current_innings
        );
        const battingTeamId = currentInnings?.team_id;
        const targetTeamId =
            addPlayerTarget === "batting" ? battingTeamId : battingTeamId === match.team1_id ? match.team2_id : match.team1_id;
        if (!targetTeamId) return;

        setIsProcessing(true);
        const result = await createPlayerQuick(targetTeamId, newPlayerName.trim());
        if (result.error || !result.data) {
            toast.error(result.error ?? "Could not add player");
        } else {
            const newPlayer: Player = {
                id: result.data.user_id,
                team_id: targetTeamId,
                user_id: result.data.user_id,
                user: { id: result.data.user_id, full_name: result.data.full_name },
            };
            if (addPlayerTarget === "batting") {
                setBattingTeamPlayers((prev) => [...prev, newPlayer]);
                if (!strikerId) setStrikerId(newPlayer.user_id);
                else if (!nonStrikerId) setNonStrikerId(newPlayer.user_id);
            } else {
                setBowlingTeamPlayers((prev) => [...prev, newPlayer]);
                if (!currentBowlerId) setCurrentBowlerId(newPlayer.user_id);
            }
            toast.success(`${result.data.full_name} added to squad`);
            setNewPlayerName("");
        }
        setIsProcessing(false);
    };

    const handleEndInnings = async () => {
        setIsProcessing(true);
        const result = await endInnings(matchId);
        if (result.error) {
            toast.error(result.error);
        } else if (result.data) {
            applyState(result.data);
        }
        await syncFromDb();
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
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
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

    // Scoring authorization: creator or listed match admin.
    const isScorer =
        !!user &&
        (match.created_by === user.id || (match.match_admins ?? []).includes(user.id));

    // Real performance numbers straight from the database.
    const strikerPerf = currentInnings?.batting_performances?.find(
        (p) => p.user_id === strikerId && p.is_current_batsman
    );
    const nonStrikerPerf = currentInnings?.batting_performances?.find(
        (p) => p.user_id === nonStrikerId && p.is_current_batsman
    );
    const bowlerPerf = currentInnings?.bowling_performances?.find(
        (p) => p.user_id === currentBowlerId && p.is_current_bowler
    );

    const crr =
        currentInnings && (currentInnings.total_balls ?? 0) > 0
            ? ((currentInnings.total_runs ?? 0) * 6) / (currentInnings.total_balls ?? 1)
            : null;

    return (
        <div className="min-h-screen bg-background">
            {/* Header */}
            <div className="border-b border-border bg-card sticky top-16 z-20">
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
                            <Badge variant="live">LIVE</Badge>
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
            <div className="border-b border-border bg-muted/40 py-5">
                <div className="container mx-auto px-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-lg bg-secondary flex items-center justify-center text-secondary-foreground font-bold text-sm tracking-wide">
                                {battingTeam?.short_name || battingTeam?.name.substring(0, 3).toUpperCase()}
                            </div>
                            <div>
                                <p className="font-semibold text-lg">{battingTeam?.name}</p>
                                <p className="text-xs text-muted-foreground">Batting</p>
                            </div>
                        </div>
                        <div className="text-center">
                            <p className="text-4xl font-bold tabular-nums">
                                {currentInnings?.total_runs || 0}/{currentInnings?.total_wickets || 0}
                            </p>
                            <p className="text-sm text-muted-foreground tabular-nums">
                                ({match.current_over}.{match.current_ball} / {match.overs_per_innings} ov)
                            </p>
                            {currentInnings?.target_runs && (
                                <p className="text-sm text-primary font-medium tabular-nums">
                                    Need {currentInnings.target_runs - (currentInnings.total_runs || 0)} more to win
                                </p>
                            )}
                        </div>
                        <div className="text-right">
                            <p className="text-sm text-muted-foreground">vs {bowlingTeam?.name}</p>
                            <p className="text-lg font-semibold tabular-nums">
                                CRR: {crr !== null ? crr.toFixed(2) : "—"}
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Main Content */}
            <div className="container mx-auto px-4 py-6">
                {!isScorer && (
                    <div className="mb-6 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm">
                        <p className="font-medium text-amber-700 dark:text-amber-300">
                            View-only scoring
                        </p>
                        <p className="text-muted-foreground">
                            Only the match creator and match admins can score. You are signed in
                            as a different account — ask the creator to add you, or create your
                            own match to test scoring.
                        </p>
                    </div>
                )}
                <div className="grid lg:grid-cols-3 gap-6">
                    {/* Left Column - Batsmen & Bowler */}
                    <div className="space-y-4">
                        <CurrentBatsmen
                            batsman1={
                                strikerId
                                    ? {
                                        id: strikerId,
                                        name: getPlayerName(strikerId, battingTeamPlayers) || "",
                                        runs: strikerPerf?.runs_scored ?? 0,
                                        balls: strikerPerf?.balls_faced ?? 0,
                                        fours: strikerPerf?.fours ?? 0,
                                        sixes: strikerPerf?.sixes ?? 0,
                                        isStriker: true,
                                    }
                                    : null
                            }
                            batsman2={
                                nonStrikerId
                                    ? {
                                        id: nonStrikerId,
                                        name: getPlayerName(nonStrikerId, battingTeamPlayers) || "",
                                        runs: nonStrikerPerf?.runs_scored ?? 0,
                                        balls: nonStrikerPerf?.balls_faced ?? 0,
                                        fours: nonStrikerPerf?.fours ?? 0,
                                        sixes: nonStrikerPerf?.sixes ?? 0,
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
                                        overs: bowlerPerf?.overs_bowled ?? 0,
                                        maidens: bowlerPerf?.maidens ?? 0,
                                        runs: bowlerPerf?.runs_conceded ?? 0,
                                        wickets: bowlerPerf?.wickets_taken ?? 0,
                                    }
                                    : null
                            }
                            onChangeBowler={() => setShowSelectBowler(true)}
                        />
                    </div>

                    {/* Center Column - Scoring Panel */}
                    <div className="lg:col-span-2 space-y-4">
                        <ScoringPanel
                            onScore={handleScore}
                            onWicket={() => setShowWicketDialog(true)}
                            onUndo={handleUndo}
                            currentOver={match.current_over}
                            currentBall={match.current_ball}
                            lastBalls={lastBalls}
                            disabled={
                                !isScorer ||
                                !strikerId ||
                                !nonStrikerId ||
                                !currentBowlerId ||
                                isProcessing
                            }
                        />

                        {!strikerId || !nonStrikerId ? (
                            <p className="text-sm text-muted-foreground">
                                Waiting for batters — open the batter selection to continue.
                            </p>
                        ) : !currentBowlerId ? (
                            <p className="text-sm text-muted-foreground">
                                Select a bowler to start the next over.
                            </p>
                        ) : null}

                        <div className="flex gap-3">
                            <Button
                                variant="outline"
                                className="flex-1"
                                onClick={handleUndo}
                                disabled={
                                    !isScorer ||
                                    isProcessing ||
                                    (currentInnings?.total_balls ?? 0) === 0
                                }
                            >
                                <Undo2 className="h-4 w-4 mr-2" />
                                Undo Last Ball
                            </Button>
                            <Button
                                variant="outline"
                                className="flex-1"
                                onClick={handleEndInnings}
                                disabled={
                                    !isScorer ||
                                    isProcessing ||
                                    !currentInnings ||
                                    currentInnings.is_completed
                                }
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
                                            ? "border-primary bg-primary/10"
                                            : "border-border"
                                        }`}
                                >
                                    Bat
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setTossDecision("bowl")}
                                    className={`p-4 rounded-lg border-2 transition-colors ${tossDecision === "bowl"
                                            ? "border-primary bg-primary/10"
                                            : "border-border"
                                        }`}
                                >
                                    Bowl
                                </button>
                            </div>
                        </div>
                        <Button
                            className="w-full"
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
                        <DialogTitle>Select Batsmen</DialogTitle>
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
                            {battingTeamPlayers.length === 0 && (
                                <p className="mt-2 text-xs text-muted-foreground">
                                    Squad is empty — add players below.
                                </p>
                            )}
                        </div>

                        {addPlayerTarget === "batting" ? (
                            <div className="flex gap-2">
                                <Input
                                    placeholder="Player name"
                                    value={newPlayerName}
                                    onChange={(e) => setNewPlayerName(e.target.value)}
                                    autoFocus
                                    onKeyDown={(e) =>
                                        e.key === "Enter" && void handleAddPlayerInline()
                                    }
                                />
                                <Button
                                    type="button"
                                    variant="secondary"
                                    onClick={() => void handleAddPlayerInline()}
                                    disabled={!newPlayerName.trim() || isProcessing}
                                >
                                    Add
                                </Button>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => {
                                        setAddPlayerTarget(null);
                                        setNewPlayerName("");
                                    }}
                                >
                                    ✕
                                </Button>
                            </div>
                        ) : (
                            <button
                                type="button"
                                onClick={() => {
                                    setAddPlayerTarget("batting");
                                    setNewPlayerName("");
                                }}
                                className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
                            >
                                <UserPlus className="h-3.5 w-3.5" />
                                New player not on a team? Add to squad
                            </button>
                        )}

                        <Button
                            className="w-full"
                            onClick={handleConfirmBatsmen}
                            disabled={!strikerId || !nonStrikerId || isProcessing}
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
                        {bowlingTeamPlayers.length === 0 && (
                            <p className="text-xs text-muted-foreground">
                                Squad is empty — add players below.
                            </p>
                        )}

                        {addPlayerTarget === "bowling" ? (
                            <div className="flex gap-2">
                                <Input
                                    placeholder="Player name"
                                    value={newPlayerName}
                                    onChange={(e) => setNewPlayerName(e.target.value)}
                                    autoFocus
                                    onKeyDown={(e) =>
                                        e.key === "Enter" && void handleAddPlayerInline()
                                    }
                                />
                                <Button
                                    type="button"
                                    variant="secondary"
                                    onClick={() => void handleAddPlayerInline()}
                                    disabled={!newPlayerName.trim() || isProcessing}
                                >
                                    Add
                                </Button>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => {
                                        setAddPlayerTarget(null);
                                        setNewPlayerName("");
                                    }}
                                >
                                    ✕
                                </Button>
                            </div>
                        ) : (
                            <button
                                type="button"
                                onClick={() => {
                                    setAddPlayerTarget("bowling");
                                    setNewPlayerName("");
                                }}
                                className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
                            >
                                <UserPlus className="h-3.5 w-3.5" />
                                New player not on a team? Add to squad
                            </button>
                        )}

                        <Button
                            className="w-full"
                            onClick={handleConfirmBowler}
                            disabled={!currentBowlerId || isProcessing}
                        >
                            Confirm
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Wicket Dialog */}
            <Dialog open={showWicketDialog} onOpenChange={setShowWicketDialog}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Record Wicket</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 pt-4">
                        <div>
                            <label className="text-sm font-medium">How was {getPlayerName(strikerId, battingTeamPlayers)} out?</label>
                            <Select value={dismissalType} onValueChange={setDismissalType}>
                                <SelectTrigger className="mt-2">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {DISMISSAL_TYPES.map((d) => (
                                        <SelectItem key={d.value} value={d.value}>
                                            {d.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        {DISMISSAL_TYPES.find((d) => d.value === dismissalType)?.needsFielder && (
                            <div>
                                <label className="text-sm font-medium">Fielder</label>
                                <Select value={fielderId} onValueChange={setFielderId}>
                                    <SelectTrigger className="mt-2">
                                        <SelectValue placeholder="Select fielder" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {bowlingTeamPlayers.map((player) => (
                                            <SelectItem key={player.user_id} value={player.user_id}>
                                                {player.user?.full_name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        )}
                        <Button
                            variant="destructive"
                            className="w-full"
                            onClick={handleWicketConfirm}
                            disabled={isProcessing ||
                                (DISMISSAL_TYPES.find((d) => d.value === dismissalType)?.needsFielder && !fielderId)}
                        >
                            Confirm Wicket
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
