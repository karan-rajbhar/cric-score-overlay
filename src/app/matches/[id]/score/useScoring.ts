"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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
  retirePlayer,
  awardTeamPenalty,
  reassignCurrentOverBowler,
} from "../../mutations";
import {
  enqueuePendingBall,
  enqueueAction,
  flushPendingActions,
  getPendingCount,
  popLastAction,
  getPendingActions,
  getDeadLetterCount,
  skipHeadAction,
  newActionId,
  postReplayBatch,
  type AwardPenaltyPayload,
  type FlushResult,
  type QueuedAction,
  type ReplayTransport,
  type RetireBatterPayload,
} from "~/lib/offline-queue";
import {
  baseWithDelta,
  baseWithDocs,
  foldPending,
  isPendingBallId,
  type PredictionBase,
} from "~/lib/scoring-prediction";
import { reportClientError } from "~/lib/report-error";
import {
  entryForChange,
  pushEntry,
  takeUndo,
  undoableSeq,
  undoneBallOf,
  type UndoEntry,
  type UndoneBall,
} from "~/lib/scoring-undo";
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
import {
  applyLiveResync,
  applyScoringDelta,
  liveResyncReads,
  type LiveChanges,
  type ScoringDelta,
} from "~/lib/scoring-delta";

/**
 * Instant scoring (see `~/lib/scoring-prediction`): deliveries, crease and
 * bowler changes show at once and are saved in the background. Build with
 * `NEXT_PUBLIC_INSTANT_SCORING=false` to wait for the server instead.
 */
const INSTANT_SCORING = process.env.NEXT_PUBLIC_INSTANT_SCORING !== "false";

/** Retry delays (ms) while queued actions cannot reach the server. */
const RETRY_DELAYS = [2_000, 4_000, 8_000, 15_000, 30_000];
import { getFirebaseDb } from "~/lib/firebase/client";
import { readDoc } from "~/lib/firebase/realtime";
import type { OversRow } from "~/lib/firebase/scorecard";
import type { InningsRow } from "~/lib/firebase/types";

/** A screen state and the stored documents behind it. */
type ShownState = { snapshot: Snapshot; base: PredictionBase | null };

/** What `getScoringState` returns. */
type Snapshot = {
  match: Match;
  strikerId: string | null;
  nonStrikerId: string | null;
  bowlerId: string | null;
  lastOverBowlerId: string | null;
  thisOverDeliveries: DeliveryToEdit[];
};

type Player = TeamPlayer;

/** What the screen shows of a snapshot, to compare a prediction with the server. */
function shownFigures(s: Snapshot) {
  const m = s.match;
  const inn = m.innings?.find((i) => i.innings_number === m.current_innings);
  const bat = (id: string | null) => {
    const p = inn?.batting_performances?.find((b) => b.user_id === id);
    return p ? [id, p.runs_scored, p.balls_faced, p.fours, p.sixes] : [id];
  };
  const bowl = inn?.bowling_performances?.find(
    (b) => b.user_id === s.bowlerId,
  );
  return JSON.stringify([
    m.current_innings,
    inn?.total_runs,
    inn?.total_wickets,
    inn?.total_balls,
    bat(s.strikerId),
    bat(s.nonStrikerId),
    s.bowlerId,
    bowl
      ? [bowl.overs_bowled, bowl.maidens, bowl.runs_conceded, bowl.wickets_taken]
      : null,
    s.lastOverBowlerId,
    s.thisOverDeliveries.map(deliveryLabel),
  ]);
}

function isOfflineNow(): boolean {
  return typeof navigator !== "undefined" && !navigator.onLine;
}

/** A thrown server-action call that never reached the server (or lost its reply). */
function isNetworkError(err: unknown): boolean {
  return (
    isOfflineNow() ||
    (err instanceof Error &&
      (err.message.includes("fetch") ||
        err.name === "NetworkError" ||
        err.message.includes("Failed to fetch") ||
        err.message.includes("network")))
  );
}

/** A retirement on the local context (offline): the batter leaves the crease. */
function retireLocally(
  ctx: LocalScoringContext,
  p: RetireBatterPayload,
): LocalScoringContext {
  return {
    ...ctx,
    strikerId: ctx.strikerId === p.playerId ? null : ctx.strikerId,
    nonStrikerId: ctx.nonStrikerId === p.playerId ? null : ctx.nonStrikerId,
    // Retired hurt is not out; retired out is a wicket.
    totalWickets: ctx.totalWickets + (p.type === "retired_out" ? 1 : 0),
  };
}

/**
 * Penalty / bonus runs on the local context (offline): runs to the batting
 * side count at once; runs to the fielding side are credited by the server
 * to that side's own innings.
 */
function penaltyLocally(
  ctx: LocalScoringContext,
  p: AwardPenaltyPayload,
  match: Pick<Match, "innings"> | null,
): LocalScoringContext {
  const battingTeam = match?.innings?.find(
    (i) => i.innings_number === ctx.currentInnings,
  )?.team_id;
  return battingTeam && battingTeam === p.teamId
    ? { ...ctx, totalRuns: ctx.totalRuns + p.runs }
    : ctx;
}

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

/** What the over strip shows after an undo (see `scoring-undo`). */
export interface UndoNotice {
  /** The undone ball as the over strip labels it ("4", "W", "Wd"...). */
  label: string;
  /** "3.6 · Starc to Kohli" (empty when not known). */
  detail: string;
  /** Still waiting for the server's undo (it could not be shown at once). */
  pending: boolean;
  canRedo: boolean;
}

