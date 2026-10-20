/**
 * Server-side Firebase client (server components, server actions, route
 * handlers).
 *
 * `createServerClient()` reads the session cookie for the current request
 * and returns a client exposing `auth.getUser()`, `from()`, `rpc()` and
 * `storage` with the same shapes the server actions already consume.
 */

import "server-only";
import { cookies } from "next/headers";
import { getAdminAuth, getAdminFirestore } from "./admin";
import { AdminDataSource } from "./datasource-admin";
import { serverClientFor, type ServerClient } from "./server-client";
import { getUserFromSessionCookie, sessionCookieValue } from "./session";
import { storage } from "./storage";
import type { AppUser } from "./auth-types";

export type { ServerClient };

function buildServerClient(sessionCookie: string | undefined): ServerClient {
  const db = getAdminFirestore();
  let userPromise: Promise<AppUser | null> | null = null;
  return serverClientFor({
    ds: new AdminDataSource(db),
    db,
    getUser: () => (userPromise ??= getUserFromSessionCookie(sessionCookie)),
    setDisplayName: async (uid, name) => {
      await getAdminAuth().updateUser(uid, { displayName: name });
    },
    storage,
  });
}

/** Client bound to the signed-in user of the current request (if any). */
export async function createServerClient(): Promise<ServerClient> {
  const store = await cookies();
  return buildServerClient(
    sessionCookieValue((name) => store.get(name)?.value),
  );
}
