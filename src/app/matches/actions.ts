"use server";

import { revalidatePath } from "next/cache";
import { createServerClient } from "~/lib/supabase/server";

// Types
export interface MatchFormData {
    title: string;
    matchFormat: "T20" | "ODI" | "Custom";
    oversPerInnings: number;
    team1Id: string;
    team2Id: string;
    venue?: string;
    scheduledAt?: string;
    umpire1Name?: string;
    umpire2Name?: string;
    clubId?: string;
    tournamentId?: string;
}

export type ExtraType = "wide" | "no_ball" | "bye" | "leg_bye" | "penalty";

/** Outcome of a single delivery (everything else is derived server-side). */
export interface BallEvent {
    runsScored?: number;
    extras?: number;
    extraType?: ExtraType;
    isWicket?: boolean;
    dismissalType?: string;
    fielderId?: string | null;
    commentary?: string;
}

/**
 * Authoritative scoring state returned by the record_ball / undo /
 * end-innings Postgres functions. The client mirrors this state; it never
 * computes strike rotation or over progression itself.
 */
export interface ScoringState {
    ok: boolean;
    status: string;
    current_innings: number;
    current_over: number;
    current_ball: number;
    total_runs: number;
    total_wickets: number;
    total_balls: number;
    target_runs: number | null;
    is_completed: boolean;
    striker_id: string | null;
    non_striker_id: string | null;
    striker_name: string | null;
    non_striker_name: string | null;
    striker_runs: number | null;
    striker_balls: number | null;
    non_striker_runs: number | null;
    non_striker_balls: number | null;
    needs_batsman: boolean;
    needs_bowler: boolean;
    innings_completed: boolean;
    match_completed: boolean;
    result_description: string | null;
    innings_break?: boolean;
}

const ERROR_MESSAGES: Record<string, string> = {
    awaiting_new_batsman: "Select the new batsman before scoring the next ball.",
    bowler_not_set: "Select a bowler before scoring the next ball.",
    striker_mismatch: "Batsmen out of sync - reloading latest state.",
    non_striker_mismatch: "Batsmen out of sync - reloading latest state.",
    same_bowler_next_over: "This bowler just bowled the previous over. Choose a different bowler.",
    player_not_in_batting_team: "Selected player is not on the batting team.",
    player_already_out: "That batsman is already dismissed.",
    too_many_batsmen: "All 11 batsmen have already batted.",
    match_not_live: "The match is not live.",
    no_open_innings: "No open innings found.",
    nothing_to_undo: "Nothing to undo.",
    not_authorized: "You do not have permission to score this match.",
};

function friendlyError(message: string): string {
    const key = message.split('"')[1] ?? message.split("\n")[0];
    return (key && ERROR_MESSAGES[key]) || message;
}

// Get all matches with optional filters
export async function getMatches(filters?: {
    status?: string;
    clubId?: string;
    limit?: number;
}) {
    const supabase = await createServerClient();

    let query = supabase
        .from("matches")
        .select(`
      *,
      team1:teams!matches_team1_id_fkey(id, name, short_name),
      team2:teams!matches_team2_id_fkey(id, name, short_name),
      innings(id, team_id, innings_number, total_runs, total_wickets, total_overs, is_completed)
    `)
        .order("scheduled_at", { ascending: false });

    if (filters?.status) {
        query = query.eq("status", filters.status);
    }
    if (filters?.clubId) {
        query = query.eq("club_id", filters.clubId);
    }
    if (filters?.limit) {
        query = query.limit(filters.limit);
    }

    const { data, error } = await query;

    if (error) {
        console.error("Error fetching matches:", error);
        return { data: null, error: error.message };
    }

    return { data, error: null };
}

// Get single match with full details
export async function getMatch(matchId: string) {
    const supabase = await createServerClient();

    const { data, error } = await supabase
        .from("matches")
        .select(`
      *,
      team1:teams!matches_team1_id_fkey(*),
      team2:teams!matches_team2_id_fkey(*),
      innings(
        *,
        batting_performances(*, user:users!batting_performances_user_id_fkey(id, full_name)),
        bowling_performances(*, user:users!bowling_performances_user_id_fkey(id, full_name))
      ),
      tournament:tournaments(id, name),
      club:clubs(id, name)
    `)
        .eq("id", matchId)
        .single();

    if (error) {
        console.error("Error fetching match:", error);
        return { data: null, error: error.message };
    }

    return { data, error: null };
}

