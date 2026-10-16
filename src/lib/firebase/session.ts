/**
 * Server-side session handling (server only).
 *
 * The browser signs in with Firebase Auth and exchanges its ID token for an
 * HTTP-only session cookie via `/api/auth/session`. Server components,
 * actions and middleware read that cookie; the Admin SDK verifies it.
 */

import "server-only";
import type { DecodedIdToken } from "firebase-admin/auth";
import { getAdminAuth } from "./admin";
import type { AppUser } from "./auth-types";

export const SESSION_COOKIE_NAME = "cric_session";

/** Non-HTTP-only twin of the session cookie, readable by the browser. */
export const SESSION_HINT_COOKIE_NAME = "cric_session_hint";

/** Firebase caps session cookies at 14 days. */
export const SESSION_TTL_MS = 14 * 24 * 60 * 60 * 1000;

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: Math.floor(SESSION_TTL_MS / 1000),
  };
}

export function decodedTokenToUser(token: DecodedIdToken): AppUser {
  const name = typeof token.name === "string" ? token.name : undefined;
  const picture = typeof token.picture === "string" ? token.picture : undefined;
  const provider =
    typeof token.firebase?.sign_in_provider === "string"
      ? token.firebase.sign_in_provider
      : null;
  return {
    id: token.uid,
    email: token.email ? token.email.toLowerCase() : null,
    phone: token.phone_number ?? null,
    user_metadata: {
      ...(name ? { full_name: name, name } : {}),
      ...(picture ? { avatar_url: picture } : {}),
    },
    provider,
  };
}

export async function createSessionCookie(idToken: string): Promise<string> {
  return getAdminAuth().createSessionCookie(idToken, {
    expiresIn: SESSION_TTL_MS,
  });
}

export async function verifyIdToken(idToken: string): Promise<DecodedIdToken> {
  return getAdminAuth().verifyIdToken(idToken);
}

/** Returns the decoded session, or null when the cookie is missing/invalid. */
export async function verifySessionCookie(
  value: string | undefined,
): Promise<DecodedIdToken | null> {
  if (!value) return null;
  try {
    return await getAdminAuth().verifySessionCookie(value, false);
  } catch {
    return null;
  }
}

export async function getUserFromSessionCookie(
  value: string | undefined,
): Promise<AppUser | null> {
  const decoded = await verifySessionCookie(value);
  return decoded ? decodedTokenToUser(decoded) : null;
}
