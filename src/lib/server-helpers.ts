/**
 * Shared helpers for server actions — single responsibility, DRY.
 * Consolidates 54× createServerClient + auth checks and 37× error handling.
 */
import { revalidatePath } from "next/cache";
import { createServerClient } from "~/lib/supabase/server";

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------
export async function requireAuth() {
    const supabase = await createServerClient();
    const {
        data: { user },
        error,
    } = await supabase.auth.getUser();

    if (error || !user) {
        return { supabase, user: null, error: "You must be logged in" as const };
    }
    return { supabase, user, error: null };
}

// ---------------------------------------------------------------------------
// Error handling — consistent { data, error } shape
// ---------------------------------------------------------------------------
export function handleSupabaseError(error: { message: string } | null, context: string) {
    if (!error) return null;
    console.error(`${context}:`, error);
    return error.message;
}

// ---------------------------------------------------------------------------
// Revalidation — scoring mutations always invalidate the same 3 paths
// ---------------------------------------------------------------------------
export function revalidateScoring(matchId: string) {
    revalidatePath(`/matches/${matchId}`);
    revalidatePath(`/matches/${matchId}/score`);
    revalidatePath(`/overlay/${matchId}`);
}

export function revalidateTeam(teamId: string) {
    revalidatePath(`/teams/${teamId}`);
    revalidatePath("/teams");
}

// ---------------------------------------------------------------------------
// Friendly RPC error mapping (single source of truth)
// ---------------------------------------------------------------------------
const RPC_ERROR_MESSAGES: Record<string, string> = {
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
    not_authenticated: "You must be logged in",
    name_required: "Team name is required",
    team_not_found: "Team no longer exists",
};

export function friendlyRpcError(message: string): string {
    const key = message.split('"')[1] ?? message.split("\n")[0]?.trim() ?? message;
    return RPC_ERROR_MESSAGES[key] ?? message;
}

// ---------------------------------------------------------------------------
// Constants — no magic numbers in actions
// ---------------------------------------------------------------------------
export const LOGO = {
    MAX_BYTES: 2 * 1024 * 1024,
    ALLOWED_TYPES: ["image/png", "image/jpeg", "image/webp", "image/svg+xml"] as const,
};

export const SELECTS = {
    TEAM_BASIC: "id, name, short_name, logo_url",
    TEAM_WITH_SQUAD: `*,
        team_players(*, user:users!team_players_user_id_fkey(id, full_name, avatar_url))`,
    INNINGS_PERF: `*,
        batting_performances(*, user:users!batting_performances_user_id_fkey(id, full_name)),
        bowling_performances(*, user:users!bowling_performances_user_id_fkey(id, full_name))`,
    FOW_WITH_NAMES: `*,
        batsman:users!fall_of_wickets_batsman_out_id_fkey(id, full_name),
        bowler:users!fall_of_wickets_bowler_id_fkey(full_name),
        fielder:users!fall_of_wickets_fielder_id_fkey(full_name)`,
    BALL_WITH_NAMES: `*,
        batsman:users!ball_by_ball_batsman_id_fkey(id, full_name),
        bowler:users!ball_by_ball_bowler_id_fkey(id, full_name)`,
};
