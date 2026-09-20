/**
 * Shared Supabase auth cookie configuration and helpers.
 *
 * Ensures consistent cookie naming between client (@supabase/ssr createBrowserClient)
 * and server (@supabase/ssr createServerClient), even when requests are proxied via
 * Cloudflare tunnels, local IP addresses, or custom domains.
 */

export const SUPABASE_AUTH_COOKIE_NAME = "sb-cric-auth-token";

export interface SimpleCookie {
  name: string;
  value: string;
}

/**
 * Resolves auth cookies so that both the standardized "sb-cric-auth-token"
 * and any legacy/dynamic cookies (like "sb-127-auth-token" or "sb-<tunnel>-auth-token")
 * are correctly recognized by @supabase/ssr across client, server, and middleware.
 */
export function resolveAuthCookies<T extends SimpleCookie>(cookies: T[]): T[] {
  const hasStandard = cookies.some(
    (c) =>
      c.name === SUPABASE_AUTH_COOKIE_NAME ||
      c.name.startsWith(`${SUPABASE_AUTH_COOKIE_NAME}.`) ||
      c.name.startsWith(`${SUPABASE_AUTH_COOKIE_NAME}-`),
  );

  if (hasStandard) {
    return cookies;
  }

  const legacyCookies = cookies.filter(
    (c) =>
      c.name.startsWith("sb-") &&
      (c.name.includes("-auth-token") || c.name.endsWith("-code-verifier")),
  );

  if (legacyCookies.length === 0) {
    return cookies;
  }

  const mappedLegacy: T[] = [];
  for (const c of legacyCookies) {
    const match = c.name.match(/^sb-.*?-auth-token(\.\d+|-code-verifier)?$/);
    if (match) {
      const suffix = match[1] ?? "";
      mappedLegacy.push({
        ...c,
        name: `${SUPABASE_AUTH_COOKIE_NAME}${suffix}`,
      });
    }
  }

  return [...cookies, ...mappedLegacy];
}

/**
 * Browser-side migration helper: if document.cookie contains legacy
 * session cookies (e.g. from before storageKey standardization),
 * copies them to the standardized cookie name so the session persists
 * seamlessly without requiring a re-login.
 */
export function migrateLegacyBrowserCookies() {
  if (typeof document === "undefined") return;
  try {
    const raw = document.cookie;
    if (!raw) return;

    const cookiePairs = raw.split("; ");
    const hasStandard = cookiePairs.some((pair) => {
      const name = pair.split("=")[0]?.trim();
      return (
        name === SUPABASE_AUTH_COOKIE_NAME ||
        name?.startsWith(`${SUPABASE_AUTH_COOKIE_NAME}.`) ||
        name?.startsWith(`${SUPABASE_AUTH_COOKIE_NAME}-`)
      );
    });

    if (hasStandard) return;

    for (const pair of cookiePairs) {
      const [namePart, ...valueParts] = pair.split("=");
      const name = namePart?.trim();
      if (!name) continue;

      const match = name.match(/^sb-.*?-auth-token(\.\d+|-code-verifier)?$/);
      if (match && !name.startsWith(SUPABASE_AUTH_COOKIE_NAME)) {
        const suffix = match[1] ?? "";
        const newName = `${SUPABASE_AUTH_COOKIE_NAME}${suffix}`;
        const val = valueParts.join("=");
        document.cookie = `${newName}=${val}; path=/; max-age=34560000; SameSite=Lax`;
      }
    }
  } catch {
    // Ignore cookie migration errors in restricted environments
  }
}
