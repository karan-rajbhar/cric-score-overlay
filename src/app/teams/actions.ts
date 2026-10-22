"use server";

import type { Doc } from "~/lib/firebase/datasource";
import {
  INFIX_LEN,
  isInfixQuery,
  matchesSearch,
  normalizeText,
  searchKey,
} from "~/lib/firebase/derive.mjs";
import { sortRows } from "~/lib/firebase/filters";
import { prefixSearch } from "~/lib/firebase/search";
import { createServerClient } from "~/lib/firebase/server";
import { canManageTeam } from "~/lib/firebase/permissions";
import { refreshLiveMatchesFor } from "~/lib/firebase/live-sync";
import { ensureUserProfile } from "~/lib/firebase/user-profile";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function getTeams(filters?: {
  search?: string;
  type?: "club" | "match" | "tournament";
  /** Only return teams the current user has a stake in. */
  mine?: boolean;
}) {
  const db = await createServerClient();

  const {
    data: { user },
  } = await db.auth.getUser();

  if (filters?.mine && !user) {
    return { data: [], error: null };
  }

  // `_count` comes first: it is served from the team's roster, whose player
  // snapshots then answer the captain lookup without a profile read.
  const SELECT = `
      *,
      _count:team_players(count),
      captain:users!teams_captain_id_fkey(full_name)
    `;
  const searchFor = filters?.search ? searchKey(filters.search) : null;
  if (filters?.search && !searchFor) return { data: [], error: null };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- rows are loosely typed (see ResultRow)
  let data: any[] | null = null;
  let error: { message: string } | null = null;
  if (user && filters?.mine) {
    // "mine" shows only teams the user has a stake in (created, lead, or
    // squad member): one indexed query per kind of stake instead of reading
    // every team. Without it (e.g. match-creation picker) all teams are
    // visible so opponents can be selected.
    const { data: playerRows, error: playerErr } = await db
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
    const results = await Promise.all([
      db.from("teams").select(SELECT).eq("created_by", user.id),
      db.from("teams").select(SELECT).eq("captain_id", user.id),
      db.from("teams").select(SELECT).eq("vice_captain_id", user.id),
      playerTeamIds.length
        ? db.from("teams").select(SELECT).in("id", playerTeamIds)
        : Promise.resolve({ data: [], error: null }),
    ]);
    error = results.find((r) => r.error)?.error ?? null;
    const byId = new Map<string, Record<string, unknown>>();
    for (const r of results) {
      for (const t of (r.data ?? []) as Record<string, unknown>[]) {
        byId.set(String(t.id), t);
      }
    }
    // The user's own teams are few: search / type are checked in memory.
    data = sortRows(
      [...byId.values()]
        .filter(
          (t) =>
            (!filters.type || t.team_type === filters.type) &&
            (!searchFor ||
              matchesSearch(filters.search, [t.name, t.short_name])),
        )
        .sort((a, b) => (String(a.id) < String(b.id) ? -1 : 1)) as Doc[],
      [{ field: "created_at", ascending: false, nullsFirst: true }],
    );
  } else {
    let query = db.from("teams").select(SELECT);
    // A one-word query of 4+ characters looks up its first trigram (every
    // name containing the query, at a word start or inside a word, has it)
    // and is confirmed in memory, as are queries longer than the stored keys.
    const norm = filters?.search ? normalizeText(filters.search) : "";
    const key =
      searchFor && isInfixQuery(norm) && norm.length > INFIX_LEN
        ? norm.slice(0, INFIX_LEN)
        : searchFor;
    if (key) {
      // Native search_prefixes match instead of a scan.
      query = query.contains("search_prefixes", [key]);
    }
    if (filters?.type) {
      query = query.eq("team_type", filters.type);
    }
    const res = await query.order("created_at", { ascending: false });
    data = res.data;
    error = res.error;
    if (data && key && key !== norm) {
      data = data.filter((t) =>
        matchesSearch(filters!.search, [t.name, t.short_name]),
      );
    }
  }

  if (error || !data) {
    console.error("Error fetching teams:", error?.message || error);
    return { data: null, error: error?.message ?? "Failed to load teams" };
  }

  // Calculate player count from the _count aggregation
  // Count relations come back as a one-element array
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

  const db = await createServerClient();

  // team_players first: served from the team's roster, whose player
  // snapshots then answer the captain / vice-captain / creator lookups.
  const { data, error } = await db
    .from("teams")
    .select(
      `
      *,
      team_players(
        *,
        user:users!team_players_user_id_fkey(id, full_name, avatar_url)
      ),
      captain:users!teams_captain_id_fkey(id, full_name, avatar_url),
      vice_captain:users!teams_vice_captain_id_fkey(id, full_name, avatar_url),
      created_by_user:users!teams_created_by_fkey(full_name)
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
  const db = await createServerClient();
  const name = (formData.get("name") as string)?.trim();
  const short_name = (formData.get("short_name") as string)?.trim() || null;
  const description = (formData.get("description") as string)?.trim() || null;
  const club_id = (formData.get("club_id") as string) || null;
  const team_type =
    (formData.get("team_type") as "club" | "match" | "tournament") || "club";

  const {
    data: { user },
  } = await db.auth.getUser();

  if (!user) {
    return { error: "You must be logged in to create a team" };
  }

  await ensureUserProfile(db, user);

  if (!name) {
    return { error: "Team name is required" };
  }

  if (club_id) {
    const { data: club } = await db
      .from("clubs")
      .select("owner_id")
      .eq("id", club_id)
      .single();

    if (!club) {
      return { error: "Specified club does not exist" };
    }

    if (club.owner_id !== user.id) {
      const { data: membership } = await db
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

  const { data, error } = await db
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
  await db.from("team_players").insert({
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
  const db = await createServerClient();

  const {
    data: { user },
  } = await db.auth.getUser();

  if (!user) {
    return { data: null, error: "You must be logged in to create a team" };
  }

  await ensureUserProfile(db, user);

  const trimmed = name.trim();
  if (!trimmed) {
    return { data: null, error: "Team name is required" };
  }

  const { data, error } = await db
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
/**
 * Adds a new player to a team. `matchId`: added from that match's scoring
 * screen, so its scorers (invited co-scorers too) may add one.
 */
export async function createPlayerQuick(
  teamId: string,
  fullName: string,
  matchId?: string | null,
) {
  try {
    const db = await createServerClient();

    const {
      data: { user },
    } = await db.auth.getUser();

    if (!user) {
      return { data: null, error: "You must be logged in to add players" };
    }

    await ensureUserProfile(db, user);

    const { data, error } = await db.rpc("create_team_player", {
      p_team_id: teamId,
      p_full_name: fullName,
      ...(matchId ? { p_match_id: matchId } : {}),
    });

    if (error) {
      console.error("Error creating player:", error);
      if (error.message.includes("not_authorized")) {
        return {
          data: null,
          error:
            "Only team captains, club admins or this match's scorers can add players",
        };
      }
      if (error.message.includes("team_not_found")) {
        return { data: null, error: "Team no longer exists" };
      }
      return { data: null, error: error.message };
    }

    revalidatePath(`/teams/${teamId}`);
    // A live match of this team shows its squad: tell its viewers now.
    await refreshLiveMatchesFor(db, { teamId });
    return { data: data as { user_id: string; full_name: string }, error: null };
  } catch (err) {
    console.error("Unexpected error in createPlayerQuick:", err);
    return {
      data: null,
      error: err instanceof Error ? err.message : "Failed to create player",
    };
  }
}

/**
 * Adds a registered player (found by `searchUsers`) to a team's squad from
 * the scoring screen: like `createPlayerQuick`, the match's scorers may do
 * it until the match is over.
 */
export async function addExistingPlayerQuick(
  teamId: string,
  userId: string,
  matchId?: string | null,
) {
  try {
    const db = await createServerClient();
    const {
      data: { user },
    } = await db.auth.getUser();
    if (!user) {
      return { data: null, error: "You must be logged in to add players" };
    }

    const { data, error } = await db.rpc("add_team_player", {
      p_team_id: teamId,
      p_user_id: userId,
      ...(matchId ? { p_match_id: matchId } : {}),
    });
    if (error) {
      console.error("Error adding player:", error);
      if (error.message.includes("not_authorized")) {
        return {
          data: null,
          error:
            "Only team captains, club admins or this match's scorers can add players",
        };
      }
      if (error.message.includes("team_not_found")) {
        return { data: null, error: "Team no longer exists" };
      }
      if (error.message.includes("player_not_found")) {
        return { data: null, error: "That player no longer exists" };
      }
      return { data: null, error: error.message };
    }

    revalidatePath(`/teams/${teamId}`);
    // A live match of this team shows its squad: tell its viewers now.
    await refreshLiveMatchesFor(db, { teamId });
    return { data: data as { user_id: string; full_name: string }, error: null };
  } catch (err) {
    console.error("Unexpected error in addExistingPlayerQuick:", err);
    return {
      data: null,
      error: err instanceof Error ? err.message : "Failed to add player",
    };
  }
}

export async function addPlayerToTeam(
  teamId: string,
  userId: string,
  role: string = "player",
) {
  const db = await createServerClient();

  const {
    data: { user },
  } = await db.auth.getUser();

  if (!user) return { error: "You must be logged in to add players" };

  await ensureUserProfile(db, user);

  const canManage = await canManageTeam(db, teamId, user.id);
  if (!canManage) {
    return {
      error:
        "Only team captains, creators, or club admins can add players to this team",
    };
  }

  const { error } = await db.from("team_players").insert({
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
  await refreshLiveMatchesFor(db, { teamId });
  return { success: true };
}

export async function removePlayerFromTeam(
  teamId: string,
  userInputId: string,
) {
  const db = await createServerClient();

  const {
    data: { user },
  } = await db.auth.getUser();

  if (!user) return { error: "You must be logged in to remove players" };

  const isSelf = user.id === userInputId;
  if (!isSelf) {
    const canManage = await canManageTeam(db, teamId, user.id);
    if (!canManage) {
      return {
        error:
          "Only team captains, creators, or club admins can remove players from this team",
      };
    }
  }

  const { error } = await db
    .from("team_players")
    .delete()
    .eq("team_id", teamId)
    .eq("user_id", userInputId);

  if (error) {
    console.error("Error removing player:", error);
    return { error: error.message };
  }

  revalidatePath(`/teams/${teamId}`);
  await refreshLiveMatchesFor(db, { teamId });
  return { success: true };
}

export async function updatePlayerRole(
  teamId: string,
  userId: string,
  role: string,
) {
  const db = await createServerClient();

  const {
    data: { user },
  } = await db.auth.getUser();

  if (!user) return { error: "You must be logged in to change player roles" };

  const canManage = await canManageTeam(db, teamId, user.id);
  if (!canManage) {
    return {
      error:
        "Only team captains, creators, or club admins can update player roles",
    };
  }

  // Start a transaction-like update if we're setting captain
  if (role === "captain") {
    // Update team captain_id
    await db
      .from("teams")
      .update({ captain_id: userId })
      .eq("id", teamId);
  } else if (role === "vice_captain") {
    // Update team vice_captain_id
    await db
      .from("teams")
      .update({ vice_captain_id: userId })
      .eq("id", teamId);
  }

  const { error } = await db
    .from("team_players")
    .update({ role_in_team: role })
    .eq("team_id", teamId)
    .eq("user_id", userId);

  if (error) {
    console.error("Error updating player role:", error);
    return { error: error.message };
  }

  revalidatePath(`/teams/${teamId}`);
  // Captain / vice-captain markers show on a live match's squads.
  await refreshLiveMatchesFor(db, { teamId });
  return { success: true };
}

export async function searchUsers(query: string) {
  const db = await createServerClient();

  if (!query || query.length < 2) return { data: [] };

  // Word-prefix match on name / @username: reads at most 10 profiles.
  const { data, error } = await prefixSearch(
    db,
    "users",
    query,
    "id, full_name, avatar_url, username",
    10,
  );

  if (error) {
    console.error("Error searching users:", error);
    return { data: [], error };
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
  const db = await createServerClient();

  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) return { data: null, error: "You must be logged in" };

  const canManage = await canManageTeam(db, teamId, user.id);
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

  const { error: uploadError } = await db.storage
    .from("team-logos")
    .upload(path, file, {
      contentType: file.type,
      upsert: true,
      // A new path per upload: the file at it never changes.
      immutable: true,
    });

  if (uploadError) {
    console.error("Logo upload failed:", uploadError);
    return {
      data: null,
      error: "Only the team captain or creator can change the logo",
    };
  }

  const { data: urlData } = db.storage
    .from("team-logos")
    .getPublicUrl(path);

  const { error: updateError } = await db
    .from("teams")
    .update({ logo_url: urlData.publicUrl })
    .eq("id", teamId);

  if (updateError) {
    console.error("Error saving logo URL:", updateError);
    return { data: null, error: updateError.message };
  }

  await refreshLiveMatchesFor(db, { teamId });
  revalidatePath(`/teams/${teamId}`);
  return { data: urlData.publicUrl, error: null };
}

export async function removeTeamLogo(teamId: string) {
  const db = await createServerClient();

  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) return { error: "You must be logged in" };

  const canManage = await canManageTeam(db, teamId, user.id);
  if (!canManage) {
    return {
      error:
        "Only team captains, creators, or club admins can remove the team logo",
    };
  }

  const { error } = await db
    .from("teams")
    .update({ logo_url: null })
    .eq("id", teamId);

  if (error) {
    console.error("Error removing logo:", error);
    return { error: error.message };
  }

  await refreshLiveMatchesFor(db, { teamId });
  revalidatePath(`/teams/${teamId}`);
  return { error: null };
}
