/**
 * The session cookie's name, shared by the server and the route guard
 * (`proxy.ts`, which cannot import the server-only `session.ts`).
 *
 * `__Host-` prefixed in production: the browser then accepts it only when
 * Secure, with Path=/ and no Domain, so no other host or subdomain can set
 * or overwrite it. Plain on http dev servers, where a Secure cookie cannot
 * be set.
 */
export const SESSION_COOKIE_NAME =
  process.env.NODE_ENV === "production" ? "__Host-cric_session" : "cric_session";

/**
 * The name before the prefix. Production sessions created before 2026-10-21
 * still carry it (14 days at most): it is still accepted, and replaced by
 * the next sign-in sync (`/api/auth/session` clears it). Remove after
 * 2026-11-05.
 */
export const LEGACY_SESSION_COOKIE_NAME = "cric_session";

/** The session cookie's value from a cookie store (the legacy name too). */
export function sessionCookieValue(
  get: (name: string) => string | undefined,
): string | undefined {
  return get(SESSION_COOKIE_NAME) ?? get(LEGACY_SESSION_COOKIE_NAME);
}
