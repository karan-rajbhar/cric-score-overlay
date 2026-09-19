"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { createClient } from "~/lib/supabase/client";
import {
  getPartnerships,
  getOverSummaries,
  getMatchBallLog,
  getMatches,
  getMatch,
} from "~/app/matches/queries";
import type { Match } from "~/lib/match-types";

export interface WizardTeam {
  id: string;
  name: string;
  short_name?: string | null;
  club_id?: string | null;
  created_by?: string | null;
  captain_id?: string | null;
  vice_captain_id?: string | null;
}

export interface WizardTournament {
  id: string;
  name: string;
  match_format: string;
  custom_overs?: number | null;
  created_by?: string | null;
  club_id?: string | null;
}

export interface WizardClub {
  id: string;
  name: string;
  short_name?: string | null;
  owner_id?: string | null;
}

export interface MatchWizardData {
  teams: WizardTeam[];
  tournaments: WizardTournament[];
  clubs: WizardClub[];
  playerTeamIds: string[];
  clubAdminIds: string[];
  error: string | null;
}

/**
 * High-performance TanStack Query hook for Match Creation Wizard.
 * Fetches directly via browser Supabase client to bypass Next.js Server Action serialization,
 * and caches data for 5 minutes.
 */
export function useMatchWizardDataQuery(userId?: string | null) {
  return useQuery<MatchWizardData>({
    queryKey: ["matchWizardData", userId ?? "anon"],
    queryFn: async () => {
      const supabase = createClient();
      const [teamRes, tournRes, clubRes, myPlayersRes, myClubAdminRes] =
        await Promise.all([
          supabase
            .from("teams")
            .select(
              "id, name, short_name, club_id, created_by, captain_id, vice_captain_id",
            )
            .order("name"),
          supabase
            .from("tournaments")
            .select("id, name, match_format, custom_overs, created_by, club_id")
            .order("created_at", { ascending: false }),
          supabase
            .from("clubs")
            .select("id, name, short_name, owner_id")
            .order("name"),
          userId
            ? supabase
                .from("team_players")
                .select("team_id")
                .eq("user_id", userId)
            : Promise.resolve({ data: [] }),
          userId
            ? supabase
                .from("club_memberships")
                .select("club_id")
                .eq("user_id", userId)
                .in("role", ["owner", "admin"])
                .eq("status", "active")
            : Promise.resolve({ data: [] }),
        ]);

      const playerTeamIds = (myPlayersRes.data ?? [])
        .map((r: { team_id: string | null }) => r.team_id)
        .filter((id): id is string => Boolean(id));

      const clubAdminIds = (myClubAdminRes.data ?? [])
        .map((r: { club_id: string | null }) => r.club_id)
        .filter((id): id is string => Boolean(id));

      if (clubRes.data && userId) {
        for (const c of clubRes.data) {
          if (c.owner_id === userId) {
            clubAdminIds.push(c.id);
          }
        }
      }

      return {
        teams: (teamRes.data ?? []) as WizardTeam[],
        tournaments: (tournRes.data ?? []) as WizardTournament[],
        clubs: (clubRes.data ?? []) as WizardClub[],
        playerTeamIds,
        clubAdminIds,
        error: teamRes.error?.message || null,
      };
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000,
  });
}

/**
 * TanStack Query hook for Match Partnerships with Realtime Invalidation
 */
export function usePartnershipsQuery(matchId: string) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["matchPartnerships", matchId],
    queryFn: async () => {
      const res = await getPartnerships(matchId);
      if (res.error) throw new Error(res.error);
      return res.data ?? [];
    },
    enabled: Boolean(matchId),
    staleTime: 15 * 1000,
  });

  // Realtime subscription invalidation
  useEffect(() => {
    if (!matchId) return;
    const isUuid =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        matchId,
      );
    if (!isUuid) return;

    const supabase = createClient();
    const channel = supabase
      .channel(`rt_partnerships_${matchId}`)
      .on("broadcast", { event: "score_update" }, () => {
        void queryClient.invalidateQueries({
          queryKey: ["matchPartnerships", matchId],
        });
      })
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [matchId, queryClient]);

  return query;
}

/**
 * TanStack Query hook for Manhattan Over Summaries
 */
export function useOverSummariesQuery(matchId: string) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["overSummaries", matchId],
    queryFn: async () => {
      const res = await getOverSummaries(matchId);
      if (res.error) throw new Error(res.error);
      return res.data ?? [];
    },
    enabled: Boolean(matchId),
    staleTime: 15 * 1000,
  });

  useEffect(() => {
    if (!matchId) return;
    const isUuid =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        matchId,
      );
    if (!isUuid) return;

    const supabase = createClient();
    const channel = supabase
      .channel(`rt_manhattan_${matchId}`)
      .on("broadcast", { event: "score_update" }, () => {
        void queryClient.invalidateQueries({
          queryKey: ["overSummaries", matchId],
        });
      })
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [matchId, queryClient]);

  return query;
}

/**
 * TanStack Query hook for Match Ball Log
 */
