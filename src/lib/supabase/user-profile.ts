import type { SupabaseClient, User } from "@supabase/supabase-js";

/**
 * Ensures that the authenticated user has a corresponding row in `public.users`
 * before executing mutations that reference `public.users(id)` via foreign keys
 * (e.g. teams.created_by, clubs.owner_id, matches.created_by).
 */
export async function ensureUserProfile(
  supabase: SupabaseClient,
  user: User,
): Promise<void> {
  if (!user?.id) return;

  // 1. First attempt: call the security definer RPC
  try {
    const { error: rpcError } = await supabase.rpc("ensure_own_profile");
    if (!rpcError) return;
  } catch {
    // If RPC call fails or function is unreachable, fallback to direct query
  }

  // 2. Direct fallback: check if user already exists by ID
  try {
    const { data: existingUser } = await supabase
      .from("users")
      .select("id")
      .eq("id", user.id)
      .maybeSingle();

    if (existingUser) return;

    // 3. Check if user exists by email (e.g. from seed data or invites)
    if (user.email) {
      const { data: userByEmail } = await supabase
        .from("users")
        .select("id")
        .eq("email", user.email.toLowerCase())
        .maybeSingle();

      if (userByEmail) {
        // Remap to match auth UUID
        await supabase
          .from("users")
          .update({
            id: user.id,
            updated_at: new Date().toISOString(),
          })
          .eq("id", userByEmail.id);
        return;
      }
    }

    // 4. Insert new user profile
    const fullName =
      (user.user_metadata?.full_name as string) ||
      (user.user_metadata?.name as string) ||
      user.email?.split("@")[0] ||
      "Player";

    await supabase.from("users").insert({
      id: user.id,
      email: user.email ?? `player-${user.id.slice(0, 8)}@players.local`,
      phone: user.phone ?? null,
      full_name: fullName,
      avatar_url: (user.user_metadata?.avatar_url as string) || null,
    });
  } catch (err) {
    console.error("ensureUserProfile fallback failed:", err);
  }
}
