"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Button } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { ScoringPanel } from "~/components/matches/scoring-panel";
import { CurrentBatsmen } from "~/components/matches/current-batsmen";
import { CurrentBowler } from "~/components/matches/current-bowler";
import { TossDialog } from "./components/TossDialog";
import { BatsmenDialog } from "./components/BatsmenDialog";
import { BowlerDialog } from "./components/BowlerDialog";
import { WicketDialog } from "./components/WicketDialog";
import { AddPlayerDialog } from "./components/AddPlayerDialog";
import { PotmDialog } from "./components/PotmDialog";
import { useScoring } from "./useScoring";
import { useAuth } from "~/lib/auth";
import { toast } from "sonner";
import {
  ChevronLeft,
  Tv,
  Loader2,
  AlertCircle,
  Undo2,
  UserPlus,
  Users,
  Award,
} from "lucide-react";

const DISMISSAL_TYPES = [
  { value: "bowled", label: "Bowled", needsFielder: false },
  { value: "caught", label: "Caught", needsFielder: true },
  { value: "lbw", label: "LBW", needsFielder: false },
  { value: "stumped", label: "Stumped", needsFielder: true },
  { value: "run_out", label: "Run Out", needsFielder: true },
  { value: "hit_wicket", label: "Hit Wicket", needsFielder: false },
];

