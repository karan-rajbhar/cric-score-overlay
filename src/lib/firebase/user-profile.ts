import type { AppUser } from "./auth-types";
import type { QueryBuilder } from "./query-builder";

interface ProfileClient {
  rpc(
    name: string,
    args?: Record<string, unknown>,
  ): Promise<{ error: { message: string } | null }>;
  from(table: "users"): QueryBuilder<"users">;
  from(table: "users_private"): QueryBuilder<"users_private">;
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
    //    Emails live in server-only users_private, keyed by the same id.
    const email = user.email?.toLowerCase() ?? null;
    if (email) {
      const { data: byEmail } = await client
        .from("users_private")
        .select("id")
        .eq("email", email)
        .maybeSingle();

      if (byEmail) {
        const now = new Date().toISOString();
        await client
          .from("users")
          .update({ id: user.id, updated_at: now })
          .eq("id", byEmail.id);
        await client
          .from("users_private")
          .update({ id: user.id, updated_at: now })
          .eq("id", byEmail.id);
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
      full_name: fullName,
      avatar_url: (user.user_metadata?.avatar_url as string) || null,
    });
    await client.from("users_private").insert({
      id: user.id,
      email: email ?? `player-${user.id.slice(0, 8)}@players.local`,
      phone: user.phone ?? null,
    });
  } catch (err) {
    console.error("ensureUserProfile fallback failed:", err);
  }
}
