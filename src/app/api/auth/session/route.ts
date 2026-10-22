import { NextResponse, type NextRequest } from "next/server";
import { getAdminAuth, getAdminFirestore } from "~/lib/firebase/admin";
import { AdminDataSource } from "~/lib/firebase/datasource-admin";
import { acceptInvitations, canSignIn } from "~/lib/firebase/rpc/access";
import { ensureOwnProfile } from "~/lib/firebase/rpc/profiles";
import type { UsersRow } from "~/lib/firebase/types";
import {
  LEGACY_SESSION_COOKIE_NAME,
  SESSION_COOKIE_NAME,
  SESSION_HINT_COOKIE_NAME,
  createSessionCookie,
  decodedTokenToUser,
  sessionCookieOptions,
  verifyIdToken,
} from "~/lib/firebase/session";

/**
 * Exchanges a Firebase ID token for an HTTP-only session cookie and makes
 * sure the signed-in account has a `users` profile. A readable hint cookie
 * is set alongside so the browser can detect a stale server session.
 *
 * The app is invite-only: an account nobody invited gets a 403, and the
 * Firebase Auth account that Google sign-in just created is deleted.
 */
export async function POST(request: NextRequest) {
  let idToken: string | undefined;
  try {
    const body = (await request.json()) as { idToken?: string };
    idToken = body.idToken;
  } catch {
    idToken = undefined;
  }
  if (!idToken) {
    return NextResponse.json({ error: "Missing idToken" }, { status: 400 });
  }

  try {
    const decoded = await verifyIdToken(idToken);
    const user = decodedTokenToUser(decoded);
    const ds = new AdminDataSource(getAdminFirestore());
    // Read once for both checks below (this runs on every full page load).
    const profile = await ds.getById("users", user.id);

    if (
      !(await canSignIn(ds, user, decoded.email_verified === true, profile))
    ) {
      await getAdminAuth()
        .deleteUser(user.id)
        .catch(() => undefined);
      return NextResponse.json({ error: "invite_only" }, { status: 403 });
    }

    try {
      await ensureOwnProfile(ds, user, profile as unknown as UsersRow | null);
      await acceptInvitations(ds, user.email, user.id);
    } catch (err) {
      console.error("ensureOwnProfile failed during session creation:", err);
    }

    const cookie = await createSessionCookie(idToken);
    const response = NextResponse.json({ ok: true, user });
    const options = sessionCookieOptions();
    response.cookies.set(SESSION_COOKIE_NAME, cookie, options);
    clearLegacySessionCookie(response);
    response.cookies.set(SESSION_HINT_COOKIE_NAME, "1", {
      ...options,
      httpOnly: false,
    });
    return response;
  } catch (err) {
    console.error("Session creation failed:", err);
    return NextResponse.json(
      { error: "Invalid or expired token" },
      { status: 401 },
    );
  }
}

/** The pre-`__Host-` session cookie, replaced by the current one. */
function clearLegacySessionCookie(response: NextResponse) {
  if (LEGACY_SESSION_COOKIE_NAME === SESSION_COOKIE_NAME) return;
  response.cookies.set(LEGACY_SESSION_COOKIE_NAME, "", {
    ...sessionCookieOptions(),
    maxAge: 0,
  });
}

export async function DELETE() {
  // The browser's HTTP cache may hold this user's pages. Not "storage": it
  // would also delete scoring actions queued offline and not yet sent.
  const response = NextResponse.json(
    { ok: true },
    { headers: { "Clear-Site-Data": '"cache"' } },
  );
  const options = { ...sessionCookieOptions(), maxAge: 0 };
  response.cookies.set(SESSION_COOKIE_NAME, "", options);
  clearLegacySessionCookie(response);
  response.cookies.set(SESSION_HINT_COOKIE_NAME, "", {
    ...options,
    httpOnly: false,
  });
  return response;
}
