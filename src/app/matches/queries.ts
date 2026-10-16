"use server";

import { withoutScorecardStorage } from "~/lib/firebase/scorecard";
import { playerDirectory } from "~/lib/firebase/directory";
import { createServerClient } from "~/lib/firebase/server";
import { attachMatchTeams } from "~/lib/firebase/team-snapshot";

export async function getMatches(filters?: {
  status?: string;
  clubId?: string;
  limit?: number;
}) {
  try {
    const db = await createServerClient();
    let query = db
      .from("matches")
      .select(
        `
        *,
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
    // Team names / logos come from the match's snapshot (no team reads).
    return { data: await attachMatchTeams(db, data ?? []), error: null };
  } catch (err) {
    console.error("Error fetching matches:", err);
    return {
      data: null,
      error: err instanceof Error ? err.message : "Failed to fetch matches",
    };
  }
}

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Relations that load both teams' rosters (`teams.roster`, no extra
 * reads) ahead of a scorecard, so its `users` lookups are answered from the
 * roster snapshots. Removed from the result by {@link dropRosterNames}.
 */
const ROSTER_NAMES = `
  _roster1:teams!matches_team1_id_fkey(team_players(user_id, user:users!team_players_user_id_fkey(id, full_name))),
  _roster2:teams!matches_team2_id_fkey(team_players(user_id, user:users!team_players_user_id_fkey(id, full_name)))
`;

function dropRosterNames(row: Record<string, unknown>): void {
  delete row._roster1;
  delete row._roster2;
}


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

/**
 * A versioned entry describes the match as of that live_state version, so it
 * can be shared longer than the 2s micro-cache.
 */
const VERSIONED_MATCH_TTL_MS = 15_000;

export async function getMatch(
  matchId: string,
  options?: {
    skipCache?: boolean;
    /**
     * `live_state.version` the caller is reacting to. Cache entries are then
     * per version, so viewers refetching after the same ball share one
     * server read and can never get data from before that change.
     */
    version?: number | null;
  },
) {
  if (!UUID_REGEX.test(matchId)) {
    return { data: null, error: "Invalid match ID" };
  }
  const version = options?.version;
  const versioned = typeof version === "number";
  const cacheKey = versioned ? `${matchId}@v${version}` : matchId;

  if (!options?.skipCache) {
    const cached = getCachedMatch<{ data: unknown; error: string | null }>(
      cacheKey,
    );
    if (cached) {
      return cached;
    }

    const inFlight = getPendingQuery<{ data: unknown; error: string | null }>(
      cacheKey,
    );
    if (inFlight) {
      return inFlight;
    }
  }

  const queryPromise = (async () => {
    try {
      const db = await createServerClient();
      const { data, error } = await db
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
      // The scorecard rows above come from the innings documents themselves
      // (no extra reads); drop their storage arrays from the payload.
      if (data?.innings) {
        data.innings = (data.innings as object[]).map((inn) =>
          withoutScorecardStorage(inn, ["fall_of_wickets"]),
        );
      }

      const result = { data, error: null };
      setCachedMatch(
        cacheKey,
        result,
        versioned ? VERSIONED_MATCH_TTL_MS : undefined,
      );
      return result;
    } finally {
      clearPendingQuery(cacheKey);
    }
  })();

  setPendingQuery(cacheKey, queryPromise);
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
      // One read of `live_state/{matchId}` (built once for older matches)
      // instead of composing the `live_match_state` view (~15 reads).
      const db = await createServerClient();
      const { data, error } = await db.rpc("get_live_state", {
        p_match_id: matchId,
      });

      if (error) {
        return { data: null, error: error.message };
      }
      if (!data) return { data: null, error: "Match not found" };

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

  try {
    const db = await createServerClient();
    // The two team documents come first: their rosters carry every
    // player's name, so the scorecard's user lookups need no reads.
    const { data: match, error } = await db
      .from("matches")
      .select(
        `
        *,
        ${ROSTER_NAMES},
        innings(
          *,
          batting_performances(*, user:users!batting_performances_user_id_fkey(id, full_name)),
          bowling_performances(*, user:users!bowling_performances_user_id_fkey(id, full_name))
        )
      `,
      )
      .eq("id", matchId)
      .single();
    if (match) dropRosterNames(match);
    if (error) {
      console.error("Error fetching scoring state:", error);
      return { data: null, error: error.message };
    }
    if (match?.innings) {
      match.innings = (match.innings as object[]).map((inn) =>
        withoutScorecardStorage(inn),
      );
    }
    if (match) await attachMatchTeams(db, [match]);
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
      const bpo = match?.balls_per_over || 6;
      const totalBalls = current.total_balls ?? 0;
      const ongoingOver = Math.floor(totalBalls / bpo);
      const isOverBoundary = totalBalls > 0 && totalBalls % bpo === 0;
      // If a bowler is currently assigned, we are in/starting the new over (ongoingOver) awaiting deliveries.
      // Only when NO bowler is assigned yet (at over boundary, awaiting bowler selection) do we show the completed over for review.
      const displayOver = isOverBoundary && !bowler ? ongoingOver - 1 : ongoingOver;

      const { data: balls } = await db
        .from("ball_by_ball")
        .select(
          "id, over_number, ball_number, runs_scored, extras, extra_type, is_wicket, dismissal_type, bowler_id, batsman_id, dismissed_player_id",
        )
        .eq("innings_id", current.id)
        .eq("over_number", displayOver)
        .order("seq");
      thisOverDeliveries = balls ?? [];

      if (ongoingOver > 0 || isOverBoundary) {
        const overToCheck = ongoingOver > 0 ? ongoingOver - 1 : 0;
        const { data: lastOverBall } = await db
          .from("ball_by_ball")
          .select("bowler_id")
          .eq("innings_id", current.id)
          .eq("over_number", overToCheck)
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
  } catch (err) {
    console.error("Error in getScoringState:", err);
    return {
      data: null,
      error: err instanceof Error ? err.message : "Failed to load scoring state",
    };
  }
}

export async function getTeamPlayers(teamId: string) {
  try {
    const db = await createServerClient();
    // One read: the team's roster carries its players with their profiles.
    const { data: team, error: teamError } = await db
      .from("teams")
      .select(
        "id, team_players(*, user:users!team_players_user_id_fkey(id, full_name, avatar_url))",
      )
      .eq("id", teamId)
      .maybeSingle();
    if (teamError) return { data: null, error: teamError.message };
    if (team) {
      const rows = (team.team_players ?? []) as Array<{
        batting_order: number | null;
      }>;
      // Same order as `.order("batting_order")` (nulls last, ties by id).
      return {
        data: [...rows].sort((a, b) => {
          const x = a.batting_order;
          const y = b.batting_order;
          if (x === y) return 0;
          if (x === null || x === undefined) return 1;
          if (y === null || y === undefined) return -1;
          return x - y;
        }),
        error: null,
      };
    }
    const { data, error } = await db
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
  } catch (err) {
    console.error("Error in getTeamPlayers:", err);
    return {
      data: null,
      error: err instanceof Error ? err.message : "Failed to load players",
    };
  }
}

const BALL_PLAYER_FIELDS = [
  ["batsman", "batsman_id"],
  ["bowler", "bowler_id"],
  ["non_striker", "non_striker_id"],
  ["fielder", "fielder_id"],
  ["dismissed_player", "dismissed_player_id"],
] as const;

export async function getMatchBallLog(matchId: string) {
  try {
    const db = await createServerClient();
    const { data, error } = await db
      .from("ball_by_ball")
      .select(`*, innings(innings_number, team_id)`)
      .eq("match_id", matchId)
      .order("seq");
    if (error) {
      console.error("Error fetching ball log:", error);
      return { data: null, error: error.message };
    }
    // Player names from the teams' rosters (2 reads) instead of a profile
    // read per player.
    const balls = (data ?? []) as Record<string, unknown>[];
    const ids = new Set<string>();
    for (const b of balls) {
      for (const [, field] of BALL_PLAYER_FIELDS) {
        if (typeof b[field] === "string") ids.add(b[field] as string);
      }
    }
    const { data: teams } = await db
      .from("matches")
      .select("team1_id, team2_id")
      .eq("id", matchId)
      .maybeSingle();
    const names = await playerDirectory(
      db,
      [teams?.team1_id, teams?.team2_id],
      ids,
    );
    for (const b of balls) {
      for (const [alias, field] of BALL_PLAYER_FIELDS) {
        const id = b[field];
        b[alias] = typeof id === "string" ? (names.get(id) ?? null) : null;
      }
    }
    return { data, error: null };
  } catch (err) {
    console.error("Error in getMatchBallLog:", err);
    return {
      data: null,
      error: err instanceof Error ? err.message : "Failed to fetch ball log",
    };
  }
}

export async function getFullMatchForExport(matchId: string) {
  if (!UUID_REGEX.test(matchId)) {
    return { data: null, error: "Invalid match ID" };
  }

  try {
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
  } catch (err) {
    console.error("Error in getFullMatchForExport:", err);
    return {
      data: null,
      error: err instanceof Error ? err.message : "Failed to export match",
    };
  }
}

export async function getOverSummaries(matchId: string) {
  try {
    const db = await createServerClient();
    const { data, error } = await db
      .from("match_over_summaries")
      .select("innings_id, over_number, runs, wickets, extras_off_bat_and_bowler, extras_total")
      .eq("match_id", matchId)
      .order("over_number");
    if (error) {
      // Pre-migration DBs lack extras_total — retry without it; the chart
      // falls back to extras_off_bat_and_bowler.
      if (error.message.includes("extras_total")) {
        const retry = await db
          .from("match_over_summaries")
          .select("innings_id, over_number, runs, wickets, extras_off_bat_and_bowler")
          .eq("match_id", matchId)
          .order("over_number");
        if (retry.error) {
          console.error("Error fetching over summaries:", retry.error);
          return { data: null, error: retry.error.message };
        }
        return { data: retry.data, error: null };
      }
      console.error("Error fetching over summaries:", error);
      return { data: null, error: error.message };
    }
    return { data, error: null };
  } catch (err) {
    console.error("Error in getOverSummaries:", err);
    return {
      data: null,
      error: err instanceof Error ? err.message : "Failed to fetch over summaries",
    };
  }
}

export async function getPartnerships(matchId: string) {
  try {
    const db = await createServerClient();
    const { data, error } = await db
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
  } catch (err) {
    console.error("Error in getPartnerships:", err);
    return {
      data: null,
      error: err instanceof Error ? err.message : "Failed to fetch partnerships",
    };
  }
}
