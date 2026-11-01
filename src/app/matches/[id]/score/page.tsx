"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { ScoringPanel } from "~/components/matches/scoring-panel";
import { LiveMatchHUD } from "~/components/matches/live-match-hud";
import dynamic from "next/dynamic";
import {
  isRetirementType,
  wicketMissing,
  type RunsKind,
} from "./components/WicketDialog";
import type {
  BallCorrection,
  DeliveryToEdit,
} from "./components/EditBallDialog";
import { ConfirmDialog } from "./components/ConfirmDialog";
import { freeHitsOn, nextIsFreeHit } from "~/lib/free-hit";
import { describeQueuedAction } from "./describe-action";
import { overBowlingOf } from "~/lib/firebase/scoring/ball-docs";
import { isSuperOverInnings } from "~/lib/firebase/scoring/result";
import { OtherScorerNotice } from "./components/OtherScorerNotice";
import { useLiveResync } from "./useLiveResync";
import type { LiveChanges } from "~/lib/scoring-delta";

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
const DeleteMatchDialog = dynamic(
  () =>
    import("~/components/matches/delete-match-dialog").then(
      (m) => m.DeleteMatchDialog,
    ),
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
const EarlierBallsDialog = dynamic(
  () =>
    import("./components/EarlierBallsDialog").then((m) => m.EarlierBallsDialog),
  { ssr: false },
);
const UnsavedActionsDialog = dynamic(
  () =>
    import("./components/UnsavedActionsDialog").then(
      (m) => m.UnsavedActionsDialog,
    ),
  { ssr: false },
);

/** Fetches the code of the dialogs above (used before going offline). */
function preloadScoringDialogs(): Promise<unknown> {
  return Promise.allSettled([
    import("./components/TossDialog"),
    import("./components/BatsmenDialog"),
    import("./components/BowlerDialog"),
    import("./components/WicketDialog"),
    import("./components/EditBallDialog"),
    import("./components/SquadManagerDialog"),
    import("./components/PotmDialog"),
    import("./components/MatchSettingsDialog"),
    import("./components/PenaltyBonusDialog"),
    import("./components/AbandonMatchDialog"),
    import("./components/RetirePlayerDialog"),
    import("./components/ReviseTargetDialog"),
    import("~/components/matches/dls-calculator-modal"),
    import("~/components/matches/match-scorers-dialog"),
    import("~/components/invite-dialog"),
    import("./components/EarlierBallsDialog"),
    import("./components/UnsavedActionsDialog"),
  ]);
}
import { useScoring } from "./useScoring";
import {
  inningsOverNotice,
  isChaseInnings,
  limitsOfInnings,
} from "./innings-notice";
import { getMatchBallLog } from "../../queries";
import { isKnownSpectator, resolveScorerAccess } from "./scorer-access";
import {
  forgetScorer,
  rememberScorer,
  wasScorer,
} from "~/lib/offline-match-cache";
import { cacheCurrentPage } from "~/lib/pwa/service-worker";
import { useAuth } from "~/lib/auth";
import {
  useCanDeleteMatchQuery,
  useMatchAdminQuery,
  useMatchClubChoices,
} from "~/lib/hooks/useMatchQueries";
import { MatchClubDialog } from "~/components/matches/match-club-dialog";
import { Chip, chipVariants } from "~/components/ds/chip";
import { ClubSuggestionCard } from "~/components/matches/club-suggestion";
import { useScoringUIStore } from "~/lib/stores/useScoringUIStore";
import { usePreferencesStore } from "~/lib/stores/usePreferencesStore";
import { useWakeLock } from "~/lib/hooks/useWakeLock";
import { cn } from "~/lib/utils";
import {
  updateMatchSettings,
  abandonMatch,
  updateTargetRuns,
} from "../../mutations";
import type { ExtraType, NoBallRuns } from "../../types";
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
  Check,
  Loader2,
  AlertCircle,
  UserPlus,
  Users,
  Award,
  Shield,
  ShieldAlert,
  UserCog,
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
  Share2,
  MessageCircle,
  Trash2,
  Pencil,
  Flag,
} from "lucide-react";
import { deliveryKind, deliveryLabel, economyRate } from "~/lib/cricket";
import { useMatchShare } from "~/components/matches/use-match-share";
import { matchParts } from "~/lib/match-players";
import { lookUpPlayers } from "~/lib/player-lookup";
import type { PlayerSearchResult } from "~/lib/player-search";
import { PlayerSearchContext } from "./components/PlayerPicker";

import {
  matchShareMessage,
  matchShareUrl,
  whatsappShareUrl,
} from "~/lib/share-match";
import { LiveIndicator } from "~/components/matches/live-indicator";

/**
 * Calls a server action that may get no answer (no signal at the ground):
 * a network failure becomes an error the scorer can read, not a silent
 * rejection that leaves a dialog waiting.
 */
async function callServer<T extends { error?: string | null }>(
  run: () => Promise<T>,
): Promise<T | { error: string }> {
  try {
    return await run();
  } catch {
    return { error: "No connection: nothing was saved. Try again." };
  }
}

/**
 * The scoring screen's state, handlers and derived values (everything the
 * page renders reads them from here).
 */
