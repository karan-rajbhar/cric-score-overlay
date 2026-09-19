"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { createClient } from "~/lib/supabase/client";
import {
  getPartnerships,
  getOverSummaries,
  getMatchBallLog,
  getMatches,
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
