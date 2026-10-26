/**
 * The signed-in user as the server knows it, for the root layout to seed the
 * browser's auth context with: the first HTML then already shows the right
 * header and buttons instead of a signed-out page that flips once Firebase
 * Auth has restored the session in the browser.
 *
 * The cookie is checked locally (signature and expiry, no revocation lookup:
 * no billed Firestore read). Anything wrong with it means "not signed in";
 * the browser then settles it as before.
 */

import "server-only";
import { cookies } from "next/headers";
import { getUserFromSessionCookie, sessionCookieValue } from "./session";
import type { AppUser } from "./auth-types";

export async function getInitialUser(): Promise<AppUser | null> {
  try {
    const store = await cookies();
    return await getUserFromSessionCookie(
      sessionCookieValue((name) => store.get(name)?.value),
    );
  } catch {
    return null;
  }
}
