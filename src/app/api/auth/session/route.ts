import { NextResponse, type NextRequest } from "next/server";
import { getAdminFirestore } from "~/lib/firebase/admin";
import { AdminDataSource } from "~/lib/firebase/datasource-admin";
import { ensureOwnProfile } from "~/lib/firebase/rpc/profiles";
import {
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

    try {
      await ensureOwnProfile(new AdminDataSource(getAdminFirestore()), user);
    } catch (err) {
      console.error("ensureOwnProfile failed during session creation:", err);
    }

    const cookie = await createSessionCookie(idToken);
    const response = NextResponse.json({ ok: true, user });
    const options = sessionCookieOptions();
    response.cookies.set(SESSION_COOKIE_NAME, cookie, options);
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

export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  const options = { ...sessionCookieOptions(), maxAge: 0 };
  response.cookies.set(SESSION_COOKIE_NAME, "", options);
  response.cookies.set(SESSION_HINT_COOKIE_NAME, "", {
    ...options,
    httpOnly: false,
  });
  return response;
}
