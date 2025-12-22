"use server";

import { createServerClient } from "~/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function getTeams(filters?: {
    search?: string;
    type?: "club" | "match" | "tournament";
}) {
    const supabase = await createServerClient();

    let query = supabase.from("teams").select(`
      *,
      captain:users!teams_captain_id_fkey(full_name),
      _count:team_players(count)
    `);

    if (filters?.search) {
        query = query.ilike("name", `%${filters.search}%`);
    }

    if (filters?.type) {
        query = query.eq("team_type", filters.type);
    }

    const { data, error } = await query.order("created_at", { ascending: false });

    if (error) {
        console.error("Error fetching teams:", error);
        return { data: null, error: error.message };
    }

    // Calculate player count from the _count aggregation if needed
    // Supabase returns count as an array of objects
    const teamsWithCount = data.map((team: any) => ({
        ...team,
        player_count: team._count?.[0]?.count || 0,
    }));

    return { data: teamsWithCount, error: null };
}

export async function getTeam(id: string) {
    const supabase = await createServerClient();

    const { data, error } = await supabase
        .from("teams")
        .select(`
      *,
      captain:users!teams_captain_id_fkey(id, full_name, avatar_url),
      vice_captain:users!teams_vice_captain_id_fkey(id, full_name, avatar_url),
      created_by_user:users!teams_created_by_fkey(full_name),
      team_players(
        *,
        user:users!team_players_user_id_fkey(id, full_name, avatar_url, phone, email)
      )
    `)
        .eq("id", id)
        .single();

    if (error) {
        console.error("Error fetching team:", error);
        return { data: null, error: error.message };
    }

    return { data, error: null };
}

export async function createTeam(formData: FormData) {
    const supabase = await createServerClient();
    const name = formData.get("name") as string;
    const short_name = formData.get("short_name") as string;
    const description = formData.get("description") as string;

    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
        return { error: "You must be logged in to create a team" };
    }

    const { data, error } = await supabase
        .from("teams")
        .insert({
            name,
            short_name,
            description,
            created_by: user.id,
            team_type: "club", // Default to club for now
        })
        .select()
        .single();

    if (error) {
        console.error("Error creating team:", error);
        return { error: error.message };
    }

    revalidatePath("/teams");
    redirect(`/teams/${data.id}`);
}

export async function updateTeam(id: string, formData: FormData) {
    const supabase = await createServerClient();
    const name = formData.get("name") as string;
    const short_name = formData.get("short_name") as string;
    const description = formData.get("description") as string;

    const { error } = await supabase
        .from("teams")
        .update({
            name,
            short_name,
            description,
        })
        .eq("id", id);

    if (error) {
        console.error("Error updating team:", error);
        return { error: error.message };
    }

    revalidatePath(`/teams/${id}`);
    revalidatePath("/teams");
    return { success: true };
}

export async function addPlayerToTeam(teamId: string, userId: string, role: string = "player") {
    const supabase = await createServerClient();

    // Get current user for 'added_by'
    const {
        data: { user },
    } = await supabase.auth.getUser();

    const { error } = await supabase.from("team_players").insert({
        team_id: teamId,
        user_id: userId,
        role_in_team: role,
        added_by: user?.id,
    });

    if (error) {
        // Check for unique violation (player already in team)
        if (error.code === "23505") {
            return { error: "Player is already in this team" };
        }
        console.error("Error adding player:", error);
        return { error: error.message };
    }

    revalidatePath(`/teams/${teamId}`);
    return { success: true };
}

export async function removePlayerFromTeam(teamId: string, userInputId: string) {
    const supabase = await createServerClient();

    // Wait, the argument should probably be the player's user ID, 
    // but let's check if we're passing the team_player record ID or the user ID.
    // The plan said "userId", so let's stick to that for consistency.

    const { error } = await supabase
        .from("team_players")
        .delete()
        .eq("team_id", teamId)
        .eq("user_id", userInputId);

    if (error) {
        console.error("Error removing player:", error);
        return { error: error.message };
    }

    revalidatePath(`/teams/${teamId}`);
    return { success: true };
}

export async function updatePlayerRole(teamId: string, userId: string, role: string) {
    const supabase = await createServerClient();

    // Start a transaction-like update if we're setting captain
    if (role === "captain") {
        // Update team captain_id
        await supabase.from("teams").update({ captain_id: userId }).eq("id", teamId);
    } else if (role === "vice_captain") {
        // Update team vice_captain_id
        await supabase.from("teams").update({ vice_captain_id: userId }).eq("id", teamId);
    }

    const { error } = await supabase
        .from("team_players")
        .update({ role_in_team: role })
        .eq("team_id", teamId)
        .eq("user_id", userId);

    if (error) {
        console.error("Error updating player role:", error);
        return { error: error.message };
    }

    revalidatePath(`/teams/${teamId}`);
    return { success: true };
}

export async function searchUsers(query: string) {
    const supabase = await createServerClient();

    if (!query || query.length < 2) return { data: [] };

    const { data, error } = await supabase
        .from("users")
        .select("id, full_name, email, avatar_url")
        .ilike("full_name", `%${query}%`)
        .limit(10);

    if (error) {
        console.error("Error searching users:", error);
        return { data: [], error: error.message };
    }

    return { data, error: null };
}