/**
 * Live scoring snapshot: current players + this over's deliveries,
 * derived entirely from database state so a page refresh never loses
 * the scorer's position.
 */
export async function getScoringState(matchId: string) {
    const supabase = await createServerClient();
    const { data: match, error } = await supabase
        .from("matches")
        .select(`
      *,
      team1:teams!matches_team1_id_fkey(id, name, short_name, logo_url),
      team2:teams!matches_team2_id_fkey(id, name, short_name, logo_url),
      innings(
        *,
        batting_performances(*, user:users!batting_performances_user_id_fkey(id, full_name)),
        bowling_performances(*, user:users!bowling_performances_user_id_fkey(id, full_name))
      )
    `)
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
    const innings = (match?.innings ?? []) as unknown as InningsWithPerformances[];
    const current = innings.find((i) => i.innings_number === match?.current_innings);
    const striker =
        current?.batting_performances.find((p) => p.is_striker && p.is_current_batsman) ?? null;
    const nonStriker =
        current?.batting_performances.find((p) => !p.is_striker && p.is_current_batsman) ?? null;
    const bowler = current?.bowling_performances.find((p) => p.is_current_bowler) ?? null;
    let thisOverDeliveries: Array<{
        runs_scored: number | null;
        extras: number | null;
        extra_type: string | null;
        is_wicket: boolean | null;
    }> = [];
    if (current) {
        const ongoingOver = Math.floor((current.total_balls ?? 0) / 6);
        const { data: balls } = await supabase
            .from("ball_by_ball")
            .select("runs_scored, extras, extra_type, is_wicket")
            .eq("innings_id", current.id)
            .eq("over_number", ongoingOver)
            .order("seq");
        thisOverDeliveries = balls ?? [];
    }
    return {
        data: {
            match,
            strikerId: striker?.user_id ?? null,
            nonStrikerId: nonStriker?.user_id ?? null,
            bowlerId: bowler?.user_id ?? null,
            thisOverDeliveries,
        },
        error: null,
    };
}

// Create a new match
export async function createMatch(formData: MatchFormData) {
    const supabase = await createServerClient();
    const {
        data: { user },
        error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
        return { data: null, error: "You must be logged in to create a match" };
    }
    const { data: match, error: matchError } = await supabase
        .from("matches")
        .insert({
            title: formData.title,
            match_format: formData.matchFormat,
            overs_per_innings: formData.oversPerInnings,
            team1_id: formData.team1Id,
            team2_id: formData.team2Id,
            venue: formData.venue,
            scheduled_at: formData.scheduledAt,
            umpire1_name: formData.umpire1Name,
            umpire2_name: formData.umpire2Name,
            club_id: formData.clubId,
            tournament_id: formData.tournamentId,
            created_by: user.id,
            match_admins: [user.id],
            status: "scheduled",
        })
        .select()
        .single();
    if (matchError) {
        console.error("Error creating match:", matchError);
        return { data: null, error: matchError.message };
    }
    revalidatePath("/matches");
    return { data: match, error: null };
}

// Start a match (create first innings)
export async function startMatch(
    matchId: string,
    tossWinnerId: string,
    tossDecision: "bat" | "bowl"
) {
    const supabase = await createServerClient();
    const { data: match, error: matchError } = await supabase
        .from("matches")
        .select("team1_id, team2_id")
        .eq("id", matchId)
        .single();
    if (matchError || !match) {
        return { data: null, error: "Match not found" };
    }
    const battingTeamId =
        tossDecision === "bat"
            ? tossWinnerId
            : tossWinnerId === match.team1_id
                ? match.team2_id
                : match.team1_id;
    const { error: updateError } = await supabase
        .from("matches")
        .update({
            status: "live",
            toss_winner_team_id: tossWinnerId,
            toss_decision: tossDecision,
            actual_start_time: new Date().toISOString(),
            current_innings: 1,
            current_over: 0,
            current_ball: 0,
        })
        .eq("id", matchId);
    if (updateError) {
        return { data: null, error: updateError.message };
    }
    const { data: innings, error: inningsError } = await supabase
        .from("innings")
        .insert({
            match_id: matchId,
            team_id: battingTeamId,
            innings_number: 1,
        })
        .select()
        .single();
    if (inningsError) {
        return { data: null, error: inningsError.message };
    }
    revalidatePath(`/matches/${matchId}`);
    return { data: { match, innings }, error: null };
}

