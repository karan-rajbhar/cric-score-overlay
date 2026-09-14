"use server";

import { createServerClient } from "~/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function getTeams(filters?: {
  search?: string;
  type?: "club" | "match" | "tournament";
  /** Only return teams the current user has a stake in. */
  mine?: boolean;
}) {
  const supabase = await createServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (filters?.mine && !user) {
    return { data: [], error: null };
  }

  let query = supabase.from("teams").select(`
      *,
      captain:users!teams_captain_id_fkey(full_name),
      _count:team_players(count)
    `);

  // "mine" shows only teams the user has a stake in (created, lead, or
  // squad member). Without it (e.g. match-creation picker) all teams are
  // visible so opponents can be selected.
  if (user && filters?.mine) {
    const { data: playerRows, error: playerErr } = await supabase
      .from("team_players")
      .select("team_id")
      .eq("user_id", user.id);

    if (playerErr) {
      console.error(
        "Error fetching player team memberships:",
        playerErr.message || playerErr,
      );
    }

    const playerTeamIds =
      playerRows?.map((r) => r.team_id).filter(Boolean) ?? [];

    const orConditions = [
      `created_by.eq.${user.id}`,
      `captain_id.eq.${user.id}`,
      `vice_captain_id.eq.${user.id}`,
    ];
    if (playerTeamIds.length > 0) {
      orConditions.push(`id.in.(${playerTeamIds.join(",")})`);
    }

    query = query.or(orConditions.join(","));
  }

  if (filters?.search) {
    query = query.ilike("name", `%${filters.search}%`);
  }

  if (filters?.type) {
    query = query.eq("team_type", filters.type);
  }

  const { data, error } = await query.order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching teams:", error.message || error);
    return { data: null, error: error.message };
  }

  // Calculate player count from the _count aggregation
  // Supabase returns count as an array of objects
  const teamsWithCount = data.map((team) => ({
    ...team,
    player_count:
      Array.isArray(team._count) && team._count.length > 0
        ? (team._count[0]?.count ?? 0)
        : 0,
  }));

  return { data: teamsWithCount, error: null };
}

export async function getTeam(id: string) {
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
  ) {
    return { data: null, error: "Invalid team ID" };
  }

  const supabase = await createServerClient();

  const { data, error } = await supabase
    .from("teams")
    .select(
      `
      *,
      captain:users!teams_captain_id_fkey(id, full_name, avatar_url),
      vice_captain:users!teams_vice_captain_id_fkey(id, full_name, avatar_url),
      created_by_user:users!teams_created_by_fkey(full_name),
      team_players(
        *,
        user:users!team_players_user_id_fkey(id, full_name, avatar_url, phone, email)
      )
    `,
    )
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
  const name = (formData.get("name") as string)?.trim();
  const short_name = (formData.get("short_name") as string)?.trim() || null;
  const description = (formData.get("description") as string)?.trim() || null;
  const club_id = (formData.get("club_id") as string) || null;
  const team_type =
    (formData.get("team_type") as "club" | "match" | "tournament") || "club";

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "You must be logged in to create a team" };
  }

  if (!name) {
    return { error: "Team name is required" };
  }

  if (club_id) {
    const { data: club } = await supabase
      .from("clubs")
      .select("owner_id")
      .eq("id", club_id)
      .single();

    if (!club) {
      return { error: "Specified club does not exist" };
    }

    if (club.owner_id !== user.id) {
      const { data: membership } = await supabase
        .from("club_memberships")
        .select("id")
        .eq("club_id", club_id)
        .eq("user_id", user.id)
        .in("role", ["owner", "admin"])
        .eq("status", "active")
        .maybeSingle();

      if (!membership) {
        return {
          error:
            "You must be an owner or admin of the club to create teams for it",
        };
      }
    }
  }

  const { data, error } = await supabase
    .from("teams")
    .insert({
      name,
      short_name,
      description,
      club_id,
      team_type,
      captain_id: user.id,
      created_by: user.id,
    })
    .select()
    .single();

  if (error) {
    console.error("Error creating team:", error);
    return { error: error.message };
  }

  // Auto-add creator as playing squad captain
  await supabase.from("team_players").insert({
    team_id: data.id,
    user_id: user.id,
    role_in_team: "captain",
    is_playing_xi: true,
    added_by: user.id,
  });

  revalidatePath("/teams");
  if (club_id) {
    revalidatePath(`/clubs/${club_id}`);
  }
  redirect(`/teams/${data.id}`);
}

