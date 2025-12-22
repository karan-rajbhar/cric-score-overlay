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

export interface BallData {
    matchId: string;
    inningsId: string;
    overNumber: number;
    ballNumber: number;
    bowlerId: string;
    batsmanId: string;
    nonStrikerId: string;
    runsScored: number;
    extras?: number;
    extraType?: "wide" | "no_ball" | "bye" | "leg_bye" | "penalty";
    isWicket?: boolean;
    dismissalType?: string;
    fielderId?: string;
    commentary?: string;
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

// Create a new match
export async function createMatch(formData: MatchFormData) {
    const supabase = await createServerClient();

    // Get current user
    const {
        data: { user },
        error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
        return { data: null, error: "You must be logged in to create a match" };
    }

    // Create the match
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

    // Get match details
    const { data: match, error: matchError } = await supabase
        .from("matches")
        .select("team1_id, team2_id")
        .eq("id", matchId)
        .single();

    if (matchError || !match) {
        return { data: null, error: "Match not found" };
    }

    // Determine batting team
    const battingTeamId =
        tossDecision === "bat"
            ? tossWinnerId
            : tossWinnerId === match.team1_id
                ? match.team2_id
                : match.team1_id;

    // Update match status and toss info
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

    // Create first innings
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

// Record a ball
export async function recordBall(ballData: BallData) {
    const supabase = await createServerClient();

    // Insert ball record
    const { data: ball, error: ballError } = await supabase
        .from("ball_by_ball")
        .insert({
            match_id: ballData.matchId,
            innings_id: ballData.inningsId,
            over_number: ballData.overNumber,
            ball_number: ballData.ballNumber,
            bowler_id: ballData.bowlerId,
            batsman_id: ballData.batsmanId,
            non_striker_id: ballData.nonStrikerId,
            runs_scored: ballData.runsScored,
            extras: ballData.extras ?? 0,
            extra_type: ballData.extraType,
            is_wicket: ballData.isWicket ?? false,
            dismissal_type: ballData.dismissalType,
            fielder_id: ballData.fielderId,
            commentary: ballData.commentary,
        })
        .select()
        .single();

    if (ballError) {
        return { data: null, error: ballError.message };
    }

    // Update innings totals
    const totalRuns = ballData.runsScored + (ballData.extras ?? 0);
    const isLegalBall =
        !ballData.extraType ||
        !["wide", "no_ball"].includes(ballData.extraType);

    const { error: inningsError } = await supabase.rpc("update_innings_totals", {
        p_innings_id: ballData.inningsId,
        p_runs: totalRuns,
        p_wickets: ballData.isWicket ? 1 : 0,
        p_balls: isLegalBall ? 1 : 0,
        p_extras: ballData.extras ?? 0,
        p_extra_type: ballData.extraType,
    });

    if (inningsError) {
        console.error("Error updating innings:", inningsError);
    }

    // Update batting performance
    await supabase.rpc("update_batting_performance", {
        p_match_id: ballData.matchId,
        p_innings_id: ballData.inningsId,
        p_user_id: ballData.batsmanId,
        p_runs: ballData.runsScored,
        p_balls: isLegalBall ? 1 : 0,
        p_fours: ballData.runsScored === 4 ? 1 : 0,
        p_sixes: ballData.runsScored === 6 ? 1 : 0,
    });

    // Update bowling performance
    await supabase.rpc("update_bowling_performance", {
        p_match_id: ballData.matchId,
        p_innings_id: ballData.inningsId,
        p_user_id: ballData.bowlerId,
        p_runs: totalRuns,
        p_balls: isLegalBall ? 1 : 0,
        p_wickets: ballData.isWicket ? 1 : 0,
        p_wides: ballData.extraType === "wide" ? 1 : 0,
        p_no_balls: ballData.extraType === "no_ball" ? 1 : 0,
    });

    // Update match current ball/over
    let newBall = ballData.ballNumber;
    let newOver = ballData.overNumber;
    if (isLegalBall && ballData.ballNumber >= 6) {
        newOver = ballData.overNumber + 1;
        newBall = 0;
    } else if (isLegalBall) {
        newBall = ballData.ballNumber + 1;
    }

    await supabase
        .from("matches")
        .update({
            current_over: newOver,
            current_ball: newBall,
        })
        .eq("id", ballData.matchId);

    revalidatePath(`/matches/${ballData.matchId}`);
    return { data: ball, error: null };
}

// End current over
export async function endOver(matchId: string, newBowlerId: string) {
    const supabase = await createServerClient();

    // Get current innings
    const { data: match } = await supabase
        .from("matches")
        .select("current_innings, current_over")
        .eq("id", matchId)
        .single();

    if (!match) {
        return { error: "Match not found" };
    }

    // Update match with new over
    await supabase
        .from("matches")
        .update({
            current_over: match.current_over + 1,
            current_ball: 0,
        })
        .eq("id", matchId);

    revalidatePath(`/matches/${matchId}`);
    return { error: null };
}

// End innings
export async function endInnings(matchId: string) {
    const supabase = await createServerClient();

    // Get match and current innings
    const { data: match } = await supabase
        .from("matches")
        .select(`
      *,
      innings(id, team_id, innings_number, total_runs)
    `)
        .eq("id", matchId)
        .single();

    if (!match) {
        return { error: "Match not found" };
    }

    const currentInnings = match.innings?.find(
        (i: { innings_number: number }) => i.innings_number === match.current_innings
    );

    if (!currentInnings) {
        return { error: "Current innings not found" };
    }

    // Mark current innings as completed
    await supabase
        .from("innings")
        .update({ is_completed: true })
        .eq("id", currentInnings.id);

    if (match.current_innings === 1) {
        // Start second innings
        const bowlingTeamId =
            currentInnings.team_id === match.team1_id
                ? match.team2_id
                : match.team1_id;

        // Create second innings with target
        const { data: newInnings } = await supabase
            .from("innings")
            .insert({
                match_id: matchId,
                team_id: bowlingTeamId,
                innings_number: 2,
                target_runs: currentInnings.total_runs + 1,
            })
            .select()
            .single();

        // Update match
        await supabase
            .from("matches")
            .update({
                current_innings: 2,
                current_over: 0,
                current_ball: 0,
            })
            .eq("id", matchId);

        revalidatePath(`/matches/${matchId}`);
        return { data: newInnings, error: null };
    } else {
        // Match complete - determine winner
        const innings1 = match.innings?.find(
            (i: { innings_number: number }) => i.innings_number === 1
        );
        const innings2 = currentInnings;

        let result_type = "win";
        let winning_team_id = null;
        let win_margin_type = null;
        let win_margin = null;
        let result_description = "";

        if (innings2.total_runs > innings1.total_runs) {
            // Team 2 wins
            winning_team_id = innings2.team_id;
            win_margin_type = "wickets";
            win_margin = 10 - (innings2.total_wickets ?? 0);
            result_description = `Won by ${win_margin} wickets`;
        } else if (innings1.total_runs > innings2.total_runs) {
            // Team 1 wins
            winning_team_id = innings1.team_id;
            win_margin_type = "runs";
            win_margin = innings1.total_runs - innings2.total_runs;
            result_description = `Won by ${win_margin} runs`;
        } else {
            result_type = "tie";
            result_description = "Match tied";
        }

        await supabase
            .from("matches")
            .update({
                status: "completed",
                actual_end_time: new Date().toISOString(),
                result_type,
                winning_team_id,
                win_margin_type,
                win_margin,
                result_description,
            })
            .eq("id", matchId);

        revalidatePath(`/matches/${matchId}`);
        return { data: null, error: null };
    }
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
