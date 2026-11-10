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
 * The name before the prefix (until 2026-10-21). It is never read: any host
 * or subdomain could set it. A sign-in sync (`/api/auth/session`) still
 * clears a leftover one.
 */
export const LEGACY_SESSION_COOKIE_NAME = "cric_session";

/** The session cookie's value from a cookie store. */
export function sessionCookieValue(
  get: (name: string) => string | undefined,
): string | undefined {
  return get(SESSION_COOKIE_NAME);
}
