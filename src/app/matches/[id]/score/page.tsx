"use client";

import { useCallback, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Button } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/card";
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
const SquadManagerDialog = dynamic(
  () =>
    import("./components/SquadManagerDialog").then((m) => m.SquadManagerDialog),
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
const InviteDialog = dynamic(
  () => import("~/components/invite-dialog").then((m) => m.InviteDialog),
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
  MoreVertical,
  CloudRain,
  WifiOff,
  RefreshCw,
  Eye,
  Lock,
  Clock,
  ChevronDown,
  Volume2,
  Keyboard,
  Compass,
  HeartPulse,
  Crosshair,
} from "lucide-react";
import { economyRate } from "~/lib/cricket";
import { LiveIndicator } from "~/components/matches/live-indicator";

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
  const voiceAnnouncements = usePreferencesStore((s) => s.voiceAnnouncements);
  const toggleVoiceAnnouncements = usePreferencesStore(
    (s) => s.toggleVoiceAnnouncements,
  );
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [showInviteDialog, setShowInviteDialog] = useState(false);

  // UI state managed via Zustand store — granular selectors keep the page
  // from re-rendering on high-frequency form fields (player-name typing).
  const tossDialogDismissed = useScoringUIStore((s) => s.tossDialogDismissed);
  const setTossDialogDismissed = useScoringUIStore(
    (s) => s.setTossDialogDismissed,
  );
  const showSelectBatsmen = useScoringUIStore((s) => s.showBatsmenDialog);
  const setShowSelectBatsmen = useScoringUIStore((s) => s.setShowSelectBatsmen);
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
  const setDismissedPlayerId = useScoringUIStore((s) => s.setDismissedPlayerId);
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
    deadLetterCount,
    flushOfflineQueue,
    handleSkipHeadAction,
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
    loadPlayers,
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
  const [actionsMenuOpen, setActionsMenuOpen] = useState(false);

  const currentInnings = match?.innings?.find(
    (i) => i.innings_number === match?.current_innings,
  );
  const isFreeHit =
    rawDeliveries.length > 0 &&
    rawDeliveries[rawDeliveries.length - 1]?.extra_type === "no_ball";
  const battingTeam = currentInnings
    ? currentInnings.team_id === match?.team1_id
      ? match?.team1
      : match?.team2
    : match?.team1;
  const bowlingTeam = currentInnings
    ? currentInnings.team_id === match?.team1_id
      ? match?.team2
      : match?.team1
    : match?.team2;

  const showTossDialog =
    isScorer && match?.status === "scheduled" && !tossDialogDismissed;
  const tossWinner = selectedTossWinner || match?.team1_id || "";

  // Keyboard scoring hotkeys must stay inert while any dialog/menu is open or when user is not scorer,
  // otherwise typing in a dialog silently records balls behind it.
  const scoringKeyboardSuppressed =
    !isScorer ||
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
    showShortcuts ||
    showInviteDialog ||
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
    const player = bowlingTeamPlayers.find(
      (p) => p.user_id === currentBowlerId,
    );
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

  // Interactive Batting Bench & Order Breakdown
  const battingBench = useMemo(() => {
    const performances = currentInnings?.batting_performances ?? [];
    const perfMap = new Map(performances.map((p) => [p.user_id, p]));

    const active: Array<{
      playerId: string;
      name: string;
      isStriker: boolean;
      runs: number;
      balls: number;
      fours: number;
      sixes: number;
    }> = [];

    const dismissed: Array<{
      playerId: string;
      name: string;
      runs: number;
      balls: number;
      fours: number;
      sixes: number;
      dismissalType?: string | null;
    }> = [];

    const yetToBat: Array<{
      playerId: string;
      name: string;
    }> = [];

    // 1. Dismissed players
    for (const p of performances) {
      if (p.is_out) {
        const teamPlayer = battingTeamPlayers.find(
          (tp) => tp.user_id === p.user_id,
        );
        dismissed.push({
          playerId: p.user_id,
          name: teamPlayer?.user?.full_name ?? p.user?.full_name ?? "Batter",
          runs: p.runs_scored ?? 0,
          balls: p.balls_faced ?? 0,
          fours: p.fours ?? 0,
          sixes: p.sixes ?? 0,
          dismissalType: p.dismissal_type,
        });
      }
    }

    // 2. Currently batting
    if (strikerId) {
      const p = perfMap.get(strikerId);
      const teamPlayer = battingTeamPlayers.find(
        (tp) => tp.user_id === strikerId,
      );
      active.push({
        playerId: strikerId,
        name: teamPlayer?.user?.full_name ?? strikerDisplay?.name ?? "Striker",
        isStriker: true,
        runs: p?.runs_scored ?? strikerDisplay?.runs ?? 0,
        balls: p?.balls_faced ?? strikerDisplay?.balls ?? 0,
        fours: p?.fours ?? strikerDisplay?.fours ?? 0,
        sixes: p?.sixes ?? strikerDisplay?.sixes ?? 0,
      });
    }
    if (nonStrikerId && nonStrikerId !== strikerId) {
      const p = perfMap.get(nonStrikerId);
      const teamPlayer = battingTeamPlayers.find(
        (tp) => tp.user_id === nonStrikerId,
      );
      active.push({
        playerId: nonStrikerId,
        name:
          teamPlayer?.user?.full_name ??
          nonStrikerDisplay?.name ??
          "Non-Striker",
        isStriker: false,
        runs: p?.runs_scored ?? nonStrikerDisplay?.runs ?? 0,
        balls: p?.balls_faced ?? nonStrikerDisplay?.balls ?? 0,
        fours: p?.fours ?? nonStrikerDisplay?.fours ?? 0,
        sixes: p?.sixes ?? nonStrikerDisplay?.sixes ?? 0,
      });
    }

    // 3. Yet to bat
    for (const tp of battingTeamPlayers) {
      if (tp.user_id === strikerId || tp.user_id === nonStrikerId) continue;
      const perf = perfMap.get(tp.user_id);
      if (!perf || !perf.is_out) {
        yetToBat.push({
          playerId: tp.user_id,
          name: tp.user?.full_name ?? "Player",
        });
      }
    }

    return { active, dismissed, yetToBat };
  }, [
    currentInnings,
    battingTeamPlayers,
    strikerId,
    nonStrikerId,
    strikerDisplay,
    nonStrikerDisplay,
  ]);

  // Bowler Spell Breakdown
  const bowlingSpells = useMemo(() => {
    const bowlingPerfs = currentInnings?.bowling_performances ?? [];
    return bowlingPerfs.map((bp) => {
      const teamPlayer = bowlingTeamPlayers.find(
        (tp) => tp.user_id === bp.user_id,
      );
      const bpo = match?.balls_per_over ?? 6;
      return {
        playerId: bp.user_id,
        name: teamPlayer?.user?.full_name ?? bp.user?.full_name ?? "Bowler",
        overs: bp.overs_bowled ?? 0,
        maidens: bp.maidens ?? 0,
        runs: bp.runs_conceded ?? 0,
        wickets: bp.wickets_taken ?? 0,
        econ: economyRate(bp.runs_conceded ?? 0, bp.balls_bowled ?? 0, bpo),
        isCurrent: bp.user_id === currentBowlerId,
      };
    });
  }, [
    currentInnings,
    bowlingTeamPlayers,
    currentBowlerId,
    match?.balls_per_over,
  ]);

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

  const createSquadPlayer = async (side: "batting" | "bowling", name: string) =>
    handleAddPlayerInline(
      side,
      name,
      match,
      strikerId,
      nonStrikerId,
      currentBowlerId,
    );

  const refreshSquads = async () => {
    if (match) await loadPlayers(match);
  };

  const squadActiveIds = useMemo(
    () =>
      new Set(
        [strikerId, nonStrikerId, currentBowlerId].filter((id): id is string =>
          Boolean(id),
        ),
      ),
    [strikerId, nonStrikerId, currentBowlerId],
  );

  const squadUsedIds = useMemo(() => {
    const ids = new Set<string>();
    for (const inn of match?.innings ?? []) {
      for (const bp of inn.batting_performances ?? []) ids.add(bp.user_id);
      for (const bw of inn.bowling_performances ?? []) ids.add(bw.user_id);
    }
    return ids;
  }, [match?.innings]);

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
        setStrikerId(null);
      }
      if (nonStrikerId === playerId) {
        setNonStrikerId(null);
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

  return (
    <div
      data-sunlight={sunlightMode ? "true" : "false"}
      className={cn(
        "min-h-screen w-full max-w-full overflow-x-hidden bg-background",
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
                <h1 className="truncate text-xs font-semibold sm:text-sm">
                  {match.team1.short_name || match.team1.name} vs{" "}
                  {match.team2.short_name || match.team2.name}
                </h1>
                {match.status === "live" ? (
                  <LiveIndicator className="hidden sm:inline-flex" />
                ) : (
                  <Badge
                    variant="secondary"
                    className="hidden h-4 px-1.5 text-[10px] font-medium capitalize sm:inline-flex"
                  >
                    {match.status}
                  </Badge>
                )}
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
                <span className="hidden sm:inline">Offline</span>
                {pendingCount > 0 && <span>({pendingCount})</span>}
              </span>
            )}
            {/* Sunlight indicator */}
            {sunlightMode && (
              <span className="hidden items-center gap-1 rounded-full border border-black bg-black px-2 py-0.5 text-[10px] font-semibold text-white sm:inline-flex">
                <Sun className="h-3 w-3" aria-hidden="true" /> Sun
              </span>
            )}

            {/* Awake indicator */}
            {isScreenAwake && (
              <span
                title="Screen wake lock active to prevent display timeout"
                className="hidden items-center gap-1 rounded-full border border-border px-2 py-0.5 text-[10px] font-medium text-muted-foreground sm:inline-flex"
              >
                Awake
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

            {/* Squads (phones; the sidebar shows them on larger screens) */}
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8 rounded-lg lg:hidden"
              onClick={() => setShowAddPlayerDialog(true)}
              aria-label="Open squads"
              title="Squads"
            >
              <Users className="h-4 w-4" />
            </Button>

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

            {/* Consolidated "Match Tools" Menu (Clean on Desktop & Mobile) */}
            <DropdownMenu onOpenChange={setActionsMenuOpen}>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className={cn(
                    "h-8 gap-1.5 rounded-lg px-2 text-xs font-medium sm:px-2.5",
                    sunlightMode && "border-2 border-black font-bold",
                  )}
                  aria-label="Match actions and scoring options"
                  title="Match tools & scoring options"
                >
                  <SlidersHorizontal className="h-3.5 w-3.5 shrink-0" />
                  <span className="hidden sm:inline">Match tools</span>
                  <ChevronDown className="hidden h-3 w-3 opacity-60 sm:inline" />
                  <MoreVertical className="h-3.5 w-3.5 sm:hidden" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="w-56 rounded-xl p-1.5"
              >
                <DropdownMenuLabel className="px-2 py-1 text-xs font-medium text-muted-foreground">
                  Scoring controls
                </DropdownMenuLabel>
                {isScorer && (
                  <DropdownMenuItem
                    onClick={() => setShowMatchSettingsDialog(true)}
                    className="flex cursor-pointer items-center gap-2 rounded-xl px-2.5 py-2 text-xs font-medium"
                  >
                    <SlidersHorizontal className="h-4 w-4 text-muted-foreground" />
                    <span>Match rules & settings</span>
                  </DropdownMenuItem>
                )}
                {match.status === "live" && isScorer && (
                  <DropdownMenuItem
                    onClick={() => setShowReviseTargetDialog(true)}
                    className="flex cursor-pointer items-center gap-2 rounded-xl px-2.5 py-2 text-xs font-medium"
                  >
                    <Crosshair className="h-4 w-4 text-muted-foreground" />
                    <span>Revise target / overs</span>
                  </DropdownMenuItem>
                )}
                {match.status === "live" && isScorer && strikerDisplay && (
                  <DropdownMenuItem
                    onClick={() =>
                      setRetireTarget({
                        playerId: strikerDisplay.id,
                        playerName: strikerDisplay.name,
                      })
                    }
                    className="flex cursor-pointer items-center gap-2 rounded-xl px-2.5 py-2 text-xs font-medium"
                  >
                    <HeartPulse className="h-4 w-4 text-muted-foreground" />
                    <span>Retire {strikerDisplay.name}</span>
                  </DropdownMenuItem>
                )}
                {match.status === "live" && isScorer && nonStrikerDisplay && (
                  <DropdownMenuItem
                    onClick={() =>
                      setRetireTarget({
                        playerId: nonStrikerDisplay.id,
                        playerName: nonStrikerDisplay.name,
                      })
                    }
                    className="flex cursor-pointer items-center gap-2 rounded-xl px-2.5 py-2 text-xs font-medium"
                  >
                    <HeartPulse className="h-4 w-4 text-muted-foreground" />
                    <span>Retire {nonStrikerDisplay.name}</span>
                  </DropdownMenuItem>
                )}
                {match.status === "live" && isScorer && (
                  <DropdownMenuItem
                    onClick={() => setShowPenaltyBonusDialog(true)}
                    className="flex cursor-pointer items-center gap-2 rounded-xl px-2.5 py-2 text-xs font-medium"
                  >
                    <ShieldAlert className="h-4 w-4 text-muted-foreground" />
                    <span>Penalty / bonus runs</span>
                  </DropdownMenuItem>
                )}
                {match.status === "live" && isScorer && (
                  <DlsCalculatorModal
                    match={match}
                    canEdit={isScorer}
                    triggerButton={
                      <div className="flex w-full cursor-pointer items-center gap-2 rounded-xl px-2.5 py-2 text-xs font-medium hover:bg-muted">
                        <CloudRain className="h-4 w-4 text-muted-foreground" />
                        <span>DLS calculator</span>
                      </div>
                    }
                  />
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => setShowAddPlayerDialog(true)}
                  className="flex cursor-pointer items-center gap-2 rounded-xl px-2.5 py-2 text-xs font-medium"
                >
                  <UserPlus className="h-4 w-4 text-muted-foreground" />
                  <span>Squads &amp; players</span>
                </DropdownMenuItem>
                {isScorer && (
                  <MatchScorersDialog
                    matchId={match.id}
                    isCreator={match.created_by === user?.id}
                    triggerButton={
                      <div className="flex w-full cursor-pointer items-center gap-2 rounded-xl px-2.5 py-2 text-xs font-medium hover:bg-muted">
                        <Users className="h-4 w-4 text-muted-foreground" />
                        <span>Add or invite scorers</span>
                      </div>
                    }
                  />
                )}
                <DropdownMenuItem
                  onSelect={() => setShowInviteDialog(true)}
                  className="flex cursor-pointer items-center gap-2 rounded-xl px-2.5 py-2 text-xs font-medium"
                >
                  <UserPlus className="h-4 w-4 text-muted-foreground" />
                  <span>Invite someone to CricScore</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuLabel className="px-2 py-1 text-xs font-medium text-muted-foreground">
                  Scoring preferences
                </DropdownMenuLabel>
                <DropdownMenuItem
                  onClick={toggleWagonWheelPrompt}
                  className="flex cursor-pointer items-center gap-2 rounded-xl px-2.5 py-2 text-xs font-medium"
                >
                  <Compass className="h-4 w-4 text-muted-foreground" />
                  <span>
                    Wagon wheel prompt: {wagonWheelPrompt ? "On" : "Off"}
                  </span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={toggleVoiceAnnouncements}
                  className="flex cursor-pointer items-center gap-2 rounded-xl px-2.5 py-2 text-xs font-medium"
                >
                  <Volume2 className="h-4 w-4 text-muted-foreground" />
                  <span>
                    Voice announcements: {voiceAnnouncements ? "On" : "Off"}
                  </span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={toggleSunlightMode}
                  className="flex cursor-pointer items-center gap-2 rounded-xl px-2.5 py-2 text-xs font-medium"
                >
                  <Sun className="h-4 w-4 text-muted-foreground" />
                  <span>
                    Sunlight mode: {sunlightMode ? "On" : "Off"}
                  </span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => setShowShortcuts(true)}
                  className="hidden cursor-pointer items-center gap-2 rounded-xl px-2.5 py-2 text-xs font-medium sm:flex"
                >
                  <Keyboard className="h-4 w-4 text-muted-foreground" />
                  <span>Keyboard shortcuts</span>
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
                "h-2 w-2 shrink-0 rounded-full",
                isOffline ? "bg-amber-500" : "bg-sky-500",
              )}
              aria-hidden="true"
            />
            <span>
              {isOffline ? (
                <>
                  <strong className="font-semibold">Offline:</strong>{" "}
                  Scoring is active. Deliveries are saved locally.
                </>
              ) : (
                <>
                  <strong className="font-semibold">Back online:</strong>{" "}
                  {pendingCount} offline update(s) ready to sync.
                </>
              )}
            </span>
            {pendingCount > 0 && (
              <span className="rounded-full bg-background/80 px-2 py-0.5 text-[10px] font-bold">
                {pendingCount} queued
              </span>
            )}
            {deadLetterCount > 0 && (
              <span
                className="rounded-full bg-destructive/15 px-2 py-0.5 text-[10px] font-bold text-destructive"
                title="Items that failed server validation were moved to Dead Letter Queue to unblock scoring"
              >
                {deadLetterCount} rejected
              </span>
            )}
          </div>
          {!isOffline && pendingCount > 0 && (
            <div className="flex items-center gap-1.5">
              <Button
                size="sm"
                variant="outline"
                disabled={isProcessing}
                onClick={() => flushOfflineQueue()}
                className="h-7 gap-1 px-2 text-[11px] font-semibold"
              >
                <RefreshCw
                  className={cn("h-3 w-3", isProcessing && "animate-spin")}
                  aria-hidden="true"
                />
                {isProcessing ? "Syncing..." : "Sync now"}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                disabled={isProcessing}
                onClick={() => handleSkipHeadAction()}
                className="h-7 px-2 text-[11px] font-semibold text-muted-foreground hover:text-destructive"
                title="Discard the current head item from queue if it is failing validation or causing a deadlock"
              >
                Skip stuck item
              </Button>
            </div>
          )}
        </div>
      )}

      <main
        id="main-scoring-content"
        className="container mx-auto grid w-full min-w-0 max-w-6xl gap-2 px-2 py-2 sm:gap-6 sm:px-4 sm:py-6 lg:grid-cols-3"
      >
        <div className="flex w-full min-w-0 flex-col gap-2 max-sm:min-h-[calc(100dvh-3.75rem)] sm:gap-4 lg:col-span-2">
          {match.status === "scheduled" && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card p-4">
              <div>
                <p className="flex items-center gap-1.5 text-sm font-semibold">
                  Match scheduled: toss required
                </p>
                <p className="text-xs text-muted-foreground">
                  Record the toss winner and their decision to start the match
                  and enable scoring.
                </p>
              </div>
              <Button
                size="sm"
                onClick={() => setTossDialogDismissed(false)}
                className="font-medium"
              >
                <Play className="mr-1.5 h-4 w-4" /> Record toss & start
              </Button>
            </div>
          )}

          {match.status === "completed" && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card p-4">
              <div>
                <p className="flex items-center gap-1.5 text-sm font-semibold">
                  Match completed
                </p>
                <p className="text-xs text-muted-foreground">
                  {match.result_description || "Results official"}
                </p>
              </div>
              <Button
                size="sm"
                onClick={() => setShowPotmDialog(true)}
                className="font-medium"
              >
                <Award className="mr-1.5 h-4 w-4" aria-hidden="true" />
                {match.player_of_the_match_id
                  ? "Change POTM"
                  : "Choose player of the match"}
              </Button>
            </div>
          )}

          {!isScorer && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card p-3.5 sm:p-4">
              <div className="flex min-w-0 items-center gap-3">
                <Eye className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden="true" />
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-xs font-semibold text-foreground sm:text-sm">
                      Spectator view
                    </p>
                    {match.status === "live" && <LiveIndicator />}
                  </div>
                  <p className="truncate text-[11px] text-muted-foreground sm:text-xs">
                    {user
                      ? "You are viewing as a guest. Scoring keypad is locked to match administrators."
                      : "Sign in with scorer credentials to record deliveries and manage match state."}
                  </p>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {!user ? (
                  <Button size="sm" asChild className="h-8 text-xs font-bold">
                    <Link
                      href={`/auth/login?redirect=/matches/${matchId}/score`}
                    >
                      Sign in to score
                    </Link>
                  </Button>
                ) : null}
                <Button
                  size="sm"
                  variant="outline"
                  asChild
                  className="h-8 text-xs font-bold"
                >
                  <Link href={`/matches/${matchId}`}>Match centre</Link>
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  asChild
                  className="h-8 text-xs font-bold"
                >
                  <Link href={`/overlay/${matchId}`} target="_blank">
                    Overlay
                  </Link>
                </Button>
              </div>
            </div>
          )}

          <LiveMatchHUD
            match={match}
            currentInnings={currentInnings}
            battingTeamName={battingTeam?.name}
            onEndInnings={isScorer ? () => void handleEndInnings() : undefined}
            isProcessing={isProcessing}
            striker={strikerDisplay}
            nonStriker={nonStrikerDisplay}
            bowler={bowlerDisplay}
            lastBalls={lastBalls}
            rawDeliveries={rawDeliveries}
            onSwapStriker={
              isScorer
                ? () => {
                    if (strikerId && nonStrikerId && !isProcessing) {
                      void handleConfirmBatsmen(nonStrikerId, strikerId);
                    }
                  }
                : undefined
            }
            onChangeStriker={
              isScorer
                ? () => {
                    if (match.status === "scheduled") {
                      setTossDialogDismissed(false);
                      toast.info("Please record the toss to start the match");
                      return;
                    }
                    setShowSelectBatsmen(true);
                  }
                : undefined
            }
            onChangeNonStriker={
              isScorer
                ? () => {
                    if (match.status === "scheduled") {
                      setTossDialogDismissed(false);
                      toast.info("Please record the toss to start the match");
                      return;
                    }
                    setShowSelectBatsmen(true);
                  }
                : undefined
            }
            onChangeBowler={
              isScorer
                ? () => {
                    if (match.status === "scheduled") {
                      setTossDialogDismissed(false);
                      toast.info("Please record the toss to start the match");
                      return;
                    }
                    setShowSelectBowler(true);
                  }
                : undefined
            }
            sunlightMode={sunlightMode}
          />

          {/* Innings Complete Banner */}
          {isInningsComplete && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-amber-950 dark:border-amber-500/40 dark:bg-amber-950/40 dark:text-amber-200 sm:p-4">
              <div className="space-y-0.5">
                <p className="flex items-center gap-1.5 text-xs font-bold sm:text-sm">
                  Innings complete
                </p>
                <p className="text-[11px] text-muted-foreground sm:text-xs">
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
                  className="h-8 text-xs font-semibold"
                >
                  End innings & switch sides
                </Button>
              )}
            </div>
          )}

          {/* Over Complete — Select Bowler Banner */}
          {isOverComplete && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-sky-500/40 bg-sky-500/10 p-3 text-sky-950 dark:border-sky-500/40 dark:bg-sky-950/40 dark:text-sky-200 sm:p-4">
              <div className="space-y-0.5">
                <p className="flex items-center gap-1.5 text-xs font-bold sm:text-sm">
                  Over {match.current_over} complete
                </p>
                <p className="text-[11px] text-muted-foreground sm:text-xs">
                  Select the bowler for over {match.current_over + 1} to resume
                  scoring.
                </p>
              </div>
              {isScorer && (
                <Button
                  size="sm"
                  onClick={() => setShowSelectBowler(true)}
                  disabled={isProcessing}
                  className="h-8 text-xs font-bold"
                >
                  Select bowler
                </Button>
              )}
            </div>
          )}

          {/* Select Batsmen Banner */}
          {match.status === "live" &&
            (!strikerId || !nonStrikerId) &&
            !isInningsComplete && (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-amber-950 dark:border-amber-500/40 dark:bg-amber-950/40 dark:text-amber-200 sm:p-4">
                <div className="space-y-0.5">
                  <p className="flex items-center gap-1.5 text-xs font-bold sm:text-sm">
                    Select batters to continue
                  </p>
                  <p className="text-[11px] text-muted-foreground sm:text-xs">
                    A wicket has fallen or batsmen need to be set to resume
                    scoring.
                  </p>
                </div>
                {isScorer && (
                  <Button
                    size="sm"
                    onClick={() => setShowSelectBatsmen(true)}
                    disabled={isProcessing}
                    className="h-8 text-xs font-bold"
                  >
                    Select batters
                  </Button>
                )}
              </div>
            )}

          {!isScorer ? (
            <div className="space-y-3">
              <Card className="rounded-xl border border-border bg-card shadow-sm">
                <CardContent className="space-y-3 p-3.5 sm:p-4">
                  <div className="flex items-center justify-between border-b border-border/50 pb-2">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-semibold text-foreground">
                        Over {match.current_over}
                      </h3>
                    </div>
                    <Badge
                      variant="outline"
                      className="text-[10px] font-bold text-muted-foreground"
                    >
                      {rawDeliveries.length} ball
                      {rawDeliveries.length === 1 ? "" : "s"} this over
                    </Badge>
                  </div>

                  {rawDeliveries.length > 0 ? (
                    <div className="space-y-2">
                      {rawDeliveries
                        .slice()
                        .reverse()
                        .map((d, idx) => {
                          const bowlerName =
                            bowlingTeamPlayers.find(
                              (p) => p.user_id === d.bowler_id,
                            )?.user?.full_name ??
                            bowlerDisplay?.name ??
                            "Bowler";
                          const batterName =
                            battingTeamPlayers.find(
                              (p) => p.user_id === d.batsman_id,
                            )?.user?.full_name ??
                            (d.is_wicket
                              ? "Dismissed Batter"
                              : (strikerDisplay?.name ?? "Batter"));
                          const isBoundary =
                            d.runs_scored === 4 || d.runs_scored === 6;
                          const isWicket = d.is_wicket;
                          return (
                            <div
                              key={d.id || idx}
                              className={cn(
                                "flex items-center justify-between rounded-xl border p-2.5 text-xs transition-colors",
                                isWicket
                                  ? "border-rose-500/30 bg-rose-500/10 text-rose-950 dark:text-rose-100"
                                  : isBoundary
                                    ? d.runs_scored === 6
                                      ? "border-purple-500/30 bg-purple-500/10 text-purple-950 dark:text-purple-100"
                                      : "border-emerald-500/30 bg-emerald-500/10 text-emerald-950 dark:text-emerald-100"
                                    : "border-border/50 bg-muted/30 text-foreground",
                              )}
                            >
                              <div className="flex min-w-0 items-center gap-2.5">
                                <span className="tabular w-8 shrink-0 font-score text-xs font-bold text-muted-foreground">
                                  {d.over_number}.{d.ball_number}
                                </span>
                                <div className="min-w-0">
                                  <p className="truncate font-semibold">
                                    <strong>{bowlerName}</strong> to{" "}
                                    <strong>{batterName}</strong>
                                  </p>
                                  <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                                    {d.extra_type ? (
                                      <span className="font-medium capitalize text-amber-700 dark:text-amber-400">
                                        {d.extra_type.replace("_", " ")} (
                                        {d.extras} extra
                                        {d.extras === 1 ? "" : "s"})
                                      </span>
                                    ) : null}
                                    {d.shot_zone ? (
                                      <span className="capitalize text-sky-600 dark:text-sky-400">
                                        Shot: {d.shot_zone.replace("_", " ")}
                                      </span>
                                    ) : null}
                                    {d.dismissal_type ? (
                                      <span className="font-medium capitalize text-rose-600 dark:text-rose-400">
                                        Out:{" "}
                                        {d.dismissal_type.replace("_", " ")}
                                      </span>
                                    ) : null}
                                  </div>
                                </div>
                              </div>

                              <div className="shrink-0 text-right">
                                <span
                                  className={cn(
                                    "inline-flex h-7 min-w-[28px] items-center justify-center rounded-lg px-2 font-score text-xs font-bold tabular-nums",
                                    isWicket
                                      ? "bg-red-600 text-white"
                                      : d.runs_scored === 6
                                        ? "bg-purple-600 text-white"
                                        : d.runs_scored === 4
                                          ? "bg-emerald-600 text-white"
                                          : d.runs_scored === 0 && !d.extra_type
                                            ? "bg-muted text-muted-foreground"
                                            : "border border-amber-500/30 bg-amber-500/20 text-amber-900 dark:text-amber-200",
                                  )}
                                >
                                  {isWicket
                                    ? "W"
                                    : d.extra_type
                                      ? `${d.runs_scored || 0}${d.extra_type === "wide" ? "wd" : d.extra_type === "no_ball" ? "nb" : "ex"}`
                                      : d.runs_scored}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  ) : (
                    <div className="rounded-xl border border-dashed border-border/60 py-6 text-center text-xs text-muted-foreground">
                      <Clock className="mx-auto mb-1.5 h-5 w-5 opacity-40" />
                      Awaiting the first delivery of over {match.current_over}
                      ...
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Locked Console Info Card */}
              <div className="flex items-center justify-between rounded-xl border border-border/60 bg-muted/20 px-3.5 py-2.5 text-xs text-muted-foreground">
                <div className="flex items-center gap-2">
                  <Lock className="h-3.5 w-3.5 shrink-0 text-muted-foreground/80" />
                  <span>
                    Scoring keypad locked · Live feed updates automatically
                  </span>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  asChild
                  className="h-6 text-[11px] font-bold"
                >
                  <Link href={`/matches/${matchId}`}>Full scorecard</Link>
                </Button>
              </div>
            </div>
          ) : (
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
              undoDisabled={
                !isScorer ||
                isProcessing ||
                (match?.status !== "live" && match?.status !== "completed")
              }
              keyboardSuppressed={scoringKeyboardSuppressed}
              sunlightMode={sunlightMode}
              wagonWheelPrompt={wagonWheelPrompt}
              shortcutsOpen={showShortcuts}
              onShortcutsOpenChange={setShowShortcuts}
            />
          )}

          {match.status === "completed" &&
            match.result_description?.toLowerCase().includes("tie") &&
            isScorer && (
              <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-center">
                <h4 className="text-base font-bold text-amber-800 dark:text-amber-200">
                  Match tied
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

        <div className="hidden space-y-4 lg:block">
          {/* Bench & Batting Order */}
          <Card className="content-visibility-auto rounded-xl border border-border bg-card shadow-sm">
            <CardContent className="space-y-3.5 p-4">
              <div className="flex items-center justify-between border-b border-border/50 pb-2">
                <h3 className="text-sm font-semibold">
                  <span>{battingTeam?.name ?? "Batting team"} bench</span>
                </h3>
                <Badge
                  variant="outline"
                  className="text-[10px] font-medium"
                >
                  Inns {match.current_innings}
                </Badge>
              </div>

              {/* 2. Yet To Bat */}
              {battingBench.yetToBat.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-xs font-medium text-muted-foreground">
                    Yet to bat ({battingBench.yetToBat.length})
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {battingBench.yetToBat.map((p) => (
                      <Badge
                        key={p.playerId}
                        variant="secondary"
                        className="text-[11px] font-semibold"
                      >
                        {p.name}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* 3. Dismissed Batters */}
              {battingBench.dismissed.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-xs font-medium text-muted-foreground">
                    Dismissed ({battingBench.dismissed.length})
                  </p>
                  <div className="space-y-1">
                    {battingBench.dismissed.map((d) => (
                      <div
                        key={d.playerId}
                        className="flex items-center justify-between rounded-lg border border-border px-2.5 py-1.5 text-xs"
                      >
                        <div className="min-w-0 pr-2">
                          <p className="truncate font-medium text-foreground">
                            {d.name}
                          </p>
                          <p className="truncate text-[10px] text-muted-foreground">
                            {d.dismissalType
                              ? d.dismissalType.replace("_", " ")
                              : "out"}
                          </p>
                        </div>
                        <div className="shrink-0 text-right">
                          <span className="font-score text-xs font-bold tabular-nums">
                            {d.runs}
                          </span>
                          <span className="ml-1 text-[10px] text-muted-foreground">
                            ({d.balls})
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {isScorer && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="mt-2 w-full text-xs font-bold"
                  onClick={() => setShowAddPlayerDialog(true)}
                >
                  <UserPlus className="mr-1.5 h-3.5 w-3.5" /> Manage players
                </Button>
              )}
            </CardContent>
          </Card>

          {/* Bowling Attack Spell Table */}
          {bowlingSpells.length > 0 && (
            <Card className="content-visibility-auto rounded-xl border border-border bg-card shadow-sm">
              <CardContent className="space-y-2.5 p-3.5 sm:p-4">
                <div className="flex items-center justify-between border-b border-border/50 pb-2">
                  <h3 className="text-sm font-semibold">
                    <span>{bowlingTeam?.name ?? "Bowling"} attack</span>
                  </h3>
                  <span className="text-[10px] font-semibold text-muted-foreground">
                    O · M · R · W · Econ
                  </span>
                </div>
                <div className="space-y-1.5">
                  {bowlingSpells.map((sp) => (
                    <div
                      key={sp.playerId}
                      className={cn(
                        "flex items-center justify-between rounded-xl border p-2 text-xs transition-colors",
                        sp.isCurrent
                          ? "border-foreground/30 bg-muted font-medium"
                          : "border-border/40 bg-muted/30",
                      )}
                    >
                      <div className="flex min-w-0 items-center gap-1.5">
                        <span className="truncate font-medium text-foreground">
                          {sp.name}
                          {sp.isCurrent && (
                            <span className="ml-1 text-muted-foreground">*</span>
                          )}
                        </span>
                      </div>
                      <div className="shrink-0 space-x-1.5 text-right font-mono text-[11px] font-bold tabular-nums text-foreground">
                        <span>{sp.overs}ov</span>
                        <span className="text-muted-foreground">
                          {sp.maidens}m
                        </span>
                        <span>{sp.runs}r</span>
                        <span className="font-bold text-rose-600 dark:text-rose-400">
                          {sp.wickets}w
                        </span>
                        <span className="text-[10px] text-muted-foreground">
                          ({sp.econ})
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
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

      <SquadManagerDialog
        open={showAddPlayerDialog}
        onOpenChange={setShowAddPlayerDialog}
        batting={
          battingTeam
            ? {
                id: battingTeam.id,
                name: battingTeam.name,
                players: battingTeamPlayers,
              }
            : null
        }
        bowling={
          bowlingTeam
            ? {
                id: bowlingTeam.id,
                name: bowlingTeam.name,
                players: bowlingTeamPlayers,
              }
            : null
        }
        activeIds={squadActiveIds}
        usedIds={squadUsedIds}
        dismissedIds={dismissedPlayerIds}
        onCreatePlayer={createSquadPlayer}
        onChanged={refreshSquads}
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

      {showInviteDialog && (
        <InviteDialog
          open={showInviteDialog}
          onOpenChange={setShowInviteDialog}
        />
      )}
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
