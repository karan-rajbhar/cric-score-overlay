"use client";

import {
  useQuery,
  useQueryClient,
  type QueryClient,
  type QueryKey,
} from "@tanstack/react-query";
import { useEffect, useMemo, useRef } from "react";
import { createClient, getFirebaseDb } from "~/lib/firebase/client";
import {
  ensureLiveScorecard,
  getMatchBallLog,
  getMatch,
} from "~/app/matches/queries";
import { fetchMatchList } from "~/app/matches/match-list";
import {
  clubsForMatch,
  clubWithRecords,
  fetchMyClubs,
  offerAddToClub,
} from "~/app/matches/club-data";
import {
  fetchWizardBase,
  fetchWizardScope,
  hasClubRecords,
  type MatchWizardData,
  type WizardScope,
} from "~/app/matches/create/wizard-data";
import { ballEventsOfOver, ballLogContext, mergeOvers } from "~/lib/ball-log";
import { sortRows } from "~/lib/firebase/filters";
import { readDoc } from "~/lib/firebase/realtime";
import { OVERS_COLLECTION, type OversRow } from "~/lib/firebase/scorecard";
import { overSummariesOf } from "~/lib/firebase/views";
import type { BallEvent, Match } from "~/lib/match-types";
import {
  applyLiveScorecard,
  applyLiveState,
  LIVE_REFETCH_DELAY_MS,
  latestLiveVersion,
  liveScorecardViewOf,
  overChangesBetween,
  scheduleInvalidate,
  useLiveScorecard,
  useLiveState,
  useOnLiveChange,
} from "./useLiveState";

/** Poll interval used only while the live listener is in error. */
const LIVE_FALLBACK_POLL_MS = 30_000;

const MATCH_ID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isMatchId(id: string | null | undefined): id is string {
  return !!id && MATCH_ID_RE.test(id);
}

/**
 * Refetch `queryKey` once per live change (debounced, deduplicated across
 * components). Only mounted queries refetch, so data behind a closed tab
 * costs nothing. Falls back to a slow poll while the listener is in error.
 */
function useRefetchOnLiveChange(
  matchId: string,
  queryKey: QueryKey,
  enabled = true,
) {
  const queryClient = useQueryClient();
  const live = useLiveState(isMatchId(matchId) ? matchId : null);
  const keyHash = JSON.stringify(queryKey);

  useOnLiveChange(live, () => {
    if (enabled)
      scheduleInvalidate(queryClient, JSON.parse(keyHash) as QueryKey);
  });

  useEffect(() => {
    if (!enabled || live.status !== "error") return;
    const poll = setInterval(
      () => scheduleInvalidate(queryClient, JSON.parse(keyHash) as QueryKey),
      LIVE_FALLBACK_POLL_MS,
    );
    return () => clearInterval(poll);
  }, [enabled, live.status, queryClient, keyHash]);
}

/**
 * The live scorecard of a match while it is live (shared listener), else
 * null. Builds the doc once (server) for a live match that predates it.
 */
function useLiveScorecardWhileLive(
  matchId: string | null | undefined,
  enabled: boolean,
  liveStatus: string | null | undefined,
) {
  const id = isMatchId(matchId) ? matchId : null;
  const active = enabled && !!id && liveStatus === "live";
  const card = useLiveScorecard(id, { enabled: active });
  const missing = active && card.loaded && !card.doc;
  useEffect(() => {
    if (!missing || !id || ensured.has(id)) return;
    ensured.add(id);
    void ensureLiveScorecard(id);
  }, [missing, id]);
  return active ? card.doc : null;
}

/** Matches whose live scorecard this page has asked the server to build. */
const ensured = new Set<string>();

export type {
  MatchWizardData,
  WizardClub,
  WizardTeam,
  WizardTournament,
} from "~/app/matches/create/wizard-data";

/**
 * The match wizard's own teams, tournaments and clubs (indexed queries
 * from the browser Firestore client, `fetchWizardBase`), cached for 5
 * minutes.
 */
export function useMatchWizardDataQuery(userId?: string | null) {
  return useQuery<MatchWizardData>({
    queryKey: ["matchWizardData", userId ?? "anon"],
    queryFn: () => fetchWizardBase(createClient(), userId),
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000,
  });
}

