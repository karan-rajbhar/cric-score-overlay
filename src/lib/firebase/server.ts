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
import type { AppUser, AuthError } from "./auth-types";
import { AdminDataSource } from "./datasource-admin";
import {
  DbQueryError,
  QueryBuilder,
  type BuilderContext,
} from "./query-builder";
import { expandEmbedded, legacyRowsDataSource } from "./legacy-rows";
import { callRpc } from "./rpc";
import { maybeRecalculateStandings } from "./rpc/standings";
import { syncPlayerMatchesAfterWrite } from "./scorecard-sync";
import { SESSION_COOKIE_NAME, getUserFromSessionCookie } from "./session";
import { storage } from "./storage";
import { syncTeamSnapshots } from "./team-snapshot";
import type { DbError, DbResult, MatchesRow, SourceName } from "./types";
import { resolveView } from "./views";

export interface ServerClient {
  auth: {
    getUser(): Promise<{
      data: { user: AppUser | null };
      error: AuthError | null;
    }>;
    updateUser(attributes: {
      data?: Record<string, unknown>;
    }): Promise<{ data: { user: AppUser | null }; error: AuthError | null }>;
  };
  from<T extends SourceName>(table: T): QueryBuilder<T>;
  rpc<T = unknown>(
    name: string,
    args?: Record<string, unknown>,
  ): Promise<DbResult<T>>;
  storage: typeof storage;
}

function toDbError(err: unknown): DbError {
  if (err instanceof DbQueryError)
    return { message: err.message, code: err.code };
  if (err instanceof Error) return { message: err.message };
  return { message: String(err) };
}

function buildServerClient(sessionCookie: string | undefined): ServerClient {
  const db = getAdminFirestore();
  const ds = new AdminDataSource(db);

  let userPromise: Promise<AppUser | null> | null = null;
  const getUser = () =>
    (userPromise ??= getUserFromSessionCookie(sessionCookie));

  const ctx: BuilderContext = {
    // Reads of the former row collections are served from innings / over
    // documents; everything else passes through.
    ds: legacyRowsDataSource(ds),
    expandEmbedded,
    resolveView: (view, filters) => resolveView(ds, view, filters),
    afterWrite: async (event) => {
      if (event.table === "matches") {
        await maybeRecalculateStandings(
          ds,
          event.before as Partial<MatchesRow> | null,
          event.after as Partial<MatchesRow> | null,
        );
      }
      if (event.table === "matches" || event.table === "teams") {
        await syncTeamSnapshots(ds, event);
      }
      if (event.table === "matches" || event.table === "innings") {
        await syncPlayerMatchesAfterWrite(ds, event);
      }
    },
  };

  return {
    auth: {
      async getUser() {
        const user = await getUser();
        return {
          data: { user },
          error: user
            ? null
            : { message: "Auth session missing!", code: "session_missing" },
        };
      },
      async updateUser(attributes) {
        const user = await getUser();
        if (!user) {
          return {
            data: { user: null },
            error: { message: "Not authenticated" },
          };
        }
        const fullName = attributes.data?.full_name;
        if (typeof fullName === "string" && fullName) {
          await getAdminAuth().updateUser(user.id, { displayName: fullName });
          user.user_metadata = {
            ...user.user_metadata,
            full_name: fullName,
            name: fullName,
          };
        }
        return { data: { user }, error: null };
      },
    },
    from<T extends SourceName>(table: T) {
      return new QueryBuilder<T>(ctx, table);
    },
    async rpc<T = unknown>(
      name: string,
      args: Record<string, unknown> = {},
    ): Promise<DbResult<T>> {
      try {
        const user = await getUser();
        const data = (await callRpc(name, args, {
          db,
          ds,
          uid: user?.id ?? null,
          user,
        })) as T;
        const result: DbResult<T> = { data, error: null };
        return result;
      } catch (err) {
        return { data: null, error: toDbError(err) };
      }
    },
    storage,
  };
}

/** Client bound to the signed-in user of the current request (if any). */
export async function createServerClient(): Promise<ServerClient> {
  const store = await cookies();
  return buildServerClient(store.get(SESSION_COOKIE_NAME)?.value);
}
