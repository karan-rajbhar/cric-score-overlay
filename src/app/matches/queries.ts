"use server";

import { createServerClient } from "~/lib/supabase/server";

export async function getMatches(filters?: {
  status?: string;
  clubId?: string;
  limit?: number;
}) {
  const supabase = await createServerClient();
  let query = supabase
    .from("matches")
    .select(
      `
      *,
      team1:teams!matches_team1_id_fkey(id, name, short_name, logo_url),
      team2:teams!matches_team2_id_fkey(id, name, short_name, logo_url),
      innings(id, team_id, innings_number, total_runs, total_wickets, total_overs, is_completed)
    `,
    )
    .order("scheduled_at", { ascending: false });
  if (filters?.status) query = query.eq("status", filters.status);
  if (filters?.clubId) query = query.eq("club_id", filters.clubId);
  const limit = filters?.limit ?? 50;
  query = query.limit(limit);
  const { data, error } = await query;
  if (error) {
    console.error("Error fetching matches:", error);
    return { data: null, error: error.message };
  }
  return { data, error: null };
}

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

import {
  getCachedMatch,
  setCachedMatch,
  getPendingQuery,
  setPendingQuery,
  clearPendingQuery,
  getCachedLiveState,
  setCachedLiveState,
  getPendingLiveQuery,
  setPendingLiveQuery,
  clearPendingLiveQuery,
} from "~/lib/match-cache";

export async function getMatch(
  matchId: string,
  options?: { skipCache?: boolean },
) {
  if (!UUID_REGEX.test(matchId)) {
    return { data: null, error: "Invalid match ID" };
  }

  if (!options?.skipCache) {
    const cached = getCachedMatch<{ data: unknown; error: string | null }>(
      matchId,
    );
    if (cached) {
      return cached;
    }

    const inFlight = getPendingQuery<{ data: unknown; error: string | null }>(
      matchId,
    );
    if (inFlight) {
      return inFlight;
    }
  }

  const queryPromise = (async () => {
    try {
      const supabase = await createServerClient();
      const { data, error } = await supabase
        .from("matches")
        .select(
          `
          *,
          team1:teams!matches_team1_id_fkey(*,
            team_players(*, user:users!team_players_user_id_fkey(id, full_name, avatar_url))
          ),
          team2:teams!matches_team2_id_fkey(*,
            team_players(*, user:users!team_players_user_id_fkey(id, full_name, avatar_url))
          ),
          innings(
            *,
            batting_performances(*, user:users!batting_performances_user_id_fkey(id, full_name)),
            bowling_performances(*, user:users!bowling_performances_user_id_fkey(id, full_name)),
            fall_of_wickets(
              *,
              batsman:users!fall_of_wickets_batsman_out_id_fkey(id, full_name),
              bowler:users!fall_of_wickets_bowler_id_fkey(full_name),
              fielder:users!fall_of_wickets_fielder_id_fkey(full_name)
            )
          ),
          tournament:tournaments(id, name, tournament_format, venue),
          club:clubs(id, name),
          player_of_the_match:users!matches_player_of_the_match_id_fkey(id, full_name, avatar_url)
        `,
        )
        .eq("id", matchId)
        .single();

      if (error) {
        console.error("Error fetching match:", error);
        return { data: null, error: error.message };
      }

      const result = { data, error: null };
      setCachedMatch(matchId, result);
      return result;
    } finally {
      clearPendingQuery(matchId);
    }
  })();

  setPendingQuery(matchId, queryPromise);
  return queryPromise;
}

export async function getLiveMatchState(
  matchId: string,
  options?: { skipCache?: boolean },
) {
  if (!UUID_REGEX.test(matchId)) {
    return { data: null, error: "Invalid match ID" };
  }

  if (!options?.skipCache) {
    const cached = getCachedLiveState<{ data: unknown; error: string | null }>(
      matchId,
    );
    if (cached) {
      return cached;
    }

    const inFlight = getPendingLiveQuery<{
      data: unknown;
      error: string | null;
    }>(matchId);
    if (inFlight) {
      return inFlight;
    }
  }

  const queryPromise = (async () => {
    try {
      const supabase = await createServerClient();
      const { data, error } = await supabase
        .from("live_match_state")
        .select("*")
        .eq("match_id", matchId)
        .single();

      if (error) {
        return { data: null, error: error.message };
      }

      const result = { data, error: null };
      setCachedLiveState(matchId, result);
      return result;
    } finally {
      clearPendingLiveQuery(matchId);
    }
  })();

  setPendingLiveQuery(matchId, queryPromise);
  return queryPromise;
}

