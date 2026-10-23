import { maskEmail } from "./mask-email";

/** The address placeholder players get: nobody can sign in with it. */
export const PLACEHOLDER_EMAIL_DOMAIN = "@players.local";

/**
 * A squad player without an account, as their team's admins see them:
 * "placeholder" (no email yet: "Not on CricScore") or "invited" (an admin
 * gave their real email; they have not signed in yet).
 */
export type PlayerClaim =
  | { state: "placeholder" }
  | { state: "invited"; maskedEmail: string };

/**
 * Whether a profile has no account behind it. The flag decides when set;
 * profiles from before it existed are placeholders by their address.
 */
export function isPlaceholderProfile(
  isPlaceholder: boolean | null | undefined,
  email: string | null | undefined,
): boolean {
  if (isPlaceholder === true) return true;
  if (isPlaceholder === false) return false;
  return !email || email.endsWith(PLACEHOLDER_EMAIL_DOMAIN);
}

/**
 * Claim state per player id (accounts are left out). The emails stay on
 * the server: only a masked form leaves this function.
 */
export function squadClaims(
  profiles: readonly { id: string; is_placeholder?: boolean | null }[],
  privates: readonly { id: string; email?: string | null }[],
): Record<string, PlayerClaim> {
  const emailOf = new Map(privates.map((p) => [p.id, p.email ?? null]));
  const out: Record<string, PlayerClaim> = {};
  for (const profile of profiles) {
    const email = emailOf.get(profile.id) ?? null;
    if (!isPlaceholderProfile(profile.is_placeholder, email)) continue;
    out[profile.id] =
      email && !email.endsWith(PLACEHOLDER_EMAIL_DOMAIN)
        ? { state: "invited", maskedEmail: maskEmail(email) }
        : { state: "placeholder" };
  }
  return out;
}
