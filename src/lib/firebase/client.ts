/**
 * Browser-side Firebase client.
 *
 * Exposes the same `from()` / `rpc()` / `channel()` surface the client
 * components already use, backed by the Firebase web SDK. Reads are
 * governed by `firestore.rules`; writes happen through server actions.
 */

import "client-only";
import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import {
  connectAuthEmulator,
  getAuth,
  type Auth,
  type User as FirebaseUser,
} from "firebase/auth";
import {
  connectFirestoreEmulator,
  getFirestore,
  type Firestore,
} from "firebase/firestore";
import { connectStorageEmulator, getStorage } from "firebase/storage";
import type { AppUser } from "./auth-types";
import {
  EMULATOR_PORTS,
  firebaseEmulatorHost,
  firebaseWebConfig,
  useFirebaseEmulators,
} from "./config";
import { WebDataSource } from "./datasource-web";
import { expandEmbedded, legacyRowsDataSource } from "./legacy-rows";
import { QueryBuilder, type BuilderContext } from "./query-builder";
import { RealtimeChannel } from "./realtime";
import {
  canDeleteMatch,
  canProduceOverlay,
  isClubAdmin,
  isClubMember,
  isMatchAdmin,
  isTeamMember,
} from "./rpc/auth-helpers";
import type { DbResult, SourceName } from "./types";
import { resolveView } from "./views";

export function getFirebaseApp(): FirebaseApp {
  if (getApps().length) return getApp();
  const app = initializeApp(firebaseWebConfig);
  if (useFirebaseEmulators) {
    const host = firebaseEmulatorHost;
    connectAuthEmulator(getAuth(app), `http://${host}:${EMULATOR_PORTS.auth}`, {
      disableWarnings: true,
    });
    connectFirestoreEmulator(getFirestore(app), host, EMULATOR_PORTS.firestore);
    connectStorageEmulator(getStorage(app), host, EMULATOR_PORTS.storage);
  }
  return app;
}

export function getFirebaseAuth(): Auth {
  return getAuth(getFirebaseApp());
}

export function getFirebaseDb(): Firestore {
  return getFirestore(getFirebaseApp());
}

export function toAppUser(user: FirebaseUser): AppUser {
  const name = user.displayName ?? undefined;
  const provider = user.providerData[0]?.providerId ?? null;
  return {
    id: user.uid,
    email: user.email ? user.email.toLowerCase() : null,
    phone: user.phoneNumber ?? null,
    user_metadata: {
      ...(name ? { full_name: name, name } : {}),
      ...(user.photoURL ? { avatar_url: user.photoURL } : {}),
    },
    provider,
  };
}

export class BrowserClient {
  private readonly ds: WebDataSource;
  private readonly ctx: BuilderContext;

  constructor(private readonly db: Firestore) {
    this.ds = new WebDataSource(db);
    this.ctx = {
      ds: legacyRowsDataSource(this.ds),
      expandEmbedded,
      resolveView: (view, filters) => resolveView(this.ds, view, filters),
    };
  }

  readonly auth = {
    getUser: async (): Promise<{
      data: { user: AppUser | null };
      error: null;
    }> => {
      const current = getFirebaseAuth().currentUser;
      return {
        data: { user: current ? toAppUser(current) : null },
        error: null,
      };
    },
  };

  from<T extends SourceName>(table: T): QueryBuilder<T> {
    return new QueryBuilder<T>(this.ctx, table);
  }

  async rpc<T = unknown>(
    name: string,
    args: Record<string, unknown> = {},
  ): Promise<DbResult<T>> {
    const uid = getFirebaseAuth().currentUser?.uid ?? null;
    const userArg = typeof args.p_user_id === "string" ? args.p_user_id : uid;
    try {
      switch (name) {
        case "is_match_admin":
          return {
            data: (await isMatchAdmin(
              this.ds,
              String(args.p_match_id ?? ""),
              userArg,
            )) as T,
            error: null,
          };
        case "can_delete_match":
          return {
            data: (await canDeleteMatch(
              this.ds,
              String(args.p_match_id ?? ""),
              userArg,
            )) as T,
            error: null,
          };
        case "is_club_admin":
          return {
            data: (await isClubAdmin(
              this.ds,
              String(args.p_club_id ?? ""),
              userArg,
            )) as T,
            error: null,
          };
        case "can_produce_overlay":
          return {
            data: (await canProduceOverlay(
              this.ds,
              String(args.p_match_id ?? ""),
              userArg,
            )) as T,
            error: null,
          };
        case "is_club_member":
          return {
            data: (await isClubMember(
              this.ds,
              String(args.p_club_id ?? ""),
              userArg,
            )) as T,
            error: null,
          };
        case "is_team_member":
          return {
            data: (await isTeamMember(
              this.ds,
              String(args.p_team_id ?? ""),
              userArg,
            )) as T,
            error: null,
          };
        default:
          return {
            data: null,
            error: {
              message: `${name} is only available through a server action`,
            },
          };
      }
    } catch (err) {
      return {
        data: null,
        error: { message: err instanceof Error ? err.message : String(err) },
      };
    }
  }

  channel(topic: string): RealtimeChannel {
    return new RealtimeChannel(this.db, topic);
  }

  async removeChannel(channel: RealtimeChannel): Promise<"ok"> {
    return channel.unsubscribe();
  }
}

let instance: BrowserClient | undefined;

/** Singleton browser client (safe to call during SSR; it initialises lazily). */
export function createClient(): BrowserClient {
  if (!instance) instance = new BrowserClient(getFirebaseDb());
  return instance;
}

/** Lazily-initialised singleton, for modules that prefer a bare object. */
export const firebase: BrowserClient = new Proxy({} as BrowserClient, {
  get(_target, prop) {
    const client = createClient();
    const value = (client as unknown as Record<string | symbol, unknown>)[prop];
    return typeof value === "function"
      ? (value as (...a: unknown[]) => unknown).bind(client)
      : value;
  },
});
