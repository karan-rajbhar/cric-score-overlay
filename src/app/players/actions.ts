"use server";

import { revalidatePath } from "next/cache";
import { createServerClient } from "~/lib/supabase/server";
import { validateUsername, cleanHandle } from "~/lib/username";

export interface UsernameCheckResult {
  available: boolean;
  cleanUsername: string;
  error?: string;
}

export interface UpdateUsernameResult {
  success: boolean;
  username?: string;
  error?: string;
}

/**
 * Checks whether a proposed @username handle is valid and available.
 */
export async function checkUsernameAvailability(
  rawUsername: string,
): Promise<UsernameCheckResult> {
  const validation = validateUsername(rawUsername);
  if (!validation.isValid) {
    return {
      available: false,
      cleanUsername: validation.cleanUsername,
      error: validation.error,
    };
  }

  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Call the database-level availability function
  const { data, error } = await supabase.rpc("check_username_available", {
    p_username: validation.cleanUsername,
    p_current_user_id: user?.id ?? undefined,
  });

  if (error) {
    console.error("check_username_available RPC error:", error);
    // Fallback: direct table query
    const { data: existing } = await supabase
      .from("users")
      .select("id")
      .eq("username", validation.cleanUsername)
      .maybeSingle();

    if (existing && existing.id !== user?.id) {
      return {
        available: false,
        cleanUsername: validation.cleanUsername,
        error: "This username is already taken",
      };
    }

    return {
      available: true,
      cleanUsername: validation.cleanUsername,
    };
  }

  const result = data as { available: boolean; error?: string };
  return {
    available: Boolean(result.available),
    cleanUsername: validation.cleanUsername,
    error: result.error,
  };
}

/**
 * Updates the authenticated user's unique @username handle.
 */
export async function updateUsername(
  rawUsername: string,
): Promise<UpdateUsernameResult> {
  const validation = validateUsername(rawUsername);
  if (!validation.isValid) {
    return {
      success: false,
      error: validation.error,
    };
  }

  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      success: false,
      error: "You must be signed in to change your username",
    };
  }

  // Use the security definer RPC which performs atomic checks and updates
  const { data, error } = await supabase.rpc("update_own_username", {
    p_username: validation.cleanUsername,
  });

  if (error) {
    console.error("update_own_username RPC error:", error);
    // Fallback to direct update using authenticated RLS
    const { error: updateError } = await supabase
      .from("users")
      .update({
        username: validation.cleanUsername,
        updated_at: new Date().toISOString(),
      })
      .eq("id", user.id);

    if (updateError) {
      if (updateError.code === "23505") {
        return {
          success: false,
          error: "This username is already taken",
        };
      }
      return {
        success: false,
        error: updateError.message || "Failed to update username",
      };
    }
  } else {
    const result = data as { ok: boolean; error?: string; username?: string };
    if (!result.ok) {
      return {
        success: false,
        error: result.error || "Failed to update username",
      };
    }
  }

  // Update user auth metadata if possible so client sessions have it immediately
  try {
    await supabase.auth.updateUser({
      data: { username: validation.cleanUsername },
    });
  } catch {
    // Non-critical if auth metadata update fails
  }

  revalidatePath("/players");
  revalidatePath("/dashboard");
  revalidatePath("/search");
  revalidatePath(`/players/${validation.cleanUsername}`);
  revalidatePath(`/players/${user.id}`);

  return {
    success: true,
    username: validation.cleanUsername,
  };
}

/**
 * Looks up a player by either their unique UUID or their @username handle.
 */
export async function getPlayerByIdOrHandle(idOrHandle: string) {
  const clean = cleanHandle(idOrHandle);
  if (!clean) return null;

  const supabase = await createServerClient();
  const isUuid =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      clean,
    );

  if (isUuid) {
    const { data } = await supabase
      .from("users")
      .select("id, full_name, avatar_url, email, username, location")
      .eq("id", clean)
      .maybeSingle();
    return data;
  }

  const { data } = await supabase
    .from("users")
    .select("id, full_name, avatar_url, email, username, location")
    .eq("username", clean)
    .maybeSingle();

  return data;
}
