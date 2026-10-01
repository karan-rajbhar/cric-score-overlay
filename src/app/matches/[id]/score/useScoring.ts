"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "~/lib/supabase/client";
import { getMatch, getTeamPlayers, getScoringState } from "../../queries";
import {
  startMatch,
  recordBall,
  updateBall,
  undoLastBall,
  setCurrentBatsmen,
  setCurrentBowler,
  endInnings,
  startSuperOver,
} from "../../mutations";
import {
  enqueuePendingBall,
  enqueueAction,
  flushPendingActions,
  getPendingCount,
  popLastAction,
  getPendingActions,
} from "~/lib/offline-queue";
import {
  processDeliveryLocally,
  buildContextFromMatch,
  deliveryResultToScoringState,
} from "~/lib/offline-scoring-engine";
import type { LocalScoringContext } from "~/lib/offline-scoring-engine";
import { cacheMatchData, getCachedMatchData } from "~/lib/offline-match-cache";
import { createPlayerQuick } from "../../../teams/actions";
import { toast } from "sonner";
import type { Match, TeamPlayer } from "~/lib/match-types";
import type { BallEvent, ScoringState, ExtraType } from "../../types";
import type { DeliveryToEdit } from "./components/EditBallDialog";

type Player = TeamPlayer;

function deliveryLabel(d: {
  runs_scored?: number | null;
  extras?: number | null;
  extra_type?: string | null;
  is_wicket?: boolean | null;
}): string {
  if (d.is_wicket) return "W";
  if (d.extra_type === "wide") {
    const w = d.extras ?? 1;
    return w === 1 ? "Wd" : `Wd+${w - 1}`;
  }
  if (d.extra_type === "no_ball") {
    const batRuns = d.runs_scored ?? 0;
    return batRuns === 0 ? "Nb" : `Nb+${batRuns}`;
  }
  if (d.extra_type === "bye") return `B${d.extras ?? 0}`;
  if (d.extra_type === "leg_bye") return `Lb${d.extras ?? 0}`;
  if (d.extra_type === "penalty") return `P${d.extras ?? 0}`;
  const runs = d.runs_scored ?? 0;
  if (runs === 0) return "0";
  return String(runs);
}

/**
 * Single-responsibility hook: all scoring state + data fetching.
 * Page component now only handles rendering.
 */