export async function getScoringState(matchId: string) {
  if (!UUID_REGEX.test(matchId)) {
    return { data: null, error: "Invalid match ID" };
  }

  const supabase = await createServerClient();
  const { data: match, error } = await supabase
    .from("matches")
    .select(
      `
      *,
      team1:teams!matches_team1_id_fkey(id, name, short_name, logo_url),
      team2:teams!matches_team2_id_fkey(id, name, short_name, logo_url),
      innings(
        *,
        batting_performances(*, user:users!batting_performances_user_id_fkey(id, full_name)),
        bowling_performances(*, user:users!bowling_performances_user_id_fkey(id, full_name))
      )
    `,
    )
    .eq("id", matchId)
    .single();
  if (error) {
    console.error("Error fetching scoring state:", error);
    return { data: null, error: error.message };
  }
  type InningsWithPerformances = {
    id: string;
    innings_number: number;
    total_balls: number | null;
    batting_performances: Array<{
      user_id: string;
      is_current_batsman: boolean | null;
      is_striker: boolean | null;
      is_out: boolean | null;
      runs_scored: number | null;
      balls_faced: number | null;
      fours: number | null;
      sixes: number | null;
      user: { id: string; full_name: string } | null;
    }>;
    bowling_performances: Array<{
      user_id: string;
      is_current_bowler: boolean | null;
      overs_bowled: number | null;
      maidens: number | null;
      runs_conceded: number | null;
      wickets_taken: number | null;
      user: { id: string; full_name: string } | null;
    }>;
  };
  const innings = (match?.innings ??
    []) as unknown as InningsWithPerformances[];
  const current = innings.find(
    (i) => i.innings_number === match?.current_innings,
  );
  const striker =
    current?.batting_performances.find(
      (p) => p.is_striker && p.is_current_batsman,
    ) ?? null;
  const nonStriker =
    current?.batting_performances.find(
      (p) => !p.is_striker && p.is_current_batsman,
    ) ?? null;
  const bowler =
    current?.bowling_performances.find((p) => p.is_current_bowler) ?? null;
  let thisOverDeliveries: Array<{
    id: string;
    over_number?: number;
    ball_number?: number;
    runs_scored: number | null;
    extras: number | null;
    extra_type: string | null;
    is_wicket: boolean | null;
    dismissal_type?: string | null;
    bowler_id?: string | null;
    batsman_id?: string | null;
    dismissed_player_id?: string | null;
  }> = [];
  let lastOverBowlerId: string | null = null;
  if (current) {
    const ongoingOver = Math.floor((current.total_balls ?? 0) / 6);
    const { data: balls } = await supabase
      .from("ball_by_ball")
      .select(
        "id, over_number, ball_number, runs_scored, extras, extra_type, is_wicket, dismissal_type, bowler_id, batsman_id, dismissed_player_id",
      )
      .eq("innings_id", current.id)
      .eq("over_number", ongoingOver)
      .order("seq");
    thisOverDeliveries = balls ?? [];

    if (ongoingOver > 0) {
      const { data: lastOverBall } = await supabase
        .from("ball_by_ball")
        .select("bowler_id")
        .eq("innings_id", current.id)
        .eq("over_number", ongoingOver - 1)
        .order("seq", { ascending: false })
        .limit(1)
        .maybeSingle();
      lastOverBowlerId = lastOverBall?.bowler_id ?? null;
    }
  }
  return {
    data: {
      match,
      strikerId: striker?.user_id ?? null,
      nonStrikerId: nonStriker?.user_id ?? null,
      bowlerId: bowler?.user_id ?? null,
      lastOverBowlerId,
      thisOverDeliveries,
    },
    error: null,
  };
}

export async function getTeams(clubId?: string) {
  const supabase = await createServerClient();
  let query = supabase.from("teams").select("id, name, short_name, club_id");
  if (clubId) query = query.eq("club_id", clubId);
  const { data, error } = await query.order("name");
  if (error) return { data: null, error: error.message };
  return { data, error: null };
}

export async function getTeamPlayers(teamId: string) {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("team_players")
    .select(
      `
      *,
      user:users!team_players_user_id_fkey(id, full_name, avatar_url)
    `,
    )
    .eq("team_id", teamId)
    .order("batting_order");
  if (error) return { data: null, error: error.message };
  return { data, error: null };
}

export async function getBallByBall(matchId: string, inningsNumber?: number) {
  const supabase = await createServerClient();
  let query = supabase
    .from("ball_by_ball")
    .select(
      `
      *,
      batsman:users!ball_by_ball_batsman_id_fkey(id, full_name),
      bowler:users!ball_by_ball_bowler_id_fkey(id, full_name),
      fielder:users!ball_by_ball_fielder_id_fkey(id, full_name),
      innings:innings!inner(innings_number, team_id)
    `,
    )
    .eq("match_id", matchId)
    .order("over_number", { ascending: true })
    .order("ball_number", { ascending: true });
  if (inningsNumber) query = query.eq("innings.innings_number", inningsNumber);
  const { data, error } = await query;
  if (error) {
    console.error("Error fetching ball by ball:", error);
    return { data: null, error: error.message };
  }
  return { data, error: null };
}