/**
 * Create a team without navigating away — used by inline flows such as
 * "new team" inside the create-match wizard.
 */
export async function createTeamQuick(name: string, shortName?: string) {
  const supabase = await createServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { data: null, error: "You must be logged in to create a team" };
  }

  const trimmed = name.trim();
  if (!trimmed) {
    return { data: null, error: "Team name is required" };
  }

  const { data, error } = await supabase
    .from("teams")
    .insert({
      name: trimmed,
      short_name: shortName?.trim() || null,
      created_by: user.id,
      is_template: false,
      team_type: "club",
    })
    .select("id, name, short_name, club_id")
    .single();

  if (error) {
    console.error("Error creating team:", error);
    return { data: null, error: error.message };
  }

  revalidatePath("/teams");
  return { data, error: null };
}

/**
 * Add a player who isn't on the platform yet — used inline while scoring
 * when the squad doesn't have enough names. Creates the player's identity
 * and squad entry in one step via create_team_player().
 */
export async function createPlayerQuick(teamId: string, fullName: string) {
  const supabase = await createServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { data: null, error: "You must be logged in to add players" };
  }

  const { data, error } = await supabase.rpc("create_team_player", {
    p_team_id: teamId,
    p_full_name: fullName,
  });

  if (error) {
    console.error("Error creating player:", error);
    if (error.message.includes("not_authorized")) {
      return {
        data: null,
        error:
          "Only team captains, club admins, or match admins can add players",
      };
    }
    if (error.message.includes("team_not_found")) {
      return { data: null, error: "Team no longer exists" };
    }
    return { data: null, error: error.message };
  }

  revalidatePath(`/teams/${teamId}`);
  return { data: data as { user_id: string; full_name: string }, error: null };
}

async function checkTeamManageAuth(
  supabase: Awaited<ReturnType<typeof createServerClient>>,
  teamId: string,
  userId: string,
): Promise<boolean> {
  const { data: team } = await supabase
    .from("teams")
    .select("created_by, captain_id, vice_captain_id, club_id")
    .eq("id", teamId)
    .single();

  if (!team) return false;

  if (
    team.created_by === userId ||
    team.captain_id === userId ||
    team.vice_captain_id === userId
  ) {
    return true;
  }

  if (team.club_id) {
    const { data: club } = await supabase
      .from("clubs")
      .select("owner_id")
      .eq("id", team.club_id)
      .single();

    if (club?.owner_id === userId) return true;

    const { data: mem } = await supabase
      .from("club_memberships")
      .select("id")
      .eq("club_id", team.club_id)
      .eq("user_id", userId)
      .in("role", ["owner", "admin"])
      .eq("status", "active")
      .maybeSingle();

    if (mem) return true;
  }

  return false;
}

export async function updateTeam(id: string, formData: FormData) {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "You must be logged in to update a team" };

  const canManage = await checkTeamManageAuth(supabase, id, user.id);
  if (!canManage) {
    return {
      error:
        "Only team captains, creators, or club admins can update this team",
    };
  }

  const name = (formData.get("name") as string)?.trim();
  if (!name) return { error: "Team name is required" };
  const short_name = (formData.get("short_name") as string)?.trim() || null;
  const description = (formData.get("description") as string)?.trim() || null;

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