function useScoringScreen() {
  const params = useParams();
  const matchId = params.id as string;
  const { user, loading: authLoading } = useAuth();
  const { data: isAdminData, isLoading: authCheckLoading } = useMatchAdminQuery(
    matchId,
    user?.id,
  );
  // Deleting is stricter than scoring (no co-scorers); asked only of admins.
  const { data: canDeleteMatch } = useCanDeleteMatchQuery(
    matchId,
    user?.id,
    isAdminData === true,
  );

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
  // The store outlives the page: a toss dismissed on another match must not
  // keep this match's toss closed.
  useEffect(() => {
    setTossDialogDismissed(false);
  }, [matchId, setTossDialogDismissed]);
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

  // A resync after a change made elsewhere prompts scorers only.
  const isScorerRef = useRef(false);
  const remoteSyncRef = useRef(false);
  const handleNeedsBowler = useCallback(() => {
    if (!remoteSyncRef.current || isScorerRef.current)
      setShowSelectBowler(true);
  }, [setShowSelectBowler]);

  const handleNeedsBatsman = useCallback(() => {
    if (!remoteSyncRef.current || isScorerRef.current) {
      setShowSelectBatsmen(true);
    }
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
    undoBusy,
    undoNotice,
    handleRedo,
    isSaving,
    syncStuck,
    isOffline,
    pendingCount,
    deadLetterCount,
    deadLetters,
    refusedHead,
    awaitingServer,
    flushOfflineQueue,
    handleSkipHeadAction,
    handleResendDeadLetters,
    handleDiscardDeadLetter,
    handleStartMatch,
    handleScore,
    handleUndo,
    handleUpdateBall,
    handleRetireBatter,
    handleAwardPenalty,
    handleReassignOverBowler,
    handleReplaceBatter,
    handleStartSuperOver,
    handleConfirmBatsmen,
    handleConfirmBowler,
    handleAddPlayerInline,
    handleEndInnings,
    loadPlayers,
    syncFromDb,
    syncFromLive,
  } = useScoring(matchId, scoringOptions);

  // Spectators who opened this link and co-scorers follow live changes.
  const remoteSync = useCallback(async () => {
    remoteSyncRef.current = true;
    try {
      await syncFromDb();
    } finally {
      remoteSyncRef.current = false;
    }
  }, [syncFromDb]);
  const remoteSyncLive = useCallback(
    async (changes: LiveChanges) => {
      remoteSyncRef.current = true;
      try {
        return await syncFromLive(changes);
      } finally {
        remoteSyncRef.current = false;
      }
    },
    [syncFromLive],
  );
  useLiveResync({
    matchId,
    userId: user?.id,
    busy: isProcessing || pendingCount > 0,
    sync: remoteSync,
    syncLive: remoteSyncLive,
  });

  const rememberedScorer = useMemo(
    () => wasScorer(matchId, user?.id),
    [matchId, user?.id],
  );
  useEffect(() => {
    if (!user?.id) return;
    if (isAdminData === true) rememberScorer(matchId, user.id);
    else if (isAdminData === false && !isOffline) forgetScorer(matchId);
  }, [isAdminData, isOffline, matchId, user?.id]);
  const isAuthorized = resolveScorerAccess({
    hasUser: Boolean(user),
    authLoading,
    isAdmin: isAdminData,
    adminCheckLoading: authCheckLoading,
    rememberedScorer,
    offline: isOffline,
  });
  const isScorer = Boolean(isAuthorized);
  // Visitors who cannot score follow the match from the match centre,
  // which costs a fraction of this screen's reads per ball.
  const router = useRouter();
  const spectator = isKnownSpectator({
    hasUser: Boolean(user),
    authLoading,
    isAdmin: isAdminData,
    offline: isOffline,
  });
  useEffect(() => {
    if (spectator) router.replace(`/matches/${matchId}`);
  }, [spectator, router, matchId]);
  useEffect(() => {
    isScorerRef.current = isScorer;
  }, [isScorer]);

  // Load every scoring dialog while online so none of them is missing
  // offline, then ask the service worker to keep what the page loaded.
  useEffect(() => {
    if (!isScorer || isOffline) return;
    if (
      typeof navigator === "undefined" ||
      !navigator.serviceWorker?.controller
    ) {
      return;
    }
    const timer = window.setTimeout(() => {
      void preloadScoringDialogs().then(() => cacheCurrentPage());
    }, 3000);
    return () => window.clearTimeout(timer);
  }, [isScorer, isOffline]);

  const { isLocked: isScreenAwake } = useWakeLock(match?.status === "live");

  const [selectedTossWinner, setSelectedTossWinner] = useState<string>("");
  const [tossDecision, setTossDecision] = useState<"bat" | "bowl">("bat");
  const [showEditBallDialog, setShowEditBallDialog] = useState(false);
  const [showMatchSettingsDialog, setShowMatchSettingsDialog] = useState(false);
  const [showPenaltyBonusDialog, setShowPenaltyBonusDialog] = useState(false);
  /** The end the batsmen dialog changes (null: the first empty one). */
  const [batsmenFocus, setBatsmenFocus] = useState<
    "striker" | "nonStriker" | null
  >(null);
  const [showAbandonMatchDialog, setShowAbandonMatchDialog] = useState(false);
  const [showDeleteMatchDialog, setShowDeleteMatchDialog] = useState(false);
  const [showReviseTargetDialog, setShowReviseTargetDialog] = useState(false);
  const [retireTarget, setRetireTarget] = useState<{
    playerId: string;
    playerName: string;
  } | null>(null);
  const [editingDelivery, setEditingDelivery] = useState<DeliveryToEdit | null>(
    null,
  );
  const [actionsMenuOpen, setActionsMenuOpen] = useState(false);
  /** The list of this innings' balls, to correct one in any over. */
  const [showEarlierBalls, setShowEarlierBalls] = useState(false);
  /** "Add to club": puts the match into a club, or changes it. */
  const [showClubDialog, setShowClubDialog] = useState(false);
  /** The actions kept after the server refused them, under review. */
  const [showUnsaved, setShowUnsaved] = useState(false);
  /** Asking before the refused action at the head of the queue is dropped. */
  const [confirmSkip, setConfirmSkip] = useState(false);
  /** Asking before a super over starts (it reopens a finished match). */
  const [confirmSuperOver, setConfirmSuperOver] = useState(false);
  /** What a run out's completed runs were (the wicket dialog's toggle). */
  const [wicketRunsKind, setWicketRunsKind] = useState<RunsKind>("bat");

  const currentInnings = match?.innings?.find(
    (i) => i.innings_number === match?.current_innings,
  );
  // This over's balls, without retirements (logged between balls): the
  // last of them decides a free hit and is the one "Edit last ball" edits.
  const overBalls = rawDeliveries.filter(
    (d) => !(d.is_wicket && isRetirementType(d.dismissal_type)),
  );
  // The ball after a no-ball, while the match plays free hits; it carries
  // on through a wide or another no-ball.
  const isFreeHit = nextIsFreeHit(rawDeliveries, freeHitsOn(match));
  const isChase = isChaseInnings(match?.current_innings);
  const battingTeam = currentInnings
    ? currentInnings.team_id === match?.team1_id
      ? match?.team1
      : match?.team2
    : match?.team1;
  // Sharing the score (header icon and Match Tools): the summary image of
  // the match so far with a message; the scorer pastes the message where
  // the image is downloaded instead (desktop).
  const matchShare = useMatchShare(match, { copyMessage: true });

  const bowlingTeam = currentInnings
    ? currentInnings.team_id === match?.team1_id
      ? match?.team2
      : match?.team1
    : match?.team2;

  const showTossDialog =
    isScorer && match?.status === "scheduled" && !tossDialogDismissed;
  // No preselected winner: the scorer taps the team that won.
  const tossWinner = selectedTossWinner;

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
    showDeleteMatchDialog ||
    showReviseTargetDialog ||
    Boolean(retireTarget) ||
    showShortcuts ||
    showInviteDialog ||
    showEarlierBalls ||
    showUnsaved ||
    confirmSkip ||
    confirmSuperOver ||
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

  const partTeams = useMemo(
    () => new Map(match ? matchParts(match).map((p) => [p.id, p.teamName]) : []),
    [match],
  );

  // Registered players for the pickers' "Add", so the scorer adds the
  // profile that exists instead of a second one. Each says which of this
  // match's squads they are in and who they played for: someone in the other
  // side's squad may well play for this one today, and left out they would
  // look as if they were not on CricScore.
  const findPlayers = useCallback(
    async (query: string): Promise<PlayerSearchResult> => {
      const found = await lookUpPlayers(query);
      const squads = (id: string) =>
        [
          battingTeamPlayerIds.has(id) ? battingTeam?.name : null,
          bowlingTeamPlayerIds.has(id) ? bowlingTeam?.name : null,
        ].filter((name): name is string => Boolean(name));
      return {
        ...found,
        players: found.players.map((p) => ({
          ...p,
          teams: squads(p.id),
          playedFor: partTeams.get(p.id) ?? null,
        })),
      };
    },
    [
      battingTeam?.name,
      bowlingTeam?.name,
      battingTeamPlayerIds,
      bowlingTeamPlayerIds,
      partTeams,
    ],
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
      position: perf?.batting_position ?? null,
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
      position: perf?.batting_position ?? null,
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

    // The engine's limits (a super over: one over, two wickets).
    const innings = match.current_innings ?? 1;
    const limits = limitsOfInnings(match, innings);
    // Check all out
    if ((inn.total_wickets ?? 0) >= limits.wicketsCap) return true;

    // Check overs limit
    const oversLimit = limits.maxBalls / limits.ballsPerOver;
    if (
      limits.maxBalls > 0 &&
      ((inn.total_balls ?? 0) >= limits.maxBalls ||
        (!isSuperOverInnings(innings) &&
          (match.current_over ?? 0) >= oversLimit &&
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
    extra?: { type: string; runs: number; noBallRuns?: NoBallRuns },
    shotZone?: string,
  ) => {
    if (match?.status === "scheduled") {
      setTossDialogDismissed(false);
      toast.info("Record the toss to start the match");
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
      // Byes / leg byes off a no-ball (absent: off the bat).
      ...(extra?.type === "no_ball" &&
      extra.noBallRuns &&
      extra.noBallRuns !== "bat"
        ? { noBallRuns: extra.noBallRuns }
        : {}),
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
    // A bye or leg bye armed first is what a run out's runs were.
    const byes = extraType === "bye" || extraType === "leg_bye";
    setWicketExtraType(byes ? null : (extraType ?? null));
    setWicketRunsKind(byes ? (extraType as RunsKind) : "bat");
    setDismissedPlayerId(strikerId);
    setRunsCompletedBeforeRunOut(0);
    setFielderId("");
    // Nothing preselected: a wrong default would be a wrong scorecard.
    setDismissalType("");
    setShowWicketDialog(true);
  };

  const onWicketConfirm = async () => {
    if (!strikerId || !nonStrikerId) return;
    // A retirement is not a ball: recorded as the retire action does.
    if (isRetirementType(dismissalType)) {
      setShowWicketDialog(false);
      setFielderId("");
      setWicketExtraType(null);
      await handleRetirePlayerConfirm({
        playerId: dismissedPlayerId || strikerId,
        type: dismissalType,
      });
      return;
    }
    if (!currentBowlerId) return;
    // The dialog's Confirm says what is missing; nothing to record yet.
    if (wicketMissing(dismissalType, fielderId)) return;

    let runsScored = 0;
    let extras = 0;
    let extraType: ExtraType | undefined = undefined;
    let noBallRuns: NoBallRuns | undefined = undefined;
    const runs = dismissalType === "run_out" ? runsCompletedBeforeRunOut : 0;
    const byes = wicketRunsKind !== "bat" && runs > 0;

    if (wicketExtraType === "wide") {
      // Runs completed on a wide are wides.
      runsScored = 0;
      extras = 1 + runs;
      extraType = "wide";
    } else if (wicketExtraType === "no_ball") {
      extraType = "no_ball";
      if (byes) {
        // Not hit: the runs completed are byes / leg byes off the no-ball.
        extras = 1 + runs;
        noBallRuns = wicketRunsKind;
      } else {
        runsScored = runs;
        extras = 1;
      }
    } else if (byes) {
      // Completed runs are byes, not the batter's; the bowler concedes 0.
      extras = runs;
      extraType = wicketRunsKind as ExtraType;
    } else {
      runsScored = runs;
    }

    const res = await handleScore(currentBowlerId, strikerId, nonStrikerId, {
      runsScored,
      extras,
      extraType,
      isWicket: true,
      dismissalType,
      fielderId: fielderId || null,
      dismissedPlayerId: dismissedPlayerId || strikerId,
      ...(noBallRuns ? { noBallRuns } : {}),
    });
    // Refused: the dialog stays open with the scorer's picks.
    if (res?.error) return;
    setShowWicketDialog(false);
    setFielderId("");
    setWicketExtraType(null);
    setWicketRunsKind("bat");
    setRunsCompletedBeforeRunOut(0);

    if (res?.data) {
      if (res.data.needs_batsman) {
        setShowSelectBatsmen(true);
      } else if (res.data.over_completed || res.data.needs_bowler) {
        setShowSelectBowler(true);
      }
    }
  };

  const createSquadPlayer = async (
    side: "batting" | "bowling",
    name: string,
    existingId?: string,
  ) => handleAddPlayerInline(side, name, match, existingId);

  // Pickers add a player (a new one, or a registered one by id) and select
  // them in the slot being filled.
  const createPickedPlayer =
    (side: "batting" | "bowling") =>
    async (name: string, existingId?: string) => {
      const res = await handleAddPlayerInline(side, name, match, existingId);
      return res?.data?.user_id ?? null;
    };
  const addPlayerDisabledReason = isOffline
    ? "Adding players needs a connection. Use the squad you have or reconnect."
    : null;

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
    // Queued (and applied locally) when offline or behind queued actions.
    const res = await handleRetireBatter({ playerId, type, reason });
    if (res.error) {
      toast.error(res.error);
    } else {
      // The crease now shows the retired batter's end empty; the dialog
      // asking who comes in is the confirmation (no toast).
      setBatsmenFocus(null);
      setShowSelectBatsmen(true);
    }
  };

  const teamNameOf = (id: string | null | undefined) =>
    id === match?.team1?.id
      ? match?.team1?.name
      : id === match?.team2?.id
        ? match?.team2?.name
        : null;

  /** False when nothing was recorded (the dialog stays open). */
  const handleAwardPenaltyConfirm = async (params: {
    teamId: string;
    runs: number;
    reason: string;
    type: "penalty" | "bonus";
  }) => {
    if (!match) return false;
    const res = await handleAwardPenalty(params);
    if (res.error) {
      toast.error(res.error);
      return false;
    }
    if (!res.queued) {
      toast.success(
        `${params.runs} ${params.type === "penalty" ? "penalty" : "bonus"} run${params.runs === 1 ? "" : "s"} to ${teamNameOf(params.teamId) ?? "the team"}`,
      );
    }
    return true;
  };

  /** False when nothing was saved (the dialog stays open). */
  const handleAbandonMatchConfirm = async (params: {
    reason: string;
    resultType: "abandoned" | "no_result" | "win";
    winningTeamId?: string | null;
    notes?: string | null;
  }) => {
    if (!match) return false;
    const res = await callServer(() => abandonMatch(match.id, params));
    if (res.error) {
      toast.error(res.error);
      return false;
    }
    toast.success(
      params.resultType === "win"
        ? `Match awarded to ${teamNameOf(params.winningTeamId) ?? "the winners"}`
        : params.resultType === "no_result"
          ? "Match ended: no result"
          : "Match abandoned",
    );
    await syncFromDb();
    return true;
  };

  const handleReviseTargetConfirm = async (params: {
    targetRuns: number | null;
    overs?: number | null;
  }) => {
    if (!match) return;
    const res = await callServer(() => updateTargetRuns(match.id, params));
    if (res.error) {
      toast.error(res.error);
    } else {
      toast.success("Target updated");
      await syncFromDb();
    }
  };

  /** Correct a ball (any over); the error is shown in the dialog. */
  const handleCorrectBall = async (params: BallCorrection) => {
    const res = await handleUpdateBall(params);
    return { error: res?.error ?? null };
  };

  const loadBallLog = useCallback(async () => {
    const res = await getMatchBallLog(matchId);
    if (res.error) throw new Error(res.error);
    return (res.data ?? []) as unknown as DeliveryToEdit[];
  }, [matchId]);

  /** The queue's actions in the scorer's words (names from both squads). */
  const nameOfPlayer = (id: string | null | undefined) =>
    (id
      ? [...battingTeamPlayers, ...bowlingTeamPlayers].find(
          (p) => p.user_id === id,
        )?.user?.full_name
      : null) ??
    teamNameOf(id) ??
    null;
  const unsavedItems = deadLetters.map((d) => ({
    id: d.action.queueId,
    description: describeQueuedAction(d.action, nameOfPlayer),
    error: d.error.startsWith("Not sent")
      ? "Not sent: an earlier action was refused"
      : `Refused: ${d.error}`,
  }));
  const refusedHeadText = refusedHead
    ? describeQueuedAction(refusedHead, nameOfPlayer)
    : null;

  return {
    actionsMenuOpen,
    addPlayerDisabledReason,
    awaitingServer,
    confirmSkip,
    confirmSuperOver,
    handleCorrectBall,
    handleDiscardDeadLetter,
    handleResendDeadLetters,
    isChase,
    loadBallLog,
    refusedHead,
    refusedHeadText,
    setConfirmSkip,
    setConfirmSuperOver,
    setShowClubDialog,
    setShowEarlierBalls,
    setShowUnsaved,
    setWicketRunsKind,
    showClubDialog,
    showEarlierBalls,
    showUnsaved,
    unsavedItems,
    wicketRunsKind,
    findPlayers,
    authLoading,
    batsmenFocus,
    battingBench,
    battingTeam,
    battingTeamPlayerIds,
    battingTeamPlayers,
    bowlerDisplay,
    bowlingSpells,
    bowlingTeam,
    bowlingTeamPlayerIds,
    bowlingTeamPlayers,
    canDeleteMatch,
    createPickedPlayer,
    createSquadPlayer,
    currentBowlerId,
    currentInnings,
    deadLetterCount,
    dismissalType,
    dismissedPlayerId,
    dismissedPlayerIds,
    editingDelivery,
    error,
    fielderId,
    flushOfflineQueue,
    handleAbandonMatchConfirm,
    handleAwardPenaltyConfirm,
    handleConfirmBatsmen,
    handleConfirmBowler,
    handleEndInnings,
    handleReassignOverBowler,
    handleRedo,
    handleReplaceBatter,
    handleRetirePlayerConfirm,
    handleReviseTargetConfirm,
    handleSkipHeadAction,
    handleStartMatch,
    handleStartSuperOver,
    handleUndo,
    handleUpdateBall,
    isAuthorized,
    isFreeHit,
    isInningsComplete,
    isOffline,
    isOverComplete,
    isProcessing,
    isSaving,
    isScorer,
    isScoringDisabled,
    isScreenAwake,
    lastBalls,
    lastOverBowlerId,
    loading,
    match,
    matchId,
    nonStrikerDisplay,
    nonStrikerId,
    onScore,
    onWicketConfirm,
    openWicketDialog,
    overBalls,
    params,
    pendingCount,
    rawDeliveries,
    refreshSquads,
    retireTarget,
    runsCompletedBeforeRunOut,
    scoringKeyboardSuppressed,
    setActionsMenuOpen,
    setBatsmenFocus,
    setDismissalType,
    setDismissedPlayerId,
    setEditingDelivery,
    setFielderId,
    setRetireTarget,
    setRunsCompletedBeforeRunOut,
    setSelectedTossWinner,
    setShowAbandonMatchDialog,
    setShowAddPlayerDialog,
    setShowDeleteMatchDialog,
    setShowEditBallDialog,
    setShowInviteDialog,
    setShowMatchSettingsDialog,
    setShowPenaltyBonusDialog,
    setShowPotmDialog,
    setShowReviseTargetDialog,
    setShowSelectBatsmen,
    setShowSelectBowler,
    setShowShortcuts,
    setShowWicketDialog,
    setTossDecision,
    setTossDialogDismissed,
    matchShare,
    showAbandonMatchDialog,
    showAddPlayerDialog,
    showDeleteMatchDialog,
    showEditBallDialog,
    showInviteDialog,
    showMatchSettingsDialog,
    showPenaltyBonusDialog,
    showPotmDialog,
    showReviseTargetDialog,
    showSelectBatsmen,
    showSelectBowler,
    showShortcuts,
    showTossDialog,
    showWicketDialog,
    squadActiveIds,
    squadUsedIds,
    strikerDisplay,
    strikerId,
    sunlightMode,
    syncFromDb,
    syncStuck,
    toggleSunlightMode,
    toggleVoiceAnnouncements,
    toggleWagonWheelPrompt,
    tossDecision,
    tossWinner,
    undoBusy,
    undoNotice,
    user,
    voiceAnnouncements,
    wagonWheelPrompt,
    wicketExtraType,
  };
}

type ScoringScreen = ReturnType<typeof useScoringScreen>;

/** The screen once its match has loaded (what the sections render). */
type LoadedScreen = ScoringScreen & {
  match: NonNullable<ScoringScreen["match"]>;
};

/** Save, offline, sunlight and awake status, and the toss button. */
function HeaderIndicators({ s }: { s: LoadedScreen }) {
  const {
    matchId,
    user,
    isOffline,
    match,
    isScorer,
    syncStuck,
    pendingCount,
    flushOfflineQueue,
    isSaving,
    isProcessing,
    sunlightMode,
    isScreenAwake,
    setTossDialogDismissed,
  } = s;
  return (
    <>
      {/* Someone else scored this match in the last ~2 minutes */}
      <OtherScorerNotice matchId={matchId} userId={user?.id} />
      {/* Save status (instant scoring saves in the background) */}
      {!isOffline &&
        match.status === "live" &&
        isScorer &&
        (syncStuck && pendingCount > 0 ? (
          <button
            type="button"
            onClick={() => void flushOfflineQueue()}
            title="Some changes have not reached the server yet. Tap to send them again."
            className={chipVariants({ tone: "warning", size: "sm" })}
          >
            <AlertCircle className="h-3 w-3 shrink-0" aria-hidden="true" />
            <span>Not saved</span>
            <span className="tabular-nums">({pendingCount})</span>
          </button>
        ) : (
          <span
            className="flex items-center gap-1 px-1 text-2xs font-medium text-muted-foreground"
            title={
              pendingCount > 0 || isSaving || isProcessing
                ? "Saving to the server"
                : "All changes saved"
            }
          >
            {pendingCount > 0 || isSaving || isProcessing ? (
              <Loader2
                className="h-3 w-3 shrink-0 animate-spin"
                aria-hidden="true"
              />
            ) : (
              <Check className="h-3 w-3 shrink-0" aria-hidden="true" />
            )}
            <span className="max-sm:sr-only">
              {pendingCount > 0 || isSaving || isProcessing
                ? "Saving…"
                : "Saved"}
            </span>
          </span>
        ))}
      {/* Offline indicator */}
      {isOffline && (
        <Chip
          role="status"
          title="Offline: changes are kept on this device"
          tone="warning"
          size="sm"
        >
          <WifiOff className="h-3 w-3 shrink-0" aria-hidden="true" />
          <span className="hidden sm:inline">Offline</span>
          {pendingCount > 0 && <span className="tabular-nums">({pendingCount})</span>}
        </Chip>
      )}
      {/* Sunlight indicator */}
      {sunlightMode && (
        <span className={cn(chipVariants({ size: "sm" }), "hidden bg-black text-white sm:inline-flex")}>
          <Sun className="h-3 w-3" aria-hidden="true" /> Sun
        </span>
      )}

      {/* Awake indicator */}
      {isScreenAwake && (
        <Chip
          title="Screen wake lock active to prevent display timeout"
          tone="outline"
          size="sm"
          className="hidden text-muted-foreground sm:inline-flex"
        >
          Awake
        </Chip>
      )}

      {/* Start Match / Toss if scheduled */}
      {match.status === "scheduled" && isScorer && (
        <Button
          size="sm"
          onClick={() => setTossDialogDismissed(false)}
          className="gap-1"
        >
          <Play className="h-3.5 w-3.5" />
          <span>Toss</span>
        </Button>
      )}
    </>
  );
}

/** The Match Tools menu (match-level actions). */
function MatchToolsMenu({ s }: { s: LoadedScreen }) {
  const {
    setActionsMenuOpen,
    sunlightMode,
    isScorer,
    setShowMatchSettingsDialog,
    match,
    setShowReviseTargetDialog,
    strikerDisplay,
    setRetireTarget,
    nonStrikerDisplay,
    setShowPenaltyBonusDialog,
    setShowAddPlayerDialog,
    user,
    matchShare,
    setShowInviteDialog,
    toggleWagonWheelPrompt,
    wagonWheelPrompt,
    toggleVoiceAnnouncements,
    voiceAnnouncements,
    toggleSunlightMode,
    setShowShortcuts,
    canDeleteMatch,
    setShowDeleteMatchDialog,
    setShowEarlierBalls,
    setShowAbandonMatchDialog,
    actionsMenuOpen,
    showClubDialog,
    setShowClubDialog,
  } = s;
  const club = useMatchClubChoices(
    match,
    user?.id,
    isScorer,
    actionsMenuOpen || showClubDialog,
  );
  return (
    <>
      {/* Consolidated "Match Tools" Menu (Clean on Desktop & Mobile) */}
      <DropdownMenu onOpenChange={setActionsMenuOpen}>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className={cn(
              "h-10 w-10 gap-1.5 p-0 sm:h-9 sm:w-auto sm:px-3",
              sunlightMode && "border-2 border-black font-bold",
            )}
            aria-label="Match actions and scoring options"
            title="Match tools & scoring options"
          >
            <SlidersHorizontal className="hidden h-4 w-4 shrink-0 sm:inline" />
            <span className="hidden sm:inline">Match tools</span>
            <ChevronDown className="hidden h-3 w-3 opacity-60 sm:inline" />
            <MoreVertical className="h-4 w-4 sm:hidden" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56 rounded-xl p-1.5">
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
              onSelect={() => setShowEarlierBalls(true)}
              className="flex min-h-11 cursor-pointer items-center gap-2 rounded-xl px-2.5 py-2 text-xs font-medium"
            >
              <Pencil className="h-4 w-4 text-muted-foreground" />
              <span>Correct a ball</span>
            </DropdownMenuItem>
          )}
          {isScorer && (
            <DropdownMenuItem asChild>
              {/* The team sheet, where any player can be replaced. */}
              <Link
                href={`/matches/${match.id}/players`}
                className="flex min-h-11 cursor-pointer items-center gap-2 rounded-xl px-2.5 py-2 text-xs font-medium"
              >
                <UserCog className="h-4 w-4 text-muted-foreground" />
                <span>Replace a player</span>
              </Link>
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
          {(match.status === "live" || match.status === "scheduled") &&
            isScorer && (
              <DropdownMenuItem
                onSelect={() => setShowAbandonMatchDialog(true)}
                className="flex min-h-11 cursor-pointer items-center gap-2 rounded-xl px-2.5 py-2 text-xs font-medium"
              >
                <Flag className="h-4 w-4 text-muted-foreground" />
                <span>End the match early (rain, walkover)</span>
              </DropdownMenuItem>
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
          {club.offer && (
            <DropdownMenuItem
              onSelect={() => setShowClubDialog(true)}
              className="flex min-h-11 cursor-pointer items-center gap-2 rounded-xl px-2.5 py-2 text-xs font-medium"
            >
              <Shield className="h-4 w-4 text-muted-foreground" />
              <span>{match.club_id ? "Change club" : "Add to club"}</span>
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuLabel className="px-2 py-1 text-xs font-medium text-muted-foreground">
            Share
          </DropdownMenuLabel>
          {/* The overlay's header button is hidden on phones: it is here */}
          <DropdownMenuItem asChild className="sm:hidden">
            <Link
              href={`/overlay/${match.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex min-h-11 cursor-pointer items-center gap-2 rounded-xl px-2.5 py-2 text-xs font-medium"
            >
              <Tv className="h-4 w-4 text-muted-foreground" />
              <span>Open the broadcast overlay</span>
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem
            onPointerDown={matchShare.prepare}
            onSelect={() => void matchShare.share()}
            className="flex cursor-pointer items-center gap-2 rounded-xl px-2.5 py-2 text-xs font-medium"
          >
            <Share2 className="h-4 w-4 text-muted-foreground" />
            <span>Share live score</span>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <a
              href={whatsappShareUrl(
                matchShareMessage(match, matchShareUrl(match.id)),
              )}
              target="_blank"
              rel="noopener noreferrer"
              className="flex cursor-pointer items-center gap-2 rounded-xl px-2.5 py-2 text-xs font-medium"
            >
              <MessageCircle className="h-4 w-4 text-muted-foreground" />
              <span>Share on WhatsApp</span>
            </a>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
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
            <span>Wagon wheel prompt: {wagonWheelPrompt ? "On" : "Off"}</span>
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
            <span>Sunlight mode: {sunlightMode ? "On" : "Off"}</span>
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => setShowShortcuts(true)}
            className="hidden cursor-pointer items-center gap-2 rounded-xl px-2.5 py-2 text-xs font-medium sm:flex"
          >
            <Keyboard className="h-4 w-4 text-muted-foreground" />
            <span>Keyboard shortcuts</span>
          </DropdownMenuItem>
          {canDeleteMatch && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onSelect={() => setShowDeleteMatchDialog(true)}
                className="flex cursor-pointer items-center gap-2 rounded-xl px-2.5 py-2 text-xs font-medium text-destructive focus:bg-destructive/10 focus:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
                <span>Delete match</span>
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}

/** The console's header: back, title, status and tools. */
function ScoringHeader({ s }: { s: LoadedScreen }) {
  const { sunlightMode, match, setShowAddPlayerDialog, matchShare } = s;
  return (
    <>
      {/* Dedicated Scorer Console Header (Distraction-Free) */}
      <header
        className={cn(
          "sticky top-0 z-30 border-b bg-card/95 backdrop-blur-md",
          sunlightMode
            ? "border-b-2 border-black bg-white"
            : "border-border/80 dark:border-border dark:bg-background/95",
        )}
      >
        <div className="container mx-auto flex h-11 w-full max-w-full items-center justify-between px-2.5 sm:h-12 sm:px-4">
          {/* Left: Back Arrow + Match Title & Format */}
          <div className="flex min-w-0 items-center gap-1.5 sm:gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="shrink-0 text-muted-foreground hover:text-foreground sm:h-9 sm:w-9"
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
                <h1 className="truncate text-sm font-semibold">
                  {match.team1.short_name || match.team1.name} vs{" "}
                  {match.team2.short_name || match.team2.name}
                </h1>
                {match.status === "live" ? (
                  <LiveIndicator className="hidden sm:inline-flex" />
                ) : (
                  <Badge
                    variant="secondary"
                    size="sm"
                    className="hidden capitalize sm:inline-flex"
                  >
                    {match.status}
                  </Badge>
                )}
              </div>
              <p className="truncate text-xs text-muted-foreground">
                {match.title} · {match.match_format}
              </p>
            </div>
          </div>

          {/* Right: Quick Tools & Consolidated Actions Menu */}
          <div className="flex shrink-0 items-center gap-1 sm:gap-2">
            <HeaderIndicators s={s} />

            {/* Squads (phones; the sidebar shows them on larger screens) */}
            <Button
              variant="outline"
              size="icon"
              className="sm:h-9 sm:w-9 lg:hidden"
              onClick={() => setShowAddPlayerDialog(true)}
              aria-label="Open squads"
              title="Squads"
            >
              <Users className="h-4 w-4" />
            </Button>

            {/* Share the live score: the summary image and a message */}
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={matchShare.busy}
              onPointerDown={matchShare.prepare}
              onClick={() => void matchShare.share()}
              aria-label="Share live score"
              className="h-10 w-10 p-0 sm:h-9 sm:w-auto sm:px-3"
            >
              {matchShare.busy ? (
                <Loader2 className="animate-spin" />
              ) : (
                <Share2 />
              )}
              <span className="hidden sm:inline">Share</span>
            </Button>

            {/* OBS Broadcast Overlay Shortcut */}
            <Button
              variant="outline"
              size="icon"
              className="hidden h-9 w-9 sm:inline-flex"
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

            <MatchToolsMenu s={s} />
          </div>
        </div>
      </header>
    </>
  );
}

/** Offline / unsynced actions banner, and the actions the server refused. */
function SyncBanner({ s }: { s: LoadedScreen }) {
  const {
    isOffline,
    pendingCount,
    syncStuck,
    deadLetterCount,
    isProcessing,
    flushOfflineQueue,
    refusedHead,
    refusedHeadText,
    setConfirmSkip,
    setShowUnsaved,
  } = s;
  const changes = (n: number) => `${n} change${n === 1 ? "" : "s"}`;
  return (
    <>
      {/* Offline Alert & Sync Banner (not for instant saves in progress) */}
      {(isOffline || (pendingCount > 0 && syncStuck)) && (
        <div
          role="status"
          aria-live="polite"
          className={cn(
            "flex flex-wrap items-center justify-between gap-2 border-b px-3 py-1.5 text-xs font-medium sm:px-6",
            isOffline
              ? "border-warning/40 bg-warning/10 text-warning dark:bg-warning/20"
              : "border-primary/40 bg-primary/10 text-primary dark:bg-primary/20",
          )}
        >
          <div className="flex min-w-0 items-center gap-2">
            <span
              className={cn(
                "h-2 w-2 shrink-0 rounded-full",
                isOffline ? "bg-warning" : "bg-primary",
              )}
              aria-hidden="true"
            />
            <span>
              {isOffline ? (
                <>
                  <strong className="font-semibold">Offline:</strong> keep
                  scoring.{" "}
                  {pendingCount > 0
                    ? `${changes(pendingCount)} kept on this device, sent when you are back online.`
                    : "Changes are kept on this device."}
                </>
              ) : refusedHead ? (
                <>
                  <strong className="font-semibold">Not saved:</strong> the
                  server refused “{refusedHeadText}”
                  {refusedHead.lastError ? ` (${refusedHead.lastError})` : ""}.
                  {pendingCount > 1
                    ? ` ${changes(pendingCount - 1)} after it wait${pendingCount - 1 === 1 ? "s" : ""}.`
                    : ""}
                </>
              ) : (
                <>
                  <strong className="font-semibold">Not saved yet:</strong>{" "}
                  {changes(pendingCount)} kept on this device. No answer from
                  the server; they are sent again shortly.
                </>
              )}
            </span>
          </div>
          {!isOffline && pendingCount > 0 && (
            <div className="flex items-center gap-2">
              {/* Only an action the server refused may be dropped: one that
                  went unanswered may yet be saved. */}
              {refusedHead && (
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={isProcessing}
                  onClick={() => setConfirmSkip(true)}
                  className="text-muted-foreground hover:text-destructive"
                >
                  Discard it
                </Button>
              )}
              <Button
                size="sm"
                variant="outline"
                disabled={isProcessing}
                onClick={() => flushOfflineQueue()}
                className="gap-1"
              >
                <RefreshCw
                  className={cn("h-3.5 w-3.5", isProcessing && "animate-spin")}
                  aria-hidden="true"
                />
                {isProcessing ? "Sending…" : "Send now"}
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Lasting until reviewed: what the server refused */}
      {deadLetterCount > 0 && (
        <div
          role="status"
          className="flex items-center justify-between gap-2 border-b border-destructive/30 bg-destructive/10 px-3 py-1.5 text-xs font-medium text-destructive sm:px-6"
        >
          <span className="flex min-w-0 items-center gap-2">
            <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span>
              {deadLetterCount === 1
                ? "1 action not saved"
                : `${deadLetterCount} actions not saved`}
              : not on the scorecard.
            </span>
          </span>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setShowUnsaved(true)}
            className="shrink-0"
          >
            Review
          </Button>
        </div>
      )}
    </>
  );
}

/** Notices for a match not started, finished, or watched. */
function MatchNotices({ s }: { s: LoadedScreen }) {
  const {
    match,
    setTossDialogDismissed,
    setShowPotmDialog,
    isScorer,
    user,
    matchId,
    syncFromDb,
  } = s;
  return (
    <>
      {match.status === "scheduled" && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card p-4">
          <div>
            <p className="flex items-center gap-1.5 text-sm font-semibold">
              Match scheduled: toss required
            </p>
            <p className="text-xs text-muted-foreground">
              Record the toss winner and their decision to start the match and
              enable scoring.
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
      {/* A finished match whose players play for the scorer's club. */}
      <ClubSuggestionCard
        match={match}
        isScorer={isScorer}
        onAdded={() => void syncFromDb()}
      />

      {!isScorer && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card p-3.5 sm:p-4">
          <div className="flex min-w-0 items-center gap-3">
            <Eye
              className="h-5 w-5 shrink-0 text-muted-foreground"
              aria-hidden="true"
            />
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-xs font-semibold text-foreground sm:text-sm">
                  Spectator view
                </p>
                {match.status === "live" && <LiveIndicator />}
              </div>
              <p className="truncate text-2xs text-muted-foreground sm:text-xs">
                {user
                  ? "Only this match's scorers can score it."
                  : "Scorers invited to this match can sign in to score."}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {!user ? (
              <Button size="sm" asChild>
                <Link href={`/auth/login?redirect=/matches/${matchId}/score`}>
                  Sign in to score
                </Link>
              </Button>
            ) : null}
            <Button
              size="sm"
              variant="outline"
              asChild
            >
              <Link href={`/matches/${matchId}`}>Match centre</Link>
            </Button>
            <Button
              size="sm"
              variant="secondary"
              asChild
            >
              <Link href={`/overlay/${matchId}`} target="_blank">
                Overlay
              </Link>
            </Button>
          </div>
        </div>
      )}
    </>
  );
}

/** The live scoreboard (batters, bowler, this over). */
function Scoreboard({ s }: { s: LoadedScreen }) {
  const {
    match,
    currentInnings,
    battingTeam,
    isScorer,
    handleEndInnings,
    isProcessing,
    strikerDisplay,
    nonStrikerDisplay,
    bowlerDisplay,
    lastBalls,
    rawDeliveries,
    strikerId,
    nonStrikerId,
    handleConfirmBatsmen,
    setTossDialogDismissed,
    setBatsmenFocus,
    setShowSelectBatsmen,
    setShowSelectBowler,
    sunlightMode,
  } = s;
  return (
    <>
      <LiveMatchHUD
        match={match}
        currentInnings={currentInnings}
        battingTeamName={battingTeam?.name}
        onEndInnings={
          // Once the innings is over, its banner says what happens next.
          isScorer && !s.isInningsComplete
            ? () => void handleEndInnings()
            : undefined
        }
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
                  toast.info("Record the toss to start the match");
                  return;
                }
                setBatsmenFocus("striker");
                setShowSelectBatsmen(true);
              }
            : undefined
        }
        onChangeNonStriker={
          isScorer
            ? () => {
                if (match.status === "scheduled") {
                  setTossDialogDismissed(false);
                  toast.info("Record the toss to start the match");
                  return;
                }
                setBatsmenFocus("nonStriker");
                setShowSelectBatsmen(true);
              }
            : undefined
        }
        onChangeBowler={
          isScorer
            ? () => {
                if (match.status === "scheduled") {
                  setTossDialogDismissed(false);
                  toast.info("Record the toss to start the match");
                  return;
                }
                setShowSelectBowler(true);
              }
            : undefined
        }
        sunlightMode={sunlightMode}
      />
    </>
  );
}

/** Innings complete, new over and new batter prompts. */
function ConsoleBanners({ s }: { s: LoadedScreen }) {
  const {
    isInningsComplete,
    match,
    isScorer,
    handleEndInnings,
    isProcessing,
    isOverComplete,
    setShowSelectBowler,
    strikerId,
    nonStrikerId,
    setShowSelectBatsmen,
    currentInnings,
    isChase,
    isOffline,
    awaitingServer,
  } = s;
  const notice = inningsOverNotice({ isChase, isOffline, awaitingServer });
  // Nothing bowled yet: the openers and the opening bowler come first.
  const inningsStart = (currentInnings?.total_balls ?? 0) === 0;
  const oneEmpty = Boolean(strikerId) !== Boolean(nonStrikerId);
  return (
    <>
      {/* Innings Complete Banner */}
      {isInningsComplete && (
        <div
          role="status"
          className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-warning/40 bg-warning/10 p-3 text-warning dark:bg-warning/20 sm:p-4"
        >
          <div className="space-y-0.5">
            <p className="flex items-center gap-1.5 text-xs font-bold sm:text-sm">
              {notice.title}
            </p>
            <p className="text-2xs text-muted-foreground sm:text-xs">
              {notice.text}
            </p>
          </div>
          {notice.action && isScorer && (
            <Button
              size="sm"
              onClick={() => void handleEndInnings()}
              disabled={isProcessing}
              className="h-10"
            >
              {notice.action === "finish" ? "Finish the match" : "End innings"}
            </Button>
          )}
        </div>
      )}

      {/* Choose the bowler: the opening one, or after an over */}
      {isOverComplete && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-primary/40 bg-primary/10 p-3 text-primary dark:bg-primary/20 sm:p-4">
          <div className="space-y-0.5">
            <p className="flex items-center gap-1.5 text-xs font-bold sm:text-sm">
              {inningsStart
                ? "Choose the opening bowler"
                : `Over ${match.current_over} complete`}
            </p>
            <p className="text-2xs text-muted-foreground sm:text-xs">
              {inningsStart
                ? "Pick who bowls the first over to start scoring."
                : `Choose the bowler for over ${match.current_over + 1}.`}
            </p>
          </div>
          {isScorer && (
            <Button
              size="sm"
              onClick={() => setShowSelectBowler(true)}
              disabled={isProcessing}
              className="h-10"
            >
              Choose bowler
            </Button>
          )}
        </div>
      )}

      {/* Choose the batters: the openers, or after a wicket */}
      {match.status === "live" &&
        (!strikerId || !nonStrikerId) &&
        !isInningsComplete && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-warning/40 bg-warning/10 p-3 text-warning dark:bg-warning/20 sm:p-4">
            <div className="space-y-0.5">
              <p className="flex items-center gap-1.5 text-xs font-bold sm:text-sm">
                {oneEmpty
                  ? "Choose the new batter"
                  : inningsStart
                    ? "Choose the opening batters"
                    : "Choose the batters"}
              </p>
              <p className="text-2xs text-muted-foreground sm:text-xs">
                {oneEmpty
                  ? "A batter is out or has retired: who comes in?"
                  : "Scoring starts once both batters are in."}
              </p>
            </div>
            {isScorer && (
              <Button
                size="sm"
                onClick={() => setShowSelectBatsmen(true)}
                disabled={isProcessing}
                className="h-10"
              >
                {oneEmpty ? "Choose batter" : "Choose batters"}
              </Button>
            )}
          </div>
        )}
    </>
  );
}

/** The keypad for scorers, the read-only view for others. */
function Console({ s }: { s: LoadedScreen }) {
  const {
    isScorer,
    match,
    rawDeliveries,
    bowlingTeamPlayers,
    bowlerDisplay,
    battingTeamPlayers,
    strikerDisplay,
    matchId,
    onScore,
    openWicketDialog,
    handleUndo,
    overBalls,
    setEditingDelivery,
    setShowEditBallDialog,
    strikerId,
    nonStrikerId,
    isProcessing,
    handleConfirmBatsmen,
    lastBalls,
    isFreeHit,
    isScoringDisabled,
    undoBusy,
    undoNotice,
    handleRedo,
    scoringKeyboardSuppressed,
    sunlightMode,
    wagonWheelPrompt,
    showShortcuts,
    setShowShortcuts,
    awaitingServer,
    isInningsComplete,
    isChase,
    setShowEarlierBalls,
  } = s;
  // Waiting for the server's answer (a ball that ends the innings, a
  // correction): say why the keypad does not respond.
  const waitingNote = awaitingServer
    ? isInningsComplete
      ? isChase
        ? "Saving the last ball. The result follows."
        : "Saving the last ball. The next innings opens after it."
      : "Saving. Scoring goes on once the server answers."
    : null;
  return (
    <>
      {!isScorer ? (
        <div className="space-y-3">
          <Card className="rounded-xl border border-border bg-card shadow-sm">
            <CardContent className="space-y-3 p-3.5 sm:p-4">
              <div className="flex items-center justify-between border-b border-border/50 pb-2">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold text-foreground">
                    Over {match.current_over + 1}
                  </h3>
                </div>
                <Badge
                  variant="outline"
                  size="sm"
                  className="text-muted-foreground"
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
                      const isWicket = deliveryKind(d) === "wicket";
                      return (
                        <div
                          key={d.id || idx}
                          className={cn(
                            "flex items-center justify-between rounded-xl border p-2.5 text-xs transition-colors",
                            isWicket
                              ? "border-destructive/30 bg-destructive/10 text-destructive"
                              : isBoundary
                                ? d.runs_scored === 6
                                  ? "border-six/30 bg-six/10 text-six"
                                  : "border-success/30 bg-success/10 text-success"
                                : "border-border/50 bg-muted/30 text-foreground",
                          )}
                        >
                          <div className="flex min-w-0 items-center gap-2.5">
                            <span className="w-8 shrink-0 font-score text-xs font-bold tabular-nums text-muted-foreground">
                              {d.over_number}.{d.ball_number}
                            </span>
                            <div className="min-w-0">
                              <p className="truncate font-semibold">
                                <strong>{bowlerName}</strong> to{" "}
                                <strong>{batterName}</strong>
                              </p>
                              <div className="flex items-center gap-2 text-[0.625rem] text-muted-foreground">
                                {d.extra_type ? (
                                  <span className="font-medium capitalize text-warning">
                                    {d.extra_type.replace("_", " ")} ({d.extras}{" "}
                                    extra
                                    {d.extras === 1 ? "" : "s"})
                                  </span>
                                ) : null}
                                {d.shot_zone ? (
                                  <span className="capitalize text-primary">
                                    Shot: {d.shot_zone.replace("_", " ")}
                                  </span>
                                ) : null}
                                {d.dismissal_type ? (
                                  <span className="font-medium capitalize text-destructive">
                                    {isWicket ? "Out: " : ""}
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
                                  ? "bg-wicket text-wicket-foreground"
                                  : d.runs_scored === 6
                                    ? "bg-six text-six-foreground"
                                    : d.runs_scored === 4
                                      ? "bg-four text-four-foreground"
                                      : d.runs_scored === 0 && !d.extra_type
                                        ? "bg-muted text-muted-foreground"
                                        : "border border-extra/30 bg-extra/15 text-extra",
                              )}
                            >
                              {deliveryLabel(d)}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-border/60 py-6 text-center text-xs text-muted-foreground">
                  <Clock className="mx-auto mb-1.5 h-5 w-5 opacity-40" />
                  Awaiting the first delivery of over {match.current_over + 1}
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
            <Link
              href={`/matches/${matchId}`}
              className="shrink-0 text-sm font-medium text-muted-foreground hover:text-foreground"
            >
              Full scorecard
            </Link>
          </div>
        </div>
      ) : (
        <ScoringPanel
          onScore={onScore}
          onWicket={openWicketDialog}
          onUndo={() => void handleUndo()}
          onEditLastBall={() => {
            const d = overBalls.at(-1);
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
          onEditBalls={
            match.status === "live" ? () => setShowEarlierBalls(true) : undefined
          }
          waitingNote={waitingNote}
          freeHitsOn={freeHitsOn(match)}
          currentOver={match.current_over}
          currentBall={match.current_ball}
          lastBalls={lastBalls}
          isFreeHit={isFreeHit}
          disabled={isScoringDisabled}
          undoDisabled={
            !isScorer ||
            undoBusy ||
            (match?.status !== "live" && match?.status !== "completed")
          }
          undoNotice={undoNotice}
          onRedo={() => void handleRedo()}
          keyboardSuppressed={scoringKeyboardSuppressed}
          sunlightMode={sunlightMode}
          wagonWheelPrompt={wagonWheelPrompt}
          shortcutsOpen={showShortcuts}
          onShortcutsOpenChange={setShowShortcuts}
        />
      )}
    </>
  );
}

/** Super over after a tie. */
function TieActions({ s }: { s: LoadedScreen }) {
  const {
    match,
    isScorer,
    handleStartSuperOver,
    isProcessing,
    confirmSuperOver,
    setConfirmSuperOver,
  } = s;
  const tied =
    match.result_type === "tie" ||
    Boolean(match.result_description?.toLowerCase().includes("tie"));
  return (
    <>
      {match.status === "completed" && tied && isScorer && (
        <div className="rounded-xl border border-warning/40 bg-warning/10 p-4 text-center">
          <h4 className="text-base font-semibold text-warning">Match tied</h4>
          <p className="mt-1 text-xs text-muted-foreground">
            Scores are level. If the competition settles ties with a super
            over, start one here.
          </p>
          <Button
            className="mt-3 min-h-11 gap-2"
            onClick={() => setConfirmSuperOver(true)}
            disabled={isProcessing}
          >
            Start super over
          </Button>
          <ConfirmDialog
            open={confirmSuperOver}
            onOpenChange={setConfirmSuperOver}
            title="Start a super over?"
            description="The match goes live again for one over and two wickets a side. The super over's result replaces the tie."
            confirmLabel="Start super over"
            cancelLabel="Not now"
            busy={isProcessing}
            onConfirm={() => {
              setConfirmSuperOver(false);
              void handleStartSuperOver();
            }}
          />
        </div>
      )}
    </>
  );
}

/** The batting side's bench and batting order (wide screens). */
function BenchCard({ s }: { s: LoadedScreen }) {
  const { battingTeam, match, battingBench, isScorer, setShowAddPlayerDialog } =
    s;
  return (
    <>
      {/* Bench & Batting Order */}
      <Card className="rounded-xl border border-border bg-card shadow-sm">
        <CardContent className="space-y-3.5 p-4">
          <div className="flex items-center justify-between border-b border-border/50 pb-2">
            <h3 className="text-sm font-semibold">
              <span>{battingTeam?.name ?? "Batting team"} bench</span>
            </h3>
            <Badge variant="outline" size="sm">
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
                    size="sm"
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
                      <p className="truncate text-[0.625rem] text-muted-foreground">
                        {d.dismissalType
                          ? d.dismissalType.replace("_", " ")
                          : "out"}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <span className="font-score text-xs font-bold tabular-nums">
                        {d.runs}
                      </span>
                      <span className="ml-1 text-[0.625rem] text-muted-foreground">
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
              className="mt-2 w-full"
              onClick={() => setShowAddPlayerDialog(true)}
            >
              <UserPlus className="mr-1.5 h-3.5 w-3.5" /> Manage players
            </Button>
          )}
        </CardContent>
      </Card>
    </>
  );
}

/** This innings' bowling figures (wide screens). */
function BowlingAttackCard({ s }: { s: LoadedScreen }) {
  const { bowlingSpells, bowlingTeam } = s;
  return (
    <>
      {/* Bowling Attack Spell Table */}
      {bowlingSpells.length > 0 && (
        <Card className="rounded-xl border border-border bg-card shadow-sm">
          <CardContent className="space-y-2.5 p-3.5 sm:p-4">
            <div className="flex items-center justify-between border-b border-border/50 pb-2">
              <h3 className="text-sm font-semibold">
                <span>{bowlingTeam?.name ?? "Bowling"} attack</span>
              </h3>
              <span className="text-[0.625rem] font-semibold text-muted-foreground">
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
                  <div className="shrink-0 space-x-1.5 text-right font-score text-2xs font-semibold tabular-nums text-foreground">
                    <span>{sp.overs}ov</span>
                    <span className="text-muted-foreground">{sp.maidens}m</span>
                    <span>{sp.runs}r</span>
                    <span className="font-bold text-destructive">
                      {sp.wickets}w
                    </span>
                    <span className="text-[0.625rem] text-muted-foreground">
                      ({sp.econ})
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </>
  );
}

/** "Add to club" from Match tools (`MatchClubDialog`), mounted while open. */
function ScoringClubDialog({
  match,
  userId,
  isScorer,
  open,
  onOpenChange,
  onSaved,
}: {
  match: LoadedScreen["match"];
  userId: string | undefined;
  isScorer: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const { choosable, loading } = useMatchClubChoices(
    match,
    userId,
    isScorer,
    open,
  );
  if (!open) return null;
  return (
    <MatchClubDialog
      open={open}
      onOpenChange={onOpenChange}
      match={match}
      clubs={choosable}
      loading={loading}
      onSaved={onSaved}
    />
  );
}

/** Every dialog of the scoring screen. */
function ScoringDialogs({ s }: { s: LoadedScreen }) {
  const {
    showTossDialog,
    setTossDialogDismissed,
    match,
    tossWinner,
    tossDecision,
    setSelectedTossWinner,
    setTossDecision,
    handleStartMatch,
    setShowSelectBatsmen,
    isProcessing,
    showSelectBatsmen,
    setBatsmenFocus,
    batsmenFocus,
    battingTeamPlayers,
    battingTeam,
    currentInnings,
    bowlingTeamPlayerIds,
    currentBowlerId,
    strikerId,
    nonStrikerId,
    dismissedPlayerIds,
    handleConfirmBatsmen,
    setShowSelectBowler,
    createPickedPlayer,
    addPlayerDisabledReason,
    isScorer,
    setRetireTarget,
    handleEndInnings,
    showSelectBowler,
    bowlingTeamPlayers,
    bowlingTeam,
    lastOverBowlerId,
    battingTeamPlayerIds,
    rawDeliveries,
    handleReassignOverBowler,
    handleReplaceBatter,
    handleConfirmBowler,
    showAddPlayerDialog,
    setShowAddPlayerDialog,
    squadActiveIds,
    squadUsedIds,
    createSquadPlayer,
    refreshSquads,
    isOffline,
    showWicketDialog,
    setShowWicketDialog,
    dismissalType,
    setDismissalType,
    fielderId,
    setFielderId,
    dismissedPlayerId,
    setDismissedPlayerId,
    wicketExtraType,
    runsCompletedBeforeRunOut,
    setRunsCompletedBeforeRunOut,
    onWicketConfirm,
    isFreeHit,
    showEditBallDialog,
    setShowEditBallDialog,
    editingDelivery,
    showPotmDialog,
    setShowPotmDialog,
    matchId,
    showMatchSettingsDialog,
    setShowMatchSettingsDialog,
    syncFromDb,
    setShowAbandonMatchDialog,
    showPenaltyBonusDialog,
    setShowPenaltyBonusDialog,
    handleAwardPenaltyConfirm,
    showInviteDialog,
    setShowInviteDialog,
    canDeleteMatch,
    showDeleteMatchDialog,
    setShowDeleteMatchDialog,
    showAbandonMatchDialog,
    handleAbandonMatchConfirm,
    retireTarget,
    handleRetirePlayerConfirm,
    showReviseTargetDialog,
    setShowReviseTargetDialog,
    handleReviseTargetConfirm,
    wicketRunsKind,
    setWicketRunsKind,
    handleCorrectBall,
    showEarlierBalls,
    setShowEarlierBalls,
    loadBallLog,
    pendingCount,
    showUnsaved,
    setShowUnsaved,
    unsavedItems,
    handleResendDeadLetters,
    handleDiscardDeadLetter,
    isProcessing: busy,
    confirmSkip,
    setConfirmSkip,
    refusedHead,
    refusedHeadText,
    handleSkipHeadAction,
    setEditingDelivery,
    user,
    showClubDialog,
    setShowClubDialog,
  } = s;
  return (
    <>
      <ScoringClubDialog
        match={match}
        userId={user?.id}
        isScorer={isScorer}
        open={showClubDialog}
        onOpenChange={setShowClubDialog}
        onSaved={() => void syncFromDb()}
      />
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
        onOpenChange={(open) => {
          setShowSelectBatsmen(open);
          if (!open) setBatsmenFocus(null);
        }}
        focusEnd={batsmenFocus}
        battingTeamPlayers={battingTeamPlayers}
        battingTeamName={battingTeam?.name}
        battingPerformances={currentInnings?.batting_performances}
        bowlingTeamPlayerIds={bowlingTeamPlayerIds}
        currentBowlerId={currentBowlerId}
        strikerId={strikerId}
        nonStrikerId={nonStrikerId}
        dismissedPlayerIds={dismissedPlayerIds}
        onConfirm={async (pair) => {
          const res = await handleConfirmBatsmen(
            pair.strikerId,
            pair.nonStrikerId,
          );
          if (!res.error) {
            setShowSelectBatsmen(false);
            setBatsmenFocus(null);
            if (!currentBowlerId) setShowSelectBowler(true);
          }
        }}
        isProcessing={isProcessing}
        onCreatePlayer={createPickedPlayer("batting")}
        addPlayerDisabledReason={addPlayerDisabledReason}
        onReplace={
          isScorer && match.status === "live"
            ? async (fromId, toId) => {
                const res = await handleReplaceBatter({ fromId, toId });
                if (res.error) {
                  toast.error(res.error);
                } else {
                  setShowSelectBatsmen(false);
                  setBatsmenFocus(null);
                  if (!res.queued) {
                    const name = (id: string) =>
                      battingTeamPlayers.find((p) => p.user_id === id)?.user
                        ?.full_name ?? "the new batter";
                    toast.success(
                      `${name(fromId)}'s runs and balls now go to ${name(toId)}`,
                    );
                  }
                }
                return { error: res.error };
              }
            : undefined
        }
        onRetire={
          isScorer && match.status === "live"
            ? (playerId) => {
                setShowSelectBatsmen(false);
                setBatsmenFocus(null);
                setRetireTarget({
                  playerId,
                  playerName:
                    battingTeamPlayers.find((p) => p.user_id === playerId)?.user
                      ?.full_name ?? "Batter",
                });
              }
            : undefined
        }
        onEndInnings={
          isScorer
            ? () => {
                setShowSelectBatsmen(false);
                void handleEndInnings();
              }
            : undefined
        }
      />

      <BowlerDialog
        open={showSelectBowler}
        onOpenChange={setShowSelectBowler}
        bowlingTeamPlayers={bowlingTeamPlayers}
        bowlingTeamName={bowlingTeam?.name}
        bowlingPerformances={currentInnings?.bowling_performances}
        oversPerInnings={match.overs_per_innings}
        currentBowlerId={currentBowlerId}
        lastOverBowlerId={lastOverBowlerId}
        strikerId={strikerId}
        nonStrikerId={nonStrikerId}
        battingTeamPlayerIds={battingTeamPlayerIds}
        overBowling={overBowlingOf(rawDeliveries, match.current_over ?? 0)}
        overNumber={(match.current_over ?? 0) + 1}
        onConfirm={async (bowlerId) => {
          const res = await handleConfirmBowler(bowlerId);
          if (!res.error) setShowSelectBowler(false);
        }}
        onReassign={async (bowlerId) => {
          const res = await handleReassignOverBowler(bowlerId);
          if (res.error) {
            toast.error(res.error);
            return;
          }
          if (!res.queued) {
            toast.success("Bowler changed for this over's deliveries");
          }
          setShowSelectBowler(false);
        }}
        isProcessing={isProcessing}
        onCreatePlayer={createPickedPlayer("bowling")}
        addPlayerDisabledReason={addPlayerDisabledReason}
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
        isOffline={isOffline}
      />

      <WicketDialog
        open={showWicketDialog}
        onOpenChange={setShowWicketDialog}
        dismissalType={dismissalType}
        onDismissalTypeChange={setDismissalType}
        fielderId={fielderId}
        onFielderChange={setFielderId}
        bowlingTeamPlayers={bowlingTeamPlayers}
        bowlingTeamName={bowlingTeam?.name}
        bowlerId={currentBowlerId}
        onCreateFielder={createPickedPlayer("bowling")}
        addPlayerDisabledReason={addPlayerDisabledReason}
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
        runsKind={wicketRunsKind}
        onRunsKindChange={setWicketRunsKind}
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
        onSave={handleCorrectBall}
        isProcessing={isProcessing}
      />

      <EarlierBallsDialog
        open={showEarlierBalls}
        onOpenChange={setShowEarlierBalls}
        inningsId={currentInnings?.id ?? null}
        loadBalls={loadBallLog}
        offline={isOffline}
        unsaved={pendingCount}
        onPick={(ball) => {
          setShowEarlierBalls(false);
          setEditingDelivery(ball);
          setShowEditBallDialog(true);
        }}
      />

      <UnsavedActionsDialog
        open={showUnsaved}
        onOpenChange={setShowUnsaved}
        items={unsavedItems}
        busy={busy}
        offline={isOffline}
        onResend={() => {
          setShowUnsaved(false);
          void handleResendDeadLetters();
        }}
        onDiscard={(id) => {
          handleDiscardDeadLetter(id);
          if (!id) setShowUnsaved(false);
        }}
      />

      <ConfirmDialog
        open={confirmSkip && Boolean(refusedHead)}
        onOpenChange={setConfirmSkip}
        title="Discard this action?"
        description={`The server refused “${refusedHeadText ?? "this action"}”${
          refusedHead?.lastError ? ` (${refusedHead.lastError})` : ""
        }. Discarding it lets the changes after it be sent. It is kept under “not saved” until you discard it there too.`}
        confirmLabel="Discard and go on"
        cancelLabel="Keep it"
        destructive
        busy={busy}
        onConfirm={() => {
          setConfirmSkip(false);
          void handleSkipHeadAction();
        }}
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
          const res = await callServer(() =>
            updateMatchSettings(match.id, settings),
          );
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
      {canDeleteMatch && (
        <DeleteMatchDialog
          open={showDeleteMatchDialog}
          onOpenChange={setShowDeleteMatchDialog}
          match={match}
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
    </>
  );
}

export default function ScoringPage() {
  const s = useScoringScreen();
  const { authLoading, error, isAuthorized, loading, match, sunlightMode } = s;

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

  const screen: LoadedScreen = { ...s, match };

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

      <ScoringHeader s={screen} />

      <SyncBanner s={screen} />

      <main
        id="main-scoring-content"
        className="container mx-auto grid w-full min-w-0 max-w-6xl gap-2 px-2 py-2 sm:gap-6 sm:px-4 sm:py-6 lg:grid-cols-3"
      >
        <div className="flex w-full min-w-0 flex-col gap-2 max-sm:min-h-[calc(100dvh-3.75rem)] sm:gap-4 lg:col-span-2">
          <MatchNotices s={screen} />

          <Scoreboard s={screen} />

          <ConsoleBanners s={screen} />

          <Console s={screen} />

          <TieActions s={screen} />
        </div>

        <div className="hidden space-y-4 lg:block">
          <BenchCard s={screen} />

          <BowlingAttackCard s={screen} />
        </div>
      </main>

      <PlayerSearchContext.Provider value={s.findPlayers}>
        <ScoringDialogs s={screen} />
      </PlayerSearchContext.Provider>
    </div>
  );
}