/**
 * Record one delivery. A single atomic Postgres function inserts the ball
 * and recomputes every projection (totals, batting/bowling figures,
 * partnerships, fall of wickets, strike rotation, over progression,
 * innings/match completion).
 */
export async function recordBall(params: {
    matchId: string;
    bowlerId: string;
    batsmanId: string;
    nonStrikerId: string;
    event: BallEvent;
}): Promise<{ data: ScoringState | null; error: string | null }> {
    const supabase = await createServerClient();
    const { data, error } = await supabase.rpc("record_ball", {
        p_match_id: params.matchId,
        p_bowler_id: params.bowlerId,
        p_batsman_id: params.batsmanId,
        p_non_striker_id: params.nonStrikerId,
        p_runs_scored: params.event.runsScored ?? 0,
        p_extras: params.event.extras ?? 0,
        p_extra_type: params.event.extraType ?? null,
        p_is_wicket: params.event.isWicket ?? false,
        p_dismissal_type: params.event.dismissalType ?? null,
        p_fielder_id: params.event.fielderId ?? null,
        p_commentary: params.event.commentary ?? null,
    });
    if (error) {
        console.error("record_ball failed:", error);
        return { data: null, error: friendlyError(error.message) };
    }
    revalidatePath(`/matches/${params.matchId}`);
    revalidatePath(`/matches/${params.matchId}/score`);
    revalidatePath(`/overlay/${params.matchId}`);
    return { data: data as ScoringState, error: null };
}

/** Remove the most recent delivery and rebuild all projections. */
export async function undoLastBall(
    matchId: string
): Promise<{ data: ScoringState | null; error: string | null }> {
    const supabase = await createServerClient();
    const { data, error } = await supabase.rpc("undo_last_ball", {
        p_match_id: matchId,
    });
    if (error) {
        console.error("undo_last_ball failed:", error);
        return { data: null, error: friendlyError(error.message) };
    }
    revalidatePath(`/matches/${matchId}`);
    revalidatePath(`/matches/${matchId}/score`);
    revalidatePath(`/overlay/${matchId}`);
    return { data: data as ScoringState, error: null };
}

/** Persist who is on strike (opening pair or new batsman after a wicket). */
export async function setCurrentBatsmen(
    matchId: string,
    strikerId: string,
    nonStrikerId: string
): Promise<{ error: string | null }> {
    const supabase = await createServerClient();
    const { error } = await supabase.rpc("set_current_batsmen", {
        p_match_id: matchId,
        p_striker_id: strikerId,
        p_non_striker_id: nonStrikerId,
    });
    if (error) {
        console.error("set_current_batsmen failed:", error);
        return { error: friendlyError(error.message) };
    }
    revalidatePath(`/matches/${matchId}/score`);
    revalidatePath(`/overlay/${matchId}`);
    return { error: null };
}

/** Persist the current bowler (start of innings or new over). */
export async function setCurrentBowler(
    matchId: string,
    bowlerId: string
): Promise<{ error: string | null }> {
    const supabase = await createServerClient();
    const { error } = await supabase.rpc("set_current_bowler", {
        p_match_id: matchId,
        p_bowler_id: bowlerId,
    });
    if (error) {
        console.error("set_current_bowler failed:", error);
        return { error: friendlyError(error.message) };
    }
    revalidatePath(`/matches/${matchId}/score`);
    revalidatePath(`/overlay/${matchId}`);
    return { error: null };
}

/**
 * End the current innings early (declaration / rain). When the first
 * innings closes this creates the second innings with its target; when the
 * second closes it finalizes the match result.
 */
export async function endInnings(
    matchId: string
): Promise<{ data: ScoringState | null; error: string | null }> {
    const supabase = await createServerClient();
    const { data, error } = await supabase.rpc("end_innings", {
        p_match_id: matchId,
    });
    if (error) {
        console.error("end_innings failed:", error);
        return { data: null, error: friendlyError(error.message) };
    }
    revalidatePath(`/matches/${matchId}`);
    revalidatePath(`/matches/${matchId}/score`);
    revalidatePath(`/overlay/${matchId}`);
    return { data: data as ScoringState, error: null };
}