const UNDO_STORAGE_PREFIX = "cric_undo_history_";

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
  const [deadLetterCount, setDeadLetterCount] = useState(() =>
    getDeadLetterCount(matchId),
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

  /**
   * The server's confirmed state (`getScoringState` or built from a reply's
   * delta) and the stored documents behind it (instant scoring's base).
   */
  const snapshotRef = useRef<Snapshot | null>(null);
  const baseRef = useRef<PredictionBase | null>(null);
  /** The queued actions cannot be shown yet: the screen waits for the server. */
  const [awaitingServer, setAwaitingServer] = useState(false);
  /**
   * Instant undo (`~/lib/scoring-undo`): for the recent balls the screen
   * saw happen, the state just before each (what the server's undo
   * restores); and for each queued undo, the state it shows
   * (`UndoTargets` in `~/lib/scoring-prediction`). Kept on the device so a
   * reload does not lose them.
   */
  const undoStackRef = useRef<UndoEntry<ShownState>[]>([]);
  const undoTargetsRef = useRef(new Map<string, ShownState>());
  /** Balls undone since the last scoring action, most recent last (redo). */
  const redoRef = useRef<UndoneBall[]>([]);
  const [undoNotice, setUndoNotice] = useState<UndoNotice | null>(null);
  /** A server undo is in progress (one the screen could not show at once). */
  const [undoing, setUndoing] = useState(false);
  const saveUndoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  /** Save the undo history on the device (debounced; on page hide too). */
  const saveUndoHistory = useCallback(() => {
    try {
      if (typeof window === "undefined") return;
      window.localStorage.setItem(
        `${UNDO_STORAGE_PREFIX}${matchId}`,
        JSON.stringify({
          v: 1,
          stack: undoStackRef.current.slice(-6),
          targets: [...undoTargetsRef.current.entries()],
        }),
      );
    } catch {
      // Storage full or blocked: undo then waits for the server after a reload.
    }
  }, [matchId]);
  const scheduleUndoSave = useCallback(() => {
    if (saveUndoTimer.current) clearTimeout(saveUndoTimer.current);
    saveUndoTimer.current = setTimeout(saveUndoHistory, 400);
  }, [saveUndoHistory]);
  useEffect(() => {
    const flush = () => {
      if (document.visibilityState === "hidden") saveUndoHistory();
    };
    window.addEventListener("pagehide", saveUndoHistory);
    document.addEventListener("visibilitychange", flush);
    return () => {
      window.removeEventListener("pagehide", saveUndoHistory);
      document.removeEventListener("visibilitychange", flush);
      if (saveUndoTimer.current) clearTimeout(saveUndoTimer.current);
    };
  }, [saveUndoHistory]);
  /** The saved history, once, when the screen first has a state. */
  const restoreUndoHistory = useCallback(() => {
    try {
      const raw = window.localStorage.getItem(`${UNDO_STORAGE_PREFIX}${matchId}`);
      const saved = raw ? JSON.parse(raw) : null;
      if (saved?.v !== 1) return;
      if (!undoStackRef.current.length && Array.isArray(saved.stack)) {
        undoStackRef.current = saved.stack as UndoEntry<ShownState>[];
      }
      if (Array.isArray(saved.targets)) {
        for (const [id, state] of saved.targets as Array<[string, ShownState]>) {
          if (!undoTargetsRef.current.has(id)) undoTargetsRef.current.set(id, state);
        }
      }
    } catch {
      // Unreadable: start without it.
    }
  }, [matchId]);

  /** Put a snapshot (confirmed or predicted) on screen. */
  const renderSnapshot = useCallback(async (data: Snapshot): Promise<void> => {
    const {
      match: m,
      strikerId: s,
      nonStrikerId: ns,
      bowlerId: b,
      lastOverBowlerId: lob,
      thisOverDeliveries,
    } = data;
    // Refetch squads only on first load or when the batting/bowling sides
    // change (innings swap). Squads are otherwise mutated locally via
    // handleAddPlayerInline, which explicitly reloads them.
    const teams = resolveSquadTeamIds(m);
    const squadsFresh =
      playersRef.current.batting.length > 0 &&
      playersRef.current.bowling.length > 0 &&
      loadedSquadTeamsRef.current?.batting === teams.batting &&
      loadedSquadTeamsRef.current?.bowling === teams.bowling;
    // The two sides swapping (an innings change, or undoing back into the
    // previous innings): the squads at hand, swapped, shown at once; then
    // refreshed in the background (a player added since, one in both).
    const swapped =
      !squadsFresh &&
      playersRef.current.batting.length > 0 &&
      playersRef.current.bowling.length > 0 &&
      loadedSquadTeamsRef.current?.batting === teams.bowling &&
      loadedSquadTeamsRef.current?.bowling === teams.batting;
    if (swapped) {
      const { batting, bowling } = playersRef.current;
      playersRef.current = { batting: bowling, bowling: batting };
      loadedSquadTeamsRef.current = {
        batting: teams.batting,
        bowling: teams.bowling,
      };
      setBattingTeamPlayers(bowling);
      setBowlingTeamPlayers(batting);
      void loadPlayers(m);
    } else if (!squadsFresh) {
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
  }, [matchId, loadPlayers, resolveSquadTeamIds]);

  /** Names of the squads' players, for building snapshots from documents. */
  const squadNames = useCallback(() => {
    const names = new Map<string, { id: string; full_name: string | null }>();
    for (const p of [
      ...playersRef.current.batting,
      ...playersRef.current.bowling,
    ]) {
      if (p.user_id && p.user) {
        names.set(p.user_id, { id: p.user.id, full_name: p.user.full_name });
      }
    }
    return names;
  }, []);

  /**
   * The last situation the scorer was asked to pick a batter / bowler for.
   * Asked once per situation: a confirmation or re-read of the same one
   * does not reopen a dialog the scorer closed.
   */
  const promptKeyRef = useRef<string | null>(null);
  const promptForNeeds = useCallback(
    (
      at: {
        status?: string | null;
        innings: number | null | undefined;
        balls: number | null | undefined;
        wickets: number | null | undefined;
        striker: string | null;
        nonStriker: string | null;
        bowler: string | null;
      },
      fromAction: boolean,
    ) => {
      if (at.status !== "live") return;
      const need =
        !at.striker || !at.nonStriker ? "batsman" : !at.bowler ? "bowler" : null;
      if (!need) {
        promptKeyRef.current = null;
        return;
      }
      const key = `${at.innings}:${at.balls}:${at.wickets}:${need}`;
      if (!fromAction && key === promptKeyRef.current) return;
      promptKeyRef.current = key;
      if (need === "batsman") optionsRef.current?.onNeedsBatsman?.();
      else optionsRef.current?.onNeedsBowler?.();
    },
    [],
  );
  const needsOf = (snap: Snapshot) => {
    const inn = snap.match.innings?.find(
      (i) => i.innings_number === snap.match.current_innings,
    );
    return {
      status: snap.match.status,
      innings: snap.match.current_innings,
      balls: inn?.total_balls,
      wickets: inn?.total_wickets,
      striker: snap.strikerId,
      nonStriker: snap.nonStrikerId,
      bowler: snap.bowlerId,
    };
  };

  /**
   * Show the confirmed state with the instant actions still queued applied
   * on top (`foldPending`). Queued offline-mode actions are not predicted:
   * the confirmed state shows, as before.
   */
  const renderShown = useCallback(async (): Promise<Snapshot | null> => {
    const confirmed = snapshotRef.current;
    if (!confirmed) return null;
    const pending = getPendingActions(matchId);
    if (
      !INSTANT_SCORING ||
      pending.length === 0 ||
      pending.some((a) => !a.instant)
    ) {
      setAwaitingServer(false);
      await renderSnapshot(confirmed);
      return confirmed;
    }
    const folded = foldPending(
      { snapshot: confirmed, base: baseRef.current },
      pending,
      squadNames(),
      undefined,
      undoTargetsRef.current,
    );
    setAwaitingServer(folded.waiting);
    await renderSnapshot(folded.state.snapshot);
    return folded.state.snapshot;
  }, [matchId, renderSnapshot, squadNames]);

  /** A new confirmed state from the server, shown with what is still queued. */
  const applySnapshot = useCallback(
    async (data: Snapshot, base: PredictionBase | null): Promise<void> => {
      const prev = snapshotRef.current
        ? { snapshot: snapshotRef.current, base: baseRef.current }
        : null;
      snapshotRef.current = data;
      baseRef.current = base;
      // One ball-log entry since the last confirmed state (a ball on the
      // waiting path, a co-scorer's, a retirement): the state before it is
      // that last state, when it holds the crease the ball was bowled with.
      // A ball this screen predicted already has its entry.
      const entry = prev ? entryForChange(prev, { snapshot: data, base }) : null;
      if (
        entry &&
        !undoStackRef.current.some((e) => e.ballSeq === entry.ballSeq) &&
        (!entry.ball ||
          entry.ball.isEvent ||
          (entry.ball.batsmanId === prev!.snapshot.strikerId &&
            entry.ball.nonStrikerId === prev!.snapshot.nonStrikerId &&
            entry.ball.bowlerId === prev!.snapshot.bowlerId))
      ) {
        undoStackRef.current = pushEntry(undoStackRef.current, entry);
        scheduleUndoSave();
      }
      const shown = await renderShown();
      if (shown) promptForNeeds(needsOf(shown), false);
    },
    [renderShown, scheduleUndoSave, promptForNeeds],
  );

  const syncFromDb = useCallback(async (): Promise<boolean> => {
    const result = await getScoringState(matchId);
    if (result.error || !result.data) return false;
    await applySnapshot(
      result.data as unknown as Snapshot,
      (result as { base?: PredictionBase | null }).base ?? null,
    );
    return true;
  }, [matchId, applySnapshot]);

  /**
   * After a mutation that answered with the documents it committed: the
   * same state `syncFromDb` would read, built from them (no request);
   * re-reads when they are not enough (see `~/lib/scoring-delta`).
   */
  const applyDelta = useCallback(
    async (delta: ScoringDelta | null | undefined): Promise<boolean> => {
      const prev = snapshotRef.current;
      const next = prev ? applyScoringDelta(prev, delta, squadNames()) : null;
      if (!next || !delta) return syncFromDb();
      await applySnapshot(next, baseWithDelta(baseRef.current, next, delta));
      return true;
    },
    [applySnapshot, syncFromDb, squadNames],
  );

  /**
   * Follow a change made elsewhere (a co-scorer) from the documents it
   * wrote, named by `live_state` (`useLiveResync`): reads those `innings`
   * and current-innings `overs` docs (public reads) instead of the whole
   * state. False when they are not enough; the caller then re-reads.
   */
  const syncFromLive = useCallback(
    async (changes: LiveChanges): Promise<boolean> => {
      const prev = snapshotRef.current;
      const reads = prev ? liveResyncReads(prev, changes) : null;
      if (!prev || !reads) return false;
      const db = getFirebaseDb();
      const [innings, overs] = await Promise.all([
        Promise.all(
          reads.innings.map((id) => readDoc<InningsRow>(db, "innings", id)),
        ),
        Promise.all(
          reads.overs.map((id) => readDoc<OversRow>(db, "overs", id)),
        ),
      ]);
      if (innings.some((d) => !d)) return false;
      const inningsDocs = innings.map((d, i) => ({ ...d!, id: reads.innings[i]! }));
      const next = applyLiveResync(
        prev,
        inningsDocs,
        reads.overs.map((id, i) => [id, overs[i] ?? null] as const),
        squadNames(),
      );
      // The screen moved on (an own action) while these were read.
      if (!next || snapshotRef.current !== prev) return false;
      await applySnapshot(
        next,
        baseWithDocs(
          baseRef.current,
          next,
          inningsDocs,
          // A missing over was emptied (an undo): it has no ball now.
          reads.overs.map((id, i) => {
            const o = overs[i];
            if (o) return { ...o, id };
            const cut = id.lastIndexOf("_");
            return {
              id,
              match_id: prev.match.id,
              innings_id: id.slice(0, cut),
              over_number: Number(id.slice(cut + 1)),
              balls: [],
              updated_at: null,
            };
          }),
        ),
      );
      return true;
    },
    [applySnapshot, squadNames],
  );

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
    /**
     * The last state seen on this device (server state plus every action
     * queued since), so the screen opens and scores without the network.
     */
    const restoreFromCache = (): boolean => {
      const cached = getCachedMatchData(matchId);
      if (!cached || cancelled) return false;
      playersRef.current = {
        batting: cached.battingTeamPlayers,
        bowling: cached.bowlingTeamPlayers,
      };
      setMatch(cached.match);
      setBattingTeamPlayers(cached.battingTeamPlayers);
      setBowlingTeamPlayers(cached.bowlingTeamPlayers);
      setStrikerId(cached.strikerId);
      setNonStrikerId(cached.nonStrikerId);
      setCurrentBowlerId(cached.bowlerId);
      setLastOverBowlerId(cached.lastOverBowlerId);
      setLastBalls(cached.lastBalls ?? []);
      localCtxRef.current = buildContextFromMatch(
        cached.match,
        cached.strikerId,
        cached.nonStrikerId,
        cached.bowlerId,
      );
      setPendingCount(getPendingCount(matchId));
      toast.info("Offline: showing the score saved on this device.");
      return true;
    };
    const init = async () => {
      restoreUndoHistory();
      // Offline: don't wait for a server call that cannot succeed.
      if (!(isOfflineNow() && restoreFromCache())) {
        try {
          await syncFromDb();
        } catch {
          // Server unreachable — fall back to the device copy.
          restoreFromCache();
        }
      }
      if (!cancelled) setLoading(false);
    };
    void init();
    return () => {
      cancelled = true;
    };
  }, [syncFromDb, matchId, restoreUndoHistory]);

  useEffect(() => {
    if (!match) return;
    cacheMatchData(matchId, {
      match,
      battingTeamPlayers,
      bowlingTeamPlayers,
      strikerId,
      nonStrikerId,
      bowlerId: currentBowlerId,
      lastOverBowlerId,
      lastBalls,
    });
  }, [
    matchId,
    match,
    battingTeamPlayers,
    bowlingTeamPlayers,
    strikerId,
    nonStrikerId,
    currentBowlerId,
    lastOverBowlerId,
    lastBalls,
  ]);

  /** Ids of the queued actions in the request being sent right now. */
  const inFlightRef = useRef<ReadonlySet<string>>(new Set());
  const sendBatch = useCallback<ReplayTransport>(async (batch) => {
    inFlightRef.current = new Set(batch.actions.map((a) => a.id));
    try {
      return await postReplayBatch(batch);
    } finally {
      inFlightRef.current = new Set();
    }
  }, []);
  /** Queued actions are being sent. */
  const [isSaving, setIsSaving] = useState(false);
  /** The last attempt left actions queued (no connection, or refused). */
  const [syncStuck, setSyncStuck] = useState(false);
  const flushRef = useRef<Promise<FlushResult> | null>(null);
  const retryRef = useRef<{
    timer: ReturnType<typeof setTimeout> | null;
    attempt: number;
  }>({ timer: null, attempt: 0 });
  const flushQueueRef = useRef<(() => Promise<FlushResult>) | null>(null);

  /**
   * The server applied `actions` and answered with `next`: tell when the
   * prediction the screen showed for them differs (it should not: it is
   * the engine's own computation), so a drift shows in the server log.
   */
  const checkPrediction = useCallback(
    (
      before: { snapshot: Snapshot; base: PredictionBase | null },
      actions: QueuedAction[],
      next: Snapshot,
    ) => {
      if (!actions.length || actions.some((a) => !a.instant)) return;
      const folded = foldPending(
        before,
        actions,
        squadNames(),
        undefined,
        undoTargetsRef.current,
      );
      if (folded.applied !== actions.length || folded.endsInnings) return;
      const predicted = shownFigures(folded.state.snapshot);
      const server = shownFigures(next);
      if (predicted === server) return;
      console.warn("Instant scoring: the prediction differed from the server", {
        predicted,
        server,
      });
      reportClientError({
        kind: "error",
        message: `Instant scoring prediction differed from the server (${actions
          .map((a) => a.type)
          .join(", ")})`,
        stack: JSON.stringify({ predicted, server }).slice(0, 4000),
      });
    },
    [squadNames],
  );

  /** Sends what is queued, once; see {@link flushQueue}. */
  const flushPass = useCallback(
    async (manual: boolean): Promise<FlushResult> => {
      const sent = getPendingActions(matchId);
      if (sent.length === 0 || isOfflineNow()) {
        return { synced: 0, failed: sent.length ? 1 : 0 };
      }
      // Offline-mode work is announced; instant saves are quiet.
      const loud = manual || sent.some((a) => !a.instant);
      if (loud) {
        setIsProcessing(true);
        toast.info("Syncing offline deliveries with server...");
      }
      setIsSaving(true);
      const before = snapshotRef.current
        ? { snapshot: snapshotRef.current, base: baseRef.current }
        : null;

      // Replayed through /api/scoring/replay, not server actions: their ids
      // change with each deploy, and this queue may predate the current build.
      // Each action carries its queue id as the idempotency key, so a replay
      // after a lost response is not applied twice.
      const res = await flushPendingActions(matchId, sendBatch);

      setPendingCount(getPendingCount(matchId));
      setDeadLetterCount(getDeadLetterCount(matchId));
      const appliedIds = new Set(res.applied ?? []);
      const applied = sent.filter((a) => appliedIds.has(a.queueId));
      // Every applied action is one this pass knew of (not one queued while
      // it ran): only then can its prediction be compared.
      const knownAll = applied.length === appliedIds.size;
      if (res.rejected) {
        const { dependents } = res.rejected;
        const error = res.rejected.error.replace(/\.?\s*$/, ".");
        toast.error(
          dependents > 0
            ? `Not saved: ${error} The ${dependents} later action(s) were not sent either. The score shows what was saved.`
            : `Not saved: ${error} The score shows what was saved.`,
        );
        await syncFromDb();
      } else if (res.synced > 0) {
        if (applied.some((a) => !a.instant)) {
          toast.success(`Successfully synced ${res.synced} offline item(s)!`);
        }
        const next =
          before && res.delta && snapshotRef.current === before.snapshot
            ? applyScoringDelta(before.snapshot, res.delta, squadNames())
            : null;
        if (next && res.delta) {
          if (knownAll) checkPrediction(before!, applied, next);
          await applySnapshot(
            next,
            baseWithDelta(before!.base, next, res.delta),
          );
        } else {
          // An undo answers without its documents: re-read, then compare
          // with what the screen showed for it.
          await syncFromDb();
          if (
            knownAll &&
            before &&
            snapshotRef.current &&
            applied.some((a) => a.type === "undoLastBall")
          ) {
            checkPrediction(before, applied, snapshotRef.current);
          }
        }
        // A delivery that ended the innings or the match (instant actions
        // wait for the server there; offline mode announces its own).
        const after = snapshotRef.current;
        if (before && after && applied.some((a) => a.instant)) {
          if (
            after.match.status === "completed" &&
            before.snapshot.match.status !== "completed"
          ) {
            toast.info(after.match.result_description ?? "Match completed");
            void loadMatch();
          } else if (
            after.match.current_innings !== before.snapshot.match.current_innings
          ) {
            toast.info("Innings break — set new batsmen and bowler");
          }
        }
      }
      if (res.errorCode) {
        toast.error(
          res.errorCode === "not_authenticated"
            ? "Sign in again to sync the queued actions. They are kept on this device."
            : res.errorCode === "unsupported_version"
              ? "The server cannot accept this app version's queued actions yet. They are kept on this device."
              : `Could not sync queued actions (${res.errorMessage ?? res.errorCode}). They are kept on this device.`,
        );
      } else if (res.failed > 0 && !res.rejected && loud) {
        toast.error(
          `Failed to sync ${res.failed} offline item(s). Will retry automatically on next connection.`,
        );
      }

      // Undo states of actions no longer queued are not needed.
      const queued = new Set(getPendingActions(matchId).map((a) => a.queueId));
      for (const id of undoTargetsRef.current.keys()) {
        if (!queued.has(id)) undoTargetsRef.current.delete(id);
      }

      const stuck = getPendingCount(matchId) > 0 && res.synced === 0;
      setSyncStuck(stuck);
      const retry = retryRef.current;
      if (retry.timer) clearTimeout(retry.timer);
      retry.timer = null;
      if (!stuck) {
        retry.attempt = 0;
      } else if (!res.errorCode && !isOfflineNow()) {
        // No reply while "online" (a weak signal): try again shortly.
        const delay =
          RETRY_DELAYS[Math.min(retry.attempt, RETRY_DELAYS.length - 1)]!;
        retry.attempt += 1;
        retry.timer = setTimeout(() => {
          retry.timer = null;
          void flushQueueRef.current?.();
        }, delay);
      }
      setIsSaving(false);
      if (loud) setIsProcessing(false);
      return res;
    },
    [matchId, sendBatch, syncFromDb, applySnapshot, squadNames, checkPrediction, loadMatch],
  );

  /**
   * Sends the queue in the background, one flush at a time, until it is
   * empty or stuck. A call while one runs shares it (the running one picks
   * up actions queued meanwhile).
   */
  const flushQueue = useCallback(
    (options?: { manual?: boolean }): Promise<FlushResult> => {
      if (flushRef.current) return flushRef.current;
      const run = (async () => {
        let res = await flushPass(options?.manual ?? false);
        // Actions queued while the reply was being applied (a pass that
        // failed is retried later, not straight away).
        while (
          getPendingCount(matchId) > 0 &&
          !isOfflineNow() &&
          res.synced > 0 &&
          res.failed === 0 &&
          !res.errorCode &&
          !res.rejected
        ) {
          const more = await flushPass(false);
          res = {
            ...more,
            synced: res.synced + more.synced,
            applied: [...(res.applied ?? []), ...(more.applied ?? [])],
          };
        }
        return res;
      })().finally(() => {
        flushRef.current = null;
      });
      flushRef.current = run;
      return run;
    },
    [matchId, flushPass],
  );
  useEffect(() => {
    flushQueueRef.current = flushQueue;
  }, [flushQueue]);

  /** The "Sync now" button. */
  const flushOfflineQueue = useCallback(
    () => flushQueue({ manual: true }),
    [flushQueue],
  );

  useEffect(() => {
    const retry = retryRef.current;
    const onVisible = () => {
      if (
        document.visibilityState === "visible" &&
        getPendingCount(matchId) > 0
      ) {
        void flushQueueRef.current?.();
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      if (retry.timer) clearTimeout(retry.timer);
      retry.timer = null;
    };
  }, [matchId]);

  /**
   * Before sending an action straight to the server: replay anything still
   * queued first, so the server sees actions in the order they were made.
   * Returns false when the queue could not be emptied; the caller then
   * queues its action behind the others instead.
   */
  const drainQueue = useCallback(async (): Promise<boolean> => {
    if (getPendingCount(matchId) === 0) return true;
    await flushQueue();
    return getPendingCount(matchId) === 0;
  }, [matchId, flushQueue]);

  useEffect(() => {
    const handleOnline = async () => {
      setIsOffline(false);
      await flushQueue();
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
  }, [flushQueue]);

  /**
   * `refresh`: how to catch up with the server afterwards: the reply's
   * committed documents (`delta`), a re-read (default), or nothing when the
   * caller re-reads itself (`false`).
   */
  const applyState = (
    state: ScoringState,
    refresh: { delta: ScoringDelta | null | undefined } | boolean = true,
  ) => {
    const catchUp = () =>
      refresh === false
        ? Promise.resolve(true)
        : refresh === true
          ? syncFromDb()
          : applyDelta(refresh.delta);
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

        const updatedBatting = (inn.batting_performances ?? []).map((bp) => {
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
          if (bp.user_id !== state.striker_id && bp.user_id !== state.non_striker_id) {
            const wasCurrent = bp.is_current_batsman || (strikerId && bp.user_id === strikerId) || (nonStrikerId && bp.user_id === nonStrikerId);
            const isDismissed = Boolean(state.is_wicket && wasCurrent);
            return {
              ...bp,
              is_current_batsman: false,
              is_striker: false,
              ...(isDismissed && state.dismissal_type !== "retired_hurt"
                ? { is_out: true, dismissal_type: state.dismissal_type ?? bp.dismissal_type }
                : {}),
            };
          }
          return bp;
        });

        if (state.striker_id && !updatedBatting.some((bp) => bp.user_id === state.striker_id)) {
          const strikerPlayer = battingTeamPlayers.find((p) => p.user_id === state.striker_id);
          updatedBatting.push({
            id: state.striker_id,
            match_id: prev.id,
            innings_id: inn.id,
            user_id: state.striker_id,
            runs_scored: state.striker_runs ?? 0,
            balls_faced: state.striker_balls ?? 0,
            fours: 0,
            sixes: 0,
            is_out: false,
            is_current_batsman: true,
            is_striker: true,
            user: {
              id: state.striker_id,
              full_name: state.striker_name ?? strikerPlayer?.user?.full_name ?? "Striker",
            },
          });
        }
        if (state.non_striker_id && !updatedBatting.some((bp) => bp.user_id === state.non_striker_id)) {
          const nonStrikerPlayer = battingTeamPlayers.find((p) => p.user_id === state.non_striker_id);
          updatedBatting.push({
            id: state.non_striker_id,
            match_id: prev.id,
            innings_id: inn.id,
            user_id: state.non_striker_id,
            runs_scored: state.non_striker_runs ?? 0,
            balls_faced: state.non_striker_balls ?? 0,
            fours: 0,
            sixes: 0,
            is_out: false,
            is_current_batsman: true,
            is_striker: false,
            user: {
              id: state.non_striker_id,
              full_name: state.non_striker_name ?? nonStrikerPlayer?.user?.full_name ?? "Non-Striker",
            },
          });
        }
        if (state.is_wicket && strikerId && !state.striker_id && !updatedBatting.some((bp) => bp.user_id === strikerId)) {
          const dismissedPlayer = battingTeamPlayers.find((p) => p.user_id === strikerId);
          updatedBatting.push({
            id: strikerId,
            match_id: prev.id,
            innings_id: inn.id,
            user_id: strikerId,
            runs_scored: 0,
            balls_faced: 1,
            fours: 0,
            sixes: 0,
            is_out: state.dismissal_type !== "retired_hurt",
            dismissal_type: state.dismissal_type ?? undefined,
            is_current_batsman: false,
            is_striker: false,
            user: {
              id: strikerId,
              full_name: dismissedPlayer?.user?.full_name ?? "Striker",
            },
          });
        }

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
      void catchUp();
      return;
    }

    const delivery = state as unknown as {
      runs_scored?: number;
      extras?: number;
      extra_type?: string;
      is_wicket?: boolean;
    };
    const hasBallEvent =
      (delivery.runs_scored !== undefined && delivery.runs_scored !== null) ||
      (delivery.extras !== undefined && delivery.extras !== null) ||
      Boolean(delivery.is_wicket);
    if (hasBallEvent) {
      setLastBalls((prev) =>
        [...prev, deliveryLabel(delivery)].slice(-6),
      );
    }

    if (!state.innings_completed && !state.match_completed) {
      promptForNeeds(
        {
          status: state.status,
          innings: state.current_innings,
          balls: state.total_balls,
          wickets: state.total_wickets,
          striker: state.needs_batsman ? null : state.striker_id,
          nonStriker: state.needs_batsman ? null : state.non_striker_id,
          bowler:
            state.needs_bowler || state.over_completed
              ? null
              : (state.bowler_id ?? null),
        },
        true,
      );
    }

    if (typeof navigator === "undefined" || navigator.onLine) {
      void catchUp();
    }
  };

  /**
   * Instant scoring: queue the action and show it at once, when the screen
   * can predict it exactly (the engine's own functions over the confirmed
   * state and everything queued before it, `foldPending`). Null when it
   * cannot (offline-mode actions queued, documents not at hand, waiting
   * for the server already): the caller takes the waiting path.
   */
  const scoreInstantly = (
    type: "recordBall" | "setBatsmen" | "setBowler",
    payload: QueuedAction["payload"],
  ): { error: null } | null => {
    if (!INSTANT_SCORING || awaitingServer) return null;
    const confirmed = snapshotRef.current;
    const base = baseRef.current;
    if (!confirmed || !base) return null;
    const pending = getPendingActions(matchId);
    if (pending.some((a) => !a.instant)) return null;
    const queueId = newActionId();
    const action = {
      queueId,
      matchId,
      type,
      payload,
      enqueuedAt: Date.now(),
      instant: true,
    } as QueuedAction;
    const names = squadNames();
    const before = foldPending(
      { snapshot: confirmed, base },
      pending,
      names,
      undefined,
      undoTargetsRef.current,
    );
    const folded = foldPending(
      { snapshot: confirmed, base },
      [...pending, action],
      names,
      undefined,
      undoTargetsRef.current,
    );
    if (folded.applied !== pending.length + 1) return null;
    // For an instant undo of this ball: the state just before it.
    if (type === "recordBall") {
      const entry = entryForChange(before.state, folded.state);
      if (entry) {
        undoStackRef.current = pushEntry(undoStackRef.current, entry);
        scheduleUndoSave();
      }
    }

    enqueueAction(matchId, type, payload, queueId, { instant: true });
    setPendingCount(getPendingCount(matchId));
    // A delivery that ends the innings shows, then waits for the server:
    // the next innings or the result is its to decide.
    setAwaitingServer(folded.waiting);
    const shown = folded.state.snapshot;
    void renderSnapshot(shown);
    if (type === "recordBall" && !folded.endsInnings) {
      promptForNeeds(needsOf(shown), true);
    }
    if (!isOfflineNow()) void flushQueue();
    return { error: null };
  };

  const handleStartMatch = async (
    tossWinner: string,
    tossDecision: "bat" | "bowl",
  ) => {
    clearUndone();
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

  const scoreOffline = (
    bowlerId: string,
    batsmanId: string,
    nonStriker: string,
    event: BallEvent,
    actionId?: string,
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

      const ctxToProcess = {
        ...currentCtx,
        strikerId: batsmanId,
        nonStrikerId: nonStriker,
        bowlerId: bowlerId,
      };

      enqueuePendingBall(
        {
          matchId,
          bowlerId,
          batsmanId,
          nonStrikerId: nonStriker,
          event,
        },
        actionId,
      );

      const result = processDeliveryLocally(ctxToProcess, event);
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
    { fromRedo = false }: { fromRedo?: boolean } = {},
  ) => {
    if (!fromRedo) clearUndone();
    const instant = scoreInstantly("recordBall", {
      matchId,
      bowlerId,
      batsmanId,
      nonStrikerId: nonStriker,
      event,
    });
    if (instant) return { data: null, ...instant };

    setIsProcessing(true);

    if (isOfflineNow()) {
      return scoreOffline(bowlerId, batsmanId, nonStriker, event);
    }

    // Sent with the request so that, should the reply be lost, the queued
    // retry is recognised by the server instead of recording a second ball.
    const actionId = newActionId();
    try {
      // Queued deliveries go first; if some could not be sent, this one
      // waits behind them.
      if (!(await drainQueue())) {
        return scoreOffline(bowlerId, batsmanId, nonStriker, event, actionId);
      }

      const result = await recordBall({
        matchId,
        bowlerId,
        batsmanId,
        nonStrikerId: nonStriker,
        event,
        clientActionId: actionId,
      });
      if (result.error) {
        toast.error(result.error);
      } else if (result.data) {
        applyState(result.data, { delta: result.delta });
      }
      setIsProcessing(false);
      return result;
    } catch (err: unknown) {
      if (isNetworkError(err)) {
        // Same id: if the server did record it, the replay is a no-op.
        return scoreOffline(bowlerId, batsmanId, nonStriker, event, actionId);
      }
      console.error("handleScore error:", err);
      toast.error("Failed to record ball");
      setIsProcessing(false);
      return { data: null, error: "Failed to record ball" };
    }
  };

  /** Clear the undo note and the redo list (a new scoring action). */
  const clearUndone = () => {
    redoRef.current = [];
    setUndoNotice(null);
  };

  /** The over strip's note for an undone ball (and redo, when possible). */
  const noticeFor = (ball: UndoneBall | null, pending = false): UndoNotice => {
    const names = squadNames();
    const name = (id: string | null) =>
      (id ? names.get(id)?.full_name : null) ?? null;
    const bowler = name(ball?.bowlerId ?? null);
    const batter = name(ball?.batsmanId ?? null);
    return {
      label: ball
        ? deliveryLabel({
            runs_scored: ball.event.runsScored ?? 0,
            extras: ball.event.extras ?? 0,
            extra_type: ball.event.extraType ?? null,
            is_wicket: ball.event.isWicket ?? false,
          })
        : "",
      detail: ball
        ? [
            `${ball.over}.${ball.ball}`,
            bowler && batter ? `${bowler} to ${batter}` : null,
          ]
            .filter(Boolean)
            .join(" · ")
        : "",
      pending,
      canRedo: redoRef.current.length > 0,
    };
  };

  /** The screen state with everything queued applied, when all of it is shown. */
  const shownNow = (pending: QueuedAction[]): ShownState | null => {
    const confirmed = snapshotRef.current;
    if (!confirmed) return null;
    const folded = foldPending(
      { snapshot: confirmed, base: baseRef.current },
      pending,
      squadNames(),
      undefined,
      undoTargetsRef.current,
    );
    return folded.applied === pending.length ? folded.state : null;
  };

  /** Note the undo of `ball` in the over strip, with redo when it is a delivery. */
  const noteUndone = (ball: UndoneBall | null, pending = false) => {
    if (ball && !ball.isEvent && !pending) redoRef.current.push(ball);
    setUndoNotice(noticeFor(ball, pending));
  };

  /**
   * Undo the last ball at once: show the state the screen had just before
   * it and queue the undo (the server's undo restores that same state).
   * False when the screen cannot vouch for that state (see `takeUndo`).
   */
  const undoInstantly = async (pending: QueuedAction[]): Promise<boolean> => {
    if (!INSTANT_SCORING) return false;
    const shown = shownNow(pending);
    if (!shown) return false;
    const { entry, stack } = takeUndo(undoStackRef.current, shown);
    undoStackRef.current = stack;
    if (!entry) return false;
    const queueId = newActionId();
    undoTargetsRef.current.set(queueId, entry.before);
    enqueueAction(
      matchId,
      "undoLastBall",
      {} as Record<string, never>,
      queueId,
      { instant: true },
    );
    setPendingCount(getPendingCount(matchId));
    noteUndone(entry.ball);
    scheduleUndoSave();
    await renderShown();
    if (!isOfflineNow()) void flushQueue();
    return true;
  };

  const handleUndo = async () => {
    const pending = getPendingActions(matchId);
    const last = pending.at(-1);
    if (INSTANT_SCORING && pending.every((a) => a.instant)) {
      // A delivery the server has not seen yet: just take it back.
      if (
        last?.type === "recordBall" &&
        !inFlightRef.current.has(last.queueId)
      ) {
        const shown = shownNow(pending);
        const { entry, stack } = shown
          ? takeUndo(undoStackRef.current, shown)
          : { entry: null, stack: undoStackRef.current };
        undoStackRef.current = stack;
        popLastAction(matchId);
        setPendingCount(getPendingCount(matchId));
        noteUndone(
          entry?.ball ??
            (shown?.base?.innings.last_ball
              ? undoneBallOf(shown.base.innings.last_ball)
              : null),
        );
        scheduleUndoSave();
        await renderShown();
        return { data: null, error: null };
      }
      if (await undoInstantly(pending)) return { data: null, error: null };
      // Otherwise the server gets everything first, then undoes its last
      // ball as usual.
    }

    // Say at once what is being undone, while the server does it.
    const shownBefore = shownNow(pending);
    const lastBall =
      shownBefore && undoableSeq(shownBefore)?.sameInnings
        ? (shownBefore.base?.innings.last_ball ?? null)
        : null;
    const undoneBall = lastBall ? undoneBallOf(lastBall) : null;
    setUndoNotice(noticeFor(undoneBall, true));
    setUndoing(true);
    setIsProcessing(true);

    // While actions are still queued, the last action is a queued one: undo
    // it locally rather than undoing the server's last ball out of order.
    if (isOfflineNow() || !(await drainQueue())) {
      const lastAction = popLastAction(matchId);
      if (lastAction) {
        setPendingCount(getPendingCount(matchId));
        if (lastAction.type === "recordBall") {
          setRawDeliveries((prev) => prev.slice(0, -1));
          setLastBalls((prev) => prev.slice(0, -1));
        }

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
              if (a.payload.batsmanId) replayCtx.strikerId = a.payload.batsmanId;
              if (a.payload.nonStrikerId) replayCtx.nonStrikerId = a.payload.nonStrikerId;
              if (a.payload.bowlerId) replayCtx.bowlerId = a.payload.bowlerId;
              replayCtx = processDeliveryLocally(replayCtx, a.payload.event);
            } else if (a.type === "setBatsmen") {
              replayCtx.strikerId = a.payload.strikerId;
              replayCtx.nonStrikerId = a.payload.nonStrikerId;
            } else if (
              a.type === "setBowler" ||
              a.type === "reassignOverBowler"
            ) {
              replayCtx.bowlerId = a.payload.bowlerId;
            } else if (a.type === "retireBatter") {
              replayCtx = retireLocally(replayCtx, a.payload);
            } else if (a.type === "awardPenalty") {
              replayCtx = penaltyLocally(replayCtx, a.payload, cached.match);
            } else if (a.type === "startSuperOver") {
              replayCtx.currentInnings = (replayCtx.currentInnings ?? 2) + 1;
              replayCtx.currentOver = 0;
              replayCtx.currentBall = 0;
              replayCtx.totalRuns = 0;
              replayCtx.totalWickets = 0;
              replayCtx.totalBalls = 0;
              replayCtx.strikerId = null;
              replayCtx.nonStrikerId = null;
              replayCtx.bowlerId = null;
              replayCtx.oversPerInnings = 1;
              replayCtx.wicketsPerInnings = 2;
            } else if (a.type === "endInnings") {
              replayCtx.currentInnings = (replayCtx.currentInnings ?? 1) + 1;
              replayCtx.currentOver = 0;
              replayCtx.currentBall = 0;
              replayCtx.totalRuns = 0;
              replayCtx.totalWickets = 0;
              replayCtx.totalBalls = 0;
              replayCtx.strikerId = null;
              replayCtx.nonStrikerId = null;
              replayCtx.bowlerId = null;
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
    // The state after an undo is the server's to say (the crease and bowler
    // the undone ball was bowled with): from the documents it committed, or
    // a fresh read; not run through the after-a-ball handling (which would
    // add a ball to the over strip and prompt for a bowler or batter).
    if (result.error) {
      toast.error(result.error);
      setUndoNotice(null);
      await syncFromDb();
    } else {
      await applyDelta(result.delta);
      noteUndone(undoneBall);
    }
    setUndoing(false);
    setIsProcessing(false);
    return result;
  };

  /** Record again the ball undone last (offered until the next action). */
  const handleRedo = async () => {
    const ball = redoRef.current.at(-1);
    if (!ball?.bowlerId || !ball.batsmanId || !ball.nonStrikerId) {
      clearUndone();
      return { data: null, error: null };
    }
    redoRef.current.pop();
    const next = redoRef.current.at(-1);
    setUndoNotice(next ? noticeFor(next) : null);
    return handleScore(ball.bowlerId, ball.batsmanId, ball.nonStrikerId, ball.event, {
      fromRedo: true,
    });
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
    clearUndone();
    // Still being saved (instant scoring): its server id is not known yet.
    if (isPendingBallId(params.ballId) && !isOfflineNow()) {
      const err = "This delivery is still being saved. Try again in a moment.";
      toast.error(err);
      void flushQueue();
      return { data: null, error: err };
    }
    // A delivery recorded offline has no server id yet: it cannot be edited
    // until it has synced (undo it and score it again instead).
    if (
      params.ballId.startsWith("offline-ball-") ||
      isPendingBallId(params.ballId)
    ) {
      const err =
        "This delivery has not synced yet. Undo it and score it again instead.";
      toast.error(err);
      return { data: null, error: err };
    }
    setIsProcessing(true);
    const queueIt = () => {
      enqueueAction(matchId, "updateBall", params);
      setPendingCount(getPendingCount(matchId));
      setRawDeliveries((prev) =>
        prev.map((d) =>
          d.id === params.ballId
            ? {
                ...d,
                runs_scored: params.runsScored,
                extras: params.extras,
                extra_type: params.extraType,
                is_wicket: params.isWicket,
                dismissal_type: params.dismissalType,
                batsman_id: params.batsmanId ?? d.batsman_id,
                bowler_id: params.bowlerId ?? d.bowler_id,
              }
            : d,
        ),
      );
      toast.info("Offline: delivery edit queued for sync.");
      setIsProcessing(false);
      return { data: null, error: null };
    };
    try {
      if (isOfflineNow() || !(await drainQueue())) return queueIt();
      const result = await updateBall({
        matchId,
        ...params,
      });
      if (result.error) {
        toast.error(result.error);
      } else if (result.data) {
        applyState(result.data, false);
        toast.success("Delivery updated in place");
      }
      await syncFromDb();
      setIsProcessing(false);
      return result;
    } catch (err) {
      // update_ball sets the delivery's values, so a replay is harmless.
      if (isNetworkError(err)) return queueIt();
      setIsProcessing(false);
      return { data: null, error: "Failed to update delivery" };
    }
  };

  /**
   * Runs a match action that edits the ball log outside `record_ball`
   * (retirement, penalty runs, re-assigning the over): straight to the
   * server when nothing is queued, otherwise (or offline, or when the call
   * fails on the network) queued behind the other actions under the id it
   * was sent with, so a replay is never applied twice.
   */
  const runOrQueue = async (
    send: (actionId: string) => Promise<{ error: string | null }>,
    queue: (actionId: string) => void,
  ): Promise<{ error: string | null; queued: boolean }> => {
    clearUndone();
    setIsProcessing(true);
    const actionId = newActionId();
    const queueIt = () => {
      queue(actionId);
      setPendingCount(getPendingCount(matchId));
      setIsProcessing(false);
      return { error: null, queued: true };
    };
    try {
      if (isOfflineNow() || !(await drainQueue())) return queueIt();
      const res = await send(actionId);
      setIsProcessing(false);
      return { error: res.error, queued: false };
    } catch (err) {
      if (isNetworkError(err)) return queueIt();
      setIsProcessing(false);
      return {
        error: err instanceof Error ? err.message : "Request failed",
        queued: false,
      };
    }
  };

  const handleRetireBatter = (payload: RetireBatterPayload) =>
    runOrQueue(
      (id) => retirePlayer(matchId, { ...payload, clientActionId: id }),
      (id) => {
        enqueueAction(matchId, "retireBatter", payload, id);
        if (localCtxRef.current) {
          localCtxRef.current = retireLocally(localCtxRef.current, payload);
        }
        setStrikerId((id) => (id === payload.playerId ? null : id));
        setNonStrikerId((id) => (id === payload.playerId ? null : id));
        toast.info("Offline: retirement queued for sync.");
      },
    );

  const handleAwardPenalty = (payload: AwardPenaltyPayload) =>
    runOrQueue(
      (id) => awardTeamPenalty(matchId, { ...payload, clientActionId: id }),
      (id) => {
        enqueueAction(matchId, "awardPenalty", payload, id);
        if (localCtxRef.current) {
          localCtxRef.current = penaltyLocally(
            localCtxRef.current,
            payload,
            match,
          );
        }
        toast.info("Offline: penalty runs queued for sync.");
      },
    );

  const handleReassignOverBowler = (bowlerId: string) =>
    runOrQueue(
      (id) => reassignCurrentOverBowler(matchId, bowlerId, id),
      (id) => {
        enqueueAction(matchId, "reassignOverBowler", { bowlerId }, id);
        if (localCtxRef.current) localCtxRef.current.bowlerId = bowlerId;
        setCurrentBowlerId(bowlerId);
        toast.info("Offline: bowler change queued for sync.");
      },
    );

  const handleStartSuperOver = async () => {
    clearUndone();
    setIsProcessing(true);

    if (isOfflineNow() || !(await drainQueue())) {
      enqueueAction(matchId, "startSuperOver", {});
      setPendingCount(getPendingCount(matchId));

      const lastInningsNum =
        match?.innings?.reduce(
          (max, inn) => Math.max(max, inn.innings_number),
          match?.current_innings ?? 2,
        ) ?? 2;
      const newInningsNum = lastInningsNum + 1;

      // In Super Over, team that batted second in match bats first in Super Over
      const inn2 = match?.innings?.find((i) => i.innings_number === 2);
      const superOverBattingTeamId = inn2?.team_id ?? match?.team2_id;

      setMatch((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          status: "live",
          current_innings: newInningsNum,
          current_over: 0,
          current_ball: 0,
          winning_team_id: null,
          result_type: null,
          result_description: "Super Over in progress",
          innings: [
            ...(prev.innings ?? []).map((i) =>
              i.is_completed ? i : { ...i, is_completed: true },
            ),
            {
              id: `local-super-over-${newInningsNum}`,
              match_id: prev.id,
              innings_number: newInningsNum,
              team_id: superOverBattingTeamId ?? prev.team2_id,
              total_runs: 0,
              total_wickets: 0,
              total_balls: 0,
              total_overs: 0,
              is_completed: false,
              target_runs: null,
              extras_total: 0,
              extras_byes: 0,
              extras_leg_byes: 0,
              extras_wides: 0,
              extras_no_balls: 0,
              extras_penalties: 0,
              batting_performances: [],
              bowling_performances: [],
            },
          ],
        };
      });

      setStrikerId(null);
      setNonStrikerId(null);
      setCurrentBowlerId(null);
      setLastOverBowlerId(null);
      setLastBalls([]);
      setRawDeliveries([]);

      if (
        superOverBattingTeamId &&
        bowlingTeamPlayers.length > 0 &&
        bowlingTeamPlayers[0]?.team_id === superOverBattingTeamId
      ) {
        setBattingTeamPlayers(bowlingTeamPlayers);
        setBowlingTeamPlayers(battingTeamPlayers);
        playersRef.current = {
          batting: bowlingTeamPlayers,
          bowling: battingTeamPlayers,
        };
      }

      if (localCtxRef.current) {
        localCtxRef.current = {
          ...localCtxRef.current,
          currentInnings: newInningsNum,
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
          targetRuns: null,
          oversPerInnings: 1,
          wicketsPerInnings: 2,
        };
      }

      if (match) {
        cacheMatchData(matchId, {
          match,
          battingTeamPlayers,
          bowlingTeamPlayers,
          strikerId: null,
          nonStrikerId: null,
          bowlerId: null,
          lastOverBowlerId: null,
        });
      }

      toast.success("Super Over initiated offline! (Queued for sync)");
      optionsRef.current?.onNeedsBatsman?.();
      setIsProcessing(false);
      return { data: null, error: null };
    }

    const actionId = newActionId();
    try {
      const result = await startSuperOver(matchId, actionId);
      if (result.error) {
        toast.error(result.error);
      } else if (result.data) {
        applyState(result.data, false);
        toast.success("Super over started");
      }
      await syncFromDb();
      setIsProcessing(false);
      return result;
    } catch {
      // Same id: if the server did start it, the replay is a no-op.
      enqueueAction(matchId, "startSuperOver", {}, actionId);
      setPendingCount(getPendingCount(matchId));
      toast.success("Super Over queued for sync");
      setIsProcessing(false);
      return { data: null, error: null };
    }
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

    clearUndone();
    const instant = scoreInstantly("setBatsmen", {
      strikerId: sId,
      nonStrikerId: nsId,
    });
    if (instant) return instant;

    setIsProcessing(true);

    if (isOfflineNow() || !(await drainQueue())) {
      setStrikerId(sId);
      setNonStrikerId(nsId);
      if (localCtxRef.current) {
        localCtxRef.current.strikerId = sId;
        localCtxRef.current.nonStrikerId = nsId;
      }
      setMatch((prev) => {
        if (!prev) return prev;
        const innings = prev.innings?.map((inn) => {
          if (inn.innings_number !== prev.current_innings) return inn;
          let bps = [...(inn.batting_performances ?? [])];
          bps = bps.map((b) => ({
            ...b,
            is_current_batsman: b.user_id === sId || b.user_id === nsId,
            is_striker: b.user_id === sId,
          }));
          if (sId && !bps.some((b) => b.user_id === sId)) {
            const p = battingTeamPlayers.find((tp) => tp.user_id === sId);
            bps.push({
              id: sId,
              match_id: prev.id,
              innings_id: inn.id,
              user_id: sId,
              runs_scored: 0,
              balls_faced: 0,
              fours: 0,
              sixes: 0,
              is_out: false,
              is_current_batsman: true,
              is_striker: true,
              user: { id: sId, full_name: p?.user?.full_name ?? "Striker" },
            });
          }
          if (nsId && !bps.some((b) => b.user_id === nsId)) {
            const p = battingTeamPlayers.find((tp) => tp.user_id === nsId);
            bps.push({
              id: nsId,
              match_id: prev.id,
              innings_id: inn.id,
              user_id: nsId,
              runs_scored: 0,
              balls_faced: 0,
              fours: 0,
              sixes: 0,
              is_out: false,
              is_current_batsman: true,
              is_striker: false,
              user: { id: nsId, full_name: p?.user?.full_name ?? "Non-Striker" },
            });
          }
          return { ...inn, batting_performances: bps };
        });
        return { ...prev, innings };
      });
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
        await applyDelta(result.delta);
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

    clearUndone();
    const instant = scoreInstantly("setBowler", { bowlerId });
    if (instant) return instant;

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

    if (isOfflineNow() || !(await drainQueue())) {
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
        await applyDelta(result.delta);
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
    const result = await createPlayerQuick(targetTeamId, name.trim(), matchId);
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
        // Not put at the crease here: that is the batsmen dialog's to
        // confirm (a crease the server does not have breaks the next ball).
      } else {
        setBowlingTeamPlayers((prev) => {
          if (prev.some((p) => p.user_id === newPlayer.user_id)) return prev;
          return [...prev, newPlayer];
        });
        setBattingTeamPlayers((prev) =>
          prev.filter((p) => p.user_id !== newPlayer.user_id),
        );
      }
      toast.success(`${result.data.full_name} added to squad`);
      await loadPlayers(currentMatch);
    }
    setIsProcessing(false);
    return result;
  };

  const handleEndInnings = async () => {
    clearUndone();
    setIsProcessing(true);

    if (isOfflineNow() || !(await drainQueue())) {
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
      const result = await endInnings(matchId, newActionId());
      if (result.error) {
        toast.error(result.error);
      } else if (result.data) {
        applyState(result.data);
      }
      setIsProcessing(false);
      return result;
    } catch {
      setIsProcessing(false);
      return { data: null, error: "Failed to end innings" };
    }
  };

  const handleSkipHeadAction = () => {
    const skipped = skipHeadAction(matchId);
    setPendingCount(getPendingCount(matchId));
    setDeadLetterCount(getDeadLetterCount(matchId));
    if (skipped) {
      toast.info(`Skipped blocked offline ${skipped.type} action`);
    }
    return skipped;
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
    // Waiting for the server (an action it must decide) blocks scoring too.
    isProcessing: isProcessing || awaitingServer,
    /** Undo is unavailable (a blocking action or a server undo runs). */
    undoBusy: isProcessing || undoing,
    /** What the last undo took back, for the over strip (null: nothing). */
    undoNotice,
    handleRedo,
    /** Queued actions are being saved in the background. */
    isSaving,
    /** Queued actions could not be saved on the last attempt. */
    syncStuck,
    isOffline,
    pendingCount,
    deadLetterCount,
    flushOfflineQueue,
    handleSkipHeadAction,
    setStrikerId,
    setNonStrikerId,
    setCurrentBowlerId,
    setMatch,
    loadPlayers,
    syncFromDb,
    syncFromLive,
    handleStartMatch,
    handleScore,
    handleUndo,
    handleUpdateBall,
    handleRetireBatter,
    handleAwardPenalty,
    handleReassignOverBowler,
    handleStartSuperOver,
    handleConfirmBatsmen,
    handleConfirmBowler,
    handleAddPlayerInline,
    handleEndInnings,
    setLastBalls,
  };
}
