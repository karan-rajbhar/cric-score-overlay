import type { AppUser } from "./auth-types";
import type { QueryBuilder } from "./query-builder";

interface ProfileClient {
  rpc(
    name: string,
    args?: Record<string, unknown>,
  ): Promise<{ error: { message: string } | null }>;
  from(table: "users"): QueryBuilder<"users">;
}

/**
 * Ensures that the authenticated user has a corresponding `users` profile
 * before running mutations that reference it (teams.created_by,
 * clubs.owner_id, matches.created_by, ...).
 */
export async function ensureUserProfile(
  client: ProfileClient,
  user: AppUser | null,
): Promise<void> {
  if (!user?.id) return;

  // 1. Preferred path: the profile routine handles re-mapping and usernames.
  try {
    const { error: rpcError } = await client.rpc("ensure_own_profile");
    if (!rpcError) return;
  } catch {
    // Fall through to the direct checks below.
  }

  // 2. Direct fallback: does the profile already exist?
  try {
    const { data: existingUser } = await client
      .from("users")
      .select("id")
      .eq("id", user.id)
      .maybeSingle();

    if (existingUser) return;

    // 3. Re-map a profile that was created ahead of signup (seed, invite).
    if (user.email) {
      const { data: userByEmail } = await client
        .from("users")
        .select("id")
        .eq("email", user.email.toLowerCase())
        .maybeSingle();

      if (userByEmail) {
        await client
          .from("users")
          .update({ id: user.id, updated_at: new Date().toISOString() })
          .eq("id", userByEmail.id);
        return;
      }
    }

    // 4. Create a fresh profile.
    const fullName =
      (user.user_metadata?.full_name as string) ||
      (user.user_metadata?.name as string) ||
      user.email?.split("@")[0] ||
      "Player";

    await client.from("users").insert({
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