export async function addPlayerToTeam(
  teamId: string,
  userId: string,
  role: string = "player",
) {
  const supabase = await createServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "You must be logged in to add players" };

  const canManage = await checkTeamManageAuth(supabase, teamId, user.id);
  if (!canManage) {
    return {
      error:
        "Only team captains, creators, or club admins can add players to this team",
    };
  }

  const { error } = await supabase.from("team_players").insert({
    team_id: teamId,
    user_id: userId,
    role_in_team: role,
    added_by: user.id,
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

export async function removePlayerFromTeam(
  teamId: string,
  userInputId: string,
) {
  const supabase = await createServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "You must be logged in to remove players" };

  const isSelf = user.id === userInputId;
  if (!isSelf) {
    const canManage = await checkTeamManageAuth(supabase, teamId, user.id);
    if (!canManage) {
      return {
        error:
          "Only team captains, creators, or club admins can remove players from this team",
      };
    }
  }

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

export async function updatePlayerRole(
  teamId: string,
  userId: string,
  role: string,
) {
  const supabase = await createServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "You must be logged in to change player roles" };

  const canManage = await checkTeamManageAuth(supabase, teamId, user.id);
  if (!canManage) {
    return {
      error:
        "Only team captains, creators, or club admins can update player roles",
    };
  }

  // Start a transaction-like update if we're setting captain
  if (role === "captain") {
    // Update team captain_id
    await supabase
      .from("teams")
      .update({ captain_id: userId })
      .eq("id", teamId);
  } else if (role === "vice_captain") {
    // Update team vice_captain_id
    await supabase
      .from("teams")
      .update({ vice_captain_id: userId })
      .eq("id", teamId);
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

const MAX_LOGO_BYTES = 2 * 1024 * 1024; // 2 MB
const ALLOWED_LOGO_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/svg+xml",
];

/**
 * Upload a crest for a team and store its public URL on the team row.
 * Only the team captain or creator may do this (enforced again by storage
 * RLS via the team-logos/<team_id>/ folder convention).
 */
export async function updateTeamLogo(teamId: string, file: File) {
  const supabase = await createServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { data: null, error: "You must be logged in" };

  const canManage = await checkTeamManageAuth(supabase, teamId, user.id);
  if (!canManage) {
    return {
      data: null,
      error: "Only team captains, creators, or club admins can change the logo",
    };
  }

  if (file.size > MAX_LOGO_BYTES) {
    return { data: null, error: "Logo must be under 2 MB" };
  }
  if (!ALLOWED_LOGO_TYPES.includes(file.type)) {
    return { data: null, error: "Use PNG, JPG, WebP, or SVG" };
  }

  const ext =
    file.type === "image/svg+xml"
      ? "svg"
      : (file.type.split("/")[1] ?? "png").replace("jpeg", "jpg");
  const path = `${teamId}/logo-${Date.now()}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from("team-logos")
    .upload(path, file, { contentType: file.type, upsert: true });

  if (uploadError) {
    console.error("Logo upload failed:", uploadError);
    return {
      data: null,
      error: "Only the team captain or creator can change the logo",
    };
  }

  const { data: urlData } = supabase.storage
    .from("team-logos")
    .getPublicUrl(path);

  const { error: updateError } = await supabase
    .from("teams")
    .update({ logo_url: urlData.publicUrl })
    .eq("id", teamId);

  if (updateError) {
    console.error("Error saving logo URL:", updateError);
    return { data: null, error: updateError.message };
  }

  revalidatePath(`/teams/${teamId}`);
  return { data: urlData.publicUrl, error: null };
}

export async function removeTeamLogo(teamId: string) {
  const supabase = await createServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be logged in" };

  const canManage = await checkTeamManageAuth(supabase, teamId, user.id);
  if (!canManage) {
    return {
      error:
        "Only team captains, creators, or club admins can remove the team logo",
    };
  }

  const { error } = await supabase
    .from("teams")
    .update({ logo_url: null })
    .eq("id", teamId);

  if (error) {
    console.error("Error removing logo:", error);
    return { error: error.message };
  }

  revalidatePath(`/teams/${teamId}`);
  return { error: null };
}