export default function ScoringPage() {
  const params = useParams();
  const matchId = params.id as string;
  const { user } = useAuth();

  const {
    match,
    loading,
    error,
    battingTeamPlayers,
    bowlingTeamPlayers,
    strikerId,
    nonStrikerId,
    currentBowlerId,
    lastBalls,
    isProcessing,
    setStrikerId,
    setNonStrikerId,
    setCurrentBowlerId,
    handleStartMatch,
    handleScore,
    handleUndo,
    handleConfirmBatsmen,
    handleConfirmBowler,
    handleAddPlayerInline,
    handleEndInnings,
  } = useScoring(matchId);

  // UI state only — scoring state lives in the hook
  const [showTossDialog, setShowTossDialog] = useState(false);
  const [showSelectBatsmen, setShowSelectBatsmen] = useState(false);
  const [showSelectBowler, setShowSelectBowler] = useState(false);
  const [showWicketDialog, setShowWicketDialog] = useState(false);
  const [showAddPlayerDialog, setShowAddPlayerDialog] = useState(false);
  const [showPotmDialog, setShowPotmDialog] = useState(false);
  const [addPlayerTeam, setAddPlayerTeam] = useState<"batting" | "bowling">(
    "batting",
  );
  const [tossWinner, setTossWinner] = useState<string>("");
  const [tossDecision, setTossDecision] = useState<"bat" | "bowl">("bat");
  const [dismissalType, setDismissalType] = useState("bowled");
  const [fielderId, setFielderId] = useState<string>("");
  const [addPlayerTarget, setAddPlayerTarget] = useState<
    "batting" | "bowling" | null
  >(null);
  const [newPlayerName, setNewPlayerName] = useState("");

  const currentInnings = match?.innings?.find(
    (i) => i.innings_number === match?.current_innings,
  );
  const battingTeam =
    currentInnings?.team_id === match?.team1_id ? match?.team1 : match?.team2;
  const bowlingTeam =
    currentInnings?.team_id === match?.team1_id ? match?.team2 : match?.team1;

  // Auto-open dialogs based on match state
  if (match && match.status === "scheduled" && !showTossDialog) {
    // This will be handled via effect in hook; keep for UI
  }

  const onScore = async (
    runs: number,
    extra?: { type: string; runs: number },
    shotZone?: string,
  ) => {
    if (!currentBowlerId || !strikerId || !nonStrikerId) {
      if (!currentBowlerId) setShowSelectBowler(true);
      else setShowSelectBatsmen(true);
      return;
    }
    await handleScore(currentBowlerId, strikerId, nonStrikerId, {
      runsScored: runs,
      extras: extra?.runs ?? 0,
      extraType: extra?.type as never,
      shotZone: shotZone ?? null,
    });
  };

  const onWicket = async () => {
    if (!strikerId) return;
    const needsFielder = DISMISSAL_TYPES.find(
      (d) => d.value === dismissalType,
    )?.needsFielder;
    if (needsFielder && !fielderId) {
      toast.error("Select a fielder");
      return;
    }
    await handleScore(currentBowlerId!, strikerId, nonStrikerId!, {
      isWicket: true,
      dismissalType,
      fielderId: fielderId || null,
    });
    setShowWicketDialog(false);
    setFielderId("");
  };

  const onAddPlayer = async () => {
    if (!newPlayerName.trim() || !addPlayerTarget) return;
    await handleAddPlayerInline(
      addPlayerTarget,
      newPlayerName,
      match,
      strikerId,
      nonStrikerId,
      currentBowlerId,
    );
    setNewPlayerName("");
    setAddPlayerTarget(null);
  };

  const onAddPlayerAlways = async () => {
    if (!newPlayerName.trim()) return;
    await handleAddPlayerInline(
      addPlayerTeam,
      newPlayerName,
      match,
      strikerId,
      nonStrikerId,
      currentBowlerId,
    );
    setNewPlayerName("");
    setShowAddPlayerDialog(false);
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (error || !match) {
    return (
      <div className="container mx-auto max-w-2xl px-4 py-8">
        <Card>
          <CardContent className="p-6 text-center">
            <AlertCircle className="mx-auto mb-2 h-8 w-8 text-destructive" />
            <p>{error ?? "Match not found"}</p>
            <Button asChild className="mt-4">
              <Link href="/matches">Back to matches</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isScorer =
    !!user &&
    (match.created_by === user.id ||
      (match.match_admins ?? []).includes(user.id));

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-20 border-b bg-card">
        <div className="container mx-auto flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" asChild>
              <Link href={`/matches/${match.id}`}>
                <ChevronLeft className="h-5 w-5" />
              </Link>
            </Button>
            <div>
              <h1 className="font-semibold leading-none">{match.title}</h1>
              <p className="text-xs text-muted-foreground">
                {match.team1.name} vs {match.team2.name} · {match.match_format}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowAddPlayerDialog(true)}
            >
              <UserPlus className="mr-1.5 h-4 w-4" /> Add Player
            </Button>
            <Button variant="ghost" size="icon" asChild>
              <Link href={`/overlay/${match.id}`} target="_blank">
                <Tv className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </header>

      <div className="container mx-auto grid max-w-6xl gap-6 px-4 py-6 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">
                    {battingTeam?.name ?? "—"} batting
                  </p>
                  <p className="score-display text-3xl font-bold">
                    {currentInnings?.total_runs ?? 0}/
                    {currentInnings?.total_wickets ?? 0}
                    <span className="ml-2 text-lg font-normal text-muted-foreground">
                      (
                      {currentInnings
                        ? `${Math.floor((currentInnings.total_balls ?? 0) / 6)}.${(currentInnings.total_balls ?? 0) % 6}`
                        : "0.0"}{" "}
                      ov)
                    </span>
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleUndo()}
                    disabled={isProcessing}
                  >
                    <Undo2 className="mr-1.5 h-4 w-4" /> Undo
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleEndInnings()}
                    disabled={isProcessing}
                  >
                    End Inns
                  </Button>
                </div>
              </div>
              {lastBalls.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {lastBalls.map((b, i) => (
                    <Badge
                      key={i}
                      variant={b === "W" ? "destructive" : "secondary"}
                      className="tabular"
                    >
                      {b}
                    </Badge>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {match.status === "completed" && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-amber-900 dark:text-amber-200">
              <div>
                <p className="flex items-center gap-1.5 text-sm font-semibold">
                  <Award className="h-4 w-4 text-amber-500" />
                  Match Completed
                </p>
                <p className="text-xs text-muted-foreground">
                  {match.result_description || "Results official"}
                </p>
              </div>
              <Button
                size="sm"
                onClick={() => setShowPotmDialog(true)}
                className="bg-amber-600 font-medium text-white hover:bg-amber-500"
              >
                <Award className="mr-1.5 h-4 w-4" />
                {match.player_of_the_match_id
                  ? "Change POTM"
                  : "Award Player of the Match"}
              </Button>
            </div>
          )}

          {!isScorer && (
            <Card className="border-amber-500/30 bg-amber-500/5">
              <CardContent className="p-3 text-sm text-amber-700 dark:text-amber-300">
                You are viewing as spectator — only match admins can score.
              </CardContent>
            </Card>
          )}

          <CurrentBatsmen
            batsman1={
              battingTeamPlayers.find((p) => p.user_id === strikerId)
                ? {
                    id: strikerId!,
                    name: battingTeamPlayers.find(
                      (p) => p.user_id === strikerId,
                    )!.user!.full_name,
                    runs: 0,
                    balls: 0,
                    fours: 0,
                    sixes: 0,
                    isStriker: true,
                  }
                : null
            }
            batsman2={
              battingTeamPlayers.find((p) => p.user_id === nonStrikerId)
                ? {
                    id: nonStrikerId!,
                    name: battingTeamPlayers.find(
                      (p) => p.user_id === nonStrikerId,
                    )!.user!.full_name,
                    runs: 0,
                    balls: 0,
                    fours: 0,
                    sixes: 0,
                    isStriker: false,
                  }
                : null
            }
            onSelectNewBatsman={() => setShowSelectBatsmen(true)}
          />

          <CurrentBowler
            bowler={
              bowlingTeamPlayers.find((p) => p.user_id === currentBowlerId)
                ? {
                    id: currentBowlerId!,
                    name: bowlingTeamPlayers.find(
                      (p) => p.user_id === currentBowlerId,
                    )!.user!.full_name,
                    overs: 0,
                    maidens: 0,
                    runs: 0,
                    wickets: 0,
                  }
                : null
            }
            onChangeBowler={() => setShowSelectBowler(true)}
          />

          <ScoringPanel
            onScore={onScore}
            onWicket={() => setShowWicketDialog(true)}
            onUndo={() => void handleUndo()}
            currentOver={match.current_over}
            currentBall={match.current_ball}
            lastBalls={lastBalls}
            disabled={!isScorer || isProcessing}
          />
        </div>

        <div className="space-y-4">
          <Card>
            <CardContent className="p-4">
              <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
                <Users className="h-4 w-4" /> Squads
              </h3>
              <div className="space-y-3">
                <div>
                  <p className="text-xs font-medium text-muted-foreground">
                    {battingTeam?.name} — Batting
                  </p>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {battingTeamPlayers.map((p) => (
                      <Badge
                        key={p.user_id}
                        variant="outline"
                        className="text-xs"
                      >
                        {p.user?.full_name}
                      </Badge>
                    ))}
                    {battingTeamPlayers.length === 0 && (
                      <span className="text-xs text-muted-foreground">
                        No players
                      </span>
                    )}
                  </div>
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground">
                    {bowlingTeam?.name} — Bowling
                  </p>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {bowlingTeamPlayers.map((p) => (
                      <Badge
                        key={p.user_id}
                        variant="outline"
                        className="text-xs"
                      >
                        {p.user?.full_name}
                      </Badge>
                    ))}
                    {bowlingTeamPlayers.length === 0 && (
                      <span className="text-xs text-muted-foreground">
                        No players
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="mt-3 w-full"
                onClick={() => setShowAddPlayerDialog(true)}
              >
                <UserPlus className="mr-1.5 h-4 w-4" /> Manage Players
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      <TossDialog
        open={showTossDialog}
        onOpenChange={setShowTossDialog}
        match={match}
        tossWinner={tossWinner}
        tossDecision={tossDecision}
        onTossWinnerChange={setTossWinner}
        onTossDecisionChange={(v) => setTossDecision(v as never)}
        onConfirm={async () => {
          const res = await handleStartMatch(tossWinner, tossDecision as never);
          if (!res.error) setShowTossDialog(false);
        }}
        isProcessing={isProcessing}
      />

      <BatsmenDialog
        open={showSelectBatsmen}
        onOpenChange={setShowSelectBatsmen}
        battingTeamPlayers={battingTeamPlayers}
        strikerId={strikerId}
        nonStrikerId={nonStrikerId}
        onStrikerChange={setStrikerId}
        onNonStrikerChange={setNonStrikerId}
        onConfirm={async () => {
          const res = await handleConfirmBatsmen(strikerId, nonStrikerId);
          if (!res.error) {
            setShowSelectBatsmen(false);
            if (!currentBowlerId) setShowSelectBowler(true);
          }
        }}
        isProcessing={isProcessing}
        addPlayerTarget={addPlayerTarget}
        newPlayerName={newPlayerName}
        onNewPlayerNameChange={setNewPlayerName}
        onAddPlayer={onAddPlayer}
        onAddPlayerTargetChange={setAddPlayerTarget}
      />

      <BowlerDialog
        open={showSelectBowler}
        onOpenChange={setShowSelectBowler}
        bowlingTeamPlayers={bowlingTeamPlayers}
        currentBowlerId={currentBowlerId}
        onBowlerChange={setCurrentBowlerId}
        onConfirm={async () => {
          const res = await handleConfirmBowler(currentBowlerId);
          if (!res.error) setShowSelectBowler(false);
        }}
        isProcessing={isProcessing}
        addPlayerTarget={addPlayerTarget}
        newPlayerName={newPlayerName}
        onNewPlayerNameChange={setNewPlayerName}
        onAddPlayer={onAddPlayer}
        onAddPlayerTargetChange={setAddPlayerTarget}
      />

      <AddPlayerDialog
        open={showAddPlayerDialog}
        onOpenChange={setShowAddPlayerDialog}
        teamName={battingTeam?.name}
        bowlingTeamName={bowlingTeam?.name}
        addPlayerTeam={addPlayerTeam}
        onTeamChange={setAddPlayerTeam}
        newPlayerName={newPlayerName}
        onNameChange={setNewPlayerName}
        onConfirm={() => void onAddPlayerAlways()}
        isProcessing={isProcessing}
      />

      <WicketDialog
        open={showWicketDialog}
        onOpenChange={setShowWicketDialog}
        dismissalType={dismissalType}
        onDismissalTypeChange={setDismissalType}
        fielderId={fielderId}
        onFielderChange={setFielderId}
        bowlingTeamPlayers={bowlingTeamPlayers}
        onConfirm={() => void onWicket()}
        isProcessing={isProcessing}
      />

      <PotmDialog
        open={showPotmDialog}
        onOpenChange={setShowPotmDialog}
        matchId={matchId}
        currentPotmId={match?.player_of_the_match_id}
        players={[
          ...(battingTeamPlayers || []).map((p) => ({
            id: p.user_id,
            name: p.user?.full_name ?? "Player",
            avatarUrl: p.user?.avatar_url,
            teamName: battingTeam?.name ?? "Team 1",
          })),
          ...(bowlingTeamPlayers || []).map((p) => ({
            id: p.user_id,
            name: p.user?.full_name ?? "Player",
            avatarUrl: p.user?.avatar_url,
            teamName: bowlingTeam?.name ?? "Team 2",
          })),
        ]}
      />
    </div>
  );
}