export function useScoring(
  matchId: string,
  options?: {
    onNeedsBowler?: () => void;
    onNeedsBatsman?: () => void;
  },
) {
  const optionsRef = useRef(options);
  useEffect(() => {
    optionsRef.current = options;
  });

  const [match, setMatch] = useState<Match | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [battingTeamPlayers, setBattingTeamPlayers] = useState<Player[]>([]);
  const [bowlingTeamPlayers, setBowlingTeamPlayers] = useState<Player[]>([]);

  const [strikerId, setStrikerId] = useState<string | null>(null);
  const [nonStrikerId, setNonStrikerId] = useState<string | null>(null);
  const [currentBowlerId, setCurrentBowlerId] = useState<string | null>(null);
  const [lastOverBowlerId, setLastOverBowlerId] = useState<string | null>(null);

  const [lastBalls, setLastBalls] = useState<string[]>([]);
  const [rawDeliveries, setRawDeliveries] = useState<DeliveryToEdit[]>([]);

  const [isProcessing, setIsProcessing] = useState(false);
  const [isOffline, setIsOffline] = useState(
    () => (typeof navigator !== "undefined" ? !navigator.onLine : false),
  );
  const [pendingCount, setPendingCount] = useState(() =>
    getPendingCount(matchId),
  );
  const localCtxRef = useRef<LocalScoringContext | null>(null);
  const playersRef = useRef<{ batting: Player[]; bowling: Player[] }>({
    batting: [],
    bowling: [],
  });
  const loadedSquadTeamsRef = useRef<{
    batting: string | null;
    bowling: string | null;
  } | null>(null);

  const isRealUuid =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      matchId,
    );
  const overlayBroadcastRef = useRef<ReturnType<
    typeof supabase.channel
  > | null>(null);
  const detailBroadcastRef = useRef<ReturnType<typeof supabase.channel> | null>(
    null,
  );

  useEffect(() => {
    if (!isRealUuid) return;
    const overlayCh = supabase.channel(`overlay_${matchId}`);
    overlayCh.subscribe();
    overlayBroadcastRef.current = overlayCh;

    const detailCh = supabase.channel(`match_detail_${matchId}`);
    detailCh.subscribe();
    detailBroadcastRef.current = detailCh;

    return () => {
      void supabase.removeChannel(overlayCh);
      void supabase.removeChannel(detailCh);
    };
  }, [isRealUuid, matchId]);

  const broadcastScoreUpdate = useCallback(() => {
    if (overlayBroadcastRef.current) {
      void overlayBroadcastRef.current.send({
        type: "broadcast",
        event: "score_update",
        payload: { matchId },
      });
    }
    if (detailBroadcastRef.current) {
      void detailBroadcastRef.current.send({
        type: "broadcast",
        event: "score_update",
        payload: { matchId },
      });
    }
  }, [matchId]);

  const resolveSquadTeamIds = useCallback(
    (matchData: Match): { batting: string | null; bowling: string | null } => {
      const currentInnings = matchData.innings?.find(
        (i) => i.innings_number === matchData.current_innings,
      );
      const battingTeamId = currentInnings
        ? currentInnings.team_id
        : matchData.team1_id;
      const bowlingTeamId = currentInnings
        ? (battingTeamId === matchData.team1_id
            ? matchData.team2_id
            : matchData.team1_id)
        : matchData.team2_id;
      return { batting: battingTeamId ?? null, bowling: bowlingTeamId ?? null };
    },
    [],
  );

  const loadPlayers = useCallback(async (matchData: Match) => {
    const { batting: battingTeamId, bowling: bowlingTeamId } =
      resolveSquadTeamIds(matchData);

    if (!battingTeamId || !bowlingTeamId) return;

    try {
      const [battingResult, bowlingResult] = await Promise.all([
        getTeamPlayers(battingTeamId),
        getTeamPlayers(bowlingTeamId),
      ]);
      const fetchedBatting = (
        (battingResult.data as Player[]) || []
      ).filter((p) => p && p.team_id === battingTeamId);

      const fetchedBowling = (
        (bowlingResult.data as Player[]) || []
      ).filter((p) => p && p.team_id === bowlingTeamId);

      const battingUserIds = new Set(fetchedBatting.map((p) => p.user_id));

      const battingMap = new Map(fetchedBatting.map((p) => [p.user_id, p]));
      for (const p of playersRef.current.batting) {
        if (p.user_id && p.team_id === battingTeamId && !battingMap.has(p.user_id)) {
          battingMap.set(p.user_id, p);
        }
      }
      const updatedBatting = Array.from(battingMap.values());
      playersRef.current.batting = updatedBatting;
      setBattingTeamPlayers(updatedBatting);

      const bowlingMap = new Map(
        fetchedBowling
          .filter((p) => !battingUserIds.has(p.user_id))
          .map((p) => [p.user_id, p]),
      );
      for (const p of playersRef.current.bowling) {
        if (
          p.user_id &&
          p.team_id === bowlingTeamId &&
          !battingUserIds.has(p.user_id) &&
          !bowlingMap.has(p.user_id)
        ) {
          bowlingMap.set(p.user_id, p);
        }
      }
      const updatedBowling = Array.from(bowlingMap.values());
      playersRef.current.bowling = updatedBowling;
      setBowlingTeamPlayers(updatedBowling);

      loadedSquadTeamsRef.current = {
        batting: battingTeamId,
        bowling: bowlingTeamId,
      };
    } catch (err) {
      console.error("Error loading squad players:", err);
    }
  }, [resolveSquadTeamIds]);

  const syncFromDb = useCallback(async () => {
    const result = await getScoringState(matchId);
    if (result.error || !result.data) return;
    const {
      match: m,
      strikerId: s,
      nonStrikerId: ns,
      bowlerId: b,
      lastOverBowlerId: lob,
      thisOverDeliveries,
    } = result.data as {
      match: Match;
      strikerId: string | null;
      nonStrikerId: string | null;
      bowlerId: string | null;
      lastOverBowlerId?: string | null;
      thisOverDeliveries: DeliveryToEdit[];
    };
    // Refetch squads only on first load or when the batting/bowling sides
    // change (innings swap). Squads are otherwise mutated locally via
    // handleAddPlayerInline, which explicitly reloads them.
    const teams = resolveSquadTeamIds(m);
    const squadsFresh =
      playersRef.current.batting.length > 0 &&
      playersRef.current.bowling.length > 0 &&
      loadedSquadTeamsRef.current?.batting === teams.batting &&
      loadedSquadTeamsRef.current?.bowling === teams.bowling;
    if (!squadsFresh) {
      await loadPlayers(m);
    }
    setMatch(m);
    setStrikerId(s);
    setNonStrikerId(ns);
    setCurrentBowlerId(b);
    setLastOverBowlerId(lob ?? null);
    // Ensure we do not display deliveries from a previous over if bowler has been set for a new over
    const currentOverDeliveries =
      b && (m.current_ball === 0 || !m.current_ball)
        ? thisOverDeliveries.filter((d) => d.over_number === m.current_over)
        : thisOverDeliveries;
    setRawDeliveries(currentOverDeliveries);
    setLastBalls(currentOverDeliveries.map(deliveryLabel));

    // Cache for offline use and rebuild local scoring context
    cacheMatchData(matchId, {
      match: m,
      battingTeamPlayers: playersRef.current.batting,
      bowlingTeamPlayers: playersRef.current.bowling,
      strikerId: s,
      nonStrikerId: ns,
      bowlerId: b,
      lastOverBowlerId: lob ?? null,
    });
    localCtxRef.current = buildContextFromMatch(m, s, ns, b);
    setPendingCount(getPendingCount(matchId));

    if (m.status === "live" && !b && s && ns) {
      optionsRef.current?.onNeedsBowler?.();
    }
  }, [matchId, loadPlayers, resolveSquadTeamIds]);

  const loadMatch = useCallback(async () => {
    const result = await getMatch(matchId);
    if (result.error) {
      setError(result.error);
    } else if (result.data) {
      setMatch(result.data as Match);
    }
  }, [matchId]);

  useEffect(() => {
    let cancelled = false;
    const init = async () => {
      try {
        await syncFromDb();
      } catch {
        // Server unreachable — try loading from offline cache
        const cached = getCachedMatchData(matchId);
        if (cached && !cancelled) {
          setMatch(cached.match);
          setBattingTeamPlayers(cached.battingTeamPlayers);
          setBowlingTeamPlayers(cached.bowlingTeamPlayers);
          setStrikerId(cached.strikerId);
          setNonStrikerId(cached.nonStrikerId);
          setCurrentBowlerId(cached.bowlerId);
          setLastOverBowlerId(cached.lastOverBowlerId);
          localCtxRef.current = buildContextFromMatch(
            cached.match,
            cached.strikerId,
            cached.nonStrikerId,
            cached.bowlerId,
          );
          toast.info("Loaded from offline cache — scoring available offline");
        }
      }
      if (!cancelled) setLoading(false);
    };
    void init();
    return () => {
      cancelled = true;
    };
  }, [syncFromDb, matchId]);

  const flushOfflineQueue = useCallback(async () => {
    if (getPendingCount(matchId) === 0) return { synced: 0, failed: 0 };
    setIsProcessing(true);
    toast.info("Syncing offline deliveries with server...");

    const res = await flushPendingActions(matchId, {
      recordBall: (ball) => recordBall(ball),
      setBatsmen: (sId, nsId) => setCurrentBatsmen(matchId, sId, nsId),
      setBowler: (bId) => setCurrentBowler(matchId, bId),
      endInnings: () => endInnings(matchId),
      undoLastBall: () => undoLastBall(matchId),
    });

    setPendingCount(getPendingCount(matchId));
    if (res.synced > 0) {
      toast.success(`Successfully synced ${res.synced} offline item(s)!`);
      await syncFromDb();
    }
    if (res.failed > 0) {
      toast.error(
        `Failed to sync ${res.failed} offline item(s). Will retry automatically on next connection.`,
      );
    }
    setIsProcessing(false);
    return res;
  }, [matchId, syncFromDb]);

  useEffect(() => {
    const handleOnline = async () => {
      setIsOffline(false);
      await flushOfflineQueue();
    };
    const handleOffline = () => {
      setIsOffline(true);
      toast.warning("Network connection lost. Scoring is working in offline mode.");
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [flushOfflineQueue]);

  const applyState = (state: ScoringState) => {
    setStrikerId(state.striker_id);
    setNonStrikerId(state.non_striker_id);

    if (state.needs_bowler) {
      setCurrentBowlerId(null);
    } else if (state.bowler_id) {
      setCurrentBowlerId(state.bowler_id);
    }

    if (state.last_over_bowler_id) {
      setLastOverBowlerId(state.last_over_bowler_id);
    } else if (state.needs_bowler && state.last_bowler_id) {
      setLastOverBowlerId(state.last_bowler_id);
    }

    // Optimistically update match state so UI components reflect scores immediately
    setMatch((prev) => {
      if (!prev) return prev;
      const innings = prev.innings?.map((inn) => {
        if (inn.innings_number !== state.current_innings) return inn;

        const updatedBatting = inn.batting_performances?.map((bp) => {
          if (state.striker_id && bp.user_id === state.striker_id) {
            return {
              ...bp,
              runs_scored: state.striker_runs ?? bp.runs_scored,
              balls_faced: state.striker_balls ?? bp.balls_faced,
              is_current_batsman: true,
              is_striker: true,
            };
          }
          if (state.non_striker_id && bp.user_id === state.non_striker_id) {
            return {
              ...bp,
              runs_scored: state.non_striker_runs ?? bp.runs_scored,
              balls_faced: state.non_striker_balls ?? bp.balls_faced,
              is_current_batsman: true,
              is_striker: false,
            };
          }
          return bp;
        });

        const effectiveBowlerId =
          state.bowler_id ?? state.last_bowler_id ?? currentBowlerId;
        const effectiveOvers = state.bowler_overs ?? state.last_bowler_overs;
        const effectiveMaidens =
          state.bowler_maidens ?? state.last_bowler_maidens;
        const effectiveRuns = state.bowler_runs ?? state.last_bowler_runs;
        const effectiveWickets =
          state.bowler_wickets ?? state.last_bowler_wickets;

        let updatedBowling = inn.bowling_performances ?? [];
        if (effectiveBowlerId) {
          const exists = updatedBowling.some(
            (bp) => bp.user_id === effectiveBowlerId,
          );
          if (exists) {
            updatedBowling = updatedBowling.map((bp) => {
              if (bp.user_id === effectiveBowlerId) {
                return {
                  ...bp,
                  is_current_bowler:
                    !state.needs_bowler && bp.user_id === state.bowler_id,
                  overs_bowled: effectiveOvers ?? bp.overs_bowled,
                  maidens: effectiveMaidens ?? bp.maidens,
                  runs_conceded: effectiveRuns ?? bp.runs_conceded,
                  wickets_taken: effectiveWickets ?? bp.wickets_taken,
                };
              }
              return {
                ...bp,
                is_current_bowler:
                  !state.needs_bowler && bp.user_id === state.bowler_id,
              };
            });
          } else {
            const bowlerPlayer = bowlingTeamPlayers.find(
              (p) => p.user_id === effectiveBowlerId,
            );
            updatedBowling = [
              ...updatedBowling,
              {
                id: effectiveBowlerId,
                match_id: prev.id,
                innings_id: inn.id,
                user_id: effectiveBowlerId,
                overs_bowled: effectiveOvers ?? 0,
                balls_bowled: 0,
                maidens: effectiveMaidens ?? 0,
                runs_conceded: effectiveRuns ?? 0,
                wickets_taken: effectiveWickets ?? 0,
                wides: 0,
                no_balls: 0,
                is_current_bowler:
                  !state.needs_bowler && effectiveBowlerId === state.bowler_id,
                user: {
                  id: effectiveBowlerId,
                  full_name:
                    state.bowler_name ??
                    state.last_bowler_name ??
                    bowlerPlayer?.user?.full_name ??
                    "Bowler",
                },
              },
            ];
          }
        }

        return {
          ...inn,
          total_runs: state.total_runs,
          total_wickets: state.total_wickets,
          total_balls: state.total_balls,
          batting_performances: updatedBatting,
          bowling_performances: updatedBowling,
        };
      });

      return {
        ...prev,
        status: (state.status as Match["status"]) ?? prev.status,
        current_innings: state.current_innings,
        current_over: state.current_over,
        current_ball: state.current_ball,
        innings,
      };
    });

    if (state.match_completed) {
      toast.info(state.result_description ?? "Match completed");
      void loadMatch();
      return;
    }
    if (state.innings_break) {
      toast.info("Innings break — set new batsmen and bowler");
      void syncFromDb();
      return;
    }

    const delivery = state as unknown as {
      runs_scored?: number;
      extras?: number;
      extra_type?: string;
      is_wicket?: boolean;
    };
    if (
      delivery.runs_scored !== undefined ||
      delivery.extras !== undefined ||
      delivery.is_wicket
    ) {
      setLastBalls((prev) =>
        [...prev, deliveryLabel(delivery)].slice(-6),
      );
    }

    if (state.over_completed || state.needs_bowler) {
      toast.info("Over complete! Please select the bowler for the next over.");
      optionsRef.current?.onNeedsBowler?.();
    } else if (state.needs_batsman) {
      optionsRef.current?.onNeedsBatsman?.();
    }

    if (typeof navigator === "undefined" || navigator.onLine) {
      void syncFromDb();
    }
  };

  const handleStartMatch = async (
    tossWinner: string,
    tossDecision: "bat" | "bowl",
  ) => {
    setIsProcessing(true);
    const result = await startMatch(matchId, tossWinner, tossDecision);
    if (result.error) {
      toast.error(result.error);
    } else {
      broadcastScoreUpdate();
      await syncFromDb();
    }
    setIsProcessing(false);
    return result;
  };

  const scoreOffline = (
    bowlerId: string,
    batsmanId: string,
    nonStriker: string,
    event: BallEvent,
  ) => {
    if (!bowlerId) {
      toast.error("Select a bowler before scoring");
      setIsProcessing(false);
      return { data: null, error: "Select a bowler before scoring" };
    }
    if (!batsmanId || !nonStriker) {
      toast.error("Select batsmen before scoring");
      setIsProcessing(false);
      return { data: null, error: "Select batsmen before scoring" };
    }

    const currentCtx =
      localCtxRef.current ??
      (match
        ? buildContextFromMatch(match, batsmanId, nonStriker, bowlerId)
        : null);

    if (currentCtx) {
      const isAllOut = currentCtx.totalWickets >= currentCtx.wicketsPerInnings;
      const isOversExhausted =
        currentCtx.oversPerInnings > 0 &&
        (currentCtx.totalBalls >= currentCtx.oversPerInnings * currentCtx.ballsPerOver ||
          (currentCtx.currentOver >= currentCtx.oversPerInnings && currentCtx.currentBall === 0));
      const isTargetChased =
        currentCtx.targetRuns !== null &&
        currentCtx.totalRuns >= currentCtx.targetRuns;

      if (isAllOut || isOversExhausted || isTargetChased) {
        toast.error("Innings is complete. Please end innings or complete match.");
        setIsProcessing(false);
        return { data: null, error: "Innings is complete" };
      }

      enqueuePendingBall({
        matchId,
        bowlerId,
        batsmanId,
        nonStrikerId: nonStriker,
        event,
      });

      const result = processDeliveryLocally(currentCtx, event);
      localCtxRef.current = result;
      const computedState = deliveryResultToScoringState(
        result,
        bowlerId,
        battingTeamPlayers,
        bowlingTeamPlayers,
        event,
      );

      const newDeliveryToEdit: DeliveryToEdit = {
        id: `offline-ball-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        over_number: currentCtx.currentOver,
        ball_number: currentCtx.currentBall + 1,
        bowler_id: bowlerId,
        batsman_id: batsmanId,
        runs_scored: event.runsScored ?? 0,
        extras: event.extras ?? 0,
        extra_type: (event.extraType as ExtraType) ?? null,
        is_wicket: event.isWicket ?? false,
        dismissal_type: event.dismissalType ?? null,
        dismissed_player_id: event.dismissedPlayerId ?? null,
      };
      setRawDeliveries((prev) => [...prev, newDeliveryToEdit]);

      applyState(computedState);
      if (match) {
        cacheMatchData(matchId, {
          match,
          battingTeamPlayers,
          bowlingTeamPlayers,
          strikerId: result.strikerId,
          nonStrikerId: result.nonStrikerId,
          bowlerId: result.needsBowler ? null : result.bowlerId,
          lastOverBowlerId: result.overCompleted ? bowlerId : lastOverBowlerId,
        });
      }

      setPendingCount(getPendingCount(matchId));
      toast.info("Offline: Ball recorded locally and queued for auto-sync.");
      setIsProcessing(false);
      return { data: computedState, error: null };
    }

    setIsProcessing(false);
    return { data: null, error: "Unable to process ball locally" };
  };

  const handleScore = async (
    bowlerId: string,
    batsmanId: string,
    nonStriker: string,
    event: BallEvent,
  ) => {
    setIsProcessing(true);

    if (typeof navigator !== "undefined" && !navigator.onLine) {
      return scoreOffline(bowlerId, batsmanId, nonStriker, event);
    }

    try {
      if (getPendingCount(matchId) > 0) {
        await flushOfflineQueue();
      }

      const result = await recordBall({
        matchId,
        bowlerId,
        batsmanId,
        nonStrikerId: nonStriker,
        event,
      });
      if (result.error) {
        toast.error(result.error);
      } else if (result.data) {
        broadcastScoreUpdate();
        applyState(result.data);
      }
      setIsProcessing(false);
      return result;
    } catch (err: unknown) {
      const isNetwork =
        (typeof navigator !== "undefined" && !navigator.onLine) ||
        (err instanceof Error &&
          (err.message.includes("fetch") ||
            err.name === "NetworkError" ||
            err.message.includes("Failed to fetch") ||
            err.message.includes("network")));
      if (isNetwork) {
        return scoreOffline(bowlerId, batsmanId, nonStriker, event);
      }
      console.error("handleScore error:", err);
      toast.error("Failed to record ball");
      setIsProcessing(false);
      return { data: null, error: "Failed to record ball" };
    }
  };

  const handleUndo = async () => {
    setIsProcessing(true);

    if (typeof navigator !== "undefined" && !navigator.onLine) {
      const lastAction = popLastAction(matchId);
      if (lastAction) {
        setPendingCount(getPendingCount(matchId));
        setRawDeliveries((prev) => prev.slice(0, -1));
        setLastBalls((prev) => prev.slice(0, -1));
        toast.success("Undid last offline action");

        // Replay remaining pending actions on top of cached baseline
        const cached = getCachedMatchData(matchId);
        if (cached) {
          let replayCtx = buildContextFromMatch(
            cached.match,
            cached.strikerId,
            cached.nonStrikerId,
            cached.bowlerId,
          );
          const remainingActions = getPendingActions(matchId);
          for (const a of remainingActions) {
            if (a.type === "recordBall") {
              replayCtx = processDeliveryLocally(replayCtx, a.payload.event);
            } else if (a.type === "setBatsmen") {
              replayCtx.strikerId = a.payload.strikerId;
              replayCtx.nonStrikerId = a.payload.nonStrikerId;
            } else if (a.type === "setBowler") {
              replayCtx.bowlerId = a.payload.bowlerId;
            }
          }
          localCtxRef.current = replayCtx;
          const computed = deliveryResultToScoringState(
            replayCtx,
            replayCtx.bowlerId,
            battingTeamPlayers,
            bowlingTeamPlayers,
          );
          applyState(computed);
        }
      } else {
        toast.error("No offline deliveries in queue to undo");
      }
      setIsProcessing(false);
      return { data: null, error: null };
    }

    const result = await undoLastBall(matchId);
    if (result.error) {
      toast.error(result.error);
    } else if (result.data) {
      broadcastScoreUpdate();
      applyState(result.data);
      toast.success("Last ball undone");
    }
    await syncFromDb();
    setIsProcessing(false);
    return result;
  };

  const handleUpdateBall = async (params: {
    ballId: string;
    runsScored: number;
    extras: number;
    extraType: ExtraType | null;
    isWicket: boolean;
    dismissalType: string | null;
    batsmanId?: string | null;
    bowlerId?: string | null;
  }) => {
    setIsProcessing(true);
    const result = await updateBall({
      matchId,
      ...params,
    });
    if (result.error) {
      toast.error(result.error);
    } else if (result.data) {
      broadcastScoreUpdate();
      applyState(result.data);
      toast.success("Delivery updated in place");
    }
    await syncFromDb();
    setIsProcessing(false);
    return result;
  };

  const handleStartSuperOver = async () => {
    setIsProcessing(true);
    const result = await startSuperOver(matchId);
    if (result.error) {
      toast.error(result.error);
    } else if (result.data) {
      broadcastScoreUpdate();
      applyState(result.data);
      toast.success("Super Over initiated!");
    }
    await syncFromDb();
    setIsProcessing(false);
    return result;
  };

  const handleConfirmBatsmen = async (
    sId: string | null,
    nsId: string | null,
  ) => {
    if (!sId || !nsId) return { error: "Select both batsmen" };
    if (sId === nsId) {
      const err = "Striker and non-striker must be different players";
      toast.error(err);
      return { error: err };
    }
    if (currentBowlerId && (sId === currentBowlerId || nsId === currentBowlerId)) {
      const err = "A batsman cannot be the current bowler";
      toast.error(err);
      return { error: err };
    }
    const bowlingPlayerIds = new Set(bowlingTeamPlayers.map((p) => p.user_id));
    if (bowlingPlayerIds.has(sId) || bowlingPlayerIds.has(nsId)) {
      const err = "Cannot select an opposing team player as a batsman";
      toast.error(err);
      return { error: err };
    }

    setIsProcessing(true);

    if (typeof navigator !== "undefined" && !navigator.onLine) {
      setStrikerId(sId);
      setNonStrikerId(nsId);
      if (localCtxRef.current) {
        localCtxRef.current.strikerId = sId;
        localCtxRef.current.nonStrikerId = nsId;
      }
      enqueueAction(matchId, "setBatsmen", { strikerId: sId, nonStrikerId: nsId });
      setPendingCount(getPendingCount(matchId));
      if (match) {
        cacheMatchData(matchId, {
          match,
          battingTeamPlayers,
          bowlingTeamPlayers,
          strikerId: sId,
          nonStrikerId: nsId,
          bowlerId: currentBowlerId,
          lastOverBowlerId,
        });
      }
      toast.success("Batsmen set locally (queued for sync)");
      setIsProcessing(false);
      return { error: null };
    }

    try {
      const result = await setCurrentBatsmen(matchId, sId, nsId);
      if (result.error) {
        toast.error(result.error);
      } else {
        broadcastScoreUpdate();
        if (!currentBowlerId) {
          // Caller will open bowler dialog
        }
        await syncFromDb();
      }
      setIsProcessing(false);
      return result;
    } catch {
      // Network failure fallback
      setStrikerId(sId);
      setNonStrikerId(nsId);
      if (localCtxRef.current) {
        localCtxRef.current.strikerId = sId;
        localCtxRef.current.nonStrikerId = nsId;
      }
      enqueueAction(matchId, "setBatsmen", { strikerId: sId, nonStrikerId: nsId });
      setPendingCount(getPendingCount(matchId));
      toast.success("Batsmen set locally (queued for sync)");
      setIsProcessing(false);
      return { error: null };
    }
  };

  const handleConfirmBowler = async (bowlerId: string | null) => {
    if (!bowlerId) return { error: "Select a bowler" };
    if (bowlerId === strikerId || bowlerId === nonStrikerId) {
      const err = "The current batsman cannot be selected as bowler";
      toast.error(err);
      return { error: err };
    }
    const battingPlayerIds = new Set(battingTeamPlayers.map((p) => p.user_id));
    if (battingPlayerIds.has(bowlerId)) {
      const err = "Cannot select a batting team player as bowler";
      toast.error(err);
      return { error: err };
    }

    setIsProcessing(true);

    // If starting a new over, clear lastBalls and rawDeliveries so the previous over is not shown
    if (!currentBowlerId || !match || match.current_ball === 0) {
      setLastBalls([]);
      setRawDeliveries([]);
    }

    // Lookup new bowler's existing performance in current innings or default to 0
    const currentInn = match?.innings?.find(
      (i) => i.innings_number === match?.current_innings,
    );
    const existingPerf = currentInn?.bowling_performances?.find(
      (bp) => bp.user_id === bowlerId,
    );

    const bowlerRuns = existingPerf?.runs_conceded ?? 0;
    const bowlerBalls = existingPerf?.balls_bowled ?? 0;
    const bowlerWickets = existingPerf?.wickets_taken ?? 0;

    // Update local scoring engine context with new bowler's stats
    if (localCtxRef.current) {
      localCtxRef.current.bowlerId = bowlerId;
      localCtxRef.current.bowlerRunsConceded = bowlerRuns;
      localCtxRef.current.bowlerBallsBowled = bowlerBalls;
      localCtxRef.current.bowlerWickets = bowlerWickets;
    }

    setCurrentBowlerId(bowlerId);

    // Update match state so bowling_performances marks new bowler as current
    setMatch((prev) => {
      if (!prev) return prev;
      const innings = prev.innings?.map((inn) => {
        if (inn.innings_number !== prev.current_innings) return inn;

        const bowlerPlayer = bowlingTeamPlayers.find((p) => p.user_id === bowlerId);
        let updatedBowling = inn.bowling_performances ?? [];
        const exists = updatedBowling.some((bp) => bp.user_id === bowlerId);

        if (exists) {
          updatedBowling = updatedBowling.map((bp) => ({
            ...bp,
            is_current_bowler: bp.user_id === bowlerId,
          }));
        } else {
          updatedBowling = [
            ...updatedBowling.map((bp) => ({ ...bp, is_current_bowler: false })),
            {
              id: bowlerId,
              match_id: prev.id,
              innings_id: inn.id,
              user_id: bowlerId,
              overs_bowled: 0,
              balls_bowled: 0,
              maidens: 0,
              runs_conceded: 0,
              wickets_taken: 0,
              wides: 0,
              no_balls: 0,
              is_current_bowler: true,
              user: {
                id: bowlerId,
                full_name: bowlerPlayer?.user?.full_name ?? "Bowler",
              },
            },
          ];
        }

        return {
          ...inn,
          bowling_performances: updatedBowling,
        };
      });

      return {
        ...prev,
        innings,
      };
    });

    if (typeof navigator !== "undefined" && !navigator.onLine) {
      enqueueAction(matchId, "setBowler", { bowlerId });
      setPendingCount(getPendingCount(matchId));
      if (match) {
        cacheMatchData(matchId, {
          match,
          battingTeamPlayers,
          bowlingTeamPlayers,
          strikerId,
          nonStrikerId,
          bowlerId,
          lastOverBowlerId,
        });
      }
      toast.success("Bowler set locally (queued for sync)");
      setIsProcessing(false);
      return { error: null };
    }

    try {
      const result = await setCurrentBowler(matchId, bowlerId);
      if (result.error) {
        toast.error(result.error);
      } else {
        broadcastScoreUpdate();
        await syncFromDb();
      }
      setIsProcessing(false);
      return result;
    } catch {
      // Network failure fallback
      enqueueAction(matchId, "setBowler", { bowlerId });
      setPendingCount(getPendingCount(matchId));
      toast.success("Bowler set locally (queued for sync)");
      setIsProcessing(false);
      return { error: null };
    }
  };

  const handleAddPlayerInline = async (
    target: "batting" | "bowling" | null,
    name: string,
    currentMatch: Match | null,
    currentStriker: string | null,
    currentNonStriker: string | null,
    currentBowler: string | null,
  ) => {
    if (!target || !name.trim() || !currentMatch) return null;
    const currentInnings = currentMatch.innings?.find(
      (i) => i.innings_number === currentMatch.current_innings,
    );
    const battingTeamId = currentInnings
      ? currentInnings.team_id
      : currentMatch.team1_id;
    const bowlingTeamId = currentInnings
      ? (battingTeamId === currentMatch.team1_id
          ? currentMatch.team2_id
          : currentMatch.team1_id)
      : currentMatch.team2_id;
    const targetTeamId = target === "batting" ? battingTeamId : bowlingTeamId;
    if (!targetTeamId) {
      toast.error("Could not find team to add player to");
      return null;
    }
    setIsProcessing(true);
    const result = await createPlayerQuick(targetTeamId, name.trim());
    if (result.error || !result.data) {
      toast.error(result.error ?? "Could not add player");
    } else {
      const newPlayer: Player = {
        id: result.data.user_id,
        team_id: targetTeamId,
        user_id: result.data.user_id,
        user: { id: result.data.user_id, full_name: result.data.full_name },
      };
      if (target === "batting") {
        setBattingTeamPlayers((prev) => {
          if (prev.some((p) => p.user_id === newPlayer.user_id)) return prev;
          return [...prev, newPlayer];
        });
        setBowlingTeamPlayers((prev) =>
          prev.filter((p) => p.user_id !== newPlayer.user_id),
        );
        if (!currentStriker) {
          setStrikerId(newPlayer.user_id);
        } else if (!currentNonStriker && currentStriker !== newPlayer.user_id) {
          setNonStrikerId(newPlayer.user_id);
        }
      } else {
        setBowlingTeamPlayers((prev) => {
          if (prev.some((p) => p.user_id === newPlayer.user_id)) return prev;
          return [...prev, newPlayer];
        });
        setBattingTeamPlayers((prev) =>
          prev.filter((p) => p.user_id !== newPlayer.user_id),
        );
        if (!currentBowler) setCurrentBowlerId(newPlayer.user_id);
      }
      toast.success(`${result.data.full_name} added to squad`);
      await loadPlayers(currentMatch);
    }
    setIsProcessing(false);
    return result;
  };

  const handleEndInnings = async () => {
    setIsProcessing(true);

    if (typeof navigator !== "undefined" && !navigator.onLine) {
      enqueueAction(matchId, "endInnings", {});
      setPendingCount(getPendingCount(matchId));

      setMatch((prev) => {
        if (!prev) return prev;
        const currentInn = prev.innings?.find(
          (i) => i.innings_number === prev.current_innings,
        );
        const newInningsNum = (prev.current_innings ?? 1) + 1;
        const targetRuns = currentInn ? (currentInn.total_runs ?? 0) + 1 : null;
        return {
          ...prev,
          current_innings: newInningsNum,
          current_over: 0,
          current_ball: 0,
          innings: [
            ...(prev.innings ?? []).map((i) =>
              i.innings_number === prev.current_innings
                ? { ...i, is_completed: true }
                : i,
            ),
            {
              id: `local-inn-${newInningsNum}`,
              match_id: prev.id,
              innings_number: newInningsNum,
              team_id:
                currentInn?.team_id === prev.team1_id
                  ? prev.team2_id
                  : prev.team1_id,
              total_runs: 0,
              total_wickets: 0,
              total_balls: 0,
              total_overs: 0,
              is_completed: false,
              target_runs: targetRuns,
              extras_total: 0,
              extras_byes: 0,
              extras_leg_byes: 0,
              extras_wides: 0,
              extras_no_balls: 0,
              extras_penalties: 0,
            },
          ],
        };
      });

      setStrikerId(null);
      setNonStrikerId(null);
      setCurrentBowlerId(null);
      setLastBalls([]);
      setRawDeliveries([]);

      setBattingTeamPlayers(bowlingTeamPlayers);
      setBowlingTeamPlayers(battingTeamPlayers);
      playersRef.current = {
        batting: bowlingTeamPlayers,
        bowling: battingTeamPlayers,
      };

      if (localCtxRef.current) {
        const newInn = (localCtxRef.current.currentInnings ?? 1) + 1;
        const targetRuns = (localCtxRef.current.totalRuns ?? 0) + 1;
        localCtxRef.current = {
          ...localCtxRef.current,
          currentInnings: newInn,
          currentOver: 0,
          currentBall: 0,
          totalRuns: 0,
          totalWickets: 0,
          totalBalls: 0,
          strikerId: null,
          nonStrikerId: null,
          bowlerId: null,
          strikerRuns: 0,
          strikerBalls: 0,
          nonStrikerRuns: 0,
          nonStrikerBalls: 0,
          bowlerRunsConceded: 0,
          bowlerBallsBowled: 0,
          bowlerWickets: 0,
          targetRuns,
        };
      }

      toast.info(
        "Innings break — offline mode. Select new batsmen and bowler for the 2nd innings.",
      );
      optionsRef.current?.onNeedsBatsman?.();
      setIsProcessing(false);
      return { data: null, error: null };
    }

    try {
      const result = await endInnings(matchId);
      if (result.error) {
        toast.error(result.error);
      } else if (result.data) {
        broadcastScoreUpdate();
        applyState(result.data);
      }
      setIsProcessing(false);
      return result;
    } catch {
      setIsProcessing(false);
      return { data: null, error: "Failed to end innings" };
    }
  };

  return {
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
    setMatch,
    loadPlayers,
    syncFromDb,
    handleStartMatch,
    handleScore,
    handleUndo,
    handleUpdateBall,
    handleStartSuperOver,
    handleConfirmBatsmen,
    handleConfirmBowler,
    handleAddPlayerInline,
    handleEndInnings,
    setLastBalls,
  };
}
