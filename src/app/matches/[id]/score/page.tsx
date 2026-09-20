"use client";

import { useCallback, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { ScoringPanel } from "~/components/matches/scoring-panel";
import { CurrentBatsmen } from "~/components/matches/current-batsmen";
import { CurrentBowler } from "~/components/matches/current-bowler";
import dynamic from "next/dynamic";
import { ALL_DISMISSAL_TYPES } from "./components/WicketDialog";
import type { DeliveryToEdit } from "./components/EditBallDialog";

const TossDialog = dynamic(
  () => import("./components/TossDialog").then((m) => m.TossDialog),
  { ssr: false },
);
const BatsmenDialog = dynamic(
  () => import("./components/BatsmenDialog").then((m) => m.BatsmenDialog),
  { ssr: false },
);
const BowlerDialog = dynamic(
  () => import("./components/BowlerDialog").then((m) => m.BowlerDialog),
  { ssr: false },
);
const WicketDialog = dynamic(
  () => import("./components/WicketDialog").then((m) => m.WicketDialog),
  { ssr: false },
);
const EditBallDialog = dynamic(
  () => import("./components/EditBallDialog").then((m) => m.EditBallDialog),
  { ssr: false },
);
const AddPlayerDialog = dynamic(
  () => import("./components/AddPlayerDialog").then((m) => m.AddPlayerDialog),
  { ssr: false },
);
const PotmDialog = dynamic(
  () => import("./components/PotmDialog").then((m) => m.PotmDialog),
  { ssr: false },
);
const MatchSettingsDialog = dynamic(
  () =>
    import("./components/MatchSettingsDialog").then(
      (m) => m.MatchSettingsDialog,
    ),
  { ssr: false },
);
const DlsCalculatorModal = dynamic(
  () =>
    import("~/components/matches/dls-calculator-modal").then(
      (m) => m.DlsCalculatorModal,
    ),
  { ssr: false },
);
const MatchScorersDialog = dynamic(
  () =>
    import("~/components/matches/match-scorers-dialog").then(
      (m) => m.MatchScorersDialog,
    ),
  { ssr: false },
);
import { useScoring } from "./useScoring";
import { oversFromBalls } from "~/lib/cricket";
import { useAuth } from "~/lib/auth";
import { useMatchAdminQuery } from "~/lib/hooks/useMatchQueries";
import { useScoringUIStore } from "~/lib/stores/useScoringUIStore";
import { usePreferencesStore } from "~/lib/stores/usePreferencesStore";
import { useWakeLock } from "~/lib/hooks/useWakeLock";
import { cn } from "~/lib/utils";
import {
  updateMatchSettings,
  reassignCurrentOverBowler,
} from "../../mutations";
import type { ExtraType } from "../../types";
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
  ShieldAlert,
  Play,
  SlidersHorizontal,
  Sun,
  Zap,
} from "lucide-react";

