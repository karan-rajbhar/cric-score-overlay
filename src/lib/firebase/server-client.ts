/**
 * The server client over any DataSource: builder context (legacy-row
 * reads, embedded relations, computed views, write hooks) plus `rpc()`.
 *
 * `server.ts` binds it to the Admin SDK and the request's session cookie;
 * tests and read-cost measurements bind it to a `MemoryDataSource`.
 */

import type { Firestore } from "firebase-admin/firestore";
import type { AppUser, AuthError } from "./auth-types";
import type { DataSource } from "./datasource";
import { derivedFieldsDataSource } from "./derived-fields";
import { expandEmbedded, legacyRowsDataSource } from "./legacy-rows";
import {
  DbQueryError,
  QueryBuilder,
  type BuilderContext,
} from "./query-builder";
import { callRpc } from "./rpc";
import { runWriteHooks } from "./write-hooks";
import type * as StorageModule from "./storage";
import type { DbError, DbResult, SourceName } from "./types";
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
  storage: typeof StorageModule.storage;
}

function toDbError(err: unknown): DbError {
  if (err instanceof DbQueryError)
    return { message: err.message, code: err.code };
  if (err instanceof Error) return { message: err.message };
  return { message: String(err) };
}

export interface ServerClientOptions {
  /** Raw storage (Admin SDK or memory). */
  ds: DataSource;
  /** Admin Firestore for transactions; null runs them on `ds` (tests). */
  db: Firestore | null;
  getUser: () => Promise<AppUser | null>;
  /** Mirrors a display-name change into Firebase Auth (server only). */
  setDisplayName?: (uid: string, name: string) => Promise<void>;
  storage?: typeof StorageModule.storage;
}

/**
 * Builder context over `raw`: derived fields (search keys) are added on
 * every write, the former row collections are served from innings / over
 * documents, and write hooks keep denormalized copies in step.
 */
export function builderContextFor(
  raw: DataSource,
  db: Firestore | null,
): { ctx: BuilderContext; ds: DataSource } {
  const ds = derivedFieldsDataSource(raw);
  const ctx: BuilderContext = {
    ds: legacyRowsDataSource(ds),
    expandEmbedded,
    resolveView: (view, filters) => resolveView(ds, view, filters),
    afterWrite: (event) => runWriteHooks({ ds, db }, event),
  };
  return { ctx, ds };
}

export function serverClientFor(options: ServerClientOptions): ServerClient {
  const { ctx, ds } = builderContextFor(options.ds, options.db);
  const getUser = options.getUser;
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
          await options.setDisplayName?.(user.id, fullName);
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
          db: options.db,
          ds,
          uid: user?.id ?? null,
          user,
        })) as T;
        return { data, error: null };
      } catch (err) {
        return { data: null, error: toDbError(err) };
      }
    },
    storage: options.storage as typeof StorageModule.storage,
  };
}