/**
 * What the wizard's current picks add (`fetchWizardScope`): the selected
 * tournament's teams, the selected club's teams and the tournament / clubs
 * they name.
 */
export function useMatchWizardScopeQuery(scope: WizardScope) {
  const key = {
    tournamentId: scope.tournamentId ?? "",
    clubId: scope.clubId ?? "",
    tournamentTeamIds: [...(scope.tournamentTeamIds ?? [])].sort(),
    clubIds: [...new Set(scope.clubIds ?? [])].filter(Boolean).sort(),
  };
  return useQuery({
    queryKey: ["matchWizardScope", key],
    queryFn: () => fetchWizardScope(createClient(), key),
    enabled: Boolean(
      key.tournamentId ||
        key.clubId ||
        key.tournamentTeamIds.length ||
        key.clubIds.length,
    ),
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
}

/**
 * Whether any of a squad has played in the club's matches
 * (`hasClubRecords`, 1 read): the wizard's outside-opponent guess. Off
 * without a club or players.
 */
export function useClubRecordsQuery(clubId: string, userIds: readonly string[]) {
  const ids = [...new Set(userIds)].sort();
  return useQuery({
    queryKey: ["clubRecords", clubId, ids],
    queryFn: () => hasClubRecords(createClient(), clubId, ids),
    enabled: Boolean(clubId && ids.length),
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
}

/** The signed-in user's clubs (`fetchMyClubs`), when `enabled`. */
export function useMyClubsQuery(userId: string | null | undefined, enabled: boolean) {
  return useQuery({
    queryKey: ["myClubs", userId ?? ""],
    queryFn: () => fetchMyClubs(createClient(), userId!),
    enabled: Boolean(userId && enabled),
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
}

/**
 * "Add to club" for a match: the clubs the user may choose
 * (`clubsForMatch`) and whether to offer the action (`offerAddToClub`).
 * Reads the user's clubs only when `enabled` (a menu or the dialog open).
 */
export function useMatchClubChoices(
  match: { club_id?: string | null; tournament_id?: string | null },
  userId: string | null | undefined,
  isMatchAdmin: boolean,
  enabled: boolean,
) {
  const { data } = useMyClubsQuery(userId, enabled);
  const choosable = clubsForMatch(data ?? [], isMatchAdmin);
  return {
    choosable,
    // Scorers of a match in no club see it at once (the dialog says it is
    // loading); anyone else once their clubs are known.
    offer:
      !!userId &&
      (data
        ? offerAddToClub(match, choosable, isMatchAdmin)
        : isMatchAdmin && !match.club_id && !match.tournament_id),
    loading: !data,
  };
}

/**
 * The club a finished match probably belongs to: for its scorers, when it
 * is in no club (nor a tournament), the first of their clubs its players
 * have played for (`clubWithRecords`: the user's clubs, then 1 read per
 * club, at most 3). Null otherwise, or once `dismissed`.
 */
export function useClubSuggestion(
  match: {
    id: string;
    status?: string | null;
    club_id?: string | null;
    tournament_id?: string | null;
    team1?: { team_players?: { user_id: string }[] } | null;
    team2?: { team_players?: { user_id: string }[] } | null;
  },
  userId: string | null | undefined,
  isScorer: boolean,
  dismissed: boolean,
) {
  const enabled =
    !!userId &&
    isScorer &&
    !dismissed &&
    match.status === "completed" &&
    !match.club_id &&
    !match.tournament_id;
  const { data: clubs } = useMyClubsQuery(userId, enabled);
  const choosable = clubsForMatch(clubs ?? [], true);
  const playerIds = [
    ...(match.team1?.team_players ?? []),
    ...(match.team2?.team_players ?? []),
  ].map((p) => p.user_id);
  const { data: club } = useQuery({
    queryKey: ["clubSuggestion", match.id, choosable.map((c) => c.id)],
    queryFn: () => clubWithRecords(createClient(), choosable, playerIds),
    enabled: enabled && choosable.length > 0 && playerIds.length > 0,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
  return { club: enabled ? (club ?? null) : null, choosable };
}

/**
 * Manhattan over summaries, derived from the (incrementally synced) ball
 * log: no request of its own.
 */
export function useOverSummariesQuery(matchId: string) {
  const log = useMatchBallLogQuery(matchId);
  const data = useMemo(
    () =>
      log.data
        ? overSummariesOf(
            matchId,
            log.data as unknown as Parameters<typeof overSummariesOf>[1],
          )
        : undefined,
    [log.data, matchId],
  );
  return { data, error: log.error, isLoading: log.isLoading };
}

/** Over docs re-read per live change before a full refetch is cheaper. */
const MAX_INCREMENTAL_OVERS = 4;
/** Trailing debounce for the ball log sync (Firestore reads only). */
const BALL_LOG_SYNC_DELAY_MS = 300;

const ballLogKey = (matchId: string) => ["matchBallLog", matchId] as const;
/** live_state version each cached ball log is current with. */
const ballLogVersions = new Map<string, number | null>();
const ballLogSyncs = new Map<string, ReturnType<typeof setTimeout>>();

function refetchBallLog(queryClient: QueryClient, matchId: string) {
  void queryClient.invalidateQueries(
    { queryKey: ballLogKey(matchId) },
    { cancelRefetch: false },
  );
}

/**
 * Bring the cached ball log up to the latest live_state version by
 * re-reading only the `overs` docs the versions in between changed (one doc
 * for a delivery, undo or edit). Falls back to a full refetch when a version
 * was missed, too many overs changed or a new player / innings appears.
 */
export async function syncBallLog(
  queryClient: QueryClient,
  matchId: string,
): Promise<"current" | "incremental" | "full"> {
  const key = ballLogKey(matchId);
  const cached = queryClient.getQueryData<BallEvent[]>(key);
  const from = ballLogVersions.get(matchId) ?? null;
  const to = latestLiveVersion(matchId);
  if (!cached || to === null) return "current";
  if (from === to) return "current";
  const changed = from === null ? null : overChangesBetween(matchId, from, to);
  if (!changed || changed.length > MAX_INCREMENTAL_OVERS) {
    refetchBallLog(queryClient, matchId);
    return "full";
  }
  if (!changed.length) {
    ballLogVersions.set(matchId, to);
    return "incremental";
  }
  const docs = await Promise.all(
    changed.map((id) =>
      readDoc<OversRow>(getFirebaseDb(), OVERS_COLLECTION, id),
    ),
  );
  // A full refetch landed while these were in flight: start over.
  if ((ballLogVersions.get(matchId) ?? null) !== from) {
    scheduleBallLogSync(queryClient, matchId);
    return "current";
  }
  const ctx = ballLogContext(
    cached,
    queryClient.getQueryData<Match | null>(["matchDetail", matchId]),
  );
  const fresh: BallEvent[] = [];
  for (const over of docs) {
    if (!over) continue;
    const rows = ballEventsOfOver(over, ctx);
    if (!rows) {
      refetchBallLog(queryClient, matchId);
      return "full";
    }
    fresh.push(...rows);
  }
  queryClient.setQueryData(key, mergeOvers(cached, changed, fresh));
  ballLogVersions.set(matchId, to);
  return "incremental";
}

/** Sync chain per match, so syncs never overlap. */
const ballLogRuns = new Map<string, Promise<unknown>>();

function scheduleBallLogSync(queryClient: QueryClient, matchId: string) {
  if (ballLogSyncs.has(matchId)) return;
  ballLogSyncs.set(
    matchId,
    setTimeout(() => {
      ballLogSyncs.delete(matchId);
      const run: Promise<unknown> = (
        ballLogRuns.get(matchId) ?? Promise.resolve()
      )
        .then(() => syncBallLog(queryClient, matchId))
        .catch(() => refetchBallLog(queryClient, matchId))
        .finally(() => {
          if (ballLogRuns.get(matchId) === run) ballLogRuns.delete(matchId);
        });
      ballLogRuns.set(matchId, run);
    }, BALL_LOG_SYNC_DELAY_MS),
  );
}

/**
 * The match's ball log (`getMatchBallLog`, fetched once), kept current from
 * the live_state listener: each change re-reads only the `overs` docs it
 * touched, straight from Firestore (public read), so no server request per
 * ball. Shared by every chart on the Balls / Stats tabs.
 */
export function useMatchBallLogQuery(matchId: string) {
  const queryClient = useQueryClient();
  const id = isMatchId(matchId) ? matchId : null;
  const live = useLiveState(id);
  const query = useQuery({
    queryKey: ballLogKey(matchId),
    queryFn: async () => {
      const version = latestLiveVersion(matchId);
      const res = await getMatchBallLog(matchId);
      if (res.error) throw new Error(res.error);
      ballLogVersions.set(matchId, version);
      return (res.data ?? []) as unknown as BallEvent[];
    },
    enabled: Boolean(matchId),
    // Kept current by the sync below rather than by refetching.
    staleTime: Infinity,
  });

  useOnLiveChange(
    live,
    () => {
      if (id) scheduleBallLogSync(queryClient, id);
    },
    0,
  );
  // Catch up when a chart mounts on a cached log (tab switch).
  const hasData = query.data !== undefined;
  useEffect(() => {
    if (id && hasData) scheduleBallLogSync(queryClient, id);
  }, [id, hasData, queryClient]);
  useEffect(() => {
    if (!id || live.status !== "error") return;
    const poll = setInterval(
      () => refetchBallLog(queryClient, id),
      LIVE_FALLBACK_POLL_MS,
    );
    return () => clearInterval(poll);
  }, [id, live.status, queryClient]);

  return query;
}

/**
 * TanStack Query hook for Matches (e.g. Dashboard)
 */
export function useMatchesQuery(filters?: {
  status?: string;
  limit?: number;
  clubId?: string;
}) {
  return useQuery<Match[]>({
    queryKey: ["matches", filters?.status, filters?.limit, filters?.clubId],
    // Straight from Firestore (public read): the same reads as the
    // `getMatches` server action, without a server request.
    queryFn: async () =>
      (await fetchMatchList(createClient(), filters)) as unknown as Match[],
    staleTime: 30 * 1000, // 30 seconds
    // No listeners here: a live-matches query listener would bill a read
    // for every ball of every live match. Refetch on return instead.
    refetchOnWindowFocus: filters?.status === "live",
  });
}

/**
 * A live match in a list (match cards), kept current from its
 * `live_state` doc: 1 read per change per live card, no list listener. The
 * totals are patched in place; a new innings or a finished match refetches
 * the match lists once (debounced, shared by every card).
 */
export function useLiveListMatch(match: Match): Match {
  const queryClient = useQueryClient();
  const listening = match.status === "live" && isMatchId(match.id);
  const live = useLiveState(listening ? match.id : null);
  /** live_state version the lists were last refetched for. */
  const refetchedFor = useRef<number | null>(null);
  const { state, version } = live;
  useEffect(() => {
    if (!state || version === null || refetchedFor.current === version) return;
    const structural =
      (state.status != null && state.status !== match.status) ||
      (state.innings_number != null &&
        !match.innings?.some((i) => i.innings_number === state.innings_number));
    if (!structural) return;
    refetchedFor.current = version;
    scheduleInvalidate(queryClient, ["matches"], LIVE_REFETCH_DELAY_MS);
  }, [state, version, match, queryClient]);
  const waiting = listening && !live.loaded && live.status !== "error";
  return useMemo(
    () =>
      // The list's score of an innings in progress comes from the match
      // summary, which does not follow every ball: show it only once the
      // live doc has arrived to correct it.
      waiting
        ? {
            ...match,
            innings: match.innings?.filter((i) => i.is_completed !== false),
          }
        : applyLiveState(match, state),
    [match, state, waiting],
  );
}

export interface ManagedClub {
  id: string;
  name: string;
  short_name: string | null;
}

/**
 * TanStack Query hook for clubs managed by the user (owner or admin).
 * Shared across Team creation, Tournament creation, and scoping.
 */
export function useUserManagedClubsQuery(
  userId?: string | null,
  prefilledClubId?: string | null,
) {
  return useQuery<ManagedClub[]>({
    queryKey: ["userManagedClubs", userId ?? "anon", prefilledClubId ?? ""],
    queryFn: async () => {
      if (!userId) return [];
      const db = createClient();
      const [ownedClubsRes, memberClubsRes] = await Promise.all([
        db
          .from("clubs")
          .select("id, name, short_name")
          .eq("owner_id", userId)
          .order("name"),
        db
          .from("club_memberships")
          .select("club:clubs(id, name, short_name)")
          .eq("user_id", userId)
          .in("role", ["owner", "admin"])
          .eq("status", "active"),
      ]);

      const clubMap = new Map<string, ManagedClub>();
      (ownedClubsRes.data ?? []).forEach((c) => {
        clubMap.set(c.id, c);
      });
      (memberClubsRes.data ?? []).forEach((m) => {
        const c = Array.isArray(m.club) ? m.club[0] : m.club;
        if (c) clubMap.set(c.id, c as ManagedClub);
      });

      if (prefilledClubId && !clubMap.has(prefilledClubId)) {
        const { data: prefClub } = await db
          .from("clubs")
          .select("id, name, short_name")
          .eq("id", prefilledClubId)
          .maybeSingle();
        if (prefClub) clubMap.set(prefClub.id, prefClub);
      }

      return Array.from(clubMap.values()).sort((a, b) =>
        a.name.localeCompare(b.name),
      );
    },
    enabled: Boolean(userId),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * TanStack Query hook for Set of Club IDs where user is owner/admin.
 * Powers canScoreMatch() in Dashboard and MatchesPage without redundant queries.
 */
export function useUserAdminClubIdsQuery(userId?: string | null) {
  return useQuery<Set<string>>({
    queryKey: ["userAdminClubIds", userId ?? "anon"],
    queryFn: async () => {
      if (!userId) return new Set<string>();
      const db = createClient();
      const [{ data: owned }, { data: mems }] = await Promise.all([
        db.from("clubs").select("id").eq("owner_id", userId),
        db
          .from("club_memberships")
          .select("club_id")
          .eq("user_id", userId)
          .in("role", ["owner", "admin"])
          .eq("status", "active"),
      ]);
      const set = new Set<string>();
      (owned ?? []).forEach((c) => set.add(c.id));
      (mems ?? []).forEach((m) => {
        if (m.club_id) set.add(m.club_id);
      });
      return set;
    },
    enabled: Boolean(userId),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

export interface HistoricalMatchSummary {
  id: string;
  title: string;
  status: string | null;
  tournament_snapshot?: { name: string | null } | null;
  scheduled_at: string | null;
  venue: string | null;
  winning_team_id: string | null;
  result_type: string | null;
  result_description: string | null;
  team1_id: string;
  team2_id: string;
  innings?: Array<{
    team_id: string;
    innings_number?: number | null;
    total_runs: number;
    total_wickets: number;
    total_overs: number;
  }>;
}

const HEAD_TO_HEAD_SELECT = `
  id,
  title,
  status,
  tournament_snapshot,
  scheduled_at,
  venue,
  winning_team_id,
  result_type,
  result_description,
  team1_id,
  team2_id,
  innings(team_id, innings_number, total_runs, total_wickets, total_overs)
`;

/**
 * The two teams' meetings of any status (the view counts the finished ones
 * and lists the live and upcoming), the latest first. One equality query
 * per home / away pairing (no composite index needed), so it reads only
 * these matches rather than every completed match.
 */
export async function fetchHeadToHead(
  db: Pick<ReturnType<typeof createClient>, "from">,
  team1Id: string,
  team2Id: string,
): Promise<HistoricalMatchSummary[]> {
  const pairing = (home: string, away: string) =>
    db
      .from("matches")
      .select(HEAD_TO_HEAD_SELECT)
      .eq("team1_id", home)
      .eq("team2_id", away);
  const results = await Promise.all(
    team1Id === team2Id
      ? [pairing(team1Id, team2Id)]
      : [pairing(team1Id, team2Id), pairing(team2Id, team1Id)],
  );
  const rows: Array<HistoricalMatchSummary & Record<string, unknown>> = [];
  for (const { data, error } of results) {
    if (error) throw new Error(error.message);
    for (const row of (data ?? []) as unknown as Array<
      HistoricalMatchSummary & Record<string, unknown>
    >) {
      rows.push(row);
    }
  }
  // As `.order("scheduled_at", { ascending: false })` (nulls first) over
  // rows in id order.
  rows.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  return sortRows(rows, [
    { field: "scheduled_at", ascending: false, nullsFirst: true },
  ]);
}

/**
 * TanStack Query hook for Head-to-Head historical matches
 */
export function useHeadToHeadQuery(team1Id: string, team2Id: string) {
  return useQuery<HistoricalMatchSummary[]>({
    queryKey: ["headToHead", team1Id, team2Id],
    queryFn: () => fetchHeadToHead(createClient(), team1Id, team2Id),
    enabled: Boolean(team1Id && team2Id),
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * TanStack Query hook for Tournament Registrations (team IDs set)
 */
export function useTournamentRegistrationsQuery(tournamentId?: string | null) {
  return useQuery<Set<string>>({
    queryKey: ["tournamentRegistrations", tournamentId ?? ""],
    queryFn: async () => {
      if (!tournamentId) return new Set<string>();
      const db = createClient();
      const { data, error } = await db
        .from("tournament_registrations")
        .select("team_id, status")
        .eq("tournament_id", tournamentId);

      if (error) throw new Error(error.message);
      // Requests the organisers have not confirmed cannot be picked.
      return new Set(
        (data ?? [])
          .filter((r) => r.status === "confirmed")
          .map((r) => r.team_id)
          .filter((id): id is string => Boolean(id)),
      );
    },
    enabled: Boolean(tournamentId),
    staleTime: 60 * 1000,
  });
}

/**
 * TanStack Query hook for checking if user is an authorized admin/scorer for a match
 */
export function useMatchAdminQuery(
  matchId?: string | null,
  userId?: string | null,
) {
  return useQuery<boolean>({
    queryKey: ["isMatchAdmin", matchId ?? "", userId ?? "anon"],
    queryFn: async () => {
      if (!matchId || !userId) return false;
      const db = createClient();
      // The user is passed, not left to the browser client: it would ask
      // Firebase Auth's current user, which is still empty for a moment
      // after load (the page's user comes from the session cookie first),
      // and a cached "no" would send the match's own creator away from
      // the scoring screen.
      const { data, error } = await db.rpc("is_match_admin", {
        p_match_id: matchId,
        p_user_id: userId,
      });
      if (error) {
        console.error("is_match_admin RPC error:", error);
        // An error is "unknown", not "no": the scoring screen then falls
        // back to the scorer remembered on this device (weak signal).
        throw new Error("Could not check scoring access");
      }
      return Boolean(data);
    },
    enabled: Boolean(matchId && userId),
    retry: 1,
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Whether the user may delete the match (creator, club admin, tournament
 * creator; not co-scorers). Only asked once `enabled` (e.g. the user is a
 * match admin), so viewers pay no reads. The server re-checks on delete.
 */
/**
 * Whether the user may run the match's overlay: its scorers and streamers.
 * The caller asks only when it needs the answer (1 read).
 */
export function useCanProduceOverlayQuery(
  matchId?: string | null,
  userId?: string | null,
  enabled = true,
) {
  return useQuery<boolean>({
    queryKey: ["canProduceOverlay", matchId ?? "", userId ?? "anon"],
    queryFn: async () => {
      if (!matchId || !userId) return false;
      // The user is passed (see useMatchAdminQuery).
      const { data, error } = await createClient().rpc("can_produce_overlay", {
        p_match_id: matchId,
        p_user_id: userId,
      });
      if (error) return false;
      return Boolean(data);
    },
    enabled: Boolean(matchId && userId && enabled),
    staleTime: 5 * 60 * 1000,
  });
}

export function useCanDeleteMatchQuery(
  matchId?: string | null,
  userId?: string | null,
  enabled = true,
) {
  return useQuery<boolean>({
    queryKey: ["canDeleteMatch", matchId ?? "", userId ?? "anon"],
    queryFn: async () => {
      if (!matchId || !userId) return false;
      // The user is passed (see useMatchAdminQuery).
      const { data, error } = await createClient().rpc("can_delete_match", {
        p_match_id: matchId,
        p_user_id: userId,
      });
      if (error) return false;
      return Boolean(data);
    },
    enabled: Boolean(matchId && userId && enabled),
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Match details (`getMatch`) kept current by the `live_state/{matchId}`
 * listener instead of polling:
 *
 * - `data` is patched with the live totals on every change (no refetch),
 *   so headers move with each ball.
 * - While the match is live and `liveScorecard` is on (a tab that shows
 *   per-player figures is open), the innings come from the
 *   `live_scorecard/{matchId}` listener: no server request per ball.
 * - The match is refetched when the status, the innings or the match
 *   document itself (`live_state.match_rev`: settings, toss, result,
 *   scorers) changes. For a match that is not live (or has no live
 *   scorecard yet) it is also refetched once per change (debounced) while
 *   `refetchOnChange` is true; a skipped change marks the data dirty and
 *   the next `refetchOnChange` flip catches up once.
 * - A 30s poll runs only while the listener is in error.
 */
export function useMatchDetailQuery(
  matchId?: string | null,
  options: { refetchOnChange?: boolean; liveScorecard?: boolean } = {},
) {
  const queryClient = useQueryClient();
  const refetchOnChange = options.refetchOnChange ?? true;
  const live = useLiveState(isMatchId(matchId) ? matchId : null);
  const version = useRef(live.version);
  const matchRev = useRef(live.matchRev);
  useEffect(() => {
    version.current = live.version;
    matchRev.current = live.matchRev;
  }, [live.version, live.matchRev]);
  /** `match_rev` as of the last fetch. */
  const fetchedRev = useRef<string | null>(null);

  const query = useQuery<Match | null>({
    queryKey: ["matchDetail", matchId ?? ""],
    queryFn: async () => {
      if (!matchId) return null;
      fetchedRev.current = matchRev.current;
      // Keyed by live version, so the server micro-cache can share one
      // fetch between every viewer reacting to the same change.
      const res = await getMatch(
        matchId,
        version.current === null
          ? { skipCache: true }
          : { version: version.current },
      );
      if (res.error) throw new Error(res.error);
      return (res.data as Match) ?? null;
    },
    enabled: Boolean(matchId),
    staleTime: 30 * 1000,
    refetchInterval: (q) =>
      live.status === "error" && q.state.data?.status === "live"
        ? LIVE_FALLBACK_POLL_MS
        : false,
  });

  const status = live.state?.status ?? query.data?.status ?? null;
  const card = useLiveScorecardWhileLive(
    matchId,
    options.liveScorecard ?? false,
    status,
  );
  const cardRef = useRef(card);
  useEffect(() => {
    cardRef.current = card;
  }, [card]);

  const fetched = useRef(query.data);
  useEffect(() => {
    fetched.current = query.data;
  }, [query.data]);
  const dirty = useRef(false);

  useOnLiveChange(live, (state) => {
    if (!matchId) return;
    const current = fetched.current;
    const rev = matchRev.current;
    if (fetchedRev.current === null) fetchedRev.current = rev;
    const structural =
      !current ||
      (state?.status ?? current.status) !== current.status ||
      (state?.innings_number != null &&
        !current.innings?.some(
          (i) => i.innings_number === state.innings_number,
        )) ||
      (rev !== null && rev !== fetchedRev.current);
    // A live match's per-ball detail comes from the live scorecard.
    const covered = !!cardRef.current && state?.status === "live";
    if (structural || (refetchOnChange && !covered)) {
      dirty.current = false;
      scheduleInvalidate(queryClient, ["matchDetail", matchId]);
    } else if (!covered) {
      dirty.current = true;
    }
  });

  // A live match catches up from its live scorecard once it is followed.
  const followsCard = (options.liveScorecard ?? false) && status === "live";
  useEffect(() => {
    if (!refetchOnChange || !dirty.current || !matchId) return;
    dirty.current = false;
    if (!followsCard) scheduleInvalidate(queryClient, ["matchDetail", matchId]);
  }, [refetchOnChange, matchId, queryClient, followsCard]);

  const data = useMemo(
    () =>
      query.data
        ? applyLiveScorecard(applyLiveState(query.data, live.state), card)
        : query.data,
    [query.data, live.state, card],
  );

  return {
    ...query,
    data,
    isConnected: live.status === "connected",
    live,
  };
}
