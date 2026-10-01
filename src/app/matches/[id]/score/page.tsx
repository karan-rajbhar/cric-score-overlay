"use client";

import { useCallback, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { ScoringPanel } from "~/components/matches/scoring-panel";
import { LiveMatchHUD } from "~/components/matches/live-match-hud";
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
const PenaltyBonusDialog = dynamic(
  () =>
    import("./components/PenaltyBonusDialog").then((m) => m.PenaltyBonusDialog),
  { ssr: false },
);
const AbandonMatchDialog = dynamic(
  () =>
    import("./components/AbandonMatchDialog").then((m) => m.AbandonMatchDialog),
  { ssr: false },
);
const RetirePlayerDialog = dynamic(
  () =>
    import("./components/RetirePlayerDialog").then((m) => m.RetirePlayerDialog),
  { ssr: false },
);
const ReviseTargetDialog = dynamic(
  () =>
    import("./components/ReviseTargetDialog").then((m) => m.ReviseTargetDialog),
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
import { useAuth } from "~/lib/auth";
import { useMatchAdminQuery } from "~/lib/hooks/useMatchQueries";
import { useScoringUIStore } from "~/lib/stores/useScoringUIStore";
import { usePreferencesStore } from "~/lib/stores/usePreferencesStore";
import { useWakeLock } from "~/lib/hooks/useWakeLock";
import { cn } from "~/lib/utils";
import {
  updateMatchSettings,
  reassignCurrentOverBowler,
  abandonMatch,
  awardTeamPenalty,
  retirePlayer,
  updateTargetRuns,
} from "../../mutations";
import type { ExtraType } from "../../types";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { toast } from "sonner";
import {
  ChevronLeft,
  Tv,
  Loader2,
  AlertCircle,
  UserPlus,
  Users,
  Award,
  ShieldAlert,
  Play,
  SlidersHorizontal,
  Sun,
  Zap,
  MoreVertical,
  CloudRain,
  WifiOff,
  RefreshCw,
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
  const isScorer = Boolean(isAuthorized);

  const sunlightMode = usePreferencesStore((s) => s.sunlightMode);
  const toggleSunlightMode = usePreferencesStore((s) => s.toggleSunlightMode);
  const wagonWheelPrompt = usePreferencesStore((s) => s.wagonWheelPrompt);
  const toggleWagonWheelPrompt = usePreferencesStore(
    (s) => s.toggleWagonWheelPrompt,
  );

  // UI state managed via Zustand store — granular selectors keep the page
  // from re-rendering on high-frequency form fields (player-name typing).
  const tossDialogDismissed = useScoringUIStore((s) => s.tossDialogDismissed);
  const setTossDialogDismissed = useScoringUIStore(
    (s) => s.setTossDialogDismissed,
  );
  const showSelectBatsmen = useScoringUIStore((s) => s.showBatsmenDialog);
  const setShowSelectBatsmen = useScoringUIStore(
    (s) => s.setShowSelectBatsmen,
  );
  const showSelectBowler = useScoringUIStore((s) => s.showBowlerDialog);
  const setShowSelectBowler = useScoringUIStore((s) => s.setShowSelectBowler);
  const showWicketDialog = useScoringUIStore((s) => s.showWicketDialog);
  const setShowWicketDialog = useScoringUIStore((s) => s.setShowWicketDialog);
  const showAddPlayerDialog = useScoringUIStore((s) => s.showAddPlayerDialog);
  const setShowAddPlayerDialog = useScoringUIStore(
    (s) => s.setShowAddPlayerDialog,
  );
  const showPotmDialog = useScoringUIStore((s) => s.showPotmDialog);
  const setShowPotmDialog = useScoringUIStore((s) => s.setShowPotmDialog);
  const dismissalType = useScoringUIStore((s) => s.dismissalType);
  const setDismissalType = useScoringUIStore((s) => s.setDismissalType);
  const fielderId = useScoringUIStore((s) => s.fielderId);
  const setFielderId = useScoringUIStore((s) => s.setFielderId);
  const wicketExtraType = useScoringUIStore((s) => s.wicketExtraType);
  const setWicketExtraType = useScoringUIStore((s) => s.setWicketExtraType);
  const dismissedPlayerId = useScoringUIStore((s) => s.dismissedPlayerId);
  const setDismissedPlayerId = useScoringUIStore(
    (s) => s.setDismissedPlayerId,
  );
  const runsCompletedBeforeRunOut = useScoringUIStore(
    (s) => s.runsCompletedBeforeRunOut,
  );
  const setRunsCompletedBeforeRunOut = useScoringUIStore(
    (s) => s.setRunsCompletedBeforeRunOut,
  );

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
    isOffline,
    pendingCount,
    flushOfflineQueue,
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
  const [showPenaltyBonusDialog, setShowPenaltyBonusDialog] = useState(false);
  const [showAbandonMatchDialog, setShowAbandonMatchDialog] = useState(false);
  const [showReviseTargetDialog, setShowReviseTargetDialog] = useState(false);
  const [retireTarget, setRetireTarget] = useState<{
    playerId: string;
    playerName: string;
  } | null>(null);
  const [reassignOverDeliveries, setReassignOverDeliveries] = useState(false);
  const [editingDelivery, setEditingDelivery] = useState<DeliveryToEdit | null>(
    null,
  );
  const [mobileTab, setMobileTab] = useState<"score" | "squads">("score");
  const [actionsMenuOpen, setActionsMenuOpen] = useState(false);

  const currentInnings = match?.innings?.find(
    (i) => i.innings_number === match?.current_innings,
  );
  const isFreeHit =
    rawDeliveries.length > 0 &&
    rawDeliveries[rawDeliveries.length - 1]?.extra_type === "no_ball";
  const battingTeam = currentInnings
    ? (currentInnings.team_id === match?.team1_id ? match?.team1 : match?.team2)
    : match?.team1;
  const bowlingTeam = currentInnings
    ? (currentInnings.team_id === match?.team1_id ? match?.team2 : match?.team1)
    : match?.team2;

  const showTossDialog = match?.status === "scheduled" && !tossDialogDismissed;
  const tossWinner = selectedTossWinner || match?.team1_id || "";

  // Keyboard scoring hotkeys must stay inert while any dialog/menu is open,
  // otherwise typing in a dialog silently records balls behind it.
  const scoringKeyboardSuppressed =
    showTossDialog ||
    showSelectBatsmen ||
    showSelectBowler ||
    showWicketDialog ||
    showAddPlayerDialog ||
    showPotmDialog ||
    showEditBallDialog ||
    showMatchSettingsDialog ||
    showPenaltyBonusDialog ||
    showAbandonMatchDialog ||
    showReviseTargetDialog ||
    Boolean(retireTarget) ||
    actionsMenuOpen;

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

  const strikerDisplay = useMemo(() => {
    if (!strikerId) return null;
    const player = battingTeamPlayers.find((p) => p.user_id === strikerId);
    const perf = currentInnings?.batting_performances?.find(
      (bp) => bp.user_id === strikerId,
    );
    return {
      id: strikerId,
      name: player?.user?.full_name ?? perf?.user?.full_name ?? "Striker",
      runs: perf?.runs_scored ?? 0,
      balls: perf?.balls_faced ?? 0,
      fours: perf?.fours ?? 0,
      sixes: perf?.sixes ?? 0,
      isStriker: true,
    };
  }, [strikerId, battingTeamPlayers, currentInnings]);

  const nonStrikerDisplay = useMemo(() => {
    if (!nonStrikerId) return null;
    const player = battingTeamPlayers.find((p) => p.user_id === nonStrikerId);
    const perf = currentInnings?.batting_performances?.find(
      (bp) => bp.user_id === nonStrikerId,
    );
    return {
      id: nonStrikerId,
      name: player?.user?.full_name ?? perf?.user?.full_name ?? "Non-Striker",
      runs: perf?.runs_scored ?? 0,
      balls: perf?.balls_faced ?? 0,
      fours: perf?.fours ?? 0,
      sixes: perf?.sixes ?? 0,
      isStriker: false,
    };
  }, [nonStrikerId, battingTeamPlayers, currentInnings]);

  const bowlerDisplay = useMemo(() => {
    if (!currentBowlerId) return null;
    const player = bowlingTeamPlayers.find((p) => p.user_id === currentBowlerId);
    const perf = currentInnings?.bowling_performances?.find(
      (bp) => bp.user_id === currentBowlerId,
    );
    return {
      id: currentBowlerId,
      name: player?.user?.full_name ?? perf?.user?.full_name ?? "Bowler",
      overs: perf?.overs_bowled ?? 0,
      maidens: perf?.maidens ?? 0,
      runs: perf?.runs_conceded ?? 0,
      wickets: perf?.wickets_taken ?? 0,
    };
  }, [currentBowlerId, bowlingTeamPlayers, currentInnings]);

  const isInningsComplete = useMemo(() => {
    if (!match || match.status !== "live") return false;
    const inn = currentInnings;
    if (!inn) return false;

    // Check all out
    const wicketsLimit = match.wickets_per_innings ?? 10;
    if ((inn.total_wickets ?? 0) >= wicketsLimit) return true;

    // Check overs limit
    const oversLimit = match.overs_per_innings;
    const bpo = match.balls_per_over || 6;
    if (
      oversLimit > 0 &&
      ((inn.total_balls ?? 0) >= oversLimit * bpo ||
        ((match.current_over ?? 0) >= oversLimit &&
          (match.current_ball ?? 0) === 0))
    ) {
      return true;
    }

    // Check target chased (2nd innings)
    if (inn.target_runs !== null && inn.target_runs !== undefined) {
      if ((inn.total_runs ?? 0) >= inn.target_runs) return true;
    }

    return inn.is_completed ?? false;
  }, [match, currentInnings]);

  const isOverComplete = useMemo(() => {
    if (!match || match.status !== "live" || isInningsComplete) return false;
    return !currentBowlerId && Boolean(strikerId) && Boolean(nonStrikerId);
  }, [match, isInningsComplete, currentBowlerId, strikerId, nonStrikerId]);

  const isScoringDisabled = useMemo(() => {
    return (
      !isScorer ||
      isProcessing ||
      match?.status !== "live" ||
      !currentBowlerId ||
      !strikerId ||
      !nonStrikerId ||
      isInningsComplete
    );
  }, [
    isScorer,
    isProcessing,
    match?.status,
    currentBowlerId,
    strikerId,
    nonStrikerId,
    isInningsComplete,
  ]);

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
    const {
      addPlayerTarget,
      newPlayerName,
      setNewPlayerName,
      setAddPlayerTarget,
    } = useScoringUIStore.getState();
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
    const { addPlayerTeam, newPlayerName, setNewPlayerName } =
      useScoringUIStore.getState();
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

  const handleRetirePlayerConfirm = async ({
    playerId,
    type,
    reason,
  }: {
    playerId: string;
    type: "retired_hurt" | "retired_out";
    reason?: string | null;
  }) => {
    if (!match) return;
    const res = await retirePlayer(match.id, {
      playerId,
      type,
      reason,
    });
    if (res.error) {
      toast.error(res.error);
    } else {
      toast.success(
        `Batsman retired (${type === "retired_hurt" ? "Retired Hurt" : "Retired Out"})`,
      );
      if (strikerId === playerId) {
        setStrikerId("");
      }
      if (nonStrikerId === playerId) {
        setNonStrikerId("");
      }
      await syncFromDb();
      setShowSelectBatsmen(true);
    }
  };

  const handleAwardPenaltyConfirm = async (params: {
    teamId: string;
    runs: number;
    reason: string;
    type: "penalty" | "bonus";
  }) => {
    if (!match) return;
    const res = await awardTeamPenalty(match.id, params);
    if (res.error) {
      toast.error(res.error);
    } else {
      toast.success(
        `${params.type === "penalty" ? "Penalty" : "Bonus"} of ${params.runs} runs recorded`,
      );
      await syncFromDb();
    }
  };

  const handleAbandonMatchConfirm = async (params: {
    reason: string;
    resultType: "abandoned" | "no_result" | "win";
    winningTeamId?: string | null;
    notes?: string | null;
  }) => {
    if (!match) return;
    const res = await abandonMatch(match.id, params);
    if (res.error) {
      toast.error(res.error);
    } else {
      toast.success("Match marked as abandoned");
      await syncFromDb();
    }
  };

  const handleReviseTargetConfirm = async (params: {
    targetRuns: number | null;
    overs?: number | null;
  }) => {
    if (!match) return;
    const res = await updateTargetRuns(match.id, params);
    if (res.error) {
      toast.error(res.error);
    } else {
      toast.success("Target updated successfully");
      await syncFromDb();
    }
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

  return (
    <div
      data-sunlight={sunlightMode ? "true" : "false"}
      className={cn(
        "min-h-screen bg-background w-full max-w-full overflow-x-hidden",
        sunlightMode && "sunlight-mode",
      )}
    >
      <a
        href="#main-scoring-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-50 focus:rounded-lg focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground focus:shadow-lg focus:ring-2 focus:ring-ring"
      >
        Skip to scoring console
      </a>

      {/* Dedicated Scorer Console Header (Distraction-Free) */}
      <header
        className={cn(
          "sticky top-0 z-30 border-b bg-card/95 backdrop-blur-md",
          sunlightMode
            ? "border-b-2 border-black bg-white"
            : "border-border/80 dark:border-[#242f29] dark:bg-[#0d1210]/95",
        )}
      >
        <div className="container mx-auto flex h-11 w-full max-w-full items-center justify-between px-2.5 sm:h-12 sm:px-4">
          {/* Left: Back Arrow + Match Title & Format */}
          <div className="flex min-w-0 items-center gap-1.5 sm:gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0 rounded-lg text-muted-foreground hover:text-foreground"
              asChild
            >
              <Link
                href={`/matches/${match.id}`}
                aria-label="Exit scoring and return to match details"
                title="Exit scoring"
              >
                <ChevronLeft className="h-5 w-5" />
              </Link>
            </Button>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <h1 className="truncate text-xs font-black sm:text-sm">
                  {match.team1.short_name || match.team1.name} vs{" "}
                  {match.team2.short_name || match.team2.name}
                </h1>
                <Badge
                  variant={match.status === "live" ? "default" : "secondary"}
                  className="hidden h-4 px-1.5 text-[9px] font-black uppercase sm:inline-flex"
                >
                  {match.status}
                </Badge>
              </div>
              <p className="truncate text-[10px] text-muted-foreground sm:text-xs">
                {match.title} • {match.match_format.toUpperCase()}
              </p>
            </div>
          </div>

          {/* Right: Quick Tools & Consolidated Actions Menu */}
          <div className="flex shrink-0 items-center gap-1 sm:gap-2">
            {/* Offline indicator */}
            {isOffline && (
              <span
                role="status"
                title="Working offline — changes saved locally"
                className="flex items-center gap-1 rounded-full border border-amber-500/40 bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold text-amber-800 dark:text-amber-300"
              >
                <WifiOff className="h-3 w-3 shrink-0" aria-hidden="true" />
                <span className="hidden sm:inline">OFFLINE</span>
                {pendingCount > 0 && <span>({pendingCount})</span>}
              </span>
            )}
            {/* Sunlight indicator */}
            {sunlightMode && (
              <span className="hidden items-center gap-1 rounded-full border border-black bg-black px-2 py-0.5 text-[10px] font-black text-white sm:inline-flex">
                <Sun className="h-3 w-3" /> SUN
              </span>
            )}

            {/* Awake indicator */}
            {isScreenAwake && (
              <span
                title="Screen wake lock active to prevent display timeout"
                className="hidden items-center gap-1 rounded-full border border-emerald-600 bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-950 dark:border-emerald-500/40 dark:bg-emerald-950/70 dark:text-emerald-200 sm:inline-flex"
              >
                <Zap className="h-3 w-3 text-emerald-600 dark:text-emerald-400" /> AWAKE
              </span>
            )}

            {/* Start Match / Toss if scheduled */}
            {match.status === "scheduled" && isScorer && (
              <Button
                size="sm"
                onClick={() => setTossDialogDismissed(false)}
                className="h-8 gap-1 rounded-lg px-2.5 text-xs font-bold"
              >
                <Play className="h-3.5 w-3.5" />
                <span>Toss</span>
              </Button>
            )}

            {/* Desktop Direct Action: Settings */}
            {isScorer && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowMatchSettingsDialog(true)}
                className={cn(
                  "hidden h-8 gap-1.5 rounded-lg px-2.5 text-xs font-semibold md:inline-flex",
                  sunlightMode && "border-2 border-black font-bold",
                )}
                title="Match Settings & Custom Rules"
              >
                <SlidersHorizontal className="h-3.5 w-3.5" />
                <span>Settings</span>
              </Button>
            )}

            {/* Desktop Direct Action: Penalty / Bonus */}
            {match.status === "live" && isScorer && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowPenaltyBonusDialog(true)}
                className={cn(
                  "hidden h-8 gap-1.5 rounded-lg px-2.5 text-xs font-semibold md:inline-flex",
                  sunlightMode && "border-2 border-black font-bold",
                )}
                title="Award Team Penalty or Bonus Runs"
              >
                <ShieldAlert className="h-3.5 w-3.5" />
                <span>Penalty/Bonus</span>
              </Button>
            )}

            {/* Desktop Direct Action: DLS */}
            {match.status === "live" && isScorer && (
              <div className="hidden md:block">
                <DlsCalculatorModal match={match} canEdit={isScorer} />
              </div>
            )}

            {/* Desktop Direct Action: Scorers */}
            {isScorer && (
              <div className="hidden lg:block">
                <MatchScorersDialog
                  matchId={match.id}
                  isCreator={match.created_by === user?.id}
                />
              </div>
            )}

            {/* OBS Broadcast Overlay Shortcut */}
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8 rounded-lg"
              asChild
              title="Open broadcast overlay in new tab"
            >
              <Link
                href={`/overlay/${match.id}`}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Open broadcast overlay in new tab"
              >
                <Tv className="h-4 w-4" />
              </Link>
            </Button>

            {/* Consolidated "Match Actions" Menu (Primary on Mobile, Comprehensive on Desktop) */}
            <DropdownMenu onOpenChange={setActionsMenuOpen}>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  className={cn(
                    "h-8 w-8 rounded-lg",
                    sunlightMode && "border-2 border-black font-black",
                  )}
                  aria-label="Match actions and scoring options"
                  title="Match actions & scoring options"
                >
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 rounded-2xl p-1.5 shadow-xl">
                <DropdownMenuLabel className="px-2 py-1 text-[11px] font-black uppercase tracking-wider text-muted-foreground">
                  Scoring Controls
                </DropdownMenuLabel>
                {isScorer && (
                  <DropdownMenuItem
                    onClick={() => setShowMatchSettingsDialog(true)}
                    className="flex cursor-pointer items-center gap-2 rounded-xl px-2.5 py-2 text-xs font-bold"
                  >
                    <SlidersHorizontal className="h-4 w-4 text-emerald-500" />
                    <span>Match Rules & Settings</span>
                  </DropdownMenuItem>
                )}
                {match.status === "live" && isScorer && (
                  <DropdownMenuItem
                    onClick={() => setShowPenaltyBonusDialog(true)}
                    className="flex cursor-pointer items-center gap-2 rounded-xl px-2.5 py-2 text-xs font-bold"
                  >
                    <ShieldAlert className="h-4 w-4 text-rose-500" />
                    <span>Award Penalty / Bonus Runs</span>
                  </DropdownMenuItem>
                )}
                {match.status === "live" && isScorer && (
                  <DlsCalculatorModal
                    match={match}
                    canEdit={isScorer}
                    triggerButton={
                      <div className="flex w-full cursor-pointer items-center gap-2 rounded-xl px-2.5 py-2 text-xs font-bold hover:bg-muted">
                        <CloudRain className="h-4 w-4 text-sky-500" />
                        <span>DLS Rain Calculator</span>
                      </div>
                    }
                  />
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => setShowAddPlayerDialog(true)}
                  className="flex cursor-pointer items-center gap-2 rounded-xl px-2.5 py-2 text-xs font-bold"
                >
                  <UserPlus className="h-4 w-4 text-primary" />
                  <span>Add / Manage Players</span>
                </DropdownMenuItem>
                {isScorer && (
                  <MatchScorersDialog
                    matchId={match.id}
                    isCreator={match.created_by === user?.id}
                    triggerButton={
                      <div className="flex w-full cursor-pointer items-center gap-2 rounded-xl px-2.5 py-2 text-xs font-bold hover:bg-muted">
                        <Users className="h-4 w-4 text-amber-500" />
                        <span>Manage Scorers & Delegation</span>
                      </div>
                    }
                  />
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={toggleSunlightMode}
                  className="flex cursor-pointer items-center gap-2 rounded-xl px-2.5 py-2 text-xs font-bold"
                >
                  <Sun className="h-4 w-4 text-amber-500" />
                  <span>Outdoor Sunlight Mode: {sunlightMode ? "ON" : "OFF"}</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      {/* Offline Alert & Sync Banner */}
      {(isOffline || pendingCount > 0) && (
        <div
          role="status"
          aria-live="polite"
          className={cn(
            "flex flex-wrap items-center justify-between gap-2 border-b px-3 py-1.5 text-xs font-medium sm:px-6",
            isOffline
              ? "border-amber-500/40 bg-amber-500/10 text-amber-950 dark:border-amber-500/40 dark:bg-amber-950/40 dark:text-amber-200"
              : "border-sky-500/40 bg-sky-500/10 text-sky-950 dark:border-sky-500/40 dark:bg-sky-950/40 dark:text-sky-200",
          )}
        >
          <div className="flex items-center gap-2">
            <span
              className={cn(
                "h-2 w-2 rounded-full shrink-0",
                isOffline ? "bg-amber-500" : "animate-pulse bg-sky-500",
              )}
              aria-hidden="true"
            />
            <span>
              {isOffline ? (
                <>
                  <strong className="font-semibold">Offline Mode:</strong> Scoring is active. Deliveries are saved locally.
                </>
              ) : (
                <>
                  <strong className="font-semibold">Back Online:</strong> {pendingCount} offline update(s) ready to sync.
                </>
              )}
            </span>
            {pendingCount > 0 && (
              <span className="rounded-full bg-background/80 px-2 py-0.5 text-[10px] font-bold">
                {pendingCount} queued
              </span>
            )}
          </div>
          {!isOffline && pendingCount > 0 && (
            <Button
              size="sm"
              variant="outline"
              disabled={isProcessing}
              onClick={() => flushOfflineQueue()}
              className="h-7 gap-1 px-2 text-[11px] font-semibold"
            >
              <RefreshCw className={cn("h-3 w-3", isProcessing && "animate-spin")} aria-hidden="true" />
              {isProcessing ? "Syncing..." : "Sync now"}
            </Button>
          )}
        </div>
      )}

      {/* Mobile Ergonomic Tab Switcher (< lg) */}
      <div className="sticky top-11 z-20 flex items-center gap-1 border-b border-border/40 bg-background/95 px-2 py-1 backdrop-blur-md sm:top-12 lg:hidden">
        <button
          type="button"
          onClick={() => setMobileTab("score")}
          className={cn(
            "flex flex-1 items-center justify-center gap-1.5 rounded-lg py-1 text-xs font-black transition-all",
            mobileTab === "score"
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:bg-muted/50",
          )}
        >
          <Zap className="h-3.5 w-3.5 shrink-0" />
          <span>Live Scoring</span>
        </button>
        <button
          type="button"
          onClick={() => setMobileTab("squads")}
          className={cn(
            "flex flex-1 items-center justify-center gap-1.5 rounded-lg py-1 text-xs font-black transition-all",
            mobileTab === "squads"
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:bg-muted/50",
          )}
        >
          <Users className="h-3.5 w-3.5 shrink-0" />
          <span>Squads ({battingTeamPlayers.length + bowlingTeamPlayers.length})</span>
        </button>
      </div>

      <main id="main-scoring-content" className="container mx-auto grid max-w-6xl w-full min-w-0 gap-2 px-2 py-2 sm:gap-6 sm:px-4 sm:py-6 lg:grid-cols-3">
        <div
          className={cn(
            "space-y-2 sm:space-y-4 lg:col-span-2 min-w-0 w-full",
            mobileTab !== "score" && "hidden lg:block",
          )}
        >
          {match.status === "scheduled" && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-primary/30 bg-primary/10 p-4 text-emerald-950 dark:border-emerald-500/35 dark:bg-emerald-950/40 dark:text-emerald-200 dark:shadow-[inset_0_1px_0_0_rgba(52,211,153,0.2)]">
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

          <LiveMatchHUD
            match={match}
            currentInnings={currentInnings}
            battingTeamName={battingTeam?.name}
            onEndInnings={() => void handleEndInnings()}
            isProcessing={isProcessing}
            striker={strikerDisplay}
            nonStriker={nonStrikerDisplay}
            bowler={bowlerDisplay}
            lastBalls={lastBalls}
            rawDeliveries={rawDeliveries}
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
            onChangeBowler={() => {
              if (match.status === "scheduled") {
                setTossDialogDismissed(false);
                toast.info("Please record the toss to start the match");
                return;
              }
              setShowSelectBowler(true);
            }}
            onSelectBall={(idx) => {
              const d = rawDeliveries[idx];
              if (d) {
                setEditingDelivery(d);
                setShowEditBallDialog(true);
              }
            }}
            onRetireStriker={() => {
              if (strikerDisplay) {
                setRetireTarget({
                  playerId: strikerDisplay.id,
                  playerName: strikerDisplay.name,
                });
              }
            }}
            onRetireNonStriker={() => {
              if (nonStrikerDisplay) {
                setRetireTarget({
                  playerId: nonStrikerDisplay.id,
                  playerName: nonStrikerDisplay.name,
                });
              }
            }}
            onReviseTarget={() => setShowReviseTargetDialog(true)}
            sunlightMode={sunlightMode}
          />

          {/* Innings Complete Banner */}
          {isInningsComplete && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 sm:p-4 text-amber-950 dark:border-amber-500/40 dark:bg-amber-950/40 dark:text-amber-200">
              <div className="space-y-0.5">
                <p className="flex items-center gap-1.5 text-xs sm:text-sm font-bold">
                  <Award className="h-4 w-4 text-amber-500 shrink-0" />
                  Innings Complete
                </p>
                <p className="text-[11px] sm:text-xs text-muted-foreground">
                  {match.current_innings === 1
                    ? "1st Innings has concluded. End innings to switch sides and set 2nd innings target."
                    : "Match has reached target or overs limit."}
                </p>
              </div>
              {match.current_innings === 1 && isScorer && (
                <Button
                  size="sm"
                  onClick={() => void handleEndInnings()}
                  disabled={isProcessing}
                  className="font-bold bg-amber-600 hover:bg-amber-500 text-white text-xs h-8"
                >
                  End Innings & Switch Sides
                </Button>
              )}
            </div>
          )}

          {/* Over Complete — Select Bowler Banner */}
          {isOverComplete && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-sky-500/40 bg-sky-500/10 p-3 sm:p-4 text-sky-950 dark:border-sky-500/40 dark:bg-sky-950/40 dark:text-sky-200">
              <div className="space-y-0.5">
                <p className="flex items-center gap-1.5 text-xs sm:text-sm font-bold">
                  <Users className="h-4 w-4 text-sky-500 shrink-0" />
                  Over {match.current_over} Complete
                </p>
                <p className="text-[11px] sm:text-xs text-muted-foreground">
                  Select the bowler for over {match.current_over + 1} to resume scoring.
                </p>
              </div>
              {isScorer && (
                <Button
                  size="sm"
                  onClick={() => setShowSelectBowler(true)}
                  disabled={isProcessing}
                  className="font-bold text-xs h-8"
                >
                  Select Bowler
                </Button>
              )}
            </div>
          )}

          {/* Select Batsmen Banner */}
          {match.status === "live" &&
            (!strikerId || !nonStrikerId) &&
            !isInningsComplete && (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 sm:p-4 text-amber-950 dark:border-amber-500/40 dark:bg-amber-950/40 dark:text-amber-200">
                <div className="space-y-0.5">
                  <p className="flex items-center gap-1.5 text-xs sm:text-sm font-bold">
                    <Users className="h-4 w-4 text-amber-500 shrink-0" />
                    Batsman Selection Required
                  </p>
                  <p className="text-[11px] sm:text-xs text-muted-foreground">
                    A wicket has fallen or batsmen need to be set to resume scoring.
                  </p>
                </div>
                {isScorer && (
                  <Button
                    size="sm"
                    onClick={() => setShowSelectBatsmen(true)}
                    disabled={isProcessing}
                    className="font-bold text-xs h-8"
                  >
                    Select Batsmen
                  </Button>
                )}
              </div>
            )}

          <ScoringPanel
            onScore={onScore}
            onWicket={openWicketDialog}
            onUndo={() => void handleUndo()}
            onEditLastBall={() => {
              const d = rawDeliveries[rawDeliveries.length - 1];
              if (d) {
                setEditingDelivery(d);
                setShowEditBallDialog(true);
              }
            }}
            onSwapStriker={() => {
              if (strikerId && nonStrikerId && !isProcessing) {
                void handleConfirmBatsmen(nonStrikerId, strikerId);
              }
            }}
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
            isFreeHit={isFreeHit}
            disabled={isScoringDisabled}
            undoDisabled={!isScorer || isProcessing || match?.status !== "live"}
            keyboardSuppressed={scoringKeyboardSuppressed}
            sunlightMode={sunlightMode}
            onToggleSunlightMode={toggleSunlightMode}
            wagonWheelPrompt={wagonWheelPrompt}
            onToggleWagonWheelPrompt={toggleWagonWheelPrompt}
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

        <div
          className={cn(
            "space-y-4",
            mobileTab !== "squads" && "hidden lg:block",
          )}
        >
          <Card className="content-visibility-auto">
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

          {/* Desktop Match Rules & Extras Breakdown Card */}
          <Card className="hidden lg:block">
            <CardContent className="p-4 space-y-3">
              <h3 className="flex items-center gap-2 text-sm font-semibold">
                <SlidersHorizontal className="h-4 w-4 text-emerald-500" /> Match Insights
              </h3>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-xl border border-border/60 bg-muted/30 p-2">
                  <p className="text-[10px] uppercase font-bold text-muted-foreground">Format</p>
                  <p className="font-extrabold text-foreground">{match.match_format || "Custom"}</p>
                </div>
                <div className="rounded-xl border border-border/60 bg-muted/30 p-2">
                  <p className="text-[10px] uppercase font-bold text-muted-foreground">Overs</p>
                  <p className="font-extrabold tabular-nums text-foreground">{match.overs_per_innings} ov ({match.balls_per_over ?? 6}b/ov)</p>
                </div>
              </div>

              {currentInnings && (
                <div className="rounded-xl border border-border/60 bg-muted/30 p-2.5 text-xs space-y-1">
                  <div className="flex items-center justify-between font-bold">
                    <span className="text-muted-foreground">Innings Extras:</span>
                    <span className="tabular-nums font-black text-foreground">{currentInnings.extras_total ?? 0}</span>
                  </div>
                  <div className="flex flex-wrap gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground">
                    <span>Wd: <strong className="text-foreground">{currentInnings.extras_wides ?? 0}</strong></span>
                    <span>Nb: <strong className="text-foreground">{currentInnings.extras_no_balls ?? 0}</strong></span>
                    <span>B: <strong className="text-foreground">{currentInnings.extras_byes ?? 0}</strong></span>
                    <span>Lb: <strong className="text-foreground">{currentInnings.extras_leg_byes ?? 0}</strong></span>
                    <span>Pen: <strong className="text-foreground">{currentInnings.extras_penalties ?? 0}</strong></span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>

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
        onAddPlayer={onAddPlayer}
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
        onAddPlayer={onAddPlayer}
      />

      <AddPlayerDialog
        open={showAddPlayerDialog}
        onOpenChange={setShowAddPlayerDialog}
        teamName={battingTeam?.name ?? match.team1?.name}
        bowlingTeamName={bowlingTeam?.name ?? match.team2?.name}
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
        isFreeHit={isFreeHit}
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
        onOpenAbandon={() => {
          setShowMatchSettingsDialog(false);
          setShowAbandonMatchDialog(true);
        }}
        isProcessing={isProcessing}
      />

      <PenaltyBonusDialog
        open={showPenaltyBonusDialog}
        onOpenChange={setShowPenaltyBonusDialog}
        battingTeam={battingTeam}
        bowlingTeam={bowlingTeam}
        onConfirm={handleAwardPenaltyConfirm}
        isProcessing={isProcessing}
      />

      <AbandonMatchDialog
        open={showAbandonMatchDialog}
        onOpenChange={setShowAbandonMatchDialog}
        team1={match.team1}
        team2={match.team2}
        onConfirm={handleAbandonMatchConfirm}
        isProcessing={isProcessing}
      />

      <RetirePlayerDialog
        open={Boolean(retireTarget)}
        onOpenChange={(open) => {
          if (!open) setRetireTarget(null);
        }}
        playerId={retireTarget?.playerId ?? ""}
        playerName={retireTarget?.playerName ?? ""}
        onConfirm={handleRetirePlayerConfirm}
        isProcessing={isProcessing}
      />

      <ReviseTargetDialog
        open={showReviseTargetDialog}
        onOpenChange={setShowReviseTargetDialog}
        currentTarget={currentInnings?.target_runs}
        currentOvers={match.overs_per_innings}
        onConfirm={handleReviseTargetConfirm}
        isProcessing={isProcessing}
      />
    </div>
  );
}