export default function ScoringPage() {
  const params = useParams();
  const matchId = params.id as string;
  const { user, loading: authLoading } = useAuth();
  const { data: isAdminData, isLoading: authCheckLoading } = useMatchAdminQuery(
    matchId,
    user?.id,
  );
  const isAuthorized = user
    ? authCheckLoading
      ? null
      : Boolean(isAdminData)
    : authLoading
      ? null
      : false;

  const sunlightMode = usePreferencesStore((s) => s.sunlightMode);
  const toggleSunlightMode = usePreferencesStore((s) => s.toggleSunlightMode);

  // UI state managed via Zustand store
  const {
    tossDialogDismissed,
    setTossDialogDismissed,
    showBatsmenDialog: showSelectBatsmen,
    setShowSelectBatsmen,
    showBowlerDialog: showSelectBowler,
    setShowSelectBowler,
    showWicketDialog,
    setShowWicketDialog,
    showAddPlayerDialog,
    setShowAddPlayerDialog,
    showPotmDialog,
    setShowPotmDialog,
    addPlayerTeam,
    setAddPlayerTeam,
    dismissalType,
    setDismissalType,
    fielderId,
    setFielderId,
    wicketExtraType,
    setWicketExtraType,
    dismissedPlayerId,
    setDismissedPlayerId,
    runsCompletedBeforeRunOut,
    setRunsCompletedBeforeRunOut,
    addPlayerTarget,
    setAddPlayerTarget,
    newPlayerName,
    setNewPlayerName,
  } = useScoringUIStore();

  const handleNeedsBowler = useCallback(() => {
    setShowSelectBowler(true);
  }, [setShowSelectBowler]);

  const handleNeedsBatsman = useCallback(() => {
    setShowSelectBatsmen(true);
  }, [setShowSelectBatsmen]);

  const scoringOptions = useMemo(
    () => ({
      onNeedsBowler: handleNeedsBowler,
      onNeedsBatsman: handleNeedsBatsman,
    }),
    [handleNeedsBowler, handleNeedsBatsman],
  );

  const {
    match,
    loading,
    error,
    battingTeamPlayers,
    bowlingTeamPlayers,
    strikerId,
    nonStrikerId,
    currentBowlerId,
    lastOverBowlerId,
    lastBalls,
    rawDeliveries,
    isProcessing,
    setStrikerId,
    setNonStrikerId,
    setCurrentBowlerId,
    handleStartMatch,
    handleScore,
    handleUndo,
    handleUpdateBall,
    handleStartSuperOver,
    handleConfirmBatsmen,
    handleConfirmBowler,
    handleAddPlayerInline,
    handleEndInnings,
    syncFromDb,
  } = useScoring(matchId, scoringOptions);

  const { isLocked: isScreenAwake } = useWakeLock(match?.status === "live");

  const [selectedTossWinner, setSelectedTossWinner] = useState<string>("");
  const [tossDecision, setTossDecision] = useState<"bat" | "bowl">("bat");
  const [showEditBallDialog, setShowEditBallDialog] = useState(false);
  const [showMatchSettingsDialog, setShowMatchSettingsDialog] = useState(false);
  const [reassignOverDeliveries, setReassignOverDeliveries] = useState(false);
  const [editingDelivery, setEditingDelivery] = useState<DeliveryToEdit | null>(
    null,
  );

  const currentInnings = match?.innings?.find(
    (i) => i.innings_number === match?.current_innings,
  );
  const battingTeam = currentInnings
    ? (currentInnings.team_id === match?.team1_id ? match?.team1 : match?.team2)
    : match?.team1;
  const bowlingTeam = currentInnings
    ? (currentInnings.team_id === match?.team1_id ? match?.team2 : match?.team1)
    : match?.team2;

  const showTossDialog = match?.status === "scheduled" && !tossDialogDismissed;
  const tossWinner = selectedTossWinner || match?.team1_id || "";

  const dismissedPlayerIds = useMemo(
    () =>
      new Set(
        currentInnings?.batting_performances
          ?.filter((bp) => bp.is_out)
          .map((bp) => bp.user_id) ?? [],
      ),
    [currentInnings],
  );

  const battingTeamPlayerIds = useMemo(
    () => new Set(battingTeamPlayers.map((p) => p.user_id)),
    [battingTeamPlayers],
  );

  const bowlingTeamPlayerIds = useMemo(
    () => new Set(bowlingTeamPlayers.map((p) => p.user_id)),
    [bowlingTeamPlayers],
  );

  const onScore = async (
    runs: number,
    extra?: { type: string; runs: number },
    shotZone?: string,
  ) => {
    if (match?.status === "scheduled") {
      setTossDialogDismissed(false);
      toast.info("Please record the toss to start the match");
      return;
    }
    if (!currentBowlerId || !strikerId || !nonStrikerId) {
      if (!currentBowlerId) setShowSelectBowler(true);
      else setShowSelectBatsmen(true);
      return;
    }
    const res = await handleScore(currentBowlerId, strikerId, nonStrikerId, {
      runsScored: runs,
      extras: extra?.runs ?? 0,
      extraType: extra?.type as never,
      shotZone: shotZone ?? null,
    });
    if (res?.data) {
      if (res.data.over_completed || res.data.needs_bowler) {
        setShowSelectBowler(true);
      } else if (res.data.needs_batsman) {
        setShowSelectBatsmen(true);
      }
    }
  };

  const openWicketDialog = (extraType?: string | null) => {
    setWicketExtraType(extraType ?? null);
    setDismissedPlayerId(strikerId);
    setRunsCompletedBeforeRunOut(0);
    if (extraType === "no_ball") {
      setDismissalType("run_out");
    } else if (extraType === "wide") {
      setDismissalType("stumped");
    } else {
      setDismissalType("bowled");
    }
    setShowWicketDialog(true);
  };

  const onWicketConfirm = async () => {
    if (!strikerId || !nonStrikerId || !currentBowlerId) return;
    const selectedDismissal = ALL_DISMISSAL_TYPES.find(
      (d) => d.value === dismissalType,
    );
    if (selectedDismissal?.needsFielder && !fielderId) {
      toast.error("Select a fielder");
      return;
    }

    let runsScored = 0;
    let extras = 0;
    let extraType: ExtraType | undefined = undefined;

    if (wicketExtraType === "wide") {
      runsScored = 0;
      extras = 1 + runsCompletedBeforeRunOut;
      extraType = "wide";
    } else if (wicketExtraType === "no_ball") {
      runsScored = runsCompletedBeforeRunOut;
      extras = 1;
      extraType = "no_ball";
    } else if (dismissalType === "run_out") {
      if (
        wicketExtraType === "bye" ||
        wicketExtraType === "leg_bye" ||
        wicketExtraType === "penalty"
      ) {
        // Completed runs are byes, not batter runs; bowler concedes 0.
        runsScored = 0;
        extras = runsCompletedBeforeRunOut;
        extraType = wicketExtraType;
      } else {
        runsScored = runsCompletedBeforeRunOut;
        extras = 0;
      }
    } else if (
      wicketExtraType === "bye" ||
      wicketExtraType === "leg_bye" ||
      wicketExtraType === "penalty"
    ) {
      // Non-run-out dismissal on a bye ball: carry the extra type so the
      // bowler isn't charged.
      runsScored = 0;
      extras = 0;
      extraType = wicketExtraType;
    }

    const res = await handleScore(currentBowlerId, strikerId, nonStrikerId, {
      runsScored,
      extras,
      extraType,
      isWicket: true,
      dismissalType,
      fielderId: fielderId || null,
      dismissedPlayerId: dismissedPlayerId || strikerId,
    });
    setShowWicketDialog(false);
    setFielderId("");
    setWicketExtraType(null);
    setRunsCompletedBeforeRunOut(0);

    if (res?.data) {
      if (res.data.needs_batsman) {
        setShowSelectBatsmen(true);
      } else if (res.data.over_completed || res.data.needs_bowler) {
        setShowSelectBowler(true);
      }
    }
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

  if (loading || authLoading || isAuthorized === null) {
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

  if (!user) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center p-4">
        <Card className="max-w-md text-center">
          <CardHeader>
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
              <ShieldAlert className="h-6 w-6" />
            </div>
            <CardTitle className="mt-2 text-xl font-bold">
              Authentication Required
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              You must be signed in to access the match scoring console.
            </p>
            <Button asChild className="w-full">
              <Link href={`/auth/login?redirect=/matches/${matchId}/score`}>
                Sign In
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!isAuthorized) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center p-4">
        <Card className="max-w-md text-center">
          <CardHeader>
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
              <ShieldAlert className="h-6 w-6" />
            </div>
            <CardTitle className="mt-2 text-xl font-bold">
              Access Denied
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              You do not have administrative permissions to score this match.
              Only the match creator, designated scorers, or club administrators
              can record scores.
            </p>
            <div className="flex gap-2">
              <Button asChild className="flex-1">
                <Link href={`/matches/${matchId}`}>View Match Center</Link>
              </Button>
              <Button variant="outline" asChild className="flex-1">
                <Link href={`/overlay/${matchId}`} target="_blank">
                  View Overlay
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isScorer = isAuthorized;

  return (
    <div
      data-sunlight={sunlightMode ? "true" : "false"}
      className={cn(
        "min-h-screen bg-background",
        sunlightMode && "sunlight-mode",
      )}
    >
      <header
        className={cn(
          "sticky top-0 z-20 border-b bg-card",
          sunlightMode && "border-b-2 border-black bg-white",
        )}
      >
        <div className="container mx-auto flex items-center justify-between px-3 py-2.5 sm:px-4 sm:py-3">
          <div className="flex min-w-0 items-center gap-2">
            <Button variant="ghost" size="icon" className="shrink-0" asChild>
              <Link
                href={`/matches/${match.id}`}
                aria-label="Back to match details"
              >
                <ChevronLeft className="h-5 w-5" />
              </Link>
            </Button>
            <div className="min-w-0">
              <h1 className="truncate text-sm font-semibold leading-tight sm:text-base">
                {match.title}
              </h1>
              <p className="truncate text-xs text-muted-foreground">
                {match.team1.name} vs {match.team2.name}, {match.match_format}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
            {sunlightMode && (
              <span className="hidden sm:inline-flex items-center gap-1.5 rounded-full border border-black bg-black px-2.5 py-0.5 text-[11px] font-black text-white shadow-sm">
                <Sun className="h-3 w-3" /> SUN
              </span>
            )}
            {isScreenAwake && (
              <span
                title="Screen wake lock active to prevent display timeout"
                className="hidden sm:inline-flex items-center gap-1.5 rounded-full border border-emerald-600 bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-950 dark:border-emerald-500/40 dark:bg-emerald-950/70 dark:text-emerald-200 dark:shadow-[inset_0_1px_0_0_rgba(52,211,153,0.2)]"
              >
                <Zap className="h-3 w-3 text-emerald-600 dark:text-emerald-400" /> AWAKE
              </span>
            )}
            {match.status === "scheduled" && isScorer && (
              <Button
                size="sm"
                onClick={() => setTossDialogDismissed(false)}
                className="h-9 min-h-[36px] px-2.5 sm:h-8 sm:px-3 text-xs font-bold"
              >
                <Play className="h-4 w-4 sm:mr-1.5" />
                <span className="hidden sm:inline">Start Match</span>
              </Button>
            )}
            {match.status === "live" && isScorer && (
              <DlsCalculatorModal match={match} canEdit={isScorer} />
            )}
            {isScorer && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowMatchSettingsDialog(true)}
                className={cn(
                  "h-9 min-h-[36px] px-2.5 sm:h-8 sm:px-3 text-xs font-semibold",
                  sunlightMode && "border-2 border-black font-bold",
                )}
                title="Match Settings & Rules"
              >
                <SlidersHorizontal className="h-4 w-4 sm:mr-1.5" />
                <span className="hidden sm:inline">Settings</span>
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowAddPlayerDialog(true)}
              className={cn(
                "h-9 min-h-[36px] px-2.5 sm:h-8 sm:px-3 text-xs font-semibold",
                sunlightMode && "border-2 border-black font-bold",
              )}
            >
              <UserPlus className="h-4 w-4 sm:mr-1.5" />
              <span className="hidden sm:inline">Add Player</span>
            </Button>
            {isScorer && (
              <MatchScorersDialog
                matchId={match.id}
                isCreator={match.created_by === user?.id}
              />
            )}
            <Button variant="ghost" size="icon" className="h-9 w-9 min-h-[36px] min-w-[36px] sm:h-8 sm:w-8" asChild>
              <Link
                href={`/overlay/${match.id}`}
                target="_blank"
                aria-label="Open broadcast overlay in new tab"
              >
                <Tv className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </header>

      <div className="container mx-auto grid max-w-6xl gap-4 px-3 py-4 sm:gap-6 sm:px-4 sm:py-6 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          {match.status === "scheduled" && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-primary/30 bg-primary/10 p-4 text-primary-950 dark:border-emerald-500/35 dark:bg-emerald-950/40 dark:text-emerald-200 dark:shadow-[inset_0_1px_0_0_rgba(52,211,153,0.2)]">
              <div>
                <p className="flex items-center gap-1.5 text-sm font-semibold">
                  <Play className="h-4 w-4 text-primary" />
                  Match Scheduled — Toss Required
                </p>
                <p className="text-xs text-muted-foreground">
                  Record the toss winner and their decision to start the match and enable scoring.
                </p>
              </div>
              <Button
                size="sm"
                onClick={() => setTossDialogDismissed(false)}
                className="font-medium"
              >
                <Play className="mr-1.5 h-4 w-4" /> Conduct Toss & Start
              </Button>
            </div>
          )}
          <Card
            data-sunlight={sunlightMode ? "true" : "false"}
            className={
              sunlightMode
                ? "border-2 border-black bg-white shadow-none"
                : ""
            }
          >
            <CardContent className="p-4 sm:p-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p
                    className={cn(
                      "text-xs font-bold sm:text-sm",
                      sunlightMode ? "text-black" : "text-muted-foreground",
                    )}
                  >
                    {battingTeam?.name ?? "—"} batting
                  </p>
                  <p
                    className={cn(
                      "score-display text-3xl font-black sm:text-4xl tabular-nums tracking-tight",
                      sunlightMode && "text-black",
                    )}
                  >
                    {`${currentInnings?.total_runs ?? 0}/${currentInnings?.total_wickets ?? 0}`}
                    <span
                      className={cn(
                        "ml-2 text-base font-bold sm:text-lg",
                        sunlightMode ? "text-black" : "text-muted-foreground",
                      )}
                    >
                      ({oversFromBalls(currentInnings?.total_balls)} ov)
                    </span>
                  </p>
                </div>
                <div className="flex items-center gap-2 self-end sm:self-auto">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleUndo()}
                    disabled={isProcessing}
                    className={cn(
                      "h-10 min-h-[40px] px-3.5 text-xs font-bold sm:h-9 sm:min-h-0 sm:font-semibold",
                      sunlightMode
                        ? "border-2 border-black bg-white font-black text-black hover:bg-neutral-100"
                        : "",
                    )}
                  >
                    <Undo2 className="mr-1.5 h-4 w-4" /> Undo
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleEndInnings()}
                    disabled={isProcessing}
                    className={cn(
                      "h-10 min-h-[40px] px-3.5 text-xs font-bold sm:h-9 sm:min-h-0 sm:font-semibold",
                      sunlightMode
                        ? "border-2 border-black bg-white font-black text-black hover:bg-neutral-100"
                        : "",
                    )}
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
                      className={cn(
                        "tabular font-black",
                        sunlightMode &&
                          (b === "W"
                            ? "border-2 border-black bg-red-600 text-white"
                            : "border-2 border-black bg-white text-black"),
                      )}
                    >
                      {b}
                    </Badge>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {match.status === "completed" && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-amber-900 dark:border-amber-500/35 dark:bg-amber-950/40 dark:text-amber-200 dark:shadow-[inset_0_1px_0_0_rgba(251,191,36,0.2)]">
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
            <Card className="border-amber-500/30 bg-amber-500/5 dark:border-amber-500/30 dark:bg-amber-950/20">
              <CardContent className="p-3 text-sm text-amber-700 dark:text-amber-300">
                You are viewing in spectator mode: only match administrators can
                score.
              </CardContent>
            </Card>
          )}

          <CurrentBatsmen
            batsman1={
              strikerId
                ? {
                    id: strikerId,
                    name:
                      battingTeamPlayers.find((p) => p.user_id === strikerId)
                        ?.user?.full_name ??
                      currentInnings?.batting_performances?.find(
                        (bp) => bp.user_id === strikerId,
                      )?.user?.full_name ??
                      "Striker",
                    runs:
                      currentInnings?.batting_performances?.find(
                        (bp) => bp.user_id === strikerId,
                      )?.runs_scored ?? 0,
                    balls:
                      currentInnings?.batting_performances?.find(
                        (bp) => bp.user_id === strikerId,
                      )?.balls_faced ?? 0,
                    fours:
                      currentInnings?.batting_performances?.find(
                        (bp) => bp.user_id === strikerId,
                      )?.fours ?? 0,
                    sixes:
                      currentInnings?.batting_performances?.find(
                        (bp) => bp.user_id === strikerId,
                      )?.sixes ?? 0,
                    isStriker: true,
                  }
                : null
            }
            batsman2={
              nonStrikerId
                ? {
                    id: nonStrikerId,
                    name:
                      battingTeamPlayers.find((p) => p.user_id === nonStrikerId)
                        ?.user?.full_name ??
                      currentInnings?.batting_performances?.find(
                        (bp) => bp.user_id === nonStrikerId,
                      )?.user?.full_name ??
                      "Non-Striker",
                    runs:
                      currentInnings?.batting_performances?.find(
                        (bp) => bp.user_id === nonStrikerId,
                      )?.runs_scored ?? 0,
                    balls:
                      currentInnings?.batting_performances?.find(
                        (bp) => bp.user_id === nonStrikerId,
                      )?.balls_faced ?? 0,
                    fours:
                      currentInnings?.batting_performances?.find(
                        (bp) => bp.user_id === nonStrikerId,
                      )?.fours ?? 0,
                    sixes:
                      currentInnings?.batting_performances?.find(
                        (bp) => bp.user_id === nonStrikerId,
                      )?.sixes ?? 0,
                    isStriker: false,
                  }
                : null
            }
            onSwapStriker={() => {
              if (strikerId && nonStrikerId && !isProcessing) {
                void handleConfirmBatsmen(nonStrikerId, strikerId);
              }
            }}
            onChangeStriker={() => {
              if (match.status === "scheduled") {
                setTossDialogDismissed(false);
                toast.info("Please record the toss to start the match");
                return;
              }
              setShowSelectBatsmen(true);
            }}
            onChangeNonStriker={() => {
              if (match.status === "scheduled") {
                setTossDialogDismissed(false);
                toast.info("Please record the toss to start the match");
                return;
              }
              setShowSelectBatsmen(true);
            }}
            onSelectNewBatsman={() => {
              if (match.status === "scheduled") {
                setTossDialogDismissed(false);
                toast.info("Please record the toss to start the match");
                return;
              }
              setShowSelectBatsmen(true);
            }}
            sunlightMode={sunlightMode}
          />

          <CurrentBowler
            sunlightMode={sunlightMode}
            bowler={
              currentBowlerId
                ? {
                    id: currentBowlerId,
                    name:
                      bowlingTeamPlayers.find(
                        (p) => p.user_id === currentBowlerId,
                      )?.user?.full_name ??
                      currentInnings?.bowling_performances?.find(
                        (bp) => bp.user_id === currentBowlerId,
                      )?.user?.full_name ??
                      "Bowler",
                    overs:
                      currentInnings?.bowling_performances?.find(
                        (bp) => bp.user_id === currentBowlerId,
                      )?.overs_bowled ?? 0,
                    maidens:
                      currentInnings?.bowling_performances?.find(
                        (bp) => bp.user_id === currentBowlerId,
                      )?.maidens ?? 0,
                    runs:
                      currentInnings?.bowling_performances?.find(
                        (bp) => bp.user_id === currentBowlerId,
                      )?.runs_conceded ?? 0,
                    wickets:
                      currentInnings?.bowling_performances?.find(
                        (bp) => bp.user_id === currentBowlerId,
                      )?.wickets_taken ?? 0,
                  }
                : null
            }
            onChangeBowler={() => {
              if (match.status === "scheduled") {
                setTossDialogDismissed(false);
                toast.info("Please record the toss to start the match");
                return;
              }
              setShowSelectBowler(true);
            }}
          />

          <ScoringPanel
            onScore={onScore}
            onWicket={openWicketDialog}
            onUndo={() => void handleUndo()}
            onSelectBall={(idx) => {
              const d = rawDeliveries[idx];
              if (d) {
                setEditingDelivery(d);
                setShowEditBallDialog(true);
              }
            }}
            currentOver={match.current_over}
            currentBall={match.current_ball}
            lastBalls={lastBalls}
            disabled={!isScorer || isProcessing || match.status !== "live"}
            sunlightMode={sunlightMode}
            onToggleSunlightMode={toggleSunlightMode}
          />

          {match.status === "completed" &&
            match.result_description?.toLowerCase().includes("tie") &&
            isScorer && (
              <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-center">
                <h4 className="text-base font-bold text-amber-800 dark:text-amber-200">
                  Match Tied!
                </h4>
                <p className="mt-1 text-xs text-muted-foreground">
                  Scores are level. You can initiate a Super Over tiebreaker
                  according to tournament rules.
                </p>
                <Button
                  className="mt-3 gap-2"
                  onClick={() => void handleStartSuperOver()}
                  disabled={isProcessing}
                >
                  Start Super Over
                </Button>
              </div>
            )}
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
                    {battingTeam?.name} —{" "}
                    {match.status === "live" ? "Batting" : "Team 1"}
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
                    {bowlingTeam?.name} —{" "}
                    {match.status === "live" ? "Bowling" : "Team 2"}
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
        onOpenChange={(open) => setTossDialogDismissed(!open)}
        match={match}
        tossWinner={tossWinner}
        tossDecision={tossDecision}
        onTossWinnerChange={setSelectedTossWinner}
        onTossDecisionChange={(v) => setTossDecision(v as never)}
        onConfirm={async () => {
          const res = await handleStartMatch(tossWinner, tossDecision as never);
          if (!res.error) {
            setTossDialogDismissed(true);
            setShowSelectBatsmen(true);
          }
        }}
        isProcessing={isProcessing}
      />

      <BatsmenDialog
        open={showSelectBatsmen}
        onOpenChange={setShowSelectBatsmen}
        battingTeamPlayers={battingTeamPlayers}
        bowlingTeamPlayerIds={bowlingTeamPlayerIds}
        currentBowlerId={currentBowlerId}
        strikerId={strikerId}
        nonStrikerId={nonStrikerId}
        dismissedPlayerIds={dismissedPlayerIds}
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
        onOpenChange={(open) => {
          setShowSelectBowler(open);
          if (!open) setReassignOverDeliveries(false);
        }}
        bowlingTeamPlayers={bowlingTeamPlayers}
        currentBowlerId={currentBowlerId}
        lastOverBowlerId={lastOverBowlerId}
        strikerId={strikerId}
        nonStrikerId={nonStrikerId}
        battingTeamPlayerIds={battingTeamPlayerIds}
        currentBall={match.current_ball}
        reassignOverDeliveries={reassignOverDeliveries}
        onReassignOverDeliveriesChange={setReassignOverDeliveries}
        onBowlerChange={setCurrentBowlerId}
        onConfirm={async () => {
          if (
            reassignOverDeliveries &&
            currentBowlerId &&
            (match.current_ball ?? 0) > 0
          ) {
            const res = await reassignCurrentOverBowler(
              match.id,
              currentBowlerId,
            );
            if (res.error) {
              toast.error(res.error);
            } else {
              toast.success(
                "Bowler updated and current over deliveries reassigned",
              );
              setShowSelectBowler(false);
              setReassignOverDeliveries(false);
              await syncFromDb();
            }
          } else {
            const res = await handleConfirmBowler(currentBowlerId);
            if (!res.error) {
              setShowSelectBowler(false);
              setReassignOverDeliveries(false);
            }
          }
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
        teamName={battingTeam?.name ?? match.team1?.name}
        bowlingTeamName={bowlingTeam?.name ?? match.team2?.name}
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
        strikerId={strikerId}
        nonStrikerId={nonStrikerId}
        strikerName={
          battingTeamPlayers.find((p) => p.user_id === strikerId)?.user
            ?.full_name
        }
        nonStrikerName={
          battingTeamPlayers.find((p) => p.user_id === nonStrikerId)?.user
            ?.full_name
        }
        dismissedPlayerId={dismissedPlayerId}
        onDismissedPlayerChange={setDismissedPlayerId}
        extraType={wicketExtraType}
        runsCompleted={runsCompletedBeforeRunOut}
        onRunsCompletedChange={setRunsCompletedBeforeRunOut}
        onConfirm={() => void onWicketConfirm()}
        isProcessing={isProcessing}
      />

      <EditBallDialog
        open={showEditBallDialog}
        onOpenChange={setShowEditBallDialog}
        delivery={editingDelivery}
        battingTeamPlayers={battingTeamPlayers}
        bowlingTeamPlayers={bowlingTeamPlayers}
        onSave={async (params) => {
          await handleUpdateBall(params);
        }}
        isProcessing={isProcessing}
      />

      <PotmDialog
        open={showPotmDialog}
        onOpenChange={setShowPotmDialog}
        matchId={matchId}
        currentPotmId={match?.player_of_the_match_id}
        match={match}
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

      <MatchSettingsDialog
        open={showMatchSettingsDialog}
        onOpenChange={setShowMatchSettingsDialog}
        match={match}
        onSave={async (settings) => {
          const res = await updateMatchSettings(match.id, settings);
          if (res.error) {
            toast.error(res.error);
          } else {
            toast.success("Match settings updated");
            setShowMatchSettingsDialog(false);
            await syncFromDb();
          }
        }}
        isProcessing={isProcessing}
      />
    </div>
  );
}