// Get teams for selection

export async function getTeams(clubId?: string) {
    const supabase = await createServerClient();

    let query = supabase.from("teams").select("id, name, short_name, club_id");

    if (clubId) {
        query = query.eq("club_id", clubId);
    }

    const { data, error } = await query.order("name");

    if (error) {
        return { data: null, error: error.message };
    }

    return { data, error: null };
}

// Get team players
export async function getTeamPlayers(teamId: string) {
    const supabase = await createServerClient();

    const { data, error } = await supabase
        .from("team_players")
        .select(`
      *,
      user:users!team_players_user_id_fkey(id, full_name, avatar_url)
    `)
        .eq("team_id", teamId)
        .order("batting_order");

    if (error) {
        return { data: null, error: error.message };
    }

    return { data, error: null };
}

// Get ball-by-ball data for an innings
export async function getBallByBall(matchId: string, inningsNumber?: number) {
    const supabase = await createServerClient();

    let query = supabase
        .from("ball_by_ball")
        .select(`
      *,
      batsman:users!ball_by_ball_batsman_id_fkey(id, full_name),
      bowler:users!ball_by_ball_bowler_id_fkey(id, full_name),
      fielder:users!ball_by_ball_fielder_id_fkey(id, full_name),
      innings:innings!inner(innings_number, team_id)
    `)
        .eq("match_id", matchId)
        .order("over_number", { ascending: true })
        .order("ball_number", { ascending: true });

    if (inningsNumber) {
        query = query.eq("innings.innings_number", inningsNumber);
    }

    const { data, error } = await query;

    if (error) {
        console.error("Error fetching ball by ball:", error);
        return { data: null, error: error.message };
    }

    return { data, error: null };
}

// Get fall of wickets for an innings
export async function getFallOfWickets(matchId: string, inningsNumber?: number) {
    const supabase = await createServerClient();

    let query = supabase
        .from("fall_of_wickets")
        .select(`
      *,
      batsman:users!fall_of_wickets_batsman_out_id_fkey(id, full_name),
      bowler:users!fall_of_wickets_bowler_id_fkey(id, full_name),
      fielder:users!fall_of_wickets_fielder_id_fkey(id, full_name),
      innings:innings!inner(innings_number, team_id)
    `)
        .eq("match_id", matchId)
        .order("wicket_number", { ascending: true });

    if (inningsNumber) {
        query = query.eq("innings.innings_number", inningsNumber);
    }

    const { data, error } = await query;

    if (error) {
        console.error("Error fetching fall of wickets:", error);
        return { data: null, error: error.message };
    }

    return { data, error: null };
}

// Get match with full details including ball-by-ball
export async function getMatchFull(matchId: string) {
    const supabase = await createServerClient();

    const { data, error } = await supabase
        .from("matches")
        .select(`
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
    `)
        .eq("id", matchId)
        .single();

    if (error) {
        console.error("Error fetching match full:", error);
        return { data: null, error: error.message };
    }

    return { data, error: null };
}

/**
 * Ball log for a match — fetched lazily (Balls tab only) so the main
 * match payload never hauls every delivery + player joins.
 */
export async function getMatchBallLog(matchId: string) {
    const supabase = await createServerClient();
    const { data, error } = await supabase
        .from("ball_by_ball")
        .select(`
        *,
        batsman:users!ball_by_ball_batsman_id_fkey(id, full_name),
        bowler:users!ball_by_ball_bowler_id_fkey(id, full_name),
        innings(innings_number, team_id)
    `)
        .eq("match_id", matchId)
        .order("seq");
    if (error) {
        console.error("Error fetching ball log:", error);
        return { data: null, error: error.message };
    }
    return { data, error: null };
}

/**
 * Per-over rollup from the native match_over_summaries view — the data
 * behind Manhattan/over-comparison charts, aggregated by Postgres.
 */
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

/**
 * Partnerships as natively persisted by the scoring engine — no joins to
 * reconstruct, just names for display.
 */
export async function getPartnerships(matchId: string) {
    const supabase = await createServerClient();
    const { data, error } = await supabase
        .from("partnerships")
        .select(`
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
    `)
        .eq("match_id", matchId)
        .order("start_over");
    if (error) {
        console.error("Error fetching partnerships:", error);
        return { data: null, error: error.message };
    }
    return { data, error: null };
}