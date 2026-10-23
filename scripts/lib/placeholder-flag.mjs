/**
 * `users.is_placeholder` for squad players created before the flag existed
 * (used by scripts/migrate-placeholder-flag.mjs; tested in
 * src/lib/firebase/placeholder-flag.test.ts).
 *
 * A placeholder is a profile a team admin added by name: it has no account
 * and its server-only address (`users_private.email`) is a
 * `...@players.local` one nobody can sign in with. New placeholders get
 * `is_placeholder: true` when created; the scorer search leaves flagged
 * profiles out. This plans the flag for the older ones: profiles with no
 * flag yet (missing or null) whose address is a placeholder one. Profiles
 * with the flag set either way are left alone.
 *
 * Idempotent: planning again after applying yields an empty plan.
 */

/** @typedef {{ id: string } & Record<string, any>} Doc */

export const PLACEHOLDER_EMAIL_DOMAIN = "@players.local";

/**
 * @param {{ users: Doc[]; usersPrivate: Doc[] }} input
 * @returns {{ updates: string[] }} ids of `users` docs to flag
 */
export function planPlaceholderFlags({ users, usersPrivate }) {
  const emailOf = new Map(
    usersPrivate.map((p) => [p.id, typeof p.email === "string" ? p.email : null]),
  );
  const updates = [];
  for (const user of users) {
    if (user.is_placeholder === true || user.is_placeholder === false) continue;
    const email = emailOf.get(user.id);
    if (email && email.endsWith(PLACEHOLDER_EMAIL_DOMAIN)) updates.push(user.id);
  }
  return { updates: updates.sort() };
}
