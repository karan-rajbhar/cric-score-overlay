"use client";

import { useCallback, useEffect, useState } from "react";
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
export function useScoring(matchId: string) {
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

  const loadPlayers = async (matchData: Match) => {
    const currentInnings = matchData.innings?.find(
      (i) => i.innings_number === matchData.current_innings,
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
    if (battingResult.data)
      setBattingTeamPlayers(battingResult.data as Player[]);
    if (bowlingResult.data)
      setBowlingTeamPlayers(bowlingResult.data as Player[]);
  };

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
    if (m.status === "live") await loadPlayers(m);
    setMatch(m);
    setStrikerId(s);
    setNonStrikerId(ns);
    setCurrentBowlerId(b);
    setLastOverBowlerId(lob ?? null);
    setRawDeliveries(thisOverDeliveries);
    setLastBalls(thisOverDeliveries.map(deliveryLabel));
  }, [matchId]);

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
    if (state.needs_batsman || state.needs_bowler) {
      void syncFromDb();
      return;
    }
    setLastBalls((prev) =>
      [
        ...prev,
        deliveryLabel(
          state as unknown as {
            runs_scored: number;
            extras: number;
            extra_type: string;
            is_wicket: boolean;
          },
        ),
      ].slice(-6),
    );
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
  }) => {
    setIsProcessing(true);
    const result = await updateBall({
      matchId,
      ...params,
    });
    if (result.error) {
      toast.error(result.error);
    } else if (result.data) {
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
    setIsProcessing(true);
    const result = await setCurrentBatsmen(matchId, sId, nsId);
    if (result.error) {
      toast.error(result.error);
    } else {
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
    setIsProcessing(true);
    const result = await setCurrentBowler(matchId, bowlerId);
    if (result.error) {
      toast.error(result.error);
    } else {
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
    const battingTeamId = currentInnings?.team_id;
    const bowlingTeamId =
      battingTeamId === currentMatch.team1_id
        ? currentMatch.team2_id
        : currentMatch.team1_id;
    const targetTeamId = target === "batting" ? battingTeamId : bowlingTeamId;
    if (!targetTeamId) return null;
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
        setBattingTeamPlayers((prev) => [...prev, newPlayer]);
        if (!currentStriker) setStrikerId(newPlayer.user_id);
        else if (!currentNonStriker) setNonStrikerId(newPlayer.user_id);
      } else {
        setBowlingTeamPlayers((prev) => [...prev, newPlayer]);
        if (!currentBowler) setCurrentBowlerId(newPlayer.user_id);
      }
      toast.success(`${result.data.full_name} added to squad`);
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