export async function getFallOfWickets(
  matchId: string,
  inningsNumber?: number,
) {
  const supabase = await createServerClient();
  let query = supabase
    .from("fall_of_wickets")
    .select(
      `
      *,
      batsman:users!fall_of_wickets_batsman_out_id_fkey(id, full_name),
      bowler:users!fall_of_wickets_bowler_id_fkey(id, full_name),
      fielder:users!fall_of_wickets_fielder_id_fkey(id, full_name),
      innings:innings!inner(innings_number, team_id)
    `,
    )
    .eq("match_id", matchId)
    .order("wicket_number", { ascending: true });
  if (inningsNumber) query = query.eq("innings.innings_number", inningsNumber);
  const { data, error } = await query;
  if (error) {
    console.error("Error fetching fall of wickets:", error);
    return { data: null, error: error.message };
  }
  return { data, error: null };
}

export async function getMatchFull(matchId: string) {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("matches")
    .select(
      `
      *,
      team1:teams!matches_team1_id_fkey(*,
        team_players(*, user:users!team_players_user_id_fkey(id, full_name, avatar_url))
      ),
      team2:teams!matches_team2_id_fkey(*,
        team_players(*, user:users!team_players_user_id_fkey(id, full_name, avatar_url))
      ),
      innings(
        *,
        batting_performances(*, user:users!batting_performances_user_id_fkey(id, full_name)),
        bowling_performances(*, user:users!bowling_performances_user_id_fkey(id, full_name)),
        ball_by_ball(
          *,
          batsman:users!ball_by_ball_batsman_id_fkey(id, full_name),
          bowler:users!ball_by_ball_bowler_id_fkey(id, full_name)
        ),
        fall_of_wickets(
          *,
          batsman:users!fall_of_wickets_batsman_out_id_fkey(id, full_name)
        )
      ),
      tournament:tournaments(id, name),
      club:clubs(id, name)
    `,
    )
    .eq("id", matchId)
    .single();
  if (error) {
    console.error("Error fetching match full:", error);
    return { data: null, error: error.message };
  }
  return { data, error: null };
}

export async function getMatchBallLog(matchId: string) {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("ball_by_ball")
    .select(
      `
        *,
        batsman:users!ball_by_ball_batsman_id_fkey(id, full_name),
        bowler:users!ball_by_ball_bowler_id_fkey(id, full_name),
        non_striker:users!ball_by_ball_non_striker_id_fkey(id, full_name),
        fielder:users!ball_by_ball_fielder_id_fkey(id, full_name),
        dismissed_player:users!ball_by_ball_dismissed_player_id_fkey(id, full_name),
        innings(innings_number, team_id)
    `,
    )
    .eq("match_id", matchId)
    .order("seq");
  if (error) {
    console.error("Error fetching ball log:", error);
    return { data: null, error: error.message };
  }
  return { data, error: null };
}

export async function getFullMatchForExport(matchId: string) {
  if (!UUID_REGEX.test(matchId)) {
    return { data: null, error: "Invalid match ID" };
  }

  const [matchRes, ballsRes] = await Promise.all([
    getMatch(matchId),
    getMatchBallLog(matchId),
  ]);

  if (matchRes.error || !matchRes.data) {
    return { data: null, error: matchRes.error ?? "Match not found" };
  }

  const match = matchRes.data as unknown as import("~/lib/match-types").Match;

  if (ballsRes.data && match.innings) {
    const balls =
      ballsRes.data as unknown as import("~/lib/match-types").BallEvent[];
    const ballsByInnings = new Map<string, typeof balls>();
    for (const b of balls) {
      const arr = ballsByInnings.get(b.innings_id) ?? [];
      arr.push(b);
      ballsByInnings.set(b.innings_id, arr);
    }

    match.innings = match.innings.map((inn) => ({
      ...inn,
      ball_by_ball: ballsByInnings.get(inn.id) ?? [],
    }));
  }

  return { data: match, error: null };
}

export async function getOverSummaries(matchId: string) {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("match_over_summaries")
    .select("innings_id, over_number, runs, wickets, extras_off_bat_and_bowler")
    .eq("match_id", matchId)
    .order("over_number");
  if (error) {
    console.error("Error fetching over summaries:", error);
    return { data: null, error: error.message };
  }
  return { data, error: null };
}

export async function getPartnerships(matchId: string) {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("partnerships")
    .select(
      `
        id,
        innings_id,
        batsman1_id,
        batsman2_id,
        runs,
        balls,
        start_over,
        end_over,
        is_current,
        batsman1:users!partnerships_batsman1_id_fkey(full_name),
        batsman2:users!partnerships_batsman2_id_fkey(full_name)
    `,
    )
    .eq("match_id", matchId)
    .order("start_over");
  if (error) {
    console.error("Error fetching partnerships:", error);
    return { data: null, error: error.message };
  }
  return { data, error: null };
}