export function useMatchBallLogQuery(
  matchId: string,
  inningsNumber?: number,
) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["matchBallLog", matchId, inningsNumber],
    queryFn: async () => {
      const res = await getMatchBallLog(matchId);
      if (res.error) throw new Error(res.error);
      return res.data ?? [];
    },
    enabled: Boolean(matchId),
    staleTime: 15 * 1000,
  });

  useEffect(() => {
    if (!matchId) return;
    const isUuid =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        matchId,
      );
    if (!isUuid) return;

    const supabase = createClient();
    const channel = supabase
      .channel(`rt_ball_log_${matchId}`)
      .on("broadcast", { event: "score_update" }, () => {
        void queryClient.invalidateQueries({
          queryKey: ["matchBallLog", matchId],
        });
      })
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [matchId, queryClient]);

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
    queryFn: async () => {
      const res = await getMatches(filters);
      if (res.error) throw new Error(res.error);
      return (res.data ?? []) as unknown as Match[];
    },
    staleTime: 30 * 1000, // 30 seconds
  });
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
      const supabase = createClient();
      const [ownedClubsRes, memberClubsRes] = await Promise.all([
        supabase
          .from("clubs")
          .select("id, name, short_name")
          .eq("owner_id", userId)
          .order("name"),
        supabase
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
        const { data: prefClub } = await supabase
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
      const supabase = createClient();
      const [{ data: owned }, { data: mems }] = await Promise.all([
        supabase.from("clubs").select("id").eq("owner_id", userId),
        supabase
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
  scheduled_at: string | null;
  venue: string | null;
  winning_team_id: string | null;
  result_type: string | null;
  result_description: string | null;
  team1_id: string;
  team2_id: string;
  innings?: Array<{
    team_id: string;
    total_runs: number;
    total_wickets: number;
    total_overs: number;
  }>;
}

/**
 * TanStack Query hook for Head-to-Head historical matches
 */
export function useHeadToHeadQuery(
  team1Id: string,
  team2Id: string,
  currentMatchId: string,
) {
  return useQuery<HistoricalMatchSummary[]>({
    queryKey: ["headToHead", team1Id, team2Id, currentMatchId],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("matches")
        .select(
          `
          id,
          title,
          scheduled_at,
          venue,
          winning_team_id,
          result_type,
          result_description,
          team1_id,
          team2_id,
          innings(team_id, total_runs, total_wickets, total_overs)
        `,
        )
        .eq("status", "completed")
        .neq("id", currentMatchId)
        .or(
          `and(team1_id.eq.${team1Id},team2_id.eq.${team2Id}),and(team1_id.eq.${team2Id},team2_id.eq.${team1Id})`,
        )
        .order("scheduled_at", { ascending: false });

      if (error) throw new Error(error.message);
      return (data ?? []) as unknown as HistoricalMatchSummary[];
    },
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
      const supabase = createClient();
      const { data, error } = await supabase
        .from("tournament_registrations")
        .select("team_id")
        .eq("tournament_id", tournamentId);

      if (error) throw new Error(error.message);
      return new Set(
        (data ?? [])
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
      const supabase = createClient();
      const { data, error } = await supabase.rpc("is_match_admin", {
        p_match_id: matchId,
      });
      if (error) {
        console.error("is_match_admin RPC error:", error);
        return false;
      }
      return Boolean(data);
    },
    enabled: Boolean(matchId && userId),
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * TanStack Query hook for Match Details with automatic Realtime Invalidation
 */
export function useMatchDetailQuery(matchId?: string | null) {
  const queryClient = useQueryClient();
  const [isConnected, setIsConnected] = useState(false);

  const query = useQuery<Match | null>({
    queryKey: ["matchDetail", matchId ?? ""],
    queryFn: async () => {
      if (!matchId) return null;
      const res = await getMatch(matchId, { skipCache: true });
      if (res.error) throw new Error(res.error);
      return (res.data as Match) ?? null;
    },
    enabled: Boolean(matchId),
    staleTime: 30 * 1000,
    refetchInterval: (query) => {
      const data = query.state.data;
      return data?.status === "live" ? 15000 : false;
    },
  });

  useEffect(() => {
    if (!matchId) return;
    const isUuid =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        matchId,
      );
    if (!isUuid) return;

    const supabase = createClient();
    const channel = supabase
      .channel(`rt_match_detail_${matchId}`)
      .on("broadcast", { event: "score_update" }, () => {
        void queryClient.invalidateQueries({
          queryKey: ["matchDetail", matchId],
        });
      })
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "ball_by_ball",
          filter: `match_id=eq.${matchId}`,
        },
        () => {
          void queryClient.invalidateQueries({
            queryKey: ["matchDetail", matchId],
          });
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "matches",
          filter: `id=eq.${matchId}`,
        },
        () => {
          void queryClient.invalidateQueries({
            queryKey: ["matchDetail", matchId],
          });
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "innings",
          filter: `match_id=eq.${matchId}`,
        },
        () => {
          void queryClient.invalidateQueries({
            queryKey: ["matchDetail", matchId],
          });
        },
      )
      .subscribe((status) => {
        setIsConnected(status === "SUBSCRIBED");
      });

    return () => {
      void supabase.removeChannel(channel);
      setIsConnected(false);
    };
  }, [matchId, queryClient]);

  return { ...query, isConnected };
}

