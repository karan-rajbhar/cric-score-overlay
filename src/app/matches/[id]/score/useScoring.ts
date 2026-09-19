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

  const loadPlayers = useCallback(async (matchData: Match) => {
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

      setBattingTeamPlayers((prev) => {
        const map = new Map(fetchedBatting.map((p) => [p.user_id, p]));
        for (const p of prev) {
          if (p.user_id && p.team_id === battingTeamId && !map.has(p.user_id)) {
            map.set(p.user_id, p);
          }
        }
        return Array.from(map.values());
      });

      setBowlingTeamPlayers((prev) => {
        const filteredBowling = fetchedBowling.filter(
          (p) => !battingUserIds.has(p.user_id),
        );
        const map = new Map(filteredBowling.map((p) => [p.user_id, p]));
        for (const p of prev) {
          if (
            p.user_id &&
            p.team_id === bowlingTeamId &&
            !battingUserIds.has(p.user_id) &&
            !map.has(p.user_id)
          ) {
            map.set(p.user_id, p);
          }
        }
        return Array.from(map.values());
      });
    } catch (err) {
      console.error("Error loading squad players:", err);
    }
  }, []);

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
    await loadPlayers(m);
    setMatch(m);
    setStrikerId(s);
    setNonStrikerId(ns);
    setCurrentBowlerId(b);
    setLastOverBowlerId(lob ?? null);
    setRawDeliveries(thisOverDeliveries);
    setLastBalls(thisOverDeliveries.map(deliveryLabel));
    if (m.status === "live" && !b && s && ns) {
      optionsRef.current?.onNeedsBowler?.();
    }
  }, [matchId, loadPlayers]);

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

    void syncFromDb();
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

  const handleScore = async (
    bowlerId: string,
    batsmanId: string,
    nonStriker: string,
    event: BallEvent,
  ) => {
    setIsProcessing(true);
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
  };

  const handleUndo = async () => {
    setIsProcessing(true);
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
    const result = await setCurrentBowler(matchId, bowlerId);
    if (result.error) {
      toast.error(result.error);
    } else {
      broadcastScoreUpdate();
      await syncFromDb();
    }
    setIsProcessing(false);
    return result;
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
    const result = await endInnings(matchId);
    if (result.error) {
      toast.error(result.error);
    } else if (result.data) {
      broadcastScoreUpdate();
      applyState(result.data);
    }
    setIsProcessing(false);
    return result;
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
